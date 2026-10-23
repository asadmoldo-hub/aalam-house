import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Загрузка PDF/TXT в базу знаний (лимит файла 4 МБ, Vercel принимает до 4,5 МБ)
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
