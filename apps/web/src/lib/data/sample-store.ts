/**
 * Phase A in-memory data store, seeded from the domain sample data. Screens never touch it
 * directly: they go through the hooks in `hooks.ts`, whose signatures Phase B keeps while swapping
 * this store for the API.
 */
import { produce, type Draft } from 'immer';
import {
  curtainIconsToTracks,
  categoryById,
  createEmptyPlanDocument,
  SYSTEM_VARIANT_IDS,
  defaultExportSettings,
  lineKey,
  newId,
  sample,
  setAdjustment,
  type CategoryId,
  type CropRect,
  type RoomLayout,
  type ExportSettings,
  type Level,
  type Orientation,
  type PaperSize,
  type Plan,
  type PlanDocument,
  type Rotation,
  type PlanType,
  type Product,
  type Project,
  type ProjectDetails,
  type ProjectSchedule,
  type SharedState,
  type Settings,
  type SourceFile,
  type SourcePage,
  type Template,
  type Variant,
  type VariantSnapshot,
} from '@maxsen/domain';

export interface SampleState {
  projects: Project[];
  levels: Level[];
  plans: Plan[];
  sourceFiles: SourceFile[];
  sourcePages: SourcePage[];
  products: Product[];
  variants: Variant[];
  settings: Settings;
  templates: Template[];
}

export type SampleSeed = 'sample' | 'empty';

/** A project as saved for the team (see `lib/shared/bundle.ts`). */
export interface SharedBundle {
  project: Project;
  levels: Level[];
  plans: Plan[];
  sourceFiles: SourceFile[];
  sourcePages: SourcePage[];
  products: Product[];
  variants: Variant[];
}

/**
 * Brings a saved workspace up to date: variants saved before prices existed take the catalogue
 * price, and products of a category the saved catalogue has never had are added from the sample
 * catalogue. Products the user deleted from an existing category are not brought back. Curtains
 * saved as icons become dotted curtain tracks.
 */
export function addNewSampleCategories(saved: SampleState): SampleState {
  return smartLighting(addNewVariants(addNewCategories(curtainsAsTracks(realShowrooms(saved)))));
}

/**
 * The lights' and LED strips' wording before they were all smart CCT (tunable 2700K–6000K, CRI 98,
 * app control): a saved variant still worded so takes the catalogue's new name and description.
 * The 4000K downlight and cove strip, now the same as the 3000K ones, are hidden from the library
 * (projects that used them still show them). Wording someone changed is left as it is.
 */
const OLD_LIGHTING: Record<string, { name: string; description: string; to?: string }> = {
  var_luna_dl_3000: {
    name: '3000K',
    description: 'Recessed downlight in warm white (3000K) for living areas and bedrooms.',
  },
  var_luna_dl_4000: {
    name: '4000K',
    description: 'Recessed downlight in neutral white (4000K) for kitchens and work areas.',
    to: 'var_luna_dl_3000',
  },
  var_luna_antiglare: {
    name: 'Standard',
    description: 'Deep-recessed anti-glare downlight for bathrooms and corridors.',
  },
  var_lumi_surface_round: {
    name: 'Round',
    description:
      'Slim surface-mounted round light for yards, shelters and false-ceiling-free areas.',
  },
  var_lumi_surface_square: {
    name: 'Square',
    description:
      'Slim surface-mounted square light for yards, shelters and false-ceiling-free areas.',
  },
  var_luna_track_black: {
    name: 'Black',
    description:
      'Surface track in matte black with adjustable spot heads for feature walls and dining.',
  },
  var_luna_track_white: {
    name: 'White',
    description:
      'Surface track in matte white with adjustable spot heads for feature walls and dining.',
  },
  var_lumi_cove_3000: {
    name: '3000K',
    description: 'Dimmable cove LED strip in warm white (3000K) for ceiling and cabinet coves.',
  },
  var_lumi_cove_4000: {
    name: '4000K',
    description: 'Dimmable cove LED strip in neutral white (4000K) for ceiling and cabinet coves.',
    to: 'var_lumi_cove_3000',
  },
  var_lumi_cove_rgbcct: {
    name: 'RGBCCT',
    description:
      'Cove LED strip in any colour plus tunable white (2700–6500K), upgraded from the CCT strip in the package.',
  },
  var_lumi_cob_3000: {
    name: '3000K',
    description: 'Dot-free COB LED strip in warm white (3000K) for exposed profiles and shelves.',
  },
};

export function smartLighting<T extends { variants: Variant[] }>(saved: T): T {
  const now = sample.SAMPLE_VARIANTS;
  let changed = false;
  const variants = saved.variants.map((v) => {
    const old = OLD_LIGHTING[v.id];
    const next = now.find((n) => n.id === (old?.to ?? v.id));
    if (!old || !next) return v;
    const rename = v.name === old.name && v.name !== next.name;
    const reword = v.description === old.description && v.description !== next.description;
    if (!rename && !reword) return v;
    changed = true;
    return {
      ...v,
      ...(rename ? { name: next.name } : {}),
      ...(reword ? { description: next.description } : {}),
      ...(old.to && rename ? { hidden: true } : {}),
    };
  });
  return changed ? { ...saved, variants } : saved;
}

/** Sample variants added after launch, offered once to catalogues that have their product. */
const NEW_SAMPLE_VARIANTS = ['var_lumi_cove_rgbcct'];

function addNewVariants(state: SampleState): SampleState {
  const offered = new Set(state.settings.offeredVariantIds ?? []);
  const have = new Set(state.variants.map((v) => v.id));
  const products = new Set(state.products.map((p) => p.id));
  const fresh = sample.SAMPLE_VARIANTS.filter(
    (v) =>
      NEW_SAMPLE_VARIANTS.includes(v.id) &&
      !offered.has(v.id) &&
      !have.has(v.id) &&
      products.has(v.productId),
  );
  if (!fresh.length) return state;
  return {
    ...state,
    variants: [...state.variants, ...structuredClone(fresh)],
    settings: {
      ...state.settings,
      offeredVariantIds: [...offered, ...fresh.map((v) => v.id)],
    },
  };
}

/** Showrooms still at the placeholder addresses get Maxsen's real ones. */
function realShowrooms(state: SampleState): SampleState {
  const showrooms = state.settings.branding.showrooms;
  if (!showrooms.some((r) => sample.PLACEHOLDER_SHOWROOMS[r.address])) return state;
  return {
    ...state,
    settings: {
      ...state.settings,
      branding: {
        ...state.settings.branding,
        showrooms: showrooms.map((r) => ({
          ...r,
          address: sample.PLACEHOLDER_SHOWROOMS[r.address] ?? r.address,
        })),
      },
    },
  };
}

function addNewCategories(saved: SampleState): SampleState {
  // Variants saved before prices existed take the catalogue price.
  const priced = new Map(sample.SAMPLE_VARIANTS.map((v) => [v.id, v.price ?? null]));
  const state = saved.variants.some((v) => v.price === undefined)
    ? {
        ...saved,
        variants: saved.variants.map((v) =>
          v.price === undefined ? { ...v, price: priced.get(v.id) ?? null } : v,
        ),
      }
    : saved;
  // Categories with products, or emptied on purpose, aren't topped up from the samples.
  const known = new Set([
    ...state.products.map((p) => p.categoryId),
    ...(state.settings.emptiedCategories ?? []),
  ]);
  const fresh = sample.SAMPLE_PRODUCTS.filter((p) => !known.has(p.categoryId));
  if (fresh.length === 0 || state.products.length === 0) return state;
  return withNewCategories(state, fresh);
}

/** Curtains saved as icons become dotted curtain tracks. */
function curtainsAsTracks(state: SampleState): SampleState {
  const products = new Set(
    state.products.filter((p) => p.categoryId === 'curtains-blinds').map((p) => p.id),
  );
  const curtains = new Set(
    state.variants.filter((v) => products.has(v.productId)).map((v) => v.id),
  );
  if (curtains.size === 0) return state;
  let changed = false;
  const plans = state.plans.map((p) => {
    const document = curtainIconsToTracks(p.document, curtains);
    if (document === p.document) return p;
    changed = true;
    return { ...p, document };
  });
  return changed ? { ...state, plans } : state;
}

function withNewCategories(state: SampleState, fresh: Product[]): SampleState {
  const ids = new Set(fresh.map((p) => p.id));
  const maxOrder = Math.max(0, ...state.products.map((p) => p.sortOrder));
  return {
    ...state,
    products: [
      ...state.products,
      ...fresh.map((p, i) => ({ ...structuredClone(p), sortOrder: maxOrder + i + 1 })),
    ],
    variants: [
      ...state.variants,
      ...structuredClone(sample.SAMPLE_VARIANTS.filter((v) => ids.has(v.productId))),
    ],
  };
}

function seed(kind: SampleSeed): SampleState {
  if (kind === 'empty') {
    return {
      projects: [],
      levels: [],
      plans: [],
      sourceFiles: [],
      sourcePages: [],
      products: [],
      variants: [],
      settings: structuredClone(sample.SAMPLE_SETTINGS),
      templates: [],
    };
  }
  return structuredClone({
    projects: sample.SAMPLE_PROJECTS,
    levels: sample.SAMPLE_LEVELS,
    plans: sample.SAMPLE_PLANS,
    sourceFiles: sample.SAMPLE_SOURCE_FILES,
    sourcePages: sample.SAMPLE_SOURCE_PAGES,
    products: sample.SAMPLE_PRODUCTS,
    variants: sample.SAMPLE_VARIANTS,
    settings: sample.SAMPLE_SETTINGS,
    templates: sample.SAMPLE_TEMPLATES,
  });
}

// --- pure selectors (also used directly by tests) ---------------------------------------------

/** Projects matching `search` in title, customer name or address; most recently updated first. */
export function filterProjects(projects: Project[], search = ''): Project[] {
  const q = search.trim().toLowerCase();
  return projects
    .filter(
      (p) =>
        q === '' ||
        p.title.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q) ||
        p.propertyAddress.toLowerCase().includes(q),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Variants the device library may offer for a plan type: not hidden, not system, right category. */
export function visibleVariantsFor(
  state: Pick<SampleState, 'products' | 'variants'>,
  planType: PlanType,
): Variant[] {
  const products = new Map(state.products.map((p) => [p.id, p]));
  return state.variants.filter((v) => {
    const product = products.get(v.productId);
    if (!product || product.hidden || product.system || v.hidden) return false;
    return categoryById(product.categoryId).planType === planType;
  });
}

/** Resolves a variant through the project's snapshot first, then the live catalogue. */
export function resolverFor(
  project: Project | undefined,
  state: Pick<SampleState, 'products' | 'variants'>,
): (variantId: string) => VariantSnapshot | undefined {
  const variants = new Map(state.variants.map((v) => [v.id, v]));
  const products = new Map(state.products.map((p) => [p.id, p]));
  return (variantId) => {
    const snap = project?.catalogueSnapshot[variantId];
    if (snap) return snap;
    const v = variants.get(variantId);
    const p = v ? products.get(v.productId) : undefined;
    if (!v || !p) return undefined;
    return {
      variantId: v.id,
      productId: p.id,
      categoryId: p.categoryId,
      productName: p.name,
      variantName: v.name,
      description: v.description,
      imageFileId: v.imageFileId,
      capturedAt: v.updatedAt,
    };
  };
}

function categoryOfVariant(state: Pick<SampleState, 'products' | 'variants'>, variantId: string) {
  const v = state.variants.find((x) => x.id === variantId);
  const p = v ? state.products.find((x) => x.id === v.productId) : undefined;
  return p ? categoryById(p.categoryId).kind : undefined;
}

export const levelsOf = (state: SampleState, projectId: string): Level[] =>
  state.levels.filter((l) => l.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder);

export const plansOf = (state: SampleState, projectId: string): Plan[] =>
  state.plans.filter((p) => p.projectId === projectId);

/** Template export settings are keyed by level sort order; a new project keys them by level id. */
function rekeyExportSettings(
  source: ExportSettings,
  idBySortOrder: Map<string, string>,
  levelIds: string[],
): ExportSettings {
  const copy = structuredClone(source);
  const levels: ExportSettings['floorPlan']['levels'] =
    defaultExportSettings(levelIds).floorPlan.levels;
  for (const [order, entry] of Object.entries(source.floorPlan.levels)) {
    const id = idBySortOrder.get(order);
    if (id) levels[id] = { ...entry };
  }
  copy.floorPlan.levels = levels;
  return copy;
}

// --- store ------------------------------------------------------------------------------------

/** Where the store keeps its state between visits (the browser in the MVP, the API from Phase B). */
export interface Persistence {
  load(): SampleState | null;
  save(state: SampleState): void;
}

export interface NewSourceFileInput {
  name: string;
  kind: 'pdf' | 'image';
  fileId: string;
  pages: { fileId: string; thumbnailFileId: string; width: number; height: number }[];
}

export interface NewProjectInput extends ProjectDetails {
  templateId: string | null;
}

export type SampleStore = ReturnType<typeof createSampleStore>;

export function createSampleStore(
  kind: SampleSeed = 'sample',
  overrides: Partial<SampleState> = {},
  persistence?: Persistence,
) {
  let state: SampleState = persistence?.load() ?? { ...seed(kind), ...overrides };
  const listeners = new Set<() => void>();
  const now = () => new Date().toISOString();

  const update = (recipe: (draft: Draft<SampleState>) => void) => {
    state = produce(state, recipe);
    persistence?.save(state);
    for (const l of listeners) l();
  };

  const touchProject = (d: Draft<SampleState>, projectId: string) => {
    const p = d.projects.find((x) => x.id === projectId);
    if (p) p.updatedAt = now();
  };

  const actions = {
    createProject(input: NewProjectInput): string {
      const id = newId('proj');
      const template = input.templateId
        ? state.templates.find((t) => t.id === input.templateId)
        : undefined;
      update((d) => {
        const levelIds: string[] = [];
        const idBySortOrder = new Map<string, string>();
        const tplLevels = template?.structure.levels ?? [
          {
            name: 'Level 1',
            sortOrder: 1,
            paperSize: 'A3' as PaperSize,
            orientation: 'landscape' as Orientation,
            plans: [],
          },
        ];
        for (const tl of tplLevels) {
          const levelId = newId('lvl');
          levelIds.push(levelId);
          idBySortOrder.set(String(tl.sortOrder), levelId);
          d.levels.push({
            id: levelId,
            projectId: id,
            name: tl.name,
            sortOrder: tl.sortOrder,
            paperSize: tl.paperSize,
            orientation: tl.orientation,
          });
        }
        const { templateId: _t, ...details } = input;
        const t = now();
        d.projects.push({
          ...details,
          id,
          createdAt: t,
          updatedAt: t,
          lastOpened: levelIds[0] ? { levelId: levelIds[0], planType: 'smart-home' } : null,
          thumbnailFileId: null,
          // Snapshots are captured when a variant is first placed; template plans arrive with drawing
          // assignment (Phase J), so nothing is placed yet.
          catalogueSnapshot: {},
          quantityAdjustments: {},
          exportSettings: template
            ? rekeyExportSettings(template.structure.exportSettings, idBySortOrder, levelIds)
            : defaultExportSettings(levelIds),
          recentVariantIds: [],
        });
      });
      return id;
    },

    updateProjectDetails(projectId: string, details: ProjectDetails) {
      update((d) => {
        const p = d.projects.find((x) => x.id === projectId);
        if (!p) return;
        Object.assign(p, details);
        p.updatedAt = now();
      });
    },

    updateProjectSchedule(projectId: string, patch: ProjectSchedule) {
      update((d) => {
        const p = d.projects.find((x) => x.id === projectId);
        if (!p) return;
        p.schedule = { ...p.schedule, ...patch };
        p.updatedAt = now();
      });
    },

    deleteProject(projectId: string) {
      update((d) => {
        d.projects = d.projects.filter((p) => p.id !== projectId);
        d.levels = d.levels.filter((l) => l.projectId !== projectId);
        d.plans = d.plans.filter((p) => p.projectId !== projectId);
        d.sourceFiles = d.sourceFiles.filter((f) => f.projectId !== projectId);
        d.sourcePages = d.sourcePages.filter((p) => p.projectId !== projectId);
      });
    },

    /** Records the team copy this device just saved or loaded. */
    markShared(projectId: string, shared: SharedState) {
      update((d) => {
        const p = d.projects.find((x) => x.id === projectId);
        if (p) p.shared = shared;
      });
    },

    /**
     * Puts a project saved by the team in place of this device's copy (or adds it), with any
     * products it uses that this catalogue lacks.
     */
    importSharedProject(bundle: SharedBundle, shared: SharedState) {
      const id = bundle.project.id;
      update((d) => {
        const mine = d.projects.find((p) => p.id === id);
        const project = {
          ...structuredClone(bundle.project),
          lastOpened: mine?.lastOpened ?? bundle.project.lastOpened,
          shared,
        } as Project;
        d.projects = [...d.projects.filter((p) => p.id !== id), project];
        const others = <T extends { projectId: string }>(rows: T[]) =>
          rows.filter((r) => r.projectId !== id);
        d.levels = [...others(d.levels), ...structuredClone(bundle.levels)];
        d.plans = [...others(d.plans), ...structuredClone(bundle.plans)];
        d.sourceFiles = [...others(d.sourceFiles), ...structuredClone(bundle.sourceFiles)];
        d.sourcePages = [...others(d.sourcePages), ...structuredClone(bundle.sourcePages)];
        const products = new Set(d.products.map((p) => p.id));
        for (const p of bundle.products) if (!products.has(p.id)) d.products.push(structuredClone(p));
        const variants = new Set(d.variants.map((v) => v.id));
        for (const v of bundle.variants) if (!variants.has(v.id)) d.variants.push(structuredClone(v));
      });
    },

    /** The team's catalogue, prices, settings and templates in place of this device's. */
    importWorkspace(w: Pick<SampleState, 'products' | 'variants' | 'settings' | 'templates'>) {
      update((d) => {
        d.products = structuredClone(w.products);
        d.variants = structuredClone(smartLighting(w).variants);
        d.settings = structuredClone(w.settings);
        d.templates = structuredClone(w.templates);
      });
    },

    setLastOpened(projectId: string, levelId: string, planType: PlanType) {
      update((d) => {
        const p = d.projects.find((x) => x.id === projectId);
        if (p) p.lastOpened = { levelId, planType };
      });
    },

    addLevel(projectId: string): string {
      const id = newId('lvl');
      update((d) => {
        const mine = d.levels.filter((l) => l.projectId === projectId);
        const order = mine.reduce((m, l) => Math.max(m, l.sortOrder), 0) + 1;
        d.levels.push({
          id,
          projectId,
          name: `Level ${order}`,
          sortOrder: order,
          paperSize: 'A3',
          orientation: 'landscape',
        });
        const p = d.projects.find((x) => x.id === projectId);
        if (p) p.exportSettings.floorPlan.levels[id] = { smartHome: true, lighting: true };
        touchProject(d, projectId);
      });
      return id;
    },

    renameLevel(levelId: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed) return;
      update((d) => {
        const l = d.levels.find((x) => x.id === levelId);
        if (!l) return;
        l.name = trimmed;
        touchProject(d, l.projectId);
      });
    },

    /** Swaps a level with its neighbour in sort order. */
    moveLevel(levelId: string, direction: -1 | 1) {
      update((d) => {
        const l = d.levels.find((x) => x.id === levelId);
        if (!l) return;
        const siblings = d.levels
          .filter((x) => x.projectId === l.projectId)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const i = siblings.findIndex((x) => x.id === levelId);
        const other = siblings[i + direction];
        if (!other) return;
        [l.sortOrder, other.sortOrder] = [other.sortOrder, l.sortOrder];
        touchProject(d, l.projectId);
      });
    },

    setLevelPaper(levelId: string, patch: { paperSize?: PaperSize; orientation?: Orientation }) {
      update((d) => {
        const l = d.levels.find((x) => x.id === levelId);
        if (!l) return;
        Object.assign(l, patch);
        touchProject(d, l.projectId);
      });
    },

    deletePlan(planId: string) {
      update((d) => {
        const plan = d.plans.find((p) => p.id === planId);
        if (!plan) return;
        d.plans = d.plans.filter((p) => p.id !== planId);
        touchProject(d, plan.projectId);
      });
    },

    /** Moves elements of a plan document (Phase A planner: marker drag). */
    moveElements(planId: string, ids: string[], dx: number, dy: number) {
      const set = new Set(ids);
      update((d) => {
        const plan = d.plans.find((p) => p.id === planId);
        if (!plan) return;
        for (const el of plan.document.elements) {
          if (!set.has(el.id)) continue;
          if (el.kind === 'marker' || el.kind === 'note') {
            el.x += dx;
            el.y += dy;
          } else {
            for (const pt of el.points) {
              pt.x += dx;
              pt.y += dy;
            }
          }
        }
        plan.revision += 1;
        plan.updatedAt = now();
        touchProject(d, plan.projectId);
      });
    },

    setPlanView(planId: string, view: Partial<Plan['document']['view']>) {
      update((d) => {
        const plan = d.plans.find((p) => p.id === planId);
        if (plan) Object.assign(plan.document.view, view);
      });
    },

    setExportQuantity(projectId: string, variantId: string, quantity: number, calculated: number) {
      update((d) => {
        const p = d.projects.find((x) => x.id === projectId);
        if (!p) return;
        p.quantityAdjustments = setAdjustment(
          p.quantityAdjustments,
          lineKey(variantId),
          quantity,
          calculated,
          now(),
        );
        p.updatedAt = now();
      });
    },

    updateExportSettings(projectId: string, recipe: (s: Draft<ExportSettings>) => void) {
      update((d) => {
        const p = d.projects.find((x) => x.id === projectId);
        if (p) recipe(p.exportSettings);
      });
    },

    // --- catalogue (admin) ---

    addProduct(categoryId: CategoryId, name: string): string {
      const id = newId('prod');
      update((d) => {
        const order = d.products.filter((p) => p.categoryId === categoryId).length + 1;
        const t = now();
        d.products.push({
          id,
          categoryId,
          name,
          hidden: false,
          system: false,
          sortOrder: order,
          createdAt: t,
          updatedAt: t,
        });
      });
      return id;
    },

    updateProduct(productId: string, patch: Partial<Pick<Product, 'name' | 'hidden'>>) {
      update((d) => {
        const p = d.products.find((x) => x.id === productId);
        if (!p) return;
        // System drivers can be renamed but never hidden.
        if (p.system && patch.hidden) return;
        Object.assign(p, patch);
        p.updatedAt = now();
      });
    },

    addVariant(productId: string, input: { name: string; description: string }): string {
      const id = newId('var');
      update((d) => {
        const order = d.variants.filter((v) => v.productId === productId).length + 1;
        const t = now();
        d.variants.push({
          id,
          productId,
          name: input.name,
          description: input.description,
          imageFileId: null,
          hidden: false,
          sortOrder: order,
          createdAt: t,
          updatedAt: t,
        });
      });
      return id;
    },

    updateVariant(
      variantId: string,
      patch: Partial<Pick<Variant, 'name' | 'description' | 'hidden' | 'price'>>,
    ) {
      update((d) => {
        const v = d.variants.find((x) => x.id === variantId);
        if (!v) return;
        Object.assign(v, patch);
        v.updatedAt = now();
        if (patch.hidden) {
          d.settings.favouriteVariantIds = d.settings.favouriteVariantIds.filter(
            (id) => id !== variantId,
          );
        }
      });
    },

    /**
     * Deletes variants from the catalogue. Projects that already use one keep it: each gets a
     * snapshot of it first, so their plans, totals and exports still name it. It just can't be
     * placed any more. Drivers the totals add by themselves can't be deleted.
     */
    deleteVariants(variantIds: string[]) {
      const resolve = resolverFor(undefined, state);
      update((d) => {
        const system = new Set(d.products.filter((p) => p.system).map((p) => p.id));
        const ids = new Set(
          variantIds.filter((id) => {
            const v = d.variants.find((x) => x.id === id);
            return v && !system.has(v.productId);
          }),
        );
        if (ids.size === 0) return;
        for (const project of d.projects) {
          const used = new Set(
            d.plans
              .filter((pl) => pl.projectId === project.id)
              .flatMap((pl) => pl.document.elements)
              .flatMap((el) => ('variantId' in el && ids.has(el.variantId) ? [el.variantId] : [])),
          );
          for (const id of used) {
            if (project.catalogueSnapshot[id]) continue;
            const snap = resolve(id);
            if (snap) project.catalogueSnapshot[id] = snap;
          }
          project.recentVariantIds = project.recentVariantIds.filter((id) => !ids.has(id));
        }
        d.variants = d.variants.filter((v) => !ids.has(v.id));
        d.settings.favouriteVariantIds = d.settings.favouriteVariantIds.filter(
          (id) => !ids.has(id),
        );
      });
    },

    /** Deletes a whole product (series) and its variants, keeping them in projects that use them. */
    deleteProduct(productId: string) {
      const product = state.products.find((p) => p.id === productId);
      if (!product || product.system) return;
      actions.deleteVariants(
        state.variants.filter((v) => v.productId === productId).map((v) => v.id),
      );
      update((d) => {
        d.products = d.products.filter((p) => p.id !== productId);
        // The last series of a category gone: remember, so the samples aren't brought back.
        if (!d.products.some((p) => p.categoryId === product.categoryId)) {
          d.settings.emptiedCategories = [
            ...(d.settings.emptiedCategories ?? []),
            product.categoryId,
          ];
        }
      });
    },

    // --- settings (admin) ---

    updateSettings(recipe: (s: Draft<Settings>) => void) {
      update((d) => recipe(d.settings));
    },

    // --- templates (admin) ---

    renameTemplate(templateId: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed) return;
      update((d) => {
        const t = d.templates.find((x) => x.id === templateId);
        if (!t) return;
        t.name = trimmed;
        t.updatedAt = now();
      });
    },

    // --- MVP: uploads, plan assignment and planner writes ---

    addSourceFile(projectId: string, input: NewSourceFileInput): string {
      const id = newId('src');
      update((d) => {
        const order = d.sourceFiles.filter((f) => f.projectId === projectId).length + 1;
        d.sourceFiles.push({
          id,
          projectId,
          fileId: input.fileId,
          name: input.name,
          kind: input.kind,
          pageCount: input.pages.length,
          sortOrder: order,
          createdAt: now(),
        });
        input.pages.forEach((pg, i) =>
          d.sourcePages.push({
            id: newId('page'),
            projectId,
            sourceFileId: id,
            pageIndex: i,
            ...pg,
          }),
        );
        touchProject(d, projectId);
      });
      return id;
    },

    /** Creates (or replaces) the plan of `type` on a level with a locked background drawing. */
    assignPlan(
      projectId: string,
      levelId: string,
      type: PlanType,
      bg: {
        sourcePageId: string;
        rotation: Rotation;
        crop?: CropRect;
        fileId: string;
        width: number;
        height: number;
      },
    ): string {
      const id = newId('plan');
      update((d) => {
        d.plans = d.plans.filter((p) => !(p.levelId === levelId && p.type === type));
        d.plans.push({
          id,
          projectId,
          levelId,
          type,
          background: { ...bg, crop: bg.crop ?? { x: 0, y: 0, w: 1, h: 1 } },
          document: createEmptyPlanDocument(),
          revision: 1,
          updatedAt: now(),
        });
        const p = d.projects.find((x) => x.id === projectId);
        if (p && !p.thumbnailFileId) p.thumbnailFileId = bg.fileId;
        touchProject(d, projectId);
      });
      return id;
    },

    setMagicLayout(planId: string, layout: RoomLayout) {
      update((d) => {
        const plan = d.plans.find((p) => p.id === planId);
        if (plan) plan.magicLayout = structuredClone(layout) as Draft<RoomLayout>;
      });
    },

    setPlanDocument(planId: string, document: PlanDocument) {
      update((d) => {
        const plan = d.plans.find((p) => p.id === planId);
        if (!plan) return;
        plan.document = document as Draft<PlanDocument>;
        plan.revision += 1;
        plan.updatedAt = now();
        touchProject(d, plan.projectId);
      });
    },

    /** Snapshots a variant the first time a project uses it (plus the driver a path adds) and tracks it as recently used. */
    recordVariantUse(projectId: string, variantId: string) {
      const resolve = resolverFor(undefined, state);
      update((d) => {
        const p = d.projects.find((x) => x.id === projectId);
        if (!p) return;
        const capture = (id: string) => {
          if (p.catalogueSnapshot[id]) return;
          const snap = resolve(id);
          if (snap) p.catalogueSnapshot[id] = { ...snap, capturedAt: now() };
        };
        capture(variantId);
        const kind = categoryOfVariant(state, variantId);
        if (kind === 'led-strip') capture(SYSTEM_VARIANT_IDS.smartLedDriver);
        if (kind === 'track') capture(SYSTEM_VARIANT_IDS.trackDriver);
        p.recentVariantIds = [
          variantId,
          ...p.recentVariantIds.filter((x) => x !== variantId),
        ].slice(0, 12);
      });
    },

    setVariantImage(variantId: string, imageFileId: string | null) {
      update((d) => {
        const v = d.variants.find((x) => x.id === variantId);
        if (!v) return;
        v.imageFileId = imageFileId;
        v.updatedAt = now();
      });
    },

    /** Replaces everything with fresh sample data or an empty workspace. */
    resetData(kind: SampleSeed) {
      update(() => seed(kind));
    },

    deleteTemplate(templateId: string) {
      update((d) => {
        d.templates = d.templates.filter((t) => t.id !== templateId);
      });
    },
  };

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    actions,
  };
}
