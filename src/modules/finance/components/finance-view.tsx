"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts";
import {
  ChevronLeft,
  ChevronRight,
  Clock4,
  Download,
  HardDriveDownload,
  HeartHandshake,
  Plus,
  Table2,
  TrendingDown,
  TrendingUp,
  Trash2,
} from "lucide-react";

import { StudentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CategoryIcon } from "@/components/ui/category-icon";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Field, Input, MoneyInput, parseMoney, Textarea } from "@/components/ui/form";
import { CountUp } from "@/components/ui/fx";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { deleteExpenseAction, restoreExpenseAction, saveExpenseAction } from "@/modules/finance/finance.actions";
import type { FinanceOverview } from "@/modules/finance/finance.service";
import { addMonths, fromDbDate, monthLabel, shortDate, todayKey } from "@/lib/dates";
import { cn, formatNumber, formatVnd, formatVndShort } from "@/lib/utils";

type Category = { id: string; name: string; icon: string; color: string };
type Expense = { id: string; amount: number; spentOn: string; note: string | null; category: Category };

export function FinanceView({
  overview,
  expenses,
  categories,
  isCurrentMonth,
}: {
  overview: FinanceOverview;
  expenses: Expense[];
  categories: Category[];
  isCurrentMonth: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [expenseSheet, setExpenseSheet] = useState(false);
  const [table, setTable] = useState(false);
  const go = (m: string) => router.push(`${pathname}?thang=${m}`, { scroll: false });
  const cmp = overview.comparison;
  const delta = cmp.income > 0 ? (overview.income - cmp.income) / cmp.income : null;

  return (
    <div>
      <PageHeader
        title="Thống kê"
        subtitle="Thu chi, lợi nhuận và các em còn nợ"
        actions={
          <>
            <a
              href={`/api/xuat-excel?loai=thang&thang=${overview.month}`}
              className="inline-flex min-h-9 items-center gap-2 rounded-control border border-line-strong bg-surface px-3 text-sm font-semibold hover:bg-surface-subtle"
            >
              <Download className="size-4" /> Xuất Excel
            </a>
          </>
        }
      />

      {/* Chọn tháng */}
      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon-sm" aria-label="Tháng trước" onClick={() => go(addMonths(overview.month, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <motion.p key={overview.month} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="min-w-36 text-center text-lg font-extrabold">
          {monthLabel(overview.month)}
        </motion.p>
        <Button variant="outline" size="icon-sm" aria-label="Tháng sau" disabled={isCurrentMonth} onClick={() => go(addMonths(overview.month, 1))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Ba số chính */}
      <section className="grid gap-3 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="bg-hero relative overflow-hidden rounded-card p-5 text-white shadow-pop">
          <div className="sparkle-overlay absolute inset-0" />
          <p className="relative text-sm font-semibold text-white/80">Đã thu</p>
          <p className="relative mt-2 text-[2rem] font-extrabold leading-none tracking-tight">
            <CountUp value={overview.income} format={formatVnd} />
          </p>
          {delta !== null && (
            <p className="relative mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-sm font-semibold">
              {delta >= 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
              {delta >= 0 ? "+" : ""}
              {Math.round(delta * 100)}% so với {cmp.label}
            </p>
          )}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
          <Card className="h-full p-5">
            <p className="text-sm font-semibold text-muted">Đã chi</p>
            <p className="mt-2 text-[2rem] font-extrabold leading-none tracking-tight text-sky">
              <CountUp value={overview.expense} format={formatVnd} />
            </p>
            <p className="mt-2 text-sm text-muted">{expenses.length} khoản chi</p>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <Card className="h-full p-5">
            <p className="text-sm font-semibold text-muted">Lợi nhuận</p>
            <p className={cn("mt-2 text-[2rem] font-extrabold leading-none tracking-tight", overview.profit >= 0 ? "text-leaf" : "text-overdue")}>
              <CountUp value={overview.profit} format={formatVnd} />
            </p>
            <p className="mt-2 text-sm text-muted">Phiếu phát hành: {formatVnd(overview.issued.amount)}</p>
          </Card>
        </motion.div>
      </section>

      {/* Xu hướng */}
      <SectionTitle
        action={
          <button type="button" onClick={() => setTable((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Table2 className="size-4" /> {table ? "Xem biểu đồ" : "Xem bảng"}
          </button>
        }
      >
        Thu chi 6 tháng gần nhất
      </SectionTitle>
      <Card className="p-4 sm:p-5">
        {table ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead className="text-left text-caption text-muted">
                <tr>
                  <th className="py-2">Tháng</th>
                  <th className="py-2 text-right">Thu</th>
                  <th className="py-2 text-right">Chi</th>
                  <th className="py-2 text-right">Lợi nhuận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overview.trend.map((t) => (
                  <tr key={t.month}>
                    <td className="py-2 font-semibold">{t.fullLabel}</td>
                    <td className="py-2 text-right tabular">{formatVnd(t.income)}</td>
                    <td className="py-2 text-right tabular">{formatVnd(t.expense)}</td>
                    <td className={cn("py-2 text-right font-bold tabular", t.profit < 0 && "text-overdue")}>{formatVnd(t.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.trend} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12, fontWeight: 600 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tick={{ fill: "var(--chart-axis)", fontSize: 11 }}
                  tickFormatter={(v: number) => formatVndShort(v).replace("đ", "")}
                />
                <Tooltip cursor={{ fill: "var(--c-surface-subtle)", radius: 8 }} content={<TrendTooltip />} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, fontWeight: 600, color: "var(--c-muted)", paddingBottom: 8 }}
                  formatter={(v) => <span className="text-muted">{v}</span>}
                />
                <Bar dataKey="income" name="Thu" fill="var(--chart-income)" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={900} />
                <Bar dataKey="expense" name="Chi" fill="var(--chart-expense)" radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={900} animationBegin={150} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="mt-2 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        {/* Theo lớp / khối */}
        <div>
          <SectionTitle>Thu theo lớp</SectionTitle>
          <Card className="space-y-4 p-5">
            {overview.byClassroom.map((c, i) => {
              const max = Math.max(1, ...overview.byClassroom.map((x) => x.amount));
              return (
                <div key={c.id}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">{c.name}</span>
                    <span className="font-bold tabular">{formatVnd(c.amount)}</span>
                  </div>
                  <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-surface-subtle">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: c.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(c.amount / max) * 100}%` }}
                      transition={{ duration: 0.9, delay: 0.2 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2 border-t border-line pt-3 text-sm">
              {overview.byGrade.map((g) => (
                <span key={g.grade} className="rounded-full bg-surface-subtle px-3 py-1 font-semibold">
                  Khối {g.grade}: {formatVnd(g.amount)}
                </span>
              ))}
              <span className="rounded-full bg-surface-subtle px-3 py-1 text-muted">
                CK {formatVndShort(overview.method.bank)} · TM {formatVndShort(overview.method.cash)}
              </span>
            </div>
          </Card>

          {/* Tiết kiệm thời gian */}
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
            <Card variant="leaf" className="relative mt-5 overflow-hidden p-5">
              <div className="sparkle-overlay absolute inset-0" />
              <div className="relative flex items-center gap-4">
                <Clock4 className="size-12 shrink-0 text-white/70" />
                <div>
                  <p className="text-sm font-semibold text-white/80">Thời gian cô đã tiết kiệm</p>
                  <p className="text-3xl font-extrabold">
                    ~<CountUp value={overview.savedHours} format={(n) => formatNumber(n)} /> giờ
                  </p>
                  <p className="text-sm text-white/85">nhờ điểm danh & tính tiền tự động</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Chi phí */}
        <div>
          <SectionTitle
            action={
              <Button size="sm" variant="soft" onClick={() => setExpenseSheet(true)}>
                <Plus className="size-4" /> Thêm khoản chi
              </Button>
            }
          >
            Chi phí {monthLabel(overview.month).toLowerCase()}
          </SectionTitle>
          {overview.byCategory.length > 0 && (
            <Card className="mb-3 space-y-3 p-4">
              {overview.byCategory.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <CategoryIcon name={c.icon} color={c.color} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-semibold">{c.name}</span>
                      <span className="font-bold tabular">{formatVnd(c.amount)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-subtle">
                      <motion.div
                        className="h-full rounded-full bg-[var(--chart-expense)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${(c.amount / Math.max(1, overview.expense)) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.1 + i * 0.07 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
          <ExpenseList expenses={expenses} />
        </div>
      </div>

      {/* Còn nợ */}
      <SectionTitle>Các em còn nợ</SectionTitle>
      {overview.debts.length === 0 ? (
        <EmptyState mood="celebrate" title="Không em nào còn nợ!" description="Học phí đâu vào đấy hết rồi ạ 🎉" />
      ) : (
        <Card className="divide-y divide-line">
          {overview.debts.slice(0, 30).map((d, i) => (
            <motion.div key={d.studentId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <Link href={d.oldestInvoiceId ? `/thu-tien/${d.oldestInvoiceId}` : `/hoc-sinh/${d.studentId}`} className="flex items-center gap-3 p-3.5 transition hover:bg-surface-subtle">
                <StudentAvatar name={d.fullName} hue={d.avatarHue} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-semibold">
                    {d.fullName}
                    {d.hardship && <HeartHandshake className="size-4 text-grape" />}
                  </p>
                  <p className="text-caption text-muted">
                    {d.classroom} · {d.invoiceCount} phiếu · {d.daysOutstanding} ngày
                  </p>
                </div>
                <span className={cn("font-bold tabular", d.daysOutstanding >= 14 ? "text-overdue" : "text-amber")}>{formatVnd(d.balance)}</span>
              </Link>
            </motion.div>
          ))}
        </Card>
      )}

      <Card variant="subtle" className="mt-6 flex flex-wrap items-center gap-3 p-4">
        <HardDriveDownload className="size-7 text-sky" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Sao lưu toàn bộ dữ liệu</p>
          <p className="text-sm text-muted">Học sinh, điểm danh, phiếu thu, thu chi — trong một file Excel.</p>
        </div>
        <a href="/api/xuat-excel?loai=toan-bo" className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-subtle">
          <Download className="size-4" /> Tải file sao lưu
        </a>
      </Card>

      <ExpenseSheet open={expenseSheet} onClose={() => setExpenseSheet(false)} categories={categories} />
    </div>
  );
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: FinanceOverview["trend"][number] }[] }) {
  if (!active || !payload?.length) return null;
  const t = payload[0].payload;
  return (
    <div className="rounded-control border border-line bg-surface-raised px-3 py-2 text-sm shadow-pop">
      <p className="font-bold">{t.fullLabel}</p>
      <p className="mt-1 flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-[var(--chart-income)]" /> Thu <b className="ml-auto pl-4 tabular">{formatVnd(t.income)}</b>
      </p>
      <p className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-[var(--chart-expense)]" /> Chi <b className="ml-auto pl-4 tabular">{formatVnd(t.expense)}</b>
      </p>
      <p className="mt-1 border-t border-line pt-1 text-muted">
        Lợi nhuận <b className={cn("float-right tabular", t.profit >= 0 ? "text-leaf" : "text-overdue")}>{formatVnd(t.profit)}</b>
      </p>
    </div>
  );
}

function ExpenseList({ expenses }: { expenses: Expense[] }) {
  const router = useRouter();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const visible = expenses.filter((e) => !hidden.has(e.id));

  const remove = (e: Expense) => {
    setHidden((s) => new Set(s).add(e.id));
    start(async () => {
      const res = await deleteExpenseAction(e.id);
      if (!res.ok) {
        setHidden((s) => {
          const n = new Set(s);
          n.delete(e.id);
          return n;
        });
        return toast.error(res.message);
      }
      toast.undoable(`Đã xóa khoản ${formatVnd(e.amount)}`, {
        onUndo: () =>
          start(async () => {
            await restoreExpenseAction(e.id);
            setHidden((s) => {
              const n = new Set(s);
              n.delete(e.id);
              return n;
            });
            router.refresh();
          }),
        onCommit: () => router.refresh(),
      });
    });
  };

  if (visible.length === 0) return <Card variant="outline" className="p-5 text-center text-sm text-muted">Chưa có khoản chi nào trong tháng.</Card>;
  return (
    <Card className="divide-y divide-line">
      {visible.map((e) => (
        <motion.div key={e.id} layout className="group flex items-center gap-3 p-3.5">
          <CategoryIcon name={e.category.icon} color={e.category.color} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{e.note || e.category.name}</p>
            <p className="text-caption text-muted">
              {e.category.name} · {shortDate(fromDbDate(new Date(e.spentOn)))}
            </p>
          </div>
          <span className="font-bold tabular">{formatVnd(e.amount)}</span>
          <button type="button" aria-label="Xóa khoản chi" onClick={() => remove(e)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-overdue-soft hover:text-overdue">
            <Trash2 className="size-4" />
          </button>
        </motion.div>
      ))}
    </Card>
  );
}

function ExpenseSheet({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: Category[] }) {
  const router = useRouter();
  const toast = useToast();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      const amount = parseMoney(fd.get("amount"));
      const res = await saveExpenseAction({ categoryId, amount, spentOn: fd.get("spentOn"), note: fd.get("note") });
      if (!res.ok) return setError(res.message);
      toast.success(`Đã ghi khoản chi ${formatVnd(amount)}`);
      onClose();
      router.refresh();
    });
  return (
    <Sheet open={open} onClose={onClose} title="Thêm khoản chi" size="sm">
      <form action={submit} className="space-y-4 pb-2">
        <div className="grid grid-cols-3 gap-2">
          {categories.map((c) => (
            <motion.button
              key={c.id}
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-control border px-2 py-3 text-center text-xs font-semibold transition",
                categoryId === c.id ? "border-primary bg-primary-soft text-primary-deep" : "border-line bg-surface",
              )}
            >
              <CategoryIcon name={c.icon} color={c.color} size={36} />
              {c.name}
            </motion.button>
          ))}
        </div>
        <Field label="Số tiền">
          <MoneyInput name="amount" required autoFocus />
        </Field>
        <Field label="Ngày chi">
          <Input type="date" name="spentOn" defaultValue={todayKey()} max={todayKey()} required />
        </Field>
        <Field label="Ghi chú">
          <Textarea name="note" rows={2} placeholder="vd: Photo đề kiểm tra 15 phút" />
        </Field>
        {error && <Notice tone="overdue">{error}</Notice>}
        <Button type="submit" size="lg" block loading={pending}>
          Lưu khoản chi
        </Button>
      </form>
    </Sheet>
  );
}
