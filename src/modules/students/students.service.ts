import type { Prisma } from "@/generated/prisma/client";
import { uninvoicedCounts } from "@/modules/attendance/attendance.service";
import { displayStateOf, loadLedgers } from "@/modules/billing/billing.service";
import { getSettings } from "@/modules/settings/settings.service";
import { fromDbDate, todayKey } from "@/lib/dates";
import { removeDiacritics } from "@/lib/utils";
import { prisma } from "@/shared/prisma/prisma.service";

type Tx = Prisma.TransactionClient;

export type StudentFilter = {
  q?: string;
  classroomId?: string;
  status?: "ACTIVE" | "PAUSED" | "LEFT" | "ALL";
};

/** Điều kiện tìm không dấu: mọi từ gõ vào đều phải xuất hiện trong tên bỏ dấu (hoặc SĐT, mã HS). */
export function searchWhere(q: string): Prisma.StudentWhereInput {
  const terms = removeDiacritics(q).split(" ").filter(Boolean);
  if (terms.length === 0) return {};
  const digits = q.replace(/\D/g, "");
  return {
    OR: [
      { AND: terms.map((t) => ({ searchName: { contains: t } })) },
      ...(digits.length >= 4 ? [{ parentPhone: { contains: digits } }, { studentPhone: { contains: digits } }] : []),
      { code: { equals: q.trim().toUpperCase() } },
    ],
  };
}

export async function listStudents(filter: StudentFilter = {}) {
  const status = filter.status ?? "ACTIVE";
  const students = await prisma.student.findMany({
    where: {
      deletedAt: null,
      ...(status === "ALL" ? {} : { status }),
      ...(filter.classroomId ? { classroomId: filter.classroomId } : {}),
      ...(filter.q ? searchWhere(filter.q) : {}),
    },
    orderBy: [{ classroom: { grade: "asc" } }, { classroom: { name: "asc" } }, { fullName: "asc" }],
    select: {
      id: true,
      code: true,
      fullName: true,
      avatarHue: true,
      status: true,
      hardship: true,
      parentName: true,
      parentPhone: true,
      unitPrice: true,
      siblingGroupId: true,
      classroom: { select: { id: true, name: true } },
      shift: { select: { name: true } },
    },
  });
  const ids = students.map((s) => s.id);
  const [counts, ledgers, settings] = await Promise.all([uninvoicedCounts(ids), loadLedgers(ids), getSettings()]);
  return {
    cycleLength: settings.billing.cycleLength,
    students: students.map((s) => ({
      ...s,
      counted: counts.get(s.id) ?? 0,
      balance: ledgers.get(s.id)?.balance ?? 0,
    })),
  };
}

export type StudentListItem = Awaited<ReturnType<typeof listStudents>>["students"][number];

/** Tìm nhanh (ô tìm kiếm luôn hiện, thêm em học bù). */
export async function quickSearch(q: string, take = 8) {
  if (!q.trim()) return [];
  return prisma.student.findMany({
    where: { deletedAt: null, status: { not: "LEFT" }, ...searchWhere(q) },
    take,
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      code: true,
      fullName: true,
      avatarHue: true,
      status: true,
      classroom: { select: { name: true } },
      shift: { select: { name: true } },
    },
  });
}

export type QuickSearchItem = Awaited<ReturnType<typeof quickSearch>>[number];

/** Sổ tay học sinh. `includePrivate` chỉ true khi người xem có quyền student.privateNotes. */
export async function getStudentNotebook(id: string, includePrivate: boolean) {
  const student = await prisma.student.findFirst({
    where: { id, deletedAt: null },
    include: {
      classroom: { select: { id: true, name: true, grade: true } },
      shift: { select: { id: true, name: true } },
      siblingGroup: {
        include: {
          students: {
            where: { deletedAt: null },
            select: { id: true, fullName: true, avatarHue: true, classroom: { select: { name: true } } },
          },
        },
      },
      notes: includePrivate ? { orderBy: { createdAt: "desc" } } : false,
    },
  });
  if (!student) return null;

  const settings = await getSettings();
  const [attendances, invoices, payments, ledgers] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId: id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 120,
      select: {
        id: true,
        date: true,
        status: true,
        source: true,
        isMakeup: true,
        note: true,
        billable: true,
        unitPrice: true,
        reason: true,
        invoiceLine: { select: { invoiceId: true } },
        session: { select: { shift: { select: { name: true } } } },
      },
    }),
    prisma.invoice.findMany({
      where: { studentId: id },
      orderBy: { issuedAt: "desc" },
      select: { id: true, code: true, cycleNo: true, amount: true, status: true, sentAt: true, issuedAt: true, sessionCount: true },
    }),
    prisma.payment.findMany({
      where: { studentId: id, status: { not: "REJECTED" } },
      orderBy: { paidAt: "desc" },
      take: 30,
    }),
    loadLedgers([id]),
  ]);
  const ledger = ledgers.get(id);
  const today = todayKey();

  const uninvoiced = attendances.filter((a) => a.billable && !a.invoiceLine).reverse();
  const sessionRows = attendances.filter((a) => a.source === "SESSION");
  const last30 = sessionRows.slice(0, 30);
  const presentRate = last30.length ? last30.filter((a) => a.status === "PRESENT").length / last30.length : null;

  return {
    student: {
      ...student,
      dob: student.dob ? fromDbDate(student.dob) : null,
      joinedAt: fromDbDate(student.joinedAt),
      notes: includePrivate ? (student.notes as { id: string; content: string; createdAt: Date }[]) : [],
      hardship: includePrivate ? student.hardship : false,
    },
    cycle: {
      length: settings.billing.cycleLength,
      count: uninvoiced.length,
      dates: uninvoiced.map((a) => fromDbDate(a.date)),
    },
    unitPrice: student.unitPrice ?? settings.billing.defaultUnitPrice,
    usesDefaultPrice: student.unitPrice === null,
    presentRate,
    attendances: attendances.map((a) => ({
      ...a,
      date: fromDbDate(a.date),
      shiftName: a.session?.shift.name ?? null,
      invoiceId: a.invoiceLine?.invoiceId ?? null,
    })),
    invoices: invoices.map((inv) => ({ ...inv, ...displayStateOf(inv, ledger, settings, today) })),
    payments,
    balance: ledger?.balance ?? 0,
  };
}

export type StudentNotebook = NonNullable<Awaited<ReturnType<typeof getStudentNotebook>>>;

export async function nextStudentCode(tx: Tx | typeof prisma = prisma): Promise<string> {
  const last = await tx.student.findFirst({ orderBy: { code: "desc" }, select: { code: true } });
  const n = last ? Number(last.code.replace(/\D/g, "")) + 1 : 1;
  return `HS${String(n).padStart(4, "0")}`;
}

export async function listSiblingGroups() {
  return prisma.siblingGroup.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      students: {
        where: { deletedAt: null },
        select: { id: true, fullName: true, avatarHue: true, classroom: { select: { name: true } } },
      },
    },
  });
}
