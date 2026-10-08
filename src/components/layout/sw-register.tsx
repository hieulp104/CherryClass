"use client";

import { useEffect } from "react";

/** Đăng ký service worker (chỉ bản build — ở dev, cache sẽ làm khó sửa code). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // không đăng ký được (trình duyệt cũ / chế độ riêng tư) — app vẫn chạy bình thường khi có mạng
    });
  }, []);
  return null;
}
