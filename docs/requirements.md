# TeamCherry — Yêu cầu gốc

> Brief gốc của dự án, giữ nguyên văn để đối chiếu. Thiết kế chi tiết và các quyết định
> nằm ở [thiet-ke.md](thiet-ke.md).

# VAI TRÒ
Bạn là một product designer đẳng cấp kiêm kỹ sư full-stack, người tin rằng phần mềm tốt phải khiến người dùng thấy được thấu hiểu. Hãy thiết kế và xây dựng "TeamCherry" — ứng dụng web giúp một cô giáo dạy thêm quản lý lớp, điểm danh, thu học phí, giao bài và thống kê thu chi.

Ba nguyên tắc xuyên suốt:
1. KHÔNG BAO GIỜ TÍNH SAI TIỀN. Tiền bạc giữa cô giáo và phụ huynh là chuyện nhạy cảm, một lần sai là mất lòng tin.
2. TINH TẾ VỚI CON NGƯỜI. Mọi tin nhắn, thông báo, con số đều phải nghĩ xem người nhận cảm thấy thế nào.
3. ĐẸP VÀ VUI. Mở app lên phải thấy dễ chịu, sống động, có cá tính, không giống phần mềm kế toán.

# BỐI CẢNH THỰC TẾ
- Một giáo viên duy nhất sử dụng quyền quản trị.
- Dạy khối 8 và khối 9, gồm 3 lớp, khoảng 150 học sinh; mỗi buổi khoảng 10–15 em.
- Hiện đang làm thủ công hoàn toàn: tự đếm buổi, tự tính tiền. Có sẵn file Excel danh sách học sinh.
- Học sinh khối 9 có điện thoại riêng và đang chuẩn bị thi vào lớp 10 (áp lực lớn). Khối 8 không có điện thoại nên dùng qua tài khoản phụ huynh.
- Phụ huynh đóng tiền bằng chuyển khoản.
- Cô giáo dùng điện thoại là chính, thường thao tác ngay lúc đang đứng lớp.
- Tiếng Việt, VNĐ, dd/mm/yyyy, múi giờ Asia/Ho_Chi_Minh.

# CÁCH TÍNH HỌC PHÍ (LÕI HỆ THỐNG)
- Đơn giá mặc định 80.000đ/buổi; sửa được mặc định và đơn giá riêng từng học sinh.
- Thu theo CHU KỲ 10 BUỔI (cấu hình được): mỗi học sinh có bộ đếm; đủ 10 buổi tính tiền thì tự tạo phiếu thu 10 × đơn giá và đưa vào danh sách "Cần thu".
- Học sinh vào muộn: chu kỳ bắt đầu từ buổi đầu tiên em đi học.
- Buổi vắng có phép: [CẦN XÁC NHẬN có tính vào chu kỳ hay không] — làm thành tùy chọn cấu hình.
- Giảm giá anh chị em ruột: liên kết các em với nhau, giảm theo % hoặc số tiền cố định.
- Sửa tay số buổi và số tiền được, nhưng luôn lưu lịch sử chỉnh sửa (giá trị cũ, mới, thời gian, lý do).
- Phiếu thu liệt kê từng ngày đã học trong chu kỳ để phụ huynh tự đối chiếu, minh bạch tuyệt đối.
- Hỗ trợ đóng thiếu, nợ chuyển sang chu kỳ sau. Tiền lưu dạng số nguyên.

# CHỨC NĂNG — THIẾT KẾ CHO TỪNG NGƯỜI

## A. Cho cô giáo: làm ít hơn, yên tâm hơn

### Trang chủ "Hôm nay"
- Lời chào theo giờ trong ngày và tên cô ("Chào buổi tối, cô Hà 🍒"), kèm một câu động viên ngắn thay đổi mỗi ngày.
- Thẻ buổi học sắp tới, đếm ngược đến giờ vào lớp; chạm là vào điểm danh.
- Ba thẻ số liệu lớn, dễ đọc: thu tháng này, còn cần thu, học sinh đang học.
- Mục "Việc cần làm" sắp theo mức ưu tiên: em vừa đủ chu kỳ cần gửi phiếu thu, phiếu quá hạn, bài chưa chấm, em vắng nhiều buổi liền.
- Tổng kết cuối ngày (sau buổi dạy cuối): "Hôm nay cô dạy 2 ca, 27 em, nhận 1.600.000đ. Có 3 em cần nhắc học phí. Cô nghỉ ngơi nhé!"

### Chế độ đứng lớp (điểm danh siêu nhanh)
- Màn hình toàn phần, chữ và avatar to, mặc định tất cả có mặt.
- Vuốt trái thẻ học sinh = vắng (rồi chọn có phép / không phép), chạm giữ = ghi chú nhanh.
- Thanh tiến trình chu kỳ hiện ngay dưới tên mỗi em (ví dụ 7/10 quả cherry), em nào đủ 10 sau buổi này thì phát sáng nhẹ.
- Nút "Hoàn tác" trong 5 giây cho mọi thao tác.
- Hoạt động cả khi mất mạng, tự đồng bộ khi có mạng lại.
- Thêm nhanh em học bù từ ca khác bằng ô tìm kiếm.
- Mục tiêu: điểm danh xong một buổi trong dưới 20 giây.

### Thu tiền khéo léo
- Đủ chu kỳ là app soạn sẵn tin nhắn Zalo cho phụ huynh kèm link phiếu thu; cô chỉ cần bấm gửi. App KHÔNG tự gửi tin đòi tiền khi chưa có cô duyệt.
- Ba giọng nhắc để chọn: "Báo nhẹ" (thông báo đã đủ buổi), "Nhắc khéo" (đã quá vài ngày), "Nhắc rõ" (quá lâu) — lời lẽ luôn lịch sự, ấm áp, có tên con, cô sửa được mẫu.
- Ghi chú riêng tư về hoàn cảnh gia đình chỉ cô thấy; đánh dấu "Gia đình khó khăn" để app tự chọn giọng nhắc nhẹ nhất hoặc tạm không nhắc.
- Phụ huynh bấm "Tôi đã chuyển khoản" trên phiếu → cô nhận thông báo, đối chiếu và xác nhận bằng một chạm.
- Chuẩn bị kiến trúc cho webhook ngân hàng (SePay, Casso) để sau này tự đối soát.

### Quan tâm học sinh như người thầy thật sự
- Em vắng 2 buổi liên tiếp: gợi ý tin nhắn hỏi thăm phụ huynh (giọng quan tâm, không trách móc).
- Sinh nhật học sinh: nhắc cô và gợi ý lời chúc ngắn.
- Mẫu lời khen nhanh gửi phụ huynh ("Hôm nay con làm bài rất tốt ạ"), vì phụ huynh không chỉ nên nhận tin nhắn đòi tiền.
- Sổ tay học sinh: điểm mạnh, điểm yếu, ghi chú riêng, lịch sử chuyên cần và điểm dạng biểu đồ.

### Tài chính và thống kê (ưu tiên cao)
- Thu theo tháng, lớp, khối; đã thu, còn nợ; danh sách nợ.
- Nhập khoản chi theo danh mục có biểu tượng (photo đề, phòng, điện nước, quà cho học sinh…).
- Lợi nhuận tháng, biểu đồ xu hướng, so sánh các tháng.
- Chỉ số "Thời gian cô đã tiết kiệm" (ước tính từ số lần điểm danh, tính tiền tự động).
- Tổng kết năm học kiểu "Wrapped": số buổi đã dạy, số em, tổng thu, khoảnh khắc đáng nhớ, trình bày như chuỗi thẻ hoạt hình để cô tự hào chia sẻ.
- Xuất Excel mọi báo cáo.

### Quản lý học sinh và lớp
- Nhập file Excel có sẵn: app tự nhận diện cột (tên, lớp, SĐT…), cho xem trước, đánh dấu dòng trùng hoặc thiếu.
- 3 lớp, mỗi lớp có thể chia nhiều ca [CẦN XÁC NHẬN cách chia ca]; lịch học lặp lại.
- Nghỉ lễ, cô ốm: hủy buổi một chạm, soạn sẵn tin thông báo cho các lớp bị ảnh hưởng.
- Trạng thái: đang học, tạm nghỉ, đã nghỉ (giữ nguyên lịch sử).
- Tìm kiếm học sinh luôn hiện sẵn, gõ không dấu cũng tìm được ("nguyen van an" ra "Nguyễn Văn An").

## B. Cho phụ huynh: minh bạch, nhẹ nhàng
- Mở link phiếu thu không cần đăng nhập (link có mã bảo mật riêng, hết hạn sau khi đóng).
- Phiếu thu đẹp như một tấm thiệp: tên con, 10 quả cherry ứng với 10 buổi kèm ngày học, đơn giá, giảm trừ, tổng tiền, mã VietQR quét là xong.
- Phụ huynh khối 8 có tài khoản xem: lịch học, chuyên cần, đề bài và bài nộp của con, điểm, nhận xét, lịch sử đóng tiền.
- Báo cáo học tập do cô chủ động gửi khi cần (không tự động hằng tháng), trình bày như một lá thư ngắn có biểu đồ.

## C. Cho học sinh khối 9: động lực, không áp lực
- Đếm ngược đến kỳ thi vào lớp 10 kèm câu động viên.
- Nhận đề (ảnh hoặc file), nộp bài bằng ảnh chụp nhiều trang hoặc file; app tự xoay và làm nét ảnh.
- Nhắc nộp bài giọng thân thiện, như một người bạn.
- "Vườn cherry": mỗi lần nộp bài đúng hạn hoặc đi học đầy đủ được thêm một quả; đạt mốc thì mở huy hiệu.
- KHÔNG có bảng xếp hạng điểm công khai. Chỉ so sánh với chính mình ("Điểm trung bình tháng này của em tăng 0,8 so với tháng trước 🎉").
- Xem điểm kèm nhận xét của cô; bài điểm thấp luôn đi kèm lời động viên và gợi ý cần ôn gì.

## D. Bài tập (dùng chung)
- Cô giao đề bằng ảnh hoặc file, chọn lớp, ca hoặc từng em, đặt hạn nộp.
- Màn hình chấm: lướt từng bài, khoanh và ghi chú lên ảnh, chấm điểm, chèn nhận xét mẫu một chạm hoặc ghi âm nhận xét.
- Thấy ngay ai đã nộp, ai chưa, ai nộp muộn.
- Không cần trắc nghiệm, ngân hàng câu hỏi hay soạn công thức.

# THIẾT KẾ GIAO DIỆN — PHẢI THẬT ĐẸP VÀ SỐNG ĐỘNG

## Bản sắc
- Chủ đề cherry: tươi, ngọt, tràn năng lượng nhưng vẫn chuyên nghiệp.
- Linh vật gốc tự thiết kế: "Bé Cherry" — hai quả cherry dính cuống, mắt tròn, có nhiều biểu cảm (vui, cổ vũ, ngủ gật, ăn mừng). Xuất hiện ở màn trống, màn chào, lúc hoàn thành việc, lỗi mạng — vẽ bằng SVG.

## Màu sắc
- Đỏ cherry chủ đạo (#E11D48), cherry đậm (#9F1239), hồng phấn (#FFE4E6), xanh lá cuống cherry làm màu nhấn cho trạng thái "đã xong" (#16A34A), nền kem ấm (#FFF8F3) thay cho trắng tinh.
- Chế độ tối: nền tím mận rất đậm, cherry phát sáng nhẹ — dễ chịu khi cô chấm bài ban đêm.
- Dùng gradient mềm cho thẻ quan trọng; màu trạng thái nhất quán (xanh = đã thu, cam = sắp đến, đỏ = quá hạn) và luôn kèm biểu tượng, không chỉ dựa vào màu.

## Chữ và bố cục
- Font "Be Vietnam Pro" (hiển thị dấu tiếng Việt chuẩn), số liệu lớn dùng font đậm nổi bật.
- Bo góc lớn (16–24px), đổ bóng mềm nhiều lớp, khoảng trắng rộng rãi.
- Thanh điều hướng dưới cùng trên điện thoại (Hôm nay, Lớp học, Thu tiền, Thống kê, Thêm) với nút điểm danh nổi ở giữa.
- Avatar học sinh tự tạo từ chữ cái đầu trên nền màu pastel riêng cho từng em.

## Chuyển động (Framer Motion)
- Quả cherry "rơi" vào giỏ khi điểm danh; đủ 10 quả thì giỏ rung nhẹ và phát sáng.
- Pháo giấy hình cherry khi xác nhận đã thu tiền.
- Số liệu đếm chạy khi mở trang thống kê; biểu đồ vẽ dần lên.
- Chuyển trang mượt, thẻ có hiệu ứng nhấn, rung nhẹ (haptic) trên điện thoại khi thao tác thành công.
- Skeleton loading theo hình dạng nội dung thay cho vòng xoay.
- Tôn trọng cài đặt "giảm chuyển động" của hệ điều hành.

## Giọng văn
- Xưng hô ấm áp, ngắn gọn: "Xong rồi nè!", "Cô ơi, có 3 em đủ buổi rồi ạ".
- Thông báo lỗi không đổ lỗi người dùng, luôn kèm cách khắc phục.
- Giờ yên tĩnh: không gửi thông báo cho học sinh, phụ huynh sau 21h30 và trước 6h30.

# YÊU CẦU KỸ THUẬT
- Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion; Supabase (PostgreSQL, Auth, Storage, Row Level Security); biểu đồ Recharts.
- PWA cài được lên màn hình chính, hỗ trợ offline cho điểm danh.
- Row Level Security chặt chẽ: học sinh và phụ huynh chỉ thấy dữ liệu của mình; ghi chú riêng tư của cô không bao giờ lộ ra ngoài.
- Unit test bắt buộc cho logic học phí: vào muộn, vắng có phép, vắng không phép, anh chị em, đóng thiếu, sửa tay, đổi đơn giá giữa chu kỳ.
- Sao lưu tự động; xuất toàn bộ dữ liệu ra Excel.

# CÁCH TRIỂN KHAI
- Giai đoạn 1: đăng nhập, nhập Excel, lớp và ca, chế độ đứng lớp, bộ đếm chu kỳ, phiếu thu đẹp kèm VietQR, tin nhắn nhắc khéo, thống kê thu chi, trang "Hôm nay", toàn bộ hệ thống giao diện và linh vật.
- Giai đoạn 2: tài khoản học sinh khối 9 và phụ huynh khối 8, giao đề, nộp bài, chấm bài, vườn cherry, đếm ngược thi vào 10.
- Giai đoạn 3: báo cáo cho phụ huynh, gợi ý hỏi thăm và chúc sinh nhật, tổng kết năm học, tự động đối soát ngân hàng.

Trước khi code, hãy: (1) đề xuất bộ design system (màu, chữ, thành phần, linh vật) và mô tả 3 màn hình chính bằng lời; (2) trình bày sơ đồ cơ sở dữ liệu; (3) mô tả luồng điểm danh → đếm buổi → phiếu thu → xác nhận đã thu, kèm 3 ví dụ tính tiền cụ thể; (4) liệt kê điểm còn chưa rõ. Sau đó làm Giai đoạn 1 với dữ liệu mẫu: 3 lớp, 150 học sinh tên tiếng Việt, 2 tháng điểm danh và thu chi.
