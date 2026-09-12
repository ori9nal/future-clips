import path from "node:path";
import { pathToFileURL } from "node:url";
import { engineAvailable, engineUnavailable } from "@/lib/engine";

/**
 * Styles that suit a niche, ranked.
 *
 * The registry pulls in sharp and resvg, so it is imported lazily by absolute
 * file URL rather than at module scope — the studio shell should not pay for
 * the render stack just to paint a dropdown.
 */
export async function GET(req: Request) {
  const niche = new URL(req.url).searchParams.get("niche") ?? "";
  if (!engineAvailable()) return engineUnavailable();
  const url = pathToFileURL(path.join(process.cwd(), "engine", "styles", "registry.mjs")).href;
  const reg: any = await import(/* webpackIgnore: true */ url);
  return Response.json({ niche, styles: reg.stylesFor(niche) });
}
