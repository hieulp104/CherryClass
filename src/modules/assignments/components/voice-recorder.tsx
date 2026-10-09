"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Mic, Square, Trash2 } from "lucide-react";

import { useToast } from "@/components/ui/toast";

/** Ghi âm nhận xét ngắn (tối đa 2 phút). `value`: URL để nghe lại; `onChange(blob | null)`. */
export function VoiceRecorder({ value, onChange }: { value: string | null; onChange: (blob: Blob | null) => void }) {
  const toast = useToast();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: (r.mimeType || "audio/webm").split(";")[0] });
        setLocalUrl(URL.createObjectURL(blob));
        onChange(blob);
      };
      r.start();
      rec.current = r;
      setSeconds(0);
      setRecording(true);
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed += 1;
        setSeconds(elapsed);
        if (elapsed >= 120) stop(); // tối đa 2 phút
      }, 1000);
    } catch {
      toast.error("Chưa dùng được micro. Cô cho phép trình duyệt dùng micro rồi thử lại nhé.");
    }
  };

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    if (rec.current?.state === "recording") rec.current.stop();
    setRecording(false);
  };

  const url = localUrl ?? value;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {recording ? (
        <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-full bg-overdue px-4 py-2 font-semibold text-white">
          <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}>
            <Square className="size-4 fill-current" />
          </motion.span>
          Dừng · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-4 py-2 font-semibold active:scale-95"
        >
          <Mic className="size-4 text-primary" /> {url ? "Ghi lại" : "Ghi âm nhận xét"}
        </button>
      )}
      {url && !recording && (
        <>
          <audio src={url} controls className="h-9 max-w-[220px]" />
          <button
            type="button"
            aria-label="Xóa ghi âm"
            onClick={() => {
              setLocalUrl(null);
              onChange(null);
            }}
            className="grid size-9 place-items-center rounded-full text-muted hover:text-overdue"
          >
            <Trash2 className="size-4" />
          </button>
        </>
      )}
    </div>
  );
}
