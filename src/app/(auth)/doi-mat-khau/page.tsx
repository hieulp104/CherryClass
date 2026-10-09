import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ChangePasswordScreen } from "@/modules/auth/components/change-password-screen";
import { getCurrentUser } from "@/modules/auth/auth.service";

export const metadata: Metadata = { title: "Đổi mật khẩu" };

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <ChangePasswordScreen name={user.displayName} forced={user.mustChangePassword} role={user.role} />;
}
