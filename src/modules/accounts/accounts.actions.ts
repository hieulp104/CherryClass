"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can } from "@/common/permissions/permissions";
import {
  AccountError,
  createParentAccount,
  createStudentAccount,
  tempPassword,
  type Credential,
} from "@/modules/accounts/accounts.service";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: fail("UNAUTHENTICATED") } as const;
  if (!can(user, "account.manage")) return { ok: false, error: fail("PERMISSION_DENIED") } as const;
  return { ok: true, user } as const;
}

export async function createAccountAction(input: { studentId: string; kind: "STUDENT" | "PARENT" }): Promise<ActionResult<Credential>> {
  const g = await guard();
  if (!g.ok) return g.error;
  try {
    const cred = await prisma.$transaction((tx) =>
      input.kind === "STUDENT" ? createStudentAccount(tx, input.studentId, g.user.id) : createParentAccount(tx, input.studentId, g.user.id),
    );
    revalidatePath(`/hoc-sinh/${input.studentId}`);
    return ok(cred);
  } catch (e) {
    if (e instanceof AccountError) return fail("CONFLICT", e.message);
    throw e;
  }
}

/**
 * Cấp tài khoản cho cả lớp một lần: khối 9 → tài khoản học sinh; khối 8 → tài khoản phụ huynh.
 * Em nào đã có / thiếu SĐT thì bỏ qua và báo lại — không làm hỏng cả đợt.
 */
export async function createClassAccountsAction(classroomId: string): Promise<ActionResult<{ created: Credential[]; skipped: string[] }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const classroom = await prisma.classroom.findUnique({ where: { id: classroomId } });
  if (!classroom) return fail("NOT_FOUND");
  const kind = classroom.grade >= 9 ? "STUDENT" : "PARENT";
  const students = await prisma.student.findMany({
    where: { classroomId, status: "ACTIVE", deletedAt: null },
    orderBy: { fullName: "asc" },
    select: { id: true },
  });
  const created: Credential[] = [];
  const skipped: string[] = [];
  for (const s of students) {
    try {
      created.push(
        await prisma.$transaction((tx) =>
          kind === "STUDENT" ? createStudentAccount(tx, s.id, g.user.id) : createParentAccount(tx, s.id, g.user.id),
        ),
      );
    } catch (e) {
      if (e instanceof AccountError) skipped.push(e.message);
      else throw e;
    }
  }
  revalidatePath("/lop-hoc");
  return ok({ created, skipped });
}

export async function resetPasswordAction(userId: string): Promise<ActionResult<{ username: string; password: string }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role === "TEACHER") return fail("NOT_FOUND");
  const password = tempPassword();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true, isActive: true },
    });
    await writeAuditLog(tx, { actorId: g.user.id, action: "ACCOUNT_RESET_PASSWORD", entity: "User", entityId: userId });
  });
  return ok({ username: target.username, password });
}

export async function setAccountActiveAction(userId: string, active: boolean): Promise<ActionResult<null>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.role === "TEACHER") return fail("NOT_FOUND");
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { isActive: active } });
    await writeAuditLog(tx, { actorId: g.user.id, action: active ? "ACCOUNT_UNLOCK" : "ACCOUNT_LOCK", entity: "User", entityId: userId });
  });
  if (target.studentId) revalidatePath(`/hoc-sinh/${target.studentId}`);
  return ok(null);
}
