# Deploy TeamCherry lên VPS

VPS chạy chung với các web khác, nên TeamCherry dùng Postgres và MinIO riêng, không mở cổng ra ngoài. Chỉ web app nghe ở `127.0.0.1:8110`, Nginx có sẵn đứng trước.

**Tuyệt đối không chạy `prisma/seed.ts` trên bản thật**: script đó xóa sạch dữ liệu.

## Cập nhật bản mới

Commit và push code lên `master`, rồi:

```bash
ssh root@103.77.209.28
cd /opt/teamcherry
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Migration tự chạy trước khi app mới lên. Dữ liệu nằm trong volume nên không mất, app gián đoạn khoảng vài giây sau khi build xong.

Build chạy ngay trên VPS nên các web khác có thể chậm trong lúc đó. Thỉnh thoảng dọn image cũ: `docker image prune -f --filter label=app=teamcherry`.

## Lần đầu

Cần trước: tên miền đã trỏ về VPS, Docker Desktop đang chạy trên máy tính.

1. Thêm khóa SSH để khỏi nhập mật khẩu nhiều lần (chạy trên máy tính, Git Bash):
   ```bash
   ls ~/.ssh/id_ed25519.pub || ssh-keygen -t ed25519
   cat ~/.ssh/id_ed25519.pub | ssh root@103.77.209.28 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'
   ```
2. Gửi image MinIO lên VPS, chỉ cần một lần vì Docker Hub không còn bản này (chạy trên máy tính):
   ```bash
   docker image inspect teamcherry-minio:2025-09-07 >/dev/null 2>&1 || docker tag minio/minio:latest teamcherry-minio:2025-09-07
   docker save teamcherry-minio:2025-09-07 | gzip | ssh root@103.77.209.28 'gunzip | docker load'
   ```
3. Lấy code và khởi động (chạy trên VPS):
   ```bash
   git clone https://github.com/hieulp104/CherryClass.git /opt/teamcherry
   cd /opt/teamcherry
   bash deploy/vps-setup.sh
   docker compose -f docker-compose.prod.yml up -d --build
   ```
4. Tạo tài khoản cô giáo trên VPS, ghi lại mật khẩu tạm vừa in ra:
   ```bash
   docker compose -f docker-compose.prod.yml run --rm -e TEACHER_EMAIL=email-cua-co@example.com -e TEACHER_NAME="cô Hà" migrate node bootstrap.mjs
   ```
5. Thêm site Nginx và bật HTTPS (không đụng các site khác), chạy trên VPS:
   ```bash
   cp /opt/teamcherry/deploy/nginx-teamcherry.conf /etc/nginx/sites-available/teamcherry
   ln -s /etc/nginx/sites-available/teamcherry /etc/nginx/sites-enabled/teamcherry
   nginx -t && systemctl reload nginx
   which certbot || apt-get install -y certbot python3-certbot-nginx
   certbot --nginx -d teamcherry.io.vn -d www.teamcherry.io.vn --redirect
   ```
6. Mở https://teamcherry.io.vn, đăng nhập và đổi mật khẩu.

## SePay

Webhook: `https://teamcherry.io.vn/api/public/sepay`, xác thực kiểu API Key. Xem khóa trên VPS:
```bash
grep SEPAY_API_KEY /opt/teamcherry/.env
```

## Sao lưu

- Database: tự sao lưu 02:30 giờ VN mỗi ngày vào `/opt/teamcherry/backups`, giữ 14 bản. Nhật ký ở `backups/backup.log`.
- **Các bản này vẫn nằm trên VPS, hỏng VPS là mất.** Định kỳ chạy trên máy tính để tải database và ảnh bài làm về:
  ```bash
  bash deploy/pull-backup.sh
  ```

Khôi phục database (ghi đè dữ liệu hiện tại):
```bash
cd /opt/teamcherry
docker compose -f docker-compose.prod.yml stop app
gunzip -c backups/db-NGAY.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U teamcherry -d teamcherry
docker compose -f docker-compose.prod.yml start app
```

Khôi phục ảnh bài làm (`files-NGAY.tar` chép từ máy tính lên `/opt/teamcherry`):
```bash
cd /opt/teamcherry
docker compose -f docker-compose.prod.yml stop app minio
docker run --rm -v teamcherry_minio_data:/data -v "$PWD":/in alpine tar -C /data -xf /in/files-NGAY.tar
docker compose -f docker-compose.prod.yml start minio app
```

## Xem tình trạng

```bash
cd /opt/teamcherry
docker compose -f docker-compose.prod.yml ps -a
docker compose -f docker-compose.prod.yml logs --tail=100 app
```
`migrate` ở trạng thái `Exited (0)` là bình thường.
