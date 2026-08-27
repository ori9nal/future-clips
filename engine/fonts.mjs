// Font registry. Physical TTFs are registered with satori under unique names so
// face selection is exact — no weight-matching fallback, no silent substitution.
import fs from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';

const DIR = path.resolve('assets/fonts');

// logical role -> { "<weight><style>" : physical file basename }
// Templates address faces by ROLE + weight + style; the engine resolves to a file.
export const ROLES = {
  'display-editorial': {
    '400normal': 'PlayfairDisplay-Regular',
    '500normal': 'PlayfairDisplay-Medium',
    '700normal': 'PlayfairDisplay-Bold',
    '900normal': 'PlayfairDisplay-Black',
    '400italic': 'PlayfairDisplay-Italic',
    '700italic': 'PlayfairDisplay-BoldItalic',
    '900italic': 'PlayfairDisplay-BlackItalic',
  },
  'display-heavy': {
    '400normal': 'Anton-Regular',
    '900normal': 'Anton-Regular',
    '800normal': 'ArchivoCondensed-ExtraBold',
  },
  'display-block': {
    '400normal': 'ArchivoBlack-Regular',
    '900normal': 'ArchivoBlack-Regular',
  },
  'display-sport': {
    '800normal': 'ArchivoExpanded-ExtraBold',
    '800italic': 'ArchivoExpanded-ExtraBoldItalic',
    '700italic': 'ArchivoExpanded-BoldItalic',
  },
  body: {
    '400normal': 'Archivo-Regular',
    '500normal': 'Archivo-Medium',
    '600normal': 'Archivo-SemiBold',
    '700normal': 'Archivo-Bold',
    '800normal': 'Archivo-ExtraBold',
    '400italic': 'Archivo-Italic',
    '700italic': 'Archivo-BoldItalic',
  },
  mono: {
    '400normal': 'JetBrainsMono-Regular',
    '500normal': 'JetBrainsMono-Medium',
    '700normal': 'JetBrainsMono-Bold',
  },
};

const cache = new Map();

/** Load a physical face: buffer + parsed opentype font + cached advance widths. */
export function loadFace(basename) {
  if (cache.has(basename)) return cache.get(basename);
  const file = path.join(DIR, `${basename}.ttf`);
  if (!fs.existsSync(file)) throw new Error(`font missing: ${file} — run "node tools/fetch-fonts.mjs"`);
  const buffer = fs.readFileSync(file);
  const ot = opentype.parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
  const os2 = ot.tables.os2 || {};
  const face = {
    id: basename,
    satoriName: `f_${basename}`,
    buffer,
    ot,
    upm: ot.unitsPerEm,
    ascender: ot.ascender,
    descender: ot.descender,          // negative
    capHeight: os2.sCapHeight || Math.round(ot.unitsPerEm * 0.7),
    xHeight: os2.sxHeight || Math.round(ot.unitsPerEm * 0.5),
    // hmtx advance widths, cached per codepoint, in font units
    adv: new Map(),
    glyphOf: new Map(),
  };
  cache.set(basename, face);
  return face;
}

/** Resolve ROLE + weight + style -> physical face, with a documented nearest-weight fallback. */
export function resolveFace(role, weight = 400, style = 'normal') {
  const table = ROLES[role];
  if (!table) throw new Error(`unknown font role "${role}" (have: ${Object.keys(ROLES).join(', ')})`);
  const exact = table[`${weight}${style}`];
  if (exact) return loadFace(exact);
  // nearest weight within the same style
  const sameStyle = Object.keys(table).filter((k) => k.endsWith(style));
  if (sameStyle.length) {
    const best = sameStyle
      .map((k) => ({ k, d: Math.abs(parseInt(k, 10) - weight) }))
      .sort((a, b) => a.d - b.d)[0].k;
    return loadFace(table[best]);
  }
  // last resort: any face in the role
  return loadFace(Object.values(table)[0]);
}

/** All faces a render needs, in satori's font-descriptor shape. */
export function satoriFonts(faces) {
  const seen = new Map();
  for (const f of faces) if (!seen.has(f.id)) seen.set(f.id, f);
  return [...seen.values()].map((f) => ({
    name: f.satoriName,
    data: f.buffer,
    weight: 400,
    style: 'normal',
  }));
}

/** Every face in the registry — used by the furniture/type renderers that mix roles. */
export function allFaces() {
  const out = [];
  for (const table of Object.values(ROLES)) {
    for (const base of new Set(Object.values(table))) out.push(loadFace(base));
  }
  return out;
}
