import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The engine is ESM imported by file URL at runtime, so the bundler never
  // sees it; without this Vercel's function bundle would not carry it.
  outputFileTracingIncludes: {
    "/api/**": ["./engine/**", "./assets/fonts/**", "./assets/campaigns/**"],
  },
  serverExternalPackages: ["sharp", "@resvg/resvg-js", "opentype.js"],
};

export default nextConfig;
