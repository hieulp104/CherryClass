import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import type { SessionUser } from "@/common/permissions/permissions";
import { authConfig } from "@/modules/auth/auth.config";
import { loginSchema } from "@/modules/auth/auth.schema";
import { prisma } from "@/shared/prisma/prisma.service";

async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      mustChangePassword: true,
      studentId: true,
      parentLinks: { select: { studentId: true } },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    studentId: user.studentId,
    childIds: user.parentLinks.map((l) => l.studentId),
  };
}

/** Nạp lại thông tin tài khoản định kỳ: khóa tài khoản / thêm con có hiệu lực mà không phải chờ hết phiên. */
const SESSION_REVALIDATE_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        login: { label: "Email / SĐT / mã học sinh", type: "text" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const login = parsed.data.login;
        const user = await prisma.user.findFirst({
          where: { OR: [{ username: login }, { email: login }] },
          select: { id: true, username: true, displayName: true, passwordHash: true, isActive: true },
        });
        if (!user || !user.isActive) return null;
        if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, name: user.displayName };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      const stale =
        typeof token.refreshedAt !== "number" || Date.now() - token.refreshedAt > SESSION_REVALIDATE_MS;
      if (user?.id || trigger === "update" || stale) {
        const id = user?.id ?? token.sub;
        if (id) {
          const sessionUser = await loadSessionUser(id);
          token.sub = sessionUser?.id ?? id;
          token.sessionUser = sessionUser ?? undefined;
          token.refreshedAt = Date.now();
        }
      }
      return token;
    },
    async session({ session, token }) {
      const sessionUser = token.sessionUser as SessionUser | undefined;
      session.user = (sessionUser
        ? { ...session.user, ...sessionUser }
        : { ...session.user, id: "" }) as typeof session.user;
      return session;
    },
  },
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const user = session?.user as unknown as SessionUser | undefined;
  return user?.id ? { ...user, childIds: user.childIds ?? [] } : null;
}

/** Bắt buộc đăng nhập — dùng trong server action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

/** Đổi mật khẩu của chính mình (phải đúng mật khẩu cũ). Xong thì bỏ cờ "bắt đổi mật khẩu". */
export async function changeOwnPassword(userId: string, current: string, next: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) return { ok: false as const, reason: "WRONG_CURRENT" as const };
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false },
  });
  return { ok: true as const };
}
