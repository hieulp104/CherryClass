"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Tranh nền trang đăng nhập — phong cảnh hoàng hôn nhiều lớp núi, sương, một con đường sáng
 * dẫn lên đỉnh và một người đang leo; dấu chân mờ phía sau. Minh họa câu
 * "Trên con đường thành công không có dấu chân của kẻ lười biếng".
 *
 * Màu chuyển mượt bằng gradient + phối cảnh khí quyển (xa nhạt, gần đậm), sương làm mờ bằng blur,
 * phủ một lớp hạt nhẹ cho cảm giác giấy vẽ. Mọi giá trị cố định (không Math.random) để server và
 * trình duyệt vẽ giống hệt nhau.
 */
export function LoginScene({ className }: { className?: string }) {
  const still = Boolean(useReducedMotion());
  const steps = footprints();

  return (
    <svg viewBox="0 0 800 1000" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        {/* Trời hoàng hôn: tím mận → cherry → hồng → đào */}
        <linearGradient id="ls-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E0A1E" />
          <stop offset="0.28" stopColor="#7A1238" />
          <stop offset="0.5" stopColor="#C81E4E" />
          <stop offset="0.66" stopColor="#F05A72" />
          <stop offset="0.78" stopColor="#FB9A8C" />
          <stop offset="1" stopColor="#FDC9A0" />
        </linearGradient>
        <radialGradient id="ls-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF7EC" />
          <stop offset="0.18" stopColor="#FFE2C2" />
          <stop offset="0.42" stopColor="#FDB494" stopOpacity="0.55" />
          <stop offset="1" stopColor="#F05A72" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ls-r1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7A7A6" />
          <stop offset="1" stopColor="#EC7F8E" />
        </linearGradient>
        <linearGradient id="ls-r2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D9506A" />
          <stop offset="1" stopColor="#A31646" />
        </linearGradient>
        <linearGradient id="ls-r3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7E1135" />
          <stop offset="1" stopColor="#4A0820" />
        </linearGradient>
        <linearGradient id="ls-r4" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A0718" />
          <stop offset="1" stopColor="#22040F" />
        </linearGradient>
        <linearGradient id="ls-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE6DC" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFE6DC" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFE6DC" stopOpacity="0" />
        </linearGradient>
        {/* Con đường sáng dần về phía mặt trời */}
        <linearGradient id="ls-path" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FFD9C4" stopOpacity="0.85" />
          <stop offset="0.6" stopColor="#FFE9D6" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FFF4E6" stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id="ls-vignette" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#14020A" stopOpacity="0.35" />
        </radialGradient>
        <filter id="ls-soft" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id="ls-blur2" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        {/* Hạt giấy vẽ */}
        <filter id="ls-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0" />
        </filter>
      </defs>

      <rect width="800" height="1000" fill="url(#ls-sky)" />

      {/* Sao mờ trên vòm trời */}
      {[
        [70, 70, 1.2],
        [190, 130, 0.9],
        [330, 60, 1],
        [470, 110, 0.8],
        [720, 80, 1.1],
        [620, 170, 0.7],
        [260, 210, 0.7],
      ].map(([x, y, r], i) => (
        <motion.circle
          key={i}
          cx={x}
          cy={y}
          r={r}
          fill="#FFE4E6"
          initial={{ opacity: 0.35 }}
          animate={still ? undefined : { opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 4 + (i % 3), repeat: Infinity, delay: i * 0.6 }}
        />
      ))}

      {/* Mặt trời lặn sau dãy núi xa */}
      <motion.circle
        cx="560"
        cy="610"
        r="330"
        fill="url(#ls-sun)"
        style={{ transformOrigin: "560px 610px" }}
        animate={still ? undefined : { scale: [1, 1.04, 1], opacity: [0.95, 1, 0.95] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <circle cx="560" cy="610" r="46" fill="#FFF6EA" opacity="0.95" />

      {/* Mây mỏng */}
      <motion.g
        opacity="0.35"
        filter="url(#ls-soft)"
        animate={still ? undefined : { x: [0, 30, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      >
        <ellipse cx="200" cy="430" rx="190" ry="16" fill="#FFD6CF" />
        <ellipse cx="610" cy="480" rx="170" ry="12" fill="#FFE0D2" />
        <ellipse cx="420" cy="530" rx="140" ry="9" fill="#FFE8DA" />
      </motion.g>

      {/* Chim xa */}
      <motion.g
        stroke="#3A0718"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        opacity="0.55"
        animate={still ? undefined : { x: [0, -40], y: [0, -8] }}
        transition={{ duration: 22, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      >
        <path d="M640 330 q6 -6 12 0 q6 -6 12 0" />
        <path d="M672 352 q4 -4 8 0 q4 -4 8 0" />
        <path d="M610 360 q5 -5 10 0 q5 -5 10 0" />
      </motion.g>

      {/* Dãy núi xa */}
      <path
        d="M0 650 C 80 612, 150 602, 220 626 C 290 650, 340 592, 420 577 C 500 562, 560 612, 630 602 C 700 592, 760 562, 800 572 V1000 H0 Z"
        fill="url(#ls-r1)"
        opacity="0.92"
      />
      <rect x="-40" y="610" width="880" height="140" fill="url(#ls-mist)" filter="url(#ls-soft)" />

      {/* Dãy núi giữa */}
      <path
        d="M0 762 C 120 702, 200 690, 300 728 C 380 760, 450 702, 540 690 C 620 680, 700 728, 800 702 V1000 H0 Z"
        fill="url(#ls-r2)"
      />
      <motion.rect
        x="-60"
        y="720"
        width="920"
        height="120"
        fill="url(#ls-mist)"
        filter="url(#ls-soft)"
        opacity="0.8"
        animate={still ? undefined : { x: [-60, -20, -60] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Đồi gần */}
      <path
        d="M0 862 C 140 802, 260 830, 360 850 C 470 872, 560 812, 680 822 C 740 828, 780 850, 800 846 V1000 H0 Z"
        fill="url(#ls-r3)"
      />

      {/* Con đường sáng lên đỉnh */}
      <path
        d="M380 1000 C 420 950, 520 930, 480 880 C 450 840, 500 800, 520 760 C 530 735, 536 712, 538 694 L 543 694 C 543 714, 540 738, 530 762 C 512 804, 470 842, 500 882 C 540 936, 460 960, 470 1000 Z"
        fill="url(#ls-path)"
      />

      {/* Dấu chân mờ phía sau người leo */}
      {steps.map((st, i) => (
        <motion.ellipse
          key={i}
          cx={st.x}
          cy={st.y}
          rx={3.6 * st.s}
          ry={6.2 * st.s}
          fill="#7E1135"
          transform={`rotate(${st.angle} ${st.x} ${st.y})`}
          initial={still ? false : { opacity: 0 }}
          animate={{ opacity: 0.32 }}
          transition={{ delay: 0.6 + i * 0.12, duration: 0.6 }}
        />
      ))}

      {/* Người đang leo (bóng) */}
      <g transform="translate(523 776)" fill="#2A0612">
        <circle cx="0" cy="-19" r="3.6" />
        <path d="M-2.5 -15 L2.8 -15 L3.6 -4 L5.5 6 L3 6.5 L0.6 -2 L-1.2 6.5 L-3.8 6 L-2.6 -4 Z" />
        <rect x="2.6" y="-14" width="4" height="7.5" rx="1.6" />
        <path d="M-2.6 -12 L-7 -4" stroke="#2A0612" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M-7.4 -4 L-8.6 7" stroke="#2A0612" strokeWidth="1" strokeLinecap="round" />
      </g>

      {/* Cờ nhỏ trên đỉnh */}
      <line x1="540.5" y1="694" x2="540.5" y2="664" stroke="#FFF4E6" strokeWidth="1.6" strokeLinecap="round" />
      <motion.path
        d="M541.5 665 L560 671 L541.5 677 Z"
        fill="#FDBA74"
        style={{ transformOrigin: "541.5px 671px" }}
        animate={still ? undefined : { skewY: [0, -7, 0], scaleX: [1, 0.88, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Tiền cảnh tối */}
      <path d="M0 942 C 200 902, 420 962, 800 920 V1000 H0 Z" fill="url(#ls-r4)" />

      {/* Cành hoa tiền cảnh góc phải trên — thon dần, hoa 5 cánh, bông xa hơi mờ cho có chiều sâu.
          Dịch xuống vì khung ngang (slice) cắt bớt mép trên. */}
      <g transform="translate(0 48)">
        <g stroke="#1E030C" fill="none" strokeLinecap="round">
          <path d="M830 18 C 790 44, 756 66, 722 98" strokeWidth="9" />
          <path d="M722 98 C 690 128, 652 150, 612 166" strokeWidth="5.5" />
          <path d="M612 166 C 590 174, 570 178, 548 180" strokeWidth="2.6" />
          <path d="M748 76 C 760 104, 764 132, 760 160" strokeWidth="3.6" />
          <path d="M690 124 C 686 146, 676 164, 660 178" strokeWidth="2.4" />
        </g>
        <g filter="url(#ls-blur2)" opacity="0.75">
          <Blossom x={772} y={52} r={10} rot={10} tone={2} />
          <Blossom x={632} y={190} r={8} rot={40} tone={1} />
        </g>
        <Blossom x={720} y={102} r={13} rot={18} tone={0} />
        <Blossom x={760} y={160} r={11} rot={-12} tone={1} />
        <Blossom x={612} y={166} r={12} rot={30} tone={2} />
        <Blossom x={660} y={178} r={9.5} rot={4} tone={0} />
        <Blossom x={552} y={180} r={8.5} rot={52} tone={1} />
        <circle cx="690" cy="124" r="4.5" fill="#F9A8C8" />
        <circle cx="584" cy="176" r="3.8" fill="#FBCFE8" />
        <circle cx="748" cy="78" r="4" fill="#FDE2EC" />
      </g>

      {/* Cánh hoa rơi */}
      {[
        { x: 640, d: 0, dur: 16 },
        { x: 700, d: 5, dur: 19 },
        { x: 580, d: 9, dur: 17 },
        { x: 740, d: 12, dur: 21 },
      ].map((p, i) => (
        <motion.ellipse
          key={i}
          cx={p.x}
          cy={200}
          rx="3.2"
          ry="2"
          fill="#FBCFE8"
          initial={{ opacity: 0 }}
          animate={still ? { opacity: 0 } : { x: [0, -120, -260], y: [0, 380, 760], rotate: [0, 180, 360], opacity: [0, 0.9, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, delay: p.d, ease: "linear" }}
        />
      ))}

      {/* Lớp hạt giấy vẽ */}
      <rect width="800" height="1000" filter="url(#ls-grain)" style={{ mixBlendMode: "overlay" }} />
      {/* Tối nhẹ ở viền để chữ trắng nổi rõ */}
      <rect width="800" height="1000" fill="url(#ls-vignette)" />
    </svg>
  );
}

const BLOSSOM_TONES = [
  { petal: "#FDE2EC", edge: "#F9A8C8" },
  { petal: "#FBCFE8", edge: "#F472B6" },
  { petal: "#FFF1F5", edge: "#FBCFE8" },
];

/** Hoa 5 cánh: cánh tròn hơi nhọn, nhụy vàng, chấm đỏ ở gốc cánh. */
function Blossom({ x, y, r, rot, tone }: { x: number; y: number; r: number; rot: number; tone: number }) {
  const c = BLOSSOM_TONES[tone % BLOSSOM_TONES.length];
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx={0}
          cy={-r * 0.55}
          rx={r * 0.46}
          ry={r * 0.6}
          fill={c.petal}
          stroke={c.edge}
          strokeWidth={0.8}
          transform={`rotate(${a})`}
        />
      ))}
      <circle r={r * 0.26} fill="#BE185D" opacity="0.55" />
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={`s${a}`} cx={0} cy={-r * 0.32} r={r * 0.07} fill="#FCD34D" transform={`rotate(${a + 36})`} />
      ))}
    </g>
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
 * Dấu chân dọc đường giữa của con đường (trung bình hai mép), từ chân dốc tới chỗ người đang leo.
 * Xen kẽ trái / phải, nhỏ dần khi lên xa. Làm tròn để server và trình duyệt ra cùng giá trị.
 */
function footprints() {
  const segs: [Pt, Pt, Pt, Pt][] = [
    [[425, 1000], [440, 955], [530, 933], [490, 881]],
    [[490, 881], [460, 841], [506, 802], [525, 761]],
  ];
  const out: { x: number; y: number; s: number; angle: number }[] = [];
  const n = 13;
  const r = (v: number) => Math.round(v * 10) / 10;
  for (let i = 0; i < n; i++) {
    const g = (i + 0.4) / n;
    const seg = g < 0.5 ? 0 : 1;
    const t = seg === 0 ? g / 0.5 : Math.min(0.62, (g - 0.5) / 0.5); // dừng sau lưng người leo
    const [x, y] = bezier(...segs[seg], t);
    const [x2, y2] = bezier(...segs[seg], Math.min(1, t + 0.02));
    const dx = x2 - x;
    const dy = y2 - y;
    const len = Math.hypot(dx, dy) || 1;
    const side = i % 2 === 0 ? -1 : 1;
    const scale = 1 - g * 0.55;
    const off = 6 * scale * side;
    out.push({
      x: r(x + (-dy / len) * off),
      y: r(y + (dx / len) * off),
      s: r(scale * 100) / 100,
      angle: r((Math.atan2(dy, dx) * 180) / Math.PI + 90),
    });
  }
  return out;
}
