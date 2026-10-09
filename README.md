# TeamCherry 🍒

Web app cho cô giáo dạy thêm: điểm danh siêu nhanh lúc đứng lớp, tự đếm buổi và tạo phiếu học phí
theo chu kỳ, phiếu thu đẹp kèm VietQR cho phụ huynh, thống kê thu chi; giao đề, học sinh chụp bài nộp,
cô chấm ngay trên điện thoại; cổng riêng cho học sinh khối 9 và phụ huynh.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Motion
PostgreSQL 15 + Prisma 7 · MinIO · Auth.js v5 · Recharts · exceljs · Vitest

Khung dự án theo QLNS (Tâm Nest) — xem [CLAUDE.md](CLAUDE.md).

## Chạy dự án

Yêu cầu: Node.js 20+, Docker Desktop.

```bash
cp .env.example .env    # sửa AUTH_SECRET
npm install             # tự chạy prisma generate
npm run db:up           # bật Postgres (5435) + MinIO (9200/9201)
npm run db:migrate      # tạo bảng — chạy lại mỗi lần pull code mới
npm run db:seed         # dữ liệu mẫu: 3 lớp, 150 học sinh, 2 tháng điểm danh & thu chi, bài tập & bài nộp
npm run dev             # http://localhost:3005
```

Đăng nhập thử (mật khẩu đều là `Cherry@2026`):

| Vai trò | Tên đăng nhập |
|---|---|
| Cô giáo | `co.ha@teamcherry.vn` |
| Học sinh khối 9 (Trần Minh Bình) | mã HS in ra cuối lệnh `db:seed` (vd `hs0068`) |
| Phụ huynh của Bình + Châu | SĐT in ra cuối lệnh `db:seed` |

## Lệnh thường dùng

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server cổng 3005 |
| `npm test` | Unit test (logic học phí, VietQR, nhập Excel, tin nhắn) |
| `npm run typecheck` · `npm run lint` | Kiểm tra TypeScript / ESLint |
| `npm run build` | Build production |
| `npm run db:reset` | Xóa sạch DB rồi seed lại |
| `npm run db:studio` | Prisma Studio |

## Tài liệu

| File | Nội dung |
|---|---|
| [docs/requirements.md](docs/requirements.md) | Brief gốc |
| [docs/thiet-ke.md](docs/thiet-ke.md) | Design system, sơ đồ CSDL, luồng tiền, ví dụ tính tiền, quyết định đã chốt |
| [CLAUDE.md](CLAUDE.md) | Convention code, quy tắc tiền, cấu trúc thư mục |

## Nhánh

| Nhánh | Vai trò |
|---|---|
| `main` | Để trống — chỉ merge khi một giai đoạn hoàn chỉnh |
| `master` | Nhánh làm việc chính |
