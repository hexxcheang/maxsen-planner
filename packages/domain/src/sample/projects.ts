/**
 * Three sample projects with realistic layouts on the generated sample drawings.
 * Drawing coordinates are authored in the 1400 × 1000 SVG space and converted to plan units
 * (background width = 1000) by `P()`, so element positions line up with rooms on the drawings.
 */
import { SYSTEM_VARIANT_IDS } from '../categories.ts';
import { circlePoints } from '../geometry/path.ts';
import { defaultExportSettings } from '../plan-document.ts';
import type {
  LedStripPath,
  Level,
  Plan,
  PlanDocument,
  PlanElement,
  PlanType,
  PointMarker,
  Project,
  Pt,
  QuantityAdjustment,
  SourceFile,
  SourcePage,
  TextNote,
  TrackPath,
  VariantSnapshot,
} from '../types.ts';
import { sampleProduct, sampleVariant } from './catalogue.ts';

const K = 1000 / 1400;
const r1 = (n: number): number => Math.round(n * K * 10) / 10;
const P = (x: number, y: number): Pt => ({ x: r1(x), y: r1(y) });
const SNAPSHOT_AT = '2026-09-14T03:12:00.000Z';
const BG = { width: 1400, height: 1000 } as const;

// --- element builders (z follows authoring order) -------------------------------------------

class DocBuilder {
  private readonly elements: PlanElement[] = [];
  constructor(private readonly prefix: string) {}

  marker(
    variantId: string,
    x: number,
    y: number,
    opts: { rotation?: number; label?: string } = {},
  ): this {
    const el: PointMarker = {
      kind: 'marker',
      id: this.id(),
      z: this.elements.length,
      variantId,
      ...P(x, y),
      rotation: opts.rotation ?? 0,
      label: opts.label ?? '',
    };
    this.elements.push(el);
    return this;
  }

  strip(
    variantId: string,
    pts: [number, number][],
    metres: number | null,
    opts: { closed?: boolean; smooth?: boolean } = {},
  ): this {
    const el: LedStripPath = {
      kind: 'led-strip',
      id: this.id(),
      z: this.elements.length,
      variantId,
      points: pts.map(([x, y]) => P(x, y)),
      closed: opts.closed ?? false,
      smooth: opts.smooth ?? false,
      metres,
      showLabel: true,
    };
    this.elements.push(el);
    return this;
  }

  loop(variantId: string, cx: number, cy: number, radius: number, metres: number): this {
    const el: LedStripPath = {
      kind: 'led-strip',
      id: this.id(),
      z: this.elements.length,
      variantId,
      points: circlePoints(P(cx, cy), r1(radius)).map((p) => ({
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
      })),
      closed: true,
      smooth: true,
      metres,
      showLabel: true,
    };
    this.elements.push(el);
    return this;
  }

  track(variantId: string, pts: [number, number][], headCount: number): this {
    const el: TrackPath = {
      kind: 'track',
      id: this.id(),
      z: this.elements.length,
      variantId,
      points: pts.map(([x, y]) => P(x, y)),
      headCount,
      showLabel: true,
    };
    this.elements.push(el);
    return this;
  }

  note(
    x: number,
    y: number,
    text: string,
    opts: Partial<Pick<TextNote, 'fontSize' | 'bold' | 'color' | 'highlight'>> = {},
  ): this {
    const el: TextNote = {
      kind: 'note',
      id: this.id(),
      z: this.elements.length,
      ...P(x, y),
      text,
      fontSize: opts.fontSize ?? 14,
      bold: opts.bold ?? false,
      color: opts.color ?? '#1F1D1A',
      highlight: opts.highlight ?? null,
    };
    this.elements.push(el);
    return this;
  }

  build(): PlanDocument {
    return {
      schemaVersion: 1,
      elements: this.elements,
      view: { hiddenCategories: [], legendVisible: true },
    };
  }

  private id(): string {
    return `el_${this.prefix}_${String(this.elements.length + 1).padStart(2, '0')}`;
  }
}

// --- Tan Residence (HDB 4-room) ---------------------------------------------------------------
// Rooms (SVG px): Living/Dining 100–720 × 360–900 · Kitchen 280–560 × 100–360 · Master 880–1300 × 100–460
// Bedroom 2 880–1300 × 460–680 · Bedroom 3 720–1300 × 680–900 · Corridor 720–880 × 300–680

const tanSmartHome = new DocBuilder('tan_sh')
  .marker('var_lenovo_lock_std', 300, 912, { label: 'Main door' })
  .marker('var_door_sensor', 360, 884)
  .marker('var_nova_s8', 430, 884, { label: 'Entrance panel' })
  .marker('var_nova_pro_3g_black', 500, 884)
  .marker('var_nova_pro_2g_black', 430, 342)
  .marker('var_nova_pro_2g_black', 904, 310)
  .marker('var_nova_pro_2g_black', 904, 606)
  .marker('var_nova_pro_1g_black', 868, 710)
  .marker('var_nova_pro_1g_black', 744, 322)
  .marker('var_ark_1g', 262, 322)
  .marker('var_curtain_single', 124, 650, { rotation: 90, label: 'Living window' })
  .marker('var_curtain_double', 1276, 380, { rotation: 90 })
  .marker('var_curtain_single', 1276, 570, { rotation: 90 })
  .marker('var_ir_aircon', 600, 400)
  .marker('var_ir_aircon', 1100, 130)
  .marker('var_ir_aircon', 1100, 486)
  .marker('var_ir_aircon', 1000, 704)
  .marker('var_gateway', 230, 480)
  .marker('var_reyee_router', 300, 480)
  .marker('var_indoor_cam', 698, 384)
  .marker('var_motion_sensor', 800, 500)
  .marker('var_smart_plug', 660, 860)
  .note(118, 950, 'Main door: retain existing frame. Lock supplied by MyDigitalLock.', {
    highlight: '#FFF3B0',
  })
  .build();

const tanLighting = new DocBuilder('tan_lt')
  .strip(
    'var_lumi_cove_3000',
    [
      [130, 384],
      [696, 384],
      [696, 876],
    ],
    4.5,
  )
  .loop('var_lumi_cove_4000', 1010, 300, 110, 6.2)
  .track(
    'var_luna_track_black',
    [
      [400, 540],
      [600, 540],
    ],
    3,
  )
  .track(
    'var_luna_magnetic_black',
    [
      [300, 130],
      [540, 130],
      [540, 330],
    ],
    5,
  )
  .marker('var_luna_dl_3000', 220, 480)
  .marker('var_luna_dl_3000', 420, 480)
  .marker('var_luna_dl_3000', 620, 480)
  .marker('var_luna_dl_3000', 220, 760)
  .marker('var_luna_dl_3000', 620, 760)
  .marker('var_luna_dl_4000', 380, 200)
  .marker('var_luna_dl_4000', 480, 200)
  .marker('var_luna_dl_4000', 380, 300)
  .marker('var_luna_dl_4000', 480, 300)
  .marker('var_luna_dl_3000', 930, 150)
  .marker('var_luna_dl_3000', 1100, 150)
  .marker('var_luna_dl_3000', 930, 420)
  .marker('var_luna_dl_3000', 1100, 420)
  .marker('var_luna_dl_3000', 1000, 520)
  .marker('var_luna_dl_3000', 1200, 620)
  .marker('var_luna_dl_3000', 850, 790)
  .marker('var_luna_dl_3000', 1150, 790)
  .marker('var_luna_dl_3000', 800, 400)
  .marker('var_luna_dl_3000', 800, 600)
  .marker('var_luna_antiglare', 800, 200)
  .marker('var_luna_antiglare', 1220, 200)
  .marker('var_lumi_surface_round', 190, 230)
  .marker('var_lumi_surface_square', 640, 230)
  .marker('var_dining_pendant', 495, 610, { label: 'Dining' })
  .marker('var_luna_spot_black', 160, 560)
  .marker('var_luna_spot_black', 160, 690)
  .note(118, 950, 'All downlights 3000K unless marked.')
  .build();

// --- Lim Family Home (landed, 3 levels) -------------------------------------------------------
// L1 rooms: Car Porch 100–500 × 100–400 · Garden 500–1300 × 100–260 · Living 500–980 × 260–620
// Dining 980–1300 × 260–620 · Foyer 100–500 × 400–620 · Guest 100–420 × 620–900 · Dry Kitchen 580–980 × 620–900
// Wet Kitchen 980–1200 × 620–900

const limL1SmartHome = new DocBuilder('lim1_sh')
  .marker('var_lenovo_lock_pro', 290, 392, { label: 'Main door' })
  .marker('var_door_sensor', 350, 416)
  .marker('var_nova_s10', 140, 520, { label: 'Foyer panel' })
  .marker('var_lusano_3g', 520, 300)
  .marker('var_lusano_2g', 1000, 300)
  .marker('var_lusano_2g', 620, 640)
  .marker('var_lusano_1g', 1000, 640)
  .marker('var_lusano_2g', 140, 640)
  .marker('var_lusano_1g', 440, 640)
  .marker('var_curtain_double', 730, 268, { label: 'Living garden window' })
  .marker('var_ir_aircon', 940, 290)
  .marker('var_ir_aircon', 1260, 290)
  .marker('var_ir_aircon', 400, 650)
  .marker('var_gateway', 540, 580)
  .marker('var_reyee_router', 600, 580)
  .marker('var_outdoor_cam', 120, 120, { label: 'Porch' })
  .marker('var_doorbell', 230, 416)
  .marker('var_motion_sensor', 300, 500)
  .marker('var_temp_sensor', 900, 580)
  .note(520, 950, 'Gateway and router in the TV console; keep a power point free.')
  .build();

const limL1Lighting = new DocBuilder('lim1_lt')
  .strip(
    'var_lumi_cove_3000',
    [
      [520, 280],
      [960, 280],
      [960, 600],
    ],
    5.5,
  )
  .strip(
    'var_lumi_cob_3000',
    [
      [600, 700],
      [960, 700],
    ],
    3,
  )
  .track(
    'var_luna_track_white',
    [
      [1020, 330],
      [1260, 330],
    ],
    4,
  )
  .track(
    'var_luna_magnetic_black',
    [
      [140, 520],
      [460, 520],
    ],
    3,
  )
  .marker('var_luna_dl_3000', 620, 360)
  .marker('var_luna_dl_3000', 860, 360)
  .marker('var_luna_dl_3000', 620, 540)
  .marker('var_luna_dl_3000', 860, 540)
  .marker('var_luna_dl_3000', 1060, 560)
  .marker('var_luna_dl_3000', 1220, 560)
  .marker('var_luna_dl_4000', 660, 800)
  .marker('var_luna_dl_4000', 780, 800)
  .marker('var_luna_dl_4000', 900, 800)
  .marker('var_luna_dl_4000', 1040, 760)
  .marker('var_luna_dl_4000', 1140, 760)
  .marker('var_luna_dl_3000', 200, 460)
  .marker('var_luna_dl_3000', 400, 460)
  .marker('var_luna_dl_3000', 200, 760)
  .marker('var_luna_dl_3000', 320, 760)
  .marker('var_lumi_surface_round', 200, 200)
  .marker('var_lumi_surface_round', 400, 200)
  .marker('var_lumi_surface_square', 1250, 760)
  .marker('var_dining_pendant', 1140, 440, { label: 'Dining table' })
  .marker('var_luna_spot_black', 540, 320)
  .marker('var_luna_spot_black', 540, 560)
  .note(520, 950, 'Living cove continues above the TV wall; dry kitchen strip under wall cabinets.')
  .build();

// L2 rooms: Master 100–580 × 240–620 · Walk-in 580–780 × 240–440 · Family 780–1300 × 100–620
// Bedroom 2 100–420 × 620–900 · Bedroom 3 580–940 × 620–900 · Study 940–1300 × 620–900

const limL2SmartHome = new DocBuilder('lim2_sh')
  .marker('var_lusano_3g', 130, 270)
  .marker('var_lusano_1g', 600, 400)
  .marker('var_lusano_2g', 810, 500)
  .marker('var_lusano_2g', 130, 650)
  .marker('var_lusano_2g', 620, 650)
  .marker('var_lusano_2g', 970, 650)
  .marker('var_nova_s1', 820, 140, { label: 'Family area' })
  .marker('var_curtain_double', 320, 250, { label: 'Balcony' })
  .marker('var_curtain_single', 124, 430, { rotation: 90 })
  .marker('var_curtain_single', 1276, 340, { rotation: 90 })
  .marker('var_ir_aircon', 400, 270)
  .marker('var_ir_aircon', 1060, 130)
  .marker('var_ir_aircon', 300, 650)
  .marker('var_ir_aircon', 760, 650)
  .marker('var_ir_aircon', 1120, 650)
  .marker('var_reyee_mesh', 1040, 580)
  .marker('var_motion_sensor', 680, 540)
  .marker('var_indoor_cam', 1280, 120)
  .build();

const limL2Lighting = new DocBuilder('lim2_lt')
  .loop('var_lumi_cove_3000', 1040, 360, 110, 7.5)
  .strip(
    'var_lumi_cob_3000',
    [
      [600, 430],
      [760, 430],
    ],
    2.4,
  )
  .track(
    'var_luna_magnetic_black',
    [
      [960, 650],
      [1280, 650],
      [1280, 880],
    ],
    6,
  )
  .marker('var_luna_dl_3000', 200, 320)
  .marker('var_luna_dl_3000', 460, 320)
  .marker('var_luna_dl_3000', 200, 560)
  .marker('var_luna_dl_3000', 460, 560)
  .marker('var_luna_antiglare', 680, 530)
  .marker('var_luna_dl_3000', 200, 700)
  .marker('var_luna_dl_3000', 340, 840)
  .marker('var_luna_dl_3000', 680, 700)
  .marker('var_luna_dl_3000', 860, 840)
  .marker('var_luna_antiglare', 500, 690)
  .marker('var_luna_spot_white', 880, 160)
  .marker('var_luna_spot_white', 880, 560)
  .note(100, 950, 'Family area cove: loop around the ceiling recess.')
  .build();

// Attic rooms: Roof Terrace 100–700 × 100–900 · Attic Lounge 700–1300 × 100–540 · Store 860–1300 × 540–900

const limAtticLighting = new DocBuilder('lim3_lt')
  .strip(
    'var_lumi_cove_3000',
    [
      [720, 120],
      [1280, 120],
    ],
    4,
  )
  .marker('var_luna_dl_3000', 820, 300)
  .marker('var_luna_dl_3000', 1000, 300)
  .marker('var_luna_dl_3000', 1180, 300)
  .marker('var_luna_dl_3000', 1000, 460)
  .marker('var_lumi_surface_round', 250, 250)
  .marker('var_lumi_surface_round', 550, 250)
  .marker('var_lumi_surface_round', 400, 700)
  .marker('var_luna_antiglare', 780, 650)
  .marker('var_lumi_surface_square', 1080, 720)
  .marker('var_luna_spot_black', 1260, 160)
  .build();

// --- Marina One Showflat (condo) --------------------------------------------------------------
// Rooms: Living 100–800 × 220–660 · Kitchen 100–500 × 660–900 · Foyer 500–800 × 660–900
// Master 800–1300 × 100–500 · Bedroom 2 800–1100 × 500–900

const marinaSmartHome = new DocBuilder('mar_sh')
  .marker('var_lenovo_lock_pro', 650, 912, { label: 'Entrance' })
  .marker('var_door_sensor', 600, 884)
  .marker('var_nova_s8', 540, 700)
  .marker('var_filo_3g', 760, 700)
  .marker('var_filo_2g', 130, 680)
  .marker('var_filo_2g', 830, 300)
  .marker('var_filo_1g', 830, 700)
  .marker('var_curtain_double', 450, 236, { label: 'Balcony' })
  .marker('var_curtain_single', 1276, 300, { rotation: 90 })
  .marker('var_ir_aircon', 760, 250)
  .marker('var_ir_aircon', 1260, 130)
  .marker('var_ir_aircon', 1070, 530)
  .marker('var_gateway', 160, 300)
  .marker('var_reyee_router', 220, 300)
  .marker('var_indoor_cam', 120, 240)
  .marker('var_motion_sensor', 650, 780)
  .marker('var_smart_plug', 180, 600)
  .marker('var_doorbell', 720, 884)
  .build();

// --- entities ---------------------------------------------------------------------------------

export const SAMPLE_LEVELS: Level[] = [
  {
    id: 'lvl_tan_1',
    projectId: 'proj_sample_tan',
    name: 'Level 1',
    sortOrder: 1,
    paperSize: 'A3',
    orientation: 'landscape',
  },
  {
    id: 'lvl_lim_1',
    projectId: 'proj_sample_lim',
    name: 'Level 1',
    sortOrder: 1,
    paperSize: 'A3',
    orientation: 'landscape',
  },
  {
    id: 'lvl_lim_2',
    projectId: 'proj_sample_lim',
    name: 'Level 2',
    sortOrder: 2,
    paperSize: 'A3',
    orientation: 'landscape',
  },
  {
    id: 'lvl_lim_3',
    projectId: 'proj_sample_lim',
    name: 'Attic',
    sortOrder: 3,
    paperSize: 'A4',
    orientation: 'portrait',
  },
  {
    id: 'lvl_mar_1',
    projectId: 'proj_sample_marina',
    name: 'Level 1',
    sortOrder: 1,
    paperSize: 'A4',
    orientation: 'landscape',
  },
];

export const SAMPLE_SOURCE_FILES: SourceFile[] = [
  {
    id: 'src_tan_pdf',
    projectId: 'proj_sample_tan',
    fileId: 'file_sample_plan_hdb',
    name: 'Tan_Tampines_4room_FloorPlan.pdf',
    kind: 'pdf',
    pageCount: 1,
    sortOrder: 1,
    createdAt: '2026-09-14T03:05:00.000Z',
  },
  {
    id: 'src_lim_pdf',
    projectId: 'proj_sample_lim',
    fileId: 'file_sample_plan_landed_l1',
    name: 'Lim_ChartwellDr_Drawings.pdf',
    kind: 'pdf',
    pageCount: 3,
    sortOrder: 1,
    createdAt: '2026-09-26T07:40:00.000Z',
  },
  {
    id: 'src_mar_png',
    projectId: 'proj_sample_marina',
    fileId: 'file_sample_plan_condo',
    name: 'MarinaOne_TypeB2.png',
    kind: 'image',
    pageCount: 1,
    sortOrder: 1,
    createdAt: '2026-08-03T01:20:00.000Z',
  },
];

export const SAMPLE_SOURCE_PAGES: SourcePage[] = [
  {
    id: 'page_tan_1',
    projectId: 'proj_sample_tan',
    sourceFileId: 'src_tan_pdf',
    pageIndex: 0,
    fileId: 'file_sample_plan_hdb',
    thumbnailFileId: 'file_sample_plan_hdb',
    ...BG,
  },
  {
    id: 'page_lim_1',
    projectId: 'proj_sample_lim',
    sourceFileId: 'src_lim_pdf',
    pageIndex: 0,
    fileId: 'file_sample_plan_landed_l1',
    thumbnailFileId: 'file_sample_plan_landed_l1',
    ...BG,
  },
  {
    id: 'page_lim_2',
    projectId: 'proj_sample_lim',
    sourceFileId: 'src_lim_pdf',
    pageIndex: 1,
    fileId: 'file_sample_plan_landed_l2',
    thumbnailFileId: 'file_sample_plan_landed_l2',
    ...BG,
  },
  {
    id: 'page_lim_3',
    projectId: 'proj_sample_lim',
    sourceFileId: 'src_lim_pdf',
    pageIndex: 2,
    fileId: 'file_sample_plan_landed_attic',
    thumbnailFileId: 'file_sample_plan_landed_attic',
    ...BG,
  },
  {
    id: 'page_mar_1',
    projectId: 'proj_sample_marina',
    sourceFileId: 'src_mar_png',
    pageIndex: 0,
    fileId: 'file_sample_plan_condo',
    thumbnailFileId: 'file_sample_plan_condo',
    ...BG,
  },
];

const plan = (
  id: string,
  projectId: string,
  levelId: string,
  type: PlanType,
  pageId: string,
  fileId: string,
  document: PlanDocument,
  updatedAt: string,
): Plan => ({
  id,
  projectId,
  levelId,
  type,
  background: {
    sourcePageId: pageId,
    rotation: 0,
    crop: { x: 0, y: 0, w: 1, h: 1 },
    fileId,
    ...BG,
  },
  document,
  revision: 1,
  updatedAt,
});

export const SAMPLE_PLANS: Plan[] = [
  plan(
    'plan_tan_1_sh',
    'proj_sample_tan',
    'lvl_tan_1',
    'smart-home',
    'page_tan_1',
    'file_sample_plan_hdb',
    tanSmartHome,
    '2026-09-29T08:42:00.000Z',
  ),
  plan(
    'plan_tan_1_lt',
    'proj_sample_tan',
    'lvl_tan_1',
    'lighting',
    'page_tan_1',
    'file_sample_plan_hdb',
    tanLighting,
    '2026-09-29T08:42:00.000Z',
  ),
  plan(
    'plan_lim_1_sh',
    'proj_sample_lim',
    'lvl_lim_1',
    'smart-home',
    'page_lim_1',
    'file_sample_plan_landed_l1',
    limL1SmartHome,
    '2026-09-30T01:15:00.000Z',
  ),
  plan(
    'plan_lim_1_lt',
    'proj_sample_lim',
    'lvl_lim_1',
    'lighting',
    'page_lim_1',
    'file_sample_plan_landed_l1',
    limL1Lighting,
    '2026-09-30T01:15:00.000Z',
  ),
  plan(
    'plan_lim_2_sh',
    'proj_sample_lim',
    'lvl_lim_2',
    'smart-home',
    'page_lim_2',
    'file_sample_plan_landed_l2',
    limL2SmartHome,
    '2026-09-30T01:15:00.000Z',
  ),
  plan(
    'plan_lim_2_lt',
    'proj_sample_lim',
    'lvl_lim_2',
    'lighting',
    'page_lim_2',
    'file_sample_plan_landed_l2',
    limL2Lighting,
    '2026-09-30T01:15:00.000Z',
  ),
  plan(
    'plan_lim_3_lt',
    'proj_sample_lim',
    'lvl_lim_3',
    'lighting',
    'page_lim_3',
    'file_sample_plan_landed_attic',
    limAtticLighting,
    '2026-09-30T01:15:00.000Z',
  ),
  plan(
    'plan_mar_1_sh',
    'proj_sample_marina',
    'lvl_mar_1',
    'smart-home',
    'page_mar_1',
    'file_sample_plan_condo',
    marinaSmartHome,
    '2026-08-21T03:05:00.000Z',
  ),
];

/** Snapshot of every variant a set of documents uses (plus the auto-added drivers when relevant). */
export function buildSnapshot(
  documents: PlanDocument[],
  capturedAt = SNAPSHOT_AT,
): Record<string, VariantSnapshot> {
  const ids = new Set<string>();
  for (const doc of documents) {
    for (const el of doc.elements) {
      if (el.kind === 'note') continue;
      ids.add(el.variantId);
      if (el.kind === 'led-strip') ids.add(SYSTEM_VARIANT_IDS.smartLedDriver);
      if (el.kind === 'track') ids.add(SYSTEM_VARIANT_IDS.trackDriver);
    }
  }
  const snapshot: Record<string, VariantSnapshot> = {};
  for (const variantId of ids) {
    const variant = sampleVariant(variantId);
    const product = variant ? sampleProduct(variant.productId) : undefined;
    if (!variant || !product) continue;
    snapshot[variantId] = {
      variantId,
      productId: product.id,
      categoryId: product.categoryId,
      productName: product.name,
      variantName: variant.name,
      description: variant.description,
      imageFileId: variant.imageFileId,
      capturedAt,
    };
  }
  return snapshot;
}

const documentsOf = (projectId: string): PlanDocument[] =>
  SAMPLE_PLANS.filter((p) => p.projectId === projectId).map((p) => p.document);

const adjustment = (
  quantity: number,
  calculatedAtAdjustment: number,
  adjustedAt: string,
): QuantityAdjustment => ({
  quantity,
  calculatedAtAdjustment,
  adjustedAt,
});

export const SAMPLE_PROJECTS: Project[] = [
  {
    id: 'proj_sample_tan',
    title: 'Tan Residence — Tampines 4-room',
    customerName: 'Mr & Mrs Tan',
    customerContact: '+65 9123 4567',
    propertyAddress: 'Blk 452 Tampines Street 42, #08-123',
    propertyType: 'HDB',
    status: 'in-progress',
    createdAt: '2026-09-14T03:05:00.000Z',
    updatedAt: '2026-09-29T08:42:00.000Z',
    lastOpened: { levelId: 'lvl_tan_1', planType: 'lighting' },
    thumbnailFileId: 'file_sample_plan_hdb',
    catalogueSnapshot: buildSnapshot(documentsOf('proj_sample_tan')),
    quantityAdjustments: {
      // Spare switch requested by the customer; calculated figure unchanged since.
      'variant:var_nova_pro_2g_black': adjustment(4, 3, '2026-09-28T06:10:00.000Z'),
      // Metres were rounded up on site before the plan was revised → warning on the review screen.
      'variant:var_lumi_cove_3000': adjustment(5, 4, '2026-09-27T09:30:00.000Z'),
    },
    exportSettings: defaultExportSettings(['lvl_tan_1']),
    recentVariantIds: [
      'var_luna_spot_black',
      'var_dining_pendant',
      'var_luna_dl_3000',
      'var_lumi_cove_4000',
      'var_nova_pro_2g_black',
    ],
  },
  {
    id: 'proj_sample_lim',
    title: 'Lim Family Home — Serangoon Gardens',
    customerName: 'Lim Wei Jie',
    customerContact: '+65 8765 4321',
    propertyAddress: '23 Chartwell Drive, Singapore 558768',
    propertyType: 'Landed',
    status: 'draft',
    createdAt: '2026-09-26T07:40:00.000Z',
    updatedAt: '2026-09-30T01:15:00.000Z',
    lastOpened: { levelId: 'lvl_lim_2', planType: 'smart-home' },
    thumbnailFileId: 'file_sample_plan_landed_l1',
    catalogueSnapshot: buildSnapshot(documentsOf('proj_sample_lim'), '2026-09-26T07:55:00.000Z'),
    quantityAdjustments: {},
    exportSettings: defaultExportSettings(['lvl_lim_1', 'lvl_lim_2', 'lvl_lim_3']),
    recentVariantIds: [
      'var_lusano_2g',
      'var_ir_aircon',
      'var_luna_spot_white',
      'var_lumi_cove_3000',
    ],
  },
  {
    id: 'proj_sample_marina',
    title: 'Marina One Showflat',
    customerName: 'Marina One Sales Gallery',
    customerContact: '+65 6123 4567',
    propertyAddress: '21 Marina Way, Singapore 018978',
    propertyType: 'Condo',
    status: 'completed',
    createdAt: '2026-08-03T01:20:00.000Z',
    updatedAt: '2026-08-21T03:05:00.000Z',
    lastOpened: { levelId: 'lvl_mar_1', planType: 'smart-home' },
    thumbnailFileId: 'file_sample_plan_condo',
    catalogueSnapshot: buildSnapshot(documentsOf('proj_sample_marina'), '2026-08-03T01:30:00.000Z'),
    quantityAdjustments: {},
    exportSettings: defaultExportSettings(['lvl_mar_1']),
    recentVariantIds: ['var_filo_2g', 'var_filo_3g', 'var_nova_s8'],
  },
];

/** Resolver for totals/scenes: the project's snapshot first, then the live sample catalogue. */
export function sampleResolver(
  project: Project,
): (variantId: string) => VariantSnapshot | undefined {
  return (variantId) => {
    const snap = project.catalogueSnapshot[variantId];
    if (snap) return snap;
    const variant = sampleVariant(variantId);
    const product = variant ? sampleProduct(variant.productId) : undefined;
    if (!variant || !product) return undefined;
    return {
      variantId,
      productId: product.id,
      categoryId: product.categoryId,
      productName: product.name,
      variantName: variant.name,
      description: variant.description,
      imageFileId: variant.imageFileId,
      capturedAt: SNAPSHOT_AT,
    };
  };
}
