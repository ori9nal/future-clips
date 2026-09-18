import path from "node:path";
import { pathToFileURL } from "node:url";
import { engineAvailable, engineUnavailable, workDirs } from "@/lib/engine";
import { viewerForRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpec } from "@/lib/db/campaigns";

export const maxDuration = 300;

/**
 * Generate a character sheet for a campaign and cut it into poses.
 *
 * Image generation is the only step here that spends real money, so it is a
 * deliberate, separate action rather than something a render triggers: a set
 * re-renders for a fraction of a cent, and the character is bought once and
 * reused by every set that campaign ever produces.
 */
export async function POST(req: Request) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  if (!viewer.isPlatformOwner) return Response.json({ error: "platform owners only" }, { status: 403 });
  let body: any;
  try { body = await req.json(); } catch { return Response.json({ error: "invalid JSON body" }, { status: 400 }); }

  const { campaignId, quality = "medium", variants = 3 } = body || {};
  if (!campaignId) return Response.json({ error: "campaignId is required" }, { status: 400 });
  const spec = await getSpec(await createClient(), campaignId);
  if (!spec) return Response.json({ error: `no campaign "${campaignId}"` }, { status: 404 });

  const dir = (spec as any).assets?.character?.dir;
  if (!dir) return Response.json({ error: "campaign declares no assets.character.dir" }, { status: 400 });

  const root = process.cwd();
  if (!engineAvailable()) return engineUnavailable();
  const url = pathToFileURL(path.join(root, "engine", "providers", "image.mjs")).href;
  const img: any = await import(/* webpackIgnore: true */ url);

  const prompt = (spec as any).assets?.character?.prompt;
  if (!prompt) return Response.json({ error: "campaign declares no assets.character.prompt" }, { status: 400 });

  const { base, cacheDir } = workDirs();
  const started = Date.now();
  try {
    const sheets: string[] = [];
    for (let i = 0; i < Math.min(Number(variants) || 1, 5); i++) {
      const r = await img.generate({
        root, cacheDir, prompt, size: "1536x1024", quality, label: `sheet-${campaignId}`, variant: i,
      });
      sheets.push(r.file);
    }
    return Response.json({
      sheets: sheets.map((f) => `/api/file/${path.relative(base, f).split(path.sep).join("/")}`),
      cost: img.costReport(),
      ms: Date.now() - started,
      next: "cut the chosen sheet with tools/cut-character.mjs, then render",
    });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "generation failed" }, { status: 502 });
  }
}
