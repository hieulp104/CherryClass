import { describe, expect, it } from "vitest";

import { buildVietQrPayload, crc16, sanitizeTransferNote } from "./vietqr";

describe("VietQR", () => {
  it("CRC16-CCITT-FALSE đúng giá trị chuẩn", () => {
    // Giá trị kiểm tra chuẩn của CRC-16/CCITT-FALSE cho chuỗi "123456789".
    expect(crc16("123456789")).toBe("29B1");
  });

  it("chuỗi có đủ trường bắt buộc và CRC khớp", () => {
    const p = buildVietQrPayload({ bin: "970436", accountNo: "0123456789", amount: 800000, note: "TC PT-2026-0001" });
    expect(p.startsWith("000201010212")).toBe(true);
    expect(p).toContain("A000000727");
    expect(p).toContain("0006970436");
    expect(p).toContain("54068000005802VN");
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });

  it("nội dung chuyển khoản bỏ dấu, bỏ ký tự lạ", () => {
    expect(sanitizeTransferNote("Học phí Nguyễn Văn Đạt — PT-0012")).toBe("HOC PHI NGUYEN VAN DAT PT 0012");
  });
});
