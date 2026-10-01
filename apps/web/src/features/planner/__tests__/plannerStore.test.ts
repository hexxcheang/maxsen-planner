import { describe, expect, it } from 'vitest';
import { sample } from '@maxsen/domain';
import { createPlannerStore } from '../store/plannerStore';

const plan = sample.SAMPLE_PLANS.find((p) => p.id === 'plan_tan_1_sh')!;

function loaded() {
  const store = createPlannerStore();
  store.getState().load({
    projectId: plan.projectId,
    levelId: plan.levelId,
    planType: plan.type,
    planId: plan.id,
    document: plan.document,
  });
  return store;
}

describe('plannerStore', () => {
  it('select replace and toggle', () => {
    const store = loaded();
    const [a, b] = store.getState().document.elements;
    store.getState().select([a!.id], 'replace');
    expect(store.getState().selection).toEqual([a!.id]);
    store.getState().select([b!.id], 'toggle');
    expect(store.getState().selection).toEqual([a!.id, b!.id]);
    store.getState().select([a!.id], 'toggle');
    expect(store.getState().selection).toEqual([b!.id]);
    store.getState().select([], 'replace');
    expect(store.getState().selection).toEqual([]);
  });

  it('moveElements shifts only selected markers', () => {
    const store = loaded();
    const markers = store.getState().document.elements.filter((e) => e.kind === 'marker');
    const [m1, m2] = markers;
    if (m1?.kind !== 'marker' || m2?.kind !== 'marker') throw new Error('need markers');
    store.getState().moveElements([m1.id], 10, -5);
    const after = store.getState().document.elements;
    const n1 = after.find((e) => e.id === m1.id);
    const n2 = after.find((e) => e.id === m2.id);
    expect(n1).toMatchObject({ x: m1.x + 10, y: m1.y - 5 });
    expect(n2).toMatchObject({ x: m2.x, y: m2.y });
  });

  it('loading a new plan clears the selection', () => {
    const store = loaded();
    store.getState().select([store.getState().document.elements[0]!.id], 'replace');
    store.getState().load({
      projectId: plan.projectId,
      levelId: plan.levelId,
      planType: 'lighting',
      planId: 'plan_tan_1_lt',
      document: sample.SAMPLE_PLANS.find((p) => p.id === 'plan_tan_1_lt')!.document,
    });
    expect(store.getState().selection).toEqual([]);
  });

  it('switches tools', () => {
    const store = loaded();
    store.getState().setTool('pan');
    expect(store.getState().tool).toBe('pan');
  });
});
