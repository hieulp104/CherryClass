"use client";

import { motion } from "motion/react";

/** Chuyển trang mượt: mỗi lần đổi route, nội dung trượt nhẹ lên và hiện dần. */
export default function MainTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
    >
      {children}
    </motion.div>
  );
}
