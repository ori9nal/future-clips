import fs from "node:fs";
import path from "node:path";

const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
};

/**
 * Serve a rendered slide. Only from output/ — the path is resolved and then
 * checked against that root, so a traversal like ../../.env.local cannot escape.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  const root = path.join(process.cwd(), "output");
  const file = path.resolve(process.cwd(), ...parts);
  if (!file.startsWith(root + path.sep)) return new Response("forbidden", { status: 403 });
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("not found", { status: 404 });
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return new Response("unsupported", { status: 415 });
  return new Response(new Uint8Array(fs.readFileSync(file)), {
    headers: { "content-type": type, "cache-control": "no-store" },
  });
}
