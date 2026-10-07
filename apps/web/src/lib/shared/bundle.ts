import type { SampleState, SharedBundle } from '../data/sample-store';

/**
 * Everything one project needs on another device: its levels, plans and drawings' records, and
 * the catalogue entries it uses (for devices whose catalogue lacks them).
 */
export type ProjectBundle = SharedBundle;

const idsIn = (json: string, prefix: string) =>
  new Set([...json.matchAll(new RegExp(`"(${prefix}_[A-Za-z0-9]+)"`, 'g'))].map((m) => m[1]!));

export function projectBundle(state: SampleState, projectId: string): ProjectBundle | null {
  const found = state.projects.find((p) => p.id === projectId);
  if (!found) return null;
  // What this device knows of the team copy isn't part of the project.
  const { shared: _shared, ...project } = found;
  const own = <T extends { projectId: string }>(rows: T[]) =>
    rows.filter((r) => r.projectId === projectId);
  const base = {
    project,
    levels: own(state.levels),
    plans: own(state.plans),
    sourceFiles: own(state.sourceFiles),
    sourcePages: own(state.sourcePages),
  };
  const used = idsIn(JSON.stringify(base), 'var');
  const variants = state.variants.filter((v) => used.has(v.id));
  const productIds = new Set(variants.map((v) => v.productId));
  return { ...base, variants, products: state.products.filter((p) => productIds.has(p.id)) };
}

/** Every stored file (drawings, pages, thumbnails, product pictures) the bundle refers to. */
export const bundleFileIds = (bundle: ProjectBundle) => [...idsIn(JSON.stringify(bundle), 'file')];

/**
 * A short fingerprint of what matters in a project, so a change made here since the last save or
 * load can be told apart from merely opening it (which moves "last opened" and "updated").
 */
export function bundleFingerprint(bundle: ProjectBundle): string {
  const { lastOpened: _l, updatedAt: _u, recentVariantIds: _r, ...project } = bundle.project;
  const plans = bundle.plans.map(({ updatedAt: _p, ...plan }) => plan);
  const text = JSON.stringify({ ...bundle, project, plans, products: [], variants: [] });
  // FNV-1a, 32-bit, twice with different seeds for fewer collisions.
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x811c9dc5);
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}:${text.length}`;
}
