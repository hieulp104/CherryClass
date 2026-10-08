# TeamCherry — Thiết kế trước khi code

> Trạng thái: **ĐÃ DUYỆT — Giai đoạn 1 đã làm xong.** Các câu hỏi mục 4 đã được trả lời (xem bảng "Đã chốt" ở cuối mục 4).
> Một số mặc định trong ví dụ mục 3 (vắng có phép không tính) khác mặc định cuối cùng (tính) — ví dụ vẫn đúng với cài đặt ghi trong ví dụ.
> Yêu cầu gốc: [requirements.md](requirements.md).

---

## 0. Nền tảng kỹ thuật — theo khung dự án QLNS (Tâm Nest)

Dự án dùng lại khung đã chạy ổn ở `E:\QLNS`, chỉ đổi phần giao diện cho mobile-first và sống động hơn.

| Hạng mục | Dùng | Khác brief / QLNS |
|---|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript | Giống QLNS. Next 16 dùng `proxy.ts` thay `middleware.ts` |
| CSDL | PostgreSQL 15 (Docker) + **Prisma 7** (driver adapter `pg`) | Brief ghi Supabase → **đổi theo QLNS** (xem mục 4, câu 1) |
| Đăng nhập | Auth.js v5, Credentials, JWT | Brief ghi Supabase Auth |
| File | MinIO, **chỉ bật từ Giai đoạn 2** (ảnh đề, bài nộp) | GĐ1 đọc Excel trong bộ nhớ, không cần lưu file |
| Giao diện | Tailwind 4 + bộ UI kit tự viết theo cấu trúc QLNS + **Motion** (Framer Motion) | Không dùng shadcn — QLNS đã có kit riêng, giữ một phong cách |
| Biểu đồ | Recharts | Giống QLNS |
| Excel | exceljs | Giống QLNS |
| Test | **Vitest** cho toàn bộ logic học phí | QLNS chưa có test tự động — TeamCherry bắt buộc có |
| PWA | Web manifest + service worker tự viết + hàng đợi IndexedDB | Mới |
| VietQR | Tự sinh chuỗi EMVCo + thư viện `qrcode`, không gọi API ngoài | Mới |

**Cấu trúc thư mục** giống QLNS: `app/` chỉ routing, nghiệp vụ trong `modules/<tên>/`
gồm `*.actions.ts` (server action: session → quyền → Zod → ghi + AuditLog), `*.service.ts`,
`*.schema.ts`, `components/`. Quyền đi qua `can()`, lỗi qua `ok()/fail()`.

Module dự kiến: `auth`, `classes` (lớp/ca/buổi), `students`, `attendance`, `billing` (lõi tính tiền),
`payments`, `messages` (mẫu tin nhắn), `finance` (chi + thống kê), `today` (trang Hôm nay),
`imports` (nhập Excel), `public-invoice` (trang phiếu cho phụ huynh).

**Cổng** (tránh đụng dự án khác đang chạy trên máy): Postgres `5435`, app dev `3005`.
(Đã bị chiếm: 5433 QLNS, 5434 recall-vault, 3100.)

**Nhánh**: `main` sạch, `master` tích hợp — giống quy ước QLNS.

---

## 1. Design system

### 1.1 Màu

Bảng `cherry` trùng đúng thang `rose` của Tailwind (#E11D48 = 600, #9F1239 = 800, #FFE4E6 = 100),
nên dùng thang đó làm gốc rồi khai báo lại thành token riêng như QLNS (không hard-code hex trong component).

| Token | Sáng | Tối (tím mận) | Dùng cho |
|---|---|---|---|
| `cherry-600` (primary) | `#E11D48` | `#FB7185` + quầng sáng | Nút chính, FAB điểm danh, quả cherry |
| `cherry-800` | `#9F1239` | `#FDA4AF` | Chữ nhấn, tiêu đề số tiền |
| `cherry-100` | `#FFE4E6` | `#4C1530` | Nền chip, nền thẻ nhẹ |
| `leaf-600` (success) | `#16A34A` | `#4ADE80` | Đã thu, đã xong, cuống cherry |
| `amber-500` (pending) | `#F59E0B` | `#FBBF24` | Sắp đến hạn, chờ đối chiếu |
| `overdue` | `#BE123C` trên nền `#FFF1F2` | `#FF8FA3` | Quá hạn |
| `background` | `#FFF8F3` (kem ấm) | `#1A0B16` | Nền app |
| `surface` | `#FFFFFF` có ánh hồng 2% | `#26111F` | Thẻ |
| `surface-raised` | `#FFFDFB` | `#331827` | Sheet, dialog |
| `foreground` | `#2A1B22` | `#FCE7F0` | Chữ |
| `muted` | `#7A6570` | `#B497A6` | Chữ phụ |

- **Trạng thái luôn có biểu tượng + chữ**, không chỉ màu:
  ✅ `Đã thu` (leaf + CheckCircle) · 🕒 `Sắp đến` / `Chờ đối chiếu` (amber + Clock) · ⚠️ `Quá hạn` (overdue + AlertTriangle).
  Vì màu thương hiệu cũng là đỏ, chip "Quá hạn" dùng đỏ đậm hơn trên nền hồng nhạt + icon cảnh báo để không lẫn với nút bấm.
- **Gradient** chỉ cho thẻ quan trọng: thẻ buổi học sắp tới (`#E11D48 → #F43F5E → #FB7185`), thẻ tổng kết cuối ngày, phiếu thu.
- **Avatar học sinh**: chữ cái đầu của tên (không phải họ — "Nguyễn Văn An" → "A"), nền pastel lấy theo `hue` cố định của từng em (sinh từ id, lưu DB để không đổi màu).

### 1.2 Chữ

- Font **Be Vietnam Pro** (`next/font/google`, subset `vietnamese`), weight 400/500/600/700/800.
- Thang: `display` 40/44 800 (số liệu lớn, `tabular-nums`) · `h1` 28/34 700 · `h2` 22/28 700 · `body` 16/24 (tối thiểu 16px trên điện thoại để iOS không tự zoom ô nhập) · `caption` 13/18.
- Số tiền luôn `1.600.000đ` (dấu chấm nghìn, chữ "đ" liền sau), ngày `dd/mm/yyyy`, giờ `17:30`.

### 1.3 Hình khối, bóng, khoảng cách

- Bo góc: ô nhập/nút `14px` · thẻ `20px` · bottom sheet/dialog `28px` · chip `full`.
- Bóng nhiều lớp ánh hồng thay vì xám:
  `0 1px 2px rgb(159 18 57 / .06), 0 8px 24px -8px rgb(159 18 57 / .18)`. Chế độ tối: bóng đen + viền `1px` sáng nhẹ + glow hồng cho phần tử chính.
- Lưới 4px; lề màn hình điện thoại 16px; vùng chạm tối thiểu 48×48px (cô bấm lúc đang đứng lớp).

### 1.4 Chuyển động (Motion)

| Preset | Thông số | Dùng cho |
|---|---|---|
| `snappy` | spring 500/30 | Nhấn thẻ (scale 0.97), toggle |
| `gentle` | spring 260/24 | Chuyển trang, mở sheet |
| `bouncy` | spring 400/14 | Cherry rơi vào giỏ, mascot nhảy |
| `fade` | 200ms ease-out | Fallback khi bật "giảm chuyển động" |

Hiệu ứng có sẵn: cherry rơi vào giỏ khi điểm danh · giỏ rung + phát sáng khi đủ chu kỳ ·
pháo giấy hình cherry khi xác nhận đã thu · số đếm chạy (CountUp) · biểu đồ vẽ dần ·
chuyển trang trượt/mờ · rung nhẹ `navigator.vibrate(15)` khi thao tác thành công ·
skeleton đúng hình nội dung. `prefers-reduced-motion` → mọi thứ chỉ còn mờ dần, tắt rung và pháo giấy.

### 1.5 Thành phần

Giữ cấu trúc kit QLNS (`ui/actions`, `ui/forms`, `ui/data-display`, `ui/feedback`, `ui/navigation`, `ui/surfaces`)
và thêm các thành phần riêng của TeamCherry:

| Thành phần | Mô tả |
|---|---|
| `BottomNav` + `AttendanceFab` | 5 mục: Hôm nay · Lớp học · **[🍒 FAB điểm danh nổi giữa]** · Thu tiền · Thống kê · "Thêm" nằm trong menu avatar. Desktop chuyển thành sidebar như AppShell của QLNS |
| `CherryProgress` | Hàng 10 quả cherry, quả đã học tô đỏ, quả chưa học viền nét đứt; nhận `count`, `cycle`, `glow` |
| `CherryBasket` | Giỏ nhận cherry rơi, rung + sáng khi đầy |
| `SwipeStudentCard` | Thẻ học sinh vuốt trái = vắng, chạm giữ = ghi chú |
| `UndoToast` | Toast có thanh đếm ngược 5 giây + nút Hoàn tác |
| `MoneyText` / `MoneyInput` | Hiển thị/nhập tiền (MoneyInput lấy từ QLNS) |
| `StatusChip` | Chip trạng thái có icon |
| `StatTile` | Thẻ số liệu lớn có CountUp (kế thừa `StatCard` QLNS) |
| `BottomSheet` | Sheet kéo từ dưới lên cho thao tác nhanh trên điện thoại |
| `CherryConfetti` | Pháo giấy hình cherry (canvas, tự tắt khi reduced-motion) |
| `Skeleton*` | Skeleton cho thẻ, danh sách, biểu đồ |
| `StudentAvatar` | Avatar chữ cái + nền pastel |
| `Mascot` | Bé Cherry, nhận prop `mood` |

### 1.6 Linh vật "Bé Cherry"

Hai quả cherry tròn dính chung một cuống hình chữ V, có một chiếc lá xanh `leaf-600` ở đỉnh.
Mỗi quả có mắt tròn đen kèm chấm sáng, má hồng. Vẽ bằng SVG inline, các phần
(mắt, miệng, tay, phụ kiện) là nhóm riêng để đổi biểu cảm và chuyển động.

| `mood` | Hình | Xuất hiện ở |
|---|---|---|
| `happy` | Mắt cong ^^, miệng cười | Màn chào, trang Hôm nay |
| `cheer` | Một quả giơ cờ nhỏ, sao lấp lánh | Điểm danh xong, đủ chu kỳ |
| `sleepy` | Mắt nhắm, "Zzz" bay lên, lá rủ | Màn trống, sau 21h30 |
| `celebrate` | Miệng mở, pháo giấy quanh | Xác nhận đã thu tiền |
| `worried` | Giọt mồ hôi, đám mây gạch chéo | Mất mạng, lỗi |
| `thinking` | Mắt liếc lên, dấu "…" | Đang tải lâu |

Chuyển động nền: nhún nhẹ 3s/lần, cuống lắc lư, chớp mắt ngẫu nhiên mỗi 3–6 giây.

### 1.7 Giọng văn

Cô ↔ app: "Xong rồi nè!", "Cô ơi, có 3 em đủ buổi rồi ạ". Lỗi: "Mạng đang chập chờn, app đã giữ lại
điểm danh — có mạng là tự gửi ạ." App → phụ huynh: "Dạ, em/cô xin phép gửi…", luôn có tên con.

---

### 1.8 Ba màn hình chính

**Màn 1 — "Hôm nay"** (trang mặc định khi mở app)

Đầu trang có Bé Cherry `happy` vẫy tay. Bên cạnh là dòng *"Chào buổi tối, cô Hà 🍒"* và một câu động viên nhỏ đổi theo ngày.
Ngay dưới là **thẻ gradient cherry** của ca sắp tới: "Lớp 9A · Ca 2 · 17:30", số em, và đồng hồ
đếm ngược lớn *"còn 42 phút"*, có nút trắng "Vào điểm danh →". Đang trong giờ học thì thẻ đổi thành "Đang học · đã điểm danh 12/14".
Tiếp theo là **ba thẻ số** xếp ngang có thể vuốt: *Thu tháng này* (xanh lá, số đếm chạy),
*Còn cần thu* (cam, kèm "8 phiếu"), *Đang học* (cherry, "148 em").
Khối **"Việc cần làm"** sắp theo ưu tiên, mỗi dòng là một thẻ nhỏ có icon và nút hành động ngay:
⚠️ phiếu quá hạn → 🍒 em vừa đủ chu kỳ, chưa gửi phiếu → 🕒 phụ huynh báo đã chuyển khoản, chờ cô xác nhận → 💬 em vắng 2 buổi liền.
Danh sách trống thì Bé Cherry `sleepy`: "Hôm nay không có gì gấp, cô thảnh thơi nhé!"
Sau buổi cuối trong ngày, đầu trang xuất hiện **thẻ tổng kết**: "Hôm nay cô dạy 2 ca, 27 em, nhận
1.600.000đ. Có 3 em cần nhắc học phí. Cô nghỉ ngơi nhé!" — vuốt để ẩn.

**Màn 2 — Chế độ đứng lớp** (bấm FAB 🍒 hoặc thẻ ca sắp tới)

Toàn màn hình, ẩn thanh điều hướng. Thanh trên: tên ca, ngày, chip "📶 Ngoại tuyến" nếu mất mạng,
bộ đếm *"Có mặt 13 · Vắng 1"*. Phía dưới là danh sách thẻ học sinh cao ~80px: avatar to, tên đậm, dưới tên là
`CherryProgress` (vd. 7/10). **Mặc định tất cả có mặt.** Vuốt trái → thẻ trượt lộ nền hồng,
bung hai nút lớn "Có phép" / "Không phép"; chọn xong thẻ mờ đi kèm chip trạng thái.
Chạm giữ → bottom sheet ghi chú nhanh (gợi ý: "Đi muộn", "Quên vở", "Làm bài tốt").
Em nào đủ 10/10 sau buổi này thì thẻ **phát sáng viền cherry** và có nhãn "Đủ chu kỳ 🎉".
Mọi thao tác đều hiện `UndoToast` 5 giây. Trên cùng có ô **"+ Thêm em học bù"** tìm không dấu trên toàn bộ học sinh.
Cuối màn là nút lớn **"Xong buổi ✓"**: cherry của từng em rơi vào giỏ theo dây chuyền,
Bé Cherry `cheer`, rồi hiện tóm tắt "14 em có mặt · 2 em đủ chu kỳ → Gửi phiếu ngay?".
Mục tiêu: lớp không ai vắng = mở + bấm "Xong buổi" ≈ 3 giây.

**Màn 3 — Phiếu thu cho phụ huynh** (`/p/<mã>`, không cần đăng nhập)

Trang trên nền kem trình bày như một **tấm thiệp**: viền giấy bo tròn, góc trên có Bé Cherry `happy`.
Dòng đầu: *"Phiếu học phí của con **Nguyễn Văn An** — Lớp 9A"*, mã phiếu nhỏ.
Giữa thiệp là **10 quả cherry xếp thành hai hàng**, dưới mỗi quả ghi ngày học (15/09, 18/09…).
Chạm vào quả nào thì quả đó nhún lên và hiện ca học. Buổi vắng có phép, nếu không tính tiền, không xuất hiện trong 10 quả
nhưng được ghi chú bên dưới cho minh bạch.
Tiếp theo là bảng nhỏ: *10 buổi × 80.000đ*, *Giảm anh chị em −80.000đ*, *Nợ kỳ trước*,
đường kẻ, rồi **Tổng cần đóng** cỡ chữ lớn màu cherry đậm.
Sau đó là **mã VietQR** (đã điền số tiền và nội dung `TC PT-0123 NGUYEN VAN AN`), tên ngân hàng,
số tài khoản có nút "Sao chép". Cuối thiệp là nút **"Tôi đã chuyển khoản"**; bấm vào thì hiện lời cảm ơn và trạng thái
"Cô đang đối chiếu". Phiếu đã thu thì thiệp có con dấu xanh "Đã nhận — cảm ơn anh/chị ạ 💚",
và link hết hạn sau 30 ngày kể từ khi đóng đủ.

---

## 2. Cơ sở dữ liệu

Quy ước giống QLNS: model PascalCase, bảng snake_case (`@@map`), enum SCREAMING_SNAKE, thời gian lưu UTC,
cột ngày thuần dùng `@db.Date`, xóa mềm `deletedAt`. **Tiền là `Int` (đồng)** — một phiếu không bao giờ
vượt 2,1 tỷ; tổng hợp lớn làm bằng SQL `SUM` trả về bigint rồi đổi sang `number`.

```
User ─┬─< AuditLog
      └─< Notification

Classroom ─< Shift ─┬─< ShiftSchedule
     │              └─< Session ─< Attendance >─ Student
     └─< Student ─┬─< StudentNote (riêng tư)        │
                  ├── SiblingGroup                   │
                  ├─< Invoice ─┬─< InvoiceLine ──────┘ (attendanceId UNIQUE)
                  │            └─< InvoiceAdjustment
                  ├─< Payment >─ Invoice (tùy chọn)
                  └─< MessageLog >─ MessageTemplate

ExpenseCategory ─< Expense        Setting (key/value)       BankTransaction (GĐ3)
```

### 2.1 Bảng

**`User`** — tài khoản. `id, email, phone?, passwordHash, displayName ("cô Hà"), role: TEACHER | PARENT | STUDENT, createdAt`.
GĐ1 chỉ có TEACHER; PARENT/STUDENT để sẵn enum cho GĐ2.

**`Setting`** — key/value JSON, sửa không cần deploy (giống `SystemSetting` QLNS):
| key | mặc định |
|---|---|
| `billing.defaultUnitPrice` | `80000` |
| `billing.cycleLength` | `10` |
| `billing.countExcused` | `false` (chờ chốt — mục 4) |
| `billing.countUnexcused` | `true` (chờ chốt — mục 4) |
| `billing.dueDays` | `7` (số ngày từ lúc gửi tới khi tính là quá hạn) |
| `bank` | `{ bin, accountNo, accountName }` cho VietQR |
| `notify.quietHours` | `{ from: "21:30", to: "06:30" }` |

**`Classroom`** (lớp) — `id, name ("Lớp 9A"), grade: 8|9, color, sortOrder, archivedAt?`

**`Shift`** (ca) — `id, classroomId, name ("Ca 2"), room?, active`.
**`ShiftSchedule`** — `shiftId, weekday (1=T2…7=CN), startTime "17:30", endTime "19:00"`. Lịch lặp lại.

**`Session`** (buổi học cụ thể) — `id, shiftId, date @db.Date, startTime, endTime,
status: SCHEDULED | COMPLETED | CANCELLED, cancelReason?, completedAt?`. Unique `(shiftId, date, startTime)`.
Sinh trước từ `ShiftSchedule` cho 4 tuần tới; hủy buổi = đổi status, không xóa.

**`Student`** — `id, code ("HS0001"), fullName, searchName (bỏ dấu, chữ thường — để tìm "nguyen van an"),
dob? @db.Date, grade, classroomId, shiftId (ca chính), school?, parentName?, parentPhone?, studentPhone?,
status: ACTIVE | PAUSED | LEFT, statusChangedAt, unitPrice Int? (null = theo mặc định), siblingGroupId?,
hardship Boolean (gia đình khó khăn), avatarHue Int, joinedAt @db.Date, deletedAt?`.

**`StudentNote`** — ghi chú **riêng tư** của cô: `id, studentId, content, createdAt`. Tách bảng riêng để
mọi truy vấn cho phụ huynh/học sinh không thể vô tình `include` nó (xem 2.3).

**`SiblingGroup`** — `id, label ("Nhà chị Lan"), discountType: PERCENT | FIXED, discountValue Int
(10 = 10% hoặc 50000 = 50.000đ mỗi phiếu), applyTo: ALL | FROM_SECOND`.

**`Attendance`** — một dòng = một em × một buổi.
`id, sessionId, studentId, status: PRESENT | EXCUSED | UNEXCUSED, isMakeup (học bù ca khác), note?,
billable Boolean, unitPrice Int, clientOpId (UUID từ điện thoại — đồng bộ offline không bị ghi đôi), updatedAt`.
Unique `(sessionId, studentId)`.
`billable` và `unitPrice` **được chốt lúc "Xong buổi"** theo cài đặt và đơn giá tại thời điểm đó → đổi cài đặt
sau này không làm thay đổi tiền của buổi đã học.

**`Invoice`** (phiếu thu) — `id, code ("PT-2026-0123"), studentId, cycleNo, sessionCount,
subtotal, discountAmount, discountNote?, adjustmentTotal, amount (= subtotal − discount + adjustment),
openingBalance (nợ/thừa trước phiếu — chụp lại để in đúng), status: READY | SENT | VOID,
publicToken (32 byte ngẫu nhiên, unique), tokenExpiresAt?, issuedAt, sentAt?, dueDate?`.
Trạng thái **thanh toán** (chưa thu / đóng thiếu / đã thu) **không lưu** mà tính từ sổ cái — cùng nguyên tắc
`Contract.paidAmount` của QLNS.

**`InvoiceLine`** — `id, invoiceId, attendanceId UNIQUE, date, shiftName, unitPrice`.
`attendanceId` unique ở mức DB ⇒ **một buổi học không bao giờ bị tính tiền hai lần**, kể cả khi có lỗi code.

**`InvoiceAdjustment`** — sửa tay: `id, invoiceId, kind: SESSION_COUNT | AMOUNT, delta Int (±),
before Json, after Json, reason (bắt buộc), createdById, createdAt`.

**`Payment`** — `id, studentId, invoiceId?, amount Int, paidAt, method: BANK_TRANSFER | CASH,
source: MANUAL | PARENT_CLAIM | WEBHOOK, status: PENDING | CONFIRMED | REJECTED, bankRef?, note?, confirmedAt?`.
Phụ huynh bấm "Tôi đã chuyển khoản" → tạo `PENDING` (không đổi tiền); cô xác nhận → `CONFIRMED`.

**`BankTransaction`** (dựng sẵn bảng, GĐ3 mới dùng) — `id, provider: SEPAY | CASSO, externalId UNIQUE,
amount, content, receivedAt, matchedPaymentId?, raw Json`.

**`ExpenseCategory`** — `id, name, icon (tên lucide), color, sortOrder`. Seed: Photo đề, Thuê phòng,
Điện nước, Quà cho học sinh, Văn phòng phẩm, Khác.
**`Expense`** — `id, categoryId, amount, spentOn @db.Date, note?, deletedAt?`.

**`MessageTemplate`** — `id, kind: FEE_SOFT | FEE_GENTLE | FEE_CLEAR | ABSENCE_CHECK | PRAISE |
SESSION_CANCELLED | BIRTHDAY, title, body (biến {tenCon} {soBuoi} {soTien} {link} {ngay}…), isDefault`.
**`MessageLog`** — `id, studentId?, invoiceId?, kind, content, createdAt` (ghi lại mỗi lần cô bấm gửi/sao chép).

**`Notification`** — thông báo trong app cho cô: `id, userId, kind, title, body, link, readAt?`.
**`AuditLog`** — `id, actorId, entity, entityId, action, before Json, after Json, reason?, createdAt`.
**`ImportBatch`** — lịch sử nhập Excel: `id, fileName, total, created, skipped, report Json, createdAt`.

GĐ2 sẽ thêm: `Assignment`, `AssignmentTarget`, `Submission`, `SubmissionPage`, `Score`, `GardenEvent`, `Badge`, `ParentLink`.

### 2.2 Sổ cái học phí — vì sao không lưu "đã đóng"

```
Số dư của em = Σ amount các phiếu (trừ VOID) − Σ Payment CONFIRMED
```
- Dương = còn nợ, âm = đóng thừa (tự trừ vào phiếu sau).
- Mỗi phiếu chụp `openingBalance` = số dư ngay trước khi phát hành → in ra "Nợ kỳ trước" mà **không cộng nợ vào `amount`**.
  Nhờ vậy nợ cũ không bao giờ bị tính hai lần.
- "Tổng cần đóng" trên phiếu = `openingBalance + amount`.
- Trạng thái từng phiếu lấy bằng cách phân bổ tiền đã nhận vào phiếu cũ nhất trước (FIFO).

### 2.3 Bảo mật dữ liệu

Brief ghi Supabase Row Level Security. Theo khung QLNS, app nối DB bằng một tài khoản duy nhất qua Prisma,
nên RLS của Postgres không thêm được nhiều lớp bảo vệ. Thay vào đó:
- Mọi action/route đi qua `can(user, quyền, phạm vi)`; phụ huynh/học sinh (GĐ2) chỉ có phạm vi `SELF` / con của mình.
- Trang phiếu công khai dùng **DTO chọn trường tường minh** (`select`), không bao giờ trả `hardship`, `StudentNote`, SĐT.
- `StudentNote` chỉ được đọc trong `students.service` ở các hàm có guard `teacher.only`.
- Test tự động kiểm tra: DTO phiếu công khai không chứa trường ngoài danh sách cho phép.

---

## 3. Luồng tiền

### 3.1 Điểm danh → đếm buổi → phiếu thu → xác nhận

```
[Đứng lớp]  mặc định PRESENT; vuốt = EXCUSED/UNEXCUSED; thêm em học bù
     │      (offline: lưu IndexedDB kèm clientOpId, có mạng thì gửi lại; server upsert theo (session, student))
     ▼
["Xong buổi"]  1 transaction:
     │   - Session → COMPLETED
     │   - Mỗi Attendance chốt billable (PRESENT luôn tính; EXCUSED/UNEXCUSED theo Setting) + unitPrice hiện hành
     │   - Với từng em: đếm Attendance billable CHƯA có InvoiceLine
     │       while (đếm ≥ cycleLength):
     │           lấy cycleLength buổi cũ nhất → tạo Invoice READY + InvoiceLine
     │           subtotal = Σ unitPrice; giảm anh chị em; openingBalance = số dư hiện tại
     │   - AuditLog
     ▼
[Cần thu]  Invoice READY → cô chọn giọng nhắc (FEE_SOFT mặc định; hardship → nhẹ nhất hoặc tạm ẩn)
     │      bấm "Gửi Zalo": sao chép tin + mở zalo.me/<SĐT phụ huynh> → Invoice SENT, ghi MessageLog
     ▼
[Phụ huynh]  mở /p/<token> → quét VietQR → bấm "Tôi đã chuyển khoản" → Payment PENDING → Notification cho cô
     ▼
[Đối chiếu]  cô kiểm tra app ngân hàng → 1 chạm "Đã nhận đủ" (CONFIRMED, pháo giấy 🍒)
             hoặc nhập số tiền khác (đóng thiếu) → phần còn lại thành nợ, tự hiện ở phiếu kỳ sau
```

**Khóa sửa**: buổi đã nằm trong phiếu `SENT` thì không sửa điểm danh trực tiếp được nữa. Muốn đổi phải
"Sửa phiếu" với lý do bắt buộc → `InvoiceAdjustment` + `AuditLog`. Phiếu còn `READY` (chưa gửi) thì sửa
điểm danh sẽ tự tạo lại phiếu.
**Vào muộn**: không cần xử lý riêng — bộ đếm chỉ đếm buổi em thực sự có điểm danh, nên chu kỳ tự bắt đầu từ buổi đầu tiên.
**Đổi đơn giá**: áp dụng cho các buổi **từ lúc đổi trở đi**; phiếu liệt kê đơn giá từng buổi nên phụ huynh thấy rõ.
**Làm tròn**: số phải đóng luôn làm tròn **xuống** (tiền giảm theo % làm tròn lên) — phụ huynh không bao giờ phải trả thừa vì làm tròn. Làm tròn tới đồng hay tới nghìn: chờ chốt (mục 4, câu 6).

### 3.2 Ba ví dụ tính tiền

Cài đặt chung: đơn giá 80.000đ, chu kỳ 10 buổi, vắng có phép **không tính**, vắng không phép **có tính**.

**Ví dụ 1 — Vào muộn + vắng có phép** · *Nguyễn Văn An, Lớp 9A, ca Thứ 3 & Thứ 6*

Lớp học từ 01/09, An vào học từ 15/09.

| Buổi | 15/09 | 18/09 | 22/09 | 25/09 | 29/09 | 02/10 | 06/10 | 09/10 | 13/10 | 16/10 | 20/10 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Điểm danh | ✅ | ✅ | ✅ | Vắng có phép | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Đếm | 1 | 2 | 3 | – | 4 | 5 | 6 | 7 | 8 | 9 | **10** |

→ Sau buổi 20/10 tạo phiếu: **10 × 80.000 = 800.000đ**. Phiếu ghi chú "25/09 vắng có phép — không tính".
(Nếu cô bật "vắng có phép có tính" thì phiếu đã tạo sớm hơn, sau buổi 16/10, vẫn 800.000đ.)

**Ví dụ 2 — Anh chị em + đổi đơn giá giữa chu kỳ** · *Trần Minh Bình, Lớp 9B, ca Thứ 4 & Thứ 7*

Bình và em gái Trần Minh Châu (Lớp 8) chung nhóm anh chị em, giảm 10% cho cả hai.
02/09 nghỉ Quốc khánh (buổi bị hủy, không ai bị tính). Từ 01/10 cô tăng đơn giá của Bình lên 90.000đ.

| Buổi | 05/09 · 09/09 · 12/09 · 16/09 · 19/09 · 23/09 · 26/09 · 30/09 | 03/10 · 07/10 |
|---|---|---|
| Đơn giá | 8 buổi × 80.000 = 640.000 | 2 buổi × 90.000 = 180.000 |

→ Tạm tính 820.000 − giảm anh chị em 10% (82.000) = **738.000đ**.
Phiếu của Châu tính riêng theo lịch của Châu, cũng được giảm 10%.

**Ví dụ 3 — Vắng không phép + đóng thiếu + sửa tay** · *Lê Hoàng Dũng, Lớp 8, ca Thứ 2 & Thứ 5*

- Chu kỳ 1: 03/09 → 05/10, trong đó 14/09 vắng không phép (vẫn tính) → **phiếu 1 = 800.000đ**.
  Phụ huynh chuyển 500.000đ → cô xác nhận 500.000đ → **còn nợ 300.000đ**, phiếu 1 hiện "Đóng thiếu".
- Chu kỳ 2: 08/10 → 09/11, 10 buổi = 800.000đ. Gia đình khó khăn, cô giảm tay 80.000đ, lý do
  "Hỗ trợ gia đình tháng 11" → lưu `InvoiceAdjustment` (800.000 → 720.000) + `AuditLog`.
  **Phiếu 2 = 720.000đ**, nợ kỳ trước 300.000đ → **tổng cần đóng 1.020.000đ**.
- Phụ huynh chuyển 1.020.000đ → số dư = (800.000 + 720.000) − (500.000 + 1.020.000) = **0đ**, cả hai phiếu "Đã thu".

Ba ví dụ này (cùng các ca: đổi đơn giá, đóng thừa, hủy buổi, học bù, sửa điểm danh sau khi gửi phiếu)
sẽ thành bộ **unit test Vitest** cho module `billing` trước khi viết giao diện.

---

## 4. Điểm còn chưa rõ — cần chị gái bạn trả lời

| # | Câu hỏi | Đề xuất mặc định |
|---|---|---|
| 1 | **Nền tảng**: brief ghi Supabase, nhưng bạn muốn theo khung QLNS (Postgres + Prisma tự host). Chốt theo QLNS? | Theo QLNS — đã có sẵn mẫu, triển khai, sao lưu |
| 2 | **Vắng có phép** có tính vào chu kỳ không? | Không tính |
| 3 | **Vắng không phép** có tính tiền không? | Có tính |
| 4 | **Cách chia ca**: 3 lớp là gì (8, 9A, 9B?), mỗi lớp mấy ca, mỗi ca học mấy buổi/tuần, giờ nào? | Mỗi lớp ~50 em chia 4 ca, mỗi ca 2 buổi/tuần |
| 5 | **Giảm anh chị em**: giảm cho tất cả các em hay từ em thứ hai? Mức bao nhiêu? | Tất cả, 10% |
| 6 | **Làm tròn**: có muốn làm tròn tổng tiền tới nghìn đồng không (vd 738.000 OK, 737.500 → 737.000)? | Làm tròn xuống tới nghìn |
| 7 | **Đổi đơn giá**: áp dụng cho buổi từ lúc đổi (như ví dụ 2) hay cho cả chu kỳ đang dở? | Từ lúc đổi |
| 8 | **Học bù** ở ca khác có tính tiền như buổi thường không? | Có |
| 9 | **Hạn đóng**: sau bao nhiêu ngày thì chuyển "Nhắc khéo", bao nhiêu ngày thì "Nhắc rõ"? | 7 ngày / 14 ngày |
| 10 | **Zalo** không cho web soạn sẵn tin nhắn tới một số điện thoại. Cách khả thi: app **sao chép tin + mở khung chat Zalo** của phụ huynh, cô chỉ cần dán và gửi. Chấp nhận được không? | Sao chép + mở Zalo |
| 11 | **Tài khoản ngân hàng** nhận tiền (ngân hàng, số TK, tên chủ TK) để tạo VietQR | Dữ liệu mẫu dùng TK giả |
| 12 | **File Excel** hiện tại có những cột gì? Gửi một file mẫu (có thể xóa SĐT) để làm phần tự nhận diện cột | — |
| 13 | **Triển khai**: chạy ở đâu (VPS như QLNS, hay Vercel + Postgres miễn phí)? PWA và link phiếu cho phụ huynh cần tên miền HTTPS | Quyết định ở cuối GĐ1 |
| 14 | **Tên hiển thị** của cô trong app ("cô Hà"?) và tên app trên màn hình chính ("TeamCherry"?) | "cô Hà" theo brief |
| 15 | **Đóng tiền mặt** có xảy ra không? | Vẫn hỗ trợ ghi tay |
| 16 | Phiếu đã gửi có **hạn đóng** in trên phiếu không, hay chỉ dùng nội bộ để nhắc? | Chỉ nội bộ, không in — tránh cảm giác bị đòi |

---

### Đã chốt (08/10/2026)

| # | Quyết định |
|---|---|
| 1 | Theo khung QLNS: Postgres + Prisma tự host |
| 2–3 | Vắng có phép và không phép **mặc định tính tiền**; cô bật/tắt trong Cài đặt |
| 4 | Lớp, ca, lịch học: cô tự tạo trong app (dữ liệu mẫu: Lớp 8, 9A, 9B — 10 ca) |
| 5 | Giảm anh chị em: cô tự đặt cho từng nhóm (% hoặc số tiền; mọi em hoặc từ em thứ 2) |
| 6 | Làm tròn xuống tới nghìn |
| 7–9, 15–16 | Theo đề xuất mặc định |
| 10 | Chưa làm Zalo — chỉ sao chép tin nhắn (có nút Chia sẻ của điện thoại) |
| 12 | Không có file Excel mẫu → app có file mẫu tải về + tự nhận diện cột theo tên thường gặp |
| — | Thêm `Invoice.discountSnapshot` (migration thứ 2) để sửa tay phiếu cũ không lấy mức giảm mới |

## 5. Kế hoạch Giai đoạn 1 (đã làm)

1. Khung dự án theo QLNS: Next 16, Prisma 7, Docker Postgres `5435`, Auth.js, `can()`, `ok/fail`, AuditLog.
2. Design system: token sáng/tối, font, kit UI, Bé Cherry SVG 6 biểu cảm, BottomNav + FAB, preset Motion.
3. **Module `billing` + Vitest** (làm trước giao diện): đếm chu kỳ, tạo phiếu, giảm giá, sổ cái, sửa tay.
4. Lớp / ca / lịch lặp / sinh buổi / hủy buổi + tin báo nghỉ.
5. Học sinh: danh sách, tìm không dấu, trạng thái, anh chị em, ghi chú riêng; **nhập Excel** có xem trước.
6. Chế độ đứng lớp + offline (service worker, IndexedDB, đồng bộ lại).
7. Thu tiền: danh sách cần thu, mẫu tin 3 giọng, phiếu công khai + VietQR, xác nhận đã thu, đóng thiếu.
8. Thống kê thu chi, nhập khoản chi, biểu đồ, xuất Excel.
9. Trang "Hôm nay".
10. Seed: 3 lớp, 150 học sinh tên tiếng Việt, ~8 tuần điểm danh (08/08 → 07/10/2026), phiếu ở đủ trạng thái, chi phí 2 tháng.
11. PWA manifest + icon, cập nhật `CLAUDE.md` cho repo.
