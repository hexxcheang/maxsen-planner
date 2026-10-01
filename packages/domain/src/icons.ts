/**
 * Fixed icon silhouettes for device categories.
 *
 * Every shape is an SVG path (`d` attribute) authored with absolute commands inside the unit box
 * x, y ∈ [−0.5, 0.5], centred on the origin. Renderers scale the path to the category's icon size,
 * so the same string is drawn by the Konva editor, the inline SVG library tiles and the PDF export.
 *
 * Path categories (LED strips, tracks) are not icons on the plan; their shape returns a legend
 * sample line and the renderer adds caps/heads according to the shape id.
 */
export type IconShape =
  | 'square'
  | 'panel'
  | 'pill'
  | 'hexagon'
  | 'diamond'
  | 'target'
  | 'dome'
  | 'triangle'
  | 'arch'
  | 'dot'
  | 'circle'
  | 'roundedSquare'
  | 'drop'
  | 'star4'
  | 'smallHexagon'
  | 'track'
  | 'strip'
  | 'magnetic';

export const PATH_SHAPES: readonly IconShape[] = ['track', 'strip', 'magnetic'];

/** Clockwise circle (SVG screen coordinates) centred on the origin. */
const circle = (r: number, clockwise = true): string => {
  const sweep = clockwise ? 1 : 0;
  return `M0 ${-r} A${r} ${r} 0 1 ${sweep} 0 ${r} A${r} ${r} 0 1 ${sweep} 0 ${-r} Z`;
};

const roundedRect = (hw: number, hh: number, r: number): string =>
  [
    `M${-hw + r} ${-hh}`,
    `H${hw - r}`,
    `A${r} ${r} 0 0 1 ${hw} ${-hh + r}`,
    `V${hh - r}`,
    `A${r} ${r} 0 0 1 ${hw - r} ${hh}`,
    `H${-hw + r}`,
    `A${r} ${r} 0 0 1 ${-hw} ${hh - r}`,
    `V${-hh + r}`,
    `A${r} ${r} 0 0 1 ${-hw + r} ${-hh}`,
    'Z',
  ].join(' ');

const regularPolygon = (sides: number, r: number, startAngleDeg: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = ((startAngleDeg + (360 / sides) * i) * Math.PI) / 180;
    pts.push(`${round(r * Math.cos(a))} ${round(r * Math.sin(a))}`);
  }
  return `M${pts.join(' L')} Z`;
};

const round = (n: number): number => Math.round(n * 1000) / 1000;

const LEGEND_LINE = 'M-0.5 0 H0.5';

const SHAPES: Record<IconShape, string> = {
  square: 'M-0.5 -0.5 H0.5 V0.5 H-0.5 Z',
  panel: roundedRect(0.5, 0.32, 0.08),
  pill: 'M-0.25 -0.25 H0.25 A0.25 0.25 0 0 1 0.25 0.25 H-0.25 A0.25 0.25 0 0 1 -0.25 -0.25 Z',
  hexagon: regularPolygon(6, 0.5, 0),
  diamond: 'M0 -0.5 L0.5 0 L0 0.5 L-0.5 0 Z',
  // Concentric: outer ring (hole cut with opposite winding) around a solid centre disc.
  target: `${circle(0.5)} ${circle(0.42, false)} ${circle(0.34)}`,
  // Dome camera: half-disc over a base bar.
  dome: 'M-0.45 0.15 A0.45 0.45 0 0 1 0.45 0.15 Z M-0.5 0.27 H0.5 V0.45 H-0.5 Z',
  triangle: 'M0 -0.5 L0.5 0.4 L-0.5 0.4 Z',
  arch: 'M-0.4 0.5 V-0.1 A0.4 0.4 0 0 1 0.4 -0.1 V0.5 Z',
  dot: circle(0.35),
  circle: circle(0.5),
  roundedSquare: roundedRect(0.5, 0.5, 0.14),
  drop: 'M0 -0.5 C0.24 -0.22 0.35 -0.08 0.35 0.15 A0.35 0.35 0 0 1 -0.35 0.15 C-0.35 -0.08 -0.24 -0.22 0 -0.5 Z',
  star4: 'M0 -0.5 L0.17 -0.17 L0.5 0 L0.17 0.17 L0 0.5 L-0.17 0.17 L-0.5 0 L-0.17 -0.17 Z',
  smallHexagon: regularPolygon(6, 0.35, 0),
  track: LEGEND_LINE,
  strip: LEGEND_LINE,
  magnetic: LEGEND_LINE,
};

export const ICON_SHAPES: readonly IconShape[] = Object.keys(SHAPES) as IconShape[];

export function iconPath(shape: IconShape): string {
  const d = SHAPES[shape];
  if (d === undefined) throw new Error(`Unknown icon shape: ${String(shape)}`);
  return d;
}

export function isPathShape(shape: IconShape): boolean {
  return PATH_SHAPES.includes(shape);
}

export interface BadgePlacement {
  /** Centre of the badge text in unit-box coordinates. */
  x: number;
  y: number;
  /** Multiplier applied to the renderer's base badge font size (1 = full size). */
  scale: number;
}

const CENTRED: BadgePlacement = { x: 0, y: 0, scale: 1 };

/** Where the badge text sits for shapes whose visual centre or usable area is not the box centre. */
const BADGE_PLACEMENTS: Partial<Record<IconShape, BadgePlacement>> = {
  triangle: { x: 0, y: 0.14, scale: 0.72 },
  dome: { x: 0, y: -0.07, scale: 0.8 },
  drop: { x: 0, y: 0.17, scale: 0.8 },
  diamond: { x: 0, y: 0, scale: 0.8 },
  star4: { x: 0, y: 0, scale: 0.55 },
  target: { x: 0, y: 0, scale: 0.85 },
  arch: { x: 0, y: 0.08, scale: 0.9 },
  dot: { x: 0, y: 0, scale: 0.72 },
  smallHexagon: { x: 0, y: 0, scale: 0.72 },
  pill: { x: 0, y: 0, scale: 0.85 },
  panel: { x: 0, y: 0, scale: 0.9 },
};

export function badgePlacement(shape: IconShape): BadgePlacement {
  return BADGE_PLACEMENTS[shape] ?? CENTRED;
}
