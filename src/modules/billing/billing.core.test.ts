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
