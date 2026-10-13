import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";

import { handleSepayTransaction, sepayPayloadSchema } from "@/modules/billing/bank.service";

/**
 * Webhook SePay: tiền vào tài khoản nhận học phí → app tự khớp phiếu và xác nhận.
 * Cài trên SePay: URL = <tên miền>/api/public/sepay, xác thực "API Key" = biến môi trường SEPAY_API_KEY.
 * SePay coi là thành công khi nhận HTTP 200 + {"success": true} trong 30 giây; thất bại thì gửi lại (tối đa 7 lần).
 * Chưa cài SEPAY_API_KEY → từ chối mọi yêu cầu (không bao giờ nhận giao dịch không xác thực).
 */
function authorized(header: string | null): boolean {
  const key = process.env.SEPAY_API_KEY;
  if (!key || !header) return false;
  const expected = Buffer.from(`Apikey ${key}`);
  const got = Buffer.from(header.trim());
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function POST(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }
  const parsed = sepayPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, message: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  try {
    const result = await handleSepayTransaction(parsed.data);
    if (result.status === "MATCHED" || result.status === "UNMATCHED") {
      revalidatePath("/thu-tien");
      revalidatePath("/hom-nay");
      revalidatePath("/thong-ke");
    }
    return Response.json({ success: true, status: result.status });
  } catch (e) {
    // Hai lần gửi cùng lúc của một giao dịch: lần sau vấp ràng buộc UNIQUE → coi như đã nhận.
    if (e && typeof e === "object" && "code" in e && e.code === "P2002") return Response.json({ success: true, status: "DUPLICATE" });
    throw e;
  }
}
