import { describe, expect, it } from "vitest";

import { activeBankAccount, resolveBankAccounts, withOneActive, type BankAccount } from "./bank-accounts";

const mb: BankAccount = { bin: "970422", bankName: "MB Bank", accountNo: "99141401042004", accountName: "PHAM VAN HIEU", active: false };
const legacy = { bin: "970436", bankName: "Vietcombank", accountNo: "1029384756", accountName: "NGUYEN THU HA" };
const vcb: BankAccount = { ...legacy, active: false };

describe("nhiều tài khoản nhận học phí", () => {
  it("luôn đúng một tài khoản đang nhận tiền", () => {
    expect(withOneActive([mb, vcb]).map((a) => a.active)).toEqual([true, false]);
    expect(withOneActive([mb, { ...vcb, active: true }]).map((a) => a.active)).toEqual([false, true]);
    expect(withOneActive([{ ...mb, active: true }, { ...vcb, active: true }]).map((a) => a.active)).toEqual([true, false]);
    expect(withOneActive([])).toEqual([]);
  });

  it("dữ liệu cũ (một tài khoản) tự thành tài khoản đang nhận tiền", () => {
    expect(resolveBankAccounts(undefined, legacy)).toEqual([{ ...vcb, active: true }]);
  });

  it("chưa từng cài tài khoản → danh sách rỗng", () => {
    expect(resolveBankAccounts(undefined, undefined)).toEqual([]);
    expect(resolveBankAccounts(undefined, { bin: "", bankName: "", accountNo: "", accountName: "" })).toEqual([]);
  });

  it("đã có danh sách mới thì bỏ qua dữ liệu cũ — cô xóa hết thì không hiện lại tài khoản cũ", () => {
    expect(resolveBankAccounts([], legacy)).toEqual([]);
    expect(resolveBankAccounts([{ ...mb, active: true }], legacy)).toEqual([{ ...mb, active: true }]);
  });

  it("đổi tài khoản đang nhận tiền → phiếu lấy đúng tài khoản mới, không lộ cờ active ra DTO", () => {
    expect(activeBankAccount([mb, { ...vcb, active: true }])).toEqual({
      bin: vcb.bin,
      bankName: vcb.bankName,
      accountNo: vcb.accountNo,
      accountName: vcb.accountName,
    });
    expect(activeBankAccount([]).accountNo).toBe("");
  });
});
