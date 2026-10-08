"use client";

import { useSyncExternalStore } from "react";

/** Trạng thái mạng của trình duyệt. Server luôn coi là có mạng. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("online", notify);
      window.addEventListener("offline", notify);
      return () => {
        window.removeEventListener("online", notify);
        window.removeEventListener("offline", notify);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Đọc một giá trị từ localStorage và theo dõi thay đổi (qua sự kiện `eventName` phát trong cùng tab
 * và sự kiện `storage` từ tab khác). `read` phải trả về giá trị nguyên thủy để so sánh được.
 */
export function useStoredValue<T extends string | number | boolean | null>(
  eventName: string,
  read: () => T,
  serverValue: T,
): T {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener(eventName, notify);
      window.addEventListener("storage", notify);
      return () => {
        window.removeEventListener(eventName, notify);
        window.removeEventListener("storage", notify);
      };
    },
    read,
    () => serverValue,
  );
}
