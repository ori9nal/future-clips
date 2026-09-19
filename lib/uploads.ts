import "server-only";

/**
 * What a workspace may upload and put on its slides: a logo and an avatar.
 *
 * The file is checked by its bytes, not by what the browser called it — a
 * renamed script is not a PNG. Everything lives in the private `uploads`
 * bucket under `<org_id>/…`, which is the only prefix the workspace's own
 * policies let it write (migration 0020).
 */
export const KINDS = ["logo", "avatar"] as const;
export type Kind = (typeof KINDS)[number];

export const MAX_BYTES = 2 * 1024 * 1024;

const SIGNATURES: { ext: string; type: string; test: (b: Uint8Array) => boolean }[] = [
  { ext: "png", type: "image/png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { ext: "jpg", type: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: "webp", type: "image/webp",
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

export type Checked = { ok: true; ext: string; type: string; bytes: Uint8Array } | { ok: false; error: string };

/** A PNG, JPEG or WebP under the size limit, decided by the first bytes. */
export function checkImage(bytes: Uint8Array): Checked {
  if (!bytes.length) return { ok: false, error: "That file is empty." };
  if (bytes.length > MAX_BYTES) return { ok: false, error: `Keep it under ${MAX_BYTES / 1024 / 1024} MB; that one is ${(bytes.length / 1024 / 1024).toFixed(1)} MB.` };
  const hit = SIGNATURES.find((s) => s.test(bytes));
  if (!hit) return { ok: false, error: "Use a PNG, JPEG or WebP image." };
  return { ok: true, ext: hit.ext, type: hit.type, bytes };
}

export const isKind = (v: unknown): v is Kind => typeof v === "string" && (KINDS as readonly string[]).includes(v);

/** Where one workspace's file lives. The first folder is the tenant, which is what the storage policies read. */
export const uploadPath = (orgId: string, kind: Kind, ext: string, stamp = Date.now()) => `${orgId}/${kind}-${stamp}.${ext}`;

/** What the workspace has on file, cleaned of anything unexpected. */
export type OrgAssets = { logo_path?: string; avatar_path?: string; handle?: string };

export function readOrgAssets(raw: unknown): OrgAssets {
  const o = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : undefined);
  return { logo_path: str(o.logo_path, 300), avatar_path: str(o.avatar_path, 300), handle: str(o.handle, 40) };
}

/** A handle as it should be stored: no leading @, no spaces, the characters the platforms allow. */
export function cleanHandle(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const h = raw.trim().replace(/^@+/, "").replace(/\s+/g, "");
  if (!h) return undefined;
  return /^[A-Za-z0-9._]{1,40}$/.test(h) ? h : undefined;
}

/** What a set was told to use. Null when the workspace asked for nothing. */
export type Instructions = { logo_path?: string; avatar_path?: string; handle?: string; note?: string };

export function readInstructions(raw: unknown, assets: OrgAssets): Instructions | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const use = o.use_brand !== false; // the composer's default: use what the workspace uploaded
  const handle = cleanHandle(o.handle) ?? (use ? assets.handle : undefined);
  const note = typeof o.note === "string" && o.note.trim() ? o.note.trim().slice(0, 200) : undefined;
  const logo_path = use ? assets.logo_path : undefined;
  const avatar_path = use ? assets.avatar_path : undefined;
  const out: Instructions = { logo_path, avatar_path, handle, note };
  return Object.values(out).some(Boolean) ? out : null;
}

/**
 * Re-encode an upload so it carries pixels and nothing else.
 *
 * A logo or avatar arrives from someone's phone or laptop, and a phone photo
 * carries EXIF — which carries GPS. We promise customers that what leaves this
 * engine is pixels only, and until now that promise covered the rendered
 * slides (engine/clean.mjs) but not the file we stored on their behalf: the
 * original sat in the bucket with its camera, its timestamps and possibly the
 * coordinates of the room it was taken in.
 *
 * sharp drops every metadata block unless asked to keep it, so re-encoding is
 * the strip. PNG stays PNG (transparency matters for a logo); JPEG and WebP
 * become PNG for the same reason. Nothing is resized: a logo is drawn at the
 * size the style asks for.
 */
export async function stripUpload(bytes: Uint8Array): Promise<{ bytes: Uint8Array; type: string; ext: string }> {
  const sharp = (await import("sharp")).default;
  const { stripPng } = await import("@/engine/clean.mjs");
  const png = await sharp(Buffer.from(bytes)).png({ compressionLevel: 9 }).toBuffer();
  // sharp still writes pHYs (the DPI). It identifies nobody, but the engine's
  // gate calls any non-pixel chunk dirty and the promise we make is "pixels",
  // so the stored file goes through the same strip the slides do.
  const out = stripPng(png) as Buffer;
  return { bytes: new Uint8Array(out), type: "image/png", ext: "png" };
}
