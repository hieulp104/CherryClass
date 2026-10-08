import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";

import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "TeamCherry", template: "%s · TeamCherry" },
  description: "Quản lý lớp dạy thêm: điểm danh, học phí, thu chi — nhẹ nhàng như cherry.",
  applicationName: "TeamCherry",
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
 */
const themeBootstrap = `try{var t=localStorage.getItem("tc-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${beVietnam.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-full font-sans">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
