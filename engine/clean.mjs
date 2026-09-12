// The metadata gate: a slide leaves the engine carrying pixels and nothing else.
//
// Raw gpt-image-2 frames carry a `caBX` chunk — a JUMBF box holding a C2PA
// manifest ("Content Credentials": issuer, model, a signed hash of the
// pixels). resvg re-encodes the composite from a fresh pixel buffer, so the
// manifest never survives the render (verified on real files: rendered
// slides are IHDR + IDAT + IEND only). This module turns that observation
// into a guarantee: every PNG the engine ships is walked chunk by chunk and
// rejected if anything but the pixel chunks is present. A stripped C2PA
// manifest is not a modified one — there is nothing left to fail validation
// against; the file is simply an unsigned PNG, the same as a screenshot.
import fs from 'node:fs';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Chunks that carry pixels or the palette that decodes them. Nothing else ships. */
export const PIXEL_CHUNKS = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS']);

/** Chunks that carry provenance, identity or free text — the ones a clipper is trusting us to drop. */
export const METADATA_CHUNKS = {
  caBX: 'C2PA / JUMBF Content Credentials manifest',
  eXIf: 'EXIF block',
  iTXt: 'international text (XMP lives here)',
  tEXt: 'text',
  zTXt: 'compressed text',
  iCCP: 'ICC profile',
  tIME: 'last-modified timestamp',
  pHYs: 'physical pixel size',
  sRGB: 'sRGB rendering intent',
  gAMA: 'gamma',
  cHRM: 'chromaticity',
  bKGD: 'background colour',
  sBIT: 'significant bits',
  hIST: 'histogram',
  sPLT: 'suggested palette',
};

/** List the chunk types of a PNG, in order. Throws on a non-PNG or a truncated file. */
export function pngChunks(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  const types = [];
  let p = 8;
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    types.push(type);
    p += 12 + len;
    if (type === 'IEND') break;
  }
  if (types.at(-1) !== 'IEND') throw new Error('truncated PNG');
  return types;
}

/** { clean, chunks, offending: [{ chunk, what }] } for one file or buffer. */
export function inspectPng(fileOrBuf) {
  const buf = Buffer.isBuffer(fileOrBuf) ? fileOrBuf : fs.readFileSync(fileOrBuf);
  const chunks = pngChunks(buf);
  const offending = [...new Set(chunks.filter((c) => !PIXEL_CHUNKS.has(c)))]
    .map((chunk) => ({ chunk, what: METADATA_CHUNKS[chunk] ?? 'ancillary chunk' }));
  return { clean: offending.length === 0, chunks, offending, bytes: buf.length };
}

/**
 * Hard gate, called after every render: throw if a slide carries anything but
 * pixels. Throwing rather than stripping in place is deliberate — a slide
 * that arrives here dirty means a renderer changed underneath us and the
 * fix belongs there, not in a silent rewrite of the file.
 */
export function assertClean(files) {
  const dirty = [];
  for (const f of files) {
    const r = inspectPng(f);
    if (!r.clean) dirty.push(`${f}: ${r.offending.map((o) => `${o.chunk} (${o.what})`).join(', ')}`);
  }
  if (dirty.length) throw new Error(`metadata gate: slides carry non-pixel chunks —\n  ${dirty.join('\n  ')}`);
  return files.length;
}

/**
 * Rewrite a PNG keeping only the pixel chunks. Used for the raw provider
 * frames that go into the cache (they carry caBX), never for the rendered
 * slides — those must already be clean (see assertClean).
 */
export function stripPng(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  const parts = [SIG];
  let p = 8;
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('latin1', p + 4, p + 8);
    const end = p + 12 + len;
    if (PIXEL_CHUNKS.has(type)) parts.push(buf.subarray(p, end));
    p = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(parts);
}
