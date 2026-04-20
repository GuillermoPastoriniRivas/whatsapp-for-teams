#!/bin/bash
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
SSM_PATH="${1:-/asis/api}"
OUT="${2:-./api/.env}"

mkdir -p "$(dirname "$OUT")"

aws ssm get-parameters-by-path \
  --region "$REGION" \
  --path "$SSM_PATH" \
  --recursive \
  --with-decryption \
  --query 'Parameters[*].[Name,Value]' \
  --output text \
| while IFS=$'\t' read -r name value; do
    key="${name##*/}"
    printf '%s=%s\n' "$key" "$value"
  done > "$OUT"

chmod 600 "$OUT"
echo "Escrito $OUT con $(wc -l < "$OUT") variables"
