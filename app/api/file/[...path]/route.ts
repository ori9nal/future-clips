import fs from "node:fs";
import path from "node:path";
import { viewerForRequest } from "@/lib/auth";
import { workDirs, devPreview } from "@/lib/engine";

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};

/**
 * Serve a file the engine wrote on THIS host: a studio render, a character
 * sheet, a locally rendered set. Paths are relative to the host's working base
 * (output/ on a laptop, /tmp/fc on Vercel, see lib/engine.ts workDirs) and are
 * resolved inside it, so a traversal like ../../.env.local cannot escape.
 *
 * Signed-in members only. The middleware also gates every /api route, so a
 * request without a session never reaches here; the one exception is the
 * dev-only design preview, which renders fixtures with no session and is off
 * in production. Customer slides on a host are served as Storage signed URLs
 * by /api/sets/[id], never through this route.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!devPreview()) {
    const viewer = await viewerForRequest();
    if (!viewer) return Response.json({ error: "sign in required", code: "AUTH" }, { status: 401 });
  }
  const { path: parts } = await ctx.params;
  const { base } = workDirs();
  const file = path.resolve(base, ...parts);
  if (!file.startsWith(base + path.sep)) return new Response("forbidden", { status: 403 });
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("not found", { status: 404 });
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return new Response("unsupported", { status: 415 });
  return new Response(new Uint8Array(fs.readFileSync(file)), {
    headers: { "content-type": type, "cache-control": "private, no-store" },
  });
}
