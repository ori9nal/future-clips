// The creator's own mark: the handle they post under, and the avatar or logo
// they uploaded (app/api/assets, migration 0020). The campaign's brief names
// the brand a set must mention; this names the person posting it, and the two
// are different things — a clipper posting for APEX still signs the post with
// their own handle.
//
// A style asks for `handle(spec)` where it used to read
// `spec.requirements.required_mention`, and may draw `mark(spec, …)` for the
// avatar. Both are no-ops when the workspace uploaded nothing, so a style that
// calls them looks exactly as it does today for a workspace with no brand.
import fs from 'node:fs';
import path from 'node:path';

const EXT = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.webp': 'webp' };

/** What this set was told to use, or an empty object. */
export const creator = (spec) => spec?.assets?.creator ?? {};

/**
 * The handle to print, with the @: the creator's own when they gave one,
 * otherwise the campaign's required mention (which some briefs leave null).
 */
export function handle(spec) {
  const own = creator(spec).handle;
  const required = spec?.requirements?.required_mention;
  const h = own ?? required;
  if (!h) return null;
  return `@${String(h).replace(/^@+/, '')}`;
}

/** The handle without its @, for a style that adds its own. */
export function handleBare(spec) {
  const h = handle(spec);
  return h ? h.slice(1) : null;
}

/** The file to draw: the avatar if there is one, else the logo, else nothing. */
export function markFile(spec) {
  const c = creator(spec);
  for (const f of [c.avatar, c.logo]) {
    if (f && fs.existsSync(f)) return f;
  }
  return null;
}

/**
 * The avatar as a circle of `size` at (x, y), or '' when there is none.
 * Drawn as a data URI so the renderer stays a pure SVG string builder.
 */
export function mark(spec, x, y, size, { round = true, opacity = 1 } = {}) {
  const file = markFile(spec);
  if (!file) return '';
  const type = EXT[path.extname(file).toLowerCase()] ?? 'png';
  const href = `data:image/${type};base64,${fs.readFileSync(file).toString('base64')}`;
  const id = `fcmark${Math.round(x)}x${Math.round(y)}`;
  const clip = round
    ? `<clipPath id="${id}"><circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}"/></clipPath>`
    : `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${Math.round(size * 0.18)}"/></clipPath>`;
  return `<defs>${clip}</defs><image href="${href}" x="${x}" y="${y}" width="${size}" height="${size}" ` +
    `preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})" opacity="${opacity}"/>`;
}

/** True when this set carries anything the creator uploaded. */
export const hasMark = (spec) => !!markFile(spec);

/** The creator's OWN handle with the @, ignoring the campaign's required mention. */
export function ownHandle(spec) {
  const own = creator(spec).handle;
  return own ? `@${String(own).replace(/^@+/, '')}` : null;
}

/**
 * The sign-off every style draws on the last slide: the creator's avatar (or
 * logo) and their handle, bottom left, over the picture. Empty unless the
 * workspace actually uploaded something — a campaign that predates uploads
 * renders byte for byte as it did before.
 *
 * It lives here, and is applied once in styles/registry.mjs, so all ten
 * styles sign a deck the same way instead of each growing its own corner.
 */
export function signOff(spec, w, h) {
  const has = hasMark(spec);
  const name = ownHandle(spec);
  if (!has && !name) return '';
  // proportional to the canvas: the styles run 1080x1350, 1080x1440 and 1080x1920
  const size = Math.round(w * 0.078);
  const pad = Math.round(w * 0.05);
  const x = pad, y = h - size - pad;
  const parts = [];
  if (has) parts.push(mark(spec, x, y, size));
  if (name) {
    const tx = has ? x + size + Math.round(size * 0.24) : x;
    const ty = y + size / 2 + Math.round(size * 0.12);
    const fs2 = Math.round(size * 0.36);
    // a soft shadow so the handle holds over a bright photo, no scrim
    parts.push(
      `<text x="${tx}" y="${ty}" font-family="Archivo" font-weight="600" font-size="${fs2}" fill="#FFFFFF" ` +
      `stroke="#000000" stroke-width="${(fs2 * 0.1).toFixed(2)}" stroke-opacity="0.35" paint-order="stroke" ` +
      `opacity="0.95">${String(name).replace(/[<&>]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '>': '&gt;' }[c]))}</text>`
    );
  }
  return parts.join('');
}
