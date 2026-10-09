@AGENTS.md

# CLAUDE.md — TeamCherry

Hướng dẫn cho AI và dev. **Đọc file này + `docs/thiet-ke.md` đầu mỗi phiên.**

## 1. Dự án là gì

App quản lý lớp dạy thêm cho MỘT cô giáo (khối 8, 9 — ~150 học sinh): điểm danh, học phí theo chu kỳ
buổi, phiếu thu VietQR cho phụ huynh, thu chi; bài tập — giao đề, nộp bài bằng ảnh, chấm bài.
Ba vai trò: cô giáo (quản trị) · học sinh khối 9 · phụ huynh (khối 8, một tài khoản xem nhiều con).
Khung code theo dự án QLNS (`E:\QLNS`).

Ba nguyên tắc: **không bao giờ tính sai tiền** · tinh tế với con người · đẹp và vui.

## 2. Tech stack

| Hạng mục | Dùng | Ghi chú |
|---|---|---|
| Framework | Next.js 16.2 (App Router) | `proxy.ts` thay `middleware.ts`. Đọc `node_modules/next/dist/docs/` khi đụng file convention |
| DB | PostgreSQL 15 (Docker, cổng **5435**) + Prisma 7 | Prisma 7 **không tự generate** sau `migrate dev` — chạy `npx prisma generate` |
| Auth | Auth.js v5 Credentials, JWT 30 ngày | Đăng nhập bằng `username`: email (cô) / SĐT / mã HS |
| File | MinIO (Docker, cổng **9200** API / **9201** console) | Đọc/ghi luôn qua `/api/tep` để kiểm quyền — không cấp presigned URL cho trình duyệt |
| UI | Tailwind 4 + kit tự viết (`components/ui`) + Motion | Không dùng shadcn |
| Test | Vitest | `npm test` |
| Dev server | cổng **3005** | 3000/3100/5433/5434 đã bị dự án khác chiếm |

## 3. Cấu trúc

```
src/
├── app/
│   ├── (auth)/login
│   ├── (main)/          # có AppShell: hom-nay, lop-hoc, diem-danh, thu-tien, thong-ke, hoc-sinh, cai-dat
│   ├── (focus)/         # toàn màn hình: diem-danh/[id] (đứng lớp), bai-tap/[id]/cham (chấm bài)
│   ├── (portal)/        # cua-em/* (học sinh khối 9) · phu-huynh/* (phụ huynh, ?con=<id>)
│   ├── (auth)/doi-mat-khau  # bắt đổi mật khẩu lần đầu với tài khoản cô cấp
│   ├── p/[token]/       # phiếu thu công khai cho phụ huynh — KHÔNG cần đăng nhập
│   └── api/             # xuất Excel, file mẫu, auth, tep (tải lên / đọc file có kiểm quyền)
├── modules/<tên>/       # <tên>.actions.ts · .service.ts · .schema.ts · components/
│   ├── billing/billing.core.ts   ★ MỌI phép tính tiền — hàm thuần, có unit test
│   ├── assignments/assignments.core.ts  ★ trạng thái bài, điểm, vườn cherry, so với chính mình
│   ├── accounts/        # cô cấp tài khoản học sinh / phụ huynh (mật khẩu tạm "cherryNNNN")
│   └── portal/          # portal.guard.ts = requirePortal(): vai trò + PHẠM VI em đang xem
├── components/{ui,layout,brand}   # brand/mascot.tsx = Bé Cherry
├── common/              # permissions (can), guards, filters (ok/fail)
├── shared/              # prisma, audit
└── lib/                 # utils, dates (ngày VN), vietqr, haptics
```

## 4. Quy tắc tiền — quan trọng nhất

- **Mọi con số tiền đi qua `billing.core.ts`.** Service chỉ đọc DB → gọi hàm thuần → ghi. Thêm quy tắc tiền
  mới = thêm hàm + test vào `billing.core.test.ts` TRƯỚC.
- Tiền là `Int` (đồng). Không Float. Làm tròn luôn theo hướng có lợi cho phụ huynh.
- `Attendance.billable` + `unitPrice` **chốt lúc "Xong buổi"** — đổi cài đặt/đơn giá không làm đổi buổi cũ.
- `InvoiceLine.attendanceId` UNIQUE → một buổi không bao giờ bị tính hai lần.
- Trạng thái thanh toán **không lưu**: tính từ sổ cái (`allocatePayments` FIFO). "Cần đóng" trên phiếu tính sống.
- `Invoice.discountSnapshot` chụp mức giảm lúc phát hành — sửa tay phiếu cũ không lấy mức giảm mới.
- Buổi nằm trong phiếu **đã gửi** thì khóa sửa điểm danh; phải sửa qua phiếu (lý do bắt buộc).
  Phiếu **chưa gửi** (READY, chưa sửa tay/chưa có tiền) được tạo lại tự động khi sửa điểm danh.
- Mọi thao tác chạm tiền ghi `AuditLog` trong cùng transaction.

## 4b. Quy tắc học sinh / phụ huynh

- Mọi dữ liệu phía cổng đi qua `requirePortal()` + `canViewStudent()`: học sinh chỉ thấy mình, phụ huynh chỉ thấy con.
  Truy vấn bài theo `(assignmentId, studentId đang xem)` — id bài của em khác trả 404, không lộ là có tồn tại.
- File đọc qua `/api/tep/[id]` + `canReadFile()`; nộp bài chỉ gắn được file do CHÍNH người nộp tải lên.
- Không xếp hạng, không so với bạn. Điểm < 5 luôn kèm lời động viên (`lowScoreCheer`) và ô "cần ôn".
- Học sinh đăng nhập bằng SĐT của em (hoặc mã HS); phụ huynh bằng SĐT phụ huynh — anh chị em dùng chung một tài khoản.
  `normalizeLogin()` dùng chung cho form đăng nhập và lúc cấp tài khoản.
- Ảnh bài làm xử lý ở trình duyệt (`lib/image-prep.ts`): xoay theo EXIF, thu nhỏ 1800px, làm nét (`documentLut`, có test).
- Hiệu ứng chuyển trang ở cổng nằm TRONG `PortalFrame` (motion.main) — transform ở tổ tiên làm hỏng thanh điều hướng `fixed`.

## 5. Convention (theo QLNS)

- Server action: session → `can()` → Zod → transaction + AuditLog. Lỗi trả `fail()`; câu lỗi tiếng Việt, không đổ lỗi người dùng.
- File `"use server"` chỉ export action có kiểm tra quyền — hàm tiện ích để ở `.service.ts`.
- Ngày thuần là chuỗi `YYYY-MM-DD` giờ VN (`lib/dates.ts`). Không dùng `toISOString().slice(0,10)` cho "hôm nay".
- Màu chỉ dùng token (`bg-primary`, `text-leaf`…) — định nghĩa ở `globals.css`, có bản sáng/tối. Không hard-code hex trong component (trừ màu lớp/danh mục lưu DB).
- Trạng thái luôn có icon + chữ, không chỉ màu (`InvoiceStateChip`).
- Ô tiền dùng `MoneyInput`. Sheet/dialog dùng `Sheet` (bottom sheet trên điện thoại).
- Reset state khi mở sheet: remount bằng `key`, không setState trong useEffect (lint `react-hooks/set-state-in-effect`).
- Trang phiếu công khai chỉ dùng DTO `getPublicInvoice` — không lộ ghi chú riêng, cờ khó khăn, SĐT, lý do sửa tay.
- Chuyển động: Motion; luôn tôn trọng `useReducedMotion`.

## 6. Quyết định đã chốt (10/2026)

| Quyết định | Lý do |
|---|---|
| Postgres + Prisma tự host thay Supabase | Theo khung QLNS |
| Vắng có phép / không phép: **mặc định tính tiền**, bật tắt trong Cài đặt | Chị chọn |
| Lớp, ca, lịch, mức giảm anh chị em: cô tự cài trong app | Chị chọn |
| Làm tròn **xuống** tới nghìn ở bước cuối | Chị chọn |
| Không tích hợp Zalo — chỉ sao chép tin nhắn | Chị chọn; app không bao giờ tự gửi |
| Quyền là bảng tĩnh theo vai trò (không bảng role_permissions) | Chỉ một cô giáo |
| Phụ huynh được nộp bài hộ con | Khối 8 không có điện thoại |
| Vườn cherry TÍNH từ dữ liệu (bài đúng hạn + tuần đi đủ), không lưu điểm thưởng | Không lệch khi sửa điểm danh / gia hạn |
| Gia hạn bài: "muộn" luôn so với hạn hiện tại | Đơn giản, đúng cảm nhận của học sinh |

## 7. Roadmap

- ✅ **GĐ1**: đăng nhập, nhập Excel, lớp/ca/lịch, chế độ đứng lớp + offline, bộ đếm chu kỳ, phiếu thu + VietQR,
  tin nhắn 3 giọng, thu chi + biểu đồ + xuất Excel, trang Hôm nay, design system + Bé Cherry, PWA.
- ✅ **GĐ2**: tài khoản học sinh khối 9 / phụ huynh (cấp từng em hoặc cả lớp, bắt đổi mật khẩu lần đầu),
  giao đề (ảnh/PDF, lớp/ca/từng em, hạn nộp), nộp bài nhiều trang (tự xoay + làm nét), chấm bài (khoanh lên ảnh,
  nhận xét mẫu, ghi âm), vườn cherry + huy hiệu, so với chính mình, đếm ngược thi vào 10, cổng phụ huynh.
- ⬜ **GĐ3**: báo cáo cho phụ huynh, tổng kết năm học "Wrapped", webhook SePay/Casso (bảng `BankTransaction` đã có).
- ⬜ Triển khai: cần tên miền HTTPS (PWA + link phiếu). Sao lưu tự động định kỳ (hiện có nút "Tải file sao lưu").

## 8. Quy trình Git

`master` là nhánh làm việc; `main` để trống, chỉ merge khi xong một giai đoạn.
Commit: `feat:` `fix:` `refactor:` `docs:` `chore:`.
