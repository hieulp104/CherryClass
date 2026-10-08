import Link from "next/link";

import { Mascot } from "@/components/brand/mascot";

export default function NotFound() {
  return (
    <main className="bg-soft flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Mascot mood="thinking" size={140} />
      <h1 className="mt-4 text-h1 font-extrabold">Em không tìm thấy trang này</h1>
      <p className="mt-2 max-w-sm text-muted">Có thể đường link đã cũ, hoặc dữ liệu đã được xóa.</p>
      <Link href="/hom-nay" className="mt-6 rounded-control bg-primary px-5 py-3 font-semibold text-on-primary shadow-fab">
        Về trang Hôm nay
      </Link>
    </main>
  );
}
