"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { BookOpenCheck, Home, KeyRound, LogOut, Sprout, Star, Wallet } from "lucide-react";

import { BrandLogo, Mascot } from "@/components/brand/mascot";
import { SideLink, UserMenu, type NavItem } from "@/components/layout/app-shell";
import { LogoutForm } from "@/components/layout/logout-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { StudentAvatar } from "@/components/ui/avatar";
import { PingBadge } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { portalHref } from "@/modules/portal/portal.links";
import { cn, givenName } from "@/lib/utils";

export { portalHref };

export type FrameProps = {
  base: "/cua-em" | "/phu-huynh";
  displayName: string;
  studentId: string;
  children: { id: string; name: string; avatarHue: number; classroom: string; feesDue?: number }[];
};

/**
 * Khung cổng học sinh / phụ huynh — cùng dáng với khung của cô (thanh bên + thanh trên trên máy tính,
 * thanh dưới trên điện thoại), chỉ ít mục hơn.
 */
export function PortalFrame({ frame, children }: { frame: FrameProps; children: React.ReactNode }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const isParent = frame.base === "/phu-huynh";
  const current = frame.children.find((c) => c.id === frame.studentId) ?? frame.children[0];
  const hue = isParent ? 200 : (current?.avatarHue ?? 340);

  const nav: (NavItem & { path: string })[] = (
    isParent
      ? [
          { href: "", label: "Tổng quan", icon: Home },
          { href: "/bai-tap", label: "Bài tập", icon: BookOpenCheck },
          { href: "/diem", label: "Điểm", icon: Star },
          {
            href: "/hoc-phi",
            label: "Học phí",
            icon: Wallet,
            badge: current?.feesDue ? { count: current.feesDue, label: `${current.feesDue} phiếu cần đóng` } : undefined,
          },
        ]
      : [
          { href: "", label: "Của em", icon: Home },
          { href: "/bai-tap", label: "Bài tập", icon: BookOpenCheck },
          { href: "/vuon", label: "Vườn cherry", icon: Sprout },
          { href: "/diem", label: "Điểm", icon: Star },
        ]
  ).map((n) => ({ ...n, path: n.href, href: portalHref(frame, n.href) }));
  const active = (path: string) => (path ? pathname.startsWith(`${frame.base}${path}`) : pathname === frame.base);
  // Đổi con khi đang mở một phiếu / một bài: về trang danh sách của mục đó (id cũ là của con kia).
  const section = pathname.split("/").slice(0, 3).join("/");
  const switchHref = (id: string) => `${section}?con=${id}`;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      {/* ───── Thanh bên máy tính ───── */}
      <aside className="sidebar-wash sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line px-3 py-4 lg:flex">
        <Link href={portalHref(frame)} className="pl-2" aria-label="TeamCherry — trang chủ">
          <BrandLogo />
        </Link>

        {isParent ? (
          <nav aria-label="Chọn con" className="mt-6">
            <p className="mb-1.5 px-3 text-caption font-semibold text-muted">Con của tôi</p>
            <ul className="space-y-1">
              {frame.children.map((c) => {
                const on = c.id === frame.studentId;
                return (
                  <li key={c.id}>
                    <Link
                      href={switchHref(c.id)}
                      aria-current={on ? "true" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-card border p-2.5 transition-colors",
                        on ? "border-primary/30 bg-surface shadow-card" : "border-transparent hover:bg-surface/60",
                      )}
                    >
                      <StudentAvatar name={c.name} hue={c.avatarHue} size={36} />
                      <span className="min-w-0 leading-tight">
                        <span className={cn("block truncate text-sm font-bold", on ? "text-foreground" : "text-muted")}>{givenName(c.name)}</span>
                        <span className="block text-caption text-muted">{c.classroom}</span>
                      </span>
                      <PingBadge count={c.feesDue ?? 0} label={`${c.feesDue} phiếu học phí cần đóng`} className="ml-auto" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : (
          <div className="mt-6 flex items-center gap-3 rounded-card bg-surface p-2.5 shadow-card">
            <StudentAvatar name={frame.displayName} hue={hue} size={40} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold">{frame.displayName}</span>
              <span className="block text-caption text-muted">{current?.classroom ?? "Học sinh"}</span>
            </span>
          </div>
        )}

        <nav aria-label="Điều hướng chính" className="mt-6 flex flex-col gap-0.5">
          {nav.map((item) => (
            <SideLink key={item.path} item={item} active={active(item.path)} collapsed={false} />
          ))}
        </nav>

        <div className="mt-auto flex items-end gap-2 rounded-card bg-surface/70 p-3 text-caption text-muted shadow-card">
          <Mascot mood="happy" size={44} />
          <p className="pb-1">
            {isParent ? "Bấm vào một bài để xem điểm và nhận xét của cô." : "Nộp bài đúng hạn để vườn cherry thêm quả."}
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Thanh trên máy tính */}
        <header className="sticky top-0 z-30 hidden h-16 items-center gap-1 border-b border-line/60 bg-background/75 px-10 backdrop-blur-xl lg:flex">
          <p className="mr-auto text-sm text-muted">
            {isParent && current ? (
              <>
                Đang xem: <span className="font-semibold text-foreground">{givenName(current.name)}</span> · {current.classroom}
              </>
            ) : (
              nav.find((n) => active(n.path))?.label
            )}
          </p>
          <ThemeToggle className="text-foreground" />
          <UserMenu displayName={frame.displayName} roleLabel={isParent ? "Phụ huynh" : "Học sinh"} hue={hue} />
        </header>

        {/* Thanh trên điện thoại */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-background/85 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center gap-2 px-4">
            <Link href={portalHref(frame)} className="mr-auto">
              <BrandLogo />
            </Link>
            <button type="button" onClick={() => setMenu(true)} aria-label="Tài khoản" className="rounded-full active:scale-95">
              <StudentAvatar name={frame.displayName} hue={hue} size={36} />
            </button>
          </div>
          {isParent && frame.children.length > 1 && (
            <nav aria-label="Chọn con" className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-2.5">
              {frame.children.map((c) => (
                <Link
                  key={c.id}
                  href={switchHref(c.id)}
                  aria-current={c.id === frame.studentId ? "true" : undefined}
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
                  {c.id !== frame.studentId && !!c.feesDue && (
                    <span className="relative size-2 rounded-full bg-primary" role="img" aria-label={`${c.feesDue} phiếu học phí cần đóng`} />
                  )}
                </Link>
              ))}
            </nav>
          )}
        </header>

        {/* Hiệu ứng chuyển trang chỉ trên phần nội dung — transform ở tổ tiên sẽ làm hỏng thanh điều hướng `fixed`. */}
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="mx-auto w-full max-w-5xl px-4 pb-32 pt-4 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8"
        >
          {children}
        </motion.main>
      </div>

      {/* ───── Thanh dưới (điện thoại) ───── */}
      <nav aria-label="Điều hướng chính" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/90 backdrop-blur-lg lg:hidden">
        <div className="mx-auto grid h-16 max-w-lg grid-cols-4 items-center">
          {nav.map((item) => {
            const on = active(item.path);
            return (
              <Link key={item.path} href={item.href} aria-current={on ? "page" : undefined} className="relative flex flex-col items-center gap-0.5 py-1.5">
                {on && (
                  <motion.span layoutId="portal-tab" className="absolute top-0.5 h-8 w-14 rounded-full bg-primary-soft" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                )}
                <motion.span animate={on ? { y: [0, -3, 0] } : { y: 0 }} className="relative">
                  <item.icon className={cn("size-[22px]", on ? "text-primary" : "text-muted")} strokeWidth={on ? 2.4 : 2} />
                  {item.badge && <PingBadge count={item.badge.count} label={item.badge.label} className="absolute -right-2.5 -top-1.5 scale-90" />}
                </motion.span>
                <span className={cn("relative text-[11px] font-semibold", on ? "text-primary-deep" : "text-muted")}>
                  {item.path === "/vuon" ? "Vườn" : item.label}
                </span>
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
          <LogoutForm>
            <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-control py-3 font-semibold text-overdue hover:bg-overdue-soft">
              <LogOut className="size-4" /> Đăng xuất
            </button>
          </LogoutForm>
        </div>
      </Sheet>
    </div>
  );
}
