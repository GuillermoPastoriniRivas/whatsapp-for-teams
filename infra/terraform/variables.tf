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
