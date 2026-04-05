# ─────────────────────────────────────────────────
# Route 53 Hosted Zone for asis.chat
# ─────────────────────────────────────────────────

resource "aws_route53_zone" "asis_chat" {
  name = "asis.chat"

  tags = {
    Name = "asis.chat"
  }
}

# ─────────────────────────────────────────────────
# Existing DNS records (migrated from GoDaddy)
# ─────────────────────────────────────────────────

resource "aws_route53_record" "root_a" {
  zone_id = aws_route53_zone.asis_chat.zone_id
  name    = "asis.chat"
  type    = "A"
  ttl     = 300
  records = [aws_eip.hivvo.public_ip]
}

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.asis_chat.zone_id
  name    = "www.asis.chat"
  type    = "CNAME"
  ttl     = 300
  records = ["asis.chat"]
}

# ─────────────────────────────────────────────────
# SES Domain Identity + Verification
# ─────────────────────────────────────────────────

resource "aws_ses_domain_identity" "asis_chat" {
  domain = "asis.chat"
}

resource "aws_route53_record" "ses_verification" {
  zone_id = aws_route53_zone.asis_chat.zone_id
  name    = "_amazonses.asis.chat"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.asis_chat.verification_token]
}

resource "aws_ses_domain_identity_verification" "asis_chat" {
  domain     = aws_ses_domain_identity.asis_chat.id
  depends_on = [aws_route53_record.ses_verification]
}

# ─────────────────────────────────────────────────
# DKIM (3 CNAME records)
# ─────────────────────────────────────────────────

resource "aws_ses_domain_dkim" "asis_chat" {
  domain = aws_ses_domain_identity.asis_chat.domain
}

resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = aws_route53_zone.asis_chat.zone_id
  name    = "${aws_ses_domain_dkim.asis_chat.dkim_tokens[count.index]}._domainkey.asis.chat"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.asis_chat.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# ─────────────────────────────────────────────────
# Custom MAIL FROM domain (mail.asis.chat)
# ─────────────────────────────────────────────────

resource "aws_ses_domain_mail_from" "asis_chat" {
  domain           = aws_ses_domain_identity.asis_chat.domain
  mail_from_domain = "mail.asis.chat"
}

resource "aws_route53_record" "mail_from_mx" {
  zone_id = aws_route53_zone.asis_chat.zone_id
  name    = "mail.asis.chat"
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  zone_id = aws_route53_zone.asis_chat.zone_id
  name    = "mail.asis.chat"
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# ─────────────────────────────────────────────────
# SPF + DMARC for root domain
# ─────────────────────────────────────────────────

resource "aws_route53_record" "root_spf" {
  zone_id = aws_route53_zone.asis_chat.zone_id
  name    = "asis.chat"
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.asis_chat.zone_id
  name    = "_dmarc.asis.chat"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=quarantine; rua=mailto:contact@asis.chat"]
}

# ─────────────────────────────────────────────────
# IAM Role + Instance Profile for EC2 → SES
# ─────────────────────────────────────────────────

resource "aws_iam_role" "ec2_ses" {
  name = "${var.app_name}-ec2-ses-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = {
    Name = "${var.app_name}-ec2-ses-role"
  }
}

resource "aws_iam_role_policy" "ses_send" {
  name = "${var.app_name}-ses-send"
  role = aws_iam_role.ec2_ses.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ses:SendEmail", "ses:SendRawEmail"]
      Resource = "*"
      Condition = {
        StringEquals = {
          "ses:FromAddress" = ["no-reply@asis.chat", "contact@asis.chat"]
        }
      }
    }]
  })
}

resource "aws_iam_instance_profile" "ec2_ses" {
  name = "${var.app_name}-ec2-ses-profile"
  role = aws_iam_role.ec2_ses.name
}
