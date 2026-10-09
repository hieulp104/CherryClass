"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, FileText, ImagePlus, LoaderCircle, RotateCw, X } from "lucide-react";

import { prepareImage, uploadFile } from "@/lib/image-prep";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type UploadItem = {
  key: string;
  name: string;
  isImage: boolean;
  preview: string | null;
  original: File;
  rotate: 0 | 90 | 180 | 270;
  status: "working" | "done" | "error";
  progress: number;
  fileId: string | null;
  error?: string;
};

/**
 * Lưới chọn ảnh/file có xử lý + tải lên ngay khi chọn (đề bài của cô, bài làm của em).
 * Ảnh: tự xoay theo EXIF, thu nhỏ, làm nét; xoay tay 90°; đổi thứ tự trang.
 * Giá trị trả ra ngoài: danh sách fileId theo đúng thứ tự (qua `onChange`).
 */
export function UploadGrid({
  purpose,
  accept = "image/*,application/pdf",
  enhance = true,
  onChange,
  label = "Chụp / chọn ảnh",
  capture = false,
}: {
  purpose: "assignment" | "submission";
  accept?: string;
  enhance?: boolean;
  onChange: (fileIds: string[], busy: boolean) => void;
  label?: string;
  capture?: boolean;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<UploadItem[]>([]);

  const commit = (next: UploadItem[]) => {
    itemsRef.current = next;
    setItems(next);
    onChange(
      next.filter((i) => i.status === "done" && i.fileId).map((i) => i.fileId!),
      next.some((i) => i.status === "working"),
    );
  };
  const patch = (key: string, p: Partial<UploadItem>) => commit(itemsRef.current.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const process = async (item: UploadItem) => {
    try {
      let blob: Blob = item.original;
      let name = item.name;
      if (item.isImage) {
        blob = await prepareImage(item.original, { rotate: item.rotate, enhance });
        name = item.name.replace(/\.[^.]+$/, "") + ".jpg";
        patch(item.key, { preview: URL.createObjectURL(blob) });
      }
      const saved = await uploadFile(blob, name, purpose, (f) => patch(item.key, { progress: f }));
      patch(item.key, { status: "done", progress: 1, fileId: saved.id });
      haptic(8);
    } catch (e) {
      patch(item.key, { status: "error", error: (e as Error).message });
    }
  };

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const fresh: UploadItem[] = [...files].map((f) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name || "anh.jpg",
      isImage: f.type.startsWith("image/"),
      preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      original: f,
      rotate: 0,
      status: "working",
      progress: 0,
      fileId: null,
    }));
    commit([...itemsRef.current, ...fresh]);
    fresh.forEach((i) => void process(i));
  };

  const rotate = (item: UploadItem) => {
    const next = { ...item, rotate: (((item.rotate + 90) % 360) as UploadItem["rotate"]), status: "working" as const, progress: 0, fileId: null };
    patch(item.key, next);
    void process(next);
  };
  const remove = (key: string) => commit(itemsRef.current.filter((i) => i.key !== key));
  const move = (key: string, dir: -1 | 1) => {
    const list = [...itemsRef.current];
    const i = list.findIndex((x) => x.key === key);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit(list);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <AnimatePresence initial={false}>
          {items.map((item, idx) => (
            <motion.div
              key={item.key}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={cn(
                "relative aspect-[3/4] overflow-hidden rounded-[16px] border bg-surface-subtle",
                item.status === "error" ? "border-overdue" : "border-line",
              )}
            >
              {item.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.preview} alt={`Trang ${idx + 1}`} className="size-full object-cover" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-caption text-muted">
                  <FileText className="size-8 text-sky" />
                  <span className="line-clamp-2 break-all">{item.name}</span>
                </div>
              )}
              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 text-[11px] font-bold text-white">{idx + 1}</span>
              <button
                type="button"
                aria-label="Bỏ trang này"
                onClick={() => remove(item.key)}
                className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/55 text-white active:scale-90"
              >
                <X className="size-4" />
              </button>
              {item.status === "working" && (
                <div className="absolute inset-0 grid place-items-center bg-black/30">
                  <div className="flex flex-col items-center gap-1 text-white">
                    <LoaderCircle className="size-6 animate-spin" />
                    <span className="text-[11px] font-bold">{item.progress > 0 ? `${Math.round(item.progress * 100)}%` : "Đang làm nét…"}</span>
                  </div>
                </div>
              )}
              {item.status === "error" && (
                <button
                  type="button"
                  onClick={() => {
                    patch(item.key, { status: "working", progress: 0 });
                    void process(item);
                  }}
                  className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded-full bg-overdue px-2 py-1 text-[11px] font-bold text-white"
                  title={item.error}
                >
                  <AlertTriangle className="size-3" /> Thử lại
                </button>
              )}
              {item.status === "done" && (
                <div className="absolute inset-x-1 bottom-1 flex justify-between">
                  <span className="flex gap-1">
                    <MiniBtn label="Lên trước" onClick={() => move(item.key, -1)} disabled={idx === 0}>
                      <ArrowLeft className="size-3.5" />
                    </MiniBtn>
                    <MiniBtn label="Ra sau" onClick={() => move(item.key, 1)} disabled={idx === items.length - 1}>
                      <ArrowRight className="size-3.5" />
                    </MiniBtn>
                  </span>
                  {item.isImage && (
                    <MiniBtn label="Xoay 90°" onClick={() => rotate(item)}>
                      <RotateCw className="size-3.5" />
                    </MiniBtn>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {capture && (
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-[16px] border-2 border-dashed border-primary/50 bg-primary-soft/40 text-sm font-semibold text-primary-deep active:scale-95"
          >
            <Camera className="size-7" /> Chụp
          </button>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-[16px] border-2 border-dashed border-line-strong text-sm font-semibold text-muted transition hover:border-primary hover:text-primary active:scale-95"
        >
          <ImagePlus className="size-7" /> {label}
        </button>
      </div>
      <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

function MiniBtn({ children, label, onClick, disabled }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-7 place-items-center rounded-full bg-black/55 text-white active:scale-90 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
