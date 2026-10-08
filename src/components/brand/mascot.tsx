"use client";

import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/**
 * "Bé Cherry" — linh vật của TeamCherry: hai quả cherry dính chung cuống chữ V, một chiếc lá,
 * mắt tròn có chấm sáng, má hồng. Biểu cảm đổi theo `mood`; tự nhún, lắc cuống và chớp mắt.
 * Tôn trọng "giảm chuyển động" của hệ điều hành.
 */

export type MascotMood = "happy" | "cheer" | "sleepy" | "celebrate" | "worried" | "thinking";

const RED = "#E11D48";
const RED_DEEP = "#9F1239";
const STEM = "#15803D";
const LEAF = "#16A34A";
const LEAF_LIGHT = "#4ADE80";
const INK = "#3B0A1A";
const CHEEK = "#FDA4AF";

type Cherry = { cx: number; cy: number };
const LEFT: Cherry = { cx: 40, cy: 82 };
const RIGHT: Cherry = { cx: 82, cy: 79 };

function Eyes({ c, mood, blink }: { c: Cherry; mood: MascotMood; blink: boolean }) {
  const lx = c.cx - 8;
  const rx = c.cx + 8;
  const y = c.cy - 3;

  if (mood === "cheer" || mood === "celebrate") {
    // Mắt cười ^^
    return (
      <g stroke={INK} strokeWidth={2.6} strokeLinecap="round" fill="none">
        <path d={`M${lx - 4} ${y + 1} Q${lx} ${y - 4} ${lx + 4} ${y + 1}`} />
        <path d={`M${rx - 4} ${y + 1} Q${rx} ${y - 4} ${rx + 4} ${y + 1}`} />
      </g>
    );
  }
  if (mood === "sleepy") {
    return (
      <g stroke={INK} strokeWidth={2.4} strokeLinecap="round" fill="none">
        <path d={`M${lx - 4} ${y} Q${lx} ${y + 3.5} ${lx + 4} ${y}`} />
        <path d={`M${rx - 4} ${y} Q${rx} ${y + 3.5} ${rx + 4} ${y}`} />
      </g>
    );
  }

  const lookUp = mood === "thinking" ? -2.5 : 0;
  const eye = (x: number) => (
    <g>
      <ellipse cx={x} cy={y + lookUp} rx={3.6} ry={blink ? 0.6 : 4.2} fill={INK} />
      {!blink && <circle cx={x + 1.3} cy={y - 1.6 + lookUp} r={1.3} fill="#fff" />}
    </g>
  );

  return (
    <g>
      {eye(lx)}
      {eye(rx)}
      {mood === "worried" && (
        <g stroke={INK} strokeWidth={2} strokeLinecap="round">
          <path d={`M${lx - 4} ${y - 8} L${lx + 3} ${y - 6}`} />
          <path d={`M${rx + 4} ${y - 8} L${rx - 3} ${y - 6}`} />
        </g>
      )}
    </g>
  );
}

function Mouth({ c, mood }: { c: Cherry; mood: MascotMood }) {
  const x = c.cx;
  const y = c.cy + 7;
  switch (mood) {
    case "celebrate":
      return (
        <g>
          <path d={`M${x - 6} ${y - 1} Q${x} ${y + 9} ${x + 6} ${y - 1} Z`} fill={INK} />
          <path d={`M${x - 3} ${y + 3.5} Q${x} ${y + 6} ${x + 3} ${y + 3.5}`} fill="#FB7185" />
        </g>
      );
    case "cheer":
      return <path d={`M${x - 5} ${y - 1} Q${x} ${y + 6} ${x + 5} ${y - 1} Z`} fill={INK} />;
    case "sleepy":
      return <ellipse cx={x} cy={y + 1} rx={2} ry={2.4} fill={INK} />;
    case "worried":
      return (
        <path
          d={`M${x - 5} ${y + 2} q2.5 -3 5 0 q2.5 3 5 0`}
          stroke={INK}
          strokeWidth={2.2}
          strokeLinecap="round"
          fill="none"
        />
      );
    case "thinking":
      return <path d={`M${x - 3} ${y + 1} L${x + 4} ${y}`} stroke={INK} strokeWidth={2.2} strokeLinecap="round" />;
    default:
      return (
        <path
          d={`M${x - 5} ${y} Q${x} ${y + 5} ${x + 5} ${y}`}
          stroke={INK}
          strokeWidth={2.4}
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}

function CherryBody({ c, id }: { c: Cherry; id: string }) {
  return (
    <g>
      <circle cx={c.cx} cy={c.cy} r={24} fill={`url(#${id}-body)`} />
      {/* Vết lõm cuống */}
      <path d={`M${c.cx - 5} ${c.cy - 22} Q${c.cx} ${c.cy - 19} ${c.cx + 5} ${c.cy - 22}`} stroke={RED_DEEP} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6} />
      {/* Chấm bóng */}
      <ellipse cx={c.cx - 10} cy={c.cy - 11} rx={6} ry={3.6} fill="#fff" opacity={0.55} transform={`rotate(-35 ${c.cx - 10} ${c.cy - 11})`} />
      <circle cx={c.cx - 15} cy={c.cy - 3} r={1.6} fill="#fff" opacity={0.5} />
      {/* Má hồng */}
      <ellipse cx={c.cx - 14} cy={c.cy + 5} rx={4.5} ry={2.8} fill={CHEEK} opacity={0.8} />
      <ellipse cx={c.cx + 14} cy={c.cy + 5} rx={4.5} ry={2.8} fill={CHEEK} opacity={0.8} />
    </g>
  );
}

function Extras({ mood, still }: { mood: MascotMood; still: boolean }) {
  if (mood === "sleepy") {
    return (
      <g fill="#A78BFA" fontWeight={800} fontFamily="var(--font-be-vietnam), sans-serif">
        {[
          { x: 98, y: 40, s: 10, d: 0 },
          { x: 106, y: 28, s: 13, d: 0.6 },
          { x: 113, y: 14, s: 16, d: 1.2 },
        ].map((z) => (
          <motion.text
            key={z.d}
            x={z.x}
            y={z.y}
            fontSize={z.s}
            initial={{ opacity: still ? 1 : 0, y: 0 }}
            animate={still ? undefined : { opacity: [0, 1, 0], y: [4, -4, -10] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: z.d }}
          >
            z
          </motion.text>
        ))}
      </g>
    );
  }
  if (mood === "cheer") {
    return (
      <g>
        <path d="M103 72 L112 30" stroke="#B45309" strokeWidth={2.5} strokeLinecap="round" />
        <motion.path
          d="M112 30 L96 34 L110 44 Z"
          fill="#F59E0B"
          style={{ originX: "112px", originY: "30px" }}
          animate={still ? undefined : { rotate: [0, -10, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <Sparkle x={14} y={40} still={still} />
        <Sparkle x={106} y={102} still={still} delay={0.5} />
      </g>
    );
  }
  if (mood === "celebrate") {
    const bits = [
      { x: 10, y: 30, c: "#F59E0B", r: 20 },
      { x: 108, y: 34, c: "#16A34A", r: -30 },
      { x: 16, y: 104, c: "#0EA5E9", r: 45 },
      { x: 112, y: 96, c: "#A78BFA", r: 10 },
      { x: 24, y: 14, c: "#E11D48", r: -15 },
      { x: 98, y: 12, c: "#F59E0B", r: 60 },
    ];
    return (
      <g>
        {bits.map((b, i) => (
          <motion.rect
            key={i}
            x={b.x}
            y={b.y}
            width={6}
            height={3}
            rx={1}
            fill={b.c}
            initial={{ rotate: b.r }}
            animate={still ? undefined : { y: [0, -5, 0], rotate: [b.r, b.r + 90, b.r] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </g>
    );
  }
  if (mood === "worried") {
    return (
      <motion.path
        d="M108 56 q4 7 0 10 q-4 -3 0 -10 Z"
        fill="#7DD3FC"
        animate={still ? undefined : { y: [0, 4, 0], opacity: [1, 0.7, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
    );
  }
  if (mood === "thinking") {
    return (
      <g>
        <circle cx={104} cy={42} r={3} fill="currentColor" opacity={0.25} />
        <rect x={98} y={14} width={24} height={16} rx={8} fill="currentColor" opacity={0.15} />
        {[105, 110, 115].map((x, i) => (
          <motion.circle
            key={x}
            cx={x}
            cy={22}
            r={1.8}
            fill="currentColor"
            animate={still ? undefined : { opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </g>
    );
  }
  return null;
}

function Sparkle({ x, y, still, delay = 0 }: { x: number; y: number; still: boolean; delay?: number }) {
  return (
    <motion.path
      d={`M${x} ${y - 6} L${x + 1.6} ${y - 1.6} L${x + 6} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 6} L${x - 1.6} ${y + 1.6} L${x - 6} ${y} L${x - 1.6} ${y - 1.6} Z`}
      fill="#FBBF24"
      style={{ originX: `${x}px`, originY: `${y}px` }}
      animate={still ? undefined : { scale: [0.6, 1.1, 0.6], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 1.4, repeat: Infinity, delay }}
    />
  );
}

export function Mascot({
  mood = "happy",
  size = 96,
  className,
  title = "Bé Cherry",
}: {
  mood?: MascotMood;
  size?: number;
  className?: string;
  title?: string;
}) {
  const reduce = useReducedMotion();
  const still = Boolean(reduce);
  const id = `bc-${mood}`;

  const bob =
    mood === "celebrate"
      ? { y: [0, -8, 0], rotate: [0, -3, 3, 0] }
      : mood === "sleepy"
        ? { y: [0, 2, 0], rotate: [0, 2, 0] }
        : { y: [0, -4, 0] };

  return (
    <svg
      viewBox="0 0 124 124"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn("shrink-0 overflow-visible text-foreground", className)}
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="55%" stopColor={RED} />
          <stop offset="100%" stopColor={RED_DEEP} />
        </radialGradient>
        <linearGradient id={`${id}-leaf`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={LEAF_LIGHT} />
          <stop offset="100%" stopColor={LEAF} />
        </linearGradient>
      </defs>

      {/* Bóng dưới chân */}
      <ellipse cx={62} cy={116} rx={36} ry={4} fill="#9F1239" opacity={0.12} />

      <motion.g
        animate={still ? undefined : bob}
        transition={{ duration: mood === "celebrate" ? 1 : 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Cuống + lá: lắc lư quanh đỉnh */}
        <motion.g
          style={{ originX: "64px", originY: "16px" }}
          animate={still ? undefined : { rotate: mood === "sleepy" ? [0, 4, 0] : [-3, 3, -3] }}
          transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <path d="M40 59 Q46 30 64 16" stroke={STEM} strokeWidth={3.2} fill="none" strokeLinecap="round" />
          <path d="M82 56 Q76 32 64 16" stroke={STEM} strokeWidth={3.2} fill="none" strokeLinecap="round" />
          <path
            d={mood === "sleepy" ? "M64 16 Q78 22 90 18 Q80 8 64 16 Z" : "M64 16 Q74 0 92 4 Q84 18 64 16 Z"}
            fill={`url(#${id}-leaf)`}
          />
          <path d={mood === "sleepy" ? "M66 16 Q78 17 88 18" : "M66 15 Q78 8 89 5"} stroke={STEM} strokeWidth={1} fill="none" opacity={0.6} />
        </motion.g>

        <CherryBody c={LEFT} id={id} />
        <CherryBody c={RIGHT} id={id} />

        <BlinkingFace mood={mood} still={still} />
      </motion.g>

      <Extras mood={mood} still={still} />
    </svg>
  );
}

function BlinkingFace({ mood, still }: { mood: MascotMood; still: boolean }) {
  const canBlink = !still && (mood === "happy" || mood === "worried" || mood === "thinking");
  return (
    <>
      {canBlink ? (
        <motion.g
          style={{ originY: "76px" }}
          animate={{ scaleY: [1, 1, 0.1, 1] }}
          transition={{ duration: 4.2, times: [0, 0.92, 0.96, 1], repeat: Infinity }}
        >
          <Eyes c={LEFT} mood={mood} blink={false} />
          <Eyes c={RIGHT} mood={mood} blink={false} />
        </motion.g>
      ) : (
        <>
          <Eyes c={LEFT} mood={mood} blink={false} />
          <Eyes c={RIGHT} mood={mood} blink={false} />
        </>
      )}
      <Mouth c={LEFT} mood={mood} />
      <Mouth c={RIGHT} mood={mood} />
    </>
  );
}

/** Quả cherry đơn — dùng cho thanh tiến độ, logo nhỏ, pháo giấy. */
export function CherryIcon({
  filled = true,
  size = 20,
  className,
  glow = false,
}: {
  filled?: boolean;
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={cn("shrink-0", className)} aria-hidden>
      <path d="M12 13 Q13 6 17 2" stroke={filled ? STEM : "currentColor"} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={filled ? 1 : 0.35} />
      {filled && <path d="M17 2 Q20 1 22 3 Q19 5 17 2 Z" fill={LEAF} />}
      {filled ? (
        <>
          <circle cx={11} cy={16} r={6.5} fill={RED} style={glow ? { filter: "drop-shadow(0 0 4px #FB7185)" } : undefined} />
          <ellipse cx={8.6} cy={13.6} rx={1.8} ry={1.1} fill="#fff" opacity={0.6} transform="rotate(-35 8.6 13.6)" />
        </>
      ) : (
        <circle cx={11} cy={16} r={6} fill="none" stroke="currentColor" strokeWidth={1.4} strokeDasharray="2.6 2.2" opacity={0.4} />
      )}
    </svg>
  );
}

/** Logo chữ: cherry + "TeamCherry". */
export function BrandLogo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <span className="grid size-9 place-items-center rounded-[12px] bg-primary-soft">
        <CherryIcon size={24} />
      </span>
      {!compact && (
        <span className="text-lg">
          Team<span className="text-primary">Cherry</span>
        </span>
      )}
    </span>
  );
}
