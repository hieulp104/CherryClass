import { redirect } from "next/navigation";

import { homeFor } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";

/** Cửa vào chung: chuyển tới trang chủ theo vai trò. */
export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/doi-mat-khau");
  redirect(homeFor(user));
}
