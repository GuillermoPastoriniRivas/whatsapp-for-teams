output "public_ip" {
  value = aws_eip.shared.public_ip
}

output "instance_id" {
  value = aws_instance.shared.id
}

output "ssh_command" {
  value = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_eip.shared.public_ip}"
}
