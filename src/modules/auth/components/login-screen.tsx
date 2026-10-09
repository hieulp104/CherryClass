"use client";

import { useActionState, useState } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff, LogIn } from "lucide-react";

import { LoginScene } from "@/components/brand/login-scene";
import { Mascot } from "@/components/brand/mascot";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { loginAction, type LoginState } from "@/modules/auth/auth.actions";


export function LoginScreen() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const [show, setShow] = useState(false);

  return (
    <main className="relative grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Khối thương hiệu: tranh con đường lên đỉnh + câu châm ngôn ở giữa */}
      <section className="relative hidden overflow-hidden lg:flex lg:items-center lg:justify-center lg:p-12">
        <LoginScene className="absolute inset-0 size-full" />
        <p className="absolute left-12 top-10 text-xl font-extrabold text-white">TeamCherry</p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 160, damping: 20, delay: 0.15 }}
          className="relative -mt-24 max-w-lg text-center text-4xl font-extrabold leading-tight text-white drop-shadow-[0_2px_12px_rgb(159_18_57/0.35)] xl:text-5xl"
        >
          Trên con đường thành công không có dấu chân của kẻ lười biếng.
        </motion.h1>
      </section>

      {/* Form */}
      <section className="bg-soft flex items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="w-full max-w-sm"
        >
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <Mascot mood="happy" size={120} />
            <p className="mt-2 text-2xl font-extrabold">
              Team<span className="text-primary">Cherry</span>
            </p>
          </div>
          <div className="rounded-sheet border border-line bg-surface p-6 shadow-pop sm:p-8">
            <h2 className="text-h1 font-extrabold tracking-tight">Đăng nhập</h2>

            <form action={action} className="mt-6 flex flex-col gap-4">
              <Field label="Tên đăng nhập" htmlFor="login">
                <Input id="login" name="login" type="text" autoComplete="username" autoCapitalize="none" required />
              </Field>
              <Field label="Mật khẩu" htmlFor="password">
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute inset-y-0 right-1 grid w-10 place-items-center text-muted"
                  >
                    {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </Field>
              {state?.error && (
                <motion.p
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }}
                  className="rounded-control bg-overdue-soft px-3 py-2 text-sm font-medium text-overdue"
                >
                  {state.error}
                </motion.p>
              )}
              <Button type="submit" size="lg" block loading={pending}>
                {!pending && <LogIn className="size-5" />}
                Đăng nhập
              </Button>
            </form>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
