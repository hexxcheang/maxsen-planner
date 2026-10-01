import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  exportSettingsSchema,
  planDocumentSchema,
  planElementSchema,
  projectDetailsSchema,
  settingsSchema,
} from '../src/schemas.ts';
import {
  createEmptyPlanDocument,
  defaultExportSettings,
  migratePlanDocument,
  PlanDocumentError,
} from '../src/plan-document.ts';
import { DEFAULT_SETTINGS, SAMPLE_PLANS, SAMPLE_SETTINGS } from '../src/sample/index.ts';

const track = (headCount: number) => ({
  kind: 'track',
  id: 'el_t',
  z: 0,
  variantId: 'var_x',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
  headCount,
  showLabel: true,
});

const led = (metres: number | null) => ({
  kind: 'led-strip',
  id: 'el_l',
  z: 0,
  variantId: 'var_x',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ],
  closed: false,
  smooth: false,
  metres,
  showLabel: true,
});

describe('planDocumentSchema', () => {
  it('accepts an empty document and rejects schemaVersion 2', () => {
    assert.ok(planDocumentSchema.safeParse(createEmptyPlanDocument()).success);
    assert.ok(!planDocumentSchema.safeParse({ ...createEmptyPlanDocument(), schemaVersion: 2 }).success);
  });

  it('rejects unknown hidden categories', () => {
    const doc = createEmptyPlanDocument();
    const bad = { ...doc, view: { ...doc.view, hiddenCategories: ['lasers'] } };
    assert.ok(!planDocumentSchema.safeParse(bad).success);
  });

  it('accepts every sample plan document', () => {
    for (const plan of SAMPLE_PLANS) {
      const result = planDocumentSchema.safeParse(plan.document);
      assert.ok(result.success, `${plan.id}: ${result.error?.message ?? ''}`);
    }
  });
});

describe('planElementSchema', () => {
  it('rejects a track with headCount 0 and accepts headCount 1', () => {
    assert.ok(!planElementSchema.safeParse(track(0)).success);
    assert.ok(!planElementSchema.safeParse(track(1.5)).success);
    assert.ok(planElementSchema.safeParse(track(1)).success);
  });

  it('led-strip metres accepts null and rejects negative', () => {
    assert.ok(planElementSchema.safeParse(led(null)).success);
    assert.ok(planElementSchema.safeParse(led(4.5)).success);
    assert.ok(!planElementSchema.safeParse(led(-1)).success);
  });

  it('paths need at least two points', () => {
    assert.ok(!planElementSchema.safeParse({ ...track(1), points: [{ x: 0, y: 0 }] }).success);
  });

  it('rejects an unknown kind', () => {
    assert.ok(!planElementSchema.safeParse({ kind: 'shape', id: 'el_1', z: 0 }).success);
  });
});

describe('projectDetailsSchema', () => {
  const base = {
    title: '  Tan Residence  ',
    customerName: '',
    customerContact: '',
    propertyAddress: '',
    propertyType: null,
    status: 'draft',
  };

  it('trims title and rejects empty', () => {
    const ok = projectDetailsSchema.parse(base);
    assert.equal(ok.title, 'Tan Residence');
    assert.ok(!projectDetailsSchema.safeParse({ ...base, title: '   ' }).success);
  });

  it('caps title at 120 and optional strings at 200 characters', () => {
    assert.ok(!projectDetailsSchema.safeParse({ ...base, title: 'x'.repeat(121) }).success);
    assert.ok(!projectDetailsSchema.safeParse({ ...base, customerName: 'x'.repeat(201) }).success);
    assert.ok(projectDetailsSchema.safeParse({ ...base, customerName: 'x'.repeat(200) }).success);
  });

  it('accepts property types and statuses from the spec only', () => {
    assert.ok(projectDetailsSchema.safeParse({ ...base, propertyType: 'Landed' }).success);
    assert.ok(!projectDetailsSchema.safeParse({ ...base, propertyType: 'Castle' }).success);
    assert.ok(!projectDetailsSchema.safeParse({ ...base, status: 'archived' }).success);
  });
});

describe('settings and export settings schemas', () => {
  it('accept the defaults', () => {
    assert.ok(settingsSchema.safeParse(DEFAULT_SETTINGS).success);
    assert.ok(settingsSchema.safeParse(SAMPLE_SETTINGS).success);
    assert.ok(exportSettingsSchema.safeParse(defaultExportSettings(['lvl_1'])).success);
  });

  it('reject an invalid icon colour or size', () => {
    const bad = { ...DEFAULT_SETTINGS, categoryStyles: { downlights: { color: 'orange' } } };
    assert.ok(!settingsSchema.safeParse(bad).success);
    const big = { ...DEFAULT_SETTINGS, categoryStyles: { downlights: { size: 0 } } };
    assert.ok(!settingsSchema.safeParse(big).success);
  });
});

describe('migratePlanDocument', () => {
  it('returns a typed document for valid input', () => {
    const doc = migratePlanDocument(JSON.parse(JSON.stringify(SAMPLE_PLANS[0]!.document)));
    assert.deepEqual(doc, SAMPLE_PLANS[0]!.document);
  });

  it('throws PlanDocumentError for garbage', () => {
    assert.throws(() => migratePlanDocument('nope'), PlanDocumentError);
    assert.throws(() => migratePlanDocument({ schemaVersion: 1 }), PlanDocumentError);
    assert.throws(() => migratePlanDocument(null), PlanDocumentError);
  });

  it('throws PlanDocumentError for a future schema version', () => {
    assert.throws(
      () => migratePlanDocument({ ...createEmptyPlanDocument(), schemaVersion: 99 }),
      PlanDocumentError,
    );
  });
});
