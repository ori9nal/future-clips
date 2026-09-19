import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { inspectPng, stripPng } from "../engine/clean.mjs";

/**
 * A logo or avatar arrives from someone's phone, and a phone photo carries
 * EXIF — which carries GPS. What we store on a customer's behalf has to be
 * pixels, like everything else that leaves this engine.
 */
test("an upload loses its EXIF, GPS and profiles when it is stored", async () => {
  const dirty = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#D8FF47" } })
    .withExifMerge({ IFD0: { Copyright: "Someone", Software: "A Phone" }, GPS: { GPSLatitudeRef: "N" } })
    .jpeg().toBuffer();
  assert.ok((await sharp(dirty).metadata()).exif, "the fixture must actually carry EXIF");

  // exactly what app/api/assets/route.ts stores (lib/uploads.ts stripUpload)
  const clean = stripPng(await sharp(dirty).png({ compressionLevel: 9 }).toBuffer());
  const m = await sharp(clean).metadata();
  assert.equal(m.format, "png");
  assert.ok(!m.exif, "EXIF, and the GPS inside it, must be gone");
  assert.ok(!m.xmp, "XMP must be gone");
  assert.ok(!m.iptc, "IPTC must be gone");

  // and the engine's own gate agrees: pixel chunks only
  const r = inspectPng(clean);
  assert.ok(r.clean, `stored upload carries ${JSON.stringify(r.offending)}`);
});
