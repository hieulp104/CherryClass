import type { Metadata } from "next";

import { requirePagePermission } from "@/common/guards/page.guard";
import { listClassrooms } from "@/modules/classes/classes.service";
import { AssignmentForm } from "@/modules/assignments/components/assignment-form";

export const metadata: Metadata = { title: "Giao bài mới" };

export default async function NewAssignmentPage() {
  await requirePagePermission("assignment.manage");
  const classrooms = await listClassrooms();
  return (
    <AssignmentForm
      classrooms={classrooms.map((c) => ({
        id: c.id,
        name: c.name,
        count: c._count.students,
        shifts: c.shifts.map((s) => ({ id: s.id, name: s.name, count: s._count.students })),
      }))}
    />
  );
}
