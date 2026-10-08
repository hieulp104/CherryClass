import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/common/guards/page.guard";
import { getRoster } from "@/modules/attendance/attendance.service";
import { ClassMode } from "@/modules/attendance/components/class-mode";

export const metadata: Metadata = { title: "Đứng lớp" };

export default async function ClassModePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("attendance.manage");
  const { id } = await params;
  const roster = await getRoster(id);
  if (!roster) notFound();
  return <ClassMode key={roster.session.id} roster={roster} />;
}
