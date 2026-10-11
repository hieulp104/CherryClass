import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TeamCherry — Lớp học của cô",
    short_name: "TeamCherry",
    description: "Điểm danh, học phí, thu chi cho lớp dạy thêm",
    // "/" tự chuyển tới trang chủ theo vai trò — học sinh / phụ huynh cài app cũng mở đúng chỗ.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFF8F3",
    theme_color: "#E11D48",
    lang: "vi",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Điểm danh", url: "/diem-danh", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Thu tiền", url: "/thu-tien", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
