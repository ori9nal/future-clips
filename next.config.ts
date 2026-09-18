import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // FC_HIDE_DEV_BADGE=1 hides the dev-mode indicator for screenshots taken from `next dev`
  ...(process.env.FC_HIDE_DEV_BADGE === "1" ? { devIndicators: false as const } : {}),
  reactStrictMode: true,
  poweredByHeader: false,
  // The engine is ESM imported by file URL at runtime, so the bundler never
  // sees it; without this Vercel's function bundle would not carry it.
  outputFileTracingIncludes: {
    "/api/**": ["./engine/**", "./assets/fonts/**", "./assets/campaigns/**"],
  },
  serverExternalPackages: ["sharp", "@resvg/resvg-js", "opentype.js"],
  // the same response headers the static site sends (future-clips-site/vercel.json);
  // HSTS is set by Vercel on *.vercel.app and custom domains, repeated here for other hosts
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
