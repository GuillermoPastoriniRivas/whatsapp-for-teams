variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "Name of the SSH key pair (must already exist in AWS)"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH (your IP). Use x.x.x.x/32"
  type        = string
  default     = "0.0.0.0/0"
}

variable "app_name" {
  description = "Application name used for tagging"
  type        = string
  default     = "hivvo"
}

variable "media_bucket_name" {
  description = "S3 bucket for the media library (globally unique)"
  type        = string
  default     = "asis-chat-media"
}

variable "media_cors_origins" {
  description = "Origins allowed to upload straight to S3 via presigned PUT"
  type        = list(string)
  default     = ["https://asis.chat", "https://www.asis.chat", "http://localhost:3001"]
}

# ── Recepción de correo (email-inbound.tf) ──────

variable "inbound_mail_bucket_name" {
  description = "Bucket S3 donde SES deja el correo entrante antes de reenviarlo"
  type        = string
  default     = "asis-chat-inbound-mail"
}

variable "inbound_mail_recipients" {
  description = "Casillas @asis.chat que reciben correo. Agregar acá para sumar una nueva."
  type        = list(string)
  default     = ["guillermo@asis.chat", "contact@asis.chat"]
}

variable "inbound_mail_forward_to" {
  description = "Buzones reales a los que se reenvía el correo recibido"
  type        = list(string)
  default     = ["guillepastorini5@gmail.com"]
}

variable "inbound_mail_forward_from" {
  description = "Remitente del reenvío. Tiene que ser del dominio verificado en SES."
  type        = string
  default     = "no-reply@asis.chat"
}
