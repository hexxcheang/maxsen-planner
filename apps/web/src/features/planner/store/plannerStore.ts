/**
 * Editor state for the planner. Phase A implements selection and marker moves; the shape is final
 * so Phase E adds undo/redo, duplication, layering and autosave without changing consumers.
 */
import { produce } from 'immer';
import { createStore } from 'zustand/vanilla';
import type { PlanDocument, PlanType } from '@maxsen/domain';

export type PlannerTool = 'select' | 'pan';

export interface Viewport {
  /** Screen pixels per plan unit. */
  scale: number;
  x: number;
  y: number;
}

export interface PlannerState {
  projectId: string | null;
  levelId: string | null;
  planType: PlanType;
  planId: string | null;
  document: PlanDocument;
  selection: string[];
  tool: PlannerTool;
  viewport: Viewport;
  load: (input: {
    projectId: string;
    levelId: string;
    planType: PlanType;
    planId: string | null;
    document: PlanDocument | null;
  }) => void;
  select: (ids: string[], mode: 'replace' | 'toggle') => void;
  moveElements: (ids: string[], dx: number, dy: number) => void;
  setViewport: (viewport: Viewport) => void;
  setTool: (tool: PlannerTool) => void;
}

const EMPTY: PlanDocument = {
  schemaVersion: 1,
  elements: [],
  view: { hiddenCategories: [], legendVisible: true },
};

export function createPlannerStore() {
  return createStore<PlannerState>()((set) => ({
    projectId: null,
    levelId: null,
    planType: 'smart-home',
    planId: null,
    document: EMPTY,
    selection: [],
    tool: 'select',
    viewport: { scale: 1, x: 0, y: 0 },

    load: ({ projectId, levelId, planType, planId, document }) =>
      set({ projectId, levelId, planType, planId, document: document ?? EMPTY, selection: [] }),

    select: (ids, mode) =>
      set((s) => {
        if (mode === 'replace') return { selection: [...ids] };
        const next = s.selection.filter((id) => !ids.includes(id));
        for (const id of ids) if (!s.selection.includes(id)) next.push(id);
        return { selection: next };
      }),

    moveElements: (ids, dx, dy) =>
      set((s) => {
        const moving = new Set(ids);
        return {
          document: produce(s.document, (d) => {
            for (const el of d.elements) {
              if (!moving.has(el.id)) continue;
              if (el.kind === 'marker' || el.kind === 'note') {
                el.x += dx;
                el.y += dy;
              } else {
                for (const p of el.points) {
                  p.x += dx;
                  p.y += dy;
                }
              }
            }
          }),
        };
      }),

    setViewport: (viewport) => set({ viewport }),
    setTool: (tool) => set({ tool }),
  }));
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;
