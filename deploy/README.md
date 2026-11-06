# Deploy TeamCherry lên VPS

VPS chạy chung với các web khác, nên TeamCherry dùng Postgres và MinIO riêng, không mở cổng ra ngoài. Chỉ web app nghe ở `127.0.0.1:8110`, Nginx có sẵn đứng trước.

**Tuyệt đối không chạy `prisma/seed.ts` trên bản thật**: script đó xóa sạch dữ liệu.

## Lần đầu

Cần trước: tên miền đã trỏ về VPS (`nslookup teamcherry.io.vn` ra `103.77.209.28`), Docker Desktop đang chạy.

1. Thêm khóa SSH để khỏi nhập mật khẩu nhiều lần (chạy trên máy tính, Git Bash):
   ```bash
   ls ~/.ssh/id_ed25519.pub || ssh-keygen -t ed25519
   cat ~/.ssh/id_ed25519.pub | ssh root@103.77.209.28 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'
   ```
2. Deploy (khoảng 10–20 phút trên ổ HDD):
   ```bash
   bash deploy/deploy.sh
   ```
3. Tạo tài khoản cô giáo trên VPS, ghi lại mật khẩu tạm vừa in ra:
   ```bash
   cd /opt/teamcherry
   docker compose run --rm -e TEACHER_EMAIL=email-cua-co@example.com -e TEACHER_NAME="cô Hà" migrate node bootstrap.mjs
   ```
4. Thêm site Nginx và bật HTTPS (không đụng các site khác). Chép file từ máy tính:
   ```bash
   scp deploy/nginx-teamcherry.conf root@103.77.209.28:/etc/nginx/sites-available/teamcherry
   ```
   Rồi chạy trên VPS:
   ```bash
   sed -i 's/\r$//' /etc/nginx/sites-available/teamcherry
   ln -s /etc/nginx/sites-available/teamcherry /etc/nginx/sites-enabled/teamcherry
   nginx -t && systemctl reload nginx
   which certbot || apt-get install -y certbot python3-certbot-nginx
   certbot --nginx -d teamcherry.io.vn -d www.teamcherry.io.vn --redirect
   ```
5. Mở https://teamcherry.io.vn, đăng nhập và đổi mật khẩu.

## Cập nhật bản mới

Commit code rồi chạy `bash deploy/deploy.sh`. Migration tự áp dụng. Dữ liệu nằm trong volume nên không mất, app gián đoạn khoảng vài giây.

## SePay

Webhook: `https://teamcherry.io.vn/api/public/sepay`, xác thực kiểu API Key. Xem khóa trên VPS:
```bash
grep SEPAY_API_KEY /opt/teamcherry/.env
```

## Sao lưu

- Database: tự sao lưu 02:30 mỗi ngày vào `/opt/teamcherry/backups`, giữ 14 bản. Nhật ký ở `backups/backup.log`.
- **Các bản này vẫn nằm trên VPS, hỏng VPS là mất.** Định kỳ chạy trên máy tính để tải database và ảnh bài làm về:
  ```bash
  bash deploy/pull-backup.sh
  ```

Khôi phục database (ghi đè dữ liệu hiện tại):
```bash
cd /opt/teamcherry
docker compose stop app
gunzip -c backups/db-NGAY.sql.gz | docker compose exec -T postgres psql -U teamcherry -d teamcherry
docker compose start app
```

Khôi phục ảnh bài làm (`files-NGAY.tar` chép từ máy tính lên `/opt/teamcherry`):
```bash
cd /opt/teamcherry
docker compose stop app minio
docker run --rm -v teamcherry_minio_data:/data -v "$PWD":/in alpine tar -C /data -xf /in/files-NGAY.tar
docker compose start minio app
```

## Xem tình trạng

```bash
cd /opt/teamcherry
docker compose ps -a
docker compose logs --tail=100 app
```
`migrate` ở trạng thái `Exited (0)` là bình thường.
