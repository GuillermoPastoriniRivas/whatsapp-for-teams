#!/bin/bash
set -euo pipefail

# Log everything for debugging
exec > /var/log/user-data.log 2>&1
echo ">>> Starting EC2 bootstrap $(date)"

# --- System updates ---
apt-get update && apt-get upgrade -y

# --- Docker ---
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Let ubuntu user run docker without sudo
usermod -aG docker ubuntu

# --- Certbot ---
apt-get install -y certbot

# --- AWS CLI v2 (official installer, Ubuntu 24.04 dropped awscli from apt) ---
apt-get install -y unzip curl
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install
rm -rf /tmp/awscliv2.zip /tmp/aws

# --- Create app directory ---
mkdir -p /home/ubuntu/hivvo
chown ubuntu:ubuntu /home/ubuntu/hivvo

echo ">>> EC2 bootstrap complete $(date)"
