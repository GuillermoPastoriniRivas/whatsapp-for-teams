# ─────────────────────────────────────────────────
# Recepción de correo en asis.chat
#
# El dominio solo sabía *enviar* (ver email.tf): sin MX de entrada, cualquier
# mail a @asis.chat rebotaba. Meta pide confirmar una casilla del dominio del
# negocio para verificarlo, así que acá se recibe en SES y se reenvía a un
# buzón real con un Lambda. No hay servidor de correo que mantener.
# ─────────────────────────────────────────────────

# ── Dónde aterriza el mail crudo ────────────────

resource "aws_s3_bucket" "inbound_mail" {
  bucket = var.inbound_mail_bucket_name

  tags = {
    Name = "${var.app_name}-inbound-mail"
  }
}

resource "aws_s3_bucket_public_access_block" "inbound_mail" {
  bucket                  = aws_s3_bucket.inbound_mail.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "inbound_mail" {
  bucket = aws_s3_bucket.inbound_mail.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# El mail ya vive en el buzón destino: acá es solo un buffer para el Lambda.
# Guardarlo para siempre es acumular correspondencia sin que nadie la lea.
resource "aws_s3_bucket_lifecycle_configuration" "inbound_mail" {
  bucket = aws_s3_bucket.inbound_mail.id

  rule {
    id     = "expire-forwarded-mail"
    status = "Enabled"

    filter {
      prefix = local.inbound_mail_prefix
    }

    expiration {
      days = 30
    }
  }
}

# SES escribe como servicio, no como nuestro usuario: sin esta policy la regla
# falla y el remitente recibe un rebote.
resource "aws_s3_bucket_policy" "inbound_mail" {
  bucket = aws_s3_bucket.inbound_mail.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowSESPuts"
      Effect    = "Allow"
      Principal = { Service = "ses.amazonaws.com" }
      Action    = "s3:PutObject"
      Resource  = "${aws_s3_bucket.inbound_mail.arn}/*"
      Condition = {
        StringEquals = {
          "aws:Referer" = data.aws_caller_identity.current.account_id
        }
      }
    }]
  })
}

data "aws_caller_identity" "current" {}

# ── MX: sin esto no llega nada ──────────────────

resource "aws_route53_record" "inbound_mx" {
  zone_id = aws_route53_zone.asis_chat.zone_id
  name    = "asis.chat"
  type    = "MX"
  ttl     = 300
  records = ["10 inbound-smtp.${var.aws_region}.amazonaws.com"]
}

# ── Entrega al buzón real ───────────────────────
#
# Lo natural sería un Lambda que reescriba el `From` y reenvíe el mail. No se
# puede: esta cuenta de AWS tiene bloqueada la creación de funciones
# (CreateFunction devuelve AccessDenied incluso con AdministratorAccess).
#
# El primer intento fue SNS, que entrega sin código propio, pero sus mails
# nunca llegaron al buzón destino (ni el de confirmación) y además envuelve el
# correo en la notificación y lo trunca arriba de ~150 KB. Ahora reenvía el
# API, que ya usa SES y tiene un scheduler: lee el bucket cada minuto y manda
# el mail reescrito. Ver `api/src/infrastructure/email/inbound-mail-forwarder.service.ts`.

resource "aws_iam_role_policy" "ec2_inbound_mail" {
  name = "${var.app_name}-inbound-mail-read"
  role = aws_iam_role.ec2_ses.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.inbound_mail.arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["${local.inbound_mail_prefix}*"]
          }
        }
      },
      {
        Effect = "Allow"
        # El borrado es parte del reenvío: sin él, cada corrida vuelve a mandar
        # los mismos mails.
        Action   = ["s3:GetObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.inbound_mail.arn}/${local.inbound_mail_prefix}*"
      },
    ]
  })
}

# El API lee su configuración de SSM al arrancar (infra/scripts/hydrate-env.sh).

resource "aws_ssm_parameter" "inbound_mail_bucket" {
  name  = "/asis/api/INBOUND_MAIL_BUCKET"
  type  = "String"
  value = aws_s3_bucket.inbound_mail.id
}

resource "aws_ssm_parameter" "inbound_mail_forward_to" {
  name  = "/asis/api/INBOUND_MAIL_FORWARD_TO"
  type  = "String"
  value = join(",", var.inbound_mail_forward_to)
}

# ── Reglas de recepción ─────────────────────────

resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "${var.app_name}-inbound"
}

# Solo un rule set puede estar activo por cuenta y región. Sin esto las reglas
# existen pero no se aplican y el mail rebota igual.
resource "aws_ses_active_receipt_rule_set" "main" {
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
}

resource "aws_ses_receipt_rule" "forward" {
  name          = "forward-to-inbox"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients    = var.inbound_mail_recipients
  enabled       = true
  scan_enabled  = true
  tls_policy    = "Require"

  # Única acción: el mail crudo, entero, con sus adjuntos. De acá lo levanta el
  # API para reenviarlo y lo borra; lo que quede lo limpia el lifecycle.
  s3_action {
    position          = 1
    bucket_name       = aws_s3_bucket.inbound_mail.id
    object_key_prefix = local.inbound_mail_prefix
  }

  depends_on = [aws_s3_bucket_policy.inbound_mail]
}

locals {
  inbound_mail_prefix = "inbound/"
}
