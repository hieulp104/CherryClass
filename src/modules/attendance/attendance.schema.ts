import { z } from "zod";

export const attendanceEntrySchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["PRESENT", "EXCUSED", "UNEXCUSED"]),
  note: z.string().trim().max(200).optional().nullable(),
  isMakeup: z.boolean().default(false),
});

/**
 * Gửi TRẠNG THÁI CUỐI của mọi em đang hiện trên màn hình (không gửi chuỗi thao tác).
 * Nhờ vậy gửi lại nhiều lần (mất mạng, bấm hai lần) vẫn ra cùng kết quả.
 */
export const finalizeSessionSchema = z.object({
  sessionId: z.string().min(1),
  entries: z.array(attendanceEntrySchema).max(200),
  /** UUID của lần gửi — chỉ để ghi log đồng bộ offline. */
  clientOpId: z.string().max(64).optional(),
});

export type AttendanceEntry = z.infer<typeof attendanceEntrySchema>;
export type FinalizeSessionInput = z.infer<typeof finalizeSessionSchema>;
