"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Landmark } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, parseMoney, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/page";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { confirmClaimAction, recordPaymentAction, rejectClaimAction } from "@/modules/billing/billing.actions";
import { todayKey } from "@/lib/dates";
import { formatDateTime, formatVnd } from "@/lib/utils";

/** Xác nhận khoản phụ huynh báo đã chuyển — một chạm "Đã nhận đủ", hoặc sửa số nếu thực nhận khác. */
export function ConfirmClaimSheet({
  claim,
  studentName,
  onClose,
  onConfirmed,
}: {
  claim: { id: string; amount: number; at: string } | null;
  studentName: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  return (
    <Sheet open={Boolean(claim)} onClose={onClose} title="Xác nhận đã nhận tiền" size="sm">
      {claim && <ClaimBody key={claim.id} claim={claim} studentName={studentName} onClose={onClose} onConfirmed={onConfirmed} />}
    </Sheet>
  );
}

/** Tách riêng để mỗi khoản báo có state mới (remount theo key), không phải reset bằng effect. */
function ClaimBody({
  claim,
  studentName,
  onClose,
  onConfirmed,
}: {
  claim: { id: string; amount: number; at: string };
  studentName: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState(claim.amount);
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();

  const confirm = (value: number) =>
    start(async () => {
      const res = await confirmClaimAction({ paymentId: claim.id, amount: value });
      if (!res.ok) return toast.error(res.message);
      toast.success(`Đã nhận ${formatVnd(value)} — cảm ơn phụ huynh ${studentName} 💚`);
      onConfirmed();
      onClose();
      router.refresh();
    });

  const reject = () =>
    start(async () => {
      const res = await rejectClaimAction(claim.id);
      if (!res.ok) return toast.error(res.message);
      toast.info("Đã đánh dấu chưa nhận được tiền");
      onClose();
      router.refresh();
    });

  return (
    <div className="space-y-4 pb-2">
      <div className="rounded-card bg-sky-soft p-4">
        <p className="text-sm text-muted">Phụ huynh {studentName} báo đã chuyển</p>
        <p className="mt-1 text-3xl font-extrabold text-sky tabular">{formatVnd(claim.amount)}</p>
        <p className="mt-1 text-caption text-muted">lúc {formatDateTime(claim.at)}</p>
      </div>
      <p className="text-sm text-muted">Cô mở app ngân hàng kiểm tra giúp em. Tiền chỉ được tính là đã thu sau khi cô xác nhận.</p>
      {edit ? (
        <>
          <Field label="Số tiền thực nhận" hint="Nhận ít hơn thì phần còn lại tự chuyển sang kỳ sau">
            <MoneyInput defaultValue={claim.amount} onValueChange={setAmount} />
          </Field>
          <Button size="lg" block variant="leaf" loading={pending} disabled={amount <= 0} onClick={() => confirm(amount)}>
            Xác nhận {formatVnd(amount)}
          </Button>
        </>
      ) : (
        <Button size="xl" block variant="leaf" loading={pending} onClick={() => confirm(claim.amount)}>
          Đã nhận đủ {formatVnd(claim.amount)}
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setEdit((v) => !v)}>
          {edit ? "Nhận đủ" : "Số tiền khác"}
        </Button>
        <Button variant="danger" onClick={reject} disabled={pending}>
          Chưa thấy tiền
        </Button>
      </div>
    </div>
  );
}

/** Cô tự ghi nhận một khoản đã thu (tiền mặt, hoặc chuyển khoản phụ huynh không bấm báo). */
export function RecordPaymentSheet({
  open,
  onClose,
  studentId,
  invoiceId,
  suggested,
  onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  invoiceId?: string | null;
  suggested: number;
  onRecorded: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [method, setMethod] = useState<"BANK_TRANSFER" | "CASH">("BANK_TRANSFER");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (form: FormData) =>
    start(async () => {
      setError(null);
      const amount = parseMoney(form.get("amount"));
      const res = await recordPaymentAction({
        studentId,
        invoiceId,
        amount,
        paidAt: String(form.get("paidAt")),
        method,
        note: String(form.get("note") ?? ""),
      });
      if (!res.ok) return setError(res.message);
      toast.success(`Đã ghi nhận ${formatVnd(amount)} 🍒`);
      onRecorded();
      onClose();
      router.refresh();
    });

  return (
    <Sheet open={open} onClose={onClose} title="Ghi nhận đã thu" size="sm">
      <form action={submit} className="space-y-4 pb-2">
        <Segmented
          layoutId="method"
          value={method}
          onChange={setMethod}
          options={[
            { value: "BANK_TRANSFER", label: <span className="inline-flex items-center gap-1.5"><Landmark className="size-4" /> Chuyển khoản</span> },
            { value: "CASH", label: <span className="inline-flex items-center gap-1.5"><Banknote className="size-4" /> Tiền mặt</span> },
          ]}
        />
        <Field label="Số tiền" hint={suggested > 0 ? `Cần đóng: ${formatVnd(suggested)}` : undefined}>
          <MoneyInput name="amount" defaultValue={suggested > 0 ? suggested : ""} required autoFocus />
        </Field>
        <Field label="Ngày nhận">
          <Input type="date" name="paidAt" defaultValue={todayKey()} max={todayKey()} required />
        </Field>
        <Field label="Ghi chú (không bắt buộc)">
          <Textarea name="note" rows={2} placeholder="vd: Mẹ An đưa tận tay" />
        </Field>
        {error && <Notice tone="overdue">{error}</Notice>}
        <Button type="submit" size="lg" block variant="leaf" loading={pending}>
          Lưu khoản thu
        </Button>
      </form>
    </Sheet>
  );
}
