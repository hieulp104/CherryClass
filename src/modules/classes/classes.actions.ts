"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { regenerateFutureSessions } from "@/modules/classes/classes.service";
import {
  cancelSessionSchema,
  classroomSchema,
  createSessionSchema,
  shiftSchema,
} from "@/modules/classes/classes.schema";
import { toDbDate } from "@/lib/dates";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ";
}

export async function saveClassroomAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "class.manage")) return fail("PERMISSION_DENIED");
  const parsed = classroomSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const { id, ...data } = parsed.data;

  const saved = await prisma.$transaction(async (tx) => {
    const before = id ? await tx.classroom.findUnique({ where: { id } }) : null;
    const row = id ? await tx.classroom.update({ where: { id }, data }) : await tx.classroom.create({ data });
    await writeAuditLog(tx, {
      actorId: user.id,
      action: id ? "CLASSROOM_UPDATE" : "CLASSROOM_CREATE",
      entity: "Classroom",
      entityId: row.id,
      before,
      after: row,
    });
    return row;
  });
  revalidatePath("/lop-hoc");
  return ok({ id: saved.id });
}

export async function archiveClassroomAction(id: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "class.manage")) return fail("PERMISSION_DENIED");
  const active = await prisma.student.count({ where: { classroomId: id, status: "ACTIVE", deletedAt: null } });
  if (active > 0) {
    return fail("CONFLICT", `Lớp còn ${active} em đang học. Cô chuyển các em sang lớp khác hoặc cho nghỉ trước nhé.`);
  }
  await prisma.$transaction(async (tx) => {
    const row = await tx.classroom.update({ where: { id }, data: { archivedAt: new Date() } });
    await writeAuditLog(tx, { actorId: user.id, action: "CLASSROOM_ARCHIVE", entity: "Classroom", entityId: id, after: row });
  });
  revalidatePath("/lop-hoc");
  return ok(null);
}

export async function saveShiftAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "class.manage")) return fail("PERMISSION_DENIED");
  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const { id, schedules, ...data } = parsed.data;

  const dupKeys = new Set(schedules.map((s) => `${s.weekday}-${s.startTime}`));
  if (dupKeys.size !== schedules.length) return fail("VALIDATION_ERROR", "Có hai buổi trùng ngày và giờ trong lịch.");

  const saved = await prisma.$transaction(async (tx) => {
    const before = id ? await tx.shift.findUnique({ where: { id }, include: { schedules: true } }) : null;
    const shift = id
      ? await tx.shift.update({ where: { id }, data: { name: data.name, room: data.room ?? null } })
      : await tx.shift.create({ data: { classroomId: data.classroomId, name: data.name, room: data.room ?? null } });
    await tx.shiftSchedule.deleteMany({ where: { shiftId: shift.id } });
    await tx.shiftSchedule.createMany({ data: schedules.map((s) => ({ ...s, shiftId: shift.id })) });
    await regenerateFutureSessions(tx, shift.id);
    await writeAuditLog(tx, {
      actorId: user.id,
      action: id ? "SHIFT_UPDATE" : "SHIFT_CREATE",
      entity: "Shift",
      entityId: shift.id,
      before,
      after: { ...shift, schedules },
    });
    return shift;
  });
  revalidatePath("/lop-hoc");
  revalidatePath("/hom-nay");
  return ok({ id: saved.id });
}

export async function deactivateShiftAction(id: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "class.manage")) return fail("PERMISSION_DENIED");
  const active = await prisma.student.count({ where: { shiftId: id, status: "ACTIVE", deletedAt: null } });
  if (active > 0) return fail("CONFLICT", `Ca còn ${active} em. Cô chuyển các em sang ca khác trước nhé.`);
  await prisma.$transaction(async (tx) => {
    await tx.shift.update({ where: { id }, data: { active: false } });
    await tx.session.deleteMany({ where: { shiftId: id, status: "SCHEDULED", attendances: { none: {} } } });
    await writeAuditLog(tx, { actorId: user.id, action: "SHIFT_DEACTIVATE", entity: "Shift", entityId: id });
  });
  revalidatePath("/lop-hoc");
  return ok(null);
}

/** Hủy buổi một chạm (nghỉ lễ, cô ốm). Buổi đã điểm danh thì không hủy được. */
export async function cancelSessionAction(input: unknown): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "class.manage")) return fail("PERMISSION_DENIED");
  const parsed = cancelSessionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));

  const session = await prisma.session.findUnique({
    where: { id: parsed.data.sessionId },
    include: { _count: { select: { attendances: true } } },
  });
  if (!session) return fail("NOT_FOUND");
  if (session.status === "COMPLETED" || session._count.attendances > 0) {
    return fail("CONFLICT", "Buổi này đã điểm danh nên không hủy được. Cô sửa điểm danh nếu cần nhé.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: session.id },
      data: { status: "CANCELLED", cancelReason: parsed.data.reason },
    });
    await writeAuditLog(tx, {
      actorId: user.id,
      action: "SESSION_CANCEL",
      entity: "Session",
      entityId: session.id,
      reason: parsed.data.reason,
    });
  });
  revalidatePath("/lop-hoc");
  revalidatePath("/hom-nay");
  return ok(null);
}

export async function restoreSessionAction(sessionId: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "class.manage")) return fail("PERMISSION_DENIED");
  await prisma.$transaction(async (tx) => {
    await tx.session.update({ where: { id: sessionId }, data: { status: "SCHEDULED", cancelReason: null } });
    await writeAuditLog(tx, { actorId: user.id, action: "SESSION_RESTORE", entity: "Session", entityId: sessionId });
  });
  revalidatePath("/lop-hoc");
  revalidatePath("/hom-nay");
  return ok(null);
}

/** Thêm buổi ngoài lịch (học bù cả ca, dạy thêm buổi). */
export async function createExtraSessionAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "class.manage")) return fail("PERMISSION_DENIED");
  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const { shiftId, date, startTime, endTime } = parsed.data;
  const exists = await prisma.session.findUnique({
    where: { shiftId_date_startTime: { shiftId, date: toDbDate(date), startTime } },
  });
  if (exists) return fail("CONFLICT", "Ca này đã có buổi đúng ngày giờ đó rồi ạ.");
  const row = await prisma.$transaction(async (tx) => {
    const s = await tx.session.create({ data: { shiftId, date: toDbDate(date), startTime, endTime } });
    await writeAuditLog(tx, { actorId: user.id, action: "SESSION_CREATE_EXTRA", entity: "Session", entityId: s.id, after: s });
    return s;
  });
  revalidatePath("/lop-hoc");
  revalidatePath("/hom-nay");
  return ok({ id: row.id });
}
