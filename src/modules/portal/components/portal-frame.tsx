"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { BookOpenCheck, Home, KeyRound, LogOut, Sprout, Star, Wallet, type LucideIcon } from "lucide-react";

import { BrandLogo } from "@/components/brand/mascot";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { StudentAvatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";
import { logoutAction } from "@/modules/auth/auth.actions";
import { cn, givenName } from "@/lib/utils";

export type FrameProps = {
  base: "/cua-em" | "/phu-huynh";
  displayName: string;
  studentId: string;
  children: { id: string; name: string; avatarHue: number; classroom: string }[];
};

/** Thêm ?con= cho link phía phụ huynh để giữ đúng con đang xem. */
export function portalHref(frame: Pick<FrameProps, "base" | "studentId" | "children">, path = "") {
  const url = `${frame.base}${path}`;
  return frame.base === "/phu-huynh" && frame.children.length > 1 ? `${url}?con=${frame.studentId}` : url;
}

export function PortalFrame({ frame, children }: { frame: FrameProps; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const isParent = frame.base === "/phu-huynh";
  const nav: { path: string; label: string; icon: LucideIcon }[] = isParent
    ? [
        { path: "", label: "Tổng quan", icon: Home },
        { path: "/bai-tap", label: "Bài tập", icon: BookOpenCheck },
        { path: "/diem", label: "Điểm", icon: Star },
        { path: "/hoc-phi", label: "Học phí", icon: Wallet },
      ]
    : [
        { path: "", label: "Của em", icon: Home },
        { path: "/bai-tap", label: "Bài tập", icon: BookOpenCheck },
        { path: "/vuon", label: "Vườn", icon: Sprout },
        { path: "/diem", label: "Điểm", icon: Star },
      ];
  const active = (path: string) => (path ? pathname.startsWith(`${frame.base}${path}`) : pathname === frame.base);

  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
          <Link href={portalHref(frame)} className="mr-auto">
            <BrandLogo />
          </Link>
          <button type="button" onClick={() => setMenu(true)} aria-label="Tài khoản" className="rounded-full active:scale-95">
            <StudentAvatar name={frame.displayName} hue={isParent ? 200 : (frame.children[0]?.avatarHue ?? 340)} size={36} />
          </button>
        </div>
        {isParent && frame.children.length > 1 && (
          <div className="no-scrollbar mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 pb-2.5">
            {frame.children.map((c) => (
              <Link
                key={c.id}
                href={`${pathname}?con=${c.id}`}
                className={cn(
                  "relative flex shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold",
                  c.id === frame.studentId ? "text-primary-deep" : "text-muted",
                )}
              >
                {c.id === frame.studentId && (
                  <motion.span layoutId="child-pill" className="absolute inset-0 rounded-full bg-primary-soft" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                )}
                <StudentAvatar name={c.name} hue={c.avatarHue} size={28} className="relative" />
                <span className="relative">
                  {givenName(c.name)} · {c.classroom}
                </span>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Hiệu ứng chuyển trang chỉ trên phần nội dung — transform ở tổ tiên sẽ làm hỏng thanh điều hướng `fixed`. */}
      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="mx-auto w-full max-w-3xl px-4 pb-32 pt-4"
      >
        {children}
      </motion.main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/90 backdrop-blur-lg">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-4 items-center">
          {nav.map((item) => {
            const on = active(item.path);
            return (
              <Link key={item.path} href={portalHref(frame, item.path)} className="relative flex flex-col items-center gap-0.5 py-1.5">
                {on && (
                  <motion.span layoutId="portal-tab" className="absolute top-0.5 h-8 w-14 rounded-full bg-primary-soft" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                )}
                <motion.span animate={on ? { y: [0, -3, 0] } : { y: 0 }} className="relative">
                  <item.icon className={cn("size-[22px]", on ? "text-primary" : "text-muted")} strokeWidth={on ? 2.4 : 2} />
                </motion.span>
                <span className={cn("relative text-[11px] font-semibold", on ? "text-primary-deep" : "text-muted")}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <Sheet open={menu} onClose={() => setMenu(false)} title={frame.displayName} size="sm">
        <div className="space-y-2 pb-2">
          <div className="flex items-center justify-between rounded-card bg-surface-subtle p-3">
            <span className="font-semibold">Giao diện</span>
            <ThemeToggle withLabel />
          </div>
          <Link href="/doi-mat-khau" className="flex items-center gap-3 rounded-control border border-line px-4 py-3 font-semibold">
            <KeyRound className="size-5 text-muted" /> Đổi mật khẩu
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-control py-3 font-semibold text-overdue hover:bg-overdue-soft">
              <LogOut className="size-4" /> Đăng xuất
            </button>
          </form>
        </div>
      </Sheet>
    </div>
  );
}
