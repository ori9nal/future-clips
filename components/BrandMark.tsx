/**
 * The Future Clips mark: three stacked cards. ONE drawing for every surface.
 *
 * The same three rectangles, in the same colours, are inlined in
 * design/site.html (header, footer, favicon), design/build_legal.mjs (the
 * legal pages), design/build_og.mjs (the link-preview image), app/icon.svg
 * (the app favicon) and tools/capture-video.mjs. Change the geometry or the
 * colours here first, then mirror it there; design/logo.png is the raster
 * master for places that cannot take an SVG.
 */
export const MARK = {
  viewBox: "0 0 92 64",
  rects: [
    { x: 0, y: 21, fill: "#D9D7D1" },
    { x: 14, y: 12, fill: "#8E8D89" },
    { x: 31, y: 2, fill: "#0E0E10" },
  ],
  w: 55,
  h: 39,
  rx: 7,
} as const;

export function BrandMark({ height = 26, className }: { height?: number; className?: string }) {
  return (
    <svg viewBox={MARK.viewBox} height={height} width={Math.round((height * 92) / 64)} className={className} aria-hidden focusable="false">
      {MARK.rects.map((r) => (
        <rect key={r.fill} x={r.x} y={r.y} width={MARK.w} height={MARK.h} rx={MARK.rx} fill={r.fill} />
      ))}
    </svg>
  );
}
