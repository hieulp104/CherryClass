import type { Metadata } from "next";

import { requirePagePermission } from "@/common/guards/page.guard";
import { listClassrooms } from "@/modules/classes/classes.service";
import { StudentList } from "@/modules/students/components/student-list";
import { listStudents } from "@/modules/students/students.service";

export const metadata: Metadata = { title: "Học sinh" };

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ lop?: string; trangthai?: string; q?: string }>;
}) {
  await requirePagePermission("student.manage");
  const sp = await searchParams;
  const status = (["ACTIVE", "PAUSED", "LEFT"] as const).find((s) => s === sp.trangthai) ?? "ACTIVE";
  const [{ students, cycleLength }, classrooms] = await Promise.all([
    listStudents({ status, classroomId: sp.lop, q: sp.q }),
    listClassrooms(),
  ]);
  return (
    <StudentList
      students={students}
      cycleLength={cycleLength}
      classrooms={classrooms.map((c) => ({ id: c.id, name: c.name, count: c._count.students }))}
      filter={{ status, classroomId: sp.lop ?? "", q: sp.q ?? "" }}
    />
  );
}
