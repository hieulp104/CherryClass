/**
 * Ngày "thuần" (không giờ) cho buổi học, ngày chi… — cột `@db.Date` trong DB.
 *
 * Quy ước: trong code, ngày thuần là CHUỖI "YYYY-MM-DD" theo lịch Việt Nam.
 * Khi ghi/đọc Prisma, đổi qua lại bằng `toDbDate` / `fromDbDate` (Date ở 00:00 UTC).
 * Không bao giờ dùng `new Date()` rồi `toISOString().slice(0,10)` để lấy "hôm nay":
 * từ 0h–7h sáng giờ VN, cách đó trả về ngày HÔM QUA.
 */

export const VN_TZ = "Asia/Ho_Chi_Minh";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Ngày + giờ hiện tại theo giờ VN. */
export function vnNow(now: Date = new Date()) {
  const p = Object.fromEntries(partsFormatter.formatToParts(now).map((x) => [x.type, x.value]));
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour),
    minute: Number(p.minute),
    /** "17:05" — so sánh chuỗi được với giờ buổi học. */
    time: `${p.hour}:${p.minute}`,
  };
}

export function todayKey(now: Date = new Date()): string {
  return vnNow(now).dateKey;
}

/** "2026-09-15" → Date 2026-09-15T00:00:00Z để ghi vào cột @db.Date. */
export function toDbDate(key: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error(`Ngày không hợp lệ: ${key}`);
  return new Date(`${key}T00:00:00.000Z`);
}

/** Date đọc từ cột @db.Date → "YYYY-MM-DD". */
export function fromDbDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const d = toDbDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}

/** Số ngày từ a tới b (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toDbDate(b).getTime() - toDbDate(a).getTime()) / 86_400_000);
}

/** 1 = Thứ 2 … 7 = Chủ nhật (khớp ShiftSchedule.weekday). */
export function weekdayOf(key: string): number {
  const js = toDbDate(key).getUTCDay(); // 0 = CN
  return js === 0 ? 7 : js;
}

export const WEEKDAY_SHORT = ["", "T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
export const WEEKDAY_LONG = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"] as const;

/** "2026-09-15" → "15/09". */
export function shortDate(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

/** "2026-09-15" → "15/09/2026". */
export function fullDate(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
}

/** Tháng dạng "2026-09" của một ngày. */
export function monthKey(key: string): string {
  return key.slice(0, 7);
}

/** Ngày đầu và ngày cuối của tháng "2026-09". */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → "Tháng 9/2026". */
export function monthLabel(month: string): string {
  return `Tháng ${Number(month.slice(5, 7))}/${month.slice(0, 4)}`;
}

/** Phút từ mốc giờ "HH:mm" hôm nay tới thời điểm hiện tại (dương = còn bao lâu nữa). */
export function minutesUntil(time: string, nowTime: string): number {
  const [h1, m1] = time.split(":").map(Number);
  const [h2, m2] = nowTime.split(":").map(Number);
  return h1 * 60 + m1 - (h2 * 60 + m2);
}

/** Mốc UTC của ngày VN (00:00 giờ VN) — để lọc cột timestamp theo ngày VN. */
export function vnDayStartUtc(key: string): Date {
  return new Date(`${key}T00:00:00.000+07:00`);
}
