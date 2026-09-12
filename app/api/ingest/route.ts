import path from "node:path";
import { pathToFileURL } from "node:url";
import { engineAvailable, engineUnavailable } from "@/lib/engine";
import { viewerForRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { saveSpec } from "@/lib/db/campaigns";

export const maxDuration = 300;

/**
 * Turn a pasted brief into a campaign spec.
 *
 * Platform owners only: this both spends model tokens and writes a campaign
 * that every clipper then generates against. The role is read from the
 * database (lib/auth), not from a shared secret.
 */
export async function POST(req: Request) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  if (!viewer.isPlatformOwner) return Response.json({ error: "platform owners only" }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "invalid JSON body" }, { status: 400 }); }

  const brief = String(body?.brief ?? "").trim();
  if (brief.length < 80) return Response.json({ error: "paste the full brief — that is too short to extract from" }, { status: 400 });

  const root = process.cwd();
  if (!engineAvailable()) return engineUnavailable();
  const url = pathToFileURL(path.join(root, "engine", "ingest.mjs")).href;
  const { ingestBrief }: any = await import(/* webpackIgnore: true */ url);

  try {
    const { spec, usd } = await ingestBrief({ root, brief });
    if (body?.save) {
      const sb = await createClient();
      await saveSpec(sb, spec);
    }
    return Response.json({ spec, usd: +usd.toFixed(4), saved: !!body?.save });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "extraction failed" }, { status: 502 });
  }
}
