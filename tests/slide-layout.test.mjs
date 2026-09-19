// The words on a slide are elements, not pixels: they can be found, moved and
// rewritten, and the picture under them survives the round trip (0027).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRuns, readBlocks, applyEdits, splitArt, joinArt, artMissing, textOf } from '../engine/layout.mjs';
import { cleanEdits, textAfter } from '../lib/slideEdit.ts';

const ROOT = process.cwd();

/** A slide body shaped like the ones the styles emit. */
const run = (x, y, size, s, { anchor = 'middle', extra = '' } = {}) =>
  `<text x="${x}" y="${y}" font-family="Archivo" font-weight="700" font-size="${size}" fill="#FFFFFF" text-anchor="${anchor}"${extra}>${s}</text>`;

const HOOK = run(540, 500, 78, '3 things that changed') + run(540, 600, 78, 'my training this year');
const SUB = run(540, 720, 40, 'save this for monday');
const BODY = `<rect x="0" y="0" width="1080" height="1440" fill="#000"/>${HOOK}${SUB}`;

test('runs are read back with their position, size and words', () => {
  const runs = readRuns(BODY);
  assert.equal(runs.length, 3);
  assert.deepEqual(runs.map((r) => r.text), ['3 things that changed', 'my training this year', 'save this for monday']);
  assert.equal(runs[0].size, 78);
  assert.equal(runs[0].anchor, 'middle');
  assert.equal(runs[2].y, 720);
});

test('lines a line apart at one size are one block; a different size is another', () => {
  const blocks = readBlocks(BODY, { root: ROOT });
  assert.equal(blocks.length, 2, 'the hook and the sub are separate blocks');
  assert.deepEqual(blocks[0].lines, ['3 things that changed', 'my training this year']);
  assert.deepEqual(blocks[1].lines, ['save this for monday']);
  assert.deepEqual(blocks.map((b) => b.id), ['b0', 'b1']);
  // the box is in canvas pixels and sits around the type
  assert.ok(blocks[0].box.w > 100 && blocks[0].box.w < 1080, `width ${blocks[0].box.w}`);
  assert.ok(blocks[0].box.y < 500 && blocks[0].box.y > 380, `top ${blocks[0].box.y}`);
});

test('rewriting a block keeps every other block byte for byte', () => {
  const out = applyEdits(BODY, { b0: { lines: ['something else entirely'] } }, { root: ROOT, canvasW: 1080 });
  assert.ok(out.includes('save this for monday'), 'the sub is untouched');
  assert.ok(!out.includes('3 things that changed'), 'the old words are gone');
  const blocks = readBlocks(out, { root: ROOT });
  assert.equal(blocks.length, 2, 'the block count is stable, so the ids are too');
  // the words are wrapped to the block's column, so they arrive as lines
  assert.equal(blocks[0].lines.join(' '), 'something else entirely');
  assert.deepEqual(blocks[1].lines, ['save this for monday']);
});

test('a moved block is translated, and only that block', () => {
  const out = applyEdits(BODY, { b1: { dx: 0, dy: 120 } }, { root: ROOT, canvasW: 1080 });
  assert.match(out, /<g transform="translate\(0,120\)">/);
  assert.ok(out.indexOf('<g transform') > out.indexOf('my training this year'), 'the hook is not inside the group');
});

test('a block on a pill carries the pill with it', () => {
  const pill = '<rect x="300" y="470" width="480" height="90" rx="45" fill="#FFFFFF"/>';
  const body = `${pill}${run(540, 530, 60, '1. Full body')}`;
  const out = applyEdits(body, { b0: { dy: 200 } }, { root: ROOT, canvasW: 1080 });
  const group = out.match(/<g transform="translate\(0,200\)">([\s\S]*?)<\/g>/);
  assert.ok(group, 'the block was moved');
  assert.ok(group[1].includes('<rect'), 'the pill moved with the text');
  assert.ok(group[1].includes('1. Full body'));
});

test('a rect that is not behind the text is left where it is', () => {
  const far = '<rect x="0" y="0" width="40" height="40" fill="#FFF"/>';
  const out = applyEdits(`${far}${run(540, 530, 60, 'a label')}`, { b0: { dy: 60 } }, { root: ROOT, canvasW: 1080 });
  const group = out.match(/<g transform="translate\(0,60\)">([\s\S]*?)<\/g>/);
  assert.ok(group && !group[1].includes('<rect'), 'an unrelated shape stays put');
});

test('longer words wrap and the type shrinks rather than running off the slide', () => {
  const long = 'a much longer line than the one that was there before, which has to be broken up somehow';
  const out = applyEdits(BODY, { b0: { lines: [long] } }, { root: ROOT, canvasW: 1080 });
  const blocks = readBlocks(out, { root: ROOT });
  assert.ok(blocks[0].lines.length > 1, 'it wrapped');
  assert.ok(blocks[0].box.x >= 0, `left edge ${blocks[0].box.x}`);
  assert.ok(blocks[0].box.x + blocks[0].box.w <= 1080, `right edge ${blocks[0].box.x + blocks[0].box.w}`);
  assert.equal(blocks[0].lines.join(' '), long, 'no words were lost');
});

test('an empty block is removed rather than drawn blank', () => {
  const out = applyEdits(BODY, { b1: { lines: ['  '] } }, { root: ROOT, canvasW: 1080 });
  assert.ok(!out.includes('save this for monday'));
  assert.equal(readBlocks(out, { root: ROOT }).length, 1);
});

test('the escaping survives a round trip', () => {
  const out = applyEdits(BODY, { b0: { lines: ['5 < 10 & "quoted"'] } }, { root: ROOT, canvasW: 1080 });
  assert.ok(out.includes('5 &lt; 10 &amp; "quoted"'), 'written escaped');
  assert.equal(readBlocks(out, { root: ROOT })[0].lines[0], '5 < 10 & "quoted"', 'read back plain');
});

test('the picture comes out to its own file and goes back in unchanged', () => {
  const bytes = Buffer.alloc(80 * 1024, 7);
  const body = `<image href="data:image/png;base64,${bytes.toString('base64')}" x="0" y="0" width="1080" height="1440"/>${HOOK}`;
  const { body: light, art } = splitArt(body);
  assert.equal(art.length, 1);
  assert.ok(light.length < 2000, `the document without the picture is ${light.length} bytes`);
  assert.deepEqual(artMissing(light), [0]);
  assert.ok(art[0].buf.equals(bytes));
  assert.equal(joinArt(light, art), body);
  assert.deepEqual(artMissing(joinArt(light, art)), []);
});

test('a small picture — an icon — is cheaper left where it is', () => {
  const small = Buffer.alloc(2 * 1024, 3);
  const body = `<image href="data:image/png;base64,${small.toString('base64')}" x="0" y="0" width="80" height="80"/>`;
  const { body: light, art } = splitArt(body);
  assert.equal(art.length, 0);
  assert.equal(light, body);
});

test('the slide reads back as one line of text for the compliance check', () => {
  assert.equal(textOf(BODY), '3 things that changed my training this year save this for monday');
});

/* ── what the browser is allowed to ask for ───────────────────────────────── */

const BLOCKS = [
  { id: 'b0', lines: ['one', 'two'], box: { x: 100, y: 200, w: 400, h: 120 }, size: 60, anchor: 'middle', fill: '#fff' },
  { id: 'b1', lines: ['three'], box: { x: 100, y: 500, w: 300, h: 60 }, size: 40, anchor: 'middle', fill: '#fff' },
];
const CANVAS = { w: 1080, h: 1440 };

test('an unknown block id is dropped', () => {
  assert.equal(cleanEdits({ nope: { dy: 10 } }, BLOCKS, CANVAS), null);
});

test('the same words in the same order are not an edit', () => {
  assert.equal(cleanEdits({ b0: { lines: ['one', 'two'] } }, BLOCKS, CANVAS), null);
});

test('words are trimmed, blanks dropped, and the count capped', () => {
  const out = cleanEdits(
    { b0: { lines: ['  spaced   out  ', '', 'x'.repeat(400), ...Array(20).fill('more')] } },
    BLOCKS, CANVAS,
  );
  assert.ok(out?.b0.lines);
  assert.equal(out.b0.lines[0], 'spaced out', 'runs of space collapse');
  assert.ok(!out.b0.lines.includes(''), 'blank lines are dropped');
  assert.equal(out.b0.lines[1].length, 140, 'a very long line is cut to what can be laid out');
  assert.equal(out.b0.lines.length, 8, 'eight lines is the most a block takes');
});

test('a move is clamped so a block cannot be thrown off the canvas for ever', () => {
  const out = cleanEdits({ b0: { dx: 99999, dy: -99999 } }, BLOCKS, CANVAS);
  assert.equal(out.b0.dx, CANVAS.w);
  assert.equal(out.b0.dy, -(200 + 120));
});

test('a nudge of nothing is not a change', () => {
  assert.equal(cleanEdits({ b0: { dx: 0, dy: 0 } }, BLOCKS, CANVAS), null);
});

test('the text after an edit is what the brief is checked against', () => {
  assert.equal(textAfter(BLOCKS, null), 'one two three');
  assert.equal(textAfter(BLOCKS, { b0: { lines: ['ONE'] } }), 'ONE three');
});
