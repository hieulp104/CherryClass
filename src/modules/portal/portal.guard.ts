import { redirect } from "next/navigation";

import { canViewStudent, homeFor, type SessionUser } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { prisma } from "@/shared/prisma/prisma.service";

export type PortalContext = {
  user: SessionUser;
  /** Em đang xem (học sinh: chính em; phụ huynh: con được chọn). */
  studentId: string;
  /** Danh sách con để phụ huynh chuyển qua lại. */
  children: { id: string; name: string; avatarHue: number; classroom: string }[];
  base: "/cua-em" | "/phu-huynh";
};

/**
 * Cổng học sinh / phụ huynh: đăng nhập + đúng vai trò + PHẠM VI.
 * Phụ huynh chọn con qua `?con=<id>` — id không thuộc con mình thì quay về con đầu tiên, không báo lỗi lộ thông tin.
 */
export async function requirePortal(role: "STUDENT" | "PARENT", requestedChild?: string): Promise<PortalContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/doi-mat-khau");
  if (user.role !== role) redirect(homeFor(user));

  if (role === "STUDENT") {
    if (!user.studentId) redirect("/login");
    return { user, studentId: user.studentId, children: [], base: "/cua-em" };
  }

  const kids = await prisma.student.findMany({
    where: { id: { in: user.childIds }, deletedAt: null },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, avatarHue: true, classroom: { select: { name: true } } },
  });
  if (kids.length === 0) redirect("/login?loi=chua-lien-ket");
  const chosen = kids.find((k) => k.id === requestedChild && canViewStudent(user, k.id)) ?? kids[0];
  return {
    user,
    studentId: chosen.id,
    children: kids.map((k) => ({ id: k.id, name: k.fullName, avatarHue: k.avatarHue, classroom: k.classroom.name })),
    base: "/phu-huynh",
  };
}
