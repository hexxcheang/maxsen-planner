import { describe, expect, it } from 'vitest';
import { magicPlan, MAGIC_CATEGORIES, sample, createVariantPicker } from '@maxsen/domain';
import { createSampleStore, resolverFor } from '@/lib/data/sample-store';
import { mergeMagic } from '../magic/apply';
import { createPlannerStore } from '../store/plannerStore';

describe('Magic Plan apply', () => {
  const s = createSampleStore().getState();
  const project = s.projects.find((p) => p.id === 'proj_sample_tan')!;
  const plan = s.plans.find((p) => p.id === 'plan_tan_1_lt')!;
  const resolve = resolverFor(project, s);
  const pick = createVariantPicker({
    products: s.products,
    variants: s.variants,
    favouriteVariantIds: s.settings.favouriteVariantIds,
  });
  const result = magicPlan({
    analysis: sample.sampleAnalysisFor(plan.background.fileId)!,
    sheet: { width: 1000, height: (1000 * plan.background.height) / plan.background.width },
    categories: MAGIC_CATEGORIES.map((c) => c.id),
    pick,
  });

  it('replaces only the chosen categories and keeps notes', () => {
    const before = plan.document;
    const notes = before.elements.filter((e) => e.kind === 'note').length;
    const merged = mergeMagic(before, result.lighting, {
      replace: true,
      categories: ['downlights'],
      resolve,
    });
    const downlightsBefore = before.elements.filter(
      (e) => e.kind === 'marker' && resolve(e.variantId)?.categoryId === 'downlights',
    ).length;
    expect(downlightsBefore).toBeGreaterThan(0);
    expect(merged.elements.filter((e) => e.kind === 'note')).toHaveLength(notes);
    // LED strips from the sample survive because only downlights were chosen for replacement.
    expect(
      merged.elements.some((e) => e.kind === 'led-strip' && !result.lighting.includes(e)),
    ).toBe(true);
    const zs = merged.elements.map((e) => e.z);
    expect(new Set(zs).size).toBe(zs.length);
  });

  it('adds on top when not replacing', () => {
    const merged = mergeMagic(plan.document, result.lighting, {
      replace: false,
      categories: ['downlights'],
      resolve,
    });
    expect(merged.elements).toHaveLength(plan.document.elements.length + result.lighting.length);
  });

  it('is one undo step in the planner', () => {
    const store = createPlannerStore();
    store.getState().load({
      projectId: project.id,
      levelId: plan.levelId,
      planType: 'lighting',
      planId: plan.id,
      document: plan.document,
    });
    const merged = mergeMagic(plan.document, result.lighting, {
      replace: false,
      categories: [],
      resolve,
    });
    store.getState().applyDocument(merged);
    expect(store.getState().document.elements.length).toBe(merged.elements.length);
    store.getState().undo();
    expect(store.getState().document.elements.length).toBe(plan.document.elements.length);
  });
});
