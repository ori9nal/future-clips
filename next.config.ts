import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const supabaseOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin; } catch { return "https://*.supabase.co"; }
})();
// Content-Security-Policy: scripts and styles only from this host (Next's own
// inline runtime needs 'unsafe-inline'; dev needs eval and the HMR socket),
// images from here and Storage's signed URLs, no framing, no plugins.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin}${dev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

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
          { key: "Content-Security-Policy", value: csp },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
