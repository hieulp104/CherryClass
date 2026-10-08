/**
 * Chuỗi VietQR (chuẩn EMVCo của NAPAS) — tự sinh, không gọi API ngoài.
 * App ngân hàng nào ở VN cũng quét được, tự điền số tài khoản, số tiền và nội dung.
 */

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC-16/CCITT-FALSE, đúng thuật toán EMVCo yêu cầu cho trường 63. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Nội dung chuyển khoản: chỉ chữ không dấu, số, khoảng trắng — một số ngân hàng cắt ký tự lạ. */
export function sanitizeTransferNote(note: string): string {
  return note
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, 50);
}

export function buildVietQrPayload(input: {
  bin: string;
  accountNo: string;
  amount?: number;
  note?: string;
}): string {
  const beneficiary = tlv("00", input.bin) + tlv("01", input.accountNo);
  const merchant = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  let payload =
    tlv("00", "01") +
    tlv("01", input.amount ? "12" : "11") +
    tlv("38", merchant) +
    tlv("53", "704") +
    (input.amount ? tlv("54", String(Math.round(input.amount))) : "") +
    tlv("58", "VN");
  if (input.note) payload += tlv("62", tlv("08", sanitizeTransferNote(input.note)));
  payload += "6304";
  return payload + crc16(payload);
}

/** Một số ngân hàng phổ biến (mã BIN NAPAS) để cô chọn trong Cài đặt. */
export const BANKS: { bin: string; name: string }[] = [
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970437", name: "HDBank" },
  { bin: "970441", name: "VIB" },
  { bin: "970443", name: "SHB" },
  { bin: "970431", name: "Eximbank" },
  { bin: "970426", name: "MSB" },
  { bin: "970448", name: "OCB" },
  { bin: "970454", name: "Viet Capital Bank" },
  { bin: "970429", name: "SCB" },
  { bin: "970440", name: "SeABank" },
  { bin: "970425", name: "ABBANK" },
];
