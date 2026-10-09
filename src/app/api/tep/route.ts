import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/modules/auth/auth.service";
import { storeFile, validateUpload, type UploadPurpose } from "@/modules/files/files.service";

const PURPOSES: UploadPurpose[] = ["assignment", "submission", "annotation", "voice"];

/**
 * Tải file lên (multipart: `file`, `purpose`). Trả { id } để gắn vào đề / bài nộp.
 * Route Handler thay vì Server Action: tải từng file một, có thể nhiều MB, và cần trả lỗi rõ cho thanh tiến độ.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, message: "Bạn cần đăng nhập lại." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const purpose = String(form?.get("purpose") ?? "") as UploadPurpose;
  if (!(file instanceof File) || !PURPOSES.includes(purpose)) {
    return NextResponse.json({ ok: false, message: "Chưa nhận được file." }, { status: 400 });
  }
  const problem = validateUpload(user, purpose, file);
  if (problem) return NextResponse.json({ ok: false, message: problem }, { status: 400 });

  try {
    const saved = await storeFile(user, purpose, file);
    return NextResponse.json({ ok: true, data: saved });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Kho lưu file đang bận. Thử lại sau ít phút giúp em nhé." },
      { status: 503 },
    );
  }
}
