/**
 * Maxsen's monogram canvas, after the brand artwork: hexagon "M" roundels alternating with
 * sparkle diamonds, each row shifted half a step, in fine rose-gold lines on a champagne ground
 * that deepens from white to warm sand. Drawn as a seamless repeat (every motif that crosses a
 * tile edge is completed by its neighbour) and centred on the box it fills, so the edges come out
 * symmetrical with no awkward breaks.
 */

/** The repeat in pattern units: two rows of hexagons and sparkles. */
const TILE_W = 140;
const TILE_H = 230;

const LINE = '#C58A62';

export type PatternKind = 'page' | 'panel';

/** Points of a pointy-topped hexagon of radius `r` around (x, y). */
function hexPoints(x: number, y: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 90) * Math.PI) / 180;
    return `${(x + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

/** The roundel: a hexagon holding the Maxsen M, a peaked M whose middle dips between its legs. */
function hexagon(x: number, y: number): string {
  return `<polygon points="${hexPoints(x, y, 32)}" stroke-width="1.8"/>
<g transform="translate(${x} ${y})" stroke-width="1.9" stroke-linejoin="miter">
<path d="M-12 12 V-3 L0 -11 L12 -3 V12"/><path d="M-12 -3 L0 5 L12 -3"/><path d="M-6 12 V3"/><path d="M6 12 V3"/></g>`;
}

/** A starburst of fine rays. */
function star(x: number, y: number): string {
  const rays: string[] = [];
  // Long rays up, down and on the diagonals reach towards the neighbouring sparkles and weave a
  // fine web; the short ones fill the burst.
  const RAYS: [number, number][] = [
    [90, 40],
    [270, 40],
    [30, 52],
    [150, 52],
    [210, 52],
    [330, 52],
    [60, 34],
    [120, 34],
    [240, 34],
    [300, 34],
    [10, 20],
    [170, 20],
    [190, 20],
    [350, 20],
  ];
  for (const [deg, len] of RAYS) {
    const a = (deg * Math.PI) / 180;
    const inner = 2;
    rays.push(
      `M${(x + inner * Math.cos(a)).toFixed(2)} ${(y + inner * Math.sin(a)).toFixed(2)} L${(x + len * Math.cos(a)).toFixed(2)} ${(y + len * Math.sin(a)).toFixed(2)}`,
    );
  }
  return `<path d="${rays.join(' ')}" stroke-width="0.9"/>`;
}

/** Two starbursts joined by a double diamond. */
function sparkle(x: number, y: number): string {
  const d = (hw: number, hh: number) =>
    `<path d="M${x} ${y - hh} L${x + hw} ${y} L${x} ${y + hh} L${x - hw} ${y} Z" stroke-width="1.1"/>`;
  return d(22, 27) + d(13, 27) + star(x, y - 27) + star(x, y + 27);
}

/** One tile, with every motif that crosses its edge drawn on both sides. */
function tile(): string {
  const parts: string[] = [];
  for (const dy of [0, TILE_H]) {
    for (const dx of [0, TILE_W]) parts.push(hexagon(dx, dy));
    parts.push(sparkle(TILE_W / 2, dy));
  }
  parts.push(hexagon(TILE_W / 2, TILE_H / 2));
  for (const dx of [0, TILE_W]) parts.push(sparkle(dx, TILE_H / 2));
  return parts.join('');
}

/**
 * The canvas as SVG, `width` × `height` pixels with the repeat `tileWidth` pixels across. `page`
 * fades from white to sand top to bottom; `panel` is an even sand for boxes inside the documents.
 */
export function monogramSvg(
  width: number,
  height: number,
  tileWidth: number,
  kind: PatternKind = 'page',
): string {
  const s = tileWidth / TILE_W;
  // Centre a hexagon column and row on the box, so both edges cut the repeat the same way.
  const tx = (((width / 2) % (TILE_W * s)) + TILE_W * s) % (TILE_W * s);
  const ty = (((height / 2) % (TILE_H * s)) + TILE_H * s) % (TILE_H * s);
  const ground =
    kind === 'page'
      ? `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#FFFFFF"/><stop offset="0.12" stop-color="#FEFCF9"/><stop offset="0.3" stop-color="#F7EEE2"/><stop offset="0.55" stop-color="#F1E2CA"/><stop offset="1" stop-color="#E5C89F"/>
</linearGradient>`
      : '';
  const fill = kind === 'page' ? 'url(#g)' : '#EFE1CB';
  const opacity = kind === 'page' ? 0.26 : 0.32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>${ground}
<pattern id="m" width="${TILE_W}" height="${TILE_H}" patternUnits="userSpaceOnUse" patternTransform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s})">
<g fill="none" stroke="${LINE}" stroke-linecap="round">${tile()}</g></pattern></defs>
<rect width="100%" height="100%" fill="${fill}"/>
<rect width="100%" height="100%" fill="url(#m)" opacity="${opacity}"/>
</svg>`;
}

export const monogramUrl = (width: number, height: number, tileWidth: number, kind: PatternKind) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(monogramSvg(width, height, tileWidth, kind))}`;
