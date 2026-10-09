import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requirePagePermission } from "@/common/guards/page.guard";
import { can } from "@/common/permissions/permissions";
import { accountsOfStudent } from "@/modules/accounts/accounts.service";
import { listClassrooms } from "@/modules/classes/classes.service";
import { listTemplates } from "@/modules/messages/messages.service";
import { getSettings } from "@/modules/settings/settings.service";
import { StudentNotebookView } from "@/modules/students/components/student-notebook";
import { getStudentNotebook } from "@/modules/students/students.service";

export const metadata: Metadata = { title: "Sổ tay học sinh" };

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nhan?: string }>;
}) {
  const user = await requirePagePermission("student.manage");
  const [{ id }, { nhan }] = await Promise.all([params, searchParams]);
  const [notebook, classrooms, templates, settings, accounts] = await Promise.all([
    getStudentNotebook(id, can(user, "student.privateNotes")),
    listClassrooms(),
    listTemplates(),
    getSettings(),
    accountsOfStudent(id),
  ]);
  if (!notebook) notFound();
  return (
    <StudentNotebookView
      data={JSON.parse(JSON.stringify(notebook))}
      classrooms={classrooms.map((c) => ({ id: c.id, name: c.name, shifts: c.shifts.map((s) => ({ id: s.id, name: s.name })) }))}
      templates={templates}
      teacherName={settings.teacherName}
      quietHours={settings.quietHours}
      defaultPrice={settings.billing.defaultUnitPrice}
      openMessage={nhan}
      accounts={JSON.parse(JSON.stringify(accounts))}
      appUrl={process.env.APP_URL ?? ""}
    />
  );
}
