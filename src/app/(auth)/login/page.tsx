import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginScreen } from "@/modules/auth/components/login-screen";
import { getCurrentUser } from "@/modules/auth/auth.service";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return <LoginScreen />;
}
