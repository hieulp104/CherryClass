import type { Metadata } from "next";
import QRCode from "qrcode";

import { getPublicInvoice } from "@/modules/billing/billing.service";
import { PublicInvoiceCard } from "@/modules/public-invoice/components/public-invoice-card";
import { buildVietQrPayload } from "@/lib/vietqr";

export const metadata: Metadata = {
  title: "Phiếu học phí",
  // Link có mã bảo mật riêng — không cho công cụ tìm kiếm lập chỉ mục.
  robots: { index: false, follow: false },
};

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await getPublicInvoice(token);

  if (!invoice || invoice.expired) {
    return <PublicInvoiceCard invoice={null} token={token} qr={null} />;
  }

  let qr: string | null = null;
  if (invoice.bank && invoice.totalDue > 0 && invoice.state !== "PAID") {
    const payload = buildVietQrPayload({
      bin: invoice.bank.bin,
      accountNo: invoice.bank.accountNo,
      amount: invoice.totalDue,
      note: `HP ${invoice.code} ${invoice.studentName}`,
    });
    qr = await QRCode.toDataURL(payload, { margin: 1, width: 520, color: { dark: "#2A1B22", light: "#FFFFFF" } });
  }
  return <PublicInvoiceCard invoice={invoice} token={token} qr={qr} />;
}
