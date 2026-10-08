import type { NextAuthConfig } from "next-auth";

/**
 * Cấu hình dùng chung cho CẢ proxy (edge runtime) và server.
 * ⚠ KHÔNG import Prisma / bcrypt vào file này — proxy chạy ở edge.
 */

/** Đường dẫn không cần đăng nhập. `/p/` là phiếu thu công khai cho phụ huynh. */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/_next") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/offline" ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.ico"
  );
}

export const authConfig = {
  pages: { signIn: "/login" },
  session: {
    strategy: "jwt",
    // Cô dùng điện thoại riêng, thao tác lúc đứng lớp — bắt đăng nhập lại mỗi ngày là phiền.
    maxAge: 30 * 24 * 60 * 60,
  },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      if (isPublicPath(request.nextUrl.pathname)) return true;
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
