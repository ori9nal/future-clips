import fs from "node:fs";
import path from "node:path";

/** Serve rendered slides from output/ to the studio. Read-only, contained. */
const ROOT = path.join(process.cwd(), "output");
const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  const abs = path.resolve(ROOT, parts.join("/"));

  // `parts` comes from the URL, so a traversal segment would otherwise read
  // anything the server process can reach.
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    return new Response("forbidden", { status: 403 });
  }
  const type = TYPES[path.extname(abs).toLowerCase()];
  if (!type) return new Response("unsupported", { status: 415 });
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return new Response("not found", { status: 404 });
  }
  return new Response(new Uint8Array(fs.readFileSync(abs)), {
    headers: { "content-type": type, "cache-control": "no-store" },
  });
}
