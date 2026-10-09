"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser, PenLine, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";

type Point = { x: number; y: number };
type Stroke = { color: string; width: number; points: Point[] };

export type AnnotatorHandle = {
  /** null = không đổi gì; "clear" = xóa hết lớp chấm; Blob = lớp chấm mới (PNG trong suốt). */
  export: () => Promise<Blob | "clear" | null>;
};

const COLORS = ["#E11D48", "#16A34A", "#0284C7"];
const MAX_EDGE = 1600;

/**
 * Ảnh bài làm + lớp vẽ của cô (khoanh, gạch, đánh dấu). Lớp vẽ lưu thành PNG trong suốt
 * CÙNG tỉ lệ ảnh, hiển thị chồng lên ảnh gốc — ảnh bài làm của em không bị sửa.
 */
export const Annotator = forwardRef<AnnotatorHandle, { src: string; annotationSrc: string | null; editable?: boolean; className?: string }>(
  function Annotator({ src, annotationSrc, editable = true, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const baseRef = useRef<HTMLImageElement | null>(null);
    const strokes = useRef<Stroke[]>([]);
    const drawing = useRef<Stroke | null>(null);
    const [size, setSize] = useState<{ w: number; h: number } | null>(null);
    const [color, setColor] = useState(COLORS[0]);
    const [cleared, setCleared] = useState(false);
    const [count, setCount] = useState(0); // số nét — để bật/tắt nút Hoàn tác

    const redraw = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      if (baseRef.current && !cleared) ctx.drawImage(baseRef.current, 0, 0, c.width, c.height);
      const all = drawing.current ? [...strokes.current, drawing.current] : strokes.current;
      for (const s of all) {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        s.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        if (s.points.length === 1) ctx.lineTo(s.points[0].x + 0.1, s.points[0].y);
        ctx.stroke();
      }
    }, [cleared]);

    // Kích thước canvas = kích thước thật của ảnh (giới hạn 1600px) → nét vẽ khớp đúng vị trí trên mọi màn hình.
    useEffect(() => {
      let alive = true;
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        const r = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
        setSize({ w: Math.round(img.naturalWidth * r), h: Math.round(img.naturalHeight * r) });
      };
      img.src = src;
      return () => {
        alive = false;
      };
    }, [src]);

    useEffect(() => {
      if (!annotationSrc) return;
      const img = new Image();
      img.onload = () => {
        baseRef.current = img;
        redraw();
      };
      img.src = annotationSrc;
    }, [annotationSrc, redraw]);

    useEffect(() => {
      redraw();
    }, [size, redraw]);

    const point = (e: React.PointerEvent): Point => {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      return { x: ((e.clientX - rect.left) / rect.width) * c.width, y: ((e.clientY - rect.top) / rect.height) * c.height };
    };

    useImperativeHandle(ref, () => ({
      export: async () => {
        if (strokes.current.length === 0) return cleared ? "clear" : null;
        const c = canvasRef.current;
        if (!c) return null;
        return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
      },
    }));

    const lineWidth = size ? Math.max(3, Math.round(size.w / 260)) : 4;

    return (
      <div className={cn("relative", className)}>
        <div className="relative overflow-hidden rounded-[16px] bg-white shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Bài làm" className="block w-full select-none" draggable={false} />
          {size && (
            <canvas
              ref={canvasRef}
              width={size.w}
              height={size.h}
              className={cn("absolute inset-0 size-full", editable && "cursor-crosshair touch-none")}
              onPointerDown={(e) => {
                if (!editable) return;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                drawing.current = { color, width: lineWidth, points: [point(e)] };
                redraw();
              }}
              onPointerMove={(e) => {
                if (!drawing.current) return;
                drawing.current.points.push(point(e));
                redraw();
              }}
              onPointerUp={() => {
                if (!drawing.current) return;
                strokes.current.push(drawing.current);
                drawing.current = null;
                setCount(strokes.current.length);
                redraw();
              }}
            />
          )}
        </div>
        {editable && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 p-1 backdrop-blur">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label="Chọn màu bút"
                onClick={() => setColor(c)}
                className={cn("grid size-8 place-items-center rounded-full", color === c && "ring-2 ring-white")}
              >
                <span className="size-5 rounded-full" style={{ background: c }} />
              </button>
            ))}
            <button
              type="button"
              aria-label="Hoàn tác nét vẽ"
              disabled={count === 0}
              onClick={() => {
                strokes.current.pop();
                setCount(strokes.current.length);
                redraw();
              }}
              className="grid size-8 place-items-center rounded-full text-white disabled:opacity-40"
            >
              <Undo2 className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Xóa hết nét vẽ"
              onClick={() => {
                strokes.current = [];
                setCount(0);
                setCleared(true);
              }}
              className="grid size-8 place-items-center rounded-full text-white"
            >
              <Eraser className="size-4" />
            </button>
            <PenLine className="mx-1 size-4 text-white/70" />
          </div>
        )}
      </div>
    );
  },
);
