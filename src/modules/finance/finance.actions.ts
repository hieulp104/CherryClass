"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { toDbDate } from "@/lib/dates";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

const expenseSchema = z.object({
  id: z.string().optional().nullable(),
  categoryId: z.string().min(1, "Cô chọn danh mục giúp em nhé"),
  amount: z.preprocess(
    (v) => Number(String(v ?? "").replace(/\D/g, "")),
    z.number().int().min(1, "Số tiền phải lớn hơn 0").max(1_000_000_000),
  ),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày chi chưa đúng"),
  note: z.string().trim().max(300).optional().nullable(),
});

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: fail("UNAUTHENTICATED") } as const;
  if (!can(user, "finance.manage")) return { ok: false, error: fail("PERMISSION_DENIED") } as const;
  return { ok: true, user } as const;
}

export async function saveExpenseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = expenseSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const { id, spentOn, note, ...d } = parsed.data;
  const data = { ...d, spentOn: toDbDate(spentOn), note: note || null };
  const row = await prisma.$transaction(async (tx) => {
    const before = id ? await tx.expense.findUnique({ where: { id } }) : null;
    const r = id ? await tx.expense.update({ where: { id }, data }) : await tx.expense.create({ data });
    await writeAuditLog(tx, {
      actorId: g.user.id,
      action: id ? "EXPENSE_UPDATE" : "EXPENSE_CREATE",
      entity: "Expense",
      entityId: r.id,
      before,
      after: r,
    });
    return r;
  });
  revalidatePath("/thong-ke");
  return ok({ id: row.id });
}

export async function deleteExpenseAction(id: string): Promise<ActionResult<null>> {
  const g = await guard();
  if (!g.ok) return g.error;
  await prisma.$transaction(async (tx) => {
    const r = await tx.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAuditLog(tx, { actorId: g.user.id, action: "EXPENSE_DELETE", entity: "Expense", entityId: id, before: r });
  });
  revalidatePath("/thong-ke");
  return ok(null);
}

/** Khôi phục khoản chi vừa xóa (nút Hoàn tác). */
export async function restoreExpenseAction(id: string): Promise<ActionResult<null>> {
  const g = await guard();
  if (!g.ok) return g.error;
  await prisma.expense.update({ where: { id }, data: { deletedAt: null } });
  revalidatePath("/thong-ke");
  return ok(null);
}

const categorySchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().trim().min(1, "Cô đặt tên danh mục giúp em").max(60),
  icon: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function saveCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const { id, ...data } = parsed.data;
  const row = id
    ? await prisma.expenseCategory.update({ where: { id }, data })
    : await prisma.expenseCategory.create({ data: { ...data, sortOrder: 99 } });
  revalidatePath("/thong-ke");
  revalidatePath("/cai-dat");
  return ok({ id: row.id });
}
