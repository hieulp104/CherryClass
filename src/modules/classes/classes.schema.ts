import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Giờ dạng 17:30");

export const classroomSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Cô đặt tên lớp giúp em nhé").max(60),
  grade: z.coerce.number().int().min(1).max(12),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#E11D48"),
});

export const scheduleSchema = z
  .object({ weekday: z.coerce.number().int().min(1).max(7), startTime: time, endTime: time })
  .refine((s) => s.endTime > s.startTime, { message: "Giờ kết thúc phải sau giờ bắt đầu", path: ["endTime"] });

export const shiftSchema = z.object({
  id: z.string().optional(),
  classroomId: z.string().min(1),
  name: z.string().trim().min(1, "Cô đặt tên ca giúp em nhé").max(60),
  room: z.string().trim().max(60).optional().nullable(),
  schedules: z.array(scheduleSchema).min(1, "Ca cần ít nhất một buổi trong tuần"),
});

export const cancelSessionSchema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().trim().min(1, "Cô ghi lý do nghỉ giúp em (vd: Nghỉ lễ, Cô ốm)").max(200),
});

export const createSessionSchema = z.object({
  shiftId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: time,
  endTime: time,
});
