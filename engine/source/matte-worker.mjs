// Matting runs in its OWN process, deliberately.
//
// @imgly/background-removal-node loads the ONNX runtime, which on Windows
// segfaults libvips if sharp is loaded in the same process (GLib type-system
// clobber — reproducible with nothing more than `import sharp` before the
// matte). This worker therefore imports ONLY the matting stack. Everything that
// touches pixels afterwards happens in the parent, where sharp is safe.
//
// Usage: node engine/source/matte-worker.mjs <input> <output.png>
import fs from 'node:fs';
import { removeBackground } from '@imgly/background-removal-node';

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: matte-worker.mjs <input> <output.png>');
  process.exit(2);
}

try {
  const bytes = fs.readFileSync(input);
  const ext = String(input).toLowerCase().split('.').pop();
  const blob = new Blob([bytes], { type: MIME[ext] || 'image/jpeg' });
  const out = await removeBackground(blob, { output: { format: 'image/png' } });
  fs.writeFileSync(output, Buffer.from(await out.arrayBuffer()));
  process.exit(0);
} catch (e) {
  console.error(String(e?.stack || e));
  process.exit(1);
}
