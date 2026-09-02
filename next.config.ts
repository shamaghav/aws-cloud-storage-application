import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "https://aws-cloud-storage-backend.onrender.com/api/:path*",
      },
    ];
  },
};

export default nextConfig;