import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Đóng gói standalone cho Docker, giống QLNS.
  output: "standalone",
  // exceljs kéo theo nhiều module Node — để nguyên ở server, không bundle.
  serverExternalPackages: ["exceljs"],
  experimental: {
    // File Excel nhập học sinh tối đa 5MB (imports.actions.ts) + phần đầu multipart.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
