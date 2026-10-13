"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Banknote, FlaskConical, Search, UserCheck } from "lucide-react";

import { StudentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, MoneyInput } from "@/components/ui/form";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { assignBankTransactionAction, dismissBankTransactionAction, simulateBankTransferAction } from "@/modules/billing/bank.actions";
import type { UnmatchedBankTransaction } from "@/modules/billing/bank.service";
import { useStudentSearch } from "@/modules/students/use-student-search";
import { cn, formatDateTime, formatVnd } from "@/lib/utils";

// ─────────────── Tiền về chưa khớp ───────────────

/** Tiền đã về tài khoản nhưng app không biết của em nào — cô gán một chạm, hoặc đánh dấu không phải học phí. */
export function UnmatchedBankPanel({ rows }: { rows: UnmatchedBankTransaction[] }) {
  const router = useRouter();
  const toast = useToast();
  const [assigning, setAssigning] = useState<UnmatchedBankTransaction | null>(null);
  const [pending, start] = useTransition();
  if (rows.length === 0) return null;

  const dismiss = (id: string) =>
    start(async () => {
      const res = await dismissBankTransactionAction(id);
      if (!res.ok) return toast.error(res.message);
      toast.info("Đã bỏ khỏi danh sách");
      router.refresh();
    });

  return (
    <section id="tien-ve" aria-labelledby="tien-ve-title" className="mt-5 scroll-mt-20">
      <Card className="border-amber/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-amber-soft text-amber">
            <Banknote className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 id="tien-ve-title" className="text-lg font-bold tracking-tight">
              {rows.length} khoản tiền về chưa biết của em nào
            </h2>
            <p className="text-sm text-muted">Nội dung chuyển khoản không có mã phiếu. Cô xem nội dung rồi gán cho đúng em.</p>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-extrabold tabular-nums">{formatVnd(r.amount)}</p>
                <p className="break-words text-sm">
                  <span className="text-muted">Nội dung: </span>
                  <span className="font-medium">&ldquo;{r.content || "(trống)"}&rdquo;</span>
                </p>
                <p className="text-caption text-muted">
                  {formatDateTime(r.receivedAt)}
                  {r.reason ? ` · ${r.reason}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => dismiss(r.id)}>
                  Không phải học phí
                </Button>
                <Button size="sm" onClick={() => setAssigning(r)}>
                  <UserCheck className="size-4" /> Gán cho em
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {assigning && <AssignSheet key={assigning.id} row={assigning} onClose={() => setAssigning(null)} />}
    </section>
  );
}

function AssignSheet({ row, onClose }: { row: UnmatchedBankTransaction; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const search = useStudentSearch();
  const [pending, start] = useTransition();

  const assign = (studentId: string, name: string) =>
    start(async () => {
      const res = await assignBankTransactionAction({ transactionId: row.id, studentId });
      if (!res.ok) return toast.error(res.message);
      toast.success(`Đã ghi nhận ${formatVnd(row.amount)} cho ${name} 🍒`);
      onClose();
      router.refresh();
    });

  return (
    <Sheet open onClose={onClose} title={`Gán ${formatVnd(row.amount)} cho em nào?`} description={`Nội dung: "${row.content || "(trống)"}"`} size="sm">
      <div className="space-y-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            autoFocus
            value={search.q}
            onChange={(e) => search.setQuery(e.target.value)}
            placeholder="Gõ tên em, không dấu cũng được"
            className="pl-9"
            aria-label="Tìm học sinh"
          />
        </div>
        <ul className="space-y-1">
          {search.results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => assign(s.id, s.fullName)}
                className="flex w-full items-center gap-3 rounded-control px-2 py-2.5 text-left transition hover:bg-surface-subtle disabled:opacity-50"
              >
                <StudentAvatar name={s.fullName} hue={s.avatarHue} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.fullName}</span>
                  <span className="block text-caption text-muted">
                    {s.classroom.name}
                    {s.shift ? ` · ${s.shift.name}` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {search.q.trim() && !search.pending && search.results.length === 0 && <li className="px-2 py-3 text-sm text-muted">Không thấy em nào tên như vậy.</li>}
        </ul>
        <p className="text-caption text-muted">Tiền được tính vào phiếu cũ nhất còn thiếu của em; dư thì tự trừ kỳ sau.</p>
      </div>
    </Sheet>
  );
}

// ─────────────── Giả lập tiền về (máy thử) ───────────────

type Preset = { label: string; amount: number; content: string };

/**
 * Giả lập một giao dịch ngân hàng giống hệt SePay gửi — để thử luồng tự xác nhận khi chưa đưa app lên mạng.
 * `invoice`: điền sẵn cho một phiếu (số tiền cần đóng + nội dung có mã phiếu như mã QR).
 */
export function SimulateTransferButton({
  invoice,
  className,
  block,
}: {
  invoice?: { code: string; totalDue: number; studentName: string };
  className?: string;
  block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" block={block} className={cn("border-dashed", className)} onClick={() => setOpen(true)}>
        <FlaskConical className="size-4" /> Giả lập tiền về
      </Button>
      {open && <SimulateSheet invoice={invoice} onClose={() => setOpen(false)} />}
    </>
  );
}

function SimulateSheet({ invoice, onClose }: { invoice?: { code: string; totalDue: number; studentName: string }; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const due = invoice?.totalDue ?? 720_000;
  const withCode = invoice ? `HP ${invoice.code} ${invoice.studentName}` : "HP PT-2026-0001";
  const presets: Preset[] = [
    { label: "Đúng số tiền", amount: due, content: withCode },
    { label: "Chuyển thiếu", amount: Math.max(1000, due - 200_000), content: withCode },
    { label: "Chuyển dư", amount: due + 100_000, content: withCode },
    { label: "Quên ghi mã phiếu", amount: due, content: "chuyen tien hoc cho con" },
  ];
  const [preset, setPreset] = useState(0);
  const [amount, setAmount] = useState(presets[0].amount);
  const [content, setContent] = useState(presets[0].content);
  const [pending, start] = useTransition();

  const pick = (i: number) => {
    setPreset(i);
    setAmount(presets[i].amount);
    setContent(presets[i].content);
  };

  const send = () =>
    start(async () => {
      const res = await simulateBankTransferAction({ amount, content });
      if (!res.ok) return toast.error(res.message);
      const r = res.data;
      if (r.status === "MATCHED") {
        toast.success(
          r.fit === "FULL"
            ? "Tiền về khớp phiếu — đã tự xác nhận 🍒"
            : r.fit === "SHORT"
              ? "Tiền về khớp phiếu nhưng THIẾU — đã ghi nhận, phần còn lại sang kỳ sau"
              : "Tiền về khớp phiếu nhưng DƯ — đã ghi nhận, phần dư trừ kỳ sau",
        );
      } else if (r.status === "UNMATCHED") toast.info(`Chưa khớp được: ${r.reason}. Xem mục "Tiền về chưa biết của em nào".`);
      else if (r.status === "IGNORED") toast.info(`Bỏ qua: ${r.reason}`);
      onClose();
      router.refresh();
    });

  return (
    <Sheet open onClose={onClose} title="Giả lập tiền về tài khoản" size="sm">
      <div className="space-y-4 pb-2">
        <Notice tone="sky" icon={FlaskConical}>
          Chỉ có trên máy thử. App xử lý y như khi SePay báo tiền về thật — không có tiền thật nào chuyển đi.
        </Notice>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tình huống mẫu">
          {presets.map((p, i) => (
            <button
              key={p.label}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={preset === i}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-semibold transition active:scale-95",
                preset === i ? "border-primary bg-primary-soft text-primary-deep" : "border-line text-muted hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Field label="Số tiền về">
          <MoneyInput key={`a${preset}`} defaultValue={amount} onValueChange={setAmount} />
        </Field>
        <Field label="Nội dung chuyển khoản" hint="App đọc mã phiếu (PT-…) trong nội dung để biết của em nào.">
          <Input value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
        <motion.div layout>
          <Button size="lg" block loading={pending} disabled={amount < 1000} onClick={send}>
            <Banknote className="size-5" /> Giả lập {formatVnd(amount)} về tài khoản
          </Button>
        </motion.div>
      </div>
    </Sheet>
  );
}
