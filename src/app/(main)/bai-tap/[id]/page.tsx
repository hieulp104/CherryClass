import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/common/guards/page.guard";
import { getAssignmentDetail } from "@/modules/assignments/assignments.service";
import { AssignmentDetailView } from "@/modules/assignments/components/assignment-detail";

export const metadata: Metadata = { title: "Bài tập" };

export default async function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("assignment.manage");
  const { id } = await params;
  const detail = await getAssignmentDetail(id);
  if (!detail) notFound();
  return <AssignmentDetailView detail={JSON.parse(JSON.stringify(detail))} />;
}
