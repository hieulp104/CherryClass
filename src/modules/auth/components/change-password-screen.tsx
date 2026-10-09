"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { KeyRound } from "lucide-react";

import { Mascot } from "@/components/brand/mascot";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { changePasswordAction, logoutAction } from "@/modules/auth/auth.actions";
import { givenName } from "@/lib/utils";

export function ChangePasswordScreen({ name, forced, role }: { name: string; forced: boolean; role: "TEACHER" | "STUDENT" | "PARENT" }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const greet = role === "STUDENT" ? `Chào ${givenName(name)}!` : role === "PARENT" ? `Chào ${name}!` : "Đổi mật khẩu";

  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      const res = await changePasswordAction({ current: fd.get("current"), next: fd.get("next"), confirm: fd.get("confirm") });
      if (!res.ok) return setError(res.message);
      // Tải lại toàn trang để phiên mới (đã bỏ cờ bắt đổi mật khẩu) có hiệu lực.
      window.location.href = "/";
    });

  return (
    <main className="bg-soft flex min-h-dvh items-center justify-center px-5 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="mb-4 flex flex-col items-center text-center">
          <Mascot mood="cheer" size={110} />
          <h1 className="mt-2 text-h1 font-extrabold">{greet}</h1>
          <p className="mt-1 text-muted">
            {forced ? "Lần đầu vào app, mình đặt mật khẩu riêng nhé — chỉ mình bạn biết thôi." : "Đặt mật khẩu mới cho tài khoản."}
          </p>
        </div>
        <form action={submit} className="space-y-4 rounded-sheet border border-line bg-surface p-6 shadow-pop">
          <Field label={forced ? "Mật khẩu tạm cô gửi" : "Mật khẩu hiện tại"}>
            <Input name="current" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="Mật khẩu mới" hint="Ít nhất 6 ký tự">
            <Input name="next" type="password" autoComplete="new-password" required minLength={6} />
          </Field>
          <Field label="Nhập lại mật khẩu mới">
            <Input name="confirm" type="password" autoComplete="new-password" required />
          </Field>
          {error && <Notice tone="overdue">{error}</Notice>}
          <Button type="submit" size="lg" block loading={pending}>
            {!pending && <KeyRound className="size-5" />} Lưu mật khẩu
          </Button>
        </form>
        <form action={logoutAction} className="mt-3 text-center">
          <button type="submit" className="text-sm font-semibold text-muted hover:text-foreground">
            Đăng xuất
          </button>
        </form>
      </motion.div>
    </main>
  );
}
