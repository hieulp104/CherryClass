"use client";

import { RefreshCw } from "lucide-react";

import { Mascot } from "@/components/brand/mascot";
import { Button } from "@/components/ui/button";

/** Lỗi bất ngờ — không đổ lỗi cho cô, luôn có cách thử lại. */
export default function MainError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Mascot mood="worried" size={130} />
      <h1 className="mt-4 text-h1 font-extrabold">Ối, em bị vấp một chút</h1>
      <p className="mt-2 max-w-sm text-muted">
        Dữ liệu của cô vẫn an toàn. Cô bấm thử lại giúp em nhé — nếu vẫn lỗi, kiểm tra kết nối mạng rồi tải lại trang.
      </p>
      <Button className="mt-6" onClick={reset}>
        <RefreshCw className="size-4" /> Thử lại
      </Button>
    </div>
  );
}
