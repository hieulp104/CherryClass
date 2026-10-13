"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BarChart3,
  BookOpenCheck,
  Bell,
  ChevronDown,
  Home,
  KeyRound,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Users,
  Wallet,
  School,
  type LucideIcon,
} from "lucide-react";

import { BrandLogo, CherryIcon, Mascot } from "@/components/brand/mascot";
import { OfflineSync } from "@/components/layout/offline-sync";
import { LogoutForm } from "@/components/layout/logout-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { StudentAvatar } from "@/components/ui/avatar";
import { useStoredValue } from "@/lib/use-external";
import { PingBadge } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import {
  listNotificationsAction,
  markAllReadAction,
  type NotificationItem,
} from "@/modules/notifications/notifications.actions";
import { useStudentSearch } from "@/modules/students/use-student-search";
import { cn, formatRelativeTime } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: LucideIcon; /** Số việc cần làm — chấm đỏ cạnh mục. */ badge?: { count: number; label: string } };

const NAV: NavItem[] = [
  { href: "/hom-nay", label: "Tổng quan", icon: Home },
  { href: "/lop-hoc", label: "Lớp học", icon: School },
  { href: "/thu-tien", label: "Thu tiền", icon: Wallet },
  { href: "/thong-ke", label: "Thống kê", icon: BarChart3 },
];

const MORE: NavItem[] = [
  { href: "/bai-tap", label: "Bài tập", icon: BookOpenCheck },
  { href: "/hoc-sinh", label: "Học sinh", icon: Users },
  { href: "/cai-dat", label: "Cài đặt", icon: Settings },
];

const SIDEBAR_EVENT = "tc-sidebar-changed";
function readCollapsed() {
  try {
    return localStorage.getItem("tc-sidebar") === "rail";
  } catch {
    return false;
  }
}

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
  const collapsed = useStoredValue<boolean>(SIDEBAR_EVENT, readCollapsed, false);
  const toggleCollapsed = () => {
    try {
      localStorage.setItem("tc-sidebar", collapsed ? "open" : "rail");
    } catch {
      // trình duyệt chặn localStorage — chỉ không nhớ được lần sau
    }
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  };
  const bellLabel = unread > 0 ? `Thông báo — ${unread} chưa đọc` : "Thông báo";

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
    <div
      style={{ "--sb": collapsed ? "84px" : "264px" } as React.CSSProperties}
      className="min-h-dvh lg:grid lg:grid-cols-[var(--sb)_1fr] lg:transition-[grid-template-columns] lg:duration-300 lg:ease-[cubic-bezier(.22,1,.36,1)]"
    >
      <a
        href="#noi-dung"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded-control focus:bg-surface focus:px-4 focus:py-2.5 focus:font-semibold focus:shadow-pop"
      >
        Bỏ qua, tới nội dung chính
      </a>
      <OfflineSync />
      {/* ───── Sidebar máy tính: mở rộng ⇄ thu gọn thành cột icon (nhớ theo máy) ───── */}
      <aside className="sidebar-wash sticky top-0 hidden h-dvh flex-col overflow-hidden border-r border-line px-3 py-4 lg:flex">
        <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "pl-2")}>
          <Link href="/hom-nay" className="mr-auto" aria-label="TeamCherry — Tổng quan">
            <BrandLogo compact={collapsed} />
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
            title={collapsed ? "Mở rộng" : "Thu gọn"}
            className="grid size-9 place-items-center rounded-[12px] text-muted transition hover:bg-surface hover:text-foreground hover:shadow-card"
          >
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
          </button>
        </div>

        <Link
          href="/diem-danh"
          title={collapsed ? "Điểm danh" : undefined}
          aria-label="Điểm danh"
          className={cn(
            "btn-glow mt-6 flex items-center font-bold active:scale-[0.97]",
            collapsed ? "mx-auto size-12 justify-center rounded-full" : "gap-3 rounded-full py-3 pl-3 pr-5",
          )}
        >
          <CherryIcon size={26} />
          {!collapsed && (
            <>
              Điểm danh
              <i className="btn-ring ml-auto" aria-hidden />
            </>
          )}
        </Link>

        <nav aria-label="Điều hướng chính" className="mt-6 flex flex-col gap-0.5">
          {!collapsed && <p className="mb-1 px-3 text-caption font-semibold text-muted">Hằng ngày</p>}
          {NAV.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />
          ))}
          {collapsed ? (
            <span className="mx-auto my-2 h-px w-8 bg-line" aria-hidden />
          ) : (
            <p className="mb-1 mt-4 px-3 text-caption font-semibold text-muted">Quản lý</p>
          )}
          {MORE.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />
          ))}
        </nav>

        {!collapsed && (
          <div className="mt-auto flex items-end gap-2 rounded-card bg-surface/70 p-3 text-caption text-muted shadow-card">
            <Mascot mood="happy" size={44} />
            <p className="pb-1">Bấm <kbd className="rounded bg-surface-subtle px-1 font-semibold text-foreground">/</kbd> để tìm nhanh học sinh.</p>
          </div>
        )}
      </aside>

      {/* ───── Khung nội dung ───── */}
      <div className="min-w-0">
        {/* Thanh ngang trên máy tính: tìm kiếm · thông báo · sáng/tối · tài khoản */}
        <header className="sticky top-0 z-30 hidden h-16 items-center gap-1 border-b border-line/60 bg-background/75 px-6 backdrop-blur-xl lg:flex lg:px-10">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="group mr-auto flex w-full max-w-sm items-center gap-2.5 rounded-full border border-line bg-surface/80 px-4 py-2 text-sm text-muted transition hover:border-line-strong hover:shadow-card"
          >
            <Search className="size-4 transition-transform group-hover:scale-110" /> Tìm học sinh…
            <kbd className="ml-auto rounded-md border border-line bg-background px-1.5 text-[11px] font-semibold">Ctrl K</kbd>
          </button>
          <IconButton label={bellLabel} onClick={() => setBellOpen(true)}>
            <Bell className="size-[18px]" />
            {unread > 0 && <Dot count={unread} />}
          </IconButton>
          <ThemeToggle className="text-foreground" />
          <UserMenu displayName={displayName} settingsHref="/cai-dat" />
        </header>

        {/* Thanh trên điện thoại */}
        <header className="pt-safe sticky top-0 z-30 border-b border-line/60 bg-background/80 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center gap-2 px-4">
            <Link href="/hom-nay" className="mr-auto">
              <BrandLogo />
            </Link>
            <IconButton label="Tìm học sinh" onClick={() => setSearchOpen(true)}>
              <Search className="size-5" />
            </IconButton>
            <IconButton label={bellLabel} onClick={() => setBellOpen(true)}>
              <Bell className="size-5" />
              {unread > 0 && <Dot count={unread} />}
            </IconButton>
            <IconButton label="Thêm" onClick={() => setMoreOpen(true)}>
              <Menu className="size-5" />
            </IconButton>
          </div>
        </header>

        <main id="noi-dung" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 outline-none sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          {children}
        </main>
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
        <LogoutForm className="mt-3">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-control py-3 font-semibold text-overdue hover:bg-overdue-soft"
          >
            <LogOut className="size-4" /> Đăng xuất
          </button>
        </LogoutForm>
      </Sheet>
    </div>
  );
}

/** Mục thanh bên. Mục đang mở: nền trắng nổi + vạch cherry bên trái, trượt theo khi đổi trang. */
export function SideLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-control py-2.5 font-semibold transition-colors",
        collapsed ? "mx-auto size-11 justify-center px-0" : "px-3",
        active ? "text-primary-deep" : "text-muted hover:text-foreground",
      )}
    >
      {active ? (
        <motion.span
          layoutId="side-active"
          className="absolute inset-0 rounded-control bg-surface shadow-card"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        >
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
        </motion.span>
      ) : (
        <span className="absolute inset-0 rounded-control bg-surface/0 transition-colors group-hover:bg-surface/60" />
      )}
      <item.icon className={cn("relative size-5 transition-transform duration-200", !active && "group-hover:scale-110")} />
      {!collapsed && <span className="relative">{item.label}</span>}
      {item.badge && <PingBadge count={item.badge.count} label={item.badge.label} className={collapsed ? "absolute -right-0.5 -top-0.5" : "relative ml-auto"} />}
    </Link>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  const left = NAV.slice(0, 2);
  const right = NAV.slice(2);
  const onAttendance = pathname.startsWith("/diem-danh");
  return (
    <nav aria-label="Điều hướng chính" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/90 backdrop-blur-lg lg:hidden">
      <div className="relative mx-auto grid h-16 max-w-lg grid-cols-5 items-center">
        {left.map((item) => (
          <TabLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <div className="flex justify-center">
          <Link
            href="/diem-danh"
            aria-label="Điểm danh"
            aria-current={onAttendance ? "page" : undefined}
            className={cn(
              "btn-glow -mt-8 grid size-16 place-items-center rounded-full border-4 border-background active:scale-90",
              onAttendance && "border-primary-soft",
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
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className="relative flex flex-col items-center gap-0.5 py-1.5"
    >
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

/** Ô tài khoản ở thanh trên: avatar + tên + vai trò, bấm mở menu nhỏ. */
export function UserMenu({
  displayName,
  roleLabel = "Giáo viên",
  hue = 345,
  settingsHref,
}: {
  displayName: string;
  roleLabel?: string;
  hue?: number;
  /** Có thì thêm mục "Cài đặt" vào menu (chỉ cô giáo). */
  settingsHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-full py-1 pl-1 pr-3 transition hover:bg-surface-subtle"
      >
        <StudentAvatar name={displayName} hue={hue} size={38} />
        <span className="text-left leading-tight">
          <span className="block max-w-40 truncate text-sm font-bold">{displayName}</span>
          <span className="block text-caption text-muted">{roleLabel}</span>
        </span>
        <ChevronDown className={cn("size-4 text-muted transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-card border border-line bg-surface p-1.5 shadow-pop"
          >
            {settingsHref && (
              <Link
                href={settingsHref}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold hover:bg-surface-subtle"
              >
                <Settings className="size-4 text-muted" /> Cài đặt
              </Link>
            )}
            <Link
              href="/doi-mat-khau"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold hover:bg-surface-subtle"
            >
              <KeyRound className="size-4 text-muted" /> Đổi mật khẩu
            </Link>
            <div className="my-1 h-px bg-line" />
            <LogoutForm>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm font-semibold text-overdue hover:bg-overdue-soft"
              >
                <LogOut className="size-4" /> Đăng xuất
              </button>
            </LogoutForm>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
      aria-hidden
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
          type="search"
          aria-label="Tìm học sinh theo tên, mã hoặc SĐT"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
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
              {n.link ? (
                <Link
                  href={n.link}
                  onClick={onClose}
                  className={cn(
                    "block rounded-control border px-3.5 py-3 transition hover:bg-surface-subtle",
                    n.readAt ? "border-line" : "border-primary/30 bg-primary-soft/40",
                  )}
                >
                  <NotificationBody n={n} />
                </Link>
              ) : (
                <div
                  className={cn(
                    "rounded-control border px-3.5 py-3",
                    n.readAt ? "border-line" : "border-primary/30 bg-primary-soft/40",
                  )}
                >
                  <NotificationBody n={n} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function NotificationBody({ n }: { n: NotificationItem }) {
  return (
    <>
      <p className="font-semibold">{n.title}</p>
      {n.body && <p className="text-sm text-muted">{n.body}</p>}
      <p className="mt-1 text-caption text-muted">{formatRelativeTime(n.createdAt)}</p>
    </>
  );
}
