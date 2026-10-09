import type { Metadata } from "next";

import { requirePagePermission } from "@/common/guards/page.guard";
import { listAssignments } from "@/modules/assignments/assignments.service";
import { AssignmentList } from "@/modules/assignments/components/assignment-list";

export const metadata: Metadata = { title: "Bài tập" };

export default async function AssignmentsPage() {
  await requirePagePermission("assignment.manage");
  const items = await listAssignments();
  return <AssignmentList items={items} />;
}
