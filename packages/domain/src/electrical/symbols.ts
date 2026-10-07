/**
 * Electrical layout symbols as drawn on Singapore electrical plans: the IEC 60617 / BS EN 60617
 * family that LEWs and IDs read under SS 638 (⊗ for a lighting point, a ticked circle for a
 * switch, a dome for a socket outlet, a half-filled box for the distribution board). Each symbol is
 * a few simple shapes in a unit box from -1 to 1 (y pointing down), so it draws the same on screen
 * and in the PDF. Most are tied to a rate in the Electrical tab, so plotting them counts them in
 * the quotation; switches are counted for the drawing only, as a lighting point's rate includes
 * its switch.
 */

export type SymbolShape =
  | { k: 'circle'; cx: number; cy: number; r: number; fill?: boolean }
  /** An open polyline: x, y pairs. */
  | { k: 'line'; pts: number[] }
  /** A closed polygon: x, y pairs. */
  | { k: 'poly'; pts: number[]; fill?: boolean }
  /** Degrees clockwise from +x (y points down), from `start` to `end`. */
  | { k: 'arc'; cx: number; cy: number; r: number; start: number; end: number }
  | { k: 'text'; x: number; y: number; text: string; size: number };

export interface ElectricalSymbol {
  id: string;
  name: string;
  group:
    'Lighting' | 'Switches' | 'Power' | 'Dedicated circuits' | 'Data and low voltage' | 'Board';
  /** The rate in the Electrical tab each plotted symbol counts towards. */
  rateId?: string;
  shapes: SymbolShape[];
}

const lamp = (r = 0.7): SymbolShape[] => {
  const d = r * 0.707;
  return [
    { k: 'circle', cx: 0, cy: 0, r },
    { k: 'line', pts: [-d, -d, d, d] },
    { k: 'line', pts: [-d, d, d, -d] },
  ];
};

/** A switch: a small circle with its lever, and one tick per gang. */
const switchOf = (gangs: number, twoWay = false): SymbolShape[] => {
  const lever = (sign: 1 | -1): SymbolShape[] => {
    const shapes: SymbolShape[] = [
      { k: 'line', pts: [0.2 * sign, -0.2 * sign, 0.85 * sign, -0.85 * sign] },
    ];
    for (let g = 0; g < gangs; g++) {
      const t = 0.85 - g * 0.22;
      shapes.push({
        k: 'line',
        pts: [t * sign, -t * sign, (t + 0.25) * sign, (-t + 0.25) * sign],
      });
    }
    return shapes;
  };
  return [
    { k: 'circle', cx: 0, cy: 0, r: 0.25, fill: true },
    ...lever(1),
    ...(twoWay ? lever(-1) : []),
  ];
};

/** A switched socket outlet: the dome, its base, the lead to the wall and the switch tick. */
const socket = (label?: string): SymbolShape[] => [
  { k: 'arc', cx: 0, cy: 0.25, r: 0.7, start: 180, end: 360 },
  { k: 'line', pts: [-0.7, 0.25, 0.7, 0.25] },
  { k: 'line', pts: [0, -0.45, 0, -0.95] },
  { k: 'line', pts: [0.3, -0.38, 0.8, -0.9, 0.98, -0.72] },
  ...(label ? [{ k: 'text' as const, x: 0, y: 0.82, text: label, size: 0.62 }] : []),
];

const box = (label: string, size = 0.62): SymbolShape[] => [
  { k: 'poly', pts: [-0.85, -0.85, 0.85, -0.85, 0.85, 0.85, -0.85, 0.85] },
  { k: 'text', x: 0, y: 0, text: label, size },
];

/** An isolator: a box with the isolating stroke, and what it serves. */
const isolator = (label: string): SymbolShape[] => [
  { k: 'poly', pts: [-0.85, -0.85, 0.85, -0.85, 0.85, 0.85, -0.85, 0.85] },
  { k: 'line', pts: [-0.85, 0.85, 0.85, -0.85] },
  { k: 'text', x: 0, y: 1.35, text: label, size: 0.6 },
];

/** A telecommunication outlet: a triangle, lettered for data, TV or telephone. */
const outlet = (label: string): SymbolShape[] => [
  { k: 'poly', pts: [0, -0.9, 0.9, 0.7, -0.9, 0.7] },
  { k: 'text', x: 0, y: 0.25, text: label, size: label.length > 1 ? 0.48 : 0.62 },
];

export const ELECTRICAL_SYMBOLS: ElectricalSymbol[] = [
  { id: 'light', name: 'Lighting point', group: 'Lighting', rateId: 'light-point', shapes: lamp() },
  {
    id: 'light-loop',
    name: 'Lighting point, looped',
    group: 'Lighting',
    rateId: 'light-loop',
    shapes: [...lamp(0.6), { k: 'text', x: 0.85, y: 0.85, text: 'L', size: 0.6 }],
  },
  {
    id: 'cove',
    name: 'Cove / cabinet light point',
    group: 'Lighting',
    rateId: 'cove-point',
    shapes: [
      { k: 'line', pts: [-1, 0, 1, 0] },
      { k: 'line', pts: [-1, -0.4, -1, 0.4] },
      { k: 'line', pts: [1, -0.4, 1, 0.4] },
      { k: 'line', pts: [-1, 0.12, 1, 0.12] },
    ],
  },
  {
    id: 'fan',
    name: 'Ceiling fan point',
    group: 'Lighting',
    rateId: 'fan-point',
    shapes: [
      { k: 'circle', cx: 0, cy: 0, r: 0.8 },
      { k: 'text', x: 0, y: 0, text: 'F', size: 0.85 },
    ],
  },
  { id: 'switch-1', name: '1-gang switch', group: 'Switches', shapes: switchOf(1) },
  { id: 'switch-2', name: '2-gang switch', group: 'Switches', shapes: switchOf(2) },
  { id: 'switch-3', name: '3-gang switch', group: 'Switches', shapes: switchOf(3) },
  { id: 'switch-4', name: '4-gang switch', group: 'Switches', shapes: switchOf(4) },
  {
    id: 'switch-2way',
    name: '2-way switch',
    group: 'Switches',
    rateId: 'two-way',
    shapes: switchOf(1, true),
  },
  {
    id: 'socket',
    name: '13A switched socket outlet',
    group: 'Power',
    rateId: 'socket-single',
    shapes: socket(),
  },
  {
    id: 'socket-twin',
    name: '13A twin switched socket outlet',
    group: 'Power',
    rateId: 'socket-twin',
    shapes: socket('2'),
  },
  {
    id: 'socket-usb',
    name: '13A socket outlet with USB',
    group: 'Power',
    rateId: 'socket-usb',
    shapes: socket('USB'),
  },
  {
    id: 'socket-15a',
    name: '15A switched socket outlet',
    group: 'Power',
    rateId: 'socket-15a',
    shapes: socket('15A'),
  },
  {
    id: 'socket-wp',
    name: 'Weatherproof socket outlet',
    group: 'Power',
    rateId: 'socket-outdoor',
    shapes: socket('WP'),
  },
  {
    id: 'water-heater',
    name: 'Water heater 20A DP switch',
    group: 'Dedicated circuits',
    rateId: 'water-heater',
    shapes: box('WH'),
  },
  {
    id: 'aircon',
    name: 'Aircon isolator',
    group: 'Dedicated circuits',
    rateId: 'aircon-isolator',
    shapes: isolator('AC'),
  },
  {
    id: 'aircon-32a',
    name: 'Aircon isolator, 32A',
    group: 'Dedicated circuits',
    rateId: 'aircon-32a',
    shapes: isolator('32A'),
  },
  { id: 'hob', name: 'Hob point', group: 'Dedicated circuits', rateId: 'hob', shapes: box('H') },
  {
    id: 'oven',
    name: 'Oven point',
    group: 'Dedicated circuits',
    rateId: 'oven',
    shapes: box('OV', 0.55),
  },
  {
    id: 'washer',
    name: 'Washer / dryer point',
    group: 'Dedicated circuits',
    rateId: 'washer',
    shapes: box('WM', 0.5),
  },
  {
    id: 'data',
    name: 'Data point',
    group: 'Data and low voltage',
    rateId: 'data',
    shapes: outlet('D'),
  },
  { id: 'tv', name: 'TV point', group: 'Data and low voltage', rateId: 'tv', shapes: outlet('TV') },
  {
    id: 'phone',
    name: 'Telephone point',
    group: 'Data and low voltage',
    rateId: 'phone',
    shapes: outlet('T'),
  },
  {
    id: 'bell',
    name: 'Bell push',
    group: 'Data and low voltage',
    rateId: 'bell',
    shapes: [
      { k: 'circle', cx: 0, cy: 0, r: 0.65 },
      { k: 'circle', cx: 0, cy: 0, r: 0.22, fill: true },
    ],
  },
  {
    id: 'db',
    name: 'Distribution board',
    group: 'Board',
    rateId: 'db-12',
    shapes: [
      { k: 'poly', pts: [-1, -0.6, 1, -0.6, 1, 0.6, -1, 0.6] },
      { k: 'poly', pts: [1, -0.6, 1, 0.6, -1, 0.6], fill: true },
    ],
  },
];

export const symbolById = (id: string) => ELECTRICAL_SYMBOLS.find((s) => s.id === id);

/** One electrical point plotted on the drawing, in the drawing's pixels. */
export interface ElectricalPoint {
  id: string;
  symbol: string;
  x: number;
  y: number;
  /** Degrees clockwise; sockets and switches face their wall. */
  rotation?: number;
}

/** The electrical layout: a floor plan drawing with the points plotted on it. */
export interface ElectricalPlan {
  fileId: string;
  name: string;
  width: number;
  height: number;
  points: ElectricalPoint[];
  /** Symbol size as a share of the drawing's longer side. */
  symbolSize?: number;
}

export const DEFAULT_SYMBOL_SIZE = 0.012;

/** How many of each symbol are plotted. */
export function countSymbols(points: ElectricalPoint[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of points) out[p.symbol] = (out[p.symbol] ?? 0) + 1;
  return out;
}

/** How many plotted points count towards each electrical rate. */
export function plottedRates(points: ElectricalPoint[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of points) {
    const rate = symbolById(p.symbol)?.rateId;
    if (rate) out[rate] = (out[rate] ?? 0) + 1;
  }
  return out;
}
