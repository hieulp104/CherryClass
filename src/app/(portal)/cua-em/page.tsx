import type { Metadata } from "next";

import { PortalFrame } from "@/modules/portal/components/portal-frame";
import { PortalHomeView } from "@/modules/portal/components/portal-home";
import { requirePortal } from "@/modules/portal/portal.guard";
import { portalHome } from "@/modules/portal/portal.service";
import { vnNow } from "@/lib/dates";

export const metadata: Metadata = { title: "Của em" };

export default async function StudentHomePage() {
  const ctx = await requirePortal("STUDENT");
  const data = await portalHome(ctx.studentId);
  const frame = { base: ctx.base, displayName: ctx.user.displayName, studentId: ctx.studentId, children: ctx.children };
  return (
    <PortalFrame frame={frame}>
      <PortalHomeView data={JSON.parse(JSON.stringify(data))} frame={frame} hour={vnNow().hour} />
    </PortalFrame>
  );
}
