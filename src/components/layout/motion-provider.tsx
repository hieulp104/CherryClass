"use client";

import { MotionConfig } from "motion/react";

/**
 * Bật "giảm chuyển động" cho MỌI component Motion: khi máy đặt prefers-reduced-motion,
 * chuyển động transform/layout bị tắt (chỉ còn mờ dần) — kể cả vòng lắc lặp vô hạn.
 * Component nào cần xử lý riêng (vd confetti) vẫn dùng useReducedMotion như cũ.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
