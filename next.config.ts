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
    // The engine's .mjs files are copied as ASSETS, not traced as modules, so
    // nothing follows their own imports. `serverExternalPackages` does not
    // help: it only governs packages the bundler already knows about. Without
    // naming them here the function ships the engine and none of the native
    // code it calls — which is exactly what happened: every production render
    // died on "Cannot find package '@resvg/resvg-js'" (2026-09-19).
    "/api/**": [
      "./engine/**", "./assets/fonts/**", "./assets/campaigns/**",
      "./node_modules/@resvg/**", "./node_modules/opentype.js/**",
      "./node_modules/sharp/**", "./node_modules/@img/**",
    ],
    // the demo workspace's zip is built from the shipped slides
    "/api/sets/[id]/download": ["./public/demo/**"],
  },
  serverExternalPackages: ["sharp", "@resvg/resvg-js", "opentype.js"],
  // /signup on the app host is the door (the static site links to it; vercel.json does the same on the site host)
  async redirects() {
    return [{ source: "/signup", destination: "/login", permanent: false }];
  },
  // The local stack (RUNBOOK "The local stack"): with FC_SITE_PROXY set in
  // development, the marketing site served next door appears at / on this
  // origin, so home → login → product is one localhost. Never in production.
  async rewrites() {
    const proxy = process.env.NODE_ENV !== "production" ? process.env.FC_SITE_PROXY?.replace(/\/$/, "") : undefined;
    if (!proxy) return [];
    return {
      beforeFiles: [
        // the root, unless Supabase's Site-URL fallback brought a ?code (app/page.tsx forwards it)
        { source: "/", destination: `${proxy}/`, missing: [{ type: "query", key: "code" }, { type: "query", key: "error" }, { type: "query", key: "error_description" }] },
        { source: "/carousels/:path*", destination: `${proxy}/carousels/:path*` },
        { source: "/fonts/:path*", destination: `${proxy}/fonts/:path*` },
        { source: "/logo.png", destination: `${proxy}/logo.png` },
        { source: "/og.png", destination: `${proxy}/og.png` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
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
