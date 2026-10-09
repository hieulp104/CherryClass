import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

import type { Prisma } from "@/generated/prisma/client";
import type { Credential } from "@/modules/accounts/accounts.message";
import { normalizeLogin } from "@/modules/auth/auth.schema";
import { PHONE_PATTERN } from "@/lib/utils";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

type Tx = Prisma.TransactionClient;

/** Mật khẩu tạm dễ đọc qua tin nhắn: "cherry" + 4 số. Bắt đổi ở lần đăng nhập đầu. */
export function tempPassword(): string {
  return `cherry${String(randomInt(0, 10_000)).padStart(4, "0")}`;
}

export type { Credential };

export class AccountError extends Error {}

/** Học sinh: đăng nhập bằng SĐT của em nếu có (và chưa ai dùng), không thì bằng mã học sinh. */
export async function createStudentAccount(tx: Tx, studentId: string, actorId: string): Promise<Credential> {
  const s = await tx.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { id: true, code: true, fullName: true, studentPhone: true, account: { select: { id: true } } },
  });
  if (s.account) throw new AccountError(`${s.fullName} đã có tài khoản rồi ạ.`);
  let username = s.code.toLowerCase();
  if (s.studentPhone && PHONE_PATTERN.test(s.studentPhone)) {
    const taken = await tx.user.findUnique({ where: { username: normalizeLogin(s.studentPhone) } });
    if (!taken) username = normalizeLogin(s.studentPhone);
  }
  const password = tempPassword();
  const user = await tx.user.create({
    data: {
      username,
      displayName: s.fullName,
      role: "STUDENT",
      studentId: s.id,
      mustChangePassword: true,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  await writeAuditLog(tx, { actorId, action: "ACCOUNT_CREATE_STUDENT", entity: "User", entityId: user.id, after: { username, studentId } });
  return { kind: "STUDENT", studentId: s.id, studentName: s.fullName, displayName: s.fullName, username, password };
}

/**
 * Phụ huynh: đăng nhập bằng SĐT phụ huynh. Anh chị em cùng SĐT dùng CHUNG một tài khoản —
 * nếu đã có thì chỉ liên kết thêm con.
 */
export async function createParentAccount(tx: Tx, studentId: string, actorId: string): Promise<Credential> {
  const s = await tx.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { id: true, fullName: true, parentName: true, parentPhone: true, parentLinks: { select: { userId: true } } },
  });
  if (!s.parentPhone || !PHONE_PATTERN.test(s.parentPhone)) {
    throw new AccountError(`${s.fullName} chưa có SĐT phụ huynh hợp lệ. Cô thêm SĐT trong thông tin của em trước nhé.`);
  }
  if (s.parentLinks.length > 0) throw new AccountError(`Phụ huynh của ${s.fullName} đã có tài khoản rồi ạ.`);
  const username = normalizeLogin(s.parentPhone);
  const existing = await tx.user.findUnique({ where: { username } });
  if (existing && existing.role !== "PARENT") {
    throw new AccountError(`SĐT ${username} đang là tài khoản của người khác (không phải phụ huynh).`);
  }
  const displayName = s.parentName?.trim() || `Phụ huynh ${s.fullName.split(" ").at(-1)}`;
  if (existing) {
    await tx.parentLink.create({ data: { userId: existing.id, studentId: s.id } });
    await writeAuditLog(tx, { actorId, action: "ACCOUNT_LINK_PARENT", entity: "User", entityId: existing.id, after: { studentId } });
    return { kind: "PARENT", studentId: s.id, studentName: s.fullName, displayName: existing.displayName, username, password: null };
  }
  const password = tempPassword();
  const user = await tx.user.create({
    data: {
      username,
      displayName,
      role: "PARENT",
      mustChangePassword: true,
      passwordHash: await bcrypt.hash(password, 10),
      parentLinks: { create: { studentId: s.id } },
    },
  });
  await writeAuditLog(tx, { actorId, action: "ACCOUNT_CREATE_PARENT", entity: "User", entityId: user.id, after: { username, studentId } });
  return { kind: "PARENT", studentId: s.id, studentName: s.fullName, displayName, username, password };
}

/** Tài khoản đang gắn với một em (để hiện trong sổ tay). */
export async function accountsOfStudent(studentId: string) {
  const [student, parents] = await Promise.all([
    prisma.user.findUnique({
      where: { studentId },
      select: { id: true, username: true, isActive: true, lastLoginAt: true, mustChangePassword: true },
    }),
    prisma.user.findMany({
      where: { parentLinks: { some: { studentId } } },
      select: {
        id: true,
        username: true,
        displayName: true,
        isActive: true,
        lastLoginAt: true,
        mustChangePassword: true,
        parentLinks: { select: { student: { select: { fullName: true } } } },
      },
    }),
  ]);
  return { student, parents };
}

export type StudentAccounts = Awaited<ReturnType<typeof accountsOfStudent>>;
