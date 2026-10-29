import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { cache } from "react";

import type { SessionUser } from "@/common/permissions/permissions";
import { afterFailedLogin, ipBlocked, loginGate, recentFailures } from "@/modules/auth/auth.core";
import { authConfig } from "@/modules/auth/auth.config";
import { loginSchema } from "@/modules/auth/auth.schema";
import { prisma } from "@/shared/prisma/prisma.service";

/** Lý do từ chối đăng nhập mà form được phép nói rõ (code đi vào URL lỗi — không lộ gì nhạy cảm). */
export class LoginLocked extends CredentialsSignin {
  code = "locked";
}
export class LoginBusy extends CredentialsSignin {
  code = "busy";
}
export class TempPasswordExpired extends CredentialsSignin {
  code = "expired";
}

/** Lần sai theo IP — trong bộ nhớ (một máy chủ). Không có IP (chạy thẳng không qua proxy) thì bỏ qua. */
const ipFailures = new Map<string, number[]>();

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

function noteIpFailure(ip: string | null) {
  if (!ip) return;
  const now = Date.now();
  ipFailures.set(ip, [...recentFailures(ipFailures.get(ip) ?? [], now), now]);
  if (ipFailures.size > 5000) {
    for (const [k, v] of ipFailures) if (recentFailures(v, now).length === 0) ipFailures.delete(k);
  }
}

/**
 * So mật khẩu trong transaction có khóa dòng (FOR UPDATE): các lần thử cùng lúc vào một tài khoản
 * phải xếp hàng, nên không ai lách được ngưỡng khóa bằng cách gửi hàng trăm yêu cầu song song.
 */
async function verifyLogin(login: string, password: string): Promise<{ id: string; name: string } | null> {
  return prisma.$transaction(
    async (tx) => {
      const found = await tx.user.findFirst({
        where: { OR: [{ username: login }, { email: login }] },
        select: { id: true },
      });
      if (!found) return null;
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${found.id} FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({
        where: { id: found.id },
        select: {
          id: true,
          displayName: true,
          passwordHash: true,
          isActive: true,
          mustChangePassword: true,
          tempPasswordExpiresAt: true,
          failedLogins: true,
          lockedUntil: true,
        },
      });
      if (!user.isActive) return null;
      const now = new Date();
      const gate = loginGate(user, now);
      if (!gate.ok && gate.reason === "LOCKED") throw new LoginLocked();
      if (!(await bcrypt.compare(password, user.passwordHash))) {
        await tx.user.update({ where: { id: user.id }, data: afterFailedLogin(user.failedLogins, user.mustChangePassword, now) });
        return null;
      }
      // Đúng mật khẩu nhưng là mật khẩu tạm đã quá hạn → nhờ cô cấp lại (không tính là lần sai).
      if (!gate.ok) throw new TempPasswordExpired();
      await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now, failedLogins: 0, lockedUntil: null } });
      return { id: user.id, name: user.displayName };
    },
    { maxWait: 5000, timeout: 10000 },
  );
}

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
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const ip = clientIp(request);
        if (ip && ipBlocked(ipFailures.get(ip) ?? [], Date.now())) throw new LoginBusy();
        const user = await verifyLogin(parsed.data.login, parsed.data.password);
        if (!user) noteIpFailure(ip);
        return user;
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

/** Một request chỉ đọc phiên một lần — layout, guard và trang đều gọi hàm này (React.cache theo request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  const user = session?.user as unknown as SessionUser | undefined;
  return user?.id ? { ...user, childIds: user.childIds ?? [] } : null;
});

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
    data: { passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false, tempPasswordExpiresAt: null },
  });
  return { ok: true as const };
}
