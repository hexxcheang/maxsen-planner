/**
 * Geometry of the five sample drawings, in the 1400 × 1000 SVG space they are drawn in. The web
 * script `apps/web/scripts/generate-sample-drawings.ts` renders them to SVG; Magic Plan uses the same
 * data as a ready-made analysis so the sample projects work without calling the vision model.
 */
export interface Room {
  label: string;
  sub?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional label anchor when the room's centre is covered by fittings or sub-rooms. */
  lx?: number;
  ly?: number;
}
export interface Door {
  /** Hinge point on the wall. */
  x: number;
  y: number;
  /** Unit vector along the wall (direction of the opening from the hinge). */
  ax: number;
  ay: number;
  /** Unit vector of the swing (into the room). */
  px: number;
  py: number;
  size: number;
}
export interface Win {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface Furniture {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}
export interface Drawing {
  file: string;
  title: string;
  sheet: string;
  rooms: Room[];
  doors: Door[];
  windows: Win[];
  furniture?: Furniture[];
}

export const hdb4room: Drawing = {
  file: 'floorplan-hdb-4room.svg',
  title: 'Tampines St 45 — 4-room',
  sheet: 'Sheet A-101',
  rooms: [
    { label: 'Service', sub: 'Yard', x: 100, y: 100, w: 180, h: 260 },
    { label: 'Kitchen', x: 280, y: 100, w: 280, h: 260 },
    { label: 'Shelter', sub: 'Household', x: 560, y: 100, w: 160, h: 260 },
    { label: 'Bath 2', x: 720, y: 100, w: 160, h: 200 },
    { label: 'Master Bedroom', x: 880, y: 100, w: 420, h: 360, lx: 1180, ly: 400 },
    { label: 'M. Bath', x: 1140, y: 100, w: 160, h: 200 },
    { label: 'Living / Dining', x: 100, y: 360, w: 620, h: 540 },
    { label: '', x: 720, y: 300, w: 160, h: 380 },
    { label: 'Bedroom 2', x: 880, y: 460, w: 420, h: 220 },
    { label: 'Bedroom 3', x: 720, y: 680, w: 580, h: 220 },
  ],
  doors: [
    { x: 260, y: 900, ax: 1, ay: 0, px: 0, py: -1, size: 90 },
    { x: 520, y: 360, ax: -1, ay: 0, px: 0, py: -1, size: 80 },
    { x: 600, y: 360, ax: 1, ay: 0, px: 0, py: -1, size: 70 },
    { x: 760, y: 300, ax: 1, ay: 0, px: 0, py: -1, size: 70 },
    { x: 880, y: 400, ax: 0, ay: -1, px: 1, py: 0, size: 80 },
    { x: 1140, y: 290, ax: 0, ay: -1, px: 1, py: 0, size: 70 },
    { x: 880, y: 580, ax: 0, ay: -1, px: 1, py: 0, size: 80 },
    { x: 770, y: 680, ax: 1, ay: 0, px: 0, py: 1, size: 80 },
    { x: 280, y: 300, ax: 0, ay: -1, px: -1, py: 0, size: 70 },
    { x: 720, y: 600, ax: 0, ay: -1, px: -1, py: 0, size: 80 },
  ],
  windows: [
    { x1: 100, y1: 500, x2: 100, y2: 800 },
    { x1: 1300, y1: 320, x2: 1300, y2: 440 },
    { x1: 1300, y1: 500, x2: 1300, y2: 640 },
    { x1: 950, y1: 900, x2: 1200, y2: 900 },
    { x1: 340, y1: 100, x2: 500, y2: 100 },
    { x1: 120, y1: 100, x2: 260, y2: 100 },
  ],
  furniture: [
    { x: 290, y: 110, w: 260, h: 60 },
    { x: 130, y: 640, w: 70, h: 200, r: 8 },
    { x: 420, y: 560, w: 150, h: 90, r: 45 },
    { x: 930, y: 300, w: 180, h: 150, r: 6 },
    { x: 1120, y: 500, w: 160, h: 130, r: 6 },
    { x: 1100, y: 740, w: 170, h: 130, r: 6 },
    { x: 130, y: 400, w: 200, h: 50 },
  ],
};

export const condo2bed: Drawing = {
  file: 'floorplan-condo-2bed.svg',
  title: 'Marina One — Type B2',
  sheet: 'Sheet A-201',
  rooms: [
    { label: 'Balcony', x: 100, y: 100, w: 700, h: 120 },
    { label: 'Living / Dining', x: 100, y: 220, w: 700, h: 440 },
    { label: 'Kitchen', sub: 'Open', x: 100, y: 660, w: 400, h: 240 },
    { label: 'Foyer', x: 500, y: 660, w: 300, h: 240 },
    { label: 'Master Bedroom', x: 800, y: 100, w: 500, h: 400 },
    { label: 'M. Bath', x: 1100, y: 500, w: 200, h: 180 },
    { label: 'Bedroom 2', x: 800, y: 500, w: 300, h: 400 },
    { label: 'Bath 2', x: 1100, y: 680, w: 200, h: 220 },
  ],
  doors: [
    { x: 700, y: 900, ax: -1, ay: 0, px: 0, py: -1, size: 90 },
    { x: 800, y: 380, ax: 0, ay: -1, px: 1, py: 0, size: 85 },
    { x: 800, y: 600, ax: 0, ay: -1, px: 1, py: 0, size: 85 },
    { x: 1100, y: 560, ax: 0, ay: 1, px: 1, py: 0, size: 70 },
    { x: 1100, y: 780, ax: 0, ay: -1, px: 1, py: 0, size: 70 },
  ],
  windows: [
    { x1: 160, y1: 100, x2: 740, y2: 100 },
    { x1: 1300, y1: 160, x2: 1300, y2: 440 },
    { x1: 1300, y1: 720, x2: 1300, y2: 860 },
    { x1: 100, y1: 300, x2: 100, y2: 600 },
  ],
  furniture: [
    { x: 150, y: 300, w: 240, h: 90, r: 10 },
    { x: 480, y: 420, w: 220, h: 110, r: 55 },
    { x: 110, y: 670, w: 380, h: 60 },
    { x: 960, y: 160, w: 200, h: 170, r: 6 },
    { x: 860, y: 640, w: 170, h: 140, r: 6 },
  ],
};

export const landedL1: Drawing = {
  file: 'floorplan-landed-l1.svg',
  title: 'Serangoon Gardens — Level 1',
  sheet: 'Sheet A-301',
  rooms: [
    { label: 'Car Porch', x: 100, y: 100, w: 400, h: 300 },
    { label: 'Garden', x: 500, y: 100, w: 800, h: 160 },
    { label: 'Living', x: 500, y: 260, w: 480, h: 360 },
    { label: 'Dining', x: 980, y: 260, w: 320, h: 360 },
    { label: 'Foyer', x: 100, y: 400, w: 400, h: 220 },
    { label: 'Guest Room', x: 100, y: 620, w: 320, h: 280 },
    { label: 'Powder', x: 420, y: 620, w: 160, h: 140, ly: 740 },
    { label: 'Stairs', x: 420, y: 760, w: 160, h: 140 },
    { label: 'Dry Kitchen', x: 580, y: 620, w: 400, h: 280 },
    { label: 'Wet Kitchen', x: 980, y: 620, w: 220, h: 280 },
    { label: 'Yard', x: 1200, y: 620, w: 100, h: 280, ly: 860 },
  ],
  doors: [
    { x: 240, y: 400, ax: 1, ay: 0, px: 0, py: 1, size: 100 },
    { x: 500, y: 540, ax: 0, ay: -1, px: 1, py: 0, size: 90 },
    { x: 200, y: 620, ax: 1, ay: 0, px: 0, py: 1, size: 80 },
    { x: 460, y: 620, ax: 1, ay: 0, px: 0, py: 1, size: 70 },
    { x: 700, y: 620, ax: 1, ay: 0, px: 0, py: 1, size: 90 },
    { x: 980, y: 800, ax: 0, ay: -1, px: 1, py: 0, size: 80 },
    { x: 1200, y: 800, ax: 0, ay: -1, px: 1, py: 0, size: 70 },
    { x: 1150, y: 260, ax: -1, ay: 0, px: 0, py: 1, size: 120 },
  ],
  windows: [
    { x1: 560, y1: 260, x2: 900, y2: 260 },
    { x1: 1300, y1: 320, x2: 1300, y2: 560 },
    { x1: 100, y1: 680, x2: 100, y2: 860 },
    { x1: 640, y1: 900, x2: 900, y2: 900 },
  ],
  furniture: [
    { x: 560, y: 340, w: 280, h: 100, r: 10 },
    { x: 1040, y: 360, w: 200, h: 160, r: 8 },
    { x: 590, y: 630, w: 380, h: 60 },
    { x: 150, y: 150, w: 160, h: 220, r: 12 },
    { x: 150, y: 700, w: 160, h: 140, r: 6 },
  ],
};

export const landedL2: Drawing = {
  file: 'floorplan-landed-l2.svg',
  title: 'Serangoon Gardens — Level 2',
  sheet: 'Sheet A-302',
  rooms: [
    { label: 'Balcony', x: 100, y: 100, w: 400, h: 140 },
    { label: 'Master Bedroom', x: 100, y: 240, w: 480, h: 380 },
    { label: 'Walk-in', x: 580, y: 240, w: 200, h: 200 },
    { label: 'M. Bath', x: 580, y: 440, w: 200, h: 180 },
    { label: 'Family Area', x: 780, y: 100, w: 520, h: 520 },
    { label: 'Bedroom 2', x: 100, y: 620, w: 320, h: 280 },
    { label: 'Stairs', x: 420, y: 760, w: 160, h: 140 },
    { label: 'Bath', x: 420, y: 620, w: 160, h: 140 },
    { label: 'Bedroom 3', x: 580, y: 620, w: 360, h: 280 },
    { label: 'Study', x: 940, y: 620, w: 360, h: 280 },
  ],
  doors: [
    { x: 300, y: 240, ax: 1, ay: 0, px: 0, py: 1, size: 100 },
    { x: 580, y: 380, ax: 0, ay: -1, px: 1, py: 0, size: 80 },
    { x: 580, y: 560, ax: 0, ay: -1, px: 1, py: 0, size: 70 },
    { x: 780, y: 520, ax: 0, ay: -1, px: -1, py: 0, size: 90 },
    { x: 200, y: 620, ax: 1, ay: 0, px: 0, py: 1, size: 80 },
    { x: 460, y: 620, ax: 1, ay: 0, px: 0, py: 1, size: 70 },
    { x: 650, y: 620, ax: 1, ay: 0, px: 0, py: 1, size: 80 },
    { x: 1000, y: 620, ax: 1, ay: 0, px: 0, py: 1, size: 80 },
  ],
  windows: [
    { x1: 1300, y1: 180, x2: 1300, y2: 500 },
    { x1: 100, y1: 300, x2: 100, y2: 560 },
    { x1: 160, y1: 900, x2: 360, y2: 900 },
    { x1: 660, y1: 900, x2: 860, y2: 900 },
    { x1: 1020, y1: 900, x2: 1220, y2: 900 },
  ],
  furniture: [
    { x: 160, y: 320, w: 220, h: 180, r: 6 },
    { x: 860, y: 220, w: 300, h: 110, r: 10 },
    { x: 150, y: 690, w: 180, h: 150, r: 6 },
    { x: 700, y: 700, w: 180, h: 150, r: 6 },
    { x: 1000, y: 700, w: 240, h: 90 },
  ],
};

export const landedAttic: Drawing = {
  file: 'floorplan-landed-attic.svg',
  title: 'Serangoon Gardens — Attic',
  sheet: 'Sheet A-303',
  rooms: [
    { label: 'Roof Terrace', x: 100, y: 100, w: 600, h: 800 },
    { label: 'Attic Lounge', x: 700, y: 100, w: 600, h: 440 },
    { label: 'Stairs', x: 700, y: 760, w: 160, h: 140 },
    { label: 'Bath', x: 700, y: 540, w: 160, h: 220 },
    { label: 'Store', x: 860, y: 540, w: 440, h: 360 },
  ],
  doors: [
    { x: 700, y: 260, ax: 0, ay: 1, px: -1, py: 0, size: 120 },
    { x: 700, y: 700, ax: 0, ay: -1, px: 1, py: 0, size: 70 },
    { x: 860, y: 700, ax: 0, ay: -1, px: 1, py: 0, size: 80 },
  ],
  windows: [
    { x1: 1300, y1: 160, x2: 1300, y2: 480 },
    { x1: 760, y1: 100, x2: 1240, y2: 100 },
  ],
  furniture: [
    { x: 800, y: 200, w: 300, h: 110, r: 10 },
    { x: 200, y: 300, w: 120, h: 120, r: 60 },
  ],
};

export const SAMPLE_DRAWINGS: readonly Drawing[] = [
  hdb4room,
  condo2bed,
  landedL1,
  landedL2,
  landedAttic,
];
