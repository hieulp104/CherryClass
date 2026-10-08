"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Copy, Hourglass, Send } from "lucide-react";

import { CherryIcon, Mascot } from "@/components/brand/mascot";
import { Button } from "@/components/ui/button";
import { CherryConfetti } from "@/components/ui/fx";
import { useToast } from "@/components/ui/toast";
import type { PublicInvoice } from "@/modules/billing/billing.service";
import { claimTransferAction } from "@/modules/public-invoice/public-invoice.actions";
import { fullDate, shortDate, weekdayOf, WEEKDAY_SHORT } from "@/lib/dates";
import { cn, formatVnd, givenName } from "@/lib/utils";

type Live = Extract<PublicInvoice, { expired: false }>;

/**
 * Phiếu học phí cho phụ huynh — "như một tấm thiệp".
 * Không có thanh điều hướng, không cần đăng nhập. Chỉ hiển thị những trường DTO cho phép.
 */
export function PublicInvoiceCard({ invoice, token, qr }: { invoice: Live | null; token: string; qr: string | null }) {
  if (!invoice) {
    return (
      <Shell>
        <div className="flex flex-col items-center py-10 text-center">
          <Mascot mood="sleepy" size={120} />
          <p className="mt-3 text-xl font-extrabold">Phiếu này không còn hiệu lực</p>
          <p className="mt-1 max-w-xs text-muted">
            Có thể phiếu đã được đóng đủ từ lâu hoặc đã được cô thay bằng phiếu mới. Anh/chị nhắn cô để nhận link mới nhé ạ.
          </p>
        </div>
      </Shell>
    );
  }
  return <Live invoice={invoice} token={token} qr={qr} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-soft min-h-dvh px-4 py-6 sm:py-12">
      <div className="mx-auto max-w-md">{children}</div>
      <p className="mt-6 text-center text-caption text-muted">
        Phiếu được tạo bởi Team<span className="font-bold text-primary">Cherry</span> 🍒
      </p>
    </main>
  );
}

function Live({ invoice, token, qr }: { invoice: Live; token: string; qr: string | null }) {
  const toast = useToast();
  const [claimed, setClaimed] = useState(invoice.state === "CLAIMED");
  const [pending, start] = useTransition();
  const [confetti, setConfetti] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const paid = invoice.state === "PAID";
  const child = givenName(invoice.studentName);

  const claim = () =>
    start(async () => {
      const res = await claimTransferAction(token);
      if (!res.ok) return toast.error(res.message);
      setClaimed(true);
      setConfetti((n) => n + 1);
    });

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép ${label}`);
    } catch {
      toast.error("Chưa sao chép được, anh/chị chạm giữ để chọn nhé.");
    }
  };

  const transferNote = `HP ${invoice.code} ${invoice.studentName}`;

  return (
    <Shell>
      <CherryConfetti fire={confetti} />
      <motion.article
        initial={{ opacity: 0, y: 30, rotate: -1 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 18 }}
        className="relative overflow-hidden rounded-[32px] border border-line bg-surface shadow-pop"
      >
        {/* Đầu thiệp */}
        <header className="bg-hero relative px-6 pb-14 pt-6 text-white">
          <div className="sparkle-overlay absolute inset-0" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white/80">Phiếu học phí · {invoice.code}</p>
              <h1 className="mt-2 text-2xl font-extrabold leading-tight">
                Con <span className="whitespace-nowrap">{invoice.studentName}</span>
              </h1>
              <p className="text-white/85">{invoice.classroom}</p>
            </div>
            <Mascot mood={paid ? "celebrate" : "happy"} size={84} />
          </div>
        </header>

        {/* 10 quả cherry */}
        <section className="relative -mt-9 px-4">
          <div className="rounded-[24px] border border-line bg-surface-raised p-4 shadow-card">
            <p className="text-center text-sm font-semibold text-muted">
              {invoice.sessionCount} buổi con đã học — chạm vào quả để xem
            </p>
            <div className="mt-3 grid grid-cols-5 gap-y-3">
              {invoice.lines.map((l, i) => (
                <motion.button
                  key={i}
                  type="button"
                  onClick={() => setActive(active === i ? null : i)}
                  initial={{ y: -24, opacity: 0, scale: 0.6 }}
                  animate={{ y: active === i ? -6 : 0, opacity: 1, scale: active === i ? 1.15 : 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 15, delay: active === null ? 0.25 + i * 0.07 : 0 }}
                  className="flex flex-col items-center gap-0.5"
                >
                  <span className={cn(l.waived && "opacity-35 grayscale")}>
                    <CherryIcon size={30} />
                  </span>
                  <span className={cn("text-[11px] font-bold tabular", l.waived ? "text-muted line-through" : "text-foreground")}>
                    {shortDate(l.date)}
                  </span>
                </motion.button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              {active !== null && (
                <motion.p
                  key={active}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 rounded-control bg-surface-subtle px-3 py-2 text-center text-sm"
                >
                  {WEEKDAY_SHORT[weekdayOf(invoice.lines[active].date)]}, {fullDate(invoice.lines[active].date)} · {invoice.lines[active].label}
                  {" · "}
                  {invoice.lines[active].waived ? "cô miễn buổi này" : formatVnd(invoice.lines[active].unitPrice)}
                </motion.p>
              )}
            </AnimatePresence>
            {invoice.notCharged.length > 0 && (
              <p className="mt-3 text-center text-caption text-muted">
                Không tính tiền: {invoice.notCharged.map((n) => `${shortDate(n.date)} (${n.status === "EXCUSED" ? "vắng có phép" : "vắng"})`).join(", ")}
              </p>
            )}
          </div>
        </section>

        {/* Tiền */}
        <section className="px-6 pt-5">
          <dl className="space-y-2 text-[15px]">
            <Row label={priceSummary(invoice)} value={formatVnd(invoice.subtotal)} />
            {invoice.discountAmount > 0 && <Row label={invoice.discountLabel ?? "Giảm giá"} value={`−${formatVnd(invoice.discountAmount)}`} green />}
            {invoice.adjustmentTotal !== 0 && (
              <Row label="Điều chỉnh của cô" value={`${invoice.adjustmentTotal > 0 ? "+" : "−"}${formatVnd(Math.abs(invoice.adjustmentTotal))}`} green={invoice.adjustmentTotal < 0} />
            )}
            {invoice.roundingAmount !== 0 && <Row label="Làm tròn" value={`−${formatVnd(-invoice.roundingAmount)}`} green />}
            {invoice.priorDebt > 0 && <Row label="Kỳ trước còn" value={formatVnd(invoice.priorDebt)} />}
            {invoice.paid > 0 && !paid && <Row label="Đã đóng" value={`−${formatVnd(invoice.paid)}`} green />}
          </dl>
          <div className="mt-3 flex items-baseline justify-between border-t-2 border-dashed border-line-strong pt-3">
            <span className="font-bold">{paid ? "Đã đóng đủ" : "Tổng cần đóng"}</span>
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.9 }}
              className={cn("text-[2rem] font-extrabold tracking-tight tabular", paid ? "text-leaf" : "text-primary-deep")}
            >
              {formatVnd(paid ? invoice.amount : invoice.totalDue)}
            </motion.span>
          </div>
        </section>

        {/* Thanh toán */}
        <section className="px-6 pb-6 pt-4">
          {paid ? (
            <motion.div
              initial={{ scale: 1.6, rotate: -18, opacity: 0 }}
              animate={{ scale: 1, rotate: -6, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.6 }}
              className="mx-auto w-fit rounded-[18px] border-4 border-leaf px-5 py-3 text-center text-leaf"
            >
              <p className="text-lg font-extrabold uppercase tracking-wide">Đã nhận</p>
              <p className="text-sm font-semibold">Cảm ơn anh/chị ạ 💚</p>
            </motion.div>
          ) : (
            <>
              {qr && invoice.bank && (
                <div className="rounded-[24px] bg-surface-subtle p-4 text-center">
                  <p className="text-sm font-semibold">Quét mã bằng app ngân hàng — tự điền số tiền</p>
                  <motion.img
                    src={qr}
                    alt="Mã VietQR chuyển khoản học phí"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="mx-auto mt-3 w-56 rounded-[16px] bg-white p-2 shadow-card"
                  />
                  <div className="mt-3 space-y-1.5 text-left text-sm">
                    <CopyRow label="Ngân hàng" value={invoice.bank.bankName} />
                    <CopyRow label="Số tài khoản" value={invoice.bank.accountNo} onCopy={() => copy(invoice.bank!.accountNo, "số tài khoản")} />
                    <CopyRow label="Chủ tài khoản" value={invoice.bank.accountName} />
                    <CopyRow label="Nội dung" value={transferNote} onCopy={() => copy(transferNote, "nội dung")} />
                  </div>
                </div>
              )}
              <AnimatePresence mode="wait">
                {claimed ? (
                  <motion.div
                    key="claimed"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-center gap-3 rounded-[20px] bg-sky-soft p-4"
                  >
                    <Hourglass className="size-6 shrink-0 text-sky" />
                    <div>
                      <p className="font-bold">Em cảm ơn anh/chị ạ!</p>
                      <p className="text-sm text-muted">{invoice.teacherName} đang đối chiếu và sẽ xác nhận sớm nhé.</p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="btn" exit={{ opacity: 0 }} className="mt-4">
                    <Button size="xl" block onClick={claim} loading={pending}>
                      {!pending && <Send className="size-5" />}
                      Tôi đã chuyển khoản
                    </Button>
                    <p className="mt-2 text-center text-caption text-muted">
                      Bấm sau khi chuyển để {invoice.teacherName} biết và xác nhận cho con {child} ạ.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </section>
      </motion.article>
    </Shell>
  );
}

function priceSummary(invoice: Live): string {
  const charged = invoice.lines.filter((l) => !l.waived);
  const prices = [...new Set(charged.map((l) => l.unitPrice))];
  if (prices.length === 1) return `${charged.length} buổi × ${formatVnd(prices[0])}`;
  return prices.map((p) => `${charged.filter((l) => l.unitPrice === p).length} × ${formatVnd(p)}`).join(" + ");
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={cn("font-semibold tabular", green && "text-leaf")}>{value}</dd>
    </div>
  );
}

function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-control bg-surface px-3 py-2">
      <span className="text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-semibold">{value}</span>
        {onCopy && (
          <button
            type="button"
            aria-label={`Sao chép ${label}`}
            onClick={() => {
              onCopy();
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            }}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary active:scale-90"
          >
            {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        )}
      </span>
    </div>
  );
}
