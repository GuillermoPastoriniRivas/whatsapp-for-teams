output "public_ip" {
  description = "Elastic IP of the EC2 instance (use this for DNS A record)"
  value       = aws_eip.hivvo.public_ip
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.hivvo.id
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_eip.hivvo.public_ip}"
}

# ─── Email / Route 53 ───

output "route53_nameservers" {
  description = "Set these 4 nameservers in GoDaddy to delegate DNS to Route 53"
  value       = aws_route53_zone.asis_chat.name_servers
}

output "ses_domain_identity_arn" {
  description = "SES domain identity ARN (use in IAM policies if needed)"
  value       = aws_ses_domain_identity.asis_chat.arn
}
