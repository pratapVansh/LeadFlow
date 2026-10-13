import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const upstream = process.env.API_INTERNAL_URL;
    if (!upstream) throw new Error("API_INTERNAL_URL is required. Use the npm scripts or the Docker build argument.");
    return [{ source: "/api/:path*", destination: `${upstream}/api/:path*` }];
  },
};

export default nextConfig;
