import { redirect } from "next/navigation";

import { homeFor } from "@/common/permissions/permissions";
import { OfflineSync } from "@/components/layout/offline-sync";
import { getCurrentUser } from "@/modules/auth/auth.service";

/** Chế độ toàn màn hình (đứng lớp): không thanh điều hướng, chỉ giữ đồng bộ ngoại tuyến. */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/doi-mat-khau");
  if (user.role !== "TEACHER") redirect(homeFor(user));
  return (
    <>
      <OfflineSync />
      {children}
    </>
  );
}
