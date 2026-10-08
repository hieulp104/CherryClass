"use server";

import { getCurrentUser } from "@/modules/auth/auth.service";
import { prisma } from "@/shared/prisma/prisma.service";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function listNotificationsAction(): Promise<NotificationItem[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const rows = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    link: r.link,
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function markAllReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
}
