#!/usr/bin/env bash
# Chạy trên VPS (cron mỗi ngày): sao lưu database, giữ 14 bản gần nhất.
# File ảnh bài làm không sao chép ra đĩa VPS để khỏi tốn gấp đôi ổ — tải về máy khác bằng pull-backup.sh.
set -euo pipefail

DIR=/opt/teamcherry
OUT="$DIR/backups/db-$(date +%F-%H%M).sql.gz"
TMP="$OUT.tmp"

cd "$DIR"
trap 'rm -f "$TMP"' EXIT
docker compose exec -T postgres pg_dump -U teamcherry -d teamcherry --clean --if-exists | gzip > "$TMP"
# Chỉ giữ file đã kiểm tra đọc được và có nội dung.
gzip -t "$TMP"
[ "$(gzip -dc "$TMP" | wc -l)" -gt 100 ]
mv "$TMP" "$OUT"

ls -1t "$DIR"/backups/db-*.sql.gz | tail -n +15 | xargs -r rm -f
echo "$(date '+%F %T') OK $(du -h "$OUT" | cut -f1) $OUT"
