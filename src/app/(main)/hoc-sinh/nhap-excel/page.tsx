import type { Metadata } from "next";

import { requirePagePermission } from "@/common/guards/page.guard";
import { listClassrooms } from "@/modules/classes/classes.service";
import { ImportWizard } from "@/modules/imports/components/import-wizard";

export const metadata: Metadata = { title: "Nhập Excel" };

export default async function ImportPage() {
  await requirePagePermission("student.manage");
  const classrooms = await listClassrooms();
  return (
    <ImportWizard
      classrooms={classrooms.map((c) => ({ id: c.id, name: c.name, shifts: c.shifts.map((s) => ({ id: s.id, name: s.name })) }))}
    />
  );
}
