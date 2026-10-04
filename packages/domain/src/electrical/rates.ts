/**
 * Average rates for electrical works in Singapore homes, supply and install, before GST: what a
 * licensed electrician typically quotes per point or item for HDB flats and condos (2025). Each
 * rate sits mid-way in the market range given beside it, gathered from published Singapore
 * electrician price lists. They are a starting point: wiring method (concealed or surface), access
 * and the site change real quotes, so every rate can be changed in the app.
 */

export interface ElectricalRate {
  id: string;
  description: string;
  unit: 'pt' | 'no.' | 'm' | 'lot' | 'set';
  /** Average rate in S$, supply and install, before GST. */
  rate: number;
  /** Market range in S$ seen in Singapore price lists. */
  low: number;
  high: number;
}

export interface ElectricalSection {
  id: string;
  title: string;
  items: ElectricalRate[];
}

export const ELECTRICAL_RATES: readonly ElectricalSection[] = [
  {
    id: 'lighting',
    title: 'Lighting points',
    items: [
      {
        id: 'light-point',
        description: 'Lighting point c/w 1-gang switch and wiring',
        unit: 'pt',
        rate: 55,
        low: 40,
        high: 80,
      },
      {
        id: 'light-loop',
        description: 'Additional lighting point looped from existing switch',
        unit: 'pt',
        rate: 40,
        low: 30,
        high: 50,
      },
      {
        id: 'cove-point',
        description: 'Cove light / LED cabinet light point',
        unit: 'pt',
        rate: 45,
        low: 40,
        high: 60,
      },
      {
        id: 'two-way',
        description: '2-way switching (additional switch and wiring)',
        unit: 'pt',
        rate: 45,
        low: 35,
        high: 60,
      },
      {
        id: 'fan-point',
        description: 'Ceiling fan point c/w switch wiring',
        unit: 'pt',
        rate: 65,
        low: 50,
        high: 80,
      },
      {
        id: 'install-light',
        description: 'Install owner-supplied light / downlight',
        unit: 'no.',
        rate: 25,
        low: 15,
        high: 40,
      },
      {
        id: 'install-fan',
        description: 'Install owner-supplied ceiling fan',
        unit: 'no.',
        rate: 80,
        low: 60,
        high: 120,
      },
    ],
  },
  {
    id: 'power',
    title: 'Power points',
    items: [
      {
        id: 'socket-single',
        description: '13A single switched socket outlet (new point)',
        unit: 'pt',
        rate: 75,
        low: 65,
        high: 120,
      },
      {
        id: 'socket-twin',
        description: '13A twin switched socket outlet (new point)',
        unit: 'pt',
        rate: 85,
        low: 70,
        high: 130,
      },
      {
        id: 'socket-usb',
        description: '13A switched socket outlet c/w USB charger',
        unit: 'pt',
        rate: 95,
        low: 80,
        high: 120,
      },
      {
        id: 'socket-convert',
        description: 'Convert single 13A socket to twin',
        unit: 'no.',
        rate: 45,
        low: 35,
        high: 60,
      },
      {
        id: 'socket-shift',
        description: 'Relocate / extend existing 13A socket',
        unit: 'no.',
        rate: 60,
        low: 45,
        high: 80,
      },
      {
        id: 'socket-15a',
        description: '15A switched socket outlet',
        unit: 'pt',
        rate: 95,
        low: 80,
        high: 120,
      },
      {
        id: 'socket-outdoor',
        description: 'Weatherproof 13A socket outlet (IP66)',
        unit: 'pt',
        rate: 120,
        low: 100,
        high: 150,
      },
    ],
  },
  {
    id: 'circuits',
    title: 'Dedicated circuits',
    items: [
      {
        id: 'water-heater',
        description: 'Water heater point c/w 20A DP isolator and MCB',
        unit: 'pt',
        rate: 160,
        low: 120,
        high: 200,
      },
      {
        id: 'aircon-isolator',
        description: 'Aircon isolator point (20A DP) c/w wiring',
        unit: 'pt',
        rate: 140,
        low: 120,
        high: 180,
      },
      {
        id: 'aircon-32a',
        description: 'Aircon condenser circuit 32A c/w isolator (system 3/4)',
        unit: 'pt',
        rate: 220,
        low: 180,
        high: 280,
      },
      {
        id: 'hob',
        description: 'Induction / cooker hob point 32A c/w isolator',
        unit: 'pt',
        rate: 220,
        low: 180,
        high: 280,
      },
      {
        id: 'oven',
        description: 'Oven point 20A c/w isolator',
        unit: 'pt',
        rate: 150,
        low: 120,
        high: 180,
      },
      {
        id: 'washer',
        description: 'Washer / dryer dedicated 20A circuit',
        unit: 'pt',
        rate: 150,
        low: 120,
        high: 180,
      },
    ],
  },
  {
    id: 'db',
    title: 'Distribution board and protection',
    items: [
      {
        id: 'db-12',
        description: 'New 12-way DB c/w 63A 30mA RCCB and MCBs',
        unit: 'set',
        rate: 750,
        low: 450,
        high: 900,
      },
      {
        id: 'db-24',
        description: 'DB upgrade to 18/24-way c/w RCCB and MCBs',
        unit: 'set',
        rate: 950,
        low: 700,
        high: 1200,
      },
      {
        id: 'rccb',
        description: 'Replace RCCB / ELCB 63A 30mA',
        unit: 'no.',
        rate: 200,
        low: 180,
        high: 260,
      },
      { id: 'mcb', description: 'Replace / add MCB', unit: 'no.', rate: 50, low: 40, high: 70 },
      {
        id: 'circuit',
        description: 'Additional final circuit (MCB and wiring)',
        unit: 'no.',
        rate: 120,
        low: 90,
        high: 150,
      },
    ],
  },
  {
    id: 'low-voltage',
    title: 'Data, TV and low voltage',
    items: [
      {
        id: 'data',
        description: 'Data point Cat6 c/w faceplate',
        unit: 'pt',
        rate: 85,
        low: 70,
        high: 110,
      },
      { id: 'tv', description: 'TV / coaxial point', unit: 'pt', rate: 75, low: 60, high: 90 },
      { id: 'phone', description: 'Telephone point', unit: 'pt', rate: 60, low: 50, high: 75 },
      {
        id: 'bell',
        description: 'Doorbell point c/w bell',
        unit: 'pt',
        rate: 70,
        low: 50,
        high: 90,
      },
    ],
  },
  {
    id: 'works',
    title: 'Wiring and general works',
    items: [
      {
        id: 'trunking',
        description: 'PVC trunking / conduit, surface run',
        unit: 'm',
        rate: 10,
        low: 8,
        high: 15,
      },
      {
        id: 'chasing',
        description: 'Chase wall to conceal wiring (excl. making good)',
        unit: 'pt',
        rate: 30,
        low: 20,
        high: 50,
      },
      {
        id: 'dismantle',
        description: 'Dismantle and dispose existing light / point',
        unit: 'no.',
        rate: 15,
        low: 10,
        high: 25,
      },
      {
        id: 'rewire-4rm',
        description: 'Full rewiring, HDB 4-room flat',
        unit: 'lot',
        rate: 4500,
        low: 3000,
        high: 5500,
      },
    ],
  },
  {
    id: 'testing',
    title: 'Testing and certification',
    items: [
      {
        id: 'lew',
        description: 'Testing, commissioning and LEW certification',
        unit: 'lot',
        rate: 200,
        low: 150,
        high: 300,
      },
      {
        id: 'haulage',
        description: 'Haulage and disposal of debris',
        unit: 'lot',
        rate: 80,
        low: 50,
        high: 150,
      },
    ],
  },
];

/** Standard notes printed under an electrical quotation in Singapore. */
export const ELECTRICAL_NOTES = [
  'All works carried out by an EMA-licensed electrical worker (LEW) to SS 638 (Code of Practice for Electrical Installations).',
  'Wiring in PVC conduit or trunking; cables and accessories to SS / IEC standards.',
  'Making good of plaster, tiles and painting is excluded unless stated.',
  'Prices are in Singapore dollars and valid for 30 days.',
  '1-year warranty on workmanship.',
];

export const GST_PERCENT = 9;
