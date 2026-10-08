import { DEFAULT_BILLING_SETTINGS, type BillingSettings } from "@/modules/billing/billing.core";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/prisma/prisma.service";

/**
 * Cấu hình key/value (bảng `settings`). Mỗi key có giá trị mặc định ở đây —
 * DB thiếu key nào thì dùng mặc định, nên thêm cấu hình mới không cần migration.
 */

export type BankSettings = {
  /** Mã BIN ngân hàng theo NAPAS, vd 970436 = Vietcombank. */
  bin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
};

export type AppSettings = {
  teacherName: string;
  billing: BillingSettings;
  bank: BankSettings;
  reminders: { gentleAfterDays: number; clearAfterDays: number };
  /** Giờ yên tĩnh — không gửi gì cho phụ huynh/học sinh. */
  quietHours: { from: string; to: string };
  /** Ngày thi vào 10 (GĐ2 dùng cho đếm ngược). */
  examDate: string | null;
};

export const DEFAULT_SETTINGS: AppSettings = {
  teacherName: "cô Hà",
  billing: DEFAULT_BILLING_SETTINGS,
  bank: { bin: "", bankName: "", accountNo: "", accountName: "" },
  reminders: { gentleAfterDays: 7, clearAfterDays: 14 },
  quietHours: { from: "21:30", to: "06:30" },
  examDate: null,
};

type Key = keyof AppSettings;

type Client = Pick<Prisma.TransactionClient, "setting">;

export async function getSettings(client: Client = prisma): Promise<AppSettings> {
  const rows = await client.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const pick = <K extends Key>(key: K): AppSettings[K] => {
    const value = map.get(key);
    if (value === undefined || value === null) return DEFAULT_SETTINGS[key];
    // Gộp với mặc định để key con mới thêm vẫn có giá trị.
    if (typeof value === "object" && !Array.isArray(value) && typeof DEFAULT_SETTINGS[key] === "object") {
      return { ...(DEFAULT_SETTINGS[key] as object), ...(value as object) } as AppSettings[K];
    }
    return value as AppSettings[K];
  };
  return {
    teacherName: pick("teacherName"),
    billing: pick("billing"),
    bank: pick("bank"),
    reminders: pick("reminders"),
    quietHours: pick("quietHours"),
    examDate: pick("examDate"),
  };
}

export async function getBillingSettings(client: Client = prisma): Promise<BillingSettings> {
  return (await getSettings(client)).billing;
}

export async function saveSetting<K extends Key>(key: K, value: AppSettings[K], client: Client = prisma) {
  await client.setting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}
