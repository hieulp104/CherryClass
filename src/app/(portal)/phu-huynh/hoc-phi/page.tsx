import type { Metadata } from "next";

import { PortalFrame } from "@/modules/portal/components/portal-frame";
import { FeesView } from "@/modules/portal/components/portal-progress";
import { requirePortal } from "@/modules/portal/portal.guard";
import { portalFees, studentBasics } from "@/modules/portal/portal.service";
import { givenName } from "@/lib/utils";

export const metadata: Metadata = { title: "Học phí" };

export default async function Page({ searchParams }: { searchParams: Promise<{ con?: string }> }) {
  const { con } = await searchParams;
  const ctx = await requirePortal("PARENT", con);
  const [fees, basics] = await Promise.all([portalFees(ctx.studentId), studentBasics(ctx.studentId)]);
  const frame = { base: ctx.base, displayName: ctx.user.displayName, studentId: ctx.studentId, children: ctx.children };
  return (
    <PortalFrame frame={frame}>
      <FeesView fees={fees} childName={givenName(basics.fullName)} />
    </PortalFrame>
  );
}
