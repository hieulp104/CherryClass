import { redirect } from "next/navigation";

import { can, type PermissionCode, type SessionUser } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";

/**
 * Chặn truy cập trang ở TẦNG SERVER. Ẩn menu chỉ là phụ.
 * @example const user = await requirePagePermission("billing.manage");
 */
export async function requirePagePermission(permission: PermissionCode): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, permission)) redirect("/login?loi=quyen");
  return user;
}
