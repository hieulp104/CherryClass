"use client";

import { useActionState, useState } from "react";
import { motion } from "motion/react";
import { Eye, EyeOff, LogIn } from "lucide-react";

import { CherryIcon, Mascot } from "@/components/brand/mascot";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { loginAction, type LoginState } from "@/modules/auth/auth.actions";

const FLOATERS = [
  { left: "8%", top: "14%", size: 28, delay: 0 },
  { left: "82%", top: "10%", size: 22, delay: 0.8 },
  { left: "70%", top: "62%", size: 34, delay: 1.6 },
  { left: "14%", top: "70%", size: 20, delay: 0.4 },
  { left: "46%", top: "84%", size: 26, delay: 1.2 },
];

export function LoginScreen() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const [show, setShow] = useState(false);

  return (
    <main className="relative grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Khối thương hiệu */}
      <section className="bg-hero relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="sparkle-overlay absolute inset-0" />
        {FLOATERS.map((f, i) => (
          <motion.span
            key={i}
            className="absolute opacity-40"
            style={{ left: f.left, top: f.top }}
            animate={{ y: [0, -14, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 5, repeat: Infinity, delay: f.delay, ease: "easeInOut" }}
          >
            <CherryIcon size={f.size} />
          </motion.span>
        ))}
        <p className="relative text-xl font-extrabold text-white">TeamCherry</p>
        <div className="relative">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
            <Mascot mood="cheer" size={180} />
          </motion.div>
          <h1 className="mt-6 max-w-md text-4xl font-extrabold leading-tight text-white">
            Điểm danh xong trong 20 giây. Học phí tự đếm, không bao giờ sai.
          </h1>
          <p className="mt-3 max-w-md text-white/85">
            Để cô dành thời gian cho học trò — phần sổ sách, Bé Cherry lo ạ 🍒
          </p>
        </div>
        <p className="relative text-sm text-white/70">Dành riêng cho lớp của cô · {new Date().getFullYear()}</p>
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
            <h2 className="text-h1 font-extrabold tracking-tight">Chào cô quay lại!</h2>
            <p className="mt-1 text-sm text-muted">Đăng nhập để xem lớp hôm nay nhé.</p>

            <form action={action} className="mt-6 flex flex-col gap-4">
              <Field label="Email" htmlFor="email">
                <Input id="email" name="email" type="email" autoComplete="username" required placeholder="co.ha@teamcherry.vn" />
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
                Vào lớp thôi
              </Button>
            </form>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
