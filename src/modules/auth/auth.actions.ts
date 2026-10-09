"use server";

import { AuthError } from "next-auth";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { changeOwnPassword, getCurrentUser, signIn, signOut, unstable_update } from "@/modules/auth/auth.service";
import { changePasswordSchema, loginSchema } from "@/modules/auth/auth.schema";

export type LoginState = { error?: string } | undefined;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ login: formData.get("login"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  try {
    // "/" tự chuyển tới trang chủ đúng vai trò (cô / học sinh / phụ huynh).
    await signIn("credentials", { ...parsed.data, redirectTo: "/" });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Tên đăng nhập hoặc mật khẩu chưa đúng. Thử lại giúp em nhé." };
    }
    // signIn ném NEXT_REDIRECT khi thành công — phải ném tiếp để Next chuyển trang.
    throw error;
  }
  return undefined;
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function changePasswordAction(input: unknown): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const res = await changeOwnPassword(user.id, parsed.data.current, parsed.data.next);
  if (!res.ok) return fail("VALIDATION_ERROR", "Mật khẩu hiện tại chưa đúng.");
  // Làm mới token để bỏ cờ "bắt đổi mật khẩu" ngay.
  await unstable_update({});
  return ok(null);
}
