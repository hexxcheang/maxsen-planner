import type { IconShape } from './icons.ts';

export type PlanType = 'smart-home' | 'lighting';

/** How elements of a category are drawn and counted. */
export type ElementKind = 'point' | 'led-strip' | 'track';

export type CategoryId =
  | 'smart-switches'
  | 'control-panels'
  | 'curtains-blinds'
  | 'aircon-controllers'
  | 'gateways'
  | 'sensors'
  | 'cameras'
  | 'network-devices'
  | 'smart-locks'
  | 'misc-smart-home'
  | 'downlights'
  | 'surface-lights'
  | 'track-lights'
  | 'led-strips'
  | 'magnetic-track-lights'
  | 'pendant-lights'
  | 'spotlights'
  | 'misc-lighting';

export type BadgeStyle = 'filled' | 'outline';

export interface CategoryDefaults {
  /** Hex colour used for the icon. */
  color: string;
  /** Short badge text (1–3 characters) drawn on or beside the icon. */
  badge: string;
  badgeStyle: BadgeStyle;
  /** Icon size in plan units (background width = 1000 units). */
  size: number;
}

export interface CategoryDef {
  id: CategoryId;
  planType: PlanType;
  name: string;
  /** Fixed display order (1-based) shared by the library, legend, Excel and product PDF. */
  order: number;
  kind: ElementKind;
  /** Fixed icon silhouette; not configurable in Phase 1. */
  shape: IconShape;
  defaults: CategoryDefaults;
}

/** Default icon size in plan units for every point category. */
export const DEFAULT_ICON_SIZE = 20;

const def = (
  id: CategoryId,
  planType: PlanType,
  name: string,
  kind: ElementKind,
  shape: IconShape,
  color: string,
  badge: string,
): Omit<CategoryDef, 'order'> => ({
  id,
  planType,
  name,
  kind,
  shape,
  defaults: { color, badge, badgeStyle: 'filled', size: DEFAULT_ICON_SIZE },
});

const ORDERED: Omit<CategoryDef, 'order'>[] = [
  // Smart Home Plan categories (product spec §8.1)
  def('smart-switches', 'smart-home', 'Smart Switches', 'point', 'square', '#2F5FB3', 'SW'),
  def('control-panels', 'smart-home', 'Control Panels', 'point', 'panel', '#5B3FA6', 'CP'),
  def('curtains-blinds', 'smart-home', 'Curtains / Blinds', 'point', 'pill', '#1D8F7A', 'CB'),
  def(
    'aircon-controllers',
    'smart-home',
    'Aircon Controllers',
    'point',
    'hexagon',
    '#2498B9',
    'AC',
  ),
  def('gateways', 'smart-home', 'Gateways', 'point', 'diamond', '#7A4E9E', 'GW'),
  def('sensors', 'smart-home', 'Sensors', 'point', 'target', '#C2651B', 'SE'),
  def('cameras', 'smart-home', 'Cameras', 'point', 'dome', '#B4323A', 'CA'),
  def('network-devices', 'smart-home', 'Network Devices', 'point', 'triangle', '#3C7A3C', 'NW'),
  def('smart-locks', 'smart-home', 'Smart Locks', 'point', 'arch', '#8C6D1F', 'LK'),
  def(
    'misc-smart-home',
    'smart-home',
    'Miscellaneous Smart Home Accessories',
    'point',
    'dot',
    '#6B6B6B',
    'AX',
  ),
  // Lighting Plan categories (product spec §8.2)
  def('downlights', 'lighting', 'Downlights', 'point', 'circle', '#D28A00', 'DL'),
  def('surface-lights', 'lighting', 'Surface Lights', 'point', 'roundedSquare', '#B8551F', 'SL'),
  def('track-lights', 'lighting', 'Track Lights', 'track', 'track', '#2C2C2C', 'TR'),
  def('led-strips', 'lighting', 'LED Strips', 'led-strip', 'strip', '#C99700', 'LED'),
  def(
    'magnetic-track-lights',
    'lighting',
    'Magnetic Track Lights',
    'track',
    'magnetic',
    '#1E6B8C',
    'MT',
  ),
  def('pendant-lights', 'lighting', 'Pendant Lights', 'point', 'drop', '#A33B86', 'PD'),
  def('spotlights', 'lighting', 'Spotlights', 'point', 'star4', '#C7462C', 'SP'),
  def(
    'misc-lighting',
    'lighting',
    'Miscellaneous Lighting Accessories',
    'point',
    'smallHexagon',
    '#7D7A72',
    'LX',
  ),
];

/** All categories in the fixed order required by the product specification. */
export const CATEGORIES: readonly CategoryDef[] = ORDERED.map((c, i) => ({ ...c, order: i + 1 }));

const BY_ID = new Map<CategoryId, CategoryDef>(CATEGORIES.map((c) => [c.id, c]));

export function categoryById(id: CategoryId): CategoryDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown category: ${String(id)}`);
  return found;
}

export function isCategoryId(value: string): value is CategoryId {
  return BY_ID.has(value as CategoryId);
}

export function categoriesForPlan(planType: PlanType): CategoryDef[] {
  return CATEGORIES.filter((c) => c.planType === planType);
}

/** Catalogue ids of the two auto-added accessories (product spec §9.3). */
export const SYSTEM_PRODUCT_IDS = {
  smartLedDriver: 'prod_sys_smart_led_driver',
  trackDriver: 'prod_sys_track_driver',
} as const;

export const SYSTEM_VARIANT_IDS = {
  smartLedDriver: 'var_sys_smart_led_driver',
  trackDriver: 'var_sys_track_driver',
} as const;

/** The category the system drivers are filed under in totals and Excel. */
export const SYSTEM_DRIVER_CATEGORY: CategoryId = 'misc-lighting';
