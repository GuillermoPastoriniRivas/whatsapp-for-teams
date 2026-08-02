# ─────────────────────────────────────────────────
# Media library — bucket privado de archivos
#
# Nada acá es público. La lectura sale por URLs prefirmadas de corta vida y el
# envío a WhatsApp nunca usa una URL: subimos los bytes y mandamos el media_id.
# ─────────────────────────────────────────────────

resource "aws_s3_bucket" "media" {
  bucket = var.media_bucket_name

  tags = {
    Name = "${var.app_name}-media"
  }

  # Contiene archivos de clientes de nuestros clientes: nunca destruir por
  # accidente en un plan.
  lifecycle {
    prevent_destroy = true
  }
}

# Sin esto, un ACL mal puesto expone documentos de terceros a internet.
resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Red de seguridad ante un borrado accidental; las versiones viejas se limpian
# solas a los 30 días para no pagar por basura.
resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  depends_on = [aws_s3_bucket_versioning.media]

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  # El storage es más barato que el egress, pero a los 90 días la mayoría de
  # los archivos ya nadie los abre.
  rule {
    id     = "tier-cold-media"
    status = "Enabled"

    filter {
      prefix = "tenants/"
    }

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# El navegador sube directo al bucket cuando se usan URLs prefirmadas de PUT.
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = var.media_cors_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# TLS obligatorio: sin esto un GET por HTTP viajaría en claro.
resource "aws_s3_bucket_policy" "media_tls_only" {
  bucket = aws_s3_bucket.media.id

  depends_on = [aws_s3_bucket_public_access_block.media]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "DenyInsecureTransport"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource = [
        aws_s3_bucket.media.arn,
        "${aws_s3_bucket.media.arn}/*",
      ]
      Condition = {
        Bool = { "aws:SecureTransport" = "false" }
      }
    }]
  })
}

# ─────────────────────────────────────────────────
# Permisos del EC2 sobre el bucket
# ─────────────────────────────────────────────────

resource "aws_iam_role_policy" "media_access" {
  name = "${var.app_name}-media-access"
  role = aws_iam_role.ec2_ses.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.media.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.media.arn
      },
    ]
  })
}

output "media_bucket_name" {
  description = "Bucket de la media library (valor de MEDIA_S3_BUCKET)"
  value       = aws_s3_bucket.media.bucket
}
