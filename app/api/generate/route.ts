import fs from "node:fs";
import path from "node:path";
import { getCampaign } from "@/lib/campaigns";

export const maxDuration = 300;

/**
 * Render a carousel on demand for the studio.
 *
 * The engine is ESM and pulls in sharp plus the matting worker, so it is
 * imported lazily — dragging it into every request that merely paints the
 * studio shell would cost seconds of cold start for nothing.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { campaignId, conceptIndex = 0, family } = body || {};
  if (!campaignId) return Response.json({ error: "campaignId is required" }, { status: 400 });

  const campaign = getCampaign(campaignId);
  if (!campaign) return Response.json({ error: `no campaign "${campaignId}"` }, { status: 404 });

  const conceptFile = path.join(process.cwd(), "concepts", `${campaignId}.json`);
  if (!fs.existsSync(conceptFile)) {
    return Response.json({ error: `no concepts for "${campaignId}"` }, { status: 404 });
  }
  const concepts = JSON.parse(fs.readFileSync(conceptFile, "utf8")).concepts;
  const concept = concepts[conceptIndex];
  if (!concept) return Response.json({ error: `no concept at index ${conceptIndex}` }, { status: 404 });

  const engine: any = await import(/* webpackIgnore: true */ "../../../engine/index.mjs" as any);
  const templates = engine.loadTemplates().filter((t: any) => !family || t.id === family);
  if (!templates.length) return Response.json({ error: `no template "${family}"` }, { status: 404 });

  const started = Date.now();
  try {
    const c = await engine.renderCarousel({
      accountId: "studio",
      campaign,
      concept,
      // Vary the seed per run so "generate again" produces a genuinely
      // different set rather than repainting the same one.
      postIndex: Math.floor(Date.now() / 1000) % 9973,
      outDir: path.join("output", "studio"),
      templates,
    });

    return Response.json({
      id: c.id,
      family: c.familyName,
      canvas: c.canvas,
      slides: c.slides.length,
      ms: Date.now() - started,
      valid: c.validation.ok,
      errors: c.validation.errors,
      credits: c.credits,
      // served by /api/render
      files: c.files.map((f: string) =>
        "/api/render/" + path.relative(path.join(process.cwd(), "output"), path.resolve(f)).replace(/\\/g, "/"),
      ),
      subjects: c.slideMeta.map((m: any) => ({
        slide: m.index + 1,
        id: m.subjectId,
        matched: m.subjectMatch?.matched ?? null,
        score: m.subjectMatch?.score ?? null,
        intent: m.subjectMatch?.intent ?? null,
      })),
    });
  } catch (e: any) {
    // Layout failures are the interesting ones — surface the engine's own
    // message rather than a generic 500, because it names the slot that could
    // not be satisfied.
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
