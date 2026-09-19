import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const EXTS = ['.ts', '.tsx', '.mts', '.js', '.mjs'];

/** Resolve the app's own import styles under node --test: `server-only`, the `@/` alias, extensionless relatives. */
export async function resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
  let spec = specifier;
  if (spec.startsWith('@/')) spec = pathToFileURL(path.join(ROOT, spec.slice(2))).href;
  const isRel = spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('file:');
  if (isRel && !path.extname(spec)) {
    const base = spec.startsWith('file:') ? fileURLToPath(spec) : path.resolve(path.dirname(fileURLToPath(context.parentURL)), spec);
    for (const ext of EXTS) {
      if (fs.existsSync(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true };
    }
  }
  return next(spec, context);
}
