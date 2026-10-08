"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CloudOff, RefreshCw } from "lucide-react";

import { useToast } from "@/components/ui/toast";
import { finalizeSessionAction } from "@/modules/attendance/attendance.actions";
import { dequeue, QUEUE_EVENT, queued } from "@/modules/attendance/offline-queue";
import { useOnline, useStoredValue } from "@/lib/use-external";

/**
 * Tự gửi lại điểm danh đã lưu trên máy khi có mạng. Hiện một viên nhỏ "Chờ gửi N buổi" khi còn hàng đợi.
 * Đặt một lần ở khung app (cả chế độ đứng lớp).
 */
export function OfflineSync() {
  const router = useRouter();
  const toast = useToast();
  const online = useOnline();
  const count = useStoredValue(QUEUE_EVENT, () => queued().length, 0);
  const busy = useRef(false);

  useEffect(() => {
    const flush = async () => {
      if (busy.current || !navigator.onLine) return;
      const items = queued();
      if (items.length === 0) return;
      busy.current = true;
      let sent = 0;
      for (const item of items) {
        try {
          const res = await finalizeSessionAction({ sessionId: item.sessionId, entries: item.entries, clientOpId: item.clientOpId });
          if (res.ok) {
            dequeue(item.sessionId);
            sent += 1;
          } else if (res.code !== "INTERNAL_ERROR") {
            // Lỗi nghiệp vụ (vd buổi đã khóa) — gỡ khỏi hàng đợi và báo cô xử lý tay.
            dequeue(item.sessionId);
            toast.error(`${item.label ?? "Buổi học"}: ${res.message}`);
          }
        } catch {
          break; // vẫn mất mạng — thử lại lần sau
        }
      }
      busy.current = false;
      if (sent > 0) {
        toast.success(`Có mạng rồi! Đã gửi điểm danh ${sent} buổi 🍒`);
        router.refresh();
      }
    };
    const onOnline = () => void flush();
    void flush();
    window.addEventListener("online", onOnline);
    window.addEventListener(QUEUE_EVENT, onOnline);
    const timer = setInterval(flush, 30_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener(QUEUE_EVENT, onOnline);
      clearInterval(timer);
    };
  }, [router, toast]);

  return (
    <AnimatePresence>
      {(count > 0 || !online) && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="pt-safe pointer-events-none fixed inset-x-0 top-2 z-[65] flex justify-center"
        >
          <span className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-amber-soft px-4 py-2 text-sm font-semibold text-amber shadow-pop">
            {online ? <RefreshCw className="size-4 animate-spin" /> : <CloudOff className="size-4" />}
            {online ? `Đang gửi ${count} buổi đã lưu trên máy…` : count > 0 ? `Mất mạng · ${count} buổi chờ gửi` : "Mất mạng — điểm danh vẫn dùng được"}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
