/**
 * Chống dò mật khẩu — hàm thuần, có test.
 * Mật khẩu tạm "cherryNNNN" chỉ có 10.000 khả năng và tên đăng nhập là SĐT (dễ biết), nên:
 *  - sai LOGIN_MAX_FAILS lần liên tiếp → khóa tạm; với mật khẩu tạm, mỗi lần khóa sau gấp đôi (tới 24 giờ),
 *    nên một tuần chỉ dò được vài chục lần;
 *  - mật khẩu tự đặt: khóa cố định 15 phút — người lạ không thể khóa cô/phụ huynh ra khỏi app quá lâu;
 *  - mật khẩu tạm hết hạn sau TEMP_PASSWORD_DAYS ngày.
 */

export const LOGIN_MAX_FAILS = 5;
export const TEMP_PASSWORD_DAYS = 7;

const MINUTE = 60 * 1000;
const BASE_LOCK_MINUTES = 15;
const MAX_LOCK_MINUTES = 24 * 60;

export type LoginGate = { ok: true } | { ok: false; reason: "LOCKED"; minutesLeft: number } | { ok: false; reason: "EXPIRED" };

/** Kiểm trước khi so mật khẩu: đang khóa thì không so (không cho dò tiếp). */
export function loginGate(
  user: { lockedUntil: Date | null; mustChangePassword: boolean; tempPasswordExpiresAt: Date | null },
  now: Date,
): LoginGate {
  if (user.lockedUntil && user.lockedUntil > now) {
    return { ok: false, reason: "LOCKED", minutesLeft: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / MINUTE) };
  }
  if (user.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt <= now) {
    return { ok: false, reason: "EXPIRED" };
  }
  return { ok: true };
}

/** Sau một lần sai: số lần sai mới và (nếu tới ngưỡng) khóa tới khi nào. */
export function afterFailedLogin(
  failedLogins: number,
  temporaryPassword: boolean,
  now: Date,
): { failedLogins: number; lockedUntil: Date | null } {
  const fails = failedLogins + 1;
  if (fails % LOGIN_MAX_FAILS !== 0) return { failedLogins: fails, lockedUntil: null };
  const round = fails / LOGIN_MAX_FAILS; // lần khóa thứ mấy
  const minutes = temporaryPassword
    ? Math.min(BASE_LOCK_MINUTES * 2 ** (round - 1), MAX_LOCK_MINUTES)
    : BASE_LOCK_MINUTES;
  return { failedLogins: fails, lockedUntil: new Date(now.getTime() + minutes * MINUTE) };
}

/**
 * Theo địa chỉ IP: chặn kiểu thử MỘT mật khẩu tạm trên NHIỀU tài khoản (khóa từng tài khoản không bắt được).
 * Giữ mốc thời gian các lần sai trong cửa sổ trượt; trả về danh sách đã lọc để lưu lại.
 */
export const IP_MAX_FAILS = 20;
export const IP_WINDOW_MS = 15 * MINUTE;

export function recentFailures(timestamps: readonly number[], now: number): number[] {
  return timestamps.filter((t) => now - t < IP_WINDOW_MS);
}

export function ipBlocked(timestamps: readonly number[], now: number): boolean {
  return recentFailures(timestamps, now).length >= IP_MAX_FAILS;
}

export function tempPasswordExpiry(now: Date): Date {
  return new Date(now.getTime() + TEMP_PASSWORD_DAYS * 24 * 60 * MINUTE);
}
