"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Tranh nền trang đăng nhập: con đường uốn lượn leo qua đồi tới lá cờ trên đỉnh,
 * dấu chân dọc đường — minh họa câu "Trên con đường thành công không có dấu chân của kẻ lười biếng".
 * Chỉ vài mảng màu cùng tông cherry, chuyển động rất nhẹ (cờ bay, mây trôi, mặt trời thở).
 */
export function LoginScene({ className }: { className?: string }) {
  const still = Boolean(useReducedMotion());

  const steps = footprints();

  return (
    <svg viewBox="0 0 800 1000" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E11D48" />
          <stop offset="0.6" stopColor="#F43F5E" />
          <stop offset="1" stopColor="#FB7185" />
        </linearGradient>
        <linearGradient id="ls-path" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FFF1F2" />
          <stop offset="1" stopColor="#FFE4E6" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      <rect width="800" height="1000" fill="url(#ls-sky)" />

      {/* Mặt trời */}
      <motion.g
        style={{ transformOrigin: "640px 215px" }}
        animate={still ? undefined : { scale: [1, 1.05, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="640" cy="215" r="150" fill="#FFE4E6" opacity="0.12" />
        <circle cx="640" cy="215" r="95" fill="#FFE4E6" opacity="0.22" />
        <circle cx="640" cy="215" r="58" fill="#FFF1F2" opacity="0.55" />
      </motion.g>

      {/* Mây */}
      {[
        { x: 90, y: 190, w: 1, d: 0 },
        { x: 420, y: 120, w: 0.75, d: 4 },
      ].map((c, i) => (
        <motion.g
          key={i}
          opacity="0.28"
          animate={still ? undefined : { x: [0, 26, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: c.d }}
        >
          <g transform={`translate(${c.x} ${c.y}) scale(${c.w})`}>
            <rect x="0" y="20" width="170" height="38" rx="19" fill="#fff" />
            <circle cx="60" cy="24" r="30" fill="#fff" />
            <circle cx="108" cy="30" r="22" fill="#fff" />
          </g>
        </motion.g>
      ))}

      {/* Đồi xa */}
      <path d="M0 700 Q180 590 380 650 T800 600 V1000 H0 Z" fill="#FB7185" opacity="0.55" />
      {/* Đồi giữa */}
      <path d="M0 790 Q240 690 470 760 T800 720 V1000 H0 Z" fill="#BE123C" opacity="0.6" />
      {/* Đồi gần */}
      <path d="M0 880 Q290 800 560 860 T800 840 V1000 H0 Z" fill="#9F1239" />

      {/* Con đường */}
      <path
        d="M350 1000 C 380 930, 540 905, 500 846 C 460 796, 520 748, 606 694 L 616 699 C 536 750, 486 798, 526 848 C 576 912, 440 940, 470 1000 Z"
        fill="url(#ls-path)"
        opacity="0.9"
      />

      {/* Dấu chân — bám giữa con đường, xen kẽ trái/phải, nhỏ dần khi lên xa */}
      {steps.map((st, i) => (
        <motion.ellipse
          key={i}
          cx={st.x}
          cy={st.y}
          rx={4.6 * st.s}
          ry={7.6 * st.s}
          fill="#9F1239"
          transform={`rotate(${st.angle} ${st.x} ${st.y})`}
          initial={still ? false : { opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.4 + i * 0.12, duration: 0.4 }}
        />
      ))}

      {/* Cây cherry trên đồi */}
      {[
        { x: 140, y: 770, s: 1 },
        { x: 250, y: 735, s: 0.8 },
        { x: 700, y: 735, s: 0.85 },
        { x: 90, y: 860, s: 1.2 },
      ].map((t, i) => (
        <g key={i} transform={`translate(${t.x} ${t.y}) scale(${t.s})`}>
          <rect x="-3" y="-6" width="6" height="26" rx="3" fill="#7F1D1D" />
          <circle cx="0" cy="-22" r="22" fill="#16A34A" />
          <circle cx="-14" cy="-12" r="14" fill="#15803D" />
          <circle cx="13" cy="-13" r="15" fill="#22C55E" />
          <circle cx="-6" cy="-24" r="3.2" fill="#FFE4E6" />
          <circle cx="8" cy="-14" r="3.2" fill="#FFE4E6" />
          <circle cx="-12" cy="-8" r="3.2" fill="#FFE4E6" />
        </g>
      ))}

      {/* Lá cờ trên đỉnh */}
      <line x1="612" y1="696" x2="612" y2="610" stroke="#FFF1F2" strokeWidth="4" strokeLinecap="round" />
      <motion.path
        d="M614 612 L662 626 L614 642 Z"
        fill="#FBBF24"
        style={{ transformOrigin: "614px 627px" }}
        animate={still ? undefined : { skewY: [0, -6, 0], scaleX: [1, 0.9, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <circle cx="612" cy="606" r="5" fill="#FBBF24" />
    </svg>
  );
}

type Pt = [number, number];

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/**
 * Đường giữa của con đường = trung bình hai mép (cùng các điểm điều khiển với path vẽ đường).
 * Mỗi bước lệch sang trái / phải vuông góc với hướng đi.
 */
function footprints() {
  const segs: [Pt, Pt, Pt, Pt][] = [
    [[410, 1000], [410, 935], [558, 908], [513, 847]],
    [[513, 847], [473, 797], [528, 749], [611, 697]],
  ];
  const out: { x: number; y: number; s: number; angle: number }[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const g = (i + 0.4) / n; // 0 → 1 dọc đường
    const seg = g < 0.55 ? 0 : 1;
    const t = seg === 0 ? g / 0.55 : (g - 0.55) / 0.45;
    const [x, y] = bezier(...segs[seg], t);
    const [x2, y2] = bezier(...segs[seg], Math.min(1, t + 0.02));
    const dx = x2 - x;
    const dy = y2 - y;
    const len = Math.hypot(dx, dy) || 1;
    const side = i % 2 === 0 ? -1 : 1;
    const scale = 1 - g * 0.6;
    const off = 7 * scale * side;
    // Làm tròn: Math.atan2 ở Node và trình duyệt lệch ở chữ số thứ 14 → lệch hydrate.
    const r = (v: number) => Math.round(v * 10) / 10;
    out.push({
      x: r(x + (-dy / len) * off),
      y: r(y + (dx / len) * off),
      s: r(scale * 100) / 100,
      angle: r((Math.atan2(dy, dx) * 180) / Math.PI + 90),
    });
  }
  return out;
}
