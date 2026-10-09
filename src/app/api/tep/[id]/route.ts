import { Readable } from "node:stream";

import { getCurrentUser } from "@/modules/auth/auth.service";
import { canReadFile } from "@/modules/files/files.service";
import { getObjectStream } from "@/lib/minio";
import { prisma } from "@/shared/prisma/prisma.service";

/** Đọc file — luôn kiểm quyền (học sinh chỉ xem đề được giao và bài của mình). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Bạn cần đăng nhập", { status: 401 });
  const { id } = await params;
  if (!(await canReadFile(user, id))) return new Response("Không tìm thấy file", { status: 404 });

  const file = await prisma.fileAsset.findUnique({ where: { id } });
  if (!file) return new Response("Không tìm thấy file", { status: 404 });

  try {
    const stream = await getObjectStream(file.objectKey);
    const download = new URL(request.url).searchParams.has("tai");
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.size),
        // File không bao giờ đổi nội dung (key có uuid) → cache riêng tư dài.
        "Cache-Control": "private, max-age=86400, immutable",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      },
    });
  } catch {
    return new Response("Kho lưu file đang bận", { status: 503 });
  }
}
