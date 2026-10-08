import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { unreadCount } from "@/modules/notifications/notifications.service";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const unread = await unreadCount(user.id);
  return (
    <AppShell displayName={user.displayName} unread={unread}>
      {children}
    </AppShell>
  );
}
