"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Check, Copy, HeartHandshake, Moon, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/form";
import { Segmented } from "@/components/ui/page";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { logMessageAction } from "@/modules/messages/messages.actions";
import type { TemplateItem } from "@/modules/messages/messages.service";
import { inQuietHours, MESSAGE_KIND_META, renderTemplate, type MessageKind } from "@/modules/messages/messages.templates";
import { vnNow } from "@/lib/dates";

/**
 * Soạn tin cho phụ huynh: chọn giọng, sửa nội dung, SAO CHÉP để cô tự gửi.
 * App không tự gửi gì — đúng yêu cầu "không tự gửi tin đòi tiền khi chưa có cô duyệt".
 */
export function MessageComposer({
  open,
  onClose,
  kinds,
  initialKind,
  templates,
  vars,
  studentId,
  invoiceId,
  markSentOnCopy = false,
  hardship = false,
  quietHours,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  kinds: MessageKind[];
  initialKind: MessageKind;
  templates: TemplateItem[];
  vars: Record<string, string | number | null | undefined>;
  studentId?: string | null;
  invoiceId?: string | null;
  markSentOnCopy?: boolean;
  hardship?: boolean;
  quietHours: { from: string; to: string };
  onDone?: () => void;
}) {
  const toast = useToast();
  // Composer luôn được mount mới mỗi lần mở (điều kiện ở nơi gọi) — state khởi tạo thẳng từ props.
  const [kind, setKind] = useState<MessageKind>(initialKind);
  const [templateIndex, setTemplateIndex] = useState(0);
  const optionsFor = (k: MessageKind) => templates.filter((t) => t.kind === k);
  const render = (k: MessageKind, i: number) => {
    const list = optionsFor(k);
    const t = list[i] ?? list[0];
    return t ? renderTemplate(t.body, vars) : "";
  };
  const options = optionsFor(kind);
  const [text, setText] = useState(() => render(initialKind, 0));
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [quiet] = useState(() => inQuietHours(vnNow().time, quietHours));

  const pick = (k: MessageKind, i: number) => {
    setKind(k);
    setTemplateIndex(i);
    setText(render(k, i));
    setCopied(false);
  };

  const copy = () =>
    start(async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        toast.error("Trình duyệt chưa cho sao chép. Cô chạm giữ vào ô tin nhắn để chọn và sao chép nhé.");
        return;
      }
      setCopied(true);
      const res = await logMessageAction({ kind, content: text, studentId, invoiceId, markSent: markSentOnCopy });
      if (!res.ok) toast.error(res.message);
      else toast.success(markSentOnCopy ? "Đã sao chép — phiếu chuyển sang 'Chờ đóng' 🍒" : "Đã sao chép tin nhắn");
      onDone?.();
    });

  const share = async () => {
    try {
      await navigator.share({ text });
      await logMessageAction({ kind, content: text, studentId, invoiceId, markSent: markSentOnCopy });
      onDone?.();
    } catch {
      // người dùng hủy chia sẻ
    }
  };

  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Soạn tin cho phụ huynh"
      description="Cô xem lại, sửa nếu cần rồi sao chép để gửi qua Zalo/tin nhắn"
      size="md"
      footer={
        <div className="flex gap-2">
          {canShare && (
            <Button variant="outline" size="lg" onClick={share} aria-label="Chia sẻ">
              <Share2 className="size-5" />
            </Button>
          )}
          <Button size="lg" block onClick={copy} loading={pending} variant={copied ? "leaf" : "primary"}>
            {!pending && (copied ? <Check className="size-5" /> : <Copy className="size-5" />)}
            {copied ? "Đã sao chép" : "Sao chép tin nhắn"}
          </Button>
        </div>
      }
    >
      {kinds.length > 1 && (
        <Segmented
          layoutId="tone"
          value={kind}
          onChange={(k) => pick(k, 0)}
          options={kinds.map((k) => ({ value: k, label: `${MESSAGE_KIND_META[k].emoji} ${MESSAGE_KIND_META[k].label}` }))}
        />
      )}
      <p className="mt-2 text-caption text-muted">{MESSAGE_KIND_META[kind].hint}</p>

      {hardship && (
        <Notice tone="grape" icon={HeartHandshake} className="mt-3">
          Gia đình em đang khó khăn — app đã chọn giọng nhẹ nhàng nhất. Cô cân nhắc nhắn riêng nhé.
        </Notice>
      )}
      {quiet && (
        <Notice tone="sky" icon={Moon} className="mt-3">
          Đang là giờ nghỉ ({quietHours.from}–{quietHours.to}). Cô cứ sao chép sẵn, sáng mai hãy gửi cho phụ huynh nhé.
        </Notice>
      )}

      {options.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((t, i) => (
            <button
              key={`${t.id}-${i}`}
              type="button"
              onClick={() => pick(kind, i)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
                i === templateIndex ? "border-primary bg-primary-soft text-primary-deep" : "border-line"
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      <motion.div key={`${kind}-${templateIndex}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} className="text-[15px]" />
      </motion.div>
      {/\{\w+\}/.test(text) && (
        <p className="mt-2 text-caption font-medium text-amber">
          Còn chỗ trong ngoặc {"{…}"} chưa có thông tin — cô sửa tay giúp em trước khi gửi nhé.
        </p>
      )}
    </Sheet>
  );
}
