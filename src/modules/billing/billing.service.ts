import { randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import {
  allocatePayments,
  computeInvoiceAmounts,
  discountLabel,
  firstChildId,
  invoiceDisplayState,
  invoiceDue,
  planCycles,
  reminderTone,
  type BillingSettings,
  type InvoiceAllocation,
  type InvoiceDisplayState,
  type SiblingDiscount,
} from "@/modules/billing/billing.core";
import { getSettings, type AppSettings } from "@/modules/settings/settings.service";
import { diffDays, fromDbDate, todayKey, vnNow } from "@/lib/dates";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

/**
 * Nối lõi tính tiền (billing.core) với DB. Mọi con số tiền đều do billing.core tính —
 * file này chỉ đọc dữ liệu, gọi hàm thuần, rồi ghi kết quả trong cùng transaction.
 */

type Tx = Prisma.TransactionClient;

// ─────────────────── Phát hành phiếu ───────────────────

async function nextInvoiceCode(tx: Tx): Promise<string> {
  const year = todayKey().slice(0, 4);
  const prefix = `PT-${year}-`;
  const last = await tx.invoice.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const seq = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

function newPublicToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Số dư hiện tại: Σ phiếu chưa hủy − Σ tiền đã xác nhận. */
export async function currentBalance(tx: Tx | typeof prisma, studentId: string): Promise<number> {
  const [charged, paid] = await Promise.all([
    tx.invoice.aggregate({ where: { studentId, status: { not: "VOID" } }, _sum: { amount: true } }),
    tx.payment.aggregate({ where: { studentId, status: "CONFIRMED" }, _sum: { amount: true } }),
  ]);
  return (charged._sum.amount ?? 0) - (paid._sum.amount ?? 0);
}

async function discountFor(tx: Tx, studentId: string) {
  const student = await tx.student.findUniqueOrThrow({
    where: { id: studentId },
    select: {
      siblingGroup: {
        select: {
          discountType: true,
          discountValue: true,
          applyTo: true,
          students: { where: { deletedAt: null }, select: { id: true, code: true, joinedAt: true } },
        },
      },
    },
  });
  const group = student.siblingGroup;
  if (!group || group.students.length < 2) return { discount: null, isFirstChild: false };
  const discount: SiblingDiscount = { type: group.discountType, value: group.discountValue, applyTo: group.applyTo };
  const first = firstChildId(group.students.map((s) => ({ ...s, joinedAt: fromDbDate(s.joinedAt) })));
  return { discount, isFirstChild: first === studentId };
}

export type IssuedInvoice = { id: string; code: string; studentId: string; amount: number };

/**
 * Tạo phiếu cho mọi chu kỳ đã đủ của một em. Gọi sau mỗi lần chốt buổi / sửa bộ đếm.
 * Không bao giờ tạo phiếu thiếu buổi; phần dư chờ chu kỳ sau.
 */
export async function issueDueInvoices(
  tx: Tx,
  studentId: string,
  settings: BillingSettings,
  actorId: string | null,
): Promise<IssuedInvoice[]> {
  const uninvoiced = await tx.attendance.findMany({
    where: { studentId, billable: true, invoiceLine: { is: null } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: {
      id: true,
      date: true,
      unitPrice: true,
      source: true,
      reason: true,
      isMakeup: true,
      session: { select: { shift: { select: { name: true, classroom: { select: { name: true } } } } } },
    },
  });
  const items = uninvoiced.map((a) => ({
    id: a.id,
    date: fromDbDate(a.date),
    unitPrice: a.unitPrice,
    label: a.session
      ? `${a.session.shift.classroom.name} · ${a.session.shift.name}${a.isMakeup ? " (học bù)" : ""}`
      : `Cộng tay${a.reason ? `: ${a.reason}` : ""}`,
  }));
  const { cycles } = planCycles(items, settings.cycleLength);
  if (cycles.length === 0) return [];

  const { discount, isFirstChild } = await discountFor(tx, studentId);
  let balance = await currentBalance(tx, studentId);
  let cycleNo = await tx.invoice.count({ where: { studentId, status: { not: "VOID" } } });
  const issued: IssuedInvoice[] = [];

  for (const cycle of cycles) {
    const amounts = computeInvoiceAmounts({ lines: cycle, discount, isFirstChild, roundTo: settings.roundTo });
    cycleNo += 1;
    const invoice = await tx.invoice.create({
      data: {
        code: await nextInvoiceCode(tx),
        studentId,
        cycleNo,
        sessionCount: amounts.sessionCount,
        subtotal: amounts.subtotal,
        discountAmount: amounts.discountAmount,
        discountLabel: amounts.discountAmount > 0 && discount ? discountLabel(discount) : null,
        discountSnapshot: discount ? { ...discount, isFirstChild } : undefined,
        adjustmentTotal: 0,
        roundingAmount: amounts.roundingAmount,
        amount: amounts.amount,
        openingBalance: balance,
        publicToken: newPublicToken(),
        lines: {
          create: cycle.map((c) => ({
            attendanceId: c.id,
            date: new Date(`${c.date}T00:00:00.000Z`),
            label: c.label,
            unitPrice: c.unitPrice,
          })),
        },
      },
    });
    balance += amounts.amount;
    await writeAuditLog(tx, {
      actorId,
      action: "INVOICE_ISSUE",
      entity: "Invoice",
      entityId: invoice.id,
      after: { ...amounts, code: invoice.code, attendanceIds: cycle.map((c) => c.id) },
    });
    issued.push({ id: invoice.id, code: invoice.code, studentId, amount: invoice.amount });
  }
  return issued;
}

/**
 * Tính lại số tiền của phiếu sau khi sửa tay / miễn buổi. Công thức vẫn là computeInvoiceAmounts.
 * Ném NEGATIVE_INVOICE nếu cô giảm quá tay — action bắt lỗi này và báo lại.
 */
export async function recomputeInvoice(tx: Tx, invoiceId: string, settings: BillingSettings) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lines: true, adjustments: true },
  });
  const snap = invoice.discountSnapshot as (SiblingDiscount & { isFirstChild: boolean }) | null;
  const discount: SiblingDiscount | null = snap ? { type: snap.type, value: snap.value, applyTo: snap.applyTo } : null;
  const isFirstChild = snap?.isFirstChild ?? false;
  const amounts = computeInvoiceAmounts({
    lines: invoice.lines,
    discount,
    isFirstChild,
    adjustments: invoice.adjustments.map((a) => a.delta),
    roundTo: settings.roundTo,
  });
  return tx.invoice.update({
    where: { id: invoiceId },
    data: {
      sessionCount: amounts.sessionCount,
      subtotal: amounts.subtotal,
      discountAmount: amounts.discountAmount,
      discountLabel: amounts.discountAmount > 0 && discount ? discountLabel(discount) : null,
      adjustmentTotal: amounts.adjustmentTotal,
      roundingAmount: amounts.roundingAmount,
      amount: amounts.amount,
    },
  });
}

// ─────────────────── Sổ cái ───────────────────

type LedgerInvoiceRow = {
  id: string;
  studentId: string;
  amount: number;
  issuedAt: Date;
  status: "READY" | "SENT" | "VOID";
  sentAt: Date | null;
};

export type StudentLedger = {
  allocations: InvoiceAllocation[];
  credit: number;
  balance: number;
  pendingClaimInvoiceIds: Set<string>;
};

/** Sổ cái của nhiều em cùng lúc (một lần truy vấn) — dùng cho danh sách phiếu, thống kê. */
export async function loadLedgers(studentIds?: string[]): Promise<Map<string, StudentLedger>> {
  const studentFilter = studentIds ? { studentId: { in: studentIds } } : {};
  const [invoices, paid, pending] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...studentFilter, status: { not: "VOID" } },
      select: { id: true, studentId: true, amount: true, issuedAt: true },
    }),
    prisma.payment.groupBy({
      by: ["studentId"],
      where: { ...studentFilter, status: "CONFIRMED" },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: { ...studentFilter, status: "PENDING", invoiceId: { not: null } },
      select: { studentId: true, invoiceId: true },
    }),
  ]);
  const byStudent = new Map<string, { id: string; amount: number; issuedAt: string }[]>();
  for (const inv of invoices) {
    const list = byStudent.get(inv.studentId) ?? [];
    list.push({ id: inv.id, amount: inv.amount, issuedAt: inv.issuedAt.toISOString() });
    byStudent.set(inv.studentId, list);
  }
  const paidMap = new Map(paid.map((p) => [p.studentId, p._sum.amount ?? 0]));
  const pendingMap = new Map<string, Set<string>>();
  for (const p of pending) {
    const set = pendingMap.get(p.studentId) ?? new Set<string>();
    set.add(p.invoiceId!);
    pendingMap.set(p.studentId, set);
  }

  const ids = new Set([...byStudent.keys(), ...paidMap.keys()]);
  const result = new Map<string, StudentLedger>();
  for (const id of ids) {
    const invs = byStudent.get(id) ?? [];
    const totalPaid = paidMap.get(id) ?? 0;
    const { allocations, credit } = allocatePayments(invs, totalPaid ? [totalPaid] : []);
    const charged = invs.reduce((s, i) => s + i.amount, 0);
    result.set(id, {
      allocations,
      credit,
      balance: charged - totalPaid,
      pendingClaimInvoiceIds: pendingMap.get(id) ?? new Set(),
    });
  }
  return result;
}

export function displayStateOf(
  inv: Pick<LedgerInvoiceRow, "id" | "status" | "sentAt">,
  ledger: StudentLedger | undefined,
  settings: AppSettings,
  today = todayKey(),
): { state: InvoiceDisplayState; daysSinceSent: number | null; priorDebt: number; remaining: number; paid: number; totalDue: number } {
  const allocations = ledger?.allocations ?? [];
  const alloc = allocations.find((a) => a.id === inv.id);
  const due = invoiceDue(allocations, inv.id);
  // todayKey(date) = ngày VN của thời điểm đó — gửi lúc 23h vẫn tính đúng ngày.
  const daysSinceSent = inv.sentAt ? diffDays(todayKey(inv.sentAt), today) : null;
  const state = invoiceDisplayState({
    status: inv.status,
    paymentState: alloc?.state ?? "UNPAID",
    hasPendingClaim: ledger?.pendingClaimInvoiceIds.has(inv.id) ?? false,
    daysSinceSent,
    overdueAfterDays: settings.reminders.gentleAfterDays,
  });
  return { state, daysSinceSent, ...due };
}

// ─────────────────── Danh sách phiếu (trang Thu tiền) ───────────────────

export type InvoiceListItem = Awaited<ReturnType<typeof listInvoices>>[number];

export async function listInvoices() {
  const settings = await getSettings();
  const invoices = await prisma.invoice.findMany({
    where: { status: { not: "VOID" } },
    orderBy: [{ issuedAt: "desc" }],
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          avatarHue: true,
          hardship: true,
          parentName: true,
          parentPhone: true,
          status: true,
          classroom: { select: { name: true } },
        },
      },
    },
  });
  const [ledgers, claims] = await Promise.all([
    loadLedgers([...new Set(invoices.map((i) => i.studentId))]),
    prisma.payment.findMany({
      where: { status: "PENDING", invoiceId: { not: null } },
      select: { id: true, invoiceId: true, amount: true, paidAt: true },
    }),
  ]);
  const claimByInvoice = new Map(claims.map((c) => [c.invoiceId!, c]));
  const today = todayKey();
  return invoices.map((inv) => {
    const ledger = ledgers.get(inv.studentId);
    const s = displayStateOf(inv, ledger, settings, today);
    return {
      id: inv.id,
      code: inv.code,
      cycleNo: inv.cycleNo,
      sessionCount: inv.sessionCount,
      amount: inv.amount,
      issuedAt: inv.issuedAt.toISOString(),
      sentAt: inv.sentAt?.toISOString() ?? null,
      student: { ...inv.student, classroom: inv.student.classroom.name },
      ...s,
      tone: reminderTone(s.daysSinceSent ?? 0, inv.student.hardship, settings.reminders),
      publicToken: inv.publicToken,
      claim: (() => {
        const c = claimByInvoice.get(inv.id);
        return c ? { id: c.id, amount: c.amount, at: c.paidAt.toISOString() } : null;
      })(),
    };
  });
}

// ─────────────────── Chi tiết phiếu ───────────────────

export async function getInvoiceDetail(id: string) {
  const settings = await getSettings();
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: [{ date: "asc" }, { id: "asc" }] },
      adjustments: { orderBy: { createdAt: "asc" } },
      messageLogs: { orderBy: { createdAt: "desc" }, take: 10 },
      student: {
        select: {
          id: true,
          code: true,
          fullName: true,
          avatarHue: true,
          hardship: true,
          parentName: true,
          parentPhone: true,
          classroom: { select: { name: true } },
          siblingGroup: { select: { label: true } },
        },
      },
    },
  });
  if (!invoice) return null;
  const [ledgers, payments] = await Promise.all([
    loadLedgers([invoice.studentId]),
    prisma.payment.findMany({
      where: { studentId: invoice.studentId, status: { not: "REJECTED" } },
      orderBy: { paidAt: "desc" },
      take: 20,
    }),
  ]);
  const ledger = ledgers.get(invoice.studentId);
  const s = displayStateOf(invoice, ledger, settings);
  return {
    invoice,
    ...s,
    balance: ledger?.balance ?? 0,
    tone: reminderTone(s.daysSinceSent ?? 0, invoice.student.hardship, settings.reminders),
    payments,
    settings,
    publicUrl: `${process.env.APP_URL ?? ""}/p/${invoice.publicToken}`,
  };
}

// ─────────────────── Phiếu công khai cho phụ huynh ───────────────────

/** Phiếu hết hạn link sau 30 ngày kể từ khi đã đóng đủ. */
const PUBLIC_LINK_DAYS_AFTER_PAID = 30;

/**
 * DTO cho trang /p/<token> — CHỌN TRƯỜNG TƯỜNG MINH. Không bao giờ trả:
 * ghi chú riêng tư, cờ gia đình khó khăn, SĐT, lý do sửa tay của cô.
 */
export async function getPublicInvoice(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const invoice = await prisma.invoice.findUnique({
    where: { publicToken: token },
    select: {
      id: true,
      code: true,
      status: true,
      sentAt: true,
      issuedAt: true,
      studentId: true,
      sessionCount: true,
      subtotal: true,
      discountAmount: true,
      discountLabel: true,
      adjustmentTotal: true,
      roundingAmount: true,
      amount: true,
      lines: {
        orderBy: [{ date: "asc" }, { id: "asc" }],
        select: { date: true, label: true, unitPrice: true, waived: true },
      },
      student: { select: { fullName: true, classroom: { select: { name: true } } } },
    },
  });
  if (!invoice || invoice.status === "VOID") return null;

  const settings = await getSettings();
  const ledger = (await loadLedgers([invoice.studentId])).get(invoice.studentId);
  const s = displayStateOf(invoice, ledger, settings);

  if (s.state === "PAID") {
    const lastPayment = await prisma.payment.findFirst({
      where: { studentId: invoice.studentId, status: "CONFIRMED" },
      orderBy: { paidAt: "desc" },
      select: { paidAt: true },
    });
    if (lastPayment && Date.now() - lastPayment.paidAt.getTime() > PUBLIC_LINK_DAYS_AFTER_PAID * 86_400_000) {
      return { expired: true as const };
    }
  }

  // Buổi vắng KHÔNG tính tiền trong khoảng thời gian của phiếu — ghi chú cho minh bạch.
  const first = invoice.lines[0]?.date;
  const last = invoice.lines.at(-1)?.date;
  const notCharged =
    first && last
      ? await prisma.attendance.findMany({
          where: { studentId: invoice.studentId, billable: false, date: { gte: first, lte: last } },
          select: { date: true, status: true },
          orderBy: { date: "asc" },
        })
      : [];

  return {
    expired: false as const,
    code: invoice.code,
    studentName: invoice.student.fullName,
    classroom: invoice.student.classroom.name,
    issuedAt: invoice.issuedAt.toISOString(),
    sessionCount: invoice.sessionCount,
    lines: invoice.lines.map((l) => ({ date: fromDbDate(l.date), label: l.label, unitPrice: l.unitPrice, waived: l.waived })),
    notCharged: notCharged.map((n) => ({ date: fromDbDate(n.date), status: n.status })),
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    discountLabel: invoice.discountLabel,
    adjustmentTotal: invoice.adjustmentTotal,
    roundingAmount: invoice.roundingAmount,
    amount: invoice.amount,
    priorDebt: s.priorDebt,
    paid: s.paid,
    totalDue: s.totalDue,
    state: s.state,
    teacherName: settings.teacherName,
    bank: settings.bank.accountNo ? settings.bank : null,
    hour: vnNow().hour,
  };
}

export type PublicInvoice = NonNullable<Awaited<ReturnType<typeof getPublicInvoice>>>;
