/** Không import Prisma — dùng được ở client để soạn tin gửi tài khoản. */

export type Credential = {
  kind: "STUDENT" | "PARENT";
  studentId: string;
  studentName: string;
  displayName: string;
  username: string;
  /** null = phụ huynh đã có tài khoản (anh chị em) — chỉ liên kết thêm con, không đổi mật khẩu. */
  password: string | null;
};

/** Tin nhắn gửi kèm tài khoản — cô sao chép gửi cho em / phụ huynh. */
export function credentialMessage(c: Credential, appUrl: string, teacherName: string): string {
  const who = c.kind === "STUDENT" ? `Em ${c.studentName.split(" ").at(-1)} ơi` : `Dạ em chào ${c.displayName}`;
  const what =
    c.kind === "STUDENT"
      ? "đây là tài khoản TeamCherry của em để xem bài tập, nộp bài và xem điểm"
      : `đây là tài khoản để anh/chị xem lịch học, điểm và học phí của con ${c.studentName}`;
  if (c.password === null) {
    return `${who}, ${teacherName} đã thêm con ${c.studentName} vào tài khoản TeamCherry của anh/chị (đăng nhập: ${c.username}). Anh/chị mở lại app là thấy ạ 🍒`;
  }
  return `${who}, ${what} 🍒\nĐăng nhập: ${appUrl}/login\nTên đăng nhập: ${c.username}\nMật khẩu tạm: ${c.password}\n(Lần đầu vào, app sẽ nhờ đổi mật khẩu mới.)`;
}
