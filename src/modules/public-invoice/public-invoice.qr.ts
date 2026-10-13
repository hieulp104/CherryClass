import QRCode from "qrcode";

import type { PublicInvoice } from "@/modules/billing/billing.service";
import { buildVietQrPayload } from "@/lib/vietqr";

type Live = Extract<PublicInvoice, { expired: false }>;

/**
 * Ảnh mã VietQR (data URL) cho phiếu còn phải đóng — đã điền số tiền và nội dung chuyển khoản.
 * Dùng chung cho trang /p/<token> và trang phiếu trong cổng phụ huynh.
 */
export async function invoiceQr(invoice: Live): Promise<string | null> {
  if (!invoice.bank || invoice.totalDue <= 0 || invoice.state === "PAID") return null;
  const payload = buildVietQrPayload({
    bin: invoice.bank.bin,
    accountNo: invoice.bank.accountNo,
    amount: invoice.totalDue,
    note: `HP ${invoice.code} ${invoice.studentName}`,
  });
  return QRCode.toDataURL(payload, { margin: 1, width: 520, color: { dark: "#2A1B22", light: "#FFFFFF" } });
}
