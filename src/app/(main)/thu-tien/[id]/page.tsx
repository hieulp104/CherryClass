import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/common/guards/page.guard";
import { getInvoiceDetail } from "@/modules/billing/billing.service";
import { InvoiceDetailView } from "@/modules/billing/components/invoice-detail";
import { listTemplates } from "@/modules/messages/messages.service";
import { getSettings } from "@/modules/settings/settings.service";

export const metadata: Metadata = { title: "Phiếu thu" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("billing.manage");
  const { id } = await params;
  const [detail, templates, settings] = await Promise.all([getInvoiceDetail(id), listTemplates(), getSettings()]);
  if (!detail) notFound();
  return (
    <InvoiceDetailView
      detail={JSON.parse(JSON.stringify(detail))}
      templates={templates}
      bankAccounts={settings.bankAccounts}
      devTools={process.env.NODE_ENV !== "production" || process.env.BANK_SIMULATOR === "on"}
    />
  );
}
