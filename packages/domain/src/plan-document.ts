import { planDocumentSchema } from './schemas.ts';
import type { ExportSettings, PlanDocument } from './types.ts';

export const PLAN_DOCUMENT_SCHEMA_VERSION = 1 as const;

export function createEmptyPlanDocument(): PlanDocument {
  return {
    schemaVersion: PLAN_DOCUMENT_SCHEMA_VERSION,
    elements: [],
    view: { hiddenCategories: [], legendVisible: true },
  };
}

export class PlanDocumentError extends Error {
  override name = 'PlanDocumentError';
}

/**
 * Turns stored JSON into a current-version document. Older versions are upgraded here, one step
 * at a time, before validation; anything that still fails validation is rejected.
 */
export function migratePlanDocument(raw: unknown): PlanDocument {
  if (typeof raw !== 'object' || raw === null) {
    throw new PlanDocumentError('Plan document is not an object');
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== 'number')
    throw new PlanDocumentError('Plan document has no schemaVersion');
  if (version > PLAN_DOCUMENT_SCHEMA_VERSION) {
    throw new PlanDocumentError(
      `Plan document version ${version} is newer than this app supports (${PLAN_DOCUMENT_SCHEMA_VERSION})`,
    );
  }
  // Future versions chain upgrades here: if (version === 1) raw = upgrade1to2(raw); …
  const result = planDocumentSchema.safeParse(raw);
  if (!result.success) {
    throw new PlanDocumentError(`Plan document is invalid: ${result.error.message}`);
  }
  return result.data;
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
