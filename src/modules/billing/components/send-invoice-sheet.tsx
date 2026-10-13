"use client";

import { useTransition } from "react";
import { BellRing, MessageCircle, Smartphone, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { markInvoiceSentAction } from "@/modules/billing/billing.actions";
import { formatVnd } from "@/lib/utils";

/**
 * Gửi phiếu cho phụ huynh.
 * - Phụ huynh có tài khoản: một chạm — phiếu hiện ngay ở mục "Học phí" trong app của phụ huynh (chấm đỏ, mã QR, số tài khoản).
 * - Chưa có tài khoản: soạn tin Zalo kèm link phiếu như trước.
 * Tin Zalo luôn là tùy chọn thêm, không bắt buộc.
 */
export function SendInvoiceSheet({
  open,
  onClose,
  invoice,
  parentAccount,
  onZalo,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  invoice: { id: string; code: string; sessionCount: number; totalDue: number; childName: string };
  parentAccount: boolean;
  /** Mở hộp soạn tin Zalo. `markSent`: hộp soạn tin tự đánh dấu đã gửi khi cô sao chép. */
  onZalo: (markSent: boolean) => void;
  onSent: () => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();

  const send = (thenZalo: boolean) =>
    start(async () => {
      const res = await markInvoiceSentAction(invoice.id);
      if (!res.ok) return toast.error(res.message);
      toast.success(parentAccount ? "Đã gửi phiếu vào app của phụ huynh 🍒" : "Đã đánh dấu phiếu là đã gửi");
      onSent();
      if (thenZalo) onZalo(false);
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Gửi phiếu cho phụ huynh ${invoice.childName}`}
      size="sm"
      footer={
        parentAccount ? (
          <div className="grid gap-2">
            <Button size="lg" block loading={pending} onClick={() => send(false)}>
              {!pending && <Smartphone className="size-5" />} Gửi phiếu vào app
            </Button>
            <Button variant="outline" block disabled={pending} onClick={() => send(true)}>
              <MessageCircle className="size-4" /> Gửi và soạn thêm tin Zalo
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Button size="lg" block disabled={pending} onClick={() => onZalo(true)}>
              <MessageCircle className="size-5" /> Soạn tin Zalo kèm link phiếu
            </Button>
            <Button variant="ghost" block loading={pending} onClick={() => send(false)}>
              Chỉ đánh dấu đã gửi
            </Button>
          </div>
        )
      }
    >
      <div className="rounded-card bg-surface-subtle p-4">
        <p className="text-sm text-muted">
          {invoice.code} · {invoice.sessionCount} buổi
        </p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight tabular">{formatVnd(invoice.totalDue)}</p>
      </div>

      {parentAccount ? (
        <Notice tone="leaf" icon={BellRing} className="mt-3">
          Phụ huynh đã có tài khoản app. Gửi xong, mục <b>Học phí</b> của phụ huynh hiện chấm đỏ; bấm vào là thấy phiếu, mã QR và số tài
          khoản để chuyển.
        </Notice>
      ) : (
        <Notice tone="amber" icon={UserX} className="mt-3">
          Phụ huynh chưa có tài khoản app, nên cô gửi link phiếu qua Zalo giúp em. Muốn lần sau chỉ cần một chạm: cấp tài khoản phụ
          huynh ở trang <b>Lớp học</b>.
        </Notice>
      )}
      <p className="mt-3 text-caption text-muted">Sau khi gửi, các buổi trong phiếu được khóa điểm danh. Muốn sửa thì sửa qua phiếu.</p>
    </Sheet>
  );
}
