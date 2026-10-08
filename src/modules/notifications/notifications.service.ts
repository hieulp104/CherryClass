import { prisma } from "@/shared/prisma/prisma.service";

/** Số thông báo chưa đọc. Để ở service (không phải "use server") — không được thành action gọi từ ngoài. */
export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
