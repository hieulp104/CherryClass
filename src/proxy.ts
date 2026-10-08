import NextAuth from "next-auth";

import { authConfig } from "@/modules/auth/auth.config";

/**
 * Next 16: "middleware" đổi tên thành "proxy".
 * Chỉ kiểm tra đã đăng nhập chưa; quyền chi tiết nằm ở page guard / server action.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|webp)$).*)"],
};
