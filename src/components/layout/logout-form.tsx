"use client";

import { logoutAction } from "@/modules/auth/auth.actions";
import { clearPageCache } from "@/lib/page-cache";

/** Form đăng xuất dùng chung — xóa trang đã cache ngoại tuyến trước khi thoát. */
export function LogoutForm({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <form action={logoutAction} onSubmit={clearPageCache} className={className}>
      {children}
    </form>
  );
}
