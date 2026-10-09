import { redirect } from "next/navigation";

import { homeFor } from "@/common/permissions/permissions";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { unreadCount } from "@/modules/notifications/notifications.service";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/doi-mat-khau");
  // Khu của cô giáo — học sinh / phụ huynh về cổng riêng của mình.
  if (user.role !== "TEACHER") redirect(homeFor(user));
  const unread = await unreadCount(user.id);
  return (
    <AppShell displayName={user.displayName} unread={unread}>
      {children}
    </AppShell>
  );
}
