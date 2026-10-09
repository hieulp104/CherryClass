import type { Metadata } from "next";

import { PortalFrame } from "@/modules/portal/components/portal-frame";
import { PortalHomeView } from "@/modules/portal/components/portal-home";
import { requirePortal } from "@/modules/portal/portal.guard";
import { portalFees, portalHome } from "@/modules/portal/portal.service";
import { vnNow } from "@/lib/dates";

export const metadata: Metadata = { title: "Phụ huynh" };

export default async function ParentHomePage({ searchParams }: { searchParams: Promise<{ con?: string }> }) {
  const { con } = await searchParams;
  const ctx = await requirePortal("PARENT", con);
  const [data, fees] = await Promise.all([portalHome(ctx.studentId), portalFees(ctx.studentId)]);
  const frame = { base: ctx.base, displayName: ctx.user.displayName, studentId: ctx.studentId, children: ctx.children };
  return (
    <PortalFrame frame={frame}>
      <PortalHomeView
        data={JSON.parse(JSON.stringify(data))}
        frame={frame}
        hour={vnNow().hour}
        fees={{ balance: fees.balance, unpaid: fees.invoices.filter((i) => i.state !== "PAID").length }}
      />
    </PortalFrame>
  );
}
