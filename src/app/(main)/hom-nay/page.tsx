import type { Metadata } from "next";

import { requirePagePermission } from "@/common/guards/page.guard";
import { TodayView } from "@/modules/today/components/today-view";
import { getTodayData } from "@/modules/today/today.service";

export const metadata: Metadata = { title: "Hôm nay" };

export default async function TodayPage() {
  await requirePagePermission("attendance.manage");
  const data = await getTodayData();
  return <TodayView data={data} />;
}
