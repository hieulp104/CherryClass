/**
 * Báo cáo tháng gửi phụ huynh — hàm thuần, không Prisma (test: report.core.test.ts).
 *
 * App KHÔNG tự gửi: cô xem, sửa, rồi sao chép dán vào Zalo.
 * Nguyên tắc như tin nhắn học phí và cổng học sinh: không xếp hạng, không so với bạn;
 * điểm giảm thì không nêu con số giảm; điểm dưới 5 luôn kèm lời cô sẽ kèm thêm; không trách khi con vắng.
 */

import { formatScore } from "@/modules/assignments/assignments.core";

export type MonthlyReportInput = {
  /** Cách gọi phụ huynh, vd "chị Lan" (parentAddress). */
  parent: string;
  /** Tên gọi của con, vd "An". */
  child: string;
  /** "YYYY-MM". */
  month: string;
  /** Cách cô tự xưng khi ký tên, vd "cô Hà". */
  teacher: string;
  /** Buổi trong tháng; `makeup` là số buổi học bù — đã nằm trong `present`. */
  attendance: { present: number; excused: number; unexcused: number; makeup: number };
  /** Bài có hạn nộp trong tháng. */
  homework: { assigned: number; submitted: number; onTime: number };
  /** Điểm trung bình thang 10 trong tháng / tháng trước (null = chưa có bài được chấm). */
  average: number | null;
  previousAverage: number | null;
  /** Vài dòng cô viết thêm. */
  note: string;
};

function attendanceLine({ present, excused, unexcused, makeup }: MonthlyReportInput["attendance"]): string | null {
  const total = present + excused + unexcused;
  if (total === 0) return null;
  const extra = [
    makeup > 0 ? `${makeup} buổi học bù` : null,
    excused > 0 ? `nghỉ có phép ${excused}` : null,
    unexcused > 0 ? `nghỉ không phép ${unexcused}` : null,
  ].filter(Boolean);
  return `Đi học: ${present}/${total} buổi${extra.length ? ` (${extra.join(", ")})` : ""}`;
}

function homeworkLine({ assigned, submitted, onTime }: MonthlyReportInput["homework"]): string | null {
  if (assigned === 0) return null;
  if (submitted === 0) return `Bài tập: con chưa nộp bài nào trong ${assigned} bài, mình nhắc con giúp em nhé`;
  if (submitted === assigned && onTime === submitted) return `Bài tập: nộp ${submitted}/${assigned} bài, tất cả đúng hạn`;
  return `Bài tập: nộp ${submitted}/${assigned} bài, ${onTime} bài đúng hạn`;
}

function scoreLine(average: number | null, previous: number | null): string | null {
  if (average === null) return null;
  let line = `Điểm trung bình: ${formatScore(average)}`;
  // Cùng ngưỡng với selfComparison: chênh dưới 0,1 coi như giữ đều.
  const diff = previous === null ? null : Math.round((average - previous) * 100) / 100;
  if (diff !== null && diff >= 0.1) line += ` (tăng ${formatScore(diff)} so với tháng trước)`;
  else if (diff !== null && diff > -0.1) line += " (giữ đều như tháng trước)";
  if (average < 5) line += " — em sẽ kèm con ôn thêm những phần còn hổng ạ";
  return line;
}

export function monthlyReportText(input: MonthlyReportInput): string {
  const month = Number(input.month.slice(5, 7));
  const lines = [
    attendanceLine(input.attendance),
    homeworkLine(input.homework),
    scoreLine(input.average, input.previousAverage),
  ].filter((l): l is string => l !== null);

  const parts = [`Dạ em chào ${input.parent} ạ. Em gửi mình tình hình học tháng ${month} của con ${input.child} ạ 🍒`];
  parts.push(lines.length ? lines.map((l) => `• ${l}`).join("\n") : "• Tháng này con chưa có buổi học nào trên lớp ạ.");
  const note = input.note.trim();
  if (note) parts.push(note);
  parts.push(`Em cảm ơn ${input.parent} đã luôn đồng hành cùng con ạ!\n— ${input.teacher}`);
  return parts.join("\n");
}
