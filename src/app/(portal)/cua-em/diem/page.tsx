import type { Metadata } from "next";

import { studentProgress } from "@/modules/assignments/assignments.service";
import { PortalFrame } from "@/modules/portal/components/portal-frame";
import { ScoresView } from "@/modules/portal/components/portal-progress";
import { requirePortal } from "@/modules/portal/portal.guard";
import { studentBasics } from "@/modules/portal/portal.service";
import { givenName } from "@/lib/utils";

export const metadata: Metadata = { title: "Điểm" };

export default async function Page({ searchParams }: { searchParams: Promise<{ con?: string }> }) {
  const { con } = await searchParams;
  const ctx = await requirePortal("STUDENT", con);
  const [progress, basics] = await Promise.all([studentProgress(ctx.studentId), studentBasics(ctx.studentId)]);
  const frame = { base: ctx.base, displayName: ctx.user.displayName, studentId: ctx.studentId, children: ctx.children };
  return <PortalFrame frame={frame}><ScoresView progress={JSON.parse(JSON.stringify(progress))} isParent={ctx.base === "/phu-huynh"} childName={givenName(basics.fullName)} frame={frame} /></PortalFrame>;
}
