import type { ExportSettings, PlanDocument } from './types.ts';

export const PLAN_DOCUMENT_SCHEMA_VERSION = 1 as const;

export function createEmptyPlanDocument(): PlanDocument {
  return {
    schemaVersion: PLAN_DOCUMENT_SCHEMA_VERSION,
    elements: [],
    view: { hiddenCategories: [], legendVisible: true },
  };
}

/** The z value a newly added element should take so that it renders on top. */
export function nextZ(doc: PlanDocument): number {
  let max = -1;
  for (const el of doc.elements) if (el.z > max) max = el.z;
  return max + 1;
}

export function defaultExportSettings(levelIds: string[]): ExportSettings {
  const levels: ExportSettings['floorPlan']['levels'] = {};
  for (const id of levelIds) levels[id] = { smartHome: true, lighting: true };
  return {
    floorPlan: {
      showCustomerName: true,
      showCustomerContact: true,
      showPropertyAddress: true,
      levels,
      hiddenCategories: [],
      showLabels: true,
      showLedLengths: true,
      showTrackLabels: true,
      showNotes: true,
      showLegend: true,
    },
    productDescription: {
      showCustomerName: true,
      showCustomerContact: true,
      showPropertyAddress: true,
      excludedCategories: [],
    },
  };
}
