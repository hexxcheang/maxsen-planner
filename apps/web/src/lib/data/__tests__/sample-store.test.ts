import { describe, expect, it } from 'vitest';
import { createSampleStore, filterProjects, visibleVariantsFor } from '../sample-store';

describe('sample store', () => {
  it('useProjects filters by title, customer name and address case-insensitively', () => {
    const { projects } = createSampleStore().getState();
    expect(filterProjects(projects, 'TAMPINES').map((p) => p.id)).toEqual(['proj_sample_tan']);
    expect(filterProjects(projects, 'lim wei').map((p) => p.id)).toEqual(['proj_sample_lim']);
    expect(filterProjects(projects, 'marina way').map((p) => p.id)).toEqual(['proj_sample_marina']);
    expect(filterProjects(projects, '')).toHaveLength(3);
    expect(filterProjects(projects, 'nowhere')).toHaveLength(0);
  });

  it('lists projects most recently updated first', () => {
    const { projects } = createSampleStore().getState();
    const sorted = filterProjects(projects, '');
    expect(sorted.map((p) => p.id)).toEqual([
      'proj_sample_lim',
      'proj_sample_tan',
      'proj_sample_marina',
    ]);
  });

  it('starts empty under the empty seed', () => {
    const s = createSampleStore('empty').getState();
    expect(s.projects).toHaveLength(0);
    expect(s.templates).toHaveLength(0);
    expect(s.products).toHaveLength(0);
  });

  it('updates notify subscribers with a new immutable state', () => {
    const store = createSampleStore();
    const before = store.getState();
    let calls = 0;
    store.subscribe(() => calls++);
    store.actions.deleteProject('proj_sample_tan');
    expect(calls).toBe(1);
    expect(store.getState()).not.toBe(before);
    expect(store.getState().projects.map((p) => p.id)).not.toContain('proj_sample_tan');
    expect(store.getState().plans.some((p) => p.projectId === 'proj_sample_tan')).toBe(false);
    expect(before.projects).toHaveLength(3);
  });

  it('visibleVariantsFor excludes hidden, system and other-plan variants', () => {
    const s = createSampleStore().getState();
    const lighting = visibleVariantsFor(s, 'lighting');
    expect(lighting.some((v) => v.id === 'var_sys_smart_led_driver')).toBe(false);
    expect(lighting.some((v) => v.id === 'var_luna_dl_3000')).toBe(true);
    expect(lighting.some((v) => v.id === 'var_nova_s8')).toBe(false);
  });
});

describe('createProject from a template', () => {
  it('re-keys the template export settings onto the new levels', () => {
    const tpl = structuredClone(createSampleStore().getState().templates[0]!);
    tpl.structure.exportSettings.floorPlan.hiddenCategories = ['cameras'];
    tpl.structure.exportSettings.floorPlan.levels['1'] = { smartHome: true, lighting: false };
    const store = createSampleStore('sample', { templates: [tpl] });
    const id = store.actions.createProject({
      title: 'Koh Residence',
      customerName: '',
      customerContact: '',
      propertyAddress: '',
      propertyType: null,
      status: 'draft',
      templateId: tpl.id,
    });
    const s = store.getState();
    const project = s.projects.find((p) => p.id === id)!;
    const level = s.levels.find((l) => l.projectId === id)!;
    expect(project.exportSettings.floorPlan.hiddenCategories).toEqual(['cameras']);
    expect(project.exportSettings.floorPlan.levels).toEqual({
      [level.id]: { smartHome: true, lighting: false },
    });
  });
});
