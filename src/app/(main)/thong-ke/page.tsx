import type { Metadata } from "next";

import { requirePagePermission } from "@/common/guards/page.guard";
import { FinanceView } from "@/modules/finance/components/finance-view";
import { financeOverview, listExpenseCategories, listExpenses } from "@/modules/finance/finance.service";
import { todayKey } from "@/lib/dates";

export const metadata: Metadata = { title: "Thống kê" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ thang?: string }> }) {
  await requirePagePermission("finance.view");
  const { thang } = await searchParams;
  const current = todayKey().slice(0, 7);
  const month = thang && /^\d{4}-\d{2}$/.test(thang) && thang <= current ? thang : current;
  const [overview, expenses, categories] = await Promise.all([financeOverview(month), listExpenses(month), listExpenseCategories()]);
  return (
    <FinanceView
      overview={overview}
      expenses={JSON.parse(JSON.stringify(expenses))}
      categories={categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color }))}
      isCurrentMonth={month === current}
    />
  );
}
