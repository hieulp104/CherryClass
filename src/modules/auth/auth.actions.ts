"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/modules/auth/auth.service";
import { loginSchema } from "@/modules/auth/auth.schema";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/hom-nay" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email hoặc mật khẩu chưa đúng. Cô thử lại giúp em nhé." };
    }
    // signIn ném NEXT_REDIRECT khi thành công — phải ném tiếp để Next chuyển trang.
    throw error;
  }
  return undefined;
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
