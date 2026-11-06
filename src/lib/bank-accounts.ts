/**
 * Danh sách tài khoản nhận học phí (hàm thuần, dùng được cả ở trình duyệt).
 * Đúng một tài khoản "đang nhận tiền" — QR trên mọi phiếu chưa đóng lấy tài khoản này (tính sống, không chụp vào phiếu).
 * Tiền về BẤT KỲ tài khoản nào trong danh sách đều được tự xác nhận.
 */

export type BankSettings = {
  /** Mã BIN ngân hàng theo NAPAS, vd 970436 = Vietcombank. */
  bin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};

export type BankAccount = BankSettings & { active: boolean };

export const MAX_BANK_ACCOUNTS = 3;

export function normalizeAccountNo(accountNo: string): string {
  return accountNo.replace(/\D/g, "");
}

/** Đúng một tài khoản đang nhận tiền: giữ tài khoản đầu tiên được chọn, không có thì lấy tài khoản đầu danh sách. */
export function withOneActive<T extends { active: boolean }>(accounts: T[]): T[] {
  const chosen = Math.max(accounts.findIndex((a) => a.active), 0);
  return accounts.map((a, i) => ({ ...a, active: i === chosen }));
}

/**
 * Đọc từ cài đặt đã lưu. Dữ liệu cũ chỉ có một tài khoản (key `bank`) → thành tài khoản đang nhận tiền.
 * Đã có key `bankAccounts` (kể cả rỗng) thì bỏ qua key cũ, để tài khoản cô đã xóa không hiện lại.
 */
export function resolveBankAccounts(stored: BankAccount[] | null | undefined, legacy: Partial<BankSettings> | null | undefined): BankAccount[] {
  if (Array.isArray(stored)) return withOneActive(stored);
  if (!legacy?.accountNo) return [];
  return [{ bin: legacy.bin ?? "", bankName: legacy.bankName ?? "", accountNo: legacy.accountNo, accountName: legacy.accountName ?? "", active: true }];
}

export function activeBankAccount(accounts: BankAccount[]): BankSettings {
  const a = accounts.find((x) => x.active) ?? accounts[0];
  return { bin: a?.bin ?? "", bankName: a?.bankName ?? "", accountNo: a?.accountNo ?? "", accountName: a?.accountName ?? "" };
}
