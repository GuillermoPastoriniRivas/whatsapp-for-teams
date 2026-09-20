#!/usr/bin/env bash
set -euo pipefail

BUCKET="${MONGO_BACKUP_BUCKET:-fluws-backups-213407352322}"
PREFIX="${MONGO_BACKUP_PREFIX:-mongo}"
LOCAL_DIR="${MONGO_BACKUP_DIR:-/var/backups/mongo}"
KEEP_LOCAL="${MONGO_BACKUP_KEEP_LOCAL:-3}"

source /opt/mongo/.env

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="mongo-${STAMP}.archive.gz"

mkdir -p "$LOCAL_DIR"

docker exec shared-mongo mongodump \
  --username "$MONGO_ROOT_USERNAME" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --archive --gzip > "${LOCAL_DIR}/${FILE}"

SIZE=$(stat -c %s "${LOCAL_DIR}/${FILE}")
if [ "$SIZE" -lt 1024 ]; then
  echo "backup sospechosamente chico (${SIZE} bytes), no se sube" >&2
  exit 1
fi

aws s3 cp "${LOCAL_DIR}/${FILE}" "s3://${BUCKET}/${PREFIX}/${FILE}" --only-show-errors

ls -1t "${LOCAL_DIR}"/mongo-*.archive.gz | tail -n +$((KEEP_LOCAL + 1)) | xargs -r rm --

echo "ok ${FILE} ${SIZE} bytes -> s3://${BUCKET}/${PREFIX}/${FILE}"
