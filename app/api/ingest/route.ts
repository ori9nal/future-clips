import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isAdminRequest } from "@/lib/admin";

export const maxDuration = 300;

/**
 * Turn a pasted brief into a campaign spec.
 *
 * Admin only: this both spends model tokens and writes a campaign that every
 * clipper then generates against, so it is not something a clipper triggers.
 */
export async function POST(req: Request) {
  if (!isAdminRequest(req)) {
    return Response.json({ error: "admin only" }, { status: 403 });
  }
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "invalid JSON body" }, { status: 400 }); }

  const brief = String(body?.brief ?? "").trim();
  if (brief.length < 80) return Response.json({ error: "paste the full brief — that is too short to extract from" }, { status: 400 });

  const root = process.cwd();
  const url = pathToFileURL(path.join(root, "engine", "ingest.mjs")).href;
  const { ingestBrief }: any = await import(/* webpackIgnore: true */ url);

  try {
    const { spec, usd } = await ingestBrief({ root, brief });
    if (body?.save) {
      const id = String(spec.id).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      spec.id = id;
      fs.mkdirSync(path.join(root, "campaigns"), { recursive: true });
      fs.writeFileSync(path.join(root, "campaigns", `${id}.json`), JSON.stringify(spec, null, 2));
      // keep the source brief next to the campaign; the extraction is lossy and
      // the original is the only way to check what it dropped
      fs.mkdirSync(path.join(root, "briefs"), { recursive: true });
      fs.writeFileSync(path.join(root, "briefs", `${id}.md`), brief);
    }
    return Response.json({ spec, usd: +usd.toFixed(4), saved: !!body?.save });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "extraction failed" }, { status: 502 });
  }
}
