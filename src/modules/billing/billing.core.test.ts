import { describe, expect, it } from "vitest";

import {
  DEFAULT_BILLING_SETTINGS,
  allocatePayments,
  amountDueOnInvoice,
  computeInvoiceAmounts,
  cycleProgress,
  effectiveUnitPrice,
  firstChildId,
  invoiceDisplayState,
  invoiceDue,
  invoiceToPay,
  decideBankTransfer,
  parseInvoiceCode,
  planClassInvoices,
  sessionKey,
  shiftCycle,
  isBillable,
  planCycles,
  reminderTone,
  roundingDelta,
  siblingDiscountAmount,
  studentBalance,
  type AttendanceStatus,
  type BillableItem,
  type BillingSettings,
} from "./billing.core";

/** Mô phỏng chuỗi điểm danh của một em → các buổi tính tiền, giống service làm lúc "Xong buổi". */
function billableFrom(
  rows: { date: string; status: AttendanceStatus; price?: number }[],
  settings: BillingSettings,
  studentPrice: number | null = null,
): BillableItem[] {
  return rows
    .filter((r) => isBillable(r.status, settings))
    .map((r, i) => ({
      id: `a${String(i).padStart(3, "0")}`,
      date: r.date,
      unitPrice: r.price ?? effectiveUnitPrice(studentPrice, settings),
    }));
}

const S: BillingSettings = { ...DEFAULT_BILLING_SETTINGS }; // 80k, 10 buổi, tính cả vắng, tròn nghìn

describe("buổi nào được tính tiền", () => {
  it("có mặt luôn tính", () => {
    expect(isBillable("PRESENT", { ...S, countExcused: false, countUnexcused: false })).toBe(true);
  });

  it("vắng có phép theo cài đặt", () => {
    expect(isBillable("EXCUSED", { ...S, countExcused: true })).toBe(true);
    expect(isBillable("EXCUSED", { ...S, countExcused: false })).toBe(false);
  });

  it("vắng không phép theo cài đặt", () => {
    expect(isBillable("UNEXCUSED", { ...S, countUnexcused: true })).toBe(true);
    expect(isBillable("UNEXCUSED", { ...S, countUnexcused: false })).toBe(false);
  });

  it("đơn giá riêng ưu tiên hơn mặc định", () => {
    expect(effectiveUnitPrice(null, S)).toBe(80_000);
    expect(effectiveUnitPrice(70_000, S)).toBe(70_000);
    expect(effectiveUnitPrice(0, S)).toBe(0); // học bổng: 0đ vẫn là giá riêng, không rơi về mặc định
  });
});

describe("chia chu kỳ", () => {
  const items = (n: number, start = 1): BillableItem[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `x${i}`,
      date: `2026-09-${String(start + i).padStart(2, "0")}`,
      unitPrice: 80_000,
    }));

  it("chưa đủ chu kỳ thì không tạo phiếu", () => {
    const { cycles, remaining } = planCycles(items(9), 10);
    expect(cycles).toHaveLength(0);
    expect(remaining).toHaveLength(9);
  });

  it("đủ đúng 10 buổi thì tạo một phiếu", () => {
    const { cycles, remaining } = planCycles(items(10), 10);
    expect(cycles).toHaveLength(1);
    expect(remaining).toHaveLength(0);
  });

  it("dư buổi thì phần dư sang chu kỳ sau, lấy buổi CŨ NHẤT trước", () => {
    const shuffled = items(23).reverse();
    const { cycles, remaining } = planCycles(shuffled, 10);
    expect(cycles).toHaveLength(2);
    expect(cycles[0][0].date).toBe("2026-09-01");
    expect(cycles[1][0].date).toBe("2026-09-11");
    expect(remaining.map((r) => r.date)).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
  });

  it("chu kỳ cấu hình được (vd 8 buổi)", () => {
    expect(planCycles(items(16), 8).cycles).toHaveLength(2);
  });

  it("chặn chu kỳ không hợp lệ", () => {
    expect(() => planCycles(items(3), 0)).toThrow();
  });

  it("tiến độ cherry", () => {
    expect(cycleProgress(7, 10)).toEqual({ count: 7, cycleLength: 10, complete: false });
    expect(cycleProgress(12, 10)).toEqual({ count: 10, cycleLength: 10, complete: true });
  });
});

describe("Ví dụ 1 — vào muộn + vắng có phép (Nguyễn Văn An)", () => {
  // Lớp học từ 01/09, An vào từ 15/09; ca Thứ 3 & Thứ 6.
  const rows: { date: string; status: AttendanceStatus }[] = [
    { date: "2026-09-15", status: "PRESENT" },
    { date: "2026-09-18", status: "PRESENT" },
    { date: "2026-09-22", status: "PRESENT" },
    { date: "2026-09-25", status: "EXCUSED" },
    { date: "2026-09-29", status: "PRESENT" },
    { date: "2026-10-02", status: "PRESENT" },
    { date: "2026-10-06", status: "PRESENT" },
    { date: "2026-10-09", status: "PRESENT" },
    { date: "2026-10-13", status: "PRESENT" },
    { date: "2026-10-16", status: "PRESENT" },
    { date: "2026-10-20", status: "PRESENT" },
  ];

  it("vắng có phép KHÔNG tính: chu kỳ kết thúc 20/10, 800.000đ", () => {
    const settings = { ...S, countExcused: false };
    const { cycles, remaining } = planCycles(billableFrom(rows, settings), 10);
    expect(cycles).toHaveLength(1);
    expect(cycles[0][0].date).toBe("2026-09-15"); // chu kỳ bắt đầu từ buổi đầu tiên em đi học
    expect(cycles[0].at(-1)!.date).toBe("2026-10-20");
    expect(cycles[0].some((c) => c.date === "2026-09-25")).toBe(false);
    expect(remaining).toHaveLength(0);
    expect(computeInvoiceAmounts({ lines: cycles[0], roundTo: 1000 }).amount).toBe(800_000);
  });

  it("vắng có phép CÓ tính: chu kỳ kết thúc sớm hơn (16/10), vẫn 800.000đ, dư 1 buổi", () => {
    const { cycles, remaining } = planCycles(billableFrom(rows, S), 10);
    expect(cycles[0].at(-1)!.date).toBe("2026-10-16");
    expect(remaining.map((r) => r.date)).toEqual(["2026-10-20"]);
    expect(computeInvoiceAmounts({ lines: cycles[0], roundTo: 1000 }).amount).toBe(800_000);
  });
});

describe("Ví dụ 2 — anh chị em + đổi đơn giá giữa chu kỳ (Trần Minh Bình)", () => {
  // 02/09 nghỉ lễ (buổi hủy, không có điểm danh). Từ 01/10 đơn giá 90k.
  const sept = ["05", "09", "12", "16", "19", "23", "26", "30"].map((d) => ({
    date: `2026-09-${d}`,
    status: "PRESENT" as const,
    price: 80_000,
  }));
  const oct = ["03", "07"].map((d) => ({ date: `2026-10-${d}`, status: "PRESENT" as const, price: 90_000 }));
  const discount = { type: "PERCENT" as const, value: 10, applyTo: "ALL" as const };

  it("8 × 80.000 + 2 × 90.000 = 820.000, giảm 10% = 82.000 → 738.000đ", () => {
    const { cycles } = planCycles(billableFrom([...sept, ...oct], S), 10);
    const r = computeInvoiceAmounts({ lines: cycles[0], discount, roundTo: 1000 });
    expect(r).toEqual({
      sessionCount: 10,
      subtotal: 820_000,
      discountAmount: 82_000,
      adjustmentTotal: 0,
      roundingAmount: 0,
      amount: 738_000,
    });
  });

  it("đơn giá đã chốt theo từng buổi — đổi giá sau đó không làm đổi các buổi đã học", () => {
    const items = billableFrom([...sept, ...oct], S);
    expect(items.filter((i) => i.unitPrice === 80_000)).toHaveLength(8);
    expect(items.filter((i) => i.unitPrice === 90_000)).toHaveLength(2);
  });
});

describe("giảm anh chị em", () => {
  const pct = (value: number, applyTo: "ALL" | "FROM_SECOND" = "ALL") =>
    ({ type: "PERCENT", value, applyTo }) as const;
  const fixed = (value: number, applyTo: "ALL" | "FROM_SECOND" = "ALL") =>
    ({ type: "FIXED", value, applyTo }) as const;

  it("phần trăm làm tròn LÊN tới đồng — phụ huynh không thiệt", () => {
    expect(siblingDiscountAmount(805_000, pct(7), false)).toBe(56_350);
    expect(siblingDiscountAmount(100_001, pct(10), false)).toBe(10_001); // 10.000,1 → 10.001
  });

  it("số tiền cố định, không giảm quá tạm tính", () => {
    expect(siblingDiscountAmount(800_000, fixed(50_000), false)).toBe(50_000);
    expect(siblingDiscountAmount(30_000, fixed(50_000), false)).toBe(30_000);
  });

  it("FROM_SECOND: em đầu không giảm, em sau có giảm", () => {
    expect(siblingDiscountAmount(800_000, pct(10, "FROM_SECOND"), true)).toBe(0);
    expect(siblingDiscountAmount(800_000, pct(10, "FROM_SECOND"), false)).toBe(80_000);
  });

  it("không thuộc nhóm hoặc giá trị 0 thì không giảm; % trên 100 bị chặn ở 100", () => {
    expect(siblingDiscountAmount(800_000, null, false)).toBe(0);
    expect(siblingDiscountAmount(800_000, pct(0), false)).toBe(0);
    expect(siblingDiscountAmount(800_000, pct(150), false)).toBe(800_000);
  });

  it("em đầu = nhập học sớm nhất, trùng ngày thì mã nhỏ hơn", () => {
    expect(
      firstChildId([
        { id: "b", code: "HS0002", joinedAt: "2026-09-01" },
        { id: "a", code: "HS0009", joinedAt: "2026-08-15" },
      ]),
    ).toBe("a");
    expect(
      firstChildId([
        { id: "b", code: "HS0002", joinedAt: "2026-09-01" },
        { id: "c", code: "HS0001", joinedAt: "2026-09-01" },
      ]),
    ).toBe("c");
    expect(firstChildId([])).toBeNull();
  });
});

describe("làm tròn tới nghìn", () => {
  it("làm tròn XUỐNG — số phải đóng không bao giờ tăng", () => {
    expect(roundingDelta(737_500, 1000)).toBe(-500);
    expect(roundingDelta(738_000, 1000)).toBe(0);
    expect(roundingDelta(999, 1000)).toBe(-999);
  });

  it("roundTo = 1 tức là không làm tròn", () => {
    expect(roundingDelta(737_512, 1)).toBe(0);
  });

  it("áp dụng ở bước cuối, sau giảm giá", () => {
    // 10 × 75.000 = 750.000, giảm 7% = 52.500 → 697.500 → 697.000
    const lines = Array.from({ length: 10 }, () => ({ unitPrice: 75_000 }));
    const r = computeInvoiceAmounts({
      lines,
      discount: { type: "PERCENT", value: 7, applyTo: "ALL" },
      roundTo: 1000,
    });
    expect(r.discountAmount).toBe(52_500);
    expect(r.roundingAmount).toBe(-500);
    expect(r.amount).toBe(697_000);
    expect(r.subtotal - r.discountAmount + r.adjustmentTotal + r.roundingAmount).toBe(r.amount);
  });
});

describe("sửa tay", () => {
  const ten = Array.from({ length: 10 }, () => ({ unitPrice: 80_000 }));

  it("giảm tay có lý do: 800.000 − 80.000 = 720.000", () => {
    expect(computeInvoiceAmounts({ lines: ten, adjustments: [-80_000], roundTo: 1000 }).amount).toBe(720_000);
  });

  it("nhiều lần sửa cộng dồn", () => {
    const r = computeInvoiceAmounts({ lines: ten, adjustments: [-80_000, 30_000], roundTo: 1000 });
    expect(r.adjustmentTotal).toBe(-50_000);
    expect(r.amount).toBe(750_000);
  });

  it("miễn một buổi: buổi vẫn nằm trong phiếu nhưng 0đ", () => {
    const lines = ten.map((l, i) => ({ ...l, waived: i === 0 }));
    const r = computeInvoiceAmounts({ lines, roundTo: 1000 });
    expect(r.sessionCount).toBe(10);
    expect(r.subtotal).toBe(720_000);
  });

  it("giảm giá tính trên tạm tính SAU khi miễn buổi", () => {
    const lines = ten.map((l, i) => ({ ...l, waived: i < 2 }));
    const r = computeInvoiceAmounts({
      lines,
      discount: { type: "PERCENT", value: 10, applyTo: "ALL" },
      roundTo: 1000,
    });
    expect(r.subtotal).toBe(640_000);
    expect(r.discountAmount).toBe(64_000);
    expect(r.amount).toBe(576_000);
  });

  it("chặn sửa làm phiếu âm", () => {
    expect(() => computeInvoiceAmounts({ lines: ten, adjustments: [-900_000], roundTo: 1000 })).toThrow(
      "NEGATIVE_INVOICE",
    );
  });

  it("chặn đơn giá lẻ hoặc âm (tiền phải là số nguyên đồng)", () => {
    expect(() => computeInvoiceAmounts({ lines: [{ unitPrice: 80_000.5 }], roundTo: 1000 })).toThrow();
    expect(() => computeInvoiceAmounts({ lines: [{ unitPrice: -1 }], roundTo: 1000 })).toThrow();
  });
});

describe("Ví dụ 3 — vắng không phép + đóng thiếu + sửa tay (Lê Hoàng Dũng)", () => {
  const dates1 = ["09-03", "09-07", "09-10", "09-14", "09-17", "09-21", "09-24", "09-28", "10-01", "10-05"];

  it("vắng không phép 14/09 vẫn tính khi bật cài đặt → phiếu 1 = 800.000đ", () => {
    const rows = dates1.map((d) => ({
      date: `2026-${d}`,
      status: (d === "09-14" ? "UNEXCUSED" : "PRESENT") as AttendanceStatus,
    }));
    const { cycles } = planCycles(billableFrom(rows, S), 10);
    expect(cycles).toHaveLength(1);
    expect(computeInvoiceAmounts({ lines: cycles[0], roundTo: 1000 }).amount).toBe(800_000);
  });

  it("tắt tính vắng không phép thì chưa đủ chu kỳ", () => {
    const rows = dates1.map((d) => ({
      date: `2026-${d}`,
      status: (d === "09-14" ? "UNEXCUSED" : "PRESENT") as AttendanceStatus,
    }));
    const { cycles, remaining } = planCycles(billableFrom(rows, { ...S, countUnexcused: false }), 10);
    expect(cycles).toHaveLength(0);
    expect(remaining).toHaveLength(9);
  });

  it("đóng thiếu → nợ chuyển kỳ sau, không bị cộng hai lần", () => {
    const inv1 = { id: "p1", amount: 800_000, issuedAt: "2026-10-05" };
    // Đóng 500k → còn nợ 300k
    expect(studentBalance([inv1.amount], [500_000])).toBe(300_000);
    const a1 = allocatePayments([inv1], [500_000]).allocations[0];
    expect(a1).toMatchObject({ paid: 500_000, remaining: 300_000, state: "PARTIAL" });

    // Phiếu 2: 800k, cô giảm tay 80k → 720k. openingBalance chụp = 300k.
    const amount2 = computeInvoiceAmounts({
      lines: Array.from({ length: 10 }, () => ({ unitPrice: 80_000 })),
      adjustments: [-80_000],
      roundTo: 1000,
    }).amount;
    expect(amount2).toBe(720_000);
    const opening2 = studentBalance([inv1.amount], [500_000]);
    expect(amountDueOnInvoice(opening2, amount2)).toBe(1_020_000);

    // Đóng đủ 1.020.000 → số dư 0, cả hai phiếu "Đã thu"
    const inv2 = { id: "p2", amount: amount2, issuedAt: "2026-11-09" };
    expect(studentBalance([inv1.amount, inv2.amount], [500_000, 1_020_000])).toBe(0);
    const { allocations, credit } = allocatePayments([inv2, inv1], [500_000, 1_020_000]);
    expect(allocations.map((a) => a.state)).toEqual(["PAID", "PAID"]);
    expect(credit).toBe(0);
  });
});

describe("sổ cái & phân bổ tiền", () => {
  const invs = [
    { id: "p1", amount: 800_000, issuedAt: "2026-09-10" },
    { id: "p2", amount: 800_000, issuedAt: "2026-10-10" },
  ];

  it("chưa đóng gì", () => {
    expect(allocatePayments(invs, []).allocations.map((a) => a.state)).toEqual(["UNPAID", "UNPAID"]);
  });

  it("tiền vào phiếu cũ nhất trước", () => {
    const { allocations } = allocatePayments(invs, [1_000_000]);
    expect(allocations[0]).toMatchObject({ state: "PAID", remaining: 0 });
    expect(allocations[1]).toMatchObject({ state: "PARTIAL", paid: 200_000, remaining: 600_000 });
  });

  it("đóng thừa thành tiền dư, trừ vào phiếu sau", () => {
    const { credit } = allocatePayments(invs.slice(0, 1), [900_000]);
    expect(credit).toBe(100_000);
    const balance = studentBalance([800_000], [900_000]);
    expect(balance).toBe(-100_000);
    expect(amountDueOnInvoice(balance, 800_000)).toBe(700_000);
  });

  it("tiền dư lớn hơn phiếu mới thì cần đóng = 0, không âm", () => {
    expect(amountDueOnInvoice(-900_000, 800_000)).toBe(0);
  });
});

describe("trạng thái phiếu & số tiền trên phiếu", () => {
  const base = { status: "SENT" as const, hasPendingClaim: false, daysSinceSent: 2, overdueAfterDays: 7 };

  it("thứ tự ưu tiên", () => {
    expect(invoiceDisplayState({ ...base, status: "VOID", paymentState: "PAID" })).toBe("VOID");
    expect(invoiceDisplayState({ ...base, paymentState: "PAID", hasPendingClaim: true })).toBe("PAID");
    expect(invoiceDisplayState({ ...base, paymentState: "UNPAID", hasPendingClaim: true })).toBe("CLAIMED");
    expect(invoiceDisplayState({ ...base, status: "READY", paymentState: "UNPAID", daysSinceSent: null })).toBe("READY");
    expect(invoiceDisplayState({ ...base, paymentState: "PARTIAL", daysSinceSent: 30 })).toBe("PARTIAL");
    expect(invoiceDisplayState({ ...base, paymentState: "UNPAID", daysSinceSent: 7 })).toBe("OVERDUE");
    expect(invoiceDisplayState({ ...base, paymentState: "UNPAID" })).toBe("WAITING");
  });

  it("cần đóng = nợ phiếu cũ + phần còn thiếu phiếu này (Ví dụ 3)", () => {
    const { allocations } = allocatePayments(
      [
        { id: "p1", amount: 800_000, issuedAt: "2026-10-05" },
        { id: "p2", amount: 720_000, issuedAt: "2026-11-09" },
      ],
      [500_000],
    );
    expect(invoiceDue(allocations, "p2")).toEqual({ priorDebt: 300_000, remaining: 720_000, paid: 0, totalDue: 1_020_000 });
    expect(invoiceDue(allocations, "p1")).toEqual({ priorDebt: 0, remaining: 300_000, paid: 500_000, totalDue: 300_000 });
  });

  it("tiền thừa tự trừ vào phiếu sau", () => {
    const { allocations } = allocatePayments(
      [
        { id: "p1", amount: 800_000, issuedAt: "2026-09-01" },
        { id: "p2", amount: 800_000, issuedAt: "2026-10-01" },
      ],
      [900_000],
    );
    expect(invoiceDue(allocations, "p2").totalDue).toBe(700_000);
  });
});

describe("giọng nhắc", () => {
  const t = { gentleAfterDays: 7, clearAfterDays: 14 };

  it("theo số ngày kể từ khi gửi", () => {
    expect(reminderTone(0, false, t)).toBe("FEE_SOFT");
    expect(reminderTone(7, false, t)).toBe("FEE_GENTLE");
    expect(reminderTone(20, false, t)).toBe("FEE_CLEAR");
  });

  it("gia đình khó khăn luôn nhẹ nhất", () => {
    expect(reminderTone(30, true, t)).toBe("FEE_SOFT");
  });
});

describe("phiếu phụ huynh cần đóng (cổng phụ huynh)", () => {
  // Phiếu đã gửi + số liệu sống từ sổ cái. Thứ tự đầu vào cố ý lộn xộn.
  const inv = (id: string, issuedAt: string, remaining: number, totalDue: number, claimed = false) => ({ id, issuedAt, remaining, totalDue, claimed });

  it("không còn thiếu đồng nào → không có gì phải đóng", () => {
    expect(invoiceToPay([inv("p1", "2026-09-01", 0, 0)])).toBeNull();
    expect(invoiceToPay([])).toBeNull();
  });

  it("một phiếu còn thiếu → đóng đúng phiếu đó", () => {
    const r = invoiceToPay([inv("p1", "2026-09-01", 0, 0), inv("p2", "2026-10-01", 720_000, 720_000)]);
    expect(r?.invoice.id).toBe("p2");
    expect(r?.merged).toEqual([]);
    expect(r?.amount).toBe(720_000);
  });

  it("nhiều phiếu còn thiếu → chỉ đóng phiếu MỚI NHẤT, số tiền đã gồm nợ cũ — không cộng hai lần", () => {
    const old = inv("p1", "2026-09-11", 720_000, 720_000);
    const latest = inv("p2", "2026-10-13", 720_000, 1_440_000);
    const r = invoiceToPay([latest, old].reverse());
    expect(r?.invoice.id).toBe("p2");
    expect(r?.merged.map((m) => m.id)).toEqual(["p1"]);
    expect(r?.amount).toBe(1_440_000); // không phải 720k + 1.440k
  });

  it("phụ huynh đã báo chuyển phiếu mới nhất → đang chờ cô xác nhận, chưa nhắc đóng", () => {
    const r = invoiceToPay([inv("p1", "2026-09-11", 720_000, 720_000), inv("p2", "2026-10-13", 720_000, 1_440_000, true)]);
    expect(r?.invoice.id).toBe("p2");
    expect(r?.waitingConfirm).toBe(true);
  });

  it("đóng thiếu phiếu cũ, phiếu mới còn nguyên → số cần đóng là phần thiếu + phiếu mới", () => {
    const r = invoiceToPay([inv("p1", "2026-09-01", 220_000, 220_000), inv("p2", "2026-10-01", 720_000, 940_000)]);
    expect(r?.amount).toBe(940_000);
  });
});

// ─────────────────── Nhịp chu kỳ theo CA (em mới vào theo tiến độ cả lớp) ───────────────────

describe("nhịp chu kỳ của một ca", () => {
  // 12 buổi đã xong của một ca, Thứ 3 & Thứ 6 lúc 17:30.
  const keys = [
    "2026-09-01", "2026-09-04", "2026-09-08", "2026-09-11", "2026-09-15", "2026-09-18",
    "2026-09-22", "2026-09-25", "2026-09-29", "2026-10-02", "2026-10-06", "2026-10-09",
  ].map((d) => sessionKey(d, "17:30"));

  it("chưa có mốc: đếm từ buổi đầu, đủ 10 buổi thì khép kỳ ở buổi thứ 10", () => {
    const r = shiftCycle(keys, null, 10);
    expect(r.closes).toEqual([keys[9]]);
    expect(r.mark).toBe(keys[9]);
    expect(r.position).toBe(2); // còn 2 buổi của kỳ mới
  });

  it("có mốc: chỉ đếm buổi SAU mốc; chưa đủ thì không khép", () => {
    const r = shiftCycle(keys, keys[9], 10);
    expect(r.closes).toEqual([]);
    expect(r.mark).toBe(keys[9]);
    expect(r.position).toBe(2);
  });

  it("cô giảm số buổi của lớp giữa chừng (10 → 6): đã qua 7 buổi → khép ngay ở buổi thứ 6", () => {
    const mark = keys[1]; // kỳ hiện tại bắt đầu từ buổi thứ 3
    expect(shiftCycle(keys.slice(0, 9), mark, 10).position).toBe(7); // trước khi đổi: buổi 7/10
    const after = shiftCycle(keys.slice(0, 9), mark, 6); // đổi thành 6 buổi
    expect(after.closes).toEqual([keys[7]]);
    expect(after.position).toBe(1);
  });

  it("giảm mạnh khép nhiều kỳ một lúc thì mốc nằm ở kỳ cuối cùng", () => {
    const r = shiftCycle(keys.slice(0, 7), null, 3);
    expect(r.closes).toEqual([keys[2], keys[5]]);
    expect(r.mark).toBe(keys[5]);
    expect(r.position).toBe(1);
  });

  it("thứ tự đầu vào không quan trọng", () => {
    expect(shiftCycle([...keys].reverse(), null, 10)).toEqual(shiftCycle(keys, null, 10));
  });

  it("số buổi không hợp lệ thì báo lỗi, không đoán", () => {
    expect(() => shiftCycle(keys, null, 0)).toThrow();
  });
});

describe("phiếu theo nhịp lớp", () => {
  const item = (n: number, date: string, time = "17:30") => ({ id: `a${n}`, date, key: sessionKey(date, time), unitPrice: 80_000 });
  const mark = sessionKey("2026-10-02", "17:30"); // lớp vừa khép kỳ ở buổi 02/10

  it("em đi đủ: 10 buổi trong kỳ vừa khép → một phiếu 10 buổi", () => {
    const items = Array.from({ length: 10 }, (_, i) => item(i, `2026-09-${String(10 + i).padStart(2, "0")}`));
    const r = planClassInvoices(items, { mark, cycleLength: 10 });
    expect(r.invoices).toHaveLength(1);
    expect(r.invoices[0]).toHaveLength(10);
    expect(r.waiting).toEqual([]);
  });

  it("em mới vào giữa kỳ: chỉ 5 buổi đã học → phiếu NGẮN 5 buổi, ra cùng lúc với cả lớp", () => {
    const items = [22, 25, 29].map((d, i) => item(i, `2026-09-${d}`)).concat([item(3, "2026-10-01"), item(4, "2026-10-02")]);
    const r = planClassInvoices(items, { mark, cycleLength: 10 });
    expect(r.invoices).toEqual([items]);
    const sum = computeInvoiceAmounts({ lines: r.invoices[0], discount: null, isFirstChild: false, roundTo: 1000 });
    expect(sum.amount).toBe(400_000); // không bị tính buổi chưa học
  });

  it("buổi sau mốc chờ lớp khép kỳ sau — không tạo phiếu sớm", () => {
    const items = [item(0, "2026-10-06"), item(1, "2026-10-09")];
    const r = planClassInvoices(items, { mark, cycleLength: 10 });
    expect(r.invoices).toEqual([]);
    expect(r.waiting).toEqual(items);
  });

  it("vắng có phép không tính (cô tắt trong Cài đặt): 9 buổi tính tiền → phiếu 9 buổi, vẫn đúng nhịp lớp", () => {
    const items = Array.from({ length: 9 }, (_, i) => item(i, `2026-09-${String(10 + i).padStart(2, "0")}`));
    expect(planClassInvoices(items, { mark, cycleLength: 10 }).invoices[0]).toHaveLength(9);
  });

  it("học bù thêm ở ca khác trong kỳ: 11 buổi → một phiếu 11 buổi, không tách phiếu lẻ 1 buổi", () => {
    const items = Array.from({ length: 11 }, (_, i) => item(i, `2026-09-${String(10 + i).padStart(2, "0")}`, i === 4 ? "08:00" : "17:30"));
    const r = planClassInvoices(items, { mark, cycleLength: 10 });
    expect(r.invoices).toHaveLength(1);
    expect(r.invoices[0]).toHaveLength(11);
  });

  it("lớp chưa khép kỳ nào (chưa có mốc): mọi buổi đều chờ", () => {
    const items = [item(0, "2026-09-10")];
    expect(planClassInvoices(items, { mark: null, cycleLength: 10 }).invoices).toEqual([]);
  });

  it("cô cộng tay 10 buổi cũ (trước khi dùng app): đủ chu kỳ thì ra phiếu ngay, không chờ lớp", () => {
    const manual = Array.from({ length: 12 }, (_, i) => ({ ...item(i, "2026-10-05"), key: sessionKey("2026-10-05", "00:00") }));
    const r = planClassInvoices(manual, { mark, cycleLength: 10, catchUp: true });
    expect(r.invoices).toHaveLength(1);
    expect(r.invoices[0]).toHaveLength(10);
    expect(r.waiting).toHaveLength(2);
  });

  it("buổi cũ trước mốc + buổi đủ chu kỳ sau mốc khi cộng tay: phần trước mốc thành một phiếu, phần sau xét riêng", () => {
    const old = [item(0, "2026-09-30")];
    const after = Array.from({ length: 10 }, (_, i) => ({ ...item(i + 1, "2026-10-05"), key: sessionKey("2026-10-05", "00:00") }));
    const r = planClassInvoices([...after, ...old], { mark, cycleLength: 10, catchUp: true });
    expect(r.invoices.map((c) => c.length)).toEqual([1, 10]);
  });

  it("em không thuộc ca nào: theo nhịp riêng như trước (đủ 10 buổi mới ra phiếu)", () => {
    const items = Array.from({ length: 13 }, (_, i) => item(i, `2026-09-${String(10 + i).padStart(2, "0")}`));
    const r = planClassInvoices(items, { mark: undefined, cycleLength: 10 });
    expect(r.invoices.map((c) => c.length)).toEqual([10]);
    expect(r.waiting).toHaveLength(3);
  });

  it("một buổi không bao giờ nằm ở hai phiếu", () => {
    const items = Array.from({ length: 25 }, (_, i) => item(i, i < 12 ? `2026-09-${String(10 + i).padStart(2, "0")}` : "2026-10-05"));
    const r = planClassInvoices(items, { mark, cycleLength: 10, catchUp: true });
    const ids = [...r.invoices.flat(), ...r.waiting].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(25);
  });
});

// ─────────────────── Tiền về tài khoản (webhook ngân hàng) ───────────────────

describe("đọc mã phiếu trong nội dung chuyển khoản", () => {
  it("đúng như mã QR điền sẵn", () => {
    expect(parseInvoiceCode("HP PT-2026-0139 Tran Minh Chau")).toBe("PT-2026-0139");
  });
  it("ngân hàng bỏ dấu gạch, đổi chữ thường, chèn mã giao dịch", () => {
    expect(parseInvoiceCode("MBVCB.1234.HP PT20260139 TRAN MINH CHAU")).toBe("PT-2026-0139");
    expect(parseInvoiceCode("hp pt 2026 0139 chau")).toBe("PT-2026-0139");
    expect(parseInvoiceCode("HP PT.2026.139")).toBe("PT-2026-0139");
  });
  it("không có mã phiếu → null (không đoán)", () => {
    expect(parseInvoiceCode("chuyen tien hoc cho chau")).toBeNull();
    expect(parseInvoiceCode("")).toBeNull();
  });
  it("hai mã khác nhau trong một nội dung → null, để cô gán tay", () => {
    expect(parseInvoiceCode("HP PT-2026-0139 va PT-2026-0140")).toBeNull();
  });
});

describe("quyết định khi có tiền về", () => {
  const base = { transferType: "in" as const, amount: 720_000, accountNumber: "99141401042004", content: "HP PT-2026-0139 Chau" };
  const ctx = { accountNo: "99141401042004", invoice: { code: "PT-2026-0139", status: "SENT" as const, totalDue: 720_000 } };

  it("đúng mã, đúng số tiền → tự xác nhận, đủ", () => {
    expect(decideBankTransfer(base, ctx)).toEqual({ kind: "MATCHED", code: "PT-2026-0139", amount: 720_000, fit: "FULL" });
  });
  it("đúng mã, chuyển thiếu → vẫn ghi nhận đúng số tiền thật, đánh dấu THIẾU (nợ tự sang kỳ sau)", () => {
    expect(decideBankTransfer({ ...base, amount: 500_000 }, ctx)).toMatchObject({ kind: "MATCHED", amount: 500_000, fit: "SHORT" });
  });
  it("đúng mã, chuyển dư → ghi nhận đủ số tiền thật, đánh dấu DƯ (tự trừ kỳ sau)", () => {
    expect(decideBankTransfer({ ...base, amount: 800_000 }, ctx)).toMatchObject({ kind: "MATCHED", amount: 800_000, fit: "OVER" });
  });
  it("phiếu chưa gửi vẫn khớp được (phụ huynh chuyển sớm theo tin nhắn)", () => {
    expect(decideBankTransfer(base, { ...ctx, invoice: { ...ctx.invoice, status: "READY" } }).kind).toBe("MATCHED");
  });
  it("tiền ra khỏi tài khoản → bỏ qua", () => {
    expect(decideBankTransfer({ ...base, transferType: "out" }, ctx).kind).toBe("IGNORE");
  });
  it("tiền vào tài khoản khác (không phải tài khoản nhận học phí) → bỏ qua", () => {
    expect(decideBankTransfer({ ...base, accountNumber: "0000111122" }, ctx).kind).toBe("IGNORE");
  });
  it("không có mã phiếu → chờ cô gán tay", () => {
    expect(decideBankTransfer({ ...base, content: "chuyen tien hoc" }, { ...ctx, invoice: null })).toMatchObject({ kind: "UNMATCHED" });
  });
  it("mã phiếu không tồn tại hoặc đã hủy → chờ cô gán tay", () => {
    expect(decideBankTransfer(base, { ...ctx, invoice: null })).toMatchObject({ kind: "UNMATCHED" });
    expect(decideBankTransfer(base, { ...ctx, invoice: { ...ctx.invoice, status: "VOID" } })).toMatchObject({ kind: "UNMATCHED" });
  });
  it("số tiền 0 hoặc âm → bỏ qua", () => {
    expect(decideBankTransfer({ ...base, amount: 0 }, ctx).kind).toBe("IGNORE");
  });
});
