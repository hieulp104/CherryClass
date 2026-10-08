"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import {
  Ban,
  CheckCircle2,
  Copy,
  ExternalLink,
  Gift,
  HeartHandshake,
  History,
  Landmark,
  PencilLine,
  Send,
  Undo2,
  Wallet,
} from "lucide-react";

import { CherryIcon } from "@/components/brand/mascot";
import { StudentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, InvoiceStateChip, Notice } from "@/components/ui/feedback";
import { Field, MoneyInput, Textarea } from "@/components/ui/form";
import { CherryConfetti } from "@/components/ui/fx";
import { PageHeader, Segmented, SectionTitle } from "@/components/ui/page";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { adjustInvoiceAction, voidInvoiceAction, waiveLineAction } from "@/modules/billing/billing.actions";
import type { getInvoiceDetail } from "@/modules/billing/billing.service";
import { ConfirmClaimSheet, RecordPaymentSheet } from "@/modules/billing/components/payment-sheets";
import { MessageComposer } from "@/modules/messages/components/message-composer";
import type { TemplateItem } from "@/modules/messages/messages.service";
import { parentAddress } from "@/modules/messages/messages.templates";
import { fromDbDate, shortDate } from "@/lib/dates";
import { cn, formatDateTime, formatVnd, givenName } from "@/lib/utils";

type Detail = NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>;
// Sau JSON.parse ở page, Date thành chuỗi — dùng kiểu "lỏng" cho phần ngày.
type Loose<T> = T extends Date ? string : T extends (infer U)[] ? Loose<U>[] : T extends object ? { [K in keyof T]: Loose<T[K]> } : T;

export function InvoiceDetailView({ detail, templates }: { detail: Loose<Detail>; templates: TemplateItem[] }) {
  const router = useRouter();
  const toast = useToast();
  const { invoice, settings } = detail;
  const [compose, setCompose] = useState(false);
  const [record, setRecord] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [waiveLine, setWaiveLine] = useState<(typeof invoice.lines)[number] | null>(null);
  const [claim, setClaim] = useState<{ id: string; amount: number; at: string } | null>(null);
  const [confetti, setConfetti] = useState(0);
  const isVoid = invoice.status === "VOID";
  const student = invoice.student;
  const pendingClaims = detail.payments.filter((p) => p.status === "PENDING");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(detail.publicUrl);
      toast.success("Đã sao chép link phiếu");
    } catch {
      toast.error("Chưa sao chép được — cô mở phiếu rồi chia sẻ link nhé.");
    }
  };

  return (
    <div>
      <CherryConfetti fire={confetti} />
      <PageHeader
        back="/thu-tien"
        title={invoice.code}
        subtitle={`Chu kỳ ${invoice.cycleNo} · tạo lúc ${formatDateTime(invoice.issuedAt)}`}
        actions={<InvoiceStateChip state={detail.state} />}
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        <div className="space-y-5">
          {/* Học sinh */}
          <Card className="flex items-center gap-3 p-4">
            <StudentAvatar name={student.fullName} hue={student.avatarHue} size={52} />
            <div className="min-w-0 flex-1">
              <Link href={`/hoc-sinh/${student.id}`} className="font-bold hover:text-primary">
                {student.fullName}
              </Link>
              <p className="text-sm text-muted">
                {student.classroom.name} · {student.parentName ?? "Chưa có tên phụ huynh"}
                {student.parentPhone ? ` · ${student.parentPhone}` : ""}
              </p>
            </div>
            {student.hardship && (
              <Chip tone="grape" icon={HeartHandshake}>
                Khó khăn
              </Chip>
            )}
          </Card>

          {/* Vé tiền */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="overflow-hidden">
              <div className="bg-soft border-b border-dashed border-line-strong p-5">
                <p className="text-sm font-semibold text-muted">{invoice.sessionCount} buổi trong phiếu</p>
                <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {invoice.lines.map((l, i) => (
                    <motion.button
                      key={l.id}
                      type="button"
                      disabled={isVoid}
                      onClick={() => setWaiveLine(l)}
                      initial={{ y: -16, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 380, damping: 16, delay: i * 0.04 }}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.9 }}
                      className="flex flex-col items-center gap-0.5 rounded-[12px] py-1 text-muted"
                      title={`${l.label}${l.waived ? ` — miễn: ${l.waiveReason}` : ""}`}
                    >
                      <span className={cn(l.waived && "opacity-30 grayscale")}>
                        <CherryIcon size={26} filled />
                      </span>
                      <span className={cn("text-[11px] font-semibold tabular", l.waived && "line-through")}>
                        {shortDate(fromDbDate(new Date(l.date)))}
                      </span>
                    </motion.button>
                  ))}
                </div>
                <p className="mt-2 text-caption text-muted">Chạm một quả để miễn / bỏ miễn buổi đó (cần ghi lý do).</p>
              </div>
              <dl className="space-y-2 p-5 text-[15px]">
                <Line label={`Tạm tính (${invoice.lines.filter((l) => !l.waived).length} buổi tính tiền)`} value={invoice.subtotal} />
                {invoice.discountAmount > 0 && <Line label={invoice.discountLabel ?? "Giảm giá"} value={-invoice.discountAmount} tone="leaf" />}
                {invoice.adjustmentTotal !== 0 && <Line label="Điều chỉnh của cô" value={invoice.adjustmentTotal} tone={invoice.adjustmentTotal < 0 ? "leaf" : undefined} />}
                {invoice.roundingAmount !== 0 && <Line label="Làm tròn nghìn" value={invoice.roundingAmount} muted />}
                <div className="border-t border-line pt-2">
                  <Line label="Tiền phiếu này" value={invoice.amount} bold />
                </div>
                {detail.priorDebt > 0 && <Line label="Nợ kỳ trước" value={detail.priorDebt} tone="amber" />}
                {detail.paid > 0 && <Line label="Đã đóng cho phiếu này" value={-detail.paid} tone="leaf" />}
                <div className="flex items-baseline justify-between rounded-control bg-primary-soft px-3 py-3">
                  <dt className="font-bold text-primary-deep">Cần đóng</dt>
                  <dd className="text-2xl font-extrabold text-primary-deep tabular">{formatVnd(detail.totalDue)}</dd>
                </div>
              </dl>
            </Card>
          </motion.div>

          {invoice.adjustments.length > 0 && (
            <>
              <SectionTitle>Lịch sử sửa tay</SectionTitle>
              <Card className="divide-y divide-line">
                {invoice.adjustments.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-4">
                    <History className="mt-0.5 size-4 text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{a.reason}</p>
                      <p className="text-caption text-muted">{formatDateTime(a.createdAt)}</p>
                    </div>
                    <span className={cn("font-bold tabular", a.delta < 0 ? "text-leaf" : "text-overdue")}>
                      {a.delta > 0 ? "+" : ""}
                      {formatVnd(a.delta)}
                    </span>
                  </div>
                ))}
              </Card>
            </>
          )}
        </div>

        <div className="space-y-5">
          {isVoid ? (
            <Notice tone="muted" icon={Ban}>
              Phiếu đã hủy: {invoice.voidReason}
            </Notice>
          ) : (
            <Card className="grid grid-cols-2 gap-2 p-3">
              {pendingClaims.length > 0 && (
                <Button
                  variant="leaf"
                  size="lg"
                  className="col-span-2"
                  onClick={() => setClaim({ id: pendingClaims[0].id, amount: pendingClaims[0].amount, at: String(pendingClaims[0].paidAt) })}
                >
                  <CheckCircle2 className="size-5" /> Xác nhận {formatVnd(pendingClaims[0].amount)} phụ huynh báo
                </Button>
              )}
              {detail.state !== "PAID" && (
                <Button size="lg" className="col-span-2" variant={pendingClaims.length ? "soft" : "primary"} onClick={() => setCompose(true)}>
                  <Send className="size-5" /> {invoice.status === "READY" ? "Gửi phiếu cho phụ huynh" : "Soạn tin nhắc"}
                </Button>
              )}
              <Button variant="outline" onClick={() => setRecord(true)}>
                <Wallet className="size-4" /> Ghi nhận thu
              </Button>
              <Button variant="outline" onClick={() => setAdjust(true)}>
                <PencilLine className="size-4" /> Sửa số tiền
              </Button>
              <a
                href={`/p/${invoice.publicToken}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-[15px] font-semibold hover:bg-surface-subtle active:scale-[0.97]"
              >
                <ExternalLink className="size-4" /> Xem như phụ huynh
              </a>
              <Button variant="outline" onClick={copyLink}>
                <Copy className="size-4" /> Sao chép link
              </Button>
              <Button variant="ghost" className="col-span-2 text-overdue" onClick={() => setVoiding(true)}>
                <Undo2 className="size-4" /> Hủy & tạo lại phiếu
              </Button>
            </Card>
          )}

          <SectionTitle className="mt-0">Tiền đã nhận của em</SectionTitle>
          {detail.payments.length === 0 ? (
            <Card variant="outline" className="p-5 text-center text-sm text-muted">
              Chưa có khoản thu nào.
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {detail.payments.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-4">
                  <span
                    className={cn(
                      "grid size-9 place-items-center rounded-full",
                      p.status === "PENDING" ? "bg-sky-soft text-sky" : "bg-leaf-soft text-leaf",
                    )}
                  >
                    {p.method === "CASH" ? <Gift className="size-4" /> : <Landmark className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {p.status === "PENDING" ? "Phụ huynh báo đã chuyển" : p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                    </p>
                    <p className="truncate text-caption text-muted">
                      {formatDateTime(p.paidAt)}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  <span className={cn("font-bold tabular", p.status === "PENDING" ? "text-sky" : "text-leaf")}>{formatVnd(p.amount)}</span>
                </div>
              ))}
            </Card>
          )}
          <p className="px-1 text-caption text-muted">
            Số dư của em: <b className={detail.balance > 0 ? "text-amber" : "text-leaf"}>{detail.balance > 0 ? `còn thiếu ${formatVnd(detail.balance)}` : detail.balance < 0 ? `đóng thừa ${formatVnd(-detail.balance)}` : "đã đủ"}</b>
          </p>
        </div>
      </div>

      {/* ───── Sheets ───── */}
      {compose && (
        <MessageComposer
          open
          onClose={() => setCompose(false)}
          kinds={["FEE_SOFT", "FEE_GENTLE", "FEE_CLEAR"]}
          initialKind={invoice.status === "READY" ? "FEE_SOFT" : detail.tone}
          templates={templates}
          hardship={student.hardship}
          quietHours={settings.quietHours}
          studentId={student.id}
          invoiceId={invoice.id}
          markSentOnCopy={invoice.status === "READY"}
          onDone={() => router.refresh()}
          vars={{
            tenPhuHuynh: parentAddress(student.parentName),
            tenCon: givenName(student.fullName),
            hoTenCon: student.fullName,
            lop: student.classroom.name,
            soBuoi: invoice.sessionCount,
            soTien: formatVnd(detail.totalDue),
            link: detail.publicUrl,
            tenCo: settings.teacherName,
          }}
        />
      )}
      <RecordPaymentSheet
        open={record}
        onClose={() => setRecord(false)}
        studentId={student.id}
        invoiceId={invoice.id}
        suggested={detail.totalDue}
        onRecorded={() => setConfetti((n) => n + 1)}
      />
      <ConfirmClaimSheet claim={claim} studentName={givenName(student.fullName)} onClose={() => setClaim(null)} onConfirmed={() => setConfetti((n) => n + 1)} />
      <AdjustSheet open={adjust} onClose={() => setAdjust(false)} invoiceId={invoice.id} amount={invoice.amount} />
      <VoidSheet open={voiding} onClose={() => setVoiding(false)} invoiceId={invoice.id} />
      <WaiveSheet line={waiveLine} onClose={() => setWaiveLine(null)} />
    </div>
  );
}

function Line({ label, value, tone, bold, muted }: { label: string; value: number; tone?: "leaf" | "amber"; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={cn("text-muted", bold && "font-bold text-foreground")}>{label}</dt>
      <dd
        className={cn(
          "font-semibold tabular",
          tone === "leaf" && "text-leaf",
          tone === "amber" && "text-amber",
          bold && "text-lg font-extrabold",
          muted && "text-muted",
        )}
      >
        {formatVnd(value)}
      </dd>
    </div>
  );
}

const QUICK_REASONS = ["Gia đình khó khăn", "Con ốm nghỉ dài", "Thưởng chuyên cần", "Cộng tiền tài liệu"];

function AdjustSheet({ open, onClose, invoiceId, amount }: { open: boolean; onClose: () => void; invoiceId: string; amount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [dir, setDir] = useState<"down" | "up">("down");
  const [value, setValue] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const delta = dir === "down" ? -value : value;

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await adjustInvoiceAction({ invoiceId, delta, reason });
      if (!res.ok) return setError(res.message);
      toast.success(`Đã sửa phiếu: ${formatVnd(amount)} → ${formatVnd(res.data.amount)}`);
      setValue(0);
      setReason("");
      onClose();
      router.refresh();
    });

  return (
    <Sheet open={open} onClose={onClose} title="Sửa số tiền phiếu" description="Mọi lần sửa đều được lưu lại kèm lý do" size="sm">
      <div className="space-y-4 pb-2">
        <Segmented
          layoutId="adj-dir"
          value={dir}
          onChange={setDir}
          options={[
            { value: "down", label: "Giảm bớt" },
            { value: "up", label: "Cộng thêm" },
          ]}
        />
        <Field label="Số tiền">
          <MoneyInput key={dir} onValueChange={setValue} autoFocus />
        </Field>
        <Field label="Lý do (bắt buộc)">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold active:scale-95">
                {r}
              </button>
            ))}
          </div>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {value > 0 && (
          <p className="rounded-control bg-surface-subtle px-3 py-2 text-sm">
            {formatVnd(amount)} → <b>khoảng {formatVnd(Math.max(0, amount + delta))}</b> (làm tròn nghìn sau cùng)
          </p>
        )}
        {error && <Notice tone="overdue">{error}</Notice>}
        <Button size="lg" block loading={pending} disabled={value <= 0 || reason.trim().length < 3} onClick={submit}>
          Lưu thay đổi
        </Button>
      </div>
    </Sheet>
  );
}

function VoidSheet({ open, onClose, invoiceId }: { open: boolean; onClose: () => void; invoiceId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = () =>
    start(async () => {
      const res = await voidInvoiceAction({ invoiceId, reason });
      if (!res.ok) return setError(res.message);
      const next = res.data.reissued[0];
      toast.success(next ? `Đã hủy phiếu cũ và tạo phiếu mới ${next.code}` : "Đã hủy phiếu — các buổi quay về bộ đếm");
      onClose();
      router.push(next ? `/thu-tien/${next.id}` : "/thu-tien");
      router.refresh();
    });
  return (
    <Sheet open={open} onClose={onClose} title="Hủy & tạo lại phiếu" size="sm">
      <div className="space-y-4 pb-2">
        <Notice tone="amber">
          Các buổi trong phiếu được trả về bộ đếm và em tạo phiếu mới ngay (chưa gửi, nên cô sửa điểm danh được). Tiền đã đóng vẫn giữ nguyên.
        </Notice>
        <Field label="Lý do hủy (bắt buộc)">
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="vd: Điểm danh nhầm buổi 15/09" />
        </Field>
        {error && <Notice tone="overdue">{error}</Notice>}
        <Button variant="danger" size="lg" block loading={pending} disabled={reason.trim().length < 3} onClick={submit}>
          Hủy phiếu này
        </Button>
      </div>
    </Sheet>
  );
}

function WaiveSheet({
  line,
  onClose,
}: {
  line: { id: string; date: string | Date; label: string; unitPrice: number; waived: boolean; waiveReason: string | null } | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const submit = () =>
    start(async () => {
      if (!line) return;
      const res = await waiveLineAction({ lineId: line.id, waived: !line.waived, reason });
      if (!res.ok) return setError(res.message);
      toast.success(line.waived ? "Đã tính lại buổi này" : "Đã miễn buổi này");
      setReason("");
      onClose();
      router.refresh();
    });
  return (
    <Sheet open={Boolean(line)} onClose={onClose} title={line ? `Buổi ${shortDate(fromDbDate(new Date(line.date)))}` : ""} size="sm">
      {line && (
        <div className="space-y-4 pb-2">
          <p className="text-muted">
            {line.label} · {formatVnd(line.unitPrice)}
          </p>
          {line.waived ? (
            <Notice tone="leaf">Đang miễn: {line.waiveReason}</Notice>
          ) : (
            <Field label="Lý do miễn buổi (bắt buộc)">
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="vd: Cô cho nghỉ sớm vì mất điện" />
            </Field>
          )}
          {error && <Notice tone="overdue">{error}</Notice>}
          <Button size="lg" block loading={pending} variant={line.waived ? "outline" : "primary"} disabled={!line.waived && reason.trim().length < 3} onClick={submit}>
            {line.waived ? "Tính tiền lại buổi này" : "Miễn buổi này"}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
