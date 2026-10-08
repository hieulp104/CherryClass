import type { Metadata } from "next";

import { requirePagePermission } from "@/common/guards/page.guard";
import { attendanceAgenda } from "@/modules/attendance/attendance.service";
import { AgendaView } from "@/modules/attendance/components/agenda-view";

export const metadata: Metadata = { title: "Điểm danh" };

export default async function AttendancePage() {
  await requirePagePermission("attendance.manage");
  const sessions = await attendanceAgenda();
  return <AgendaView sessions={sessions} />;
}
