#!/usr/bin/env bash
# Chạy trên VPS. Tạo .env với khóa ngẫu nhiên (đã có thì giữ nguyên) và lịch sao lưu. Chạy lại an toàn.
set -euo pipefail

DIR=/opt/teamcherry
ENV_FILE="$DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  umask 077
  cat > "$ENV_FILE" <<EOF
APP_URL=https://teamcherry.io.vn
APP_PORT=8110
POSTGRES_PASSWORD=$(openssl rand -hex 24)
MINIO_SECRET_KEY=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -base64 32)
SEPAY_API_KEY=$(openssl rand -hex 24)
EOF
  echo "Đã tạo $ENV_FILE"
else
  echo "Giữ nguyên $ENV_FILE"
fi

chmod +x "$DIR/backup.sh"
mkdir -p "$DIR/backups"

# 02:30 giờ VN (VPS chạy giờ UTC).
cat > /etc/cron.d/teamcherry-backup <<EOF
CRON_TZ=Asia/Ho_Chi_Minh
30 2 * * * root $DIR/backup.sh >> $DIR/backups/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/teamcherry-backup
echo "Đã đặt lịch sao lưu 02:30 mỗi ngày"
