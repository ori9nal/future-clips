import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { getSpec } from "@/lib/specs";

export const maxDuration = 300;

/**
 * Render a set for the studio.
 *
 * The engine is ESM and pulls in sharp, so it is imported lazily by absolute
 * file URL — a relative specifier would resolve against .next/server, and
 * dragging sharp into every request that merely paints the shell would cost
 * seconds of cold start for nothing.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { campaignId, style = "native" } = body || {};
  if (!campaignId) return Response.json({ error: "campaignId is required" }, { status: 400 });

  const spec = getSpec(campaignId);
  if (!spec) return Response.json({ error: `no campaign "${campaignId}"` }, { status: 404 });
  if (style === "mascot" && !spec.assets.mascot) {
    return Response.json({ error: "this campaign has no mascot asset" }, { status: 400 });
  }

  const root = process.cwd();
  const registryUrl = pathToFileURL(path.join(root, "engine", "styles", "registry.mjs")).href;
  const nativeUrl = pathToFileURL(path.join(root, "engine", "render-native.mjs")).href;
  const judgeUrl = pathToFileURL(path.join(root, "engine", "judge.mjs")).href;
  const registry: any = await import(/* webpackIgnore: true */ registryUrl);
  const engine: any = await import(/* webpackIgnore: true */ nativeUrl);
  const { logicCheck }: any = await import(/* webpackIgnore: true */ judgeUrl);

  const rel = path.join("output", "sets", `${campaignId}-${style}`);
  const outDir = path.join(root, rel);

  const started = Date.now();
  try {
    const logic = logicCheck(engine.copyOf(spec));
    const { files, canvas } = await registry.render({ spec, root, styleId: style, outDir });
    return Response.json({
      style,
      canvas,
      ms: Date.now() - started,
      logic,
      slides: files.map((f: string) => `/api/file/${path.relative(root, f).split(path.sep).join("/")}`),
    });
  } catch (e: any) {
    // Render failures here are almost always copy that will not fit. Say which
    // line, because "render failed" tells the operator nothing actionable.
    return Response.json({ error: e?.message ?? "render failed" }, { status: 422 });
  } finally {
    if (fs.existsSync(outDir)) {
      /* plates are cached under _plates and reused across renders */
    }
  }
}
