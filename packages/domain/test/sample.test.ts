import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, SYSTEM_PRODUCT_IDS, SYSTEM_VARIANT_IDS } from '../src/categories.ts';
import { computeTotals } from '../src/totals/compute-totals.ts';
import {
  DEFAULT_SETTINGS,
  SAMPLE_FILES,
  SAMPLE_LEVELS,
  SAMPLE_PLANS,
  SAMPLE_PRODUCTS,
  SAMPLE_PROJECTS,
  SAMPLE_SETTINGS,
  SAMPLE_SOURCE_FILES,
  SAMPLE_SOURCE_PAGES,
  SAMPLE_TEMPLATES,
  SAMPLE_VARIANTS,
  sampleFileUrl,
  sampleResolver,
} from '../src/sample/index.ts';

const productIds = new Set(SAMPLE_PRODUCTS.map((p) => p.id));
const variantIds = new Set(SAMPLE_VARIANTS.map((v) => v.id));
const fileIds = new Set(SAMPLE_FILES.map((f) => f.id));

describe('sample catalogue', () => {
  it('all sample variants reference existing products and have descriptions', () => {
    for (const v of SAMPLE_VARIANTS) {
      assert.ok(productIds.has(v.productId), `${v.name} → ${v.productId}`);
      assert.ok(v.description.length > 20, `${v.name} description`);
    }
    assert.equal(variantIds.size, SAMPLE_VARIANTS.length, 'variant ids unique');
  });

  it('covers every category with at least one product', () => {
    for (const c of CATEGORIES) {
      assert.ok(
        SAMPLE_PRODUCTS.some((p) => p.categoryId === c.id),
        `${c.id} has products`,
      );
    }
  });

  it('system drivers exist with the fixed ids and are not hidden', () => {
    for (const [pid, vid] of [
      [SYSTEM_PRODUCT_IDS.smartLedDriver, SYSTEM_VARIANT_IDS.smartLedDriver],
      [SYSTEM_PRODUCT_IDS.trackDriver, SYSTEM_VARIANT_IDS.trackDriver],
    ]) {
      const p = SAMPLE_PRODUCTS.find((x) => x.id === pid);
      assert.ok(p, pid);
      assert.equal(p.system, true);
      assert.equal(p.hidden, false);
      assert.equal(p.categoryId, 'misc-lighting');
      const v = SAMPLE_VARIANTS.find((x) => x.id === vid);
      assert.ok(v, vid);
      assert.equal(v.productId, pid);
    }
    assert.ok(SAMPLE_PRODUCTS.every((p) => p.system || !p.id.startsWith('prod_sys')));
  });

  it('product images reference sample files', () => {
    for (const v of SAMPLE_VARIANTS) {
      if (v.imageFileId) assert.ok(fileIds.has(v.imageFileId), `${v.name} image`);
    }
    assert.ok(
      SAMPLE_VARIANTS.filter((v) => v.imageFileId).length >= 12,
      'at least 12 variants have images',
    );
  });
});

describe('sample settings', () => {
  it('defaults carry Maxsen contact details and no overrides', () => {
    assert.equal(DEFAULT_SETTINGS.branding.whatsapp, '+65 8000 0000');
    assert.equal(DEFAULT_SETTINGS.branding.website, 'maxsen.sg');
    assert.deepEqual(
      DEFAULT_SETTINGS.branding.showrooms.map((s) => s.name),
      ['Tampines Showroom', 'Yishun Showroom'],
    );
    assert.equal(DEFAULT_SETTINGS.branding.logoFileId, null);
    assert.deepEqual(DEFAULT_SETTINGS.categoryStyles, {});
    assert.equal(SAMPLE_SETTINGS.branding.logoFileId, 'file_sample_logo');
    assert.ok(SAMPLE_SETTINGS.favouriteVariantIds.every((id) => variantIds.has(id)));
    assert.ok(SAMPLE_SETTINGS.favouriteVariantIds.length >= 4);
  });
});

describe('sample projects', () => {
  it('has the three projects with the expected status and level counts', () => {
    assert.deepEqual(
      SAMPLE_PROJECTS.map((p) => [
        p.title,
        p.status,
        SAMPLE_LEVELS.filter((l) => l.projectId === p.id).length,
      ]),
      [
        ['Tan Residence — Tampines 4-room', 'in-progress', 1],
        ['Lim Family Home — Serangoon Gardens', 'draft', 3],
        ['Marina One Showflat', 'completed', 1],
      ],
    );
  });

  it('sample levels have unique order per project and valid paper settings', () => {
    for (const p of SAMPLE_PROJECTS) {
      const orders = SAMPLE_LEVELS.filter((l) => l.projectId === p.id).map((l) => l.sortOrder);
      assert.equal(new Set(orders).size, orders.length, p.title);
      assert.deepEqual(
        [...orders].sort((a, b) => a - b),
        orders,
        'levels are listed in order',
      );
    }
    assert.ok(SAMPLE_LEVELS.some((l) => l.paperSize === 'A3' && l.orientation === 'landscape'));
    assert.ok(SAMPLE_LEVELS.some((l) => l.paperSize === 'A4' && l.orientation === 'portrait'));
  });

  it('plans belong to levels of their project, one per type, with backgrounds from sample pages', () => {
    const pageIds = new Set(SAMPLE_SOURCE_PAGES.map((p) => p.id));
    const seen = new Set<string>();
    for (const plan of SAMPLE_PLANS) {
      const level = SAMPLE_LEVELS.find((l) => l.id === plan.levelId);
      assert.ok(level, plan.id);
      assert.equal(level.projectId, plan.projectId);
      const key = `${plan.levelId}:${plan.type}`;
      assert.ok(!seen.has(key), `duplicate plan ${key}`);
      seen.add(key);
      assert.ok(pageIds.has(plan.background.sourcePageId), `${plan.id} page`);
      assert.ok(fileIds.has(plan.background.fileId), `${plan.id} background file`);
      assert.ok(plan.background.width > 0 && plan.background.height > 0);
    }
    const attic = SAMPLE_LEVELS.find((l) => l.name === 'Attic');
    assert.ok(attic);
    assert.equal(
      SAMPLE_PLANS.filter((p) => p.levelId === attic.id).length,
      1,
      'attic has one plan only',
    );
  });

  it('every sample plan document is structurally valid', () => {
    for (const plan of SAMPLE_PLANS) {
      const doc = plan.document;
      assert.equal(doc.schemaVersion, 1);
      const ids = new Set<string>();
      for (const el of doc.elements) {
        assert.ok(!ids.has(el.id), `duplicate element id ${el.id}`);
        ids.add(el.id);
        assert.equal(typeof el.z, 'number');
        if (el.kind === 'led-strip' || el.kind === 'track') {
          assert.ok(el.points.length >= 2, `${el.id} points`);
        }
        if (el.kind === 'track') assert.ok(el.headCount >= 1);
        if (el.kind === 'marker') assert.ok(el.x >= 0 && el.x <= 1000 && el.y >= 0);
      }
      assert.ok(
        doc.elements.length >= 5 && doc.elements.length <= 40,
        `${plan.id} has ${doc.elements.length} elements`,
      );
    }
  });

  it('every sample element variant exists in the catalogue and in the project snapshot', () => {
    for (const plan of SAMPLE_PLANS) {
      const project = SAMPLE_PROJECTS.find((p) => p.id === plan.projectId);
      assert.ok(project);
      for (const el of plan.document.elements) {
        if (el.kind === 'note') continue;
        assert.ok(variantIds.has(el.variantId), `${plan.id}: ${el.variantId}`);
        assert.ok(
          project.catalogueSnapshot[el.variantId],
          `${project.title} snapshot for ${el.variantId}`,
        );
      }
    }
  });

  it('includes the required showcase elements', () => {
    const all = SAMPLE_PLANS.flatMap((p) => p.document.elements);
    const leds = all.filter((e) => e.kind === 'led-strip');
    assert.ok(
      leds.some((l) => l.metres === 4.5 && !l.closed && l.points.length === 3),
      'L-shaped 4.5 m LED run',
    );
    assert.ok(
      leds.some((l) => l.metres === 6.2 && l.closed && l.smooth),
      'circular 6.2 m LED loop',
    );
    const tracks = all.filter((e) => e.kind === 'track');
    assert.ok(
      tracks.some((t) => t.headCount === 3 && t.points.length === 2),
      'straight 3-head track',
    );
    assert.ok(
      tracks.some((t) => t.headCount === 5 && t.points.length === 3),
      'L-shaped 5-module magnetic track',
    );
    assert.ok(all.filter((e) => e.kind === 'note').length >= 2, 'two text notes');
  });

  it('computeTotals on the Lim project yields a Smart LED Driver and a Track Driver line', () => {
    const lim = SAMPLE_PROJECTS.find((p) => p.title.startsWith('Lim'));
    assert.ok(lim);
    const docs = SAMPLE_PLANS.filter((p) => p.projectId === lim.id).map((p) => p.document);
    const lines = computeTotals(docs, sampleResolver(lim));
    assert.ok(
      lines.some((l) => l.variantId === SYSTEM_VARIANT_IDS.smartLedDriver && l.calculated >= 1),
    );
    assert.ok(
      lines.some((l) => l.variantId === SYSTEM_VARIANT_IDS.trackDriver && l.calculated >= 1),
    );
    assert.ok(lines.every((l) => l.productName !== 'Unknown product'));
  });

  it('projects reference existing levels in lastOpened and have adjustments on Tan', () => {
    for (const p of SAMPLE_PROJECTS) {
      if (p.lastOpened) {
        assert.ok(
          SAMPLE_LEVELS.some((l) => l.id === p.lastOpened?.levelId && l.projectId === p.id),
        );
      }
      if (p.thumbnailFileId) assert.ok(fileIds.has(p.thumbnailFileId));
    }
    const tan = SAMPLE_PROJECTS[0];
    assert.ok(
      tan && Object.keys(tan.quantityAdjustments).length >= 1,
      'Tan has a manual adjustment for the review screen',
    );
  });
});

describe('sample sources and files', () => {
  it('source pages belong to source files of the same project and reference files', () => {
    for (const page of SAMPLE_SOURCE_PAGES) {
      const src = SAMPLE_SOURCE_FILES.find((s) => s.id === page.sourceFileId);
      assert.ok(src, page.id);
      assert.equal(src.projectId, page.projectId);
      assert.ok(fileIds.has(page.fileId) && fileIds.has(page.thumbnailFileId));
      assert.ok(page.pageIndex < src.pageCount);
    }
  });

  it('sampleFileUrl maps ids to /sample URLs and throws on unknown ids', () => {
    assert.match(sampleFileUrl('file_sample_logo'), /^\/sample\/maxsen-logo\.png$/);
    for (const f of SAMPLE_FILES) assert.match(sampleFileUrl(f.id), /^\/sample\//);
    assert.throws(() => sampleFileUrl('file_nope'), /Unknown sample file/);
  });
});

describe('sample templates', () => {
  it('has the HDB 4-room standard template with one level and two plans', () => {
    assert.equal(SAMPLE_TEMPLATES.length, 1);
    const t = SAMPLE_TEMPLATES[0];
    assert.ok(t);
    assert.equal(t.name, 'HDB 4-room standard');
    assert.equal(t.structure.levels.length, 1);
    assert.deepEqual(
      t.structure.levels[0]?.plans.map((p) => p.type),
      ['smart-home', 'lighting'],
    );
    for (const lvl of t.structure.levels) {
      for (const plan of lvl.plans) {
        for (const el of plan.document.elements) {
          if (el.kind !== 'note')
            assert.ok(t.structure.catalogueSnapshot[el.variantId], el.variantId);
        }
      }
    }
  });
});
