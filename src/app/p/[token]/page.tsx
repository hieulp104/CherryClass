import type { Metadata } from "next";

import { getPublicInvoice } from "@/modules/billing/billing.service";
import { PublicInvoiceCard } from "@/modules/public-invoice/components/public-invoice-card";
import { invoiceQr } from "@/modules/public-invoice/public-invoice.qr";
import { OG_IMAGE } from "@/lib/og";

/**
 * Link này cô dán vào Zalo: thẻ xem trước CHỈ có chữ chung chung — không tên em, không số tiền
 * (bản xem trước được lưu trên máy chủ của ứng dụng chat).
 */
export const metadata: Metadata = {
  title: "Phiếu học phí",
  description: "Xem số buổi đã học, số tiền và mã QR chuyển khoản.",
  // Link có mã bảo mật riêng — không cho công cụ tìm kiếm lập chỉ mục.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  openGraph: {
    type: "website",
    siteName: "TeamCherry",
    locale: "vi_VN",
    title: "Phiếu học phí 🍒",
    description: "Bấm để xem số buổi đã học, số tiền và mã QR chuyển khoản.",
    images: [OG_IMAGE],
  },
};

export default async function PublicInvoicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invoice = await getPublicInvoice(token);

  if (!invoice || invoice.expired) {
    return <PublicInvoiceCard invoice={null} token={token} qr={null} />;
  }
  return <PublicInvoiceCard invoice={invoice} token={token} qr={await invoiceQr(invoice)} />;
}
