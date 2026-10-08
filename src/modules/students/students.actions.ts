"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { nextStudentCode, quickSearch, type QuickSearchItem } from "@/modules/students/students.service";
import { noteSchema, siblingGroupSchema, statusSchema, studentSchema } from "@/modules/students/students.schema";
import { toDbDate } from "@/lib/dates";
import { hueFromString, removeDiacritics } from "@/lib/utils";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ";
}

async function guard(permission: "student.manage" | "student.privateNotes" = "student.manage") {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: fail("UNAUTHENTICATED") } as const;
  if (!can(user, permission)) return { ok: false, error: fail("PERMISSION_DENIED") } as const;
  return { ok: true, user } as const;
}

export async function searchStudentsAction(q: string): Promise<QuickSearchItem[]> {
  const user = await getCurrentUser();
  if (!user || !can(user, "student.manage")) return [];
  return quickSearch(String(q ?? "").slice(0, 80));
}

export async function saveStudentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const { id, dob, joinedAt, ...d } = parsed.data;

  if (d.shiftId) {
    const shift = await prisma.shift.findUnique({ where: { id: d.shiftId }, select: { classroomId: true } });
    if (!shift || shift.classroomId !== d.classroomId) return fail("VALIDATION_ERROR", "Ca học không thuộc lớp đã chọn.");
  }

  const data = {
    ...d,
    searchName: removeDiacritics(d.fullName),
    dob: dob ? toDbDate(dob) : null,
    joinedAt: toDbDate(joinedAt),
  };

  const saved = await prisma.$transaction(async (tx) => {
    if (id) {
      const before = await tx.student.findUnique({ where: { id } });
      const row = await tx.student.update({ where: { id }, data });
      await writeAuditLog(tx, {
        actorId: g.user.id,
        action: before?.unitPrice !== row.unitPrice ? "STUDENT_UPDATE_PRICE" : "STUDENT_UPDATE",
        entity: "Student",
        entityId: id,
        before,
        after: row,
      });
      return row;
    }
    const code = await nextStudentCode(tx);
    const row = await tx.student.create({
      data: { ...data, code, avatarHue: hueFromString(`${code}${d.fullName}`) },
    });
    await writeAuditLog(tx, { actorId: g.user.id, action: "STUDENT_CREATE", entity: "Student", entityId: row.id, after: row });
    return row;
  });
  revalidatePath("/hoc-sinh");
  revalidatePath(`/hoc-sinh/${saved.id}`);
  return ok({ id: saved.id });
}

export async function setStudentStatusAction(input: unknown): Promise<ActionResult<null>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  await prisma.$transaction(async (tx) => {
    const before = await tx.student.findUnique({ where: { id: parsed.data.studentId }, select: { status: true } });
    await tx.student.update({
      where: { id: parsed.data.studentId },
      data: { status: parsed.data.status, statusChangedAt: new Date() },
    });
    await writeAuditLog(tx, {
      actorId: g.user.id,
      action: "STUDENT_STATUS",
      entity: "Student",
      entityId: parsed.data.studentId,
      before,
      after: { status: parsed.data.status },
    });
  });
  revalidatePath("/hoc-sinh");
  revalidatePath(`/hoc-sinh/${parsed.data.studentId}`);
  return ok(null);
}

export async function setHardshipAction(studentId: string, hardship: boolean): Promise<ActionResult<null>> {
  const g = await guard("student.privateNotes");
  if (!g.ok) return g.error;
  await prisma.$transaction(async (tx) => {
    await tx.student.update({ where: { id: studentId }, data: { hardship } });
    await writeAuditLog(tx, { actorId: g.user.id, action: "STUDENT_HARDSHIP", entity: "Student", entityId: studentId, after: { hardship } });
  });
  revalidatePath(`/hoc-sinh/${studentId}`);
  revalidatePath("/thu-tien");
  return ok(null);
}

export async function addNoteAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const g = await guard("student.privateNotes");
  if (!g.ok) return g.error;
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const note = await prisma.studentNote.create({ data: parsed.data });
  revalidatePath(`/hoc-sinh/${parsed.data.studentId}`);
  return ok({ id: note.id });
}

export async function deleteNoteAction(noteId: string): Promise<ActionResult<null>> {
  const g = await guard("student.privateNotes");
  if (!g.ok) return g.error;
  const note = await prisma.studentNote.delete({ where: { id: noteId } });
  revalidatePath(`/hoc-sinh/${note.studentId}`);
  return ok(null);
}

/** Tạo / sửa nhóm anh chị em. Mức giảm mới chỉ áp dụng cho phiếu phát hành SAU khi lưu. */
export async function saveSiblingGroupAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = siblingGroupSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const { id, studentIds, ...data } = parsed.data;

  const others = await prisma.student.findMany({
    where: { id: { in: studentIds }, siblingGroupId: { not: null }, NOT: id ? { siblingGroupId: id } : undefined },
    select: { fullName: true },
  });
  if (others.length > 0) {
    return fail("CONFLICT", `${others.map((o) => o.fullName).join(", ")} đã ở nhóm anh chị em khác. Cô gỡ khỏi nhóm cũ trước nhé.`);
  }

  const group = await prisma.$transaction(async (tx) => {
    const before = id ? await tx.siblingGroup.findUnique({ where: { id }, include: { students: { select: { id: true } } } }) : null;
    const row = id ? await tx.siblingGroup.update({ where: { id }, data }) : await tx.siblingGroup.create({ data });
    await tx.student.updateMany({ where: { siblingGroupId: row.id, id: { notIn: studentIds } }, data: { siblingGroupId: null } });
    await tx.student.updateMany({ where: { id: { in: studentIds } }, data: { siblingGroupId: row.id } });
    await writeAuditLog(tx, {
      actorId: g.user.id,
      action: id ? "SIBLING_GROUP_UPDATE" : "SIBLING_GROUP_CREATE",
      entity: "SiblingGroup",
      entityId: row.id,
      before,
      after: { ...row, studentIds },
    });
    return row;
  });
  revalidatePath("/hoc-sinh");
  revalidatePath("/cai-dat");
  for (const sid of studentIds) revalidatePath(`/hoc-sinh/${sid}`);
  return ok({ id: group.id });
}

export async function deleteSiblingGroupAction(id: string): Promise<ActionResult<null>> {
  const g = await guard();
  if (!g.ok) return g.error;
  await prisma.$transaction(async (tx) => {
    await tx.student.updateMany({ where: { siblingGroupId: id }, data: { siblingGroupId: null } });
    await tx.siblingGroup.delete({ where: { id } });
    await writeAuditLog(tx, { actorId: g.user.id, action: "SIBLING_GROUP_DELETE", entity: "SiblingGroup", entityId: id });
  });
  revalidatePath("/cai-dat");
  revalidatePath("/hoc-sinh");
  return ok(null);
}
