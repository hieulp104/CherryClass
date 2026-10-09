import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { studentSubmission } from "@/modules/assignments/assignments.service";
import { PortalSubmission } from "@/modules/portal/components/portal-assignments";
import { PortalFrame } from "@/modules/portal/components/portal-frame";
import { requirePortal } from "@/modules/portal/portal.guard";

export const metadata: Metadata = { title: "Bài tập" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ con?: string }> }) {
  const [{ id }, { con }] = await Promise.all([params, searchParams]);
  const ctx = await requirePortal("STUDENT", con);
  // Chỉ tìm bài của ĐÚNG em đang xem — id bài của em khác trả 404.
  const sub = await studentSubmission(id, ctx.studentId);
  if (!sub || sub.assignment.archivedAt) notFound();
  const frame = { base: ctx.base, displayName: ctx.user.displayName, studentId: ctx.studentId, children: ctx.children };
  return (
    <PortalFrame frame={frame}>
      <PortalSubmission key={sub.id} sub={JSON.parse(JSON.stringify(sub))} frame={frame} />
    </PortalFrame>
  );
}
