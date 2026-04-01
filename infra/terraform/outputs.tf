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
