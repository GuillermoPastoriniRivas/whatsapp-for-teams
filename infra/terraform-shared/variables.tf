variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "instance_type" {
  type    = string
  default = "t4g.small"
}

variable "root_volume_size" {
  type    = number
  default = 40
}

variable "key_name" {
  type = string
}

variable "allowed_ssh_cidr" {
  type    = string
  default = "0.0.0.0/0"
}

variable "app_name" {
  type    = string
  default = "shared-apps"
}

variable "managed_domains" {
  description = "Domains whose A records should point to this host."
  type        = set(string)
  default     = []
}

variable "s3_buckets" {
  description = "Buckets used by asis and fluws."
  type        = list(string)
  default = [
    "asis-chat-media",
    "asis-chat-inbound-mail",
    "fluws-vaults-213407352322",
    "fluws-backups-213407352322",
  ]
}
