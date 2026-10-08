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
    select: { id: true, email: true, displayName: true, role: true },
  });
  return user;
}

/** Nạp lại thông tin tài khoản từ DB định kỳ để khóa tài khoản có hiệu lực mà không phải chờ hết phiên. */
const SESSION_REVALIDATE_MS = 5 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, displayName: true, passwordHash: true, isActive: true },
        });
        if (!user || !user.isActive) return null;
        if (!(await bcrypt.compare(parsed.data.password, user.passwordHash))) return null;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.displayName };
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
  return user?.id ? user : null;
}

/** Bắt buộc đăng nhập — dùng trong server action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
