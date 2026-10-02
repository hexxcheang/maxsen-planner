/**
 * Editor state for the planner: the open plan's document, selection, tools, the placement or path
 * drawing in progress, and undo/redo over document snapshots (one entry per completed gesture).
 * View state (hidden categories, legend) is saved with the document but never undoable.
 */
import { produce, type Draft } from 'immer';
import { createStore } from 'zustand/vanilla';
import {
  circlePoints,
  newId,
  nextZ,
  type PlanDocument,
  type PlanElement,
  type PlanType,
  type PlanViewState,
  snapToAxes,
  type Pt,
} from '@maxsen/domain';

export type PlannerTool = 'select' | 'pan';

/** What a click on the canvas will create. */
export type Armed =
  | { kind: 'marker'; variantId: string }
  | { kind: 'path'; variantId: string; elementKind: 'led-strip' | 'track' | 'curtain' }
  | { kind: 'loop'; variantId: string }
  | { kind: 'note' };

export interface Viewport {
  /** Screen pixels per plan unit. */
  scale: number;
  x: number;
  y: number;
}

type ElementPatch = Partial<Omit<PlanElement, 'kind' | 'id'>> & Record<string, unknown>;

export interface PlannerState {
  projectId: string | null;
  levelId: string | null;
  planType: PlanType;
  planId: string | null;
  document: PlanDocument;
  past: PlanDocument[];
  future: PlanDocument[];
  selection: string[];
  tool: PlannerTool;
  viewport: Viewport;
  armed: Armed | null;
  /** Points of the LED strip or track being drawn. */
  draft: Pt[];

  load: (input: {
    projectId: string;
    levelId: string;
    planType: PlanType;
    planId: string | null;
    document: PlanDocument | null;
  }) => void;
  select: (ids: string[], mode: 'replace' | 'toggle') => void;
  selectAll: () => void;
  moveElements: (ids: string[], dx: number, dy: number) => void;
  setViewport: (viewport: Viewport) => void;
  setTool: (tool: PlannerTool) => void;

  addMarker: (variantId: string, at: Pt) => string;
  addNote: (at: Pt) => string;
  addLoop: (variantId: string, centre: Pt, radius: number) => string;
  updateElement: (id: string, patch: ElementPatch) => void;
  deleteSelection: () => void;
  duplicateSelection: (offset: number) => string | null;
  /** Copies the selection (Ctrl/Cmd+C). Returns how many items were copied. */
  copySelection: () => number;
  /**
   * Pastes what was copied beside it (Ctrl/Cmd+V), further along each time, and selects it.
   * Returns the new ids; none when nothing was copied or it was copied on the other plan type.
   */
  paste: () => string[];
  reorder: (mode: 'front' | 'forward' | 'backward' | 'back') => void;
  setView: (patch: Partial<PlanViewState>) => void;
  /** Replaces the whole document as one undoable step (Magic Plan). */
  applyDocument: (doc: PlanDocument) => void;
  undo: () => void;
  redo: () => void;

  arm: (armed: Armed | null) => void;
  addDraftPoint: (p: Pt, orthogonal: boolean) => void;
  popDraftPoint: () => void;
  finishDraft: () => string | null;
}

const EMPTY: PlanDocument = {
  schemaVersion: 1,
  elements: [],
  view: { hiddenCategories: [], legendVisible: true },
};
const HISTORY_LIMIT = 100;
/** Gap left between a copied item and its pasted copy, in plan units. */
const PASTE_GAP = 10;
/** Width a single icon is given when working out where its copy goes (the largest icon size). */
const ICON_ROOM = 30;

/**
 * What was copied, shared by every plan so items can be pasted on another level too. `pastes`
 * counts the copies made so far, so each lands beside the last.
 */
let clipboard: { planType: PlanType; elements: PlanElement[]; pastes: number } | null = null;

/** Left and right edges of the elements, in plan units. */
function spanX(elements: PlanElement[]): { left: number; right: number } {
  let left = Infinity;
  let right = -Infinity;
  for (const el of elements) {
    const xs = el.kind === 'marker' || el.kind === 'note' ? [el.x] : el.points.map((p) => p.x);
    for (const x of xs) {
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  return { left, right };
}
const round = (n: number) => Math.round(n * 10) / 10;
const rpt = (p: Pt): Pt => ({ x: round(p.x), y: round(p.y) });

/** Snaps `p` to the horizontal or vertical through `from`, whichever is closer. */
function orthogonal(from: Pt, p: Pt): Pt {
  return Math.abs(p.x - from.x) >= Math.abs(p.y - from.y)
    ? { x: p.x, y: from.y }
    : { x: from.x, y: p.y };
}

function shift(el: Draft<PlanElement>, dx: number, dy: number) {
  if (el.kind === 'marker' || el.kind === 'note') {
    el.x = round(el.x + dx);
    el.y = round(el.y + dy);
  } else {
    for (const p of el.points) {
      p.x = round(p.x + dx);
      p.y = round(p.y + dy);
    }
  }
}

export function createPlannerStore() {
  return createStore<PlannerState>()((set, get) => {
    /** Applies an undoable change and records the previous document. */
    const commit = (recipe: (d: Draft<PlanDocument>) => void, extra: Partial<PlannerState> = {}) =>
      set((s) => {
        const next = produce(s.document, recipe);
        if (next === s.document) return extra;
        return {
          ...extra,
          document: next,
          past: [...s.past, s.document].slice(-HISTORY_LIMIT),
          future: [],
        };
      });

    const add = (el: PlanElement) => {
      commit(
        (d) => {
          d.elements.push(el);
        },
        { selection: [el.id] },
      );
      return el.id;
    };

    return {
      projectId: null,
      levelId: null,
      planType: 'smart-home',
      planId: null,
      document: EMPTY,
      past: [],
      future: [],
      selection: [],
      tool: 'select',
      viewport: { scale: 1, x: 0, y: 0 },
      armed: null,
      draft: [],

      load: ({ projectId, levelId, planType, planId, document }) =>
        set((s) => {
          const same = s.planId === planId && planId !== null;
          return {
            projectId,
            levelId,
            planType,
            planId,
            document: document ?? EMPTY,
            selection: same ? s.selection : [],
            past: same ? s.past : [],
            future: same ? s.future : [],
            armed: same ? s.armed : null,
            draft: same ? s.draft : [],
          };
        }),

      select: (ids, mode) =>
        set((s) => {
          if (mode === 'replace') return { selection: [...ids] };
          const next = s.selection.filter((id) => !ids.includes(id));
          for (const id of ids) if (!s.selection.includes(id)) next.push(id);
          return { selection: next };
        }),

      selectAll: () => set((s) => ({ selection: s.document.elements.map((e) => e.id) })),

      moveElements: (ids, dx, dy) => {
        const moving = new Set(ids);
        commit((d) => {
          for (const el of d.elements) if (moving.has(el.id)) shift(el, dx, dy);
        });
      },

      setViewport: (viewport) => set({ viewport }),
      setTool: (tool) => set({ tool, armed: null, draft: [] }),

      addMarker: (variantId, at) =>
        add({
          kind: 'marker',
          id: newId('el'),
          z: nextZ(get().document),
          variantId,
          ...rpt(at),
          rotation: 0,
          label: '',
        }),

      addNote: (at) =>
        add({
          kind: 'note',
          id: newId('el'),
          z: nextZ(get().document),
          ...rpt(at),
          text: 'Note',
          fontSize: 14,
          bold: false,
          color: '#1F1D1A',
          highlight: null,
        }),

      addLoop: (variantId, centre, radius) =>
        add({
          kind: 'led-strip',
          id: newId('el'),
          z: nextZ(get().document),
          variantId,
          points: circlePoints(centre, radius).map(rpt),
          closed: true,
          smooth: true,
          metres: null,
          showLabel: false,
        }),

      updateElement: (id, patch) =>
        commit((d) => {
          const el = d.elements.find((e) => e.id === id);
          if (el) Object.assign(el, patch);
        }),

      deleteSelection: () => {
        const ids = new Set(get().selection);
        if (ids.size === 0) return;
        commit(
          (d) => {
            d.elements = d.elements.filter((e) => !ids.has(e.id));
          },
          { selection: [] },
        );
      },

      duplicateSelection: (offset) => {
        const { selection, document } = get();
        const source = document.elements.find((e) => e.id === selection[0]);
        if (selection.length !== 1 || !source) return null;
        const copy = produce(source, (c) => {
          c.id = newId('el');
          c.z = nextZ(document);
          shift(c, offset, offset);
        });
        return add(copy);
      },

      copySelection: () => {
        const { selection, document, planType } = get();
        const ids = new Set(selection);
        const elements = document.elements
          .filter((e) => ids.has(e.id))
          .sort((a, b) => a.z - b.z)
          .map((e) => structuredClone(e));
        if (elements.length === 0) return 0;
        clipboard = { planType, elements, pastes: 0 };
        return elements.length;
      },

      paste: () => {
        const { document, planType } = get();
        if (!clipboard || clipboard.planType !== planType) return [];
        const { left, right } = spanX(clipboard.elements);
        // Beside the copied items: one width (an icon's, at least) plus a gap to the right of the
        // last copy, or to the left when that would run off the drawing.
        const step = Math.max(right - left, 0) + ICON_ROOM + PASTE_GAP;
        let n = clipboard.pastes + 1;
        if (right + step * n > 1000) n = -n;
        clipboard.pastes = Math.abs(n);
        let z = nextZ(document);
        const copies = clipboard.elements.map((el) =>
          produce(el, (c) => {
            c.id = newId('el');
            c.z = z++;
            shift(c, step * n, 0);
          }),
        );
        const ids = copies.map((c) => c.id);
        commit(
          (d) => {
            d.elements.push(...(copies as Draft<PlanElement>[]));
          },
          { selection: ids },
        );
        return ids;
      },

      reorder: (mode) => {
        const ids = new Set(get().selection);
        if (ids.size === 0) return;
        commit((d) => {
          const ordered = [...d.elements].sort((a, b) => a.z - b.z);
          const picked = ordered.filter((e) => ids.has(e.id));
          const rest = ordered.filter((e) => !ids.has(e.id));
          let result: typeof ordered;
          if (mode === 'front') result = [...rest, ...picked];
          else if (mode === 'back') result = [...picked, ...rest];
          else {
            // Move the selection one step past its nearest unselected neighbour.
            result = [...ordered];
            const step = mode === 'forward' ? 1 : -1;
            const idx = result.map((e, i) => (ids.has(e.id) ? i : -1)).filter((i) => i >= 0);
            for (const i of step === 1 ? idx.reverse() : idx) {
              const j = i + step;
              const a = result[i]!;
              const b = result[j];
              if (b && !ids.has(b.id)) [result[i], result[j]] = [b, a];
            }
          }
          result.forEach((e, i) => (e.z = i));
        });
      },

      applyDocument: (doc) =>
        set((s) => ({
          document: { ...doc, view: s.document.view },
          past: [...s.past, s.document].slice(-HISTORY_LIMIT),
          future: [],
          selection: [],
        })),

      setView: (patch) =>
        set((s) => ({ document: { ...s.document, view: { ...s.document.view, ...patch } } })),

      undo: () =>
        set((s) => {
          const prev = s.past.at(-1);
          if (!prev) return {};
          return {
            document: { ...prev, view: s.document.view },
            past: s.past.slice(0, -1),
            future: [s.document, ...s.future],
            selection: s.selection.filter((id) => prev.elements.some((e) => e.id === id)),
          };
        }),

      redo: () =>
        set((s) => {
          const next = s.future[0];
          if (!next) return {};
          return {
            document: { ...next, view: s.document.view },
            past: [...s.past, s.document],
            future: s.future.slice(1),
          };
        }),

      arm: (armed) =>
        set({ armed, draft: [], tool: 'select', selection: armed ? [] : get().selection }),

      addDraftPoint: (p, ortho) =>
        set((s) => {
          const last = s.draft.at(-1);
          // Shift forces a straight segment; otherwise one that's nearly straight snaps straight.
          const point = rpt(last ? (ortho ? orthogonal(last, p) : snapToAxes(p, [last])) : p);
          if (last && last.x === point.x && last.y === point.y) return {};
          return { draft: [...s.draft, point] };
        }),

      popDraftPoint: () => set((s) => ({ draft: s.draft.slice(0, -1) })),

      finishDraft: () => {
        const { armed, draft, document } = get();
        if (armed?.kind !== 'path' || draft.length < 2) return null;
        const base = {
          id: newId('el'),
          z: nextZ(document),
          variantId: armed.variantId,
          points: draft,
        };
        // LED lengths aren't shown on the plan; they're settled in Review totals.
        const id =
          armed.elementKind === 'led-strip'
            ? add({
                ...base,
                kind: 'led-strip',
                closed: false,
                smooth: false,
                metres: null,
                showLabel: false,
              })
            : armed.elementKind === 'curtain'
              ? add({ ...base, kind: 'curtain' })
              : add({ ...base, kind: 'track', headCount: 3, showLabel: true });
        set({ draft: [] });
        return id;
      },
    };
  });
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;
