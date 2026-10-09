import type { Metadata } from "next";

import { studentAssignments } from "@/modules/assignments/assignments.service";
import { PortalAssignmentList } from "@/modules/portal/components/portal-assignments";
import { PortalFrame } from "@/modules/portal/components/portal-frame";
import { requirePortal } from "@/modules/portal/portal.guard";

export const metadata: Metadata = { title: "Bài tập" };

export default async function Page({ searchParams }: { searchParams: Promise<{ con?: string }> }) {
  const { con } = await searchParams;
  const ctx = await requirePortal("PARENT", con);
  const items = await studentAssignments(ctx.studentId);
  const frame = { base: ctx.base, displayName: ctx.user.displayName, studentId: ctx.studentId, children: ctx.children };
  return (
    <PortalFrame frame={frame}>
      <PortalAssignmentList items={items} frame={frame} />
    </PortalFrame>
  );
}
