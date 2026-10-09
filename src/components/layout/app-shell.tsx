"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  BookOpenCheck,
  Bell,
  Home,
  LogOut,
  Menu,
  Search,
  Settings,
  Users,
  Wallet,
  School,
  type LucideIcon,
} from "lucide-react";

import { BrandLogo, CherryIcon, Mascot } from "@/components/brand/mascot";
import { OfflineSync } from "@/components/layout/offline-sync";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { StudentAvatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";
import { logoutAction } from "@/modules/auth/auth.actions";
import {
  listNotificationsAction,
  markAllReadAction,
  type NotificationItem,
} from "@/modules/notifications/notifications.actions";
import { useStudentSearch } from "@/modules/students/use-student-search";
import { cn, formatRelativeTime } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/hom-nay", label: "Hôm nay", icon: Home },
  { href: "/lop-hoc", label: "Lớp học", icon: School },
  { href: "/thu-tien", label: "Thu tiền", icon: Wallet },
  { href: "/thong-ke", label: "Thống kê", icon: BarChart3 },
];

const MORE: NavItem[] = [
  { href: "/bai-tap", label: "Bài tập", icon: BookOpenCheck },
  { href: "/hoc-sinh", label: "Học sinh", icon: Users },
  { href: "/cai-dat", label: "Cài đặt", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  displayName,
  unread,
}: {
  children: React.ReactNode;
  displayName: string;
  unread: number;
}) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  // Phím tắt "/" hoặc Ctrl+K mở tìm kiếm trên máy tính.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <OfflineSync />
      {/* ───── Sidebar máy tính ───── */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface/70 px-4 py-5 backdrop-blur lg:flex">
        <Link href="/hom-nay" className="px-2">
          <BrandLogo />
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="mt-6 flex items-center gap-2 rounded-control border border-line bg-background px-3 py-2.5 text-sm text-muted transition hover:border-line-strong"
        >
          <Search className="size-4" /> Tìm học sinh…
          <kbd className="ml-auto rounded-md bg-surface-subtle px-1.5 text-[11px] font-semibold">/</kbd>
        </button>
        <Link
          href="/diem-danh"
          className="bg-hero mt-4 flex items-center gap-3 rounded-card px-4 py-3.5 font-bold text-white shadow-fab transition active:scale-[0.98]"
        >
          <CherryIcon size={26} />
          Điểm danh
        </Link>
        <nav className="mt-5 flex flex-col gap-1">
          {[...NAV, ...MORE].map((item) => (
            <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <div className="flex items-center gap-2">
            <ThemeToggle withLabel />
            <button
              type="button"
              onClick={() => setBellOpen(true)}
              className="relative grid size-10 place-items-center rounded-full bg-surface-subtle text-muted hover:text-foreground"
              aria-label="Thông báo"
            >
              <Bell className="size-4" />
              {unread > 0 && <Dot count={unread} />}
            </button>
          </div>
          <div className="flex items-center gap-3 rounded-card bg-surface-subtle p-3">
            <StudentAvatar name={displayName} hue={345} size={38} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{displayName}</p>
              <p className="text-caption text-muted">Giáo viên</p>
            </div>
            <form action={logoutAction}>
              <button type="submit" aria-label="Đăng xuất" className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface hover:text-overdue">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ───── Khung nội dung ───── */}
      <div className="min-w-0">
        {/* Thanh trên điện thoại */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-background/80 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center gap-2 px-4">
            <Link href="/hom-nay" className="mr-auto">
              <BrandLogo />
            </Link>
            <IconButton label="Tìm học sinh" onClick={() => setSearchOpen(true)}>
              <Search className="size-5" />
            </IconButton>
            <IconButton label="Thông báo" onClick={() => setBellOpen(true)}>
              <Bell className="size-5" />
              {unread > 0 && <Dot count={unread} />}
            </IconButton>
            <IconButton label="Thêm" onClick={() => setMoreOpen(true)}>
              <Menu className="size-5" />
            </IconButton>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      {/* ───── Thanh điều hướng dưới (điện thoại) ───── */}
      <BottomNav pathname={pathname} />

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationSheet open={bellOpen} onClose={() => setBellOpen(false)} />
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Thêm" size="sm">
        <div className="grid grid-cols-2 gap-3">
          {MORE.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-4 shadow-card active:scale-[0.97]"
            >
              <span className="grid size-10 place-items-center rounded-[12px] bg-primary-soft text-primary">
                <item.icon className="size-5" />
              </span>
              <span className="font-bold">{item.label}</span>
            </Link>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-card bg-surface-subtle p-3">
          <div className="flex items-center gap-3">
            <StudentAvatar name={displayName} hue={345} size={38} />
            <p className="font-bold">{displayName}</p>
          </div>
          <ThemeToggle withLabel />
        </div>
        <form action={logoutAction} className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-control py-3 font-semibold text-overdue hover:bg-overdue-soft"
          >
            <LogOut className="size-4" /> Đăng xuất
          </button>
        </form>
      </Sheet>
    </div>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "relative flex items-center gap-3 rounded-control px-3 py-2.5 font-semibold transition-colors",
        active ? "text-primary-deep" : "text-muted hover:bg-surface-subtle hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="side-active"
          className="absolute inset-0 rounded-control bg-primary-soft"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <item.icon className="relative size-5" />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  const left = NAV.slice(0, 2);
  const right = NAV.slice(2);
  const onAttendance = pathname.startsWith("/diem-danh");
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/90 backdrop-blur-lg lg:hidden">
      <div className="relative mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
        {left.map((item) => (
          <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <div className="flex justify-center">
          <Link
            href="/diem-danh"
            aria-label="Điểm danh"
            className={cn(
              "bg-hero -mt-8 grid size-16 place-items-center rounded-full text-white shadow-fab ring-4 ring-background transition active:scale-90",
              onAttendance && "ring-primary-soft",
            )}
          >
            <motion.span
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3 }}
            >
              <CherryIcon size={32} />
            </motion.span>
          </Link>
        </div>
        {right.map((item) => (
          <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </div>
    </nav>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link href={item.href} className="relative flex flex-col items-center gap-0.5 py-1.5">
      {active && (
        <motion.span
          layoutId="tab-active"
          className="absolute top-0.5 h-8 w-14 rounded-full bg-primary-soft"
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
        />
      )}
      <motion.span animate={active ? { y: [0, -3, 0] } : { y: 0 }} transition={{ duration: 0.35 }} className="relative">
        <item.icon className={cn("size-[22px]", active ? "text-primary" : "text-muted")} strokeWidth={active ? 2.4 : 2} />
      </motion.span>
      <span className={cn("relative text-[11px] font-semibold", active ? "text-primary-deep" : "text-muted")}>
        {item.label}
      </span>
    </Link>
  );
}

function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="relative grid size-10 place-items-center rounded-full text-foreground transition hover:bg-surface-subtle active:scale-90"
    >
      {children}
    </button>
  );
}

function Dot({ count }: { count: number }) {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-[18px] text-on-primary"
    >
      {count > 9 ? "9+" : count}
    </motion.span>
  );
}

// ───── Tìm kiếm học sinh (gõ không dấu vẫn ra) ─────

function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { q, setQuery, results, pending, reset } = useStudentSearch();
  const close = () => {
    reset();
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title="Tìm học sinh" description="Gõ không dấu cũng được, vd: nguyen van an" size="md">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tên, mã HS hoặc SĐT phụ huynh…"
          className="min-h-12 w-full rounded-control border border-line-strong bg-surface pl-11 pr-3 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) {
              router.push(`/hoc-sinh/${results[0].id}`);
              close();
            }
          }}
        />
      </div>
      <div className="mt-3 min-h-40">
        {pending && results.length === 0 && <p className="py-6 text-center text-sm text-muted">Đang tìm…</p>}
        {!pending && q.trim() && results.length === 0 && (
          <div className="flex flex-col items-center py-6 text-center">
            <Mascot mood="thinking" size={80} />
            <p className="mt-2 text-sm text-muted">Chưa thấy em nào tên &ldquo;{q}&rdquo; ạ.</p>
          </div>
        )}
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {results.map((s, i) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                exit={{ opacity: 0 }}
              >
                <Link
                  href={`/hoc-sinh/${s.id}`}
                  onClick={close}
                  className="flex items-center gap-3 rounded-control px-2 py-2 transition hover:bg-surface-subtle active:scale-[0.99]"
                >
                  <StudentAvatar name={s.fullName} hue={s.avatarHue} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.fullName}</p>
                    <p className="text-caption text-muted">
                      {s.classroom.name}
                      {s.shift ? ` · ${s.shift.name}` : ""} · {s.code}
                    </p>
                  </div>
                  {s.status === "PAUSED" && <span className="text-caption font-semibold text-amber">Tạm nghỉ</span>}
                </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </Sheet>
  );
}

// ───── Thông báo ─────

function NotificationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listNotificationsAction().then((list) => {
      if (!alive) return;
      setItems(list);
      if (list.some((n) => !n.readAt)) markAllReadAction().then(() => router.refresh());
    });
    return () => {
      alive = false;
    };
  }, [open, router]);

  return (
    <Sheet open={open} onClose={onClose} title="Thông báo" size="md">
      {items === null ? (
        <div className="space-y-2 py-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-16 rounded-control" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Mascot mood="sleepy" size={96} />
          <p className="mt-2 font-semibold">Chưa có thông báo nào ạ</p>
          <p className="text-sm text-muted">Khi phụ huynh báo đã chuyển khoản, em sẽ báo cô ở đây.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                href={n.link ?? "#"}
                onClick={onClose}
                className={cn(
                  "block rounded-control border px-3.5 py-3 transition hover:bg-surface-subtle",
                  n.readAt ? "border-line" : "border-primary/30 bg-primary-soft/40",
                )}
              >
                <p className="font-semibold">{n.title}</p>
                {n.body && <p className="text-sm text-muted">{n.body}</p>}
                <p className="mt-1 text-caption text-muted">{formatRelativeTime(n.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
