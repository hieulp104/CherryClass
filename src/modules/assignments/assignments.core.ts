/**
 * Quy tắc bài tập, điểm, vườn cherry — hàm thuần, không Prisma, không đọc đồng hồ (truyền `now` vào).
 * Test: assignments.core.test.ts.
 *
 * Nguyên tắc với học sinh khối 9 (áp lực thi vào 10): KHÔNG xếp hạng, KHÔNG so với bạn —
 * chỉ so với chính mình; điểm thấp luôn đi kèm động viên.
 */

// ─────────────────── Trạng thái bài ───────────────────

export type SubmissionState =
  | "TODO" // chưa nộp, còn hạn
  | "DUE_SOON" // chưa nộp, còn ≤ 24 giờ
  | "MISSING" // quá hạn chưa nộp
  | "SUBMITTED" // đã nộp đúng hạn, chờ chấm
  | "LATE" // nộp muộn, chờ chấm
  | "GRADED";

export function isLate(submittedAt: Date, dueAt: Date): boolean {
  return submittedAt.getTime() > dueAt.getTime();
}

export function submissionState(
  s: { status: "ASSIGNED" | "SUBMITTED" | "GRADED"; submittedAt: Date | null },
  dueAt: Date,
  now: Date,
): SubmissionState {
  if (s.status === "GRADED") return "GRADED";
  if (s.status === "SUBMITTED") return s.submittedAt && isLate(s.submittedAt, dueAt) ? "LATE" : "SUBMITTED";
  const left = dueAt.getTime() - now.getTime();
  if (left < 0) return "MISSING";
  return left <= 24 * 3_600_000 ? "DUE_SOON" : "TODO";
}

// ─────────────────── Điểm ───────────────────

/** Điểm hợp lệ: 0..max, bước 0,25 (thói quen chấm điểm ở VN). Trả null nếu không hợp lệ. */
export function normalizeScore(raw: number, max: number): number | null {
  if (!Number.isFinite(raw) || raw < 0 || raw > max) return null;
  return Math.round(raw * 4) / 4;
}

/** Quy về thang 10 để so các bài có thang khác nhau. */
export function toTen(score: number, max: number): number {
  return max === 10 ? score : (score / max) * 10;
}

/** "8,25" — dấu phẩy thập phân kiểu Việt Nam, bỏ số 0 thừa. */
export function formatScore(score: number): string {
  return (Math.round(score * 100) / 100).toString().replace(".", ",");
}

export function isLowScore(score: number, max: number): boolean {
  return toTen(score, max) < 5;
}

/** Trung bình (thang 10) của các bài chấm trong tháng "YYYY-MM". Không có bài → null. */
export function monthAverage(graded: readonly { month: string; score: number; max: number }[], month: string): number | null {
  const list = graded.filter((g) => g.month === month);
  if (list.length === 0) return null;
  const avg = list.reduce((s, g) => s + toTen(g.score, g.max), 0) / list.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Câu so sánh với chính mình. Không bao giờ chê: giảm thì động viên, không nhắc con số giảm.
 */
export function selfComparison(thisMonth: number | null, lastMonth: number | null): { tone: "up" | "same" | "down" | "none"; text: string } {
  if (thisMonth === null) return { tone: "none", text: "Tháng này chưa có bài được chấm — nộp bài để cô xem nhé!" };
  if (lastMonth === null) return { tone: "none", text: `Điểm trung bình tháng này của em: ${formatScore(thisMonth)} 🌱` };
  const diff = Math.round((thisMonth - lastMonth) * 100) / 100;
  if (diff >= 0.1) return { tone: "up", text: `Điểm trung bình tháng này của em tăng ${formatScore(diff)} so với tháng trước 🎉` };
  if (diff > -0.1) return { tone: "same", text: "Em đang giữ phong độ rất đều — tiếp tục nhé! 💪" };
  return { tone: "down", text: "Tháng này hơi khó một chút, nhưng em vẫn đang cố gắng. Cô tin em sẽ lấy lại nhịp! 💗" };
}

const LOW_SCORE_CHEERS = [
  "Bài này chưa như ý, nhưng mỗi lỗi sai là một bước để em hiểu sâu hơn đó! 💗",
  "Đừng nản nhé — xem lại phần cô gợi ý, lần sau em sẽ làm tốt hơn nhiều!",
  "Cô thấy em đã cố gắng. Mình ôn lại một chút là ổn thôi! 🌱",
];

/** Lời động viên cố định theo bài (không ngẫu nhiên — mở lại vẫn cùng câu). */
export function lowScoreCheer(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return LOW_SCORE_CHEERS[h % LOW_SCORE_CHEERS.length];
}

// ─────────────────── Lời nhắc thân thiện ───────────────────

/** Nhắc nộp bài như một người bạn, theo số giờ còn lại. */
export function friendlyReminder(title: string, hoursLeft: number): string {
  if (hoursLeft < 0) return `Bài "${title}" đã quá hạn rồi — nộp muộn vẫn được, cô vẫn chấm cho em nha!`;
  if (hoursLeft < 3) return `Sắp tới giờ nộp "${title}" rồi! Chụp bài gửi cô ngay thôi 📸`;
  if (hoursLeft < 24) return `Còn chưa tới 1 ngày cho bài "${title}". Làm xong là nhẹ người luôn! 🍒`;
  const days = Math.floor(hoursLeft / 24);
  return `Còn ${days} ngày cho bài "${title}" — làm sớm cho thong thả nhé!`;
}

// ─────────────────── Vườn cherry ───────────────────

/**
 * Tuần đi học đầy đủ = tuần (Thứ 2 → CN) có ít nhất 1 buổi và mọi buổi đều có mặt.
 * `dates` là ngày VN "YYYY-MM-DD".
 */
export function fullAttendanceWeeks(rows: readonly { date: string; status: "PRESENT" | "EXCUSED" | "UNEXCUSED" }[]): string[] {
  const byWeek = new Map<string, boolean>();
  for (const r of rows) {
    const week = mondayOf(r.date);
    const ok = (byWeek.get(week) ?? true) && r.status === "PRESENT";
    byWeek.set(week, ok);
  }
  return [...byWeek.entries()].filter(([, ok]) => ok).map(([w]) => w).sort();
}

function mondayOf(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const wd = d.getUTCDay() || 7; // CN = 7
  d.setUTCDate(d.getUTCDate() - (wd - 1));
  return d.toISOString().slice(0, 10);
}

export const BADGES = [
  { at: 5, name: "Mầm cherry", emoji: "🌱", text: "5 quả đầu tiên — khởi đầu tuyệt vời!" },
  { at: 10, name: "Cây non", emoji: "🌿", text: "10 quả — em đã có thói quen tốt rồi đó." },
  { at: 20, name: "Cành sai quả", emoji: "🍒", text: "20 quả — chăm chỉ đều đặn quá!" },
  { at: 35, name: "Vườn rực đỏ", emoji: "🌳", text: "35 quả — cả khu vườn đang chín đỏ." },
  { at: 50, name: "Chủ vườn cherry", emoji: "🏆", text: "50 quả — em là chủ vườn thực thụ!" },
] as const;

/**
 * Mỗi bài nộp đúng hạn = 1 quả; mỗi tuần đi học đầy đủ = 1 quả.
 * Huy hiệu mở theo mốc; trả về mốc kế tiếp để vẽ thanh tiến độ.
 */
export function garden(input: { onTimeSubmissions: number; fullWeeks: number }) {
  const fruits = input.onTimeSubmissions + input.fullWeeks;
  const unlocked = BADGES.filter((b) => fruits >= b.at);
  const next = BADGES.find((b) => fruits < b.at) ?? null;
  const prevAt = unlocked.at(-1)?.at ?? 0;
  return {
    fruits,
    unlocked,
    next,
    progress: next ? (fruits - prevAt) / (next.at - prevAt) : 1,
  };
}

// ─────────────────── Đếm ngược thi vào 10 ───────────────────

export function daysUntil(today: string, target: string): number {
  return Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

const EXAM_CHEERS = [
  "Mỗi ngày một chút — đến ngày thi em sẽ thấy mình đã đi rất xa.",
  "Không cần hoàn hảo, chỉ cần tiến bộ hơn hôm qua 🌱",
  "Ngủ đủ, ăn đủ, học đều — vậy là em đang làm đúng rồi!",
  "Cô và cả lớp luôn ở bên em 💗",
  "Bài khó hôm nay sẽ là bài dễ của ngày mai.",
  "Nghỉ ngơi cũng là một phần của ôn thi nhé!",
];

export function examCheer(today: string): string {
  const n = Math.abs(daysUntil("2026-01-01", today));
  return EXAM_CHEERS[n % EXAM_CHEERS.length];
}
