import { describe, expect, it } from 'vitest';
import { createEmptyPlanDocument, type PlanDocument } from '@maxsen/domain';
import { createPlannerStore } from '../store/plannerStore';

function fresh(doc: PlanDocument = createEmptyPlanDocument()) {
  const store = createPlannerStore();
  store
    .getState()
    .load({ projectId: 'p', levelId: 'l', planType: 'lighting', planId: 'plan', document: doc });
  return store;
}

describe('planner editing', () => {
  it('places a marker on top and selects it', () => {
    const s = fresh();
    const a = s.getState().addMarker('var_a', { x: 10, y: 20 });
    const b = s.getState().addMarker('var_b', { x: 30, y: 40 });
    const els = s.getState().document.elements;
    expect(els.find((e) => e.id === b)?.z).toBeGreaterThan(els.find((e) => e.id === a)!.z);
    expect(s.getState().selection).toEqual([b]);
  });

  it('undo and redo step through document changes', () => {
    const s = fresh();
    s.getState().addMarker('var_a', { x: 10, y: 20 });
    s.getState().addMarker('var_b', { x: 30, y: 40 });
    s.getState().undo();
    expect(s.getState().document.elements).toHaveLength(1);
    s.getState().undo();
    expect(s.getState().document.elements).toHaveLength(0);
    s.getState().redo();
    expect(s.getState().document.elements).toHaveLength(1);
    s.getState().addMarker('var_c', { x: 0, y: 0 });
    s.getState().redo();
    expect(s.getState().document.elements.map((e) => e.kind === 'marker' && e.variantId)).toEqual([
      'var_a',
      'var_c',
    ]);
  });

  it('view changes are saved but not undoable', () => {
    const s = fresh();
    s.getState().addMarker('var_a', { x: 1, y: 1 });
    s.getState().setView({ legendVisible: false });
    s.getState().undo();
    expect(s.getState().document.elements).toHaveLength(0);
    expect(s.getState().document.view.legendVisible).toBe(false);
  });

  it('draws a path from draft points with orthogonal assist', () => {
    const s = fresh();
    s.getState().arm({ kind: 'path', variantId: 'var_led', elementKind: 'led-strip' });
    s.getState().addDraftPoint({ x: 0, y: 0 }, false);
    s.getState().addDraftPoint({ x: 100, y: 7 }, true);
    s.getState().addDraftPoint({ x: 104, y: 60 }, true);
    const id = s.getState().finishDraft();
    const el = s.getState().document.elements.find((e) => e.id === id);
    expect(el).toMatchObject({ kind: 'led-strip', metres: null, closed: false });
    expect(el?.kind === 'led-strip' && el.points).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 60 },
    ]);
    expect(s.getState().draft).toEqual([]);
  });

  it('a draft needs two points', () => {
    const s = fresh();
    s.getState().arm({ kind: 'path', variantId: 'var_t', elementKind: 'track' });
    s.getState().addDraftPoint({ x: 0, y: 0 }, false);
    expect(s.getState().finishDraft()).toBeNull();
    expect(s.getState().document.elements).toHaveLength(0);
  });

  it('updates, duplicates, deletes and reorders', () => {
    const s = fresh();
    const a = s.getState().addMarker('var_a', { x: 10, y: 10 });
    const b = s.getState().addMarker('var_b', { x: 20, y: 20 });
    s.getState().updateElement(a, { label: 'Entrance', rotation: 90 });
    expect(s.getState().document.elements.find((e) => e.id === a)).toMatchObject({
      label: 'Entrance',
      rotation: 90,
    });
    s.getState().select([a], 'replace');
    s.getState().reorder('front');
    const z = (id: string) => s.getState().document.elements.find((e) => e.id === id)!.z;
    expect(z(a)).toBeGreaterThan(z(b));
    const dup = s.getState().duplicateSelection(20)!;
    expect(s.getState().document.elements.find((e) => e.id === dup)).toMatchObject({
      x: 30,
      y: 30,
      label: 'Entrance',
    });
    s.getState().select([a, b], 'replace');
    s.getState().deleteSelection();
    expect(s.getState().document.elements.map((e) => e.id)).toEqual([dup]);
  });

  it('copies the selection and pastes it beside the original, further along each time', () => {
    const s = fresh();
    const a = s.getState().addMarker('var_a', { x: 100, y: 50 });
    s.getState().select([a], 'replace');
    expect(s.getState().paste()).toEqual([]);
    expect(s.getState().copySelection()).toBe(1);
    const [first] = s.getState().paste();
    const at = (id: string) => s.getState().document.elements.find((e) => e.id === id)!;
    expect(at(first!)).toMatchObject({ kind: 'marker', variantId: 'var_a', y: 50 });
    const x1 = (at(first!) as { x: number }).x;
    expect(x1).toBeGreaterThan(100);
    expect(s.getState().selection).toEqual([first]);
    const [second] = s.getState().paste();
    expect((at(second!) as { x: number }).x - x1).toBeCloseTo(x1 - 100);
    // One undo takes one paste off.
    s.getState().undo();
    expect(s.getState().document.elements).toHaveLength(2);
  });

  it('draws a curtain as a track of points', () => {
    const s = fresh();
    s.getState().arm({ kind: 'path', variantId: 'var_curtain', elementKind: 'curtain' });
    s.getState().addDraftPoint({ x: 10, y: 10 }, false);
    s.getState().addDraftPoint({ x: 110, y: 10 }, false);
    const id = s.getState().finishDraft()!;
    expect(s.getState().document.elements.find((e) => e.id === id)).toMatchObject({
      kind: 'curtain',
      points: [
        { x: 10, y: 10 },
        { x: 110, y: 10 },
      ],
    });
  });

  it('adds a closed smooth LED loop for the circle tool', () => {
    const s = fresh();
    const id = s.getState().addLoop('var_led', { x: 100, y: 100 }, 40);
    const el = s.getState().document.elements.find((e) => e.id === id);
    expect(el).toMatchObject({ kind: 'led-strip', closed: true, smooth: true });
    expect(el?.kind === 'led-strip' && el.points).toHaveLength(8);
  });

  it('reloading the same plan keeps history; a different plan clears it', () => {
    const s = fresh();
    s.getState().addMarker('var_a', { x: 1, y: 1 });
    const doc = s.getState().document;
    s.getState().load({
      projectId: 'p',
      levelId: 'l',
      planType: 'lighting',
      planId: 'plan',
      document: doc,
    });
    expect(s.getState().past).toHaveLength(1);
    s.getState().load({
      projectId: 'p',
      levelId: 'l',
      planType: 'lighting',
      planId: 'other',
      document: doc,
    });
    expect(s.getState().past).toHaveLength(0);
  });
});
