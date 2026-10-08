/**
 * Mẫu tin nhắn mặc định. Cô sửa được ở Cài đặt → Mẫu tin nhắn (lưu DB).
 * Không import Prisma — dùng được ở cả client (xem trước) lẫn seed.
 *
 * Nguyên tắc viết: luôn có tên con; không dùng từ "nợ", "đòi"; luôn cho phụ huynh lối thoát
 * ("nếu mình đã chuyển rồi thì bỏ qua giúp em"); không trách móc khi con vắng.
 */

export type MessageKind =
  | "FEE_SOFT"
  | "FEE_GENTLE"
  | "FEE_CLEAR"
  | "ABSENCE_CHECK"
  | "PRAISE"
  | "SESSION_CANCELLED"
  | "BIRTHDAY";

export const MESSAGE_KIND_META: Record<MessageKind, { label: string; emoji: string; hint: string }> = {
  FEE_SOFT: { label: "Báo nhẹ", emoji: "🍒", hint: "Vừa đủ buổi — báo để phụ huynh biết" },
  FEE_GENTLE: { label: "Nhắc khéo", emoji: "🌷", hint: "Đã gửi phiếu được vài ngày" },
  FEE_CLEAR: { label: "Nhắc rõ", emoji: "📌", hint: "Quá lâu chưa đóng — vẫn lịch sự" },
  ABSENCE_CHECK: { label: "Hỏi thăm", emoji: "💗", hint: "Con vắng mấy buổi liền" },
  PRAISE: { label: "Khen con", emoji: "🌟", hint: "Phụ huynh không chỉ nhận tin về tiền" },
  SESSION_CANCELLED: { label: "Báo nghỉ", emoji: "📅", hint: "Nghỉ lễ, cô ốm…" },
  BIRTHDAY: { label: "Chúc sinh nhật", emoji: "🎂", hint: "Gửi con hoặc phụ huynh" },
};

export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: "tenPhuHuynh", label: "Cách gọi phụ huynh (vd: chị Lan)" },
  { key: "tenCon", label: "Tên con (vd: An)" },
  { key: "hoTenCon", label: "Họ tên con" },
  { key: "lop", label: "Lớp" },
  { key: "soBuoi", label: "Số buổi trong phiếu" },
  { key: "soTien", label: "Số tiền cần đóng" },
  { key: "link", label: "Link phiếu thu" },
  { key: "tenCo", label: "Tên cô" },
  { key: "ngay", label: "Ngày" },
  { key: "lyDo", label: "Lý do nghỉ" },
];

export const DEFAULT_TEMPLATES: { kind: MessageKind; title: string; body: string }[] = [
  {
    kind: "FEE_SOFT",
    title: "Báo đủ buổi",
    body:
      "Dạ em chào {tenPhuHuynh} ạ. Con {tenCon} đã học đủ {soBuoi} buổi của đợt này rồi ạ 🍒\n" +
      "Em gửi phiếu học phí để mình tiện xem lại từng buổi con đã học: {link}\n" +
      "Học phí đợt này là {soTien}, mình quét mã QR trên phiếu là chuyển khoản được luôn ạ. Em cảm ơn {tenPhuHuynh} nhiều ạ!",
  },
  {
    kind: "FEE_GENTLE",
    title: "Nhắc khéo",
    body:
      "Dạ em chào {tenPhuHuynh} ạ. Em xin phép nhắc nhẹ học phí đợt {soBuoi} buổi của con {tenCon} ({soTien}) ạ. " +
      "Chắc dạo này mình bận nên chưa kịp xem, em gửi lại phiếu ở đây ạ: {link}\n" +
      "Nếu mình chuyển rồi thì {tenPhuHuynh} bỏ qua tin này giúp em nhé. Em cảm ơn ạ!",
  },
  {
    kind: "FEE_CLEAR",
    title: "Nhắc rõ",
    body:
      "Dạ em chào {tenPhuHuynh} ạ. Học phí đợt {soBuoi} buổi của con {tenCon} hiện em vẫn chưa nhận được, số tiền cần đóng là {soTien} ạ. " +
      "Phiếu chi tiết và mã QR ở đây ạ: {link}\n" +
      "Nếu gia đình đang có việc gì khó khăn, {tenPhuHuynh} cứ nhắn riêng em để mình cùng sắp xếp nhé. Em cảm ơn {tenPhuHuynh} ạ.",
  },
  {
    kind: "ABSENCE_CHECK",
    title: "Hỏi thăm khi con vắng",
    body:
      "Dạ em chào {tenPhuHuynh} ạ. Mấy buổi gần đây em không thấy con {tenCon} đến lớp, con có khỏe không ạ? " +
      "Nếu con cần học bù hay cần em gửi bài để theo kịp lớp, {tenPhuHuynh} cứ nhắn em nhé. Em mong con sớm quay lại ạ 🍒",
  },
  {
    kind: "PRAISE",
    title: "Con làm bài tốt",
    body:
      "Dạ em chào {tenPhuHuynh} ạ. Hôm nay con {tenCon} làm bài rất tốt, tập trung và hăng hái phát biểu lắm ạ 🌟 " +
      "Em báo để cả nhà cùng vui với con ạ!",
  },
  {
    kind: "PRAISE",
    title: "Con tiến bộ",
    body:
      "Dạ em chào {tenPhuHuynh} ạ. Dạo này con {tenCon} tiến bộ rõ lắm ạ, bài làm cẩn thận hơn hẳn. " +
      "{tenPhuHuynh} khen con giúp em một câu nhé, con sẽ vui lắm ạ 💪",
  },
  {
    kind: "SESSION_CANCELLED",
    title: "Báo nghỉ buổi",
    body:
      "Dạ em chào các anh chị phụ huynh lớp {lop} ạ. Em xin phép cho lớp nghỉ buổi {ngay} vì {lyDo} ạ. " +
      "Buổi nghỉ này không tính học phí, em sẽ báo lịch học bù sau ạ. Em cảm ơn các anh chị đã thông cảm ạ!",
  },
  {
    kind: "BIRTHDAY",
    title: "Chúc mừng sinh nhật",
    body: "Chúc mừng sinh nhật {tenCon}! 🎂 Chúc con một tuổi mới thật vui, thật khỏe và học thật tốt nhé. — {tenCo} 🍒",
  },
];

/** Điền biến {xxx}; biến không có giá trị thì giữ nguyên để cô thấy và tự sửa. */
export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body.replace(/\{(\w+)\}/g, (match, key: string) => {
    const v = vars[key];
    return v === null || v === undefined || v === "" ? match : String(v);
  });
}

/** Cách gọi phụ huynh: "chị Lan" nếu có tên, không thì "anh/chị". */
export function parentAddress(parentName: string | null | undefined): string {
  const name = parentName?.trim();
  if (!name) return "anh/chị";
  // Đã có danh xưng sẵn ("Chị Lan", "anh Tuấn", "Mẹ An") thì giữ nguyên, viết thường chữ đầu.
  if (/^(anh|chị|chi|cô|chú|bác|mẹ|bố|ba|má)\s/i.test(name)) return name.charAt(0).toLowerCase() + name.slice(1);
  return `anh/chị ${name.split(/\s+/).at(-1)}`;
}

/** Đang trong giờ yên tĩnh (21:30 → 06:30)? */
export function inQuietHours(time: string, quiet: { from: string; to: string }): boolean {
  return quiet.from > quiet.to ? time >= quiet.from || time < quiet.to : time >= quiet.from && time < quiet.to;
}
