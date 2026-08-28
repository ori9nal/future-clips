import fs from "node:fs";
import path from "node:path";

/**
 * Serve cutouts from assets/library for the admin UI.
 *
 * They deliberately do not live under public/: the library is engine input that
 * the render worker reads from disk, and copying it into public/ would mean two
 * copies drifting apart. This route is admin-facing and read-only.
 */
const ROOT = path.join(process.cwd(), "assets", "library");

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: parts } = await params;
  const rel = parts.join("/");

  // Contain the read inside ROOT: `parts` comes from the URL, so a traversal
  // segment would otherwise read any file the server process can reach.
  const abs = path.resolve(ROOT, rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    return new Response("forbidden", { status: 403 });
  }

  const ext = path.extname(abs).toLowerCase();
  const type = TYPES[ext];
  if (!type) return new Response("unsupported", { status: 415 });
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return new Response("not found", { status: 404 });
  }

  return new Response(new Uint8Array(fs.readFileSync(abs)), {
    headers: { "content-type": type, "cache-control": "private, max-age=60" },
  });
}
