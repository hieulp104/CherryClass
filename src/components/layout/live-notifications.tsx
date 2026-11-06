"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/toast";

const POLL_MS = 15_000;

type Latest = { id: string; kind: string; title: string } | null;

/**
 * Tiền về khi cô đang mở app: cứ 15 giây (chỉ khi tab đang hiện) hỏi có thông báo mới không.
 * Có thì hiện toast và tải lại dữ liệu trang — số trên chuông và mục "Đã thu" tự cập nhật.
 */
export function LiveNotifications() {
  const router = useRouter();
  const toast = useToast();
  const toastRef = useRef(toast);
  // undefined = chưa hỏi lần nào; lần đầu chỉ ghi nhận, không báo lại thông báo cũ.
  const seen = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const res = await fetch("/api/thong-bao/moi-nhat", { cache: "no-store" });
        if (!res.ok || res.redirected) return;
        const { latest } = (await res.json()) as { latest: Latest };
        const id = latest?.id ?? null;
        if (seen.current === undefined) {
          seen.current = id;
          return;
        }
        if (latest && id !== seen.current) {
          seen.current = id;
          if (latest.kind === "BANK_AUTO_CONFIRM") toastRef.current.success(`${latest.title} 🍒`);
          else toastRef.current.info(latest.title);
          router.refresh();
        }
      } catch {
        // mất mạng — lần sau hỏi lại
      } finally {
        busy = false;
      }
    };
    void check();
    const timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router]);

  return null;
}
