import { prisma } from "@/shared/prisma/prisma.service";

/** Số thông báo chưa đọc. Để ở service (không phải "use server") — không được thành action gọi từ ngoài. */
/** Thông báo mới nhất — để app đang mở biết có việc mới (tiền về…) mà không cần tải lại trang. */
export async function latestNotification(userId: string) {
  return prisma.notification.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, title: true },
  });
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
