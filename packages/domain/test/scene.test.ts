import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyPlanDocument } from '../src/plan-document.ts';
import { resolveCategoryStyle } from '../src/render/styles.ts';
import { buildScene, type SceneOptions } from '../src/render/scene.ts';
import type { VariantResolver } from '../src/totals/compute-totals.ts';
import type {
  CategoryId,
  LedStripPath,
  PlanDocument,
  PlanElement,
  PointMarker,
  Settings,
  TextNote,
  TrackPath,
  VariantSnapshot,
} from '../src/types.ts';

const settings: Settings = {
  branding: { logoFileId: null, whatsapp: '', website: '', showrooms: [], contactWording: '' },
  categoryStyles: { sensors: { color: '#123456', size: 30, badge: 'SN' } },
  favouriteVariantIds: [],
};

const snapshots: Record<string, VariantSnapshot> = {};
const addSnap = (variantId: string, categoryId: CategoryId): void => {
  snapshots[variantId] = {
    variantId,
    productId: 'p',
    categoryId,
    productName: 'P',
    variantName: 'V',
    description: '',
    imageFileId: null,
    capturedAt: '2026-10-01T00:00:00.000Z',
  };
};
addSnap('sw', 'smart-switches');
addSnap('se', 'sensors');
addSnap('led', 'led-strips');
addSnap('tr', 'track-lights');
addSnap('mt', 'magnetic-track-lights');
const resolve: VariantResolver = (id) => snapshots[id];

const ALL: SceneOptions = {
  showLabels: true,
  showLedLengths: true,
  showTrackLabels: true,
  showNotes: true,
  hiddenCategories: [],
};

const marker = (id: string, variantId: string, z: number, label = ''): PointMarker => ({
  kind: 'marker',
  id,
  z,
  variantId,
  x: 100,
  y: 200,
  rotation: 0,
  label,
});
const led = (id: string, z: number, metres: number | null, smooth = false): LedStripPath => ({
  kind: 'led-strip',
  id,
  z,
  variantId: 'led',
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ],
  closed: false,
  smooth,
  metres,
  showLabel: true,
});
const track = (id: string, z: number, variantId: string, heads: number): TrackPath => ({
  kind: 'track',
  id,
  z,
  variantId,
  points: [
    { x: 0, y: 0 },
    { x: 60, y: 0 },
  ],
  headCount: heads,
  showLabel: true,
});
const note = (id: string, z: number): TextNote => ({
  kind: 'note',
  id,
  z,
  x: 5,
  y: 5,
  text: 'Note',
  fontSize: 16,
  bold: false,
  color: '#000000',
  highlight: null,
});
const doc = (elements: PlanElement[], hidden: CategoryId[] = []): PlanDocument => ({
  ...createEmptyPlanDocument(),
  elements,
  view: { hiddenCategories: hidden, legendVisible: true },
});
const scene = (d: PlanDocument, opts: Partial<SceneOptions> = {}) =>
  buildScene(d, { settings, resolve, width: 1000, height: 700 }, { ...ALL, ...opts });

describe('resolveCategoryStyle', () => {
  it('applies overrides and keeps shape fixed', () => {
    const s = resolveCategoryStyle('sensors', settings);
    assert.equal(s.color, '#123456');
    assert.equal(s.size, 30);
    assert.equal(s.badge, 'SN');
    assert.equal(s.badgeStyle, 'filled');
    assert.equal(s.shape, 'target');
    assert.equal(s.kind, 'point');
    assert.equal(s.name, 'Sensors');
    const d = resolveCategoryStyle('downlights', settings);
    assert.equal(d.color, '#D28A00');
    assert.equal(d.size, 20);
  });
});

describe('buildScene', () => {
  it('carries the plan size', () => {
    const s = scene(doc([]));
    assert.equal(s.width, 1000);
    assert.equal(s.height, 700);
    assert.deepEqual(s.items, []);
    assert.deepEqual(s.legend, []);
  });

  it('omits hidden categories but legend reflects visibility', () => {
    const s = scene(doc([marker('a', 'sw', 0), marker('b', 'se', 1), led('c', 2, 3)]), {
      hiddenCategories: ['smart-switches'],
    });
    assert.deepEqual(
      s.items.map((i) => i.elementId),
      ['b', 'c'],
    );
    assert.deepEqual(
      s.legend.map((l) => l.categoryId),
      ['sensors', 'led-strips'],
    );
  });

  it('legend lists present categories in fixed order and ignores notes', () => {
    const s = scene(
      doc([note('n', 0), led('c', 1, 1), marker('a', 'sw', 2), marker('a2', 'sw', 3)]),
    );
    assert.deepEqual(
      s.legend.map((l) => l.categoryId),
      ['smart-switches', 'led-strips'],
    );
    assert.equal(s.legend[0]?.name, 'Smart Switches');
    assert.equal(s.legend[1]?.kind, 'led-strip');
  });

  it('marker label position and font size follow the size rule', () => {
    const s = scene(doc([marker('a', 'se', 0, 'Hall')]));
    const m = s.items[0];
    assert.ok(m && m.type === 'marker');
    assert.equal(m.size, 30);
    assert.equal(m.color, '#123456');
    assert.equal(m.badge.text, 'SN');
    assert.deepEqual(m.label, { text: 'Hall', x: 100, y: 200 + 30 * 0.85, fontSize: 15 });
    const noLabels = scene(doc([marker('a', 'se', 0, 'Hall')]), { showLabels: false });
    const m2 = noLabels.items[0];
    assert.ok(m2 && m2.type === 'marker');
    assert.equal(m2.label, undefined);
  });

  it('led label text shows entered metres and the track label uses head count', () => {
    const s = scene(
      doc([
        led('l1', 0, 4.5),
        led('l2', 1, 6.25),
        led('l3', 2, null),
        track('t', 3, 'tr', 3),
        track('m', 4, 'mt', 5),
      ]),
    );
    const texts = s.items.map((i) => (i.type === 'path' ? i.label?.text : undefined));
    assert.deepEqual(texts, [
      '4.5m LED Strip',
      '6.25m LED Strip',
      '? m LED Strip',
      '3-head Track',
      '5-module Magnetic Track',
    ]);
    const t = s.items[3];
    assert.ok(t && t.type === 'path');
    assert.equal(t.heads.length, 3);
    assert.equal(t.strokeWidth, 20 * 0.3);
    assert.equal(t.heads[0]?.size, 20 * 0.6);
    assert.deepEqual(
      t.heads.map((h) => h.x),
      [10, 30, 50],
    );
  });

  it('label toggles remove LED and track labels independently', () => {
    const s = scene(doc([led('l1', 0, 4.5), track('t', 1, 'tr', 2)]), {
      showLedLengths: false,
    });
    assert.equal(s.items[0]?.type === 'path' ? s.items[0].label : 'x', undefined);
    assert.ok(s.items[1]?.type === 'path' && s.items[1].label);
    const s2 = scene(doc([led('l1', 0, 4.5), track('t', 1, 'tr', 2)]), { showTrackLabels: false });
    assert.ok(s2.items[0]?.type === 'path' && s2.items[0].label);
    assert.equal(s2.items[1]?.type === 'path' ? s2.items[1].label : 'x', undefined);
    const s3 = scene(doc([{ ...led('l1', 0, 4.5), showLabel: false }]));
    assert.equal(s3.items[0]?.type === 'path' ? s3.items[0].label : 'x', undefined);
  });

  it('elements are emitted in z order', () => {
    const s = scene(
      doc([note('n', 5), marker('a', 'sw', 1), led('c', 3, 1), marker('b', 'se', 0)]),
    );
    assert.deepEqual(
      s.items.map((i) => i.elementId),
      ['b', 'a', 'c', 'n'],
    );
  });

  it('path geometry uses smoothToSvgPath when smooth', () => {
    const straight = scene(doc([led('c', 0, 1, false)])).items[0];
    const smooth = scene(doc([led('c', 0, 1, true)])).items[0];
    assert.ok(straight?.type === 'path' && smooth?.type === 'path');
    assert.equal(straight.d, 'M0 0 L100 0 L100 100');
    assert.match(smooth.d, /^M0 0 C/);
  });

  it('notes pass through and can be hidden', () => {
    const s = scene(doc([note('n', 0)]));
    assert.equal(s.items[0]?.type, 'note');
    assert.deepEqual(scene(doc([note('n', 0)]), { showNotes: false }).items, []);
  });
});

describe('badgeTextColor', () => {
  it('uses white on dark fills and ink on light fills, at least 4.5:1 for every default', async () => {
    const { badgeTextColor, contrastRatio } = await import('../src/render/styles.ts');
    const { CATEGORIES } = await import('../src/categories.ts');
    assert.equal(badgeTextColor('#2F5FB3'), '#FFFFFF');
    assert.equal(badgeTextColor('#D28A00'), '#1F1D1A');
    for (const c of CATEGORIES) {
      if (c.kind !== 'point') continue;
      const ratio = contrastRatio(c.defaults.color, badgeTextColor(c.defaults.color));
      assert.ok(ratio >= 4.5, `${c.id} badge contrast ${ratio.toFixed(2)}`);
    }
  });
});
