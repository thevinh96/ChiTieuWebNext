import type { NextConfig } from "next";

const defaultApiUrl = process.env.VERCEL
  ? "https://chi-tieu-web-next.vercel.app"
  : "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl = (process.env.API_URL ?? defaultApiUrl).replace(/\/+$/, "");
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
