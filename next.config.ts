import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WSS_URL: process.env.NEXT_PUBLIC_WSS_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_AUTH_API_URL: process.env.NEXT_PUBLIC_AUTH_API_URL,
    NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
  },
};

export default nextConfig;
