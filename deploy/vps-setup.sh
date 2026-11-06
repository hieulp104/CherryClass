#!/usr/bin/env bash
# Chạy trên VPS, một lần sau khi clone: bash deploy/vps-setup.sh
# Tạo .env với khóa ngẫu nhiên (đã có thì giữ nguyên), swap dự phòng và lịch sao lưu. Chạy lại an toàn.
set -euo pipefail

DIR=/opt/teamcherry
ENV_FILE="$DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  (
    umask 077
    cat > "$ENV_FILE" <<EOF
APP_URL=https://teamcherry.io.vn
APP_PORT=8110
POSTGRES_PASSWORD=$(openssl rand -hex 24)
MINIO_SECRET_KEY=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -base64 32)
SEPAY_API_KEY=$(openssl rand -hex 24)
EOF
  )
  echo "Đã tạo $ENV_FILE"
else
  echo "Giữ nguyên $ENV_FILE"
fi

# Repo còn docker-compose.yml của máy dev, cùng tên project "teamcherry". Gõ thiếu -f mà trúng file đó
# thì Postgres dev sẽ gắn vào volume dữ liệu thật — nên ép lệnh docker compose trần dùng file prod.
grep -q '^COMPOSE_FILE=' "$ENV_FILE" || echo 'COMPOSE_FILE=docker-compose.prod.yml' >> "$ENV_FILE"

# next build cần 2,5–3 GB RAM (đã đo). VPS 4 GB dùng chung không đủ RAM trống: thiếu swap thì
# hệ thống sẽ giết tiến trình, có thể trúng web khác. Đảm bảo có ít nhất 2 GB swap.
SWAP_FILE=/swapfile.teamcherry
SWAP_MB=$(free -m | awk '/^Swap:/ {print $2}')
if [ "$SWAP_MB" -lt 2000 ]; then
  fallocate -l 2G "$SWAP_FILE"
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE" >/dev/null
  swapon "$SWAP_FILE"
  grep -q "^$SWAP_FILE " /etc/fstab || echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
  echo "Đã thêm 2 GB swap (trước đó có ${SWAP_MB} MB)"
else
  echo "Đã có ${SWAP_MB} MB swap, giữ nguyên"
fi

chmod +x "$DIR/deploy/backup.sh"
mkdir -p "$DIR/backups"

# 19:30 UTC = 02:30 giờ VN. VPS chạy giờ UTC.
cat > /etc/cron.d/teamcherry-backup <<EOF
30 19 * * * root $DIR/deploy/backup.sh >> $DIR/backups/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/teamcherry-backup
echo "Đã đặt lịch sao lưu 02:30 giờ VN mỗi ngày"
