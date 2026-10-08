import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Đóng gói standalone cho Docker, giống QLNS.
  output: "standalone",
  // exceljs kéo theo nhiều module Node — để nguyên ở server, không bundle.
  serverExternalPackages: ["exceljs"],
};

export default nextConfig;
