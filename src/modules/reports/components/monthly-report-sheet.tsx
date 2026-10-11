"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form";
import { Segmented } from "@/components/ui/page";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { monthlyReportAction } from "@/modules/reports/reports.actions";
import { monthlyReportText, type MonthlyReportInput } from "@/modules/reports/report.core";
import { addMonths, vnNow } from "@/lib/dates";

type ReportData = Omit<MonthlyReportInput, "note">;

/** Đầu tháng (≤ ngày 7) thường là lúc gửi báo cáo tháng TRƯỚC — chọn sẵn tháng trước. */
function defaultMonth(today: string) {
  const month = today.slice(0, 7);
  return Number(today.slice(8)) <= 7 ? addMonths(month, -1) : month;
}

/**
 * Báo cáo tháng gửi phụ huynh: số liệu tự gom (chuyên cần, bài tập, điểm), cô viết thêm vài dòng,
 * xem trước rồi sao chép / chia sẻ. App không tự gửi.
 */
export function MonthlyReportSheet({ open, onClose, studentId }: { open: boolean; onClose: () => void; studentId: string }) {
  const [today] = useState(() => vnNow().dateKey);
  const [month, setMonth] = useState(() => defaultMonth(today));
  const current = today.slice(0, 7);
  const options = [addMonths(current, -2), addMonths(current, -1), current].map((m) => ({
    value: m,
    label: `Tháng ${Number(m.slice(5))}`,
  }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Báo cáo tháng"
      description="Gom sẵn chuyên cần, bài tập, điểm — cô viết thêm vài dòng rồi gửi phụ huynh"
      size="md"
    >
      <Segmented label="Chọn tháng" layoutId="report-month" value={month} onChange={setMonth} options={options} className="w-fit" />
      {/* Đổi tháng = dựng lại phần thân (key) — tải số liệu mới, không setState trong effect. */}
      <ReportBody key={month} studentId={studentId} month={month} />
    </Sheet>
  );
}

function ReportBody({ studentId, month }: { studentId: string; month: string }) {
  const toast = useToast();
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    monthlyReportAction({ studentId, month }).then((res) => {
      if (!alive) return;
      if (res.ok) setData(res.data);
      else setError(res.message);
    });
    return () => {
      alive = false;
    };
  }, [studentId, month]);

  if (error) return <p className="mt-4 text-sm text-overdue">{error}</p>;
  if (!data)
    return (
      <div className="mt-4 space-y-3" aria-busy="true" aria-label="Đang gom số liệu…">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    );

  const text = monthlyReportText({ ...data, note });
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      toast.error("Trình duyệt chưa cho sao chép. Cô chạm giữ vào phần xem trước để chọn và sao chép nhé.");
      return;
    }
    setCopied(true);
    toast.success("Đã sao chép — cô dán vào Zalo cho phụ huynh nhé 🍒");
  };

  const share = async () => {
    try {
      await navigator.share({ text });
    } catch {
      // cô hủy chia sẻ
    }
  };

  return (
    <div className="mt-4 space-y-4">
      <Field label="Cô viết thêm" hint="Không bắt buộc — vd: con tiến bộ phần hình học, cần luyện thêm trình bày.">
        <Textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setCopied(false);
          }}
          rows={3}
          maxLength={600}
          placeholder="Một vài dòng về con trong tháng…"
        />
      </Field>

      <div>
        <p className="mb-1.5 text-sm font-semibold">Xem trước</p>
        <div className="whitespace-pre-wrap break-words rounded-control border border-line bg-surface-subtle p-3.5 text-sm leading-relaxed">
          {text}
        </div>
      </div>

      <div className="flex gap-2">
        {canShare && (
          <Button variant="outline" size="lg" onClick={share} aria-label="Chia sẻ">
            <Share2 className="size-5" />
          </Button>
        )}
        <Button size="lg" onClick={copy} variant={copied ? "leaf" : "primary"} className="min-w-0 flex-1">
          {copied ? <Check className="size-5" /> : <Copy className="size-5" />}
          {copied ? "Đã sao chép" : "Sao chép tin nhắn"}
        </Button>
      </div>
    </div>
  );
}
