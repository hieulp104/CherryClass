"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * Cây cherry trong "Vườn cherry" — tranh SVG có chuyển động:
 * - Tán lá nhiều lớp (xa tối, gần sáng) khẽ đung đưa; quả cherry mọc THÀNH ĐÔI trên một cuống, mỗi đôi lắc lư riêng.
 * - Mở trang: quả rơi xuống gắn vào cành lần lượt. Chạm vào một đôi quả: nảy lên + tung chùm hạt lấp lánh.
 * - Hoa trắng = những quả SẮP có (còn bao nhiêu quả nữa thì mở huy hiệu tiếp theo).
 * - Nền: quầng nắng, cánh hoa rơi, đốm lấp lánh, một chú bướm.
 * Giảm chuyển động → mọi thứ đứng yên. Vị trí cố định (không Math.random) để server và trình duyệt vẽ giống nhau.
 */

const MAX_PAIRS = 30; // 60 quả

const r1 = (v: number) => Math.round(v * 10) / 10;
const frac = (v: number) => v - Math.floor(v);

/**
 * Chỗ treo cuống của đôi quả thứ i — rải ĐỀU khắp tán ngay từ đôi đầu tiên
 * (bán kính theo dãy tỉ lệ vàng, góc theo góc vàng), không dồn về tâm.
 */
function pairSpot(i: number) {
  const golden = 2.399963;
  const t = Math.sqrt(0.12 + 0.88 * frac(i * 0.618034 + 0.31));
  const a = i * golden + 0.6;
  return { x: r1(180 + Math.cos(a) * 92 * t), y: r1(120 + Math.sin(a) * 52 * t) };
}

/**
 * Tán lá: [cx, cy, r, lớp]. Lớp 0 = thùy ngoài + lõi (tối) tạo đường viền gồ ghề tự nhiên;
 * lớp 1 = thùy trong (sáng hơn). Ánh nắng là lớp riêng, làm mờ nhòe — không vẽ hình tròn bóng.
 */
const CANOPY: [number, number, number, 0 | 1][] = [
  ...Array.from({ length: 14 }, (_, k): [number, number, number, 0] => {
    const a = (k / 14) * Math.PI * 2 + 0.2;
    return [r1(180 + Math.cos(a) * 100), r1(122 + Math.sin(a) * 58), 33 + (k % 3) * 5, 0];
  }),
  [180, 120, 72, 0],
  [146, 104, 54, 0],
  [214, 106, 54, 0],
  ...Array.from({ length: 10 }, (_, k): [number, number, number, 1] => {
    const a = (k / 10) * Math.PI * 2 + 0.5;
    return [r1(180 + Math.cos(a) * 66), r1(108 + Math.sin(a) * 38), 28 + (k % 2) * 7, 1];
  }),
];

/** Lá nhỏ li ti phủ lên tán cho có vân: [x, y, góc, sáng?]. */
const LEAVES: [number, number, number, boolean][] = Array.from({ length: 70 }, (_, i) => {
  const t = Math.sqrt(frac(i * 0.754877 + 0.13));
  const a = i * 2.399963;
  return [r1(180 + Math.cos(a) * 112 * t), r1(118 + Math.sin(a) * 66 * t), Math.round((i * 47) % 180), i % 3 !== 0];
});

const SPARKLES: [number, number, number][] = [
  [64, 90, 0],
  [300, 70, 1.2],
  [318, 170, 2.1],
  [40, 180, 3],
  [190, 18, 0.7],
  [250, 230, 1.8],
];

const PETALS = [
  { x: 120, d: 0, dur: 9 },
  { x: 230, d: 3, dur: 11 },
  { x: 170, d: 6, dur: 10 },
  { x: 270, d: 8, dur: 12 },
  { x: 95, d: 4.5, dur: 13 },
];

export function CherryTree({ fruits, upcoming, className }: { fruits: number; upcoming: number; className?: string }) {
  const still = Boolean(useReducedMotion());
  const shown = Math.min(fruits, MAX_PAIRS * 2);
  const pairs = Math.ceil(shown / 2);
  const flowers = Math.min(Math.max(upcoming, 0), 6, MAX_PAIRS - pairs);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [popped, setPopped] = useState<number | null>(null);
  const burstSeq = useRef(0);

  const pop = (i: number, x: number, y: number) => {
    if (still) return;
    const id = ++burstSeq.current;
    setPopped(i);
    setBursts((b) => [...b, { id, x, y }]);
    window.setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 800);
    window.setTimeout(() => setPopped((p) => (p === i ? null : p)), 450);
  };

  return (
    <svg viewBox="0 0 360 320" className={className} role="img" aria-label={`Cây cherry có ${fruits} quả`}>
      <defs>
        <radialGradient id="ct-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF7ED" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#FFE4E6" stopOpacity="0.45" />
          <stop offset="1" stopColor="#FFE4E6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ct-bark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#5B3424" />
          <stop offset="0.45" stopColor="#8A5236" />
          <stop offset="1" stopColor="#4A2A1D" />
        </linearGradient>
        {[
          ["ct-leaf0", "#1F9A52", "#126335"],
          ["ct-leaf1", "#43C873", "#1B8A49"],
        ].map(([id, light, dark]) => (
          <radialGradient key={id} id={id} cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor={light} />
            <stop offset="1" stopColor={dark} />
          </radialGradient>
        ))}
        <radialGradient id="ct-cherry" cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#FB7185" />
          <stop offset="0.5" stopColor="#E11D48" />
          <stop offset="1" stopColor="#9F1239" />
        </radialGradient>
        <filter id="ct-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <radialGradient id="ct-hill" cx="0.5" cy="0.35" r="0.5">
          <stop offset="0" stopColor="#86EFAC" stopOpacity="0.75" />
          <stop offset="0.7" stopColor="#86EFAC" stopOpacity="0.35" />
          <stop offset="1" stopColor="#86EFAC" stopOpacity="0" />
        </radialGradient>
        <filter id="ct-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* Quầng nắng sau tán */}
      <motion.circle
        cx="190"
        cy="110"
        r="150"
        fill="url(#ct-sun)"
        style={{ transformOrigin: "190px 110px" }}
        animate={still ? undefined : { scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Đồi cỏ + bóng cây */}
      <ellipse cx="180" cy="304" rx="178" ry="30" fill="url(#ct-hill)" />
      <ellipse cx="182" cy="290" rx="112" ry="10" fill="#14532D" opacity="0.16" filter="url(#ct-soft)" />
      <g stroke="#22A35A" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.7">
        {[60, 92, 268, 300, 236, 128].map((x, i) => (
          <path key={x} d={`M${x} ${292 - (i % 2) * 3} q-2 -9 -5 -12 M${x} ${292 - (i % 2) * 3} q1 -10 4 -13`} />
        ))}
      </g>

      {/* Thân + cành: thon dần, có vân */}
      <path
        d="M162 292 C 166 262, 168 232, 170 204 C 171 190, 168 178, 160 166 L 172 162 C 178 174, 181 184, 182 196 C 186 182, 194 170, 206 158 L 214 166 C 202 178, 194 192, 192 208 C 191 236, 194 264, 200 292 Z"
        fill="url(#ct-bark)"
      />
      <g stroke="#6B3E2A" strokeLinecap="round" fill="none">
        <path d="M168 190 C 150 170, 132 158, 112 150" strokeWidth="7" />
        <path d="M196 178 C 220 160, 240 150, 262 146" strokeWidth="6.5" />
        <path d="M181 196 C 182 160, 178 130, 172 104" strokeWidth="6" />
        <path d="M140 162 C 132 140, 130 122, 134 104" strokeWidth="3.5" />
        <path d="M232 156 C 240 136, 238 118, 230 100" strokeWidth="3.5" />
      </g>
      <g stroke="#3B2117" strokeWidth="1" strokeLinecap="round" opacity="0.35" fill="none">
        <path d="M176 284 C 175 260, 177 236, 178 214" />
        <path d="M186 280 C 186 262, 185 244, 186 226" />
      </g>

      {/* Tán lá + quả: đung đưa cùng nhau quanh chạc cây */}
      <motion.g
        style={{ transformOrigin: "182px 200px" }}
        animate={still ? undefined : { rotate: [-0.8, 0.8, -0.8] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Tán lá mọc lên lúc mở trang */}
        <motion.g
          style={{ transformOrigin: "180px 190px" }}
          initial={still ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 15 }}
        >
          {CANOPY.map(([cx, cy, r, layer], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} fill={`url(#ct-leaf${layer})`} />
          ))}
          {/* Bóng tối dưới đáy tán → khối có chiều dày */}
          <ellipse cx="180" cy="170" rx="96" ry="22" fill="#0F5130" opacity="0.28" filter="url(#ct-blur)" />
          {/* Ánh nắng trên đỉnh tán — mờ nhòe, không viền */}
          <g fill="#B7F5C9" opacity="0.5" filter="url(#ct-blur)">
            <ellipse cx="142" cy="78" rx="34" ry="18" />
            <ellipse cx="196" cy="62" rx="28" ry="14" />
            <ellipse cx="108" cy="112" rx="16" ry="10" />
          </g>
          {/* Lá li ti cho tán có vân */}
          {LEAVES.map(([x, y, rot, light], i) => (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx="5"
              ry="2.4"
              fill={light ? "#5FD38A" : "#0F6B38"}
              opacity={light ? 0.55 : 0.4}
              transform={`rotate(${rot} ${x} ${y})`}
            />
          ))}
        </motion.g>

        {/* Hoa trắng: những quả sắp có (bọc ngoài giữ vị trí, bên trong mới phóng to) */}
        {Array.from({ length: flowers }, (_, k) => {
          const p = pairSpot(pairs + k);
          return (
            <g key={`f${k}`} transform={`translate(${p.x} ${p.y + 10})`}>
              <motion.g
                initial={still ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.7 + k * 0.08, type: "spring", stiffness: 260, damping: 14 }}
              >
                {[0, 72, 144, 216, 288].map((a) => (
                  <ellipse key={a} cx="0" cy="-3.8" rx="2.8" ry="3.8" fill="#FFFFFF" stroke="#FBCFE8" strokeWidth="0.6" transform={`rotate(${a})`} />
                ))}
                <circle r="1.7" fill="#FBBF24" />
              </motion.g>
            </g>
          );
        })}

        {/* Đôi quả cherry */}
        {Array.from({ length: pairs }, (_, i) => {
          const p = pairSpot(i);
          const single = i === pairs - 1 && shown % 2 === 1;
          return (
            <motion.g
              key={i}
              style={{ transformOrigin: `${p.x}px ${p.y}px`, cursor: still ? undefined : "pointer" }}
              initial={still ? false : { y: -36, opacity: 0 }}
              animate={
                popped === i
                  ? { y: [0, -9, 0], scale: [1, 1.15, 1], opacity: 1 }
                  : { y: 0, opacity: 1, rotate: still ? 0 : [-4, 4, -4] }
              }
              transition={
                popped === i
                  ? { duration: 0.45 }
                  : {
                      y: { type: "spring", stiffness: 220, damping: 12, delay: 0.4 + i * 0.045 },
                      opacity: { duration: 0.2, delay: 0.4 + i * 0.045 },
                      rotate: { duration: 2.6 + (i % 5) * 0.35, repeat: Infinity, ease: "easeInOut" },
                    }
              }
              onClick={() => pop(i, p.x, p.y + 14)}
            >
              <path
                d={single ? `M${p.x} ${p.y} q 1 7 -1 13` : `M${p.x} ${p.y} q -2 6 -6 13 M${p.x} ${p.y} q 3 6 6 12`}
                stroke="#14532D"
                strokeWidth="1.3"
                fill="none"
                strokeLinecap="round"
              />
              <path d={`M${p.x} ${p.y} q 5 -5 10 -3 q -4 4 -10 3 Z`} fill="#22A35A" />
              {(single ? [[p.x - 1, p.y + 18]] : [[p.x - 6, p.y + 18], [p.x + 6, p.y + 17]]).map(([cx, cy], k) => (
                <g key={k}>
                  <circle cx={cx} cy={cy} r="6.2" fill="url(#ct-cherry)" />
                  <ellipse cx={cx - 2} cy={cy - 2.2} rx="1.8" ry="1.1" fill="#FFFFFF" opacity="0.75" transform={`rotate(-35 ${cx - 2} ${cy - 2.2})`} />
                </g>
              ))}
            </motion.g>
          );
        })}
      </motion.g>

      {/* Chùm hạt khi chạm quả */}
      <AnimatePresence>
        {bursts.map((b) =>
          Array.from({ length: 8 }, (_, k) => {
            const a = (k / 8) * Math.PI * 2;
            return (
              <motion.circle
                key={`${b.id}-${k}`}
                cx={b.x}
                cy={b.y}
                r={k % 2 ? 1.6 : 2.2}
                fill={k % 3 === 0 ? "#FBBF24" : "#FB7185"}
                initial={{ x: 0, y: 0, opacity: 1 }}
                animate={{ x: Math.cos(a) * 22, y: Math.sin(a) * 22, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            );
          }),
        )}
      </AnimatePresence>

      {/* Đốm lấp lánh */}
      {!still &&
        SPARKLES.map(([x, y, d]) => (
          <motion.path
            key={`${x}-${y}`}
            d={`M${x} ${y - 5} L${x + 1.4} ${y - 1.4} L${x + 5} ${y} L${x + 1.4} ${y + 1.4} L${x} ${y + 5} L${x - 1.4} ${y + 1.4} L${x - 5} ${y} L${x - 1.4} ${y - 1.4} Z`}
            fill="#FBBF24"
            style={{ transformOrigin: `${x}px ${y}px` }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 0.9, 0], scale: [0.4, 1, 0.4], rotate: [0, 45, 90] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: d, ease: "easeInOut" }}
          />
        ))}

      {/* Cánh hoa rơi */}
      {!still &&
        PETALS.map((p, i) => (
          <motion.ellipse
            key={i}
            cx={p.x}
            cy={120}
            rx="3"
            ry="1.8"
            fill="#FBCFE8"
            initial={{ opacity: 0 }}
            animate={{ x: [0, 18, -10, 24], y: [0, 60, 120, 170], rotate: [0, 120, 240, 360], opacity: [0, 0.9, 0.9, 0] }}
            transition={{ duration: p.dur, repeat: Infinity, delay: p.d, ease: "linear" }}
          />
        ))}

      {/* Chú bướm bay quanh cây */}
      {!still && (
        <motion.g
          initial={{ x: 40, y: 230 }}
          animate={{ x: [40, 90, 300, 320, 250, 40], y: [230, 60, 40, 200, 250, 230] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.g
            style={{ transformOrigin: "0px 0px" }}
            animate={{ scaleX: [1, 0.25, 1] }}
            transition={{ duration: 0.28, repeat: Infinity, ease: "easeInOut" }}
          >
            <path d="M0 0 C -7 -9, -12 -3, -7 2 C -11 6, -5 9, 0 3 Z" fill="#F472B6" />
            <path d="M0 0 C 7 -9, 12 -3, 7 2 C 11 6, 5 9, 0 3 Z" fill="#FB7185" />
          </motion.g>
          <rect x="-0.6" y="-3" width="1.2" height="8" rx="0.6" fill="#4A2A1D" />
        </motion.g>
      )}
    </svg>
  );
}
