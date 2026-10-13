/**
 * LÕI TÍNH HỌC PHÍ — hàm thuần, không import Prisma, không đọc đồng hồ.
 *
 * Mọi con số tiền trong app đều đi qua file này: service chỉ đọc DB, gọi các hàm ở đây,
 * rồi ghi kết quả. Nhờ vậy toàn bộ quy tắc tiền được kiểm thử bằng Vitest
 * (`billing.core.test.ts`) mà không cần database.
 *
 * Tiền luôn là số nguyên đồng. Mọi phép chia đều làm tròn theo hướng có lợi cho phụ huynh.
 */

export type AttendanceStatus = "PRESENT" | "EXCUSED" | "UNEXCUSED";
export type DiscountType = "PERCENT" | "FIXED";
export type DiscountApplyTo = "ALL" | "FROM_SECOND";

export type BillingSettings = {
  defaultUnitPrice: number;
  cycleLength: number;
  countExcused: boolean;
  countUnexcused: boolean;
  /** Làm tròn xuống số phải đóng tới bội số này (1000 = tròn nghìn; 1 = không làm tròn). */
  roundTo: number;
};

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  defaultUnitPrice: 80_000,
  cycleLength: 10,
  countExcused: true,
  countUnexcused: true,
  roundTo: 1_000,
};

// ─────────────────── Buổi nào được tính tiền ───────────────────

/** Có mặt luôn tính; vắng có phép / không phép tùy cài đặt của cô. */
export function isBillable(status: AttendanceStatus, settings: BillingSettings): boolean {
  if (status === "PRESENT") return true;
  if (status === "EXCUSED") return settings.countExcused;
  return settings.countUnexcused;
}

/** Đơn giá riêng của em, nếu không có thì theo mặc định. */
export function effectiveUnitPrice(studentPrice: number | null | undefined, settings: BillingSettings): number {
  return studentPrice ?? settings.defaultUnitPrice;
}

// ─────────────────── Chia chu kỳ ───────────────────

export type BillableItem = { id: string; date: string; unitPrice: number };

/**
 * Lấy các buổi tính tiền CHƯA vào phiếu, xếp cũ → mới, cắt thành từng chu kỳ đủ `cycleLength`.
 * Phần dư (chưa đủ chu kỳ) giữ lại cho lần sau. Không bao giờ tạo phiếu thiếu buổi.
 *
 * Vào học muộn không cần xử lý riêng: em chỉ có buổi từ ngày bắt đầu học,
 * nên chu kỳ tự tính từ buổi đầu tiên.
 */
export function planCycles<T extends BillableItem>(
  uninvoiced: readonly T[],
  cycleLength: number,
): { cycles: T[][]; remaining: T[] } {
  if (!Number.isInteger(cycleLength) || cycleLength < 1) {
    throw new Error(`cycleLength không hợp lệ: ${cycleLength}`);
  }
  const sorted = [...uninvoiced].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const cycles: T[][] = [];
  let i = 0;
  while (sorted.length - i >= cycleLength) {
    cycles.push(sorted.slice(i, i + cycleLength));
    i += cycleLength;
  }
  return { cycles, remaining: sorted.slice(i) };
}

// ─────────────────── Nhịp chu kỳ theo CA ───────────────────
//
// Cả ca đi chung một nhịp: ca học xong đủ N buổi (sau "mốc khép kỳ" gần nhất) là khép kỳ,
// MỌI em trong ca được ra phiếu cùng lúc. Em mới vào giữa kỳ chỉ có các buổi đã học → phiếu đầu ngắn hơn,
// không bao giờ bị tính buổi chưa học. Mốc là khóa của buổi khép kỳ — lưu ở Shift.cycleMark.

/** Khóa thứ tự của một buổi, so sánh được như chuỗi: "2026-10-02 17:30". Buổi cộng tay dùng giờ "00:00". */
export function sessionKey(date: string, time: string): string {
  return `${date} ${time}`;
}

/**
 * Vị trí của ca trong chu kỳ và các lần khép kỳ mới.
 * `completed`: khóa các buổi ĐÃ XONG của ca (buổi hủy không tính). `mark`: mốc khép kỳ đang lưu (null = chưa khép lần nào).
 * Đếm các buổi sau mốc; cứ đủ `cycleLength` buổi là một lần khép. Cô giảm số buổi giữa chừng → khép ngay nếu đã qua đủ.
 */
export function shiftCycle(
  completed: readonly string[],
  mark: string | null,
  cycleLength: number,
): { position: number; closes: string[]; mark: string | null } {
  if (!Number.isInteger(cycleLength) || cycleLength < 1) {
    throw new Error(`cycleLength không hợp lệ: ${cycleLength}`);
  }
  const after = [...completed].filter((k) => mark === null || k > mark).sort();
  const closes: string[] = [];
  for (let i = cycleLength - 1; i < after.length; i += cycleLength) closes.push(after[i]);
  return {
    position: after.length - closes.length * cycleLength,
    closes,
    mark: closes.at(-1) ?? mark,
  };
}

/**
 * Chia các buổi tính tiền CHƯA vào phiếu của một em theo nhịp ca của em.
 * - Buổi thuộc các kỳ ĐÃ KHÉP (khóa ≤ mốc) → gộp thành MỘT phiếu. Gồm cả kỳ đầu ngắn của em mới vào,
 *   buổi học bù thêm, buổi lớp khép nhiều kỳ một lúc — không tách thành phiếu lẻ.
 * - Buổi sau mốc → chờ ca khép kỳ sau.
 * - `catchUp` (cô cộng tay buổi cũ): phần chờ mà đủ chu kỳ thì ra phiếu ngay theo từng chu kỳ đủ.
 * - Em không thuộc ca nào (`mark` undefined): theo nhịp riêng của em như trước (`planCycles`).
 */
export function planClassInvoices<T extends BillableItem & { key: string }>(
  uninvoiced: readonly T[],
  rhythm: { mark: string | null | undefined; cycleLength: number; catchUp?: boolean },
): { invoices: T[][]; waiting: T[] } {
  if (rhythm.mark === undefined) {
    const { cycles, remaining } = planCycles(uninvoiced, rhythm.cycleLength);
    return { invoices: cycles, waiting: remaining };
  }
  const mark = rhythm.mark;
  const sorted = [...uninvoiced].sort((a, b) => a.key.localeCompare(b.key) || a.id.localeCompare(b.id));
  const due = mark === null ? [] : sorted.filter((i) => i.key <= mark);
  const later = mark === null ? sorted : sorted.filter((i) => i.key > mark);
  const invoices: T[][] = due.length > 0 ? [due] : [];
  if (!rhythm.catchUp) return { invoices, waiting: later };
  const { cycles, remaining } = planCycles(later, rhythm.cycleLength);
  return { invoices: [...invoices, ...cycles], waiting: remaining };
}

/** Tiến độ chu kỳ hiện tại để vẽ hàng cherry (7/10). */
export function cycleProgress(uninvoicedCount: number, cycleLength: number) {
  const count = Math.min(uninvoicedCount, cycleLength);
  return { count, cycleLength, complete: uninvoicedCount >= cycleLength };
}

// ─────────────────── Giảm anh chị em ───────────────────

export type SiblingDiscount = {
  type: DiscountType;
  value: number;
  applyTo: DiscountApplyTo;
};

/**
 * Tiền giảm anh chị em cho một phiếu.
 * - PERCENT: làm tròn LÊN tới đồng (phụ huynh không bao giờ thiệt vì làm tròn).
 * - FIXED: không giảm quá tạm tính.
 * - FROM_SECOND: em đầu tiên của nhóm (`isFirstChild`) không được giảm.
 */
export function siblingDiscountAmount(
  subtotal: number,
  discount: SiblingDiscount | null | undefined,
  isFirstChild: boolean,
): number {
  if (!discount || subtotal <= 0 || discount.value <= 0) return 0;
  if (discount.applyTo === "FROM_SECOND" && isFirstChild) return 0;
  if (discount.type === "PERCENT") {
    const pct = Math.min(discount.value, 100);
    return Math.min(subtotal, Math.ceil((subtotal * pct) / 100));
  }
  return Math.min(subtotal, discount.value);
}

export function discountLabel(discount: SiblingDiscount): string {
  return discount.type === "PERCENT"
    ? `Giảm anh chị em ${discount.value}%`
    : `Giảm anh chị em ${formatPlain(discount.value)}đ`;
}

/**
 * Em đầu tiên của nhóm = nhập học sớm nhất; trùng ngày thì mã học sinh nhỏ hơn.
 * Cách chọn cố định để phiếu in lại ngày nào cũng ra cùng kết quả.
 */
export function firstChildId(members: readonly { id: string; code: string; joinedAt: string }[]): string | null {
  if (members.length === 0) return null;
  const sorted = [...members].sort(
    (a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.code.localeCompare(b.code),
  );
  return sorted[0].id;
}

// ─────────────────── Tính tiền một phiếu ───────────────────

export type InvoiceLineInput = { unitPrice: number; waived?: boolean };

export type InvoiceAmounts = {
  sessionCount: number;
  subtotal: number;
  discountAmount: number;
  adjustmentTotal: number;
  roundingAmount: number;
  amount: number;
};

/** Làm tròn XUỐNG tới bội số `roundTo`. Trả về phần chênh (≤ 0). */
export function roundingDelta(value: number, roundTo: number): number {
  if (roundTo <= 1 || value <= 0) return 0;
  const remainder = value % roundTo;
  // Tránh trả -0: JSON/DB vẫn ổn nhưng so sánh Object.is và hiển thị "-0đ" thì sai.
  return remainder === 0 ? 0 : -remainder;
}

/**
 * Công thức duy nhất cho số tiền của một phiếu:
 *   amount = subtotal − discount + adjustments + rounding
 * - subtotal: Σ đơn giá các buổi, buổi được miễn = 0.
 * - giảm anh chị em tính trên subtotal.
 * - adjustments: các lần cô sửa tay (±), đã có lý do.
 * - rounding: làm tròn xuống tới nghìn ở bước CUỐI CÙNG.
 * Kết quả âm là dữ liệu sai (cô giảm quá tay) → ném lỗi để action chặn lại, không lưu.
 */
export function computeInvoiceAmounts(input: {
  lines: readonly InvoiceLineInput[];
  discount?: SiblingDiscount | null;
  isFirstChild?: boolean;
  adjustments?: readonly number[];
  roundTo: number;
}): InvoiceAmounts {
  for (const line of input.lines) {
    if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new Error(`Đơn giá không hợp lệ: ${line.unitPrice}`);
    }
  }
  const subtotal = input.lines.reduce((sum, l) => sum + (l.waived ? 0 : l.unitPrice), 0);
  const discountAmount = siblingDiscountAmount(subtotal, input.discount, input.isFirstChild ?? false);
  const adjustmentTotal = (input.adjustments ?? []).reduce((sum, d) => sum + d, 0);
  const beforeRounding = subtotal - discountAmount + adjustmentTotal;
  if (beforeRounding < 0) {
    throw new Error("NEGATIVE_INVOICE");
  }
  const roundingAmount = roundingDelta(beforeRounding, input.roundTo);
  return {
    sessionCount: input.lines.length,
    subtotal,
    discountAmount,
    adjustmentTotal,
    roundingAmount,
    amount: beforeRounding + roundingAmount,
  };
}

// ─────────────────── Sổ cái & phân bổ tiền ───────────────────

export type LedgerInvoice = { id: string; amount: number; issuedAt: string };
export type PaymentState = "UNPAID" | "PARTIAL" | "PAID";

export type InvoiceAllocation = {
  id: string;
  amount: number;
  paid: number;
  remaining: number;
  state: PaymentState;
};

/**
 * Số dư của một em = Σ phiếu (không tính phiếu hủy) − Σ tiền ĐÃ XÁC NHẬN.
 * Dương = còn nợ, âm = đóng thừa (tự trừ vào phiếu sau).
 */
export function studentBalance(invoiceAmounts: readonly number[], confirmedPayments: readonly number[]): number {
  const charged = invoiceAmounts.reduce((s, a) => s + a, 0);
  const paid = confirmedPayments.reduce((s, a) => s + a, 0);
  return charged - paid;
}

/**
 * Phân bổ tiền đã nhận vào phiếu cũ nhất trước (FIFO) để biết từng phiếu
 * "Chưa thu / Đóng thiếu / Đã thu". Trạng thái không lưu DB — luôn tính lại từ đây.
 */
export function allocatePayments(
  invoices: readonly LedgerInvoice[],
  confirmedPayments: readonly number[],
): { allocations: InvoiceAllocation[]; credit: number } {
  let pool = confirmedPayments.reduce((s, a) => s + a, 0);
  const sorted = [...invoices].sort(
    (a, b) => a.issuedAt.localeCompare(b.issuedAt) || a.id.localeCompare(b.id),
  );
  const allocations = sorted.map((inv) => {
    const paid = Math.min(pool, inv.amount);
    pool -= paid;
    const remaining = inv.amount - paid;
    const state: PaymentState = remaining === 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
    return { id: inv.id, amount: inv.amount, paid, remaining, state };
  });
  return { allocations, credit: pool };
}

/**
 * "Tổng cần đóng" in trên phiếu = nợ/thừa kỳ trước + tiền phiếu này.
 * Không bao giờ âm: thừa nhiều hơn tiền phiếu thì phiếu này coi như đã đủ.
 */
export function amountDueOnInvoice(openingBalance: number, amount: number): number {
  return Math.max(0, openingBalance + amount);
}

export type InvoiceDisplayState = "READY" | "WAITING" | "OVERDUE" | "PARTIAL" | "CLAIMED" | "PAID" | "VOID";

/**
 * Trạng thái hiển thị của phiếu, ưu tiên theo thứ tự:
 * Hủy → Đã thu → Phụ huynh báo đã chuyển (chờ cô xác nhận) → Cần gửi → Đóng thiếu → Quá hạn → Chờ đóng.
 */
export function invoiceDisplayState(input: {
  status: "READY" | "SENT" | "VOID";
  paymentState: PaymentState;
  hasPendingClaim: boolean;
  daysSinceSent: number | null;
  overdueAfterDays: number;
}): InvoiceDisplayState {
  if (input.status === "VOID") return "VOID";
  if (input.paymentState === "PAID") return "PAID";
  if (input.hasPendingClaim) return "CLAIMED";
  if (input.status === "READY") return "READY";
  if (input.paymentState === "PARTIAL") return "PARTIAL";
  if ((input.daysSinceSent ?? 0) >= input.overdueAfterDays) return "OVERDUE";
  return "WAITING";
}

/**
 * Số tiền in trên phiếu, tính SỐNG từ sổ cái (không dùng số chụp lúc tạo):
 * nợ kỳ trước = phần còn thiếu của các phiếu cũ hơn; cần đóng = nợ kỳ trước + phần còn thiếu của phiếu này.
 * Tiền thừa đã tự trừ qua phân bổ FIFO.
 */
export function invoiceDue(allocations: readonly InvoiceAllocation[], invoiceId: string) {
  const index = allocations.findIndex((a) => a.id === invoiceId);
  if (index < 0) return { priorDebt: 0, remaining: 0, paid: 0, totalDue: 0 };
  const priorDebt = allocations.slice(0, index).reduce((s, a) => s + a.remaining, 0);
  const me = allocations[index];
  return { priorDebt, remaining: me.remaining, paid: me.paid, totalDue: priorDebt + me.remaining };
}

/**
 * Phiếu phụ huynh cần đóng, trong các phiếu ĐÃ GỬI: phiếu MỚI NHẤT còn thiếu tiền.
 * Số "cần đóng" của nó (`totalDue`, tính sống) đã gồm phần thiếu của mọi phiếu cũ hơn — nên các phiếu cũ còn thiếu
 * là "đã gộp" vào phiếu này, KHÔNG cộng thêm. `waitingConfirm`: phụ huynh đã báo chuyển phiếu này, chờ cô xác nhận.
 */
export function invoiceToPay<T extends { issuedAt: string; remaining: number; totalDue: number; claimed: boolean }>(
  sent: readonly T[],
): { invoice: T; merged: T[]; amount: number; waitingConfirm: boolean } | null {
  const unpaid = sent.filter((i) => i.remaining > 0).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  if (unpaid.length === 0) return null;
  const [latest, ...older] = unpaid;
  return { invoice: latest, merged: older, amount: latest.totalDue, waitingConfirm: latest.claimed };
}

// ─────────────────── Tiền về tài khoản (webhook ngân hàng) ───────────────────

/**
 * Đọc mã phiếu "PT-2026-0139" trong nội dung chuyển khoản. Ngân hàng hay bỏ dấu gạch, đổi hoa/thường,
 * chèn mã giao dịch phía trước — nên chấp nhận "PT20260139", "pt 2026 0139", "PT.2026.139".
 * Không thấy mã, hoặc thấy HAI mã khác nhau → null (không đoán; cô gán tay).
 */
export function parseInvoiceCode(content: string): string | null {
  const found = new Set<string>();
  const re = /(?<![A-Z0-9])P\s*T[\s\-_.]*(\d{4})[\s\-_.]*(\d{1,6})(?!\d)/gi;
  for (const m of content.matchAll(re)) found.add(`PT-${m[1]}-${m[2].padStart(4, "0")}`);
  return found.size === 1 ? [...found][0] : null;
}

export type BankTransferDecision =
  | { kind: "IGNORE"; reason: string }
  | { kind: "UNMATCHED"; reason: string }
  | { kind: "MATCHED"; code: string; amount: number; fit: "FULL" | "SHORT" | "OVER" };

/**
 * Tiền về tài khoản nhận học phí thì làm gì:
 * - Có đúng một mã phiếu (chưa hủy) → ghi nhận ĐÚNG số tiền thật đã về, tự xác nhận. Thiếu/dư vẫn ghi nhận:
 *   tiền đã ở trong tài khoản; sổ cái tự chuyển phần thiếu/dư sang kỳ sau.
 * - Không đọc được mã / mã không có / phiếu đã hủy → chờ cô gán tay (không bao giờ đoán em nào).
 * - Tiền ra, số tiền ≤ 0, tài khoản khác → bỏ qua.
 */
export function decideBankTransfer(
  tx: { transferType: "in" | "out"; amount: number; accountNumber: string; content: string },
  ctx: { accountNo: string; invoice: { code: string; status: "READY" | "SENT" | "VOID"; totalDue: number } | null },
): BankTransferDecision {
  if (tx.transferType !== "in") return { kind: "IGNORE", reason: "Tiền ra khỏi tài khoản" };
  if (!Number.isInteger(tx.amount) || tx.amount <= 0) return { kind: "IGNORE", reason: "Số tiền không hợp lệ" };
  if (ctx.accountNo && tx.accountNumber.replace(/\D/g, "") !== ctx.accountNo.replace(/\D/g, "")) {
    return { kind: "IGNORE", reason: "Không phải tài khoản nhận học phí" };
  }
  const code = parseInvoiceCode(tx.content);
  if (!code) return { kind: "UNMATCHED", reason: "Nội dung chuyển khoản không có mã phiếu" };
  if (!ctx.invoice || ctx.invoice.code !== code) return { kind: "UNMATCHED", reason: `Không tìm thấy phiếu ${code}` };
  if (ctx.invoice.status === "VOID") return { kind: "UNMATCHED", reason: `Phiếu ${code} đã hủy` };
  const due = ctx.invoice.totalDue;
  const fit = tx.amount === due ? "FULL" : tx.amount < due ? "SHORT" : "OVER";
  return { kind: "MATCHED", code, amount: tx.amount, fit };
}

/** Mức nhắc theo số ngày kể từ khi gửi phiếu. Gia đình khó khăn luôn ở mức nhẹ nhất. */
export function reminderTone(
  daysSinceSent: number,
  hardship: boolean,
  thresholds: { gentleAfterDays: number; clearAfterDays: number },
): "FEE_SOFT" | "FEE_GENTLE" | "FEE_CLEAR" {
  if (hardship) return "FEE_SOFT";
  if (daysSinceSent >= thresholds.clearAfterDays) return "FEE_CLEAR";
  if (daysSinceSent >= thresholds.gentleAfterDays) return "FEE_GENTLE";
  return "FEE_SOFT";
}

function formatPlain(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
