import { redirect } from "next/navigation";

import { OfflineSync } from "@/components/layout/offline-sync";
import { getCurrentUser } from "@/modules/auth/auth.service";

/** Chế độ toàn màn hình (đứng lớp): không thanh điều hướng, chỉ giữ đồng bộ ngoại tuyến. */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  if (!(await getCurrentUser())) redirect("/login");
  return (
    <>
      <OfflineSync />
      {children}
    </>
  );
}
