import type { FileRecord } from '../types.ts';

const T0 = '2026-08-01T02:00:00.000Z';

interface SampleFile extends FileRecord {
  url: string;
}

const svg = (id: string, kind: FileRecord['kind'], url: string, width: number, height: number): SampleFile => ({
  id,
  kind,
  mime: 'image/svg+xml',
  width,
  height,
  bytes: 0,
  originalName: null,
  createdAt: T0,
  url,
});

const PRODUCT_IMAGES = [
  'switch-1gang', 'switch-2gang', 'switch-3gang', 'switch-4gang', 'switch-prestige', 'panel', 'curtain',
  'aircon', 'gateway', 'sensor', 'camera', 'router', 'lock', 'downlight', 'surface', 'track', 'magnetic',
  'strip', 'pendant', 'spotlight', 'driver', 'plug', 'dimmer',
];

const FILES: SampleFile[] = [
  svg('file_sample_logo', 'logo', '/sample/maxsen-logo.svg', 360, 96),
  svg('file_sample_plan_hdb', 'page', '/sample/floorplan-hdb-4room.svg', 1400, 1000),
  svg('file_sample_plan_condo', 'page', '/sample/floorplan-condo-2bed.svg', 1400, 1000),
  svg('file_sample_plan_landed_l1', 'page', '/sample/floorplan-landed-l1.svg', 1400, 1000),
  svg('file_sample_plan_landed_l2', 'page', '/sample/floorplan-landed-l2.svg', 1400, 1000),
  svg('file_sample_plan_landed_attic', 'page', '/sample/floorplan-landed-attic.svg', 1400, 1000),
  ...PRODUCT_IMAGES.map((n) => svg(`file_sample_img_${n}`, 'product-image', `/sample/product/product-${n}.svg`, 240, 240)),
];

export const SAMPLE_FILES: FileRecord[] = FILES.map(({ url: _url, ...record }) => record);

const URL_BY_ID = new Map(FILES.map((f) => [f.id, f.url]));

/** Maps a sample file id to the static asset served from `apps/web/public`. */
export function sampleFileUrl(fileId: string): string {
  const url = URL_BY_ID.get(fileId);
  if (!url) throw new Error(`Unknown sample file: ${fileId}`);
  return url;
}
