/**
 * Phân quyền — MỌI kiểm tra quyền đi qua `can()` / `canViewStudent()` (quy ước QLNS).
 * Không check `user.role` rải rác trong component.
 *
 * Quyền là bảng tĩnh theo vai trò (chỉ một cô giáo). Học sinh / phụ huynh thêm PHẠM VI:
 * chỉ xem được dữ liệu của chính mình / con mình — xem `canViewStudent`.
 */

export type Role = "TEACHER" | "PARENT" | "STUDENT";

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
  /** Tài khoản học sinh: id hồ sơ học sinh của chính em. */
  studentId: string | null;
  /** Tài khoản phụ huynh: id các con. */
  childIds: string[];
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
  "assignment.manage", // giao đề, chấm bài
  "account.manage", // cấp tài khoản học sinh / phụ huynh
  "portal.student", // giao diện học sinh khối 9
  "portal.parent", // giao diện phụ huynh
  "submission.submit", // nộp bài (học sinh, hoặc phụ huynh nộp hộ con)
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

const TEACHER_ONLY: PermissionCode[] = [
  "class.manage",
  "student.manage",
  "student.privateNotes",
  "attendance.manage",
  "billing.manage",
  "finance.view",
  "finance.manage",
  "settings.manage",
  "assignment.manage",
  "account.manage",
];

const ROLE_GRANTS: Record<Role, readonly PermissionCode[]> = {
  TEACHER: TEACHER_ONLY,
  STUDENT: ["portal.student", "submission.submit"],
  PARENT: ["portal.parent", "submission.submit"],
};

export function can(user: SessionUser | null | undefined, permission: PermissionCode): boolean {
  if (!user) return false;
  return ROLE_GRANTS[user.role]?.includes(permission) ?? false;
}

/**
 * Phạm vi SELF: cô xem được mọi em; học sinh chỉ xem chính mình; phụ huynh chỉ xem con mình.
 * Mọi service phía cổng học sinh/phụ huynh PHẢI gọi hàm này trước khi đọc dữ liệu của một em.
 */
export function canViewStudent(user: SessionUser | null | undefined, studentId: string): boolean {
  if (!user) return false;
  if (user.role === "TEACHER") return true;
  if (user.role === "STUDENT") return user.studentId === studentId;
  return user.childIds.includes(studentId);
}

/** Trang chủ theo vai trò — dùng sau đăng nhập và ở "/". */
export function homeFor(user: SessionUser): string {
  if (user.role === "STUDENT") return "/cua-em";
  if (user.role === "PARENT") return "/phu-huynh";
  return "/hom-nay";
}
