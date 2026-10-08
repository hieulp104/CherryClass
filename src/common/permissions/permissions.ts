/**
 * Phân quyền — MỌI kiểm tra quyền đi qua `can()` (quy ước QLNS). Không check `user.role` rải rác.
 *
 * TeamCherry chỉ có một cô giáo quản trị, nên khác QLNS: quyền là bảng tĩnh theo vai trò,
 * không có bảng role_permissions trong DB. Giai đoạn 2 thêm PARENT/STUDENT với phạm vi SELF.
 */

export type Role = "TEACHER" | "PARENT" | "STUDENT";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
};

export const PERMISSIONS = [
  "class.manage", // lớp, ca, lịch, buổi
  "student.manage",
  "student.privateNotes", // ghi chú riêng tư + cờ gia đình khó khăn
  "attendance.manage",
  "billing.manage", // phiếu thu, sửa tay, xác nhận thu
  "finance.view",
  "finance.manage", // khoản chi
  "settings.manage",
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

const ROLE_GRANTS: Record<Role, readonly PermissionCode[]> = {
  TEACHER: PERMISSIONS,
  PARENT: [],
  STUDENT: [],
};

export function can(user: SessionUser | null | undefined, permission: PermissionCode): boolean {
  if (!user) return false;
  return ROLE_GRANTS[user.role]?.includes(permission) ?? false;
}
