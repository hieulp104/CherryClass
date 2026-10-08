import type { Metadata } from "next";

import { requirePagePermission } from "@/common/guards/page.guard";
import { listInvoices } from "@/modules/billing/billing.service";
import { InvoiceBoard } from "@/modules/billing/components/invoice-board";
import { outstandingTotal } from "@/modules/finance/finance.service";
import { listTemplates } from "@/modules/messages/messages.service";
import { getSettings } from "@/modules/settings/settings.service";

export const metadata: Metadata = { title: "Thu tiền" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requirePagePermission("billing.manage");
  const [{ tab }, invoices, outstanding, templates, settings] = await Promise.all([
    searchParams,
    listInvoices(),
    outstandingTotal(),
    listTemplates(),
    getSettings(),
  ]);
  return (
    <InvoiceBoard
      invoices={invoices}
      outstanding={outstanding}
      initialTab={tab}
      templates={templates}
      teacherName={settings.teacherName}
      quietHours={settings.quietHours}
      appUrl={process.env.APP_URL ?? ""}
    />
  );
}
