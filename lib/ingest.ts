/**
 * Ingest an agency-supplied visual into a niche cutout library.
 *
 * Same path as stock: matte -> clean -> gate -> B&W variant -> manifest entry.
 * An upload that fails the gates is rejected with the measured reason rather
 * than quietly added, because a haloed or silhouetted cutout is the most
 * visible defect in the finished carousel.
 *
 * Credit is recorded as client-supplied, which is what makes it safe to use
 * under a campaign that bans third-party imagery.
 */
import fs from "node:fs";
import path from "node:path";

export type IngestResult = { ok: boolean; id?: string; reason?: string; stats?: any };

export async function ingestUpload(
  bytes: Buffer,
  opts: { niche: string; kind?: string; label?: string },
): Promise<IngestResult> {
  const kind = opts.kind || "people";
  // Loaded lazily: the engine is ESM and pulls in sharp + the ONNX worker, which
  // must not be dragged into every request that merely renders the admin page.
  const { cutout, cleanMatte, toBW, subjectTone, judgeCutout } = await import(
    /* webpackIgnore: true */ "../engine/source/cutout.mjs" as any
  );

  let r: any;
  try {
    r = await cutout(bytes);
  } catch (e: any) {
    return { ok: false, reason: `matte failed — ${e?.message || e}` };
  }
  if (!r.verdict.pass) return { ok: false, reason: r.verdict.fail.join("; ") };

  const cleaned = (await cleanMatte(r.buf)).buf;
  const tone = await subjectTone(cleaned);
  const verdict = judgeCutout({ ...r.stats, ...tone });
  if (!verdict.pass) return { ok: false, reason: verdict.fail.join("; "), stats: { ...r.stats, ...tone } };

  const sharp = (await import("sharp")).default;
  const meta = await sharp(cleaned).metadata();

  const dir = path.join(process.cwd(), "assets/library", opts.niche, kind);
  fs.mkdirSync(dir, { recursive: true });
  const id = `upload-${r.key.slice(-12)}`;
  const file = path.join(dir, `${id}.png`);
  const bwFile = path.join(dir, `${id}-bw.png`);
  fs.writeFileSync(file, cleaned);
  fs.writeFileSync(bwFile, await toBW(cleaned));

  const manifestPath = path.join(process.cwd(), "assets/library", opts.niche, `${kind}.json`);
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : { niche: opts.niche, kind, items: [] };

  if (!manifest.items.some((i: any) => i.id === id)) {
    manifest.items.push({
      id,
      provider: "client",
      query: opts.label || "client upload",
      file: path.relative(process.cwd(), file).replace(/\\/g, "/"),
      bwFile: path.relative(process.cwd(), bwFile).replace(/\\/g, "/"),
      w: meta.width,
      h: meta.height,
      aspect: meta.width && meta.height ? +(meta.width / meta.height).toFixed(3) : null,
      coverage: r.stats.coverage,
      fill: r.stats.fill,
      halo: r.stats.halo,
      ...tone,
      // Client-supplied assets are the only ones usable under zero_gen_mode and
      // under campaigns that forbid third-party imagery.
      credit: { provider: "client", license: "client-supplied", author: null },
    });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  return { ok: true, id, stats: { ...r.stats, ...tone } };
}
