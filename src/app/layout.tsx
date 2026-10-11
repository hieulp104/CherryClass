import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";

import { MotionProvider } from "@/components/layout/motion-provider";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import { ToastProvider } from "@/components/ui/toast";
import { OG_IMAGE } from "@/lib/og";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "http://localhost:3005"),
  title: { default: "TeamCherry", template: "%s · TeamCherry" },
  description: "Quản lý lớp dạy thêm: điểm danh, học phí, thu chi — nhẹ nhàng như cherry.",
  applicationName: "TeamCherry",
  // App riêng của lớp: không trang nào nên lên Google (phiếu thu có mã riêng, cổng cần đăng nhập).
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "TeamCherry",
    locale: "vi_VN",
    title: "TeamCherry",
    description: "Lớp học của cô — điểm danh, học phí, bài tập.",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "TeamCherry", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF8F3" },
    { media: "(prefers-color-scheme: dark)", color: "#1A0B16" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Chạy TRƯỚC khi vẽ khung đầu tiên để không nháy theme (thẻ <script> thường — lý do xem
 * src/app/layout.tsx của QLNS). Theme lưu ở localStorage "tc-theme": light | dark | (không có = theo máy).
 * `__tcThemeColor` bật đúng thẻ meta theme-color khi cô chọn tay Sáng/Tối, để thanh trình duyệt cùng màu nền.
 */
const themeBootstrap = `try{var t=localStorage.getItem("tc-theme");if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;document.addEventListener("DOMContentLoaded",function(){window.__tcThemeColor&&window.__tcThemeColor(t)})}}catch(e){}
window.__tcThemeColor=function(m){document.querySelectorAll('meta[name="theme-color"]').forEach(function(el){if(!el.dataset.media)el.dataset.media=el.getAttribute("media")||"";if(m==="light"||m==="dark"){el.setAttribute("media",el.dataset.media.indexOf(m)>-1?"all":"not all")}else if(el.dataset.media){el.setAttribute("media",el.dataset.media)}})}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${beVietnam.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full font-sans">
        <MotionProvider>
          <ToastProvider>{children}</ToastProvider>
        </MotionProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
