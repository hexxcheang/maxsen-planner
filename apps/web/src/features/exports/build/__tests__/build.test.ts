import { describe, expect, it } from 'vitest';
import { applyAdjustments, computeTotals, defaultExportSettings } from '@maxsen/domain';
import { createSampleStore, levelsOf, plansOf, resolverFor } from '@/lib/data/sample-store';
import { floorPlanPages, productSections, quantitySections } from '../content';

function tan() {
  const s = createSampleStore().getState();
  const project = s.projects.find((p) => p.id === 'proj_sample_tan')!;
  const resolve = resolverFor(project, s);
  const lines = applyAdjustments(
    computeTotals(
      plansOf(s, project.id).map((p) => p.document),
      resolve,
    ),
    project.quantityAdjustments,
  );
  return { s, project, resolve, lines };
}

describe('export content', () => {
  it('quantity sections split Smart Home and Lighting, include drivers, use export quantities', () => {
    const { lines } = tan();
    const sections = quantitySections(lines);
    expect(sections.map((x) => x.title)).toEqual(['Smart Home Products', 'Lighting Products']);
    const lighting = sections[1]!.rows;
    expect(lighting.some((r) => r.product === 'Smart LED Driver')).toBe(true);
    const cove = lighting.find(
      (r) => r.product === 'Lumi Cove Strip' && r.variant === 'Smart CCT',
    )!;
    expect(cove).toMatchObject({ quantity: 5, unit: 'm' });
    const switches = sections[0]!.rows.find((r) => r.variant === '2-gang, Black')!;
    expect(switches.quantity).toBe(4);
  });

  it('product sections drop drivers and excluded categories and keep fixed category order', () => {
    const { lines, resolve } = tan();
    const sections = productSections(lines, ['cameras'], resolve);
    const all = sections.flatMap((s) => s.categories);
    expect(all.some((c) => c.categoryId === 'cameras')).toBe(false);
    expect(all.flatMap((c) => c.items).some((i) => i.productName.includes('Driver'))).toBe(false);
    expect(all[0]?.categoryId).toBe('smart-switches');
    const cove = all
      .flatMap((c) => c.items)
      .find((i) => i.productName === 'Lumi Cove Strip' && i.variantName === 'Smart CCT')!;
    expect(cove.quantity).toBe('5 m');
    expect(cove.description.length).toBeGreaterThan(10);
  });

  it('floor plan pages follow level order and the per-level plan selection', () => {
    const s = createSampleStore().getState();
    const levels = levelsOf(s, 'proj_sample_lim');
    const plans = plansOf(s, 'proj_sample_lim');
    const settings = defaultExportSettings(levels.map((l) => l.id));
    settings.floorPlan.levels.lvl_lim_2 = { smartHome: false, lighting: true };
    const pages = floorPlanPages(levels, plans, settings.floorPlan);
    expect(pages.map((p) => `${p.level.name}/${p.plan.type}`)).toEqual([
      'Level 1/smart-home',
      'Level 1/lighting',
      'Level 2/lighting',
      'Attic/lighting',
    ]);
  });
});
