import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SYSTEM_VARIANT_IDS } from '../src/categories.ts';
import { createEmptyPlanDocument } from '../src/plan-document.ts';
import { applyAdjustments, setAdjustment } from '../src/totals/adjustments.ts';
import { computeTotals, type TotalLine, type VariantResolver } from '../src/totals/compute-totals.ts';
import { compareLines } from '../src/totals/sort.ts';
import type {
  CategoryId,
  LedStripPath,
  PlanDocument,
  PlanElement,
  PointMarker,
  QuantityAdjustment,
  TrackPath,
  VariantSnapshot,
} from '../src/types.ts';

// --- fixtures -------------------------------------------------------------------------------

const snap = (
  variantId: string,
  categoryId: CategoryId,
  productName: string,
  variantName: string,
): VariantSnapshot => ({
  variantId,
  productId: `prod_${productName}`,
  categoryId,
  productName,
  variantName,
  description: '',
  imageFileId: null,
  capturedAt: '2026-10-01T00:00:00.000Z',
});

const SNAPSHOTS: Record<string, VariantSnapshot> = {
  sw1: snap('sw1', 'smart-switches', 'Ark Series', '1-gang'),
  sw2: snap('sw2', 'smart-switches', 'Ark Series', '2-gang'),
  cp1: snap('cp1', 'control-panels', 'Nova S8', 'Standard'),
  dl1: snap('dl1', 'downlights', 'Luna Downlight', '3000K'),
  led1: snap('led1', 'led-strips', 'Lumi Cove Strip', '3000K'),
  led2: snap('led2', 'led-strips', 'Lumi Cove Strip', '4000K'),
  tr1: snap('tr1', 'track-lights', 'Luna Track', 'Black'),
  mt1: snap('mt1', 'magnetic-track-lights', 'Luna Magnetic Track', 'Black'),
  [SYSTEM_VARIANT_IDS.smartLedDriver]: snap(
    SYSTEM_VARIANT_IDS.smartLedDriver,
    'misc-lighting',
    'Smart LED Driver',
    'Standard',
  ),
  [SYSTEM_VARIANT_IDS.trackDriver]: snap(
    SYSTEM_VARIANT_IDS.trackDriver,
    'misc-lighting',
    'Track Driver',
    'Standard',
  ),
};

const resolve: VariantResolver = (id) => SNAPSHOTS[id];

let n = 0;
const marker = (variantId: string): PointMarker => ({
  kind: 'marker',
  id: `m${++n}`,
  z: n,
  variantId,
  x: 10 * n,
  y: 10,
  rotation: 0,
  label: '',
});
const led = (variantId: string, metres: number | null): LedStripPath => ({
  kind: 'led-strip',
  id: `l${++n}`,
  z: n,
  variantId,
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
  closed: false,
  smooth: false,
  metres,
  showLabel: true,
});
const track = (variantId: string, headCount: number): TrackPath => ({
  kind: 'track',
  id: `t${++n}`,
  z: n,
  variantId,
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ],
  headCount,
  showLabel: true,
});
const doc = (elements: PlanElement[], hidden: CategoryId[] = []): PlanDocument => ({
  ...createEmptyPlanDocument(),
  elements,
  view: { hiddenCategories: hidden, legendVisible: true },
});

const line = (lines: TotalLine[], variantId: string): TotalLine => {
  const found = lines.find((l) => l.variantId === variantId);
  assert.ok(found, `line for ${variantId}`);
  return found;
};

// --- computeTotals --------------------------------------------------------------------------

describe('computeTotals', () => {
  it('point markers count one per marker and consolidate the same variant across two documents', () => {
    const lines = computeTotals(
      [doc([marker('sw1'), marker('sw1'), marker('cp1')]), doc([marker('sw1')])],
      resolve,
    );
    assert.equal(line(lines, 'sw1').calculated, 3);
    assert.equal(line(lines, 'sw1').unit, 'pcs');
    assert.equal(line(lines, 'cp1').calculated, 1);
    assert.equal(lines.length, 2);
  });

  it('different variants of the same product are separate lines', () => {
    const lines = computeTotals([doc([marker('sw1'), marker('sw2'), marker('sw2')])], resolve);
    assert.equal(line(lines, 'sw1').calculated, 1);
    assert.equal(line(lines, 'sw2').calculated, 2);
    assert.equal(line(lines, 'sw1').key, 'variant:sw1');
  });

  it('led runs sum metres per variant to 1 dp and add one Smart LED Driver per run across variants', () => {
    const lines = computeTotals(
      [doc([led('led1', 4.5), led('led1', 6.25), led('led2', 3)]), doc([led('led1', 1.1)])],
      resolve,
    );
    const l1 = line(lines, 'led1');
    assert.equal(l1.calculated, 11.9);
    assert.equal(l1.unit, 'm');
    assert.equal(line(lines, 'led2').calculated, 3);
    const driver = line(lines, SYSTEM_VARIANT_IDS.smartLedDriver);
    assert.equal(driver.calculated, 4);
    assert.equal(driver.unit, 'pcs');
  });

  it('led run with null metres counts 0 and is flagged', () => {
    const lines = computeTotals([doc([led('led1', null), led('led1', 2)])], resolve);
    const l1 = line(lines, 'led1');
    assert.equal(l1.calculated, 2);
    assert.equal(l1.runsMissingMetres, 1);
    assert.equal(line(lines, SYSTEM_VARIANT_IDS.smartLedDriver).calculated, 2);
  });

  it('tracks sum headCount per variant and add one Track Driver per track', () => {
    const lines = computeTotals([doc([track('tr1', 3), track('tr1', 4), track('mt1', 5)])], resolve);
    assert.equal(line(lines, 'tr1').calculated, 7);
    assert.equal(line(lines, 'mt1').calculated, 5);
    assert.equal(line(lines, SYSTEM_VARIANT_IDS.trackDriver).calculated, 3);
  });

  it('drivers are autoAdded and resolve to SYSTEM_VARIANT_IDS', () => {
    const lines = computeTotals([doc([led('led1', 1), track('tr1', 1), marker('sw1')])], resolve);
    const auto = lines.filter((l) => l.autoAdded).map((l) => l.variantId).sort();
    assert.deepEqual(auto, [SYSTEM_VARIANT_IDS.smartLedDriver, SYSTEM_VARIANT_IDS.trackDriver].sort());
    assert.equal(line(lines, 'sw1').autoAdded, false);
    assert.equal(line(lines, SYSTEM_VARIANT_IDS.trackDriver).productName, 'Track Driver');
  });

  it('driver lines fall back to fixed names when the snapshot has none', () => {
    const lines = computeTotals([doc([led('led1', 1)])], (id) =>
      id === 'led1' ? SNAPSHOTS['led1'] : undefined,
    );
    const driver = line(lines, SYSTEM_VARIANT_IDS.smartLedDriver);
    assert.equal(driver.productName, 'Smart LED Driver');
    assert.equal(driver.categoryId, 'misc-lighting');
  });

  it('hidden categories do not affect totals', () => {
    const elements = [marker('sw1'), marker('dl1'), led('led1', 2)];
    const visible = computeTotals([doc(elements)], resolve);
    const hidden = computeTotals([doc(elements, ['smart-switches', 'led-strips'])], resolve);
    assert.deepEqual(hidden, visible);
  });

  it('no documents or no elements gives no lines', () => {
    assert.deepEqual(computeTotals([], resolve), []);
    assert.deepEqual(computeTotals([doc([])], resolve), []);
  });

  it('unresolved variants produce an Unknown product line', () => {
    const lines = computeTotals([doc([marker('ghost')])], resolve);
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.productName, 'Unknown product');
    assert.equal(lines[0]?.calculated, 1);
  });

  it('lines are sorted by category order then product then variant', () => {
    const lines = computeTotals(
      [doc([marker('dl1'), marker('cp1'), marker('sw2'), marker('sw1'), led('led2', 1), led('led1', 1)])],
      resolve,
    );
    assert.deepEqual(
      lines.map((l) => l.variantId),
      ['sw1', 'sw2', 'cp1', 'dl1', 'led1', 'led2', SYSTEM_VARIANT_IDS.smartLedDriver],
    );
  });
});

describe('compareLines', () => {
  it('orders by fixed category order before names, with numeric-aware names', () => {
    const a = { categoryId: 'downlights' as CategoryId, productName: 'A', variantName: 'A' };
    const b = { categoryId: 'smart-switches' as CategoryId, productName: 'Z', variantName: 'Z' };
    assert.ok(compareLines(a, b) > 0);
    const g2 = { categoryId: 'smart-switches' as CategoryId, productName: 'Ark', variantName: '2-gang' };
    const g10 = { categoryId: 'smart-switches' as CategoryId, productName: 'Ark', variantName: '10-gang' };
    assert.ok(compareLines(g2, g10) < 0, '2-gang sorts before 10-gang');
  });
});

// --- adjustments -----------------------------------------------------------------------------

const totalLine = (variantId: string, calculated: number): TotalLine => ({
  key: `variant:${variantId}`,
  variantId,
  categoryId: 'smart-switches',
  productName: 'Ark Series',
  variantName: '1-gang',
  unit: 'pcs',
  calculated,
  autoAdded: false,
  runsMissingMetres: 0,
});

const adj = (quantity: number, calculatedAtAdjustment: number): QuantityAdjustment => ({
  quantity,
  calculatedAtAdjustment,
  adjustedAt: '2026-10-01T00:00:00.000Z',
});

describe('applyAdjustments', () => {
  it('no adjustment → exportQuantity = calculated, adjusted false', () => {
    const [r] = applyAdjustments([totalLine('sw1', 4)], {});
    assert.ok(r);
    assert.equal(r.exportQuantity, 4);
    assert.equal(r.adjusted, false);
    assert.equal(r.warning, false);
  });

  it('adjustment with unchanged calculated → no warning', () => {
    const [r] = applyAdjustments([totalLine('sw1', 4)], { 'variant:sw1': adj(6, 4) });
    assert.ok(r);
    assert.equal(r.exportQuantity, 6);
    assert.equal(r.adjusted, true);
    assert.equal(r.warning, false);
  });

  it('adjustment with changed calculated → warning true and exportQuantity stays adjusted', () => {
    const [r] = applyAdjustments([totalLine('sw1', 5)], { 'variant:sw1': adj(6, 4) });
    assert.ok(r);
    assert.equal(r.exportQuantity, 6);
    assert.equal(r.warning, true);
    assert.equal(r.adjustment?.calculatedAtAdjustment, 4);
  });
});

describe('setAdjustment', () => {
  const now = '2026-10-01T10:00:00.000Z';

  it('stores quantity with the calculated value at that moment', () => {
    const next = setAdjustment({}, 'variant:sw1', 7, 4, now);
    assert.deepEqual(next, { 'variant:sw1': { quantity: 7, calculatedAtAdjustment: 4, adjustedAt: now } });
  });

  it('removes the entry when quantity equals calculated', () => {
    const start = { 'variant:sw1': adj(7, 4), 'variant:sw2': adj(2, 1) };
    const next = setAdjustment(start, 'variant:sw1', 4, 4, now);
    assert.deepEqual(Object.keys(next), ['variant:sw2']);
    assert.deepEqual(start['variant:sw1'], adj(7, 4), 'input is not mutated');
  });
});
