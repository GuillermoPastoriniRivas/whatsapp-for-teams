# ─────────────────────────────────────────────────
# CloudWatch Log Groups (7-day retention)
# ─────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "api" {
  name              = "/asis/api"
  retention_in_days = 7

  tags = {
    Name = "${var.app_name}-api-logs"
  }
}

resource "aws_cloudwatch_log_group" "ui" {
  name              = "/asis/ui"
  retention_in_days = 7

  tags = {
    Name = "${var.app_name}-ui-logs"
  }
}

resource "aws_cloudwatch_log_group" "nginx" {
  name              = "/asis/nginx"
  retention_in_days = 7

  tags = {
    Name = "${var.app_name}-nginx-logs"
  }
}

# ─────────────────────────────────────────────────
# IAM policy so EC2 (docker awslogs driver) can write
# ─────────────────────────────────────────────────

resource "aws_iam_role_policy" "cloudwatch_logs" {
  name = "${var.app_name}-cloudwatch-logs"
  role = aws_iam_role.ec2_ses.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams",
      ]
      Resource = [
        "${aws_cloudwatch_log_group.api.arn}:*",
        "${aws_cloudwatch_log_group.ui.arn}:*",
        "${aws_cloudwatch_log_group.nginx.arn}:*",
      ]
    }]
  })
}
