#!/usr/bin/env bash
# Chạy trên máy tính (Git Bash), từ thư mục gốc dự án: bash deploy/deploy.sh
# Build ngay trên máy tính rồi chuyển image lên VPS — VPS đang chạy web khác, không đủ RAM dư để build.
set -euo pipefail

VPS="${VPS:-root@103.77.209.28}"
DIR=/opt/teamcherry

if [ -n "$(git status --porcelain)" ]; then
  echo "Còn thay đổi chưa commit — commit trước để biết chắc bản nào đang chạy." >&2
  exit 1
fi

echo "==> Build image ($(git rev-parse --short HEAD))"
docker build -f deploy/Dockerfile --target app -t teamcherry-app:latest .
docker build -f deploy/Dockerfile --target migrate -t teamcherry-migrate:latest .

echo "==> Chép cấu hình lên VPS"
ssh "$VPS" "mkdir -p $DIR"
for f in docker-compose.prod.yml:docker-compose.yml backup.sh:backup.sh vps-setup.sh:vps-setup.sh; do
  # Bỏ CRLF của Windows, nếu không bash trên VPS sẽ lỗi.
  tr -d '\r' < "deploy/${f%%:*}" | ssh "$VPS" "cat > $DIR/${f##*:}"
done
ssh "$VPS" "bash $DIR/vps-setup.sh"

echo "==> Chuyển image lên VPS (vài phút)"
docker save teamcherry-app:latest teamcherry-migrate:latest | gzip | ssh "$VPS" 'gunzip | docker load'

# MinIO không còn trên Docker Hub: lấy từ máy này, gửi một lần. Mất bản này thì phải tìm bản thay thế.
MINIO=teamcherry-minio:2025-09-07
if ! ssh "$VPS" "docker image inspect $MINIO >/dev/null 2>&1"; then
  docker image inspect "$MINIO" >/dev/null 2>&1 || docker tag minio/minio:latest "$MINIO"
  docker save "$MINIO" | gzip | ssh "$VPS" 'gunzip | docker load'
fi

echo "==> Khởi động"
ssh "$VPS" "cd $DIR && docker compose up -d --remove-orphans && docker image prune -f --filter label=app=teamcherry && docker compose ps -a"
