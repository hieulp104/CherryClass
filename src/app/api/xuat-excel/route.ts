import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";

import { can } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { listInvoices, loadLedgers } from "@/modules/billing/billing.service";
import { INVOICE_STATE_LABEL } from "@/modules/billing/billing.labels";
import { debtList, monthUtcRange } from "@/modules/finance/finance.service";
import { fromDbDate, monthLabel, monthRange, todayKey, toDbDate } from "@/lib/dates";
import { prisma } from "@/shared/prisma/prisma.service";

/**
 * Xuất Excel.
 *  - ?loai=thang&thang=2026-09 : báo cáo tháng (thu, phiếu, chi, còn nợ)
 *  - ?loai=toan-bo            : sao lưu toàn bộ dữ liệu (học sinh, điểm danh, phiếu, thu, chi)
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Chưa đăng nhập", { status: 401 });
  if (!can(user, "finance.view")) return new Response("Không có quyền", { status: 403 });

  const kind = request.nextUrl.searchParams.get("loai") ?? "thang";
  const month = request.nextUrl.searchParams.get("thang") ?? todayKey().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return new Response("Tháng không hợp lệ", { status: 400 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "TeamCherry";

  if (kind === "toan-bo") await fullBackup(wb);
  else await monthReport(wb, month);

  const buffer = await wb.xlsx.writeBuffer();
  const name = kind === "toan-bo" ? `TeamCherry_sao_luu_${todayKey()}.xlsx` : `TeamCherry_bao_cao_${month}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}

const MONEY = '#,##0" đ"';

function sheet(wb: ExcelJS.Workbook, name: string, columns: { header: string; key: string; width?: number; money?: boolean }[]) {
  const ws = wb.addWorksheet(name);
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16, style: c.money ? { numFmt: MONEY } : {} }));
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE11D48" } };
  head.height = 20;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return ws;
}

function vnDateTime(d: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function dmy(key: string) {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
}

async function monthReport(wb: ExcelJS.Workbook, month: string) {
  const range = monthUtcRange(month);
  const { from, to } = monthRange(month);

  const [payments, invoices, expenses, debts] = await Promise.all([
    prisma.payment.findMany({
      where: { status: "CONFIRMED", paidAt: range },
      orderBy: { paidAt: "asc" },
      include: { student: { select: { code: true, fullName: true, classroom: { select: { name: true } } } }, invoice: { select: { code: true } } },
    }),
    prisma.invoice.findMany({
      where: { status: { not: "VOID" }, issuedAt: range },
      orderBy: { issuedAt: "asc" },
      include: { student: { select: { code: true, fullName: true, classroom: { select: { name: true } } } } },
    }),
    prisma.expense.findMany({
      where: { deletedAt: null, spentOn: { gte: toDbDate(from), lte: toDbDate(to) } },
      orderBy: { spentOn: "asc" },
      include: { category: true },
    }),
    debtList(),
  ]);
  const states = new Map((await listInvoices()).map((i) => [i.id, i.state]));

  const income = payments.reduce((s, p) => s + p.amount, 0);
  const expense = expenses.reduce((s, e) => s + e.amount, 0);

  const sum = sheet(wb, "Tổng quan", [
    { header: "Chỉ số", key: "k", width: 30 },
    { header: "Giá trị", key: "v", width: 20, money: true },
  ]);
  sum.addRows([
    { k: monthLabel(month), v: null },
    { k: "Đã thu", v: income },
    { k: "Đã chi", v: expense },
    { k: "Lợi nhuận", v: income - expense },
    { k: "Phiếu phát hành trong tháng", v: invoices.reduce((s, i) => s + i.amount, 0) },
    { k: "Còn cần thu (tất cả các kỳ, tính tới hôm nay)", v: debts.reduce((s, d) => s + d.balance, 0) },
  ]);

  const p = sheet(wb, "Đã thu", [
    { header: "Ngày", key: "date", width: 12 },
    { header: "Mã HS", key: "code", width: 10 },
    { header: "Học sinh", key: "name", width: 26 },
    { header: "Lớp", key: "cls", width: 12 },
    { header: "Phiếu", key: "inv", width: 15 },
    { header: "Hình thức", key: "method", width: 14 },
    { header: "Số tiền", key: "amount", width: 15, money: true },
    { header: "Ghi chú", key: "note", width: 30 },
  ]);
  for (const x of payments) {
    p.addRow({
      date: vnDateTime(x.paidAt),
      code: x.student.code,
      name: x.student.fullName,
      cls: x.student.classroom.name,
      inv: x.invoice?.code ?? "",
      method: x.method === "CASH" ? "Tiền mặt" : "Chuyển khoản",
      amount: x.amount,
      note: x.note ?? "",
    });
  }
  p.addRow({ name: "TỔNG", amount: income }).font = { bold: true };

  const i = sheet(wb, "Phiếu thu", [
    { header: "Mã phiếu", key: "code", width: 15 },
    { header: "Ngày tạo", key: "date", width: 12 },
    { header: "Học sinh", key: "name", width: 26 },
    { header: "Lớp", key: "cls", width: 12 },
    { header: "Số buổi", key: "n", width: 9 },
    { header: "Tạm tính", key: "sub", width: 14, money: true },
    { header: "Giảm", key: "disc", width: 12, money: true },
    { header: "Điều chỉnh", key: "adj", width: 12, money: true },
    { header: "Làm tròn", key: "round", width: 10, money: true },
    { header: "Thành tiền", key: "amount", width: 14, money: true },
    { header: "Trạng thái", key: "state", width: 14 },
  ]);
  for (const x of invoices) {
    i.addRow({
      code: x.code,
      date: vnDateTime(x.issuedAt),
      name: x.student.fullName,
      cls: x.student.classroom.name,
      n: x.sessionCount,
      sub: x.subtotal,
      disc: -x.discountAmount,
      adj: x.adjustmentTotal,
      round: x.roundingAmount,
      amount: x.amount,
      state: INVOICE_STATE_LABEL[states.get(x.id) ?? "WAITING"],
    });
  }

  const e = sheet(wb, "Chi phí", [
    { header: "Ngày", key: "date", width: 12 },
    { header: "Danh mục", key: "cat", width: 20 },
    { header: "Số tiền", key: "amount", width: 15, money: true },
    { header: "Ghi chú", key: "note", width: 36 },
  ]);
  for (const x of expenses) e.addRow({ date: dmy(fromDbDate(x.spentOn)), cat: x.category.name, amount: x.amount, note: x.note ?? "" });
  e.addRow({ cat: "TỔNG", amount: expense }).font = { bold: true };

  const d = sheet(wb, "Còn nợ", [
    { header: "Học sinh", key: "name", width: 26 },
    { header: "Lớp", key: "cls", width: 12 },
    { header: "Số phiếu chưa đủ", key: "n", width: 16 },
    { header: "Số ngày", key: "days", width: 10 },
    { header: "Còn thiếu", key: "amount", width: 15, money: true },
  ]);
  for (const x of debts) d.addRow({ name: x.fullName, cls: x.classroom, n: x.invoiceCount, days: x.daysOutstanding, amount: x.balance });
}

async function fullBackup(wb: ExcelJS.Workbook) {
  const [students, attendances, invoices, payments, expenses, ledgers] = await Promise.all([
    prisma.student.findMany({
      where: { deletedAt: null },
      orderBy: { code: "asc" },
      include: { classroom: true, shift: true, siblingGroup: true },
    }),
    prisma.attendance.findMany({
      orderBy: [{ date: "asc" }],
      include: { student: { select: { code: true, fullName: true } }, session: { include: { shift: { include: { classroom: true } } } }, invoiceLine: { include: { invoice: { select: { code: true } } } } },
    }),
    prisma.invoice.findMany({ orderBy: { issuedAt: "asc" }, include: { student: { select: { code: true, fullName: true } } } }),
    prisma.payment.findMany({ orderBy: { paidAt: "asc" }, include: { student: { select: { code: true, fullName: true } }, invoice: { select: { code: true } } } }),
    prisma.expense.findMany({ where: { deletedAt: null }, orderBy: { spentOn: "asc" }, include: { category: true } }),
    loadLedgers(),
  ]);

  const s = sheet(wb, "Học sinh", [
    { header: "Mã", key: "code", width: 9 },
    { header: "Họ tên", key: "name", width: 26 },
    { header: "Lớp", key: "cls", width: 12 },
    { header: "Ca", key: "shift", width: 10 },
    { header: "Trạng thái", key: "status", width: 11 },
    { header: "Ngày sinh", key: "dob", width: 12 },
    { header: "Phụ huynh", key: "parent", width: 18 },
    { header: "SĐT phụ huynh", key: "pphone", width: 14 },
    { header: "SĐT học sinh", key: "sphone", width: 14 },
    { header: "Trường", key: "school", width: 20 },
    { header: "Đơn giá riêng", key: "price", width: 13, money: true },
    { header: "Nhóm anh chị em", key: "sib", width: 18 },
    { header: "Ngày vào học", key: "joined", width: 12 },
    { header: "Số dư (+ còn nợ / − đóng thừa)", key: "bal", width: 18, money: true },
  ]);
  const statusLabel = { ACTIVE: "Đang học", PAUSED: "Tạm nghỉ", LEFT: "Đã nghỉ" } as const;
  for (const x of students) {
    s.addRow({
      code: x.code,
      name: x.fullName,
      cls: x.classroom.name,
      shift: x.shift?.name ?? "",
      status: statusLabel[x.status],
      dob: x.dob ? dmy(fromDbDate(x.dob)) : "",
      parent: x.parentName ?? "",
      pphone: x.parentPhone ?? "",
      sphone: x.studentPhone ?? "",
      school: x.school ?? "",
      price: x.unitPrice,
      sib: x.siblingGroup?.label ?? "",
      joined: dmy(fromDbDate(x.joinedAt)),
      bal: ledgers.get(x.id)?.balance ?? 0,
    });
  }

  const a = sheet(wb, "Điểm danh", [
    { header: "Ngày", key: "date", width: 12 },
    { header: "Mã HS", key: "code", width: 9 },
    { header: "Học sinh", key: "name", width: 26 },
    { header: "Buổi", key: "sess", width: 20 },
    { header: "Trạng thái", key: "status", width: 16 },
    { header: "Tính tiền", key: "bill", width: 10 },
    { header: "Đơn giá", key: "price", width: 12, money: true },
    { header: "Phiếu", key: "inv", width: 15 },
    { header: "Ghi chú", key: "note", width: 30 },
  ]);
  const att = { PRESENT: "Có mặt", EXCUSED: "Vắng có phép", UNEXCUSED: "Vắng không phép" } as const;
  for (const x of attendances) {
    a.addRow({
      date: dmy(fromDbDate(x.date)),
      code: x.student.code,
      name: x.student.fullName,
      sess: x.session ? `${x.session.shift.classroom.name} · ${x.session.shift.name}` : `Cộng tay${x.reason ? `: ${x.reason}` : ""}`,
      status: att[x.status],
      bill: x.billable ? "Có" : "Không",
      price: x.unitPrice,
      inv: x.invoiceLine?.invoice.code ?? "",
      note: x.note ?? "",
    });
  }

  const i = sheet(wb, "Phiếu thu", [
    { header: "Mã phiếu", key: "code", width: 15 },
    { header: "Ngày tạo", key: "date", width: 12 },
    { header: "Mã HS", key: "scode", width: 9 },
    { header: "Học sinh", key: "name", width: 26 },
    { header: "Số buổi", key: "n", width: 9 },
    { header: "Thành tiền", key: "amount", width: 14, money: true },
    { header: "Trạng thái", key: "status", width: 12 },
  ]);
  const st = { READY: "Chưa gửi", SENT: "Đã gửi", VOID: "Đã hủy" } as const;
  for (const x of invoices) {
    i.addRow({ code: x.code, date: vnDateTime(x.issuedAt), scode: x.student.code, name: x.student.fullName, n: x.sessionCount, amount: x.amount, status: st[x.status] });
  }

  const p = sheet(wb, "Thu tiền", [
    { header: "Ngày", key: "date", width: 12 },
    { header: "Mã HS", key: "code", width: 9 },
    { header: "Học sinh", key: "name", width: 26 },
    { header: "Phiếu", key: "inv", width: 15 },
    { header: "Số tiền", key: "amount", width: 14, money: true },
    { header: "Trạng thái", key: "status", width: 14 },
    { header: "Ghi chú", key: "note", width: 30 },
  ]);
  const ps = { PENDING: "Chờ xác nhận", CONFIRMED: "Đã nhận", REJECTED: "Đã hủy" } as const;
  for (const x of payments) {
    p.addRow({ date: vnDateTime(x.paidAt), code: x.student.code, name: x.student.fullName, inv: x.invoice?.code ?? "", amount: x.amount, status: ps[x.status], note: x.note ?? "" });
  }

  const e = sheet(wb, "Chi phí", [
    { header: "Ngày", key: "date", width: 12 },
    { header: "Danh mục", key: "cat", width: 20 },
    { header: "Số tiền", key: "amount", width: 14, money: true },
    { header: "Ghi chú", key: "note", width: 36 },
  ]);
  for (const x of expenses) e.addRow({ date: dmy(fromDbDate(x.spentOn)), cat: x.category.name, amount: x.amount, note: x.note ?? "" });
}
