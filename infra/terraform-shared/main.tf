terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_ami" "ubuntu_arm64" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

resource "aws_security_group" "shared" {
  name        = "${var.app_name}-sg"
  description = "Shared web host: HTTP, HTTPS and restricted SSH"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.app_name}-sg" }
}

resource "aws_iam_role" "shared" {
  name = "${var.app_name}-ec2"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecr" {
  role       = aws_iam_role.shared.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy" "shared_data" {
  name = "${var.app_name}-data-access"
  role = aws_iam_role.shared.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:GetParameters", "ssm:GetParametersByPath"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/asis/api",
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/asis/api/*",
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/turnos/api",
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/turnos/api/*",
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/quiero-menu/api",
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/quiero-menu/api/*",
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [for bucket in var.s3_buckets : "arn:aws:s3:::${bucket}"]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [for bucket in var.s3_buckets : "arn:aws:s3:::${bucket}/*"]
      }
    ]
  })
}

data "aws_caller_identity" "current" {}

resource "aws_iam_instance_profile" "shared" {
  name = "${var.app_name}-ec2"
  role = aws_iam_role.shared.name
}

resource "aws_instance" "shared" {
  ami                         = data.aws_ami.ubuntu_arm64.id
  instance_type               = var.instance_type
  key_name                    = var.key_name
  vpc_security_group_ids      = [aws_security_group.shared.id]
  iam_instance_profile        = aws_iam_instance_profile.shared.name
  user_data                   = file("${path.module}/user-data.sh")
  user_data_replace_on_change = false

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
    encrypted   = true
  }

  tags = {
    Name = "${var.app_name}-server"
  }
}

resource "aws_eip" "shared" {
  instance = aws_instance.shared.id
  tags     = { Name = "${var.app_name}-eip" }
}

data "aws_route53_zone" "asis" {
  name         = "asis.chat"
  private_zone = false
}

data "aws_route53_zone" "fluws" {
  name         = "fluws.com"
  private_zone = false
}

data "aws_route53_zone" "quiero" {
  name         = "quiero.menu"
  private_zone = false
}

resource "aws_route53_record" "apex" {
  for_each = {
    for name, zone_id in {
      asis   = data.aws_route53_zone.asis.zone_id
      fluws  = data.aws_route53_zone.fluws.zone_id
      quiero = data.aws_route53_zone.quiero.zone_id
    } : name => zone_id if contains(var.managed_domains, name)
  }

  zone_id         = each.value
  name            = each.key == "asis" ? "asis.chat" : each.key == "fluws" ? "fluws.com" : "quiero.menu"
  type            = "A"
  ttl             = 300
  records         = [aws_eip.shared.public_ip]
  allow_overwrite = true
}

resource "aws_route53_record" "www_fluws" {
  count           = contains(var.managed_domains, "fluws") ? 1 : 0
  zone_id         = data.aws_route53_zone.fluws.zone_id
  name            = "www.fluws.com"
  type            = "A"
  ttl             = 300
  records         = [aws_eip.shared.public_ip]
  allow_overwrite = true
}

resource "aws_route53_record" "media_asis" {
  count           = contains(var.managed_domains, "asis") ? 1 : 0
  zone_id         = data.aws_route53_zone.asis.zone_id
  name            = "media.asis.chat"
  type            = "A"
  ttl             = 300
  records         = [aws_eip.shared.public_ip]
  allow_overwrite = true
}

resource "aws_route53_record" "turnos_fluws" {
  count           = contains(var.managed_domains, "fluws") ? 1 : 0
  zone_id         = data.aws_route53_zone.fluws.zone_id
  name            = "turnos.fluws.com"
  type            = "A"
  ttl             = 300
  records         = [aws_eip.shared.public_ip]
  allow_overwrite = true
}
