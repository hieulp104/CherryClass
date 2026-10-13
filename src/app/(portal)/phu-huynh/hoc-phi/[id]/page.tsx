import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getPublicInvoice } from "@/modules/billing/billing.service";
import { PortalFrame } from "@/modules/portal/components/portal-frame";
import { portalHref } from "@/modules/portal/portal.links";
import { requirePortal } from "@/modules/portal/portal.guard";
import { PublicInvoiceCard } from "@/modules/public-invoice/components/public-invoice-card";
import { invoiceQr } from "@/modules/public-invoice/public-invoice.qr";
import { prisma } from "@/shared/prisma/prisma.service";

export const metadata: Metadata = { title: "Phiếu học phí" };

/** Phiếu học phí ngay trong cổng phụ huynh: số buổi, số tiền, mã QR, số tài khoản, nút "Tôi đã chuyển khoản". */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ con?: string }> }) {
  const [{ id }, { con }] = await Promise.all([params, searchParams]);
  const ctx = await requirePortal("PARENT", con);
  // Chỉ phiếu ĐÃ GỬI của ĐÚNG con đang xem — id phiếu của em khác trả 404, không lộ là có tồn tại.
  const row = await prisma.invoice.findFirst({
    where: { id, studentId: ctx.studentId, status: "SENT" },
    select: { publicToken: true },
  });
  if (!row) notFound();
  const invoice = await getPublicInvoice(row.publicToken);
  if (!invoice) notFound();

  const frame = { base: ctx.base, displayName: ctx.user.displayName, studentId: ctx.studentId, children: ctx.children };
  return (
    <PortalFrame frame={frame}>
      <Link
        href={portalHref(frame, "/hoc-phi")}
        className="mb-4 inline-flex items-center gap-1 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Học phí
      </Link>
      {invoice.expired ? (
        <PublicInvoiceCard invoice={null} token={row.publicToken} qr={null} embedded />
      ) : (
        <PublicInvoiceCard invoice={invoice} token={row.publicToken} qr={await invoiceQr(invoice)} embedded />
      )}
    </PortalFrame>
  );
}
