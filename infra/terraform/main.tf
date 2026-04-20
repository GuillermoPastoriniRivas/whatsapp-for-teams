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

# --- Latest Ubuntu 24.04 AMI ---
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# --- Security Group ---
resource "aws_security_group" "hivvo" {
  name        = "${var.app_name}-sg"
  description = "Allow HTTP, HTTPS, SSH"

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

  tags = {
    Name = "${var.app_name}-sg"
  }
}

# --- EC2 Instance ---
resource "aws_instance" "hivvo" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.hivvo.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_ses.name

  user_data = file("${path.module}/user-data.sh")

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  tags = {
    Name = "${var.app_name}-server"
  }

  lifecycle {
    # Evita replace del EC2 cuando Canonical publica un AMI nuevo.
    # Si querés upgradear el AMI a propósito, remové esta línea temporalmente.
    ignore_changes = [ami]
    # Red de seguridad: terraform destroy falla en este recurso. Para forzarlo,
    # hay que remover esta línea a propósito.
    prevent_destroy = true
  }
}

# --- Elastic IP (so the IP doesn't change on reboot) ---
resource "aws_eip" "hivvo" {
  instance = aws_instance.hivvo.id

  tags = {
    Name = "${var.app_name}-eip"
  }
}
