import { redirect } from "next/navigation";

import { can, homeFor, type PermissionCode, type SessionUser } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";

/**
 * Chặn truy cập trang ở TẦNG SERVER. Ẩn menu chỉ là phụ.
 * - Chưa đăng nhập → /login
 * - Tài khoản cô vừa cấp chưa đổi mật khẩu → /doi-mat-khau
 * - Sai vai trò (vd học sinh mở trang của cô) → về trang chủ của vai trò đó
 * @example const user = await requirePagePermission("billing.manage");
 */
export async function requirePagePermission(permission: PermissionCode): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/doi-mat-khau");
  if (!can(user, permission)) redirect(homeFor(user));
  return user;
}
