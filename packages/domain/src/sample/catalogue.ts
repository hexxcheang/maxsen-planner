/**
 * Realistic Maxsen sample catalogue (names and descriptions only — no prices, per Phase 1 scope).
 * Product lines mirror Maxsen's real ranges: Ark / Nova+ Pro / Lusano+ Prestige / Filo switches,
 * Nova control panels, Luna lighting, Lumi LED strips, Reyee networking and Lenovo locks.
 */
import { SYSTEM_PRODUCT_IDS, SYSTEM_VARIANT_IDS, type CategoryId } from '../categories.ts';
import type { Product, Variant } from '../types.ts';

const T0 = '2026-08-01T02:00:00.000Z';

type VariantSpec = [id: string, name: string, description: string, imageFileId?: string];

interface ProductSpec {
  id: string;
  categoryId: CategoryId;
  name: string;
  variants: VariantSpec[];
  hidden?: boolean;
  system?: boolean;
}

const IMG = (name: string): string => `file_sample_img_${name}`;

const SPECS: ProductSpec[] = [
  // --- Smart Switches ---------------------------------------------------------------------
  {
    id: 'prod_ark',
    categoryId: 'smart-switches',
    name: 'Ark Series',
    variants: [
      [
        'var_ark_1g',
        '1-gang',
        'Entry-level smart switch with a single tempered-glass touch panel and app or voice control.',
        IMG('switch-1gang'),
      ],
      [
        'var_ark_2g',
        '2-gang',
        'Two-circuit smart switch with tempered-glass touch panel, scheduling and voice control.',
        IMG('switch-2gang'),
      ],
      [
        'var_ark_3g',
        '3-gang',
        'Three-circuit smart switch with tempered-glass touch panel for living and dining areas.',
        IMG('switch-3gang'),
      ],
      [
        'var_ark_4g',
        '4-gang',
        'Four-circuit smart switch for larger rooms with multiple lighting circuits.',
        IMG('switch-4gang'),
      ],
    ],
  },
  {
    id: 'prod_nova_pro',
    categoryId: 'smart-switches',
    name: 'Nova+ Pro',
    variants: [
      [
        'var_nova_pro_1g_black',
        '1-gang, Black',
        'Metal-framed premium smart switch with soft-touch keys and Zigbee mesh reliability.',
        IMG('switch-1gang'),
      ],
      [
        'var_nova_pro_2g_black',
        '2-gang, Black',
        'Two-circuit metal-framed smart switch with soft-touch keys and scene shortcuts.',
        IMG('switch-2gang'),
      ],
      [
        'var_nova_pro_3g_black',
        '3-gang, Black',
        'Three-circuit metal-framed smart switch with soft-touch keys and scene shortcuts.',
        IMG('switch-3gang'),
      ],
      [
        'var_nova_pro_4g_black',
        '4-gang, Black',
        'Four-circuit metal-framed smart switch for rooms with many lighting circuits.',
        IMG('switch-4gang'),
      ],
      [
        'var_nova_pro_1g_champagne',
        '1-gang, Champagne',
        'Metal-framed premium smart switch in a warm champagne finish.',
        IMG('switch-1gang'),
      ],
      [
        'var_nova_pro_2g_champagne',
        '2-gang, Champagne',
        'Two-circuit metal-framed smart switch in a warm champagne finish.',
        IMG('switch-2gang'),
      ],
    ],
  },
  {
    id: 'prod_lusano',
    categoryId: 'smart-switches',
    name: 'Lusano+ Prestige',
    variants: [
      [
        'var_lusano_1g',
        '1-gang',
        'Flagship smart switch with crystal-inlaid keys and a brushed metal frame.',
        IMG('switch-prestige'),
      ],
      [
        'var_lusano_2g',
        '2-gang',
        'Two-circuit flagship smart switch with crystal-inlaid keys and a brushed metal frame.',
        IMG('switch-prestige'),
      ],
      [
        'var_lusano_3g',
        '3-gang',
        'Three-circuit flagship smart switch with crystal-inlaid keys and a brushed metal frame.',
        IMG('switch-prestige'),
      ],
    ],
  },
  {
    id: 'prod_filo',
    categoryId: 'smart-switches',
    name: 'Filo Ultra Slim',
    variants: [
      [
        'var_filo_1g',
        '1-gang',
        'Ultra-slim smart switch that sits almost flush with the wall for minimalist interiors.',
        IMG('switch-1gang'),
      ],
      [
        'var_filo_2g',
        '2-gang',
        'Ultra-slim two-circuit smart switch for minimalist interiors.',
        IMG('switch-2gang'),
      ],
      [
        'var_filo_3g',
        '3-gang',
        'Ultra-slim three-circuit smart switch for minimalist interiors.',
        IMG('switch-3gang'),
      ],
    ],
  },
  // --- Control Panels ---------------------------------------------------------------------
  {
    id: 'prod_nova_s1',
    categoryId: 'control-panels',
    name: 'Nova S1',
    variants: [
      [
        'var_nova_s1',
        'Standard',
        'Compact 4-inch wall panel for scenes, lighting and curtain control in one room.',
        IMG('panel'),
      ],
    ],
  },
  {
    id: 'prod_nova_s8',
    categoryId: 'control-panels',
    name: 'Nova S8',
    variants: [
      [
        'var_nova_s8',
        'Standard',
        '8-inch central control panel for whole-home scenes, aircon, curtains and lighting.',
        IMG('panel'),
      ],
    ],
  },
  {
    id: 'prod_nova_s10',
    categoryId: 'control-panels',
    name: 'Nova S10',
    variants: [
      [
        'var_nova_s10',
        'Standard',
        '10-inch central control panel with intercom and whole-home scene control.',
        IMG('panel'),
      ],
    ],
  },
  // --- Curtains / Blinds ------------------------------------------------------------------
  {
    id: 'prod_curtain_track',
    categoryId: 'curtains-blinds',
    name: 'Smart Curtain Track',
    variants: [
      [
        'var_curtain_single',
        'Single',
        'Motorised curtain track for one curtain layer, cut to length on site.',
        IMG('curtain'),
      ],
      [
        'var_curtain_double',
        'Double',
        'Motorised double track for day and night curtain layers, cut to length on site.',
        IMG('curtain'),
      ],
    ],
  },
  {
    id: 'prod_roller_blind',
    categoryId: 'curtains-blinds',
    name: 'Smart Roller Blind Motor',
    variants: [
      [
        'var_roller_motor',
        'Standard',
        'Quiet tubular motor for roller blinds with app, voice and schedule control.',
        IMG('curtain'),
      ],
    ],
  },
  // --- Aircon Controllers -----------------------------------------------------------------
  {
    id: 'prod_ir_aircon',
    categoryId: 'aircon-controllers',
    name: 'IR Aircon Controller',
    variants: [
      [
        'var_ir_aircon',
        'Standard',
        'Infrared controller that brings any split aircon into the app with schedules and scenes.',
        IMG('aircon'),
      ],
    ],
  },
  // --- Gateways ----------------------------------------------------------------------------
  {
    id: 'prod_gateway',
    categoryId: 'gateways',
    name: 'Zigbee Gateway',
    variants: [
      [
        'var_gateway',
        'Standard',
        'Central Zigbee hub that links every switch, sensor and curtain into one reliable mesh.',
        IMG('gateway'),
      ],
    ],
  },
  // --- Sensors -----------------------------------------------------------------------------
  {
    id: 'prod_door_sensor',
    categoryId: 'sensors',
    name: 'Door/Window Sensor',
    variants: [
      [
        'var_door_sensor',
        'Standard',
        'Magnetic contact sensor that triggers lighting and alerts when a door or window opens.',
        IMG('sensor'),
      ],
    ],
  },
  {
    id: 'prod_motion_sensor',
    categoryId: 'sensors',
    name: 'Motion Sensor',
    variants: [
      [
        'var_motion_sensor',
        'Standard',
        'Ceiling or wall motion sensor for hands-free lighting in corridors and bathrooms.',
        IMG('sensor'),
      ],
    ],
  },
  {
    id: 'prod_temp_sensor',
    categoryId: 'sensors',
    name: 'Temperature & Humidity Sensor',
    variants: [
      [
        'var_temp_sensor',
        'Standard',
        'Room climate sensor that lets aircon and fans respond automatically.',
        IMG('sensor'),
      ],
    ],
  },
  // --- Cameras -----------------------------------------------------------------------------
  {
    id: 'prod_indoor_cam',
    categoryId: 'cameras',
    name: 'Indoor Camera',
    variants: [
      [
        'var_indoor_cam',
        'Standard',
        'Compact indoor camera with night vision, two-way audio and privacy mode.',
        IMG('camera'),
      ],
    ],
  },
  {
    id: 'prod_outdoor_cam',
    categoryId: 'cameras',
    name: 'Outdoor Camera',
    variants: [
      [
        'var_outdoor_cam',
        'Standard',
        'Weatherproof outdoor camera with motion alerts and night vision.',
        IMG('camera'),
      ],
    ],
  },
  // --- Network Devices ---------------------------------------------------------------------
  {
    id: 'prod_reyee_router',
    categoryId: 'network-devices',
    name: 'Reyee Wi-Fi 7 Router',
    variants: [
      [
        'var_reyee_router',
        'Standard',
        'Wi-Fi 7 router sized for whole-home coverage with dedicated smart-home traffic handling.',
        IMG('router'),
      ],
    ],
  },
  {
    id: 'prod_reyee_mesh',
    categoryId: 'network-devices',
    name: 'Reyee Mesh Node',
    variants: [
      [
        'var_reyee_mesh',
        'Standard',
        'Mesh node that extends Wi-Fi 7 coverage to bedrooms, attics and yards.',
        IMG('router'),
      ],
    ],
  },
  // --- Smart Locks -------------------------------------------------------------------------
  {
    id: 'prod_lenovo_lock',
    categoryId: 'smart-locks',
    name: 'Lenovo Smart Lock',
    variants: [
      [
        'var_lenovo_lock_std',
        'Standard',
        'Digital lock with fingerprint, PIN, card and app access, supplied through MyDigitalLock.',
        IMG('lock'),
      ],
      [
        'var_lenovo_lock_pro',
        'Pro',
        'Digital lock with face recognition, fingerprint, PIN and app access, supplied through MyDigitalLock.',
        IMG('lock'),
      ],
    ],
  },
  // --- Misc Smart Home ---------------------------------------------------------------------
  {
    id: 'prod_smart_plug',
    categoryId: 'misc-smart-home',
    name: 'Smart Plug',
    variants: [
      [
        'var_smart_plug',
        'Standard',
        'Smart plug with energy monitoring for lamps, fans and appliances.',
        IMG('plug'),
      ],
    ],
  },
  {
    id: 'prod_doorbell',
    categoryId: 'misc-smart-home',
    name: 'Smart Doorbell',
    variants: [
      [
        'var_doorbell',
        'Standard',
        'Video doorbell with two-way talk and app notifications.',
        IMG('camera'),
      ],
    ],
  },
  // --- Downlights --------------------------------------------------------------------------
  {
    id: 'prod_luna_downlight',
    categoryId: 'downlights',
    name: 'Luna Downlight',
    variants: [
      [
        'var_luna_dl_3000',
        '3000K',
        'Recessed downlight in warm white (3000K) for living areas and bedrooms.',
        IMG('downlight'),
      ],
      [
        'var_luna_dl_4000',
        '4000K',
        'Recessed downlight in neutral white (4000K) for kitchens and work areas.',
        IMG('downlight'),
      ],
    ],
  },
  {
    id: 'prod_luna_antiglare',
    categoryId: 'downlights',
    name: 'Luna Anti-glare Downlight',
    variants: [
      [
        'var_luna_antiglare',
        'Standard',
        'Deep-recessed anti-glare downlight for bathrooms and corridors.',
        IMG('downlight'),
      ],
    ],
  },
  // --- Surface Lights ----------------------------------------------------------------------
  {
    id: 'prod_lumi_surface',
    categoryId: 'surface-lights',
    name: 'Lumi Surface Light',
    variants: [
      [
        'var_lumi_surface_round',
        'Round',
        'Slim surface-mounted round light for yards, shelters and false-ceiling-free areas.',
        IMG('surface'),
      ],
      [
        'var_lumi_surface_square',
        'Square',
        'Slim surface-mounted square light for yards, shelters and false-ceiling-free areas.',
        IMG('surface'),
      ],
    ],
  },
  // --- Track Lights ------------------------------------------------------------------------
  {
    id: 'prod_luna_track',
    categoryId: 'track-lights',
    name: 'Luna Track',
    variants: [
      [
        'var_luna_track_black',
        'Black',
        'Surface track in matte black with adjustable spot heads for feature walls and dining.',
        IMG('track'),
      ],
      [
        'var_luna_track_white',
        'White',
        'Surface track in matte white with adjustable spot heads for feature walls and dining.',
        IMG('track'),
      ],
    ],
  },
  // --- LED Strips --------------------------------------------------------------------------
  {
    id: 'prod_lumi_cove',
    categoryId: 'led-strips',
    name: 'Lumi Cove Strip',
    variants: [
      [
        'var_lumi_cove_3000',
        '3000K',
        'Dimmable cove LED strip in warm white (3000K) for ceiling and cabinet coves.',
        IMG('strip'),
      ],
      [
        'var_lumi_cove_4000',
        '4000K',
        'Dimmable cove LED strip in neutral white (4000K) for ceiling and cabinet coves.',
        IMG('strip'),
      ],
    ],
  },
  {
    id: 'prod_lumi_cob',
    categoryId: 'led-strips',
    name: 'Lumi COB Strip',
    variants: [
      [
        'var_lumi_cob_3000',
        '3000K',
        'Dot-free COB LED strip in warm white (3000K) for exposed profiles and shelves.',
        IMG('strip'),
      ],
    ],
  },
  // --- Magnetic Track Lights ---------------------------------------------------------------
  {
    id: 'prod_luna_magnetic',
    categoryId: 'magnetic-track-lights',
    name: 'Luna Magnetic Track',
    variants: [
      [
        'var_luna_magnetic_black',
        'Black',
        'Low-voltage magnetic track with snap-on spot, flood and linear modules.',
        IMG('magnetic'),
      ],
    ],
  },
  // --- Pendant Lights ----------------------------------------------------------------------
  {
    id: 'prod_dining_pendant',
    categoryId: 'pendant-lights',
    name: 'Dining Pendant',
    variants: [
      [
        'var_dining_pendant',
        'Standard',
        'Dimmable pendant for dining tables and kitchen islands.',
        IMG('pendant'),
      ],
    ],
  },
  // --- Ceiling Fans ------------------------------------------------------------------------
  {
    id: 'prod_breeze_fan',
    categoryId: 'ceiling-fans',
    name: 'Breeze DC Ceiling Fan',
    variants: [
      [
        'var_breeze_fan_46',
        '46" with light',
        'Quiet DC-motor ceiling fan with a dimmable LED light, sized for common bedrooms. Smart remote and app control.',
        IMG('fan'),
      ],
      [
        'var_breeze_fan_52',
        '52" with light',
        'Quiet DC-motor ceiling fan with a dimmable LED light, sized for living rooms and master bedrooms. Smart remote and app control.',
        IMG('fan'),
      ],
    ],
  },
  // --- Spotlights --------------------------------------------------------------------------
  {
    id: 'prod_luna_spot',
    categoryId: 'spotlights',
    name: 'Luna Spotlight',
    variants: [
      [
        'var_luna_spot_black',
        'Black',
        'Adjustable surface spotlight in matte black for artwork and feature walls.',
        IMG('spotlight'),
      ],
      [
        'var_luna_spot_white',
        'White',
        'Adjustable surface spotlight in matte white for artwork and feature walls.',
        IMG('spotlight'),
      ],
    ],
  },
  // --- Misc Lighting -----------------------------------------------------------------------
  {
    id: SYSTEM_PRODUCT_IDS.smartLedDriver,
    categoryId: 'misc-lighting',
    name: 'Smart LED Driver',
    system: true,
    variants: [
      [
        SYSTEM_VARIANT_IDS.smartLedDriver,
        'Standard',
        'Dimmable smart driver added automatically for each continuous LED-strip run.',
        IMG('driver'),
      ],
    ],
  },
  {
    id: SYSTEM_PRODUCT_IDS.trackDriver,
    categoryId: 'misc-lighting',
    name: 'Track Driver',
    system: true,
    variants: [
      [
        SYSTEM_VARIANT_IDS.trackDriver,
        'Standard',
        'Power driver added automatically for each continuous track-light run.',
        IMG('driver'),
      ],
    ],
  },
  {
    id: 'prod_dimmer',
    categoryId: 'misc-lighting',
    name: 'Dimmer Module',
    variants: [
      [
        'var_dimmer',
        'Standard',
        'In-line dimmer module for non-smart downlight circuits.',
        IMG('dimmer'),
      ],
    ],
  },
];

export const SAMPLE_PRODUCTS: Product[] = SPECS.map((s, i) => ({
  id: s.id,
  categoryId: s.categoryId,
  name: s.name,
  hidden: s.hidden ?? false,
  system: s.system ?? false,
  sortOrder: i + 1,
  createdAt: T0,
  updatedAt: T0,
}));

export const SAMPLE_VARIANTS: Variant[] = SPECS.flatMap((s) =>
  s.variants.map(([id, name, description, imageFileId], i): Variant => ({
    id,
    productId: s.id,
    name,
    description,
    imageFileId: imageFileId ?? null,
    hidden: false,
    sortOrder: i + 1,
    createdAt: T0,
    updatedAt: T0,
  })),
);

const PRODUCT_BY_ID = new Map(SAMPLE_PRODUCTS.map((p) => [p.id, p]));
const VARIANT_BY_ID = new Map(SAMPLE_VARIANTS.map((v) => [v.id, v]));

export const sampleProduct = (id: string): Product | undefined => PRODUCT_BY_ID.get(id);
export const sampleVariant = (id: string): Variant | undefined => VARIANT_BY_ID.get(id);
