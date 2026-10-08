"use client";

import { RefreshCw } from "lucide-react";

import { Mascot } from "@/components/brand/mascot";
import { Button } from "@/components/ui/button";

export function OfflineScreen() {
  return (
    <main className="bg-soft flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Mascot mood="worried" size={140} />
      <h1 className="mt-4 text-h1 font-extrabold">Mạng đang nghỉ chút xíu</h1>
      <p className="mt-2 max-w-sm text-muted">
        Trang này chưa được lưu trên máy. Những buổi cô đã mở trước đó vẫn điểm danh được — có mạng là em tự gửi ạ.
      </p>
      <Button className="mt-6" onClick={() => location.reload()}>
        <RefreshCw className="size-4" /> Thử lại
      </Button>
    </main>
  );
}
