// Layers 3 and 4 (TYPE and FURNITURE) are rendered by satori -> SVG -> resvg -> RGBA.
// Lines are pre-wrapped by fitText and emitted with white-space:nowrap so satori
// cannot re-wrap them differently than we measured. That is what makes the
// measurement authoritative rather than advisory.
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { satoriFonts } from './fonts.mjs';

const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const ALIGN = { left: 'flex-start', center: 'center', right: 'flex-end' };
const TEXT_ALIGN = { left: 'left', center: 'center', right: 'right' };

/** One rendered line: spans so a single word can carry the accent. */
function lineNode(block, text, i) {
  const { fit, face } = block;
  const runs = block.runsFor ? block.runsFor(text, i) : [{ text, color: block.color }];

  // Justification, the folder-3 move: every line but the last has its word gaps
  // stretched to the measure. Only applied when the line carries no accent run,
  // because a stretched gap inside a coloured phrase reads as a bug.
  const isLast = i === fit.lines.length - 1 || (fit.paraLast && fit.paraLast[i]);
  const words = text.split(/\s+/).filter(Boolean);
  if (block.justify && !isLast && words.length > 1 && runs.length === 1) {
    return {
      type: 'div',
      props: {
        style: {
          display: 'flex', flexDirection: 'row', width: '100%',
          height: fit.size * fit.lineHeight, alignItems: 'center',
          justifyContent: 'space-between',
        },
        children: words.map((w, wi) => ({
          type: 'span', key: `w${i}_${wi}`,
          props: {
            style: {
              fontFamily: face.satoriName, fontSize: fit.size, lineHeight: fit.lineHeight,
              letterSpacing: `${fit.trackingPx}px`, color: runs[0].color ?? block.color ?? '#000',
              whiteSpace: 'pre',
            },
            children: w,
          },
        })),
      },
    };
  }
  const style = {
    display: 'flex',
    flexDirection: 'row',
    height: fit.size * fit.lineHeight,
    alignItems: 'center',
    justifyContent: ALIGN[block.align] || 'flex-start',
    width: '100%',
  };
  return {
    type: 'div',
    props: {
      style,
      children: runs.map((run, ri) => ({
        type: 'span',
        key: `r${i}_${ri}`,
        props: {
          style: {
            fontFamily: (run.face || face).satoriName,
            fontSize: fit.size,
            lineHeight: fit.lineHeight,
            letterSpacing: `${fit.trackingPx}px`,
            color: run.gradient ? 'transparent' : (run.color ?? block.color ?? '#000'),
            whiteSpace: 'pre',
            ...(run.gradient
              ? { backgroundImage: run.gradient, backgroundClip: 'text', WebkitBackgroundClip: 'text' }
              : {}),
            ...(block.shadow ? { textShadow: block.shadow } : {}),
            ...(run.style || {}),
          },
          children: run.text,
        },
      })),
    },
  };
}

function blockNode(block, idx) {
  const { x, y, w, h, fit } = block;
  const children = fit.lines.map((t, i) => ({ ...lineNode(block, t, i), key: `l${i}` }));
  return {
    type: 'div',
    key: `b${idx}`,
    props: {
      style: {
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: JUSTIFY[block.valign] || 'flex-start',
        alignItems: ALIGN[block.align] || 'flex-start',
        textAlign: TEXT_ALIGN[block.align] || 'left',
        opacity: block.opacity ?? 1,
        ...(block.transform ? { transform: block.transform } : {}),
      },
      children,
    },
  };
}

/** Non-text furniture primitives that still belong to the vector layer. */
function shapeNode(shape, idx) {
  const base = {
    position: 'absolute',
    left: shape.x,
    top: shape.y,
    width: shape.w,
    height: shape.h,
    opacity: shape.opacity ?? 1,
  };
  if (shape.kind === 'rule' || shape.kind === 'rect') {
    return {
      type: 'div',
      key: `s${idx}`,
      props: { style: { ...base, backgroundColor: shape.color, borderRadius: shape.radius || 0 } },
    };
  }
  if (shape.kind === 'stroke') {
    return {
      type: 'div',
      key: `s${idx}`,
      props: {
        style: {
          ...base,
          border: `${shape.weight || 2}px solid ${shape.color}`,
          borderRadius: shape.radius || 0,
        },
      },
    };
  }
  if (shape.kind === 'gradient') {
    return {
      type: 'div',
      key: `s${idx}`,
      props: { style: { ...base, backgroundImage: shape.gradient, borderRadius: shape.radius || 0 } },
    };
  }
  throw new Error(`unknown shape kind "${shape.kind}"`);
}

/**
 * @returns {{png: Buffer, width, height}} transparent RGBA PNG of the layer
 */
export async function renderVectorLayer({ width, height, blocks = [], shapes = [] }) {
  const faces = new Set();
  for (const b of blocks) {
    faces.add(b.face);
    if (b.extraFaces) for (const f of b.extraFaces) faces.add(f);
  }
  const children = [
    ...shapes.map(shapeNode),
    ...blocks.map(blockNode),
  ];
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width, height, display: 'flex', position: 'relative',
          backgroundColor: 'transparent',
        },
        children,
      },
    },
    { width, height, fonts: satoriFonts([...faces].filter(Boolean)) }
  );
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0,0,0,0)',
    font: { loadSystemFonts: false },
  });
  return { png: Buffer.from(resvg.render().asPng()), width, height, svg };
}
