#!/usr/bin/env bash
# Chạy trên máy tính (Git Bash): tải bản sao lưu ra khỏi VPS — hỏng VPS vẫn còn dữ liệu.
#   bash deploy/pull-backup.sh [thư mục đích, mặc định ~/TeamCherry-backup]
set -euo pipefail

VPS="${VPS:-root@103.77.209.28}"
DEST="${1:-$HOME/TeamCherry-backup}"
mkdir -p "$DEST"

LATEST=$(ssh "$VPS" 'ls -1t /opt/teamcherry/backups/db-*.sql.gz | head -1')
scp "$VPS:$LATEST" "$DEST/"
gzip -t "$DEST/$(basename "$LATEST")"

FILES="$DEST/files-$(date +%F).tar"
ssh "$VPS" 'docker run --rm -v teamcherry_minio_data:/data:ro alpine tar -C /data -cf - .' > "$FILES.tmp"
tar -tf "$FILES.tmp" > /dev/null
mv "$FILES.tmp" "$FILES"

echo "Đã tải về $DEST:"
ls -lh "$DEST/$(basename "$LATEST")" "$FILES"
