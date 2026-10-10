import { describe, expect, it } from 'vitest';
import { SYSTEM_VARIANT_IDS, createEmptyPlanDocument, type Variant } from '@maxsen/domain';
import {
  addNewSampleCategories,
  createSampleStore,
  type Persistence,
  type SampleState,
} from '../sample-store';

function memoryPersistence(initial: SampleState | null = null) {
  let saved: SampleState | null = initial;
  let saves = 0;
  const p: Persistence = {
    load: () => saved,
    save: (s) => {
      saved = s;
      saves++;
    },
  };
  return { p, saved: () => saved, saves: () => saves };
}

describe('persistence', () => {
  it('saves after every update and restores on the next start', () => {
    const mem = memoryPersistence();
    const a = createSampleStore('sample', {}, mem.p);
    a.actions.deleteProject('proj_sample_marina');
    expect(mem.saves()).toBe(1);
    const b = createSampleStore('sample', {}, mem.p);
    expect(b.getState().projects.map((p) => p.id)).not.toContain('proj_sample_marina');
  });

  it('resetData reseeds and saves', () => {
    const mem = memoryPersistence();
    const s = createSampleStore('sample', {}, mem.p);
    s.actions.resetData('empty');
    expect(s.getState().projects).toHaveLength(0);
    expect(mem.saved()?.projects).toHaveLength(0);
    s.actions.resetData('sample');
    expect(s.getState().projects).toHaveLength(3);
  });
});

describe('uploads and plan assignment', () => {
  it('adds a source file with its pages', () => {
    const s = createSampleStore();
    const fileId = s.actions.addSourceFile('proj_sample_tan', {
      name: 'drawings.pdf',
      kind: 'pdf',
      fileId: 'file_up',
      pages: [
        { fileId: 'file_p1', thumbnailFileId: 'file_t1', width: 2000, height: 1400 },
        { fileId: 'file_p2', thumbnailFileId: 'file_t2', width: 2000, height: 1400 },
      ],
    });
    const st = s.getState();
    const src = st.sourceFiles.find((f) => f.id === fileId)!;
    expect(src.pageCount).toBe(2);
    expect(st.sourcePages.filter((p) => p.sourceFileId === fileId).map((p) => p.pageIndex)).toEqual(
      [0, 1],
    );
  });

  it('assigns a drawing to a plan and sets the project thumbnail when missing', () => {
    const s = createSampleStore();
    const projectId = s.actions.createProject({
      title: 'Ong',
      customerName: '',
      customerContact: '',
      propertyAddress: '',
      propertyType: null,
      status: 'draft',
      templateId: null,
    });
    const levelId = s.getState().levels.find((l) => l.projectId === projectId)!.id;
    const planId = s.actions.assignPlan(projectId, levelId, 'lighting', {
      sourcePageId: 'page_x',
      rotation: 90,
      fileId: 'file_bg',
      width: 1000,
      height: 1400,
    });
    const st = s.getState();
    const plan = st.plans.find((p) => p.id === planId)!;
    expect(plan).toMatchObject({
      levelId,
      type: 'lighting',
      background: { rotation: 90, fileId: 'file_bg' },
    });
    expect(plan.document.elements).toEqual([]);
    expect(st.projects.find((p) => p.id === projectId)!.thumbnailFileId).toBe('file_bg');
  });
});

describe('planner writes', () => {
  it('setPlanDocument stores the document and bumps the revision', () => {
    const s = createSampleStore();
    const before = s.getState().plans.find((p) => p.id === 'plan_tan_1_sh')!;
    const doc = createEmptyPlanDocument();
    s.actions.setPlanDocument('plan_tan_1_sh', doc);
    const after = s.getState().plans.find((p) => p.id === 'plan_tan_1_sh')!;
    expect(after.document).toBe(doc);
    expect(after.revision).toBe(before.revision + 1);
  });

  it('recordVariantUse snapshots new variants, the drivers for paths, and keeps 12 recent', () => {
    const s = createSampleStore();
    s.actions.recordVariantUse('proj_sample_marina', 'var_lumi_cob_3000');
    const p = s.getState().projects.find((x) => x.id === 'proj_sample_marina')!;
    expect(p.catalogueSnapshot.var_lumi_cob_3000?.productName).toBe('Lumi COB Strip');
    expect(p.catalogueSnapshot[SYSTEM_VARIANT_IDS.smartLedDriver]).toBeDefined();
    expect(p.recentVariantIds[0]).toBe('var_lumi_cob_3000');
    const ids = s
      .getState()
      .variants.slice(0, 15)
      .map((v) => v.id);
    for (const id of ids) s.actions.recordVariantUse('proj_sample_marina', id);
    const recent = s
      .getState()
      .projects.find((x) => x.id === 'proj_sample_marina')!.recentVariantIds;
    expect(recent).toHaveLength(12);
    expect(recent[0]).toBe(ids[14]);
  });

  it('keeps an existing snapshot when the catalogue changes', () => {
    const s = createSampleStore();
    s.actions.updateVariant('var_nova_s8', { name: 'Renamed' });
    s.actions.recordVariantUse('proj_sample_tan', 'var_nova_s8');
    const snap = s.getState().projects.find((x) => x.id === 'proj_sample_tan')!.catalogueSnapshot
      .var_nova_s8;
    expect(snap?.variantName).not.toBe('Renamed');
  });
});

describe('upgrading saved data', () => {
  it('adds products of new categories without restoring deleted ones', () => {
    const state = createSampleStore('sample').getState();
    // A product the user deleted from a category that still has others.
    const deleted = state.products.find(
      (p) => state.products.filter((q) => q.categoryId === p.categoryId).length > 1,
    )!;
    const old: SampleState = {
      ...state,
      products: state.products.filter(
        (p) => p.categoryId !== 'ceiling-fans' && p.id !== deleted.id,
      ),
      variants: state.variants.filter((v) => !v.productId.startsWith('prod_breeze')),
    };
    const next = addNewSampleCategories(old);
    expect(next.products.some((p) => p.categoryId === 'ceiling-fans')).toBe(true);
    expect(next.variants.filter((v) => v.productId === 'prod_breeze_fan')).toHaveLength(2);
    expect(next.products.some((p) => p.id === deleted.id)).toBe(false);
    expect(addNewSampleCategories(next)).toBe(next);
  });
});

describe('upgrading saved lighting wording', () => {
  it('makes the lights and LED strips smart CCT, hiding the 4000K ones, keeping own wording', () => {
    const state = createSampleStore('sample').getState();
    const v = (id: string, name: string, description: string): Variant => ({
      ...state.variants.find((x) => x.id === 'var_luna_dl_3000')!,
      id,
      name,
      description,
    });
    const old: SampleState = {
      ...state,
      variants: [
        ...state.variants.filter((x) => !['var_luna_dl_3000', 'var_lumi_cob_3000'].includes(x.id)),
        v('var_luna_dl_3000', '3000K', 'Recessed downlight in warm white (3000K) for living areas and bedrooms.'),
        v('var_luna_dl_4000', '4000K', 'Recessed downlight in neutral white (4000K) for kitchens and work areas.'),
        v('var_lumi_cob_3000', 'Warm COB', 'Our own words.'),
      ],
    };
    const next = addNewSampleCategories(old);
    const get = (id: string) => next.variants.find((x) => x.id === id)!;
    expect(get('var_luna_dl_3000')).toMatchObject({ name: 'Smart CCT', hidden: false });
    expect(get('var_luna_dl_3000').description).toMatch(/2700K–6000K.*CRI 98, app control/);
    expect(get('var_luna_dl_4000')).toMatchObject({ name: 'Smart CCT', hidden: true });
    expect(get('var_lumi_cob_3000')).toMatchObject({ name: 'Warm COB', description: 'Our own words.' });
    expect(addNewSampleCategories(next)).toBe(next);
  });
});

describe('upgrading saved prices', () => {
  it('gives variants saved before prices existed the catalogue price, keeping set ones', () => {
    const state = createSampleStore('sample').getState();
    const old: SampleState = {
      ...state,
      variants: state.variants.map((v) =>
        v.id === 'var_nova_s8' ? { ...v, price: 700 } : { ...v, price: undefined },
      ),
    };
    const next = addNewSampleCategories(old);
    const price = (id: string) => next.variants.find((v) => v.id === id)!.price;
    expect(price('var_nova_s8')).toBe(700);
    expect(price('var_nova_s1')).toBe(250);
    expect(price('var_breeze_fan_46')).toBe(null);
  });
});
