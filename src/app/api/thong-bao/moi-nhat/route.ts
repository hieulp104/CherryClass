import { getCurrentUser } from "@/modules/auth/auth.service";
import { latestNotification } from "@/modules/notifications/notifications.service";

/** App đang mở hỏi định kỳ "có thông báo mới không" — chỉ thông báo của chính người đang đăng nhập. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Chưa đăng nhập" }, { status: 401 });
  return Response.json({ latest: await latestNotification(user.id) });
}
