import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { newId } from '../src/ids.ts';
import {
  createEmptyPlanDocument,
  defaultExportSettings,
  nextZ,
  PLAN_DOCUMENT_SCHEMA_VERSION,
} from '../src/plan-document.ts';
import type { PlanDocument, PointMarker } from '../src/types.ts';

const marker = (id: string, z: number): PointMarker => ({
  kind: 'marker',
  id,
  z,
  variantId: 'var_x',
  x: 100,
  y: 100,
  rotation: 0,
  label: '',
});

describe('newId', () => {
  it('uses the prefix and a 12-character base62 suffix', () => {
    const id = newId('proj');
    assert.match(id, /^proj_[0-9A-Za-z]{12}$/);
  });

  it('does not repeat across many calls', () => {
    const ids = new Set(Array.from({ length: 2000 }, () => newId('el')));
    assert.equal(ids.size, 2000);
  });
});

describe('createEmptyPlanDocument', () => {
  it('creates a current-version document with no elements and the legend visible', () => {
    const doc = createEmptyPlanDocument();
    assert.equal(doc.schemaVersion, PLAN_DOCUMENT_SCHEMA_VERSION);
    assert.equal(doc.schemaVersion, 1);
    assert.deepEqual(doc.elements, []);
    assert.deepEqual(doc.view, { hiddenCategories: [], legendVisible: true });
  });
});

describe('nextZ', () => {
  it('is 0 for an empty document and max+1 otherwise', () => {
    assert.equal(nextZ(createEmptyPlanDocument()), 0);
    const doc: PlanDocument = {
      ...createEmptyPlanDocument(),
      elements: [marker('a', 3), marker('b', 7), marker('c', 5)],
    };
    assert.equal(nextZ(doc), 8);
  });
});

describe('defaultExportSettings', () => {
  it('includes every level with both plan types, hides nothing and shows all labels', () => {
    const s = defaultExportSettings(['lvl_1', 'lvl_2']);
    assert.deepEqual(s.floorPlan.levels, {
      lvl_1: { smartHome: true, lighting: true },
      lvl_2: { smartHome: true, lighting: true },
    });
    assert.deepEqual(s.floorPlan.hiddenCategories, []);
    assert.equal(s.floorPlan.showLabels, true);
    assert.equal(s.floorPlan.showLedLengths, true);
    assert.equal(s.floorPlan.showTrackLabels, true);
    assert.equal(s.floorPlan.showNotes, true);
    assert.equal(s.floorPlan.showLegend, true);
    assert.equal(s.floorPlan.showCustomerName, true);
    assert.equal(s.floorPlan.showCustomerContact, true);
    assert.equal(s.floorPlan.showPropertyAddress, true);
    assert.deepEqual(s.productDescription.excludedCategories, []);
    assert.equal(s.productDescription.showCustomerName, true);
  });
});
