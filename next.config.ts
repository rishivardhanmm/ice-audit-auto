import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
