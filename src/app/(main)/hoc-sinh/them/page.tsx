import type { Metadata } from "next";

import { requirePagePermission } from "@/common/guards/page.guard";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page";
import { listClassrooms } from "@/modules/classes/classes.service";
import { StudentForm } from "@/modules/students/components/student-form";
import { getSettings } from "@/modules/settings/settings.service";

export const metadata: Metadata = { title: "Thêm học sinh" };

export default async function NewStudentPage() {
  await requirePagePermission("student.manage");
  const [classrooms, settings] = await Promise.all([listClassrooms(), getSettings()]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back="/hoc-sinh" title="Thêm học sinh" />
      <Card className="p-5 sm:p-6">
        <StudentForm
          classrooms={classrooms.map((c) => ({ id: c.id, name: c.name, shifts: c.shifts.map((s) => ({ id: s.id, name: s.name })) }))}
          defaultPrice={settings.billing.defaultUnitPrice}
        />
      </Card>
    </div>
  );
}
