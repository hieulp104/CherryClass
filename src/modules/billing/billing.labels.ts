import type { InvoiceDisplayState } from "@/modules/billing/billing.core";

/** Nhãn tiếng Việt cho trạng thái phiếu — dùng chung cho giao diện và file Excel. */
export const INVOICE_STATE_LABEL: Record<InvoiceDisplayState, string> = {
  READY: "Cần gửi",
  WAITING: "Chờ đóng",
  OVERDUE: "Quá hạn",
  PARTIAL: "Đóng thiếu",
  CLAIMED: "Chờ xác nhận",
  PAID: "Đã thu",
  VOID: "Đã hủy",
};
