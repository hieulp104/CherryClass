import { loadLedgers } from "@/modules/billing/billing.service";
import { addDays, addMonths, monthLabel, monthRange, todayKey, toDbDate, vnDayStartUtc } from "@/lib/dates";
import { prisma } from "@/shared/prisma/prisma.service";

/** Khoảng UTC [start, end) của một tháng theo lịch VN — để lọc cột timestamp (paidAt, issuedAt). */
export function monthUtcRange(month: string) {
  const { from, to } = monthRange(month);
  return { gte: vnDayStartUtc(from), lt: vnDayStartUtc(addDays(to, 1)) };
}

/** Khoảng ngày cho cột @db.Date (spentOn). */
function monthDateRange(month: string) {
  const { from, to } = monthRange(month);
  return { gte: toDbDate(from), lte: toDbDate(to) };
}

export async function incomeOf(month: string) {
  const r = await prisma.payment.aggregate({
    where: { status: "CONFIRMED", paidAt: monthUtcRange(month) },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return { amount: r._sum.amount ?? 0, count: r._count._all };
}

export async function expenseOf(month: string) {
  const r = await prisma.expense.aggregate({
    where: { deletedAt: null, spentOn: monthDateRange(month) },
    _sum: { amount: true },
  });
  return r._sum.amount ?? 0;
}

/** Tổng còn cần thu = Σ số dư dương của từng em (đóng thừa không bù cho em khác). */
export async function outstandingTotal() {
  const ledgers = await loadLedgers();
  let total = 0;
  let students = 0;
  for (const l of ledgers.values()) {
    if (l.balance > 0) {
      total += l.balance;
      students += 1;
    }
  }
  return { total, students };
}

export async function financeOverview(month: string) {
  const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));
  const firstRange = monthUtcRange(months[0]);
  const lastRange = monthUtcRange(month);

  const [payments, expenses, outstanding, issued, categories, classrooms, debts, completedSessions, invoicesCount, confirmedCount] =
    await Promise.all([
      prisma.payment.findMany({
        where: { status: "CONFIRMED", paidAt: { gte: firstRange.gte, lt: lastRange.lt } },
        select: { amount: true, paidAt: true, method: true, student: { select: { classroomId: true } } },
      }),
      prisma.expense.findMany({
        where: { deletedAt: null, spentOn: { gte: toDbDate(monthRange(months[0]).from), lte: toDbDate(monthRange(month).to) } },
        select: { amount: true, spentOn: true, categoryId: true },
      }),
      outstandingTotal(),
      prisma.invoice.aggregate({
        where: { status: { not: "VOID" }, issuedAt: monthUtcRange(month) },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.expenseCategory.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.classroom.findMany({ where: { archivedAt: null }, orderBy: [{ grade: "asc" }, { name: "asc" }] }),
      debtList(),
      prisma.session.count({ where: { status: "COMPLETED" } }),
      prisma.invoice.count({ where: { status: { not: "VOID" } } }),
      prisma.payment.count({ where: { status: "CONFIRMED" } }),
    ]);

  const monthOfTs = (d: Date) => todayKey(d).slice(0, 7);
  const monthOfDate = (d: Date) => d.toISOString().slice(0, 7);

  const trend = months.map((m) => {
    const income = payments.filter((p) => monthOfTs(p.paidAt) === m).reduce((s, p) => s + p.amount, 0);
    const expense = expenses.filter((e) => monthOfDate(e.spentOn) === m).reduce((s, e) => s + e.amount, 0);
    return { month: m, label: `T${Number(m.slice(5))}`, fullLabel: monthLabel(m), income, expense, profit: income - expense };
  });

  const thisMonthPayments = payments.filter((p) => monthOfTs(p.paidAt) === month);
  const byClassroom = classrooms.map((c) => ({
    id: c.id,
    name: c.name,
    grade: c.grade,
    color: c.color,
    amount: thisMonthPayments.filter((p) => p.student.classroomId === c.id).reduce((s, p) => s + p.amount, 0),
  }));
  const byGrade = [...new Set(classrooms.map((c) => c.grade))].map((g) => ({
    grade: g,
    amount: byClassroom.filter((c) => c.grade === g).reduce((s, c) => s + c.amount, 0),
  }));

  const thisMonthExpenses = expenses.filter((e) => monthOfDate(e.spentOn) === month);
  const byCategory = categories
    .map((c) => ({
      ...c,
      amount: thisMonthExpenses.filter((e) => e.categoryId === c.id).reduce((s, e) => s + e.amount, 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const current = trend.at(-1)!;
  const previous = trend.at(-2)!;

  // So sánh CÙNG KỲ: tháng đang dở (vd mới tới ngày 8) thì so với ngày 1–8 tháng trước,
  // không so với cả tháng — tránh "−96%" vô lý làm cô nản.
  const today = todayKey();
  const partial = month === today.slice(0, 7);
  const prevMonth = months.at(-2)!;
  const prevLastDay = Number(monthRange(prevMonth).to.slice(8));
  const cutDay = Math.min(Number(today.slice(8)), prevLastDay);
  const prevSamePeriod = partial
    ? payments
        .filter((p) => monthOfTs(p.paidAt) === prevMonth && Number(todayKey(p.paidAt).slice(8)) <= cutDay)
        .reduce((s, p) => s + p.amount, 0)
    : previous.income;

  // Ước tính thời gian tiết kiệm: mỗi buổi tự đếm + ghi sổ ~4 phút, mỗi phiếu tự tính tiền ~8 phút,
  // mỗi khoản thu tự đối chiếu ~2 phút. Con số thận trọng để cô thấy, không phóng đại.
  const savedMinutes = completedSessions * 4 + invoicesCount * 8 + confirmedCount * 2;

  return {
    month,
    income: current.income,
    expense: current.expense,
    profit: current.profit,
    previous,
    comparison: { income: prevSamePeriod, label: partial ? `cùng kỳ ${previous.label}` : previous.fullLabel.toLowerCase() },
    issued: { amount: issued._sum.amount ?? 0, count: issued._count._all },
    outstanding,
    trend,
    byClassroom,
    byGrade,
    byCategory,
    debts,
    savedHours: Math.round((savedMinutes / 60) * 10) / 10,
    method: {
      bank: thisMonthPayments.filter((p) => p.method === "BANK_TRANSFER").reduce((s, p) => s + p.amount, 0),
      cash: thisMonthPayments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0),
    },
  };
}

export type FinanceOverview = Awaited<ReturnType<typeof financeOverview>>;

/** Danh sách các em còn nợ, nợ nhiều và lâu nhất lên đầu. */
export async function debtList() {
  const ledgers = await loadLedgers();
  const owing = [...ledgers.entries()].filter(([, l]) => l.balance > 0);
  if (owing.length === 0) return [];
  const ids = owing.map(([id]) => id);
  const [students, invoices] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, avatarHue: true, hardship: true, status: true, classroom: { select: { name: true } } },
    }),
    prisma.invoice.findMany({
      where: { studentId: { in: ids }, status: { not: "VOID" } },
      select: { id: true, studentId: true, issuedAt: true, sentAt: true },
    }),
  ]);
  const sMap = new Map(students.map((s) => [s.id, s]));
  const today = todayKey();
  return owing
    .map(([id, l]) => {
      const unpaid = l.allocations.filter((a) => a.remaining > 0).map((a) => a.id);
      const oldest = invoices
        .filter((i) => unpaid.includes(i.id))
        .sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime())[0];
      const s = sMap.get(id)!;
      return {
        studentId: id,
        fullName: s.fullName,
        avatarHue: s.avatarHue,
        hardship: s.hardship,
        status: s.status,
        classroom: s.classroom.name,
        balance: l.balance,
        invoiceCount: unpaid.length,
        oldestInvoiceId: oldest?.id ?? null,
        daysOutstanding: oldest
          ? Math.max(0, Math.round((vnDayStartUtc(today).getTime() - (oldest.sentAt ?? oldest.issuedAt).getTime()) / 86_400_000))
          : 0,
      };
    })
    .sort((a, b) => b.daysOutstanding - a.daysOutstanding || b.balance - a.balance);
}

export async function listExpenses(month: string) {
  return prisma.expense.findMany({
    where: { deletedAt: null, spentOn: monthDateRange(month) },
    orderBy: [{ spentOn: "desc" }, { createdAt: "desc" }],
    include: { category: true },
  });
}

export async function listExpenseCategories() {
  return prisma.expenseCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}
