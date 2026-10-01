# Phase A — Foundation, Design System & Static UX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm workspace, the pure-TypeScript domain package (categories, icon shapes, geometry, scene model, quantity engine, sample data), the design system, and every screen of the Maxsen Smart Home Planner rendered with realistic sample data — so Phases B–K wire real data into finished UI instead of inventing UI as they go.

**Architecture:** Three workspace packages. `packages/domain` holds framework-free logic shared by browser and server. `apps/web` is a Vite + React SPA whose screens read sample data through the same hook signatures that Phase B will back with the API. `apps/server` is a Hono skeleton that already serves the SPA build. The planner canvas renders a `Scene` built by the domain package, which is the same scene the PDF export will draw in Phase I.

**Tech Stack:** TypeScript 5 (strict), pnpm 10, React 19, Vite 7, react-router 7, Tailwind CSS 4, Radix UI primitives, lucide-react, Konva + react-konva, Zustand, zod, nanoid, Hono + @hono/node-server, Vitest + Testing Library, Playwright, ESLint 9 (typescript-eslint), Prettier.

**Spec:** `docs/superpowers/specs/2026-10-01-maxsen-planner-design.md` (technical design) and the product specification *Maxsen Smart Home Planner – Phase 1 PRS v1.0* (behaviour; copied to `docs/product/phase1-specification.md` in Task 1).

## Global Constraints

- Node ≥ 22, pnpm ≥ 10; TypeScript `strict: true`, `noUncheckedIndexedAccess: true`; ESM everywhere.
- `packages/domain` has **no runtime dependencies except `zod` and `nanoid`** and must not import from React, DOM, Node or Konva.
- No prices, quotation values, AI features, per-user accounts, or Phase 2 functionality anywhere, including sample data.
- Fixed category order and names exactly as the product spec §8.1/§8.2 (10 Smart Home, then 8 Lighting). Category icon shapes are fixed in code; only colour, badge text/style and size are configurable.
- Normalised plan units: background width = 1000 units; everything positional/dimensional in a `PlanDocument` is in plan units.
- The app name in the top bar and `<title>` is **Maxsen Smart Home Planner**; company name in copy is **Maxsen Smart Solutions**.
- Copy is sentence case, verbs on buttons, no "Submit", no trailing arrows, no all-caps labels, no middle-dot meta strings.
- Phase A is a static prototype by definition: screens use sample data and only the interactions listed per task must work. Every button that is not wired must be visibly disabled with a tooltip "Available in a later phase" — never a dead click.
- Every task ends with `pnpm typecheck && pnpm lint && pnpm test` green from the repo root, then a commit.

## Design tokens (decided here; Task 8 implements, every screen task consumes)

**Subject grounding.** The product's world is the architectural drawing set (thin black linework on white sheets, drawing registers, legend tables, A3 title blocks) and Maxsen's hardware (brushed-metal and brass switch plates, warm-luxury interiors). The planner chrome should feel like a drafting desk: paper-toned, flat, hairline-ruled, quiet, with the floor plan as the only hero and category colour the only vivid colour.

**Colour (CSS custom properties, light theme only in Phase 1):**

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F6F5F2` | App background |
| `--surface` | `#FFFFFF` | Panels, inputs, dialogs, the plan sheet |
| `--desk` | `#E9E7E2` | Canvas backdrop around the plan sheet |
| `--ink` | `#1F1D1A` | Primary text, icons |
| `--ink-2` | `#5E5A53` | Secondary text |
| `--ink-3` | `#8E8980` | Placeholder, disabled |
| `--rule` | `#E3E0D9` | Hairline borders |
| `--rule-2` | `#CBC6BC` | Strong rules, input borders on hover |
| `--brass` | `#A8873A` | Primary action, active nav, focus ring, selection |
| `--brass-2` | `#876B29` | Primary hover, link text |
| `--brass-tint` | `#F4EEDF` | Selected row/tile background |
| `--warn` / `--warn-tint` | `#B7791F` / `#FBF3E3` | Review warnings |
| `--danger` / `--danger-tint` | `#B4433A` / `#FBECEA` | Destructive actions, errors |
| `--ok` | `#3E7A4F` | Saved state, success |

No gradients. Shadows only on floating toolbar, popovers, dialogs: `0 4px 16px rgba(31,29,26,.10)`.

**Type.** One family: **Instrument Sans** (variable, self-hosted via `@fontsource-variable/instrument-sans`; fallback stack `system-ui, -apple-system, "Segoe UI", sans-serif`). Scale (px / line-height): 11/16 caption, 12/16 meta, 13/20 control, 14/22 body, 16/24 section title (600), 20/28 page title (600, letter-spacing −0.01em), 28/34 display (600, −0.015em; dashboard and PDF cover only). Quantities, counts, metres, coordinates use `font-variant-numeric: tabular-nums`. No small caps, no uppercase tracking, no monospace.

**Spacing & shape.** 4 px grid; control height 32 px (28 px compact in the planner panels); page gutter 32 px desktop / 20 px iPad; radii: 4 px controls, 6 px popovers/dialogs, 2 px thumbnails and chips. Rules are 1 px `--rule`. Panels are flat regions divided by rules, never nested cards.

**Layout concept.** A fixed **56 px navigation rail** on the left (icon + 10 px label under it, brass indicator bar for the active item) and a **52 px top bar** carrying context. Content screens use a left-aligned column, max-width 1120 px. The planner is full-bleed: library 280 px left, inspector 320 px right, both collapsible; the plan sheet sits on the `--desk` backdrop with a floating toolbar at the bottom centre. Dashboard is a **drawing register**: hairline-separated rows with a small sheet thumbnail, not a card grid. iPad (1024 × 768): rail stays, panels collapse to icons and open as overlays.

**Category glyphs (fixed shapes, `packages/domain/src/icons.ts`).** All paths drawn in a unit box centred at origin (coordinates −0.5…0.5), filled or outlined per badge style:

| Category | Shape id | Silhouette |
|---|---|---|
| Smart Switches | `square` | square |
| Control Panels | `panel` | wide rounded rectangle 1 × 0.64 |
| Curtains / Blinds | `pill` | horizontal pill |
| Aircon Controllers | `hexagon` | flat-top hexagon |
| Gateways | `diamond` | diamond |
| Sensors | `target` | circle with inner ring |
| Cameras | `dome` | half-disc on a base bar |
| Network Devices | `triangle` | upward triangle |
| Smart Locks | `arch` | round-top arch |
| Misc. Smart Home Accessories | `dot` | small circle (0.7 scale) |
| Downlights | `circle` | circle |
| Surface Lights | `roundedSquare` | rounded square |
| Track Lights | `track` (path) | thick line, square heads |
| LED Strips | `strip` (path) | thick line, round caps |
| Magnetic Track Lights | `magnetic` (path) | thick line, round heads |
| Pendant Lights | `drop` | teardrop |
| Spotlights | `star4` | four-point star |
| Misc. Lighting Accessories | `smallHexagon` | hexagon (0.7 scale) |

Default colours (admin-editable): Smart Switches `#2F5FB3`, Control Panels `#5B3FA6`, Curtains/Blinds `#1D8F7A`, Aircon `#2498B9`, Gateways `#7A4E9E`, Sensors `#C2651B`, Cameras `#B4323A`, Network `#3C7A3C`, Smart Locks `#8C6D1F`, Misc Smart Home `#6B6B6B`, Downlights `#D28A00`, Surface `#B8551F`, Track `#2C2C2C`, LED Strips `#C99700`, Magnetic Track `#1E6B8C`, Pendant `#A33B86`, Spotlights `#C7462C`, Misc Lighting `#7D7A72`. Default badges: `SW CP CB AC GW SE CA NW LK AX DL SL TR LED MT PD SP LX`. Default size 20 plan units for all point categories.

## Review Focus

1. **Zero-state projects and catalogue** — dashboard, templates and catalogue with no rows must show an inviting empty state with the primary action, not a blank table (Task 15 test `empty states render with primary action`).
2. **Project titles with unsafe filename characters** (`Tan / Lim: "Sky" Residence?*`) must export as `Tan Lim Sky Residence - Quantity List.xlsx`-style names (Task 5 test `sanitiseFilename strips reserved characters`).
3. **LED runs with no metres entered** must count 0 m but still add a driver and be flagged so Review Totals can warn (Task 5 test `led run with null metres counts 0 and is flagged`).
4. **A plan type that is hidden in the editor must still count** — hidden categories never change totals (Task 5 test `hidden categories do not affect totals` — totals take no view state at all; and Task 6 test `scene omits hidden categories but legend reflects visibility`).
5. **Keyboard-only use** — every interactive control reachable by Tab with a visible brass focus ring; dialogs trap focus and close on Escape (Task 8 test `dialog closes on Escape and returns focus`).

---

## File structure

```
maxsen-planner/
  package.json                      workspace scripts: dev, build, start, test, lint, typecheck, format, e2e
  pnpm-workspace.yaml               packages/*, apps/*
  tsconfig.base.json                strict, ESM, bundler resolution, paths none (workspace deps)
  eslint.config.js                  typescript-eslint recommended-type-checked + react-hooks + import rules
  .prettierrc                       printWidth 100, singleQuote, trailingComma all
  playwright.config.ts              baseURL http://localhost:5173, projects: desktop 1440×900, ipad 1024×768 (touch)
  docs/product/phase1-specification.md   copy of the product spec (markdown)
  packages/domain/
    package.json  tsconfig.json  vitest.config.ts
    src/index.ts                    re-exports
    src/categories.ts               CATEGORIES, categoryById, categoriesForPlan, SYSTEM_VARIANT_IDS
    src/icons.ts                    IconShape, iconPath(shape), PATH_SHAPES
    src/types.ts                    all entity + document types (spec §5)
    src/schemas.ts                  zod schemas for PlanDocument, PlanElement, Settings, ExportSettings, Project details
    src/ids.ts                      newId(prefix)
    src/plan-document.ts            createEmptyPlanDocument, migratePlanDocument, nextZ
    src/geometry/points.ts          Pt, add, sub, scale, length, lerp, rotateAround, boundsOf
    src/geometry/path.ts            pathLength, pointAtLength, polylineToSvgPath, smoothToSvgPath, headPositions, distanceToPath, pathMidpoint
    src/geometry/catmull-rom.ts     catmullRomToBezier
    src/totals/compute-totals.ts    computeTotals
    src/totals/adjustments.ts       applyAdjustments
    src/totals/sort.ts              compareLines
    src/exports/filenames.ts        sanitiseFilename, exportFilename
    src/render/styles.ts            resolveCategoryStyle
    src/render/scene.ts             buildScene
    src/sample/catalogue.ts         SAMPLE_PRODUCTS, SAMPLE_VARIANTS
    src/sample/settings.ts          SAMPLE_SETTINGS, DEFAULT_SETTINGS
    src/sample/projects.ts          SAMPLE_PROJECTS, SAMPLE_LEVELS, SAMPLE_PLANS, SAMPLE_SOURCE_PAGES
    src/sample/templates.ts         SAMPLE_TEMPLATES
    src/sample/index.ts
    test/*.test.ts                  one test file per module
  apps/web/
    package.json  tsconfig.json  vite.config.ts  index.html  vitest.config.ts  vitest.setup.ts
    public/sample/floorplan-3room-l1.svg, floorplan-3room-l2.svg, floorplan-landed-l1.svg, product/*.svg (placeholder product art), maxsen-logo.svg
    src/main.tsx  src/app/router.tsx  src/app/providers.tsx
    src/app/shell/AppShell.tsx  NavRail.tsx  TopBar.tsx
    src/app/auth/AuthProvider.tsx  RequireAuth.tsx  AdminUnlockDialog.tsx  useAdmin.ts
    src/styles/tokens.css  src/styles/globals.css
    src/components/ui/*.tsx         primitives (Task 8 lists them)
    src/components/CategoryGlyph.tsx  renders iconPath as inline SVG for library/legend/inspector
    src/lib/data/sample-store.ts    in-memory store seeded from domain sample data
    src/lib/data/hooks.ts           useProjects, useProject, useCatalogue, useSettings, useTemplates, useFavourites
    src/lib/format.ts               formatMetres, formatDateTime, formatQuantity
    src/features/auth/PasscodeScreen.tsx
    src/features/dashboard/DashboardScreen.tsx  ProjectRow.tsx  NewProjectDialog.tsx
    src/features/project/ProjectLayout.tsx  ProjectDetailsDialog.tsx
    src/features/setup/SetupScreen.tsx  SourcePanel.tsx  LevelList.tsx  PlanAssignmentCard.tsx  CropRotatePanel.tsx
    src/features/planner/PlannerScreen.tsx
    src/features/planner/canvas/PlanStage.tsx  SceneLayer.tsx  LegendOverlay.tsx  useStageViewport.ts
    src/features/planner/library/DeviceLibrary.tsx  LibrarySection.tsx  VariantTile.tsx
    src/features/planner/inspector/Inspector.tsx  MarkerInspector.tsx  LedInspector.tsx  TrackInspector.tsx  NoteInspector.tsx  MultiInspector.tsx
    src/features/planner/totals/LiveTotals.tsx
    src/features/planner/Toolbar.tsx  LevelSwitcher.tsx  SaveState.tsx
    src/features/review/ReviewTotalsScreen.tsx
    src/features/exports/ExportsScreen.tsx  FloorPlanOptions.tsx  ProductPdfOptions.tsx
    src/features/catalogue/CatalogueScreen.tsx  ProductEditorDialog.tsx  VariantEditorDialog.tsx
    src/features/templates/TemplatesScreen.tsx
    src/features/admin/AdminScreen.tsx  BrandingSection.tsx  IconStylesSection.tsx  FavouritesSection.tsx
    src/features/help/HelpScreen.tsx
    src/features/dev/StyleguideScreen.tsx   dev-only (/dev/styleguide), for screenshot review
    src/features/NotFoundScreen.tsx
    e2e/screens.spec.ts  e2e/planner.spec.ts
  apps/server/
    package.json  tsconfig.json
    src/index.ts                    Hono app: GET /api/health, static /, SPA fallback
```

---

### Task 1: Workspace scaffold and tooling

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.npmrc` (`node-linker=hoisted` is NOT used; default isolated), `playwright.config.ts`, `README.md`
- Create: `packages/domain/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}`
- Create: `apps/web/{package.json,tsconfig.json,vite.config.ts,index.html,vitest.config.ts,vitest.setup.ts,src/main.tsx,src/App.tsx}`
- Create: `apps/server/{package.json,tsconfig.json,src/index.ts}`
- Create: `docs/product/phase1-specification.md` (pandoc markdown of the Word spec, already in the session scratchpad)

**Interfaces:**
- Produces: workspace package names `@maxsen/domain`, `@maxsen/web`, `@maxsen/server`; root scripts `pnpm dev` (web + server concurrently), `pnpm build`, `pnpm start`, `pnpm test` (vitest in domain + web), `pnpm lint`, `pnpm typecheck` (`tsc -b` per package), `pnpm e2e`.
- Server: `GET /api/health` → `{ ok: true }`; serves `apps/web/dist` with SPA fallback when it exists.
- Vite dev server proxies `/api` → `http://localhost:3000`.

- [ ] **Step 1: Write root `package.json` with the scripts above and `pnpm-workspace.yaml` listing `packages/*` and `apps/*`**
- [ ] **Step 2: Add `tsconfig.base.json`** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes: false`, `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`, `verbatimModuleSyntax`, `jsx: react-jsx`.
- [ ] **Step 3: Scaffold `packages/domain`** with `exports: { ".": "./src/index.ts" }` (source exports; Vite and tsx consume TS directly) and a vitest config (`environment: node`).
- [ ] **Step 4: Scaffold `apps/web`** with Vite 7, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@maxsen/domain: workspace:*`, vitest (`environment: jsdom`, setup imports `@testing-library/jest-dom/vitest`), `index.html` title "Maxsen Smart Home Planner".
- [ ] **Step 5: Scaffold `apps/server`** with Hono, `@hono/node-server`, `@hono/node-server/serve-static`; dev script `tsx watch src/index.ts`; build `tsc -p tsconfig.json`; `src/index.ts` exposes `GET /api/health` and static serving.
- [ ] **Step 6: Add ESLint flat config** (typescript-eslint `recommendedTypeChecked`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`), Prettier, and `playwright.config.ts` with two projects: `desktop` (1440 × 900) and `ipad` (1024 × 768, `hasTouch: true`), `webServer` running `pnpm --filter @maxsen/web dev`.
- [ ] **Step 7: Write a smoke test** `packages/domain/test/smoke.test.ts` asserting `VERSION === '0.1.0'` exported from `src/index.ts`, and `apps/web/src/App.test.tsx` asserting the heading "Maxsen Smart Home Planner" renders.
- [ ] **Step 8: Run `pnpm install`, then `pnpm typecheck && pnpm lint && pnpm test`** — expected: all green, 2 tests passing.
- [ ] **Step 9: Run `pnpm --filter @maxsen/web build && pnpm --filter @maxsen/server build`, start the server, `curl localhost:3000/api/health`** — expected `{"ok":true}` and `curl localhost:3000/` returns the SPA HTML.
- [ ] **Step 10: Commit** `chore: scaffold pnpm workspace (domain, web, server) with tooling`

---

### Task 2: Domain — fixed categories and icon shapes

**Files:**
- Create: `packages/domain/src/categories.ts`, `packages/domain/src/icons.ts`
- Test: `packages/domain/test/categories.test.ts`, `packages/domain/test/icons.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type PlanType = 'smart-home' | 'lighting';
  type ElementKind = 'point' | 'led-strip' | 'track';
  type CategoryId = 'smart-switches' | 'control-panels' | 'curtains-blinds' | 'aircon-controllers' | 'gateways' | 'sensors' | 'cameras' | 'network-devices' | 'smart-locks' | 'misc-smart-home' | 'downlights' | 'surface-lights' | 'track-lights' | 'led-strips' | 'magnetic-track-lights' | 'pendant-lights' | 'spotlights' | 'misc-lighting';
  interface CategoryDef { id: CategoryId; planType: PlanType; name: string; order: number; kind: ElementKind; shape: IconShape; defaults: { color: string; badge: string; badgeStyle: 'filled' | 'outline'; size: number } }
  const CATEGORIES: readonly CategoryDef[];                 // in fixed order
  function categoryById(id: CategoryId): CategoryDef;      // throws on unknown
  function categoriesForPlan(planType: PlanType): CategoryDef[];
  const SYSTEM_VARIANT_IDS = { smartLedDriver: 'var_sys_smart_led_driver', trackDriver: 'var_sys_track_driver' } as const;
  const SYSTEM_PRODUCT_IDS = { smartLedDriver: 'prod_sys_smart_led_driver', trackDriver: 'prod_sys_track_driver' } as const;
  type IconShape = 'square' | 'panel' | 'pill' | 'hexagon' | 'diamond' | 'target' | 'dome' | 'triangle' | 'arch' | 'dot' | 'circle' | 'roundedSquare' | 'drop' | 'star4' | 'smallHexagon' | 'track' | 'strip' | 'magnetic';
  function iconPath(shape: IconShape): string;             // SVG path `d` in the −0.5…0.5 unit box; path shapes return a legend sample line
  function isPathShape(shape: IconShape): boolean;
  ```

- [ ] **Step 1: Write failing tests** in `categories.test.ts`: `has 18 categories in spec order` (ids and names equal the spec lists, `order` is 1…18), `smart-home has 10 and lighting has 8`, `kinds: led-strips is led-strip, track-lights and magnetic-track-lights are track, all others point`, `categoryById throws on unknown id`; in `icons.test.ts`: `every shape returns a non-empty path starting with M`, `point shapes stay inside the unit box` (parse numbers from the path string, assert |n| ≤ 0.5 + 1e-6), `isPathShape true only for track, strip, magnetic`.
- [ ] **Step 2: Run `pnpm --filter @maxsen/domain test`** — expected FAIL (modules missing).
- [ ] **Step 3: Implement `categories.ts` and `icons.ts`** with the table and defaults from *Design tokens* above. Shapes are hand-authored path strings (hexagon/triangle/star/diamond from vertex math, arcs via `A` commands).
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Commit** `feat(domain): fixed categories and icon shapes`

---

### Task 3: Domain — types, schemas, ids and plan documents

**Files:**
- Create: `packages/domain/src/types.ts`, `schemas.ts`, `ids.ts`, `plan-document.ts`
- Test: `packages/domain/test/schemas.test.ts`, `packages/domain/test/plan-document.test.ts`

**Interfaces:**
- Produces (exact names; shapes per spec §5):
  `Pt { x: number; y: number }`, `PointMarker`, `LedStripPath`, `TrackPath`, `TextNote`, `PlanElement`, `PlanViewState`, `PlanDocument`, `PaperSize`, `Orientation`, `PropertyType`, `ProjectStatus`, `Project`, `Level`, `Plan`, `PlanBackground { sourcePageId; rotation: 0|90|180|270; crop: { x; y; w; h }; fileId; width; height }`, `SourceFile`, `SourcePage`, `Product`, `Variant`, `VariantSnapshot`, `QuantityAdjustment`, `FloorPlanExportSettings`, `ProductPdfExportSettings`, `ExportSettings`, `Settings`, `CategoryStyleOverride`, `Template`, `TemplateStructure`, `FileRecord`.
  Zod: `planDocumentSchema`, `planElementSchema`, `settingsSchema`, `exportSettingsSchema`, `projectDetailsSchema` (title 1–120 chars trimmed, optional strings ≤ 200, `propertyType` enum or null, `status` enum).
  `newId(prefix: 'proj'|'lvl'|'plan'|'el'|'prod'|'var'|'file'|'src'|'page'|'tpl'): string` → `${prefix}_${nanoid(12)}`.
  `createEmptyPlanDocument(): PlanDocument` (schemaVersion 1, no elements, `view: { hiddenCategories: [], legendVisible: true }`).
  `migratePlanDocument(raw: unknown): PlanDocument` (validates; throws `PlanDocumentError` on invalid; future versions chain here).
  `nextZ(doc: PlanDocument): number` (max z + 1, or 0).
  `defaultExportSettings(levelIds: string[]): ExportSettings` (all levels/plans included, nothing hidden, all labels/notes/legend on, customer fields shown).

- [ ] **Step 1: Write failing tests**: `planDocumentSchema accepts an empty document and rejects schemaVersion 2`, `planElementSchema rejects a track with headCount 0 and accepts headCount 1` (min 1, integer), `led-strip metres accepts null and rejects negative`, `projectDetailsSchema trims title and rejects empty`, `migratePlanDocument returns a typed document for valid input and throws PlanDocumentError for garbage`, `nextZ is 0 for empty and max+1 otherwise`, `newId uses the prefix`.
- [ ] **Step 2: Run tests** — expected FAIL.
- [ ] **Step 3: Implement the four files.**
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Commit** `feat(domain): entity types, zod schemas, plan document factory`

---

### Task 4: Domain — geometry

**Files:**
- Create: `packages/domain/src/geometry/points.ts`, `path.ts`, `catmull-rom.ts`
- Test: `packages/domain/test/geometry.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // points.ts
  function dist(a: Pt, b: Pt): number; function lerp(a: Pt, b: Pt, t: number): Pt; function rotateAround(p: Pt, c: Pt, deg: number): Pt;
  function boundsOf(points: Pt[]): { x: number; y: number; w: number; h: number };
  // catmull-rom.ts
  function catmullRomToBezier(points: Pt[], closed: boolean, tension?: number): { c1: Pt; c2: Pt; p: Pt }[]; // cubic segments, tension default 0.5
  // path.ts
  function pathLength(points: Pt[], closed: boolean): number;                       // polyline length
  function pointAtLength(points: Pt[], closed: boolean, d: number): { point: Pt; angle: number };   // angle in degrees of tangent; clamps d
  function pathMidpoint(points: Pt[], closed: boolean): { point: Pt; angle: number };
  function polylineToSvgPath(points: Pt[], closed: boolean): string;                // "M x y L x y … Z"
  function smoothToSvgPath(points: Pt[], closed: boolean): string;                  // Catmull-Rom → "M … C … (Z)"
  function samplePath(points: Pt[], opts: { closed: boolean; smooth: boolean }, step?: number): Pt[]; // flattened polyline for hit-testing/length of smooth paths
  function headPositions(points: Pt[], headCount: number): { point: Pt; angle: number }[]; // at (i+0.5)/n of length, open polyline
  function distanceToPath(p: Pt, points: Pt[], opts: { closed: boolean; smooth: boolean }): number;
  function circlePoints(center: Pt, radius: number, n?: number): Pt[];            // n default 8, for the Circle tool
  ```

- [ ] **Step 1: Write failing tests** with exact values: `pathLength of (0,0)(3,0)(3,4) is 7 open and 12 closed`; `pointAtLength at 5 on that path is (3,2) with angle 90`; `headPositions 3 heads on (0,0)→(6,0) are x=1,3,5`; `headPositions 1 head is the midpoint`; `polylineToSvgPath formats M/L and Z`; `smoothToSvgPath of 2 points degrades to a straight C segment`; `circlePoints(center (100,100), r 50) returns 8 points each 50 from centre`; `distanceToPath from (1.5,1) to segment (0,0)-(3,0) is 1`; `samplePath of a closed smooth square has length within 5% of 4·side·1.1` (sanity bound only), `rotateAround 90° maps (1,0) around origin to (0,1)`.
- [ ] **Step 2: Run tests** — expected FAIL.
- [ ] **Step 3: Implement.** Catmull-Rom uses the standard uniform conversion (`c1 = p1 + (p2 − p0)/6·(tension·2)`); closed paths wrap indices; `samplePath` flattens each cubic into 16 segments.
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Commit** `feat(domain): path geometry, splines, head distribution`

---

### Task 5: Domain — quantity engine, adjustments, sorting, filenames

**Files:**
- Create: `packages/domain/src/totals/compute-totals.ts`, `adjustments.ts`, `sort.ts`, `packages/domain/src/exports/filenames.ts`
- Test: `packages/domain/test/totals.test.ts`, `packages/domain/test/filenames.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type LineKey = `variant:${string}`;
  interface TotalLine { key: LineKey; variantId: string; categoryId: CategoryId; productName: string; variantName: string; unit: 'pcs' | 'm'; calculated: number; autoAdded: boolean; runsMissingMetres: number }
  type VariantResolver = (variantId: string) => VariantSnapshot | undefined;
  function computeTotals(documents: PlanDocument[], resolve: VariantResolver): TotalLine[];   // consolidated, sorted; unresolved variants produce a line with productName 'Unknown product'
  interface ReviewLine extends TotalLine { exportQuantity: number; adjusted: boolean; warning: boolean; adjustment?: QuantityAdjustment }
  function applyAdjustments(lines: TotalLine[], adjustments: Record<LineKey, QuantityAdjustment>): ReviewLine[];
  function setAdjustment(adjustments, key, quantity, calculated, now): Record<LineKey, QuantityAdjustment>; // quantity === calculated removes the entry
  function compareLines(a: { categoryId; productName; variantName }, b): number;  // category order → product name → variant name (localeCompare, numeric)
  function sanitiseFilename(title: string): string;
  function exportFilename(title: string, kind: 'floor-plan' | 'product-description' | 'quantity'): string;  // "<title> - Marked Floor Plan.pdf" | "<title> - Product Description.pdf" | "<title> - Quantity List.xlsx"
  ```

- [ ] **Step 1: Write failing tests** (build documents with a tiny helper): `point markers count one per marker and consolidate the same variant across two documents`, `different variants of the same product are separate lines`, `led runs sum metres per variant to 1 dp and add one Smart LED Driver per run across variants`, `led run with null metres counts 0 and is flagged`, `tracks sum headCount per variant and add one Track Driver per track`, `drivers are autoAdded and resolve to SYSTEM_VARIANT_IDS`, `hidden categories do not affect totals` (view.hiddenCategories set, totals unchanged), `lines are sorted by category order then product then variant`, `applyAdjustments: no adjustment → exportQuantity = calculated, adjusted false`, `adjustment with unchanged calculated → no warning`, `adjustment with changed calculated → warning true and exportQuantity stays adjusted`, `setAdjustment removes the entry when quantity equals calculated`; filenames: `sanitiseFilename strips reserved characters` (`'Tan / Lim: "Sky" Residence?*'` → `'Tan Lim Sky Residence'`), `collapses whitespace and trims`, `falls back to Project for empty`, `caps at 100 characters`, `exportFilename patterns match the spec`.
- [ ] **Step 2: Run tests** — expected FAIL.
- [ ] **Step 3: Implement.** Metres rounded with `Math.round(x * 10) / 10` at the end of summation.
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Commit** `feat(domain): quantity engine, review adjustments, export filenames`

---

### Task 6: Domain — category styles and render scene

**Files:**
- Create: `packages/domain/src/render/styles.ts`, `packages/domain/src/render/scene.ts`
- Test: `packages/domain/test/scene.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface CategoryStyle { color: string; badge: string; badgeStyle: 'filled' | 'outline'; size: number; shape: IconShape; kind: ElementKind; name: string }
  function resolveCategoryStyle(categoryId: CategoryId, settings: Settings): CategoryStyle;   // defaults overridden by settings.categoryStyles
  interface SceneOptions { showLabels: boolean; showLedLengths: boolean; showTrackLabels: boolean; showNotes: boolean; hiddenCategories: CategoryId[] }
  interface SceneMarker { id: string; elementId: string; categoryId: CategoryId; x; y; rotation; size; color; badge; badgeStyle; pathD: string; label?: { text: string; x; y; fontSize: number } }
  interface ScenePath { id; elementId; categoryId; kind: 'led-strip' | 'track'; d: string; strokeWidth: number; color: string; heads: { x; y; angle; size }[]; label?: { text; x; y; fontSize; angle: 0 } ; points: Pt[] }
  interface SceneNote { id; elementId; x; y; text; fontSize; bold; color; highlight: string | null }
  interface SceneLegendEntry { categoryId; name; shape; color; badge; badgeStyle; kind }
  interface Scene { width: number; height: number; markers: SceneMarker[]; paths: ScenePath[]; notes: SceneNote[]; legend: SceneLegendEntry[] }
  function buildScene(doc: PlanDocument, ctx: { settings: Settings; resolve: VariantResolver; width: number; height: number }, opts: SceneOptions): Scene;
  ```
  Rules: stroke width = `size × 0.3`; head size = `size × 0.6`; marker label at `(x, y + size × 0.85)`, fontSize `size × 0.5`; path label at `pathMidpoint`, fontSize `size × 0.5`, text `"{metres}m LED Strip"` (metres formatted with up to 1 dp, `"? m LED Strip"` when null) or `"{n}-head Track"` / `"{n}-module Magnetic Track"`; elements of hidden categories are omitted; `legend` lists categories present among *rendered* elements, in fixed order; elements ordered by `z` ascending.

- [ ] **Step 1: Write failing tests**: `resolveCategoryStyle applies overrides and keeps shape fixed`, `scene omits hidden categories but legend reflects visibility` (legend excludes hidden, includes present), `marker label position and font size follow the size rule`, `led label text uses one decimal and the Track label uses head count`, `elements are emitted in z order`, `path geometry uses smoothToSvgPath when smooth`.
- [ ] **Step 2: Run tests** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Commit** `feat(domain): category styles and render scene model`

---

### Task 7: Domain — realistic sample data

**Files:**
- Create: `packages/domain/src/sample/{catalogue.ts,settings.ts,projects.ts,templates.ts,index.ts}`
- Create: `apps/web/public/sample/floorplan-3room-l1.svg`, `floorplan-3room-l2.svg`, `floorplan-landed-l1.svg`, `apps/web/public/sample/product/*.svg` (12 simple placeholder product illustrations — flat geometric, no brand logos), `apps/web/public/maxsen-logo.svg` (wordmark "MAXSEN" set in the UI font, charcoal, with a thin brass rule)
- Test: `packages/domain/test/sample.test.ts`

**Interfaces:**
- Produces: `SAMPLE_PRODUCTS: Product[]`, `SAMPLE_VARIANTS: Variant[]`, `DEFAULT_SETTINGS: Settings` (branding: WhatsApp `+65 8000 0000`, website `maxsen.sg`, showrooms Tampines and Yishun with placeholder street addresses, contact wording "Thank you for planning your home with Maxsen. Visit a showroom or message us on WhatsApp to discuss your layout."), `SAMPLE_SETTINGS` (= defaults with logoFileId `'file_sample_logo'`), `SAMPLE_PROJECTS: Project[]` (3: *Tan Residence — Tampines 4-room* (In Progress, 2 levels? no: HDB → 1 level), *Lim Family Home — Serangoon Gardens* (Landed, Draft, 3 levels: Level 1, Level 2, Attic), *Marina One Showflat* (Condo, Completed, 1 level)), `SAMPLE_LEVELS`, `SAMPLE_PLANS` (documents with 10–25 elements each, including an L-shaped LED run with 4.5 m, a circular LED loop 6.2 m, a straight 3-head track, an L-shaped 5-module magnetic track, two text notes), `SAMPLE_SOURCE_FILES`, `SAMPLE_SOURCE_PAGES`, `SAMPLE_TEMPLATES` (1: *HDB 4-room standard*), `SAMPLE_FILES: FileRecord[]` whose ids map to `/sample/...` URLs via `sampleFileUrl(id)`.
- Catalogue content (names only, no prices): Smart Switches → *Ark Series* (1-gang, 2-gang, 3-gang, 4-gang), *Nova+ Pro* (1/2/3/4-gang, Black / Champagne), *Lusano+ Prestige* (1/2/3-gang), *Filo Ultra Slim* (1/2/3-gang); Control Panels → *Nova S1* , *Nova S8*, *Nova S10*; Curtains / Blinds → *Smart Curtain Track* (Single / Double), *Smart Roller Blind Motor*; Aircon Controllers → *IR Aircon Controller*; Gateways → *Zigbee Gateway*; Sensors → *Door/Window Sensor*, *Motion Sensor*, *Temperature & Humidity Sensor*; Cameras → *Indoor Camera*, *Outdoor Camera*; Network Devices → *Reyee Wi-Fi 7 Router*, *Reyee Mesh Node*; Smart Locks → *Lenovo Smart Lock* (Standard / Pro); Misc Smart Home → *Smart Plug*, *Smart Doorbell*; Downlights → *Luna Downlight* (3000K / 4000K), *Luna Anti-glare Downlight*; Surface Lights → *Lumi Surface Light* (Round / Square); Track Lights → *Luna Track* (Black / White); LED Strips → *Lumi Cove Strip* (3000K / 4000K), *Lumi COB Strip* (3000K); Magnetic Track Lights → *Luna Magnetic Track* (Black); Pendant Lights → *Dining Pendant*; Spotlights → *Luna Spotlight* (Black / White); Misc Lighting → *Smart LED Driver* and *Track Driver* (system), *Dimmer Module*. Every variant has a one-sentence customer-facing description.

- [ ] **Step 1: Write failing tests**: `all sample variants reference existing products`, `system drivers exist with the fixed ids and are not hidden`, `every sample plan document validates against planDocumentSchema`, `every sample element variant exists in the catalogue`, `sample levels have unique order per project`, `computeTotals on the Lim project yields at least one Smart LED Driver and one Track Driver line`.
- [ ] **Step 2: Run tests** — expected FAIL.
- [ ] **Step 3: Write the sample data and the SVG assets.** Floor plans: 1400 × 1000 viewBox, white sheet, 8-unit black walls, thin grey door swings, room names in 28 px grey, a faint title block bottom-right ("SAMPLE DRAWING — NOT TO SCALE"). Product art: 240 × 240, flat two-tone (ink + brass) depictions.
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Commit** `feat(domain): realistic Maxsen sample catalogue, projects and templates`

---

### Task 8: Web — design tokens, fonts and UI primitives

**Files:**
- Create: `apps/web/src/styles/tokens.css`, `globals.css`; `apps/web/src/components/ui/{Button,IconButton,Input,Textarea,NumberField,Select,Switch,Checkbox,SegmentedControl,Tabs,Dialog,ConfirmDialog,Popover,DropdownMenu,Tooltip,Badge,StatusBadge,Table,EmptyState,Skeleton,Toast,PageHeader,Panel,SectionTitle,Kbd,ColorSwatch,Field}.tsx`, `components/ui/index.ts`, `components/CategoryGlyph.tsx`, `features/dev/StyleguideScreen.tsx`
- Test: `apps/web/src/components/ui/__tests__/{Button,Dialog,Field}.test.tsx`

**Interfaces:**
- Produces: `Button({ variant: 'primary'|'secondary'|'ghost'|'danger', size: 'sm'|'md', loading?, disabled?, disabledReason? })` — `disabledReason` renders a tooltip (used for "Available in a later phase"); `IconButton` (same, `label` required for aria); `Field({ label, hint?, error?, children })`; `Dialog({ open, onOpenChange, title, description?, children, footer })` on Radix with focus trap; `ConfirmDialog({ open, title, body, confirmLabel, destructive?, onConfirm, onCancel })`; `Table` with `tabular-nums` numeric cells (`<Td numeric>`); `StatusBadge({ status: ProjectStatus })` — Draft (ink-2), In Progress (brass), Completed (ok); `EmptyState({ icon, title, body, action })`; `Toast` via a `useToast()` hook; `CategoryGlyph({ categoryId, size, style? })` renders `iconPath` inline (`<svg viewBox="-0.5 -0.5 1 1">`) with the resolved colour/badge; `SegmentedControl<T>({ value, options, onChange })` used for Smart Home | Lighting, A4 | A3, Portrait | Landscape.
- Tailwind theme (`@theme`) maps the tokens: `--color-paper` … `--color-ok`, `--font-sans`, radii `--radius-control: 4px` etc.

- [ ] **Step 1: Write failing tests**: `Button renders primary and secondary variants and respects disabled with reason tooltip text`, `dialog closes on Escape and returns focus` (open via button, press Escape, assert closed and the trigger has focus), `Field associates label with input` (`getByLabelText`).
- [ ] **Step 2: Run `pnpm --filter @maxsen/web test`** — expected FAIL.
- [ ] **Step 3: Implement tokens.css** (exact values from *Design tokens*), `globals.css` (font-face via `@fontsource-variable/instrument-sans`, base text 14/22 `--ink` on `--paper`, `*:focus-visible` 2 px `--brass` outline offset 2 px, `prefers-reduced-motion` disables transitions, scrollbars thin and `--rule-2`), and the primitives on Radix. Transitions: 120 ms opacity/transform only.
- [ ] **Step 4: Implement `StyleguideScreen`** at `/dev/styleguide` showing every primitive in every state, the type scale, the palette, and all 18 `CategoryGlyph`s at 16/24/32 px.
- [ ] **Step 5: Run tests** — expected PASS. Run `pnpm e2e --grep styleguide` after adding `e2e/screens.spec.ts` case `styleguide renders` that screenshots `/dev/styleguide` to `test-results/screens/styleguide-{project}.png`.
- [ ] **Step 6: Review the screenshot** against *Design tokens* and the frontend-design checklist (no caps labels, no cards-in-cards, focus ring visible, one accent). Fix what is off.
- [ ] **Step 7: Commit** `feat(web): design tokens and UI primitives`

---

### Task 9: Web — app shell, routing, sample data layer, access gate

**Files:**
- Create: `apps/web/src/app/{router.tsx,providers.tsx}`, `app/shell/{AppShell,NavRail,TopBar}.tsx`, `app/auth/{AuthProvider,RequireAuth,AdminUnlockDialog,useAdmin}.tsx`, `lib/data/{sample-store.ts,hooks.ts}`, `lib/format.ts`, `features/auth/PasscodeScreen.tsx`, `features/NotFoundScreen.tsx`, `features/help/HelpScreen.tsx`
- Modify: `apps/web/src/main.tsx`, delete `App.tsx` smoke
- Test: `apps/web/src/app/__tests__/router.test.tsx`, `apps/web/src/lib/data/__tests__/sample-store.test.ts`

**Interfaces:**
- Routes: `/login`; `/` dashboard; `/projects/new`; `/projects/:projectId/setup`; `/projects/:projectId/plan` (query `level`, `type`); `/projects/:projectId/review`; `/projects/:projectId/exports`; `/catalogue`; `/templates`; `/admin`; `/help`; `/dev/styleguide` (dev only); `*` not found.
- `AuthProvider`: `{ signedIn: boolean; signIn(passcode): Promise<boolean>; signOut() }`, sample passcode `maxsen` (Phase B replaces with API; signature kept). `useAdmin()`: `{ unlocked: boolean; unlock(passcode): Promise<boolean>; lock() }`, sample admin passcode `admin`. `RequireAuth` redirects to `/login` with `from`. `requireAdmin(action)` helper opens `AdminUnlockDialog` and resolves when unlocked.
- Sample store: `createSampleStore()` holding projects/levels/plans/sourcePages/catalogue/settings/templates in memory with `subscribe`, `get`, `update` (immer); hooks: `useProjects(search?: string)`, `useProject(id)`, `useLevels(projectId)`, `usePlans(projectId)`, `useCatalogue()` → `{ categories, products, variants, visibleVariantsFor(planType) }`, `useSettings()`, `useTemplates()`, `useFavourites()`; all return `{ data, isLoading }` so Phase B can swap in TanStack Query.
- `TopBar` slots: `left` (breadcrumb/back), `center`, `right`; `NavRail` items: Projects, Catalogue, Templates, Admin, Help (+ Project section when inside a project: Setup, Plan, Review totals, Exports).
- `HelpScreen`: the fixed eight-step workflow from product spec §17 as a numbered sequence (it is a real sequence) with one short paragraph each.

- [ ] **Step 1: Write failing tests**: `visiting / while signed out redirects to /login`, `signing in with maxsen shows the dashboard`, `unknown route shows Not found`, `useProjects filters by title, customer name and address case-insensitively` (sample-store test).
- [ ] **Step 2: Run tests** — expected FAIL.
- [ ] **Step 3: Implement.** Passcode screen: centred column on `--paper`, wordmark, "Enter the team passcode", one password field, "Sign in" primary; wrong passcode error "That passcode isn't right. Try again." Nav rail per *Layout concept*.
- [ ] **Step 4: Run tests** — expected PASS.
- [ ] **Step 5: Commit** `feat(web): app shell, routes, sample data layer, passcode gate`

---

### Task 10: Web — Dashboard and New Project

**Files:**
- Create: `features/dashboard/{DashboardScreen,ProjectRow,NewProjectDialog}.tsx`, `features/project/{ProjectLayout,ProjectDetailsDialog}.tsx`
- Test: `features/dashboard/__tests__/DashboardScreen.test.tsx`

**Interfaces:**
- Dashboard: page title "Projects", search input (placeholder "Search by title, customer or address"), primary "New project". Rows: thumbnail (96 × 64, sheet-like, 2 px radius, `--rule` border), title (600), customer name and property address (ink-2), `StatusBadge`, "Updated {relative or dd MMM yyyy, HH:mm}" tabular, overflow menu with "Delete project" → `ConfirmDialog` ("Delete {title}? This permanently removes the project and its plans.") which deletes in the sample store. Clicking title or thumbnail navigates to `/projects/:id/plan` restoring `lastOpened`. Empty state: "No projects yet" / "Create your first project to start planning." / "New project". Loading: 5 skeleton rows.
- New project (`/projects/new`): two-step inside one screen: step 1 choice tiles "Start from blank" / "Start from template" (template list from `useTemplates()`), step 2 details form (title required, customer name, contact number, property address, property type select, status defaults Draft) with "Create project" → creates in sample store → navigates to setup.
- `ProjectLayout`: wraps project routes; top bar shows project title (click → `ProjectDetailsDialog` to edit details/status), and a segmented sub-nav Setup / Plan / Review totals / Exports.

- [ ] **Step 1: Write failing tests**: `renders sample projects with status badges`, `search narrows rows`, `empty store shows the empty state with New project`, `delete flow removes the row after confirm`.
- [ ] **Step 2: Run tests** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests** — expected PASS. Add e2e `dashboard` and `new-project` screenshot cases.
- [ ] **Step 5: Commit** `feat(web): project dashboard and new project flow (sample data)`

---

### Task 11: Web — Floor-plan setup screen (static)

**Files:**
- Create: `features/setup/{SetupScreen,SourcePanel,LevelList,PlanAssignmentCard,CropRotatePanel}.tsx`
- Test: `features/setup/__tests__/SetupScreen.test.tsx`

**Interfaces:**
- Layout: three columns — **Sources** (uploaded files with page thumbnails; upload button disabled with reason in Phase A), **Levels** (ordered list with rename inline, add level, move up/down working in the sample store; paper size `A4 | A3` and orientation `Portrait | Landscape` segmented controls per level), **Plans** (for the selected level, two `PlanAssignmentCard`s — Smart Home Plan, Lighting Plan — each either "Not set up yet / Choose a drawing" (disabled, reason) or a preview with rotation and crop summary, "Open in planner", and "Delete plan" (ConfirmDialog, works in sample store)).
- `CropRotatePanel`: shows the sample page with rotate buttons (0/90/180/270) and a crop rectangle overlay with 8 handles; **visual only in Phase A** (handles render, drag not required), with "Reset crop" and "Use this drawing" disabled with reason.
- Spec copy: a level cannot be deleted — no delete control on levels at all.

- [ ] **Step 1: Write failing tests**: `lists levels in order and renames inline`, `moving a level down swaps order`, `deleting a plan asks for confirmation and removes it`, `plan card without background shows the choose-drawing empty state`.
- [ ] **Step 2: Run tests** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests** — expected PASS. Add e2e `setup` screenshots (desktop + iPad).
- [ ] **Step 5: Commit** `feat(web): floor-plan setup screen (static)`

---

### Task 12: Web — Planner screen with Konva scene rendering

**Files:**
- Create: `features/planner/{PlannerScreen,Toolbar,LevelSwitcher,SaveState}.tsx`, `canvas/{PlanStage,SceneLayer,LegendOverlay,useStageViewport}.tsx`, `library/{DeviceLibrary,LibrarySection,VariantTile}.tsx`, `inspector/{Inspector,MarkerInspector,LedInspector,TrackInspector,NoteInspector,MultiInspector}.tsx`, `totals/LiveTotals.tsx`, `features/planner/store/plannerStore.ts`
- Test: `features/planner/__tests__/{plannerStore,DeviceLibrary,LiveTotals}.test.tsx`, `apps/web/e2e/planner.spec.ts`

**Interfaces:**
- `plannerStore` (Zustand): `{ projectId, levelId, planType, document: PlanDocument, selection: string[], tool: 'select' | 'pan', viewport: { scale, x, y }, select(ids, mode: 'replace'|'toggle'), moveElements(ids, dx, dy), setViewport, setTool }`. Phase A implements only `select` and `moveElements` (no undo yet; the shape is final so Phase E extends it).
- `PlanStage({ background: { url, width, height }, scene: Scene, selection, onSelect, onMove })`: react-konva `Stage` filling its container; `Layer` 1 background image (`listening={false}`), `Layer` 2 scene (markers as `Group` → `Path` + badge `Text` + label `Text`; paths as `Path` + heads as `Rect`/`Circle`; notes as `Group` → `Rect` highlight + `Text`), `Layer` 3 selection outlines. Zoom with wheel (0.25–6, around pointer), pan with `tool === 'pan'` or Space-drag, buttons −/+/Fit; markers draggable → `onMove` on drag end; click selects, Shift-click toggles. Marquee, rotation, drawing, undo/redo: **Phase E/F** (toolbar buttons present, disabled with reason).
- `DeviceLibrary({ planType })`: search field; sections Favourites, Recently used, then categories in fixed order with `CategoryGlyph`, product rows expanding to `VariantTile`s (glyph + variant name + product name; tiles are not draggable in Phase A — tooltip reason).
- `Inspector`: switches on the single selected element kind; shows the real values from the sample document in disabled-but-styled controls (variant select, label, rotation, metres with unit "m", head count stepper, note font size/bold/colour/highlight, layer buttons, duplicate/delete) — all disabled with reason except nothing; `MultiInspector` shows "{n} items selected".
- `LiveTotals`: collapsible panel under the inspector; `computeTotals` over all plan documents of the project via the sample store; grouped by category with per-category count, expandable to variant lines; driver lines carry an "auto-added" badge; metres formatted `4.5 m`.
- `LevelSwitcher`: level select + `SegmentedControl` Smart Home | Lighting; switching updates the route query and the store; a plan that doesn't exist shows an empty canvas state "No Lighting Plan on this level yet" with "Set up in Setup" link. `SaveState` shows "Saved" with the ok dot (static in Phase A).
- Legend overlay: toggle button in toolbar; renders `scene.legend` as a compact table on the sheet's bottom-left.

- [ ] **Step 1: Write failing tests**: `plannerStore select replace and toggle`, `moveElements shifts only selected markers`, `DeviceLibrary shows only categories of the active plan type and filters by search across product and variant names`, `LiveTotals lists Smart LED Driver as auto-added with the sample count`; e2e `planner.spec.ts`: `renders the sample plan with markers and paths` (expects canvas and the legend entries text), `clicking a marker shows its inspector` (click at the known sample marker position), `zoom buttons change the scale` (reads a `data-scale` attribute on the stage wrapper).
- [ ] **Step 2: Run tests** — expected FAIL.
- [ ] **Step 3: Implement.** Canvas backdrop `--desk`; the sheet (background) gets a 1 px `--rule-2` outline and no shadow. Stage size via `ResizeObserver`. `useStageViewport` owns scale/position and `fit()` (contain with 32 px padding).
- [ ] **Step 4: Run unit tests, then `pnpm e2e --grep planner`** — expected PASS; screenshots desktop + iPad.
- [ ] **Step 5: Review screenshots**: canvas gets maximum area, panels readable at 1024 × 768, glyphs legible, badge text contrast ≥ 4.5:1 on filled glyphs (white text) — adjust defaults if not.
- [ ] **Step 6: Commit** `feat(web): planner screen with Konva scene rendering (static)`

---

### Task 13: Web — Review Totals and Exports screens

**Files:**
- Create: `features/review/ReviewTotalsScreen.tsx`, `features/exports/{ExportsScreen,FloorPlanOptions,ProductPdfOptions}.tsx`
- Test: `features/review/__tests__/ReviewTotalsScreen.test.tsx`, `features/exports/__tests__/ExportsScreen.test.tsx`

**Interfaces:**
- Review Totals: table grouped by section (Smart Home Products / Lighting Products) with columns Category · Product · Variant · Calculated · Export quantity · (warning). Export quantity is an editable `NumberField` wired to `setAdjustment` in the sample store (this interaction works in Phase A because it is pure domain + store); when adjusted, the Calculated cell shows the original and the row gets a brass left rule; when `warning`, an amber inline note "Calculated quantity changed since you adjusted this (was {calculatedAtAdjustment})". Header note: "Adjustments change export quantities only. Plans are never modified." Buttons: "Go to exports" primary.
- Exports: three generation panels in a row (Marked floor plan PDF, Quantity Excel, Product description PDF) each with filename preview from `exportFilename(project.title, kind)`, options, and a "Generate" button (disabled, reason), plus "Generate all exports" (disabled, reason). `FloorPlanOptions`: customer name/contact/address toggles, level × plan-type checklist, category visibility checklist (18, grouped), toggles for device labels, LED-strip lengths, track labels, notes, legend — all bound to `project.exportSettings` in the sample store (working). `ProductPdfOptions`: customer toggles and category include/exclude list.

- [ ] **Step 1: Write failing tests**: `editing export quantity marks the row adjusted and persists in the store`, `warning shows when calculated differs from calculatedAtAdjustment`, `export filename previews use the sanitised title`, `toggling a category in floor-plan options updates exportSettings.floorPlan.hiddenCategories`.
- [ ] **Step 2: Run tests** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests** — expected PASS; e2e screenshots `review`, `exports`.
- [ ] **Step 5: Commit** `feat(web): review totals and export centre screens`

---

### Task 14: Web — Catalogue, Templates and Admin settings

**Files:**
- Create: `features/catalogue/{CatalogueScreen,ProductEditorDialog,VariantEditorDialog}.tsx`, `features/templates/TemplatesScreen.tsx`, `features/admin/{AdminScreen,BrandingSection,IconStylesSection,FavouritesSection}.tsx`
- Test: `features/catalogue/__tests__/CatalogueScreen.test.tsx`, `features/admin/__tests__/AdminScreen.test.tsx`

**Interfaces:**
- Catalogue: left column category list (fixed order, with counts); main: products of the selected category as rows (name, variant count, hidden badge) expanding to variant rows (image thumbnail, name, description excerpt, hidden badge). Admin-only actions (Add product, Edit, Add variant, Hide/Unhide) go through `requireAdmin` — the unlock dialog works (sample passcode), and editing names/descriptions/hidden works in the sample store via the two editor dialogs; image upload disabled with reason. Non-admin users see the catalogue read-only with a lock hint "Unlock admin to edit".
- Templates: rows (name, description, levels summary, updated) with "Use template" → `/projects/new?template=:id`; admin: "Rename", "Delete" (confirm) working in the store; "Save current project as template" lives in the project overflow menu, disabled with reason.
- Admin: requires unlock on entry; sections: **Branding** (logo preview + upload disabled, WhatsApp, website, showrooms list with add/remove, contact-page wording textarea — saving works in store), **Icon styles** (table of 18 categories: glyph preview at the chosen size, colour swatch + hex input, badge text, badge style segmented Filled | Outline, size with presets XS 12 · S 16 · M 20 · L 26 · XL 34 and a numeric field; preview updates live), **Favourites** (variant picker with search; ordered list with remove), and a "Lock admin" button in the page header.

- [ ] **Step 1: Write failing tests**: `catalogue edit is gated by the admin unlock dialog`, `hiding a variant marks it hidden and removes it from visibleVariantsFor`, `admin icon size change updates settings.categoryStyles`, `favourites add and remove persist`.
- [ ] **Step 2: Run tests** — expected FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests** — expected PASS; e2e screenshots `catalogue`, `templates`, `admin`, `help`.
- [ ] **Step 5: Commit** `feat(web): catalogue, templates and admin settings screens`

---

### Task 15: Empty and loading states, iPad pass, screenshot suite, Phase A verification

**Files:**
- Modify: screens from Tasks 10–14 as needed; `apps/web/e2e/screens.spec.ts` (full suite), `README.md`
- Create: `docs/superpowers/notes/phase-a-review.md` (what was reviewed, what changed)

- [ ] **Step 1: Write the e2e suite** `screens.spec.ts`: signs in once (storage state), then for each of login, dashboard, dashboard-empty (store reset via `?sample=empty` query handled by `providers.tsx`), new-project, setup, planner (smart-home), planner (lighting), review, exports, catalogue, templates, admin, help, styleguide, not-found: navigate, wait for `[data-screen-ready]`, screenshot to `test-results/screens/{name}-{project}.png`. Test `empty states render with primary action` asserts the dashboard/catalogue/templates empty states show their buttons under `?sample=empty`.
- [ ] **Step 2: Run `pnpm e2e`** on both projects — expected PASS.
- [ ] **Step 3: Review every screenshot** (desktop and iPad) against the design tokens and the frontend-design critique list: one accent, no caps labels, no card kit, line length < 80 ch, focus visible, canvas gets maximum area, panels usable at 1024 × 768 (collapsed overlays), nothing truncated. Record findings and fixes in `docs/superpowers/notes/phase-a-review.md`.
- [ ] **Step 4: Fix findings; rerun `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e`** — expected all green.
- [ ] **Step 5: Scan for dead controls**: `grep -rn "disabledReason" apps/web/src | wc -l` must equal the number of intentionally deferred controls listed in the review note; any button without a handler or a reason is a defect.
- [ ] **Step 6: Update `README.md`** (what exists, how to run, sample passcodes `maxsen` / `admin`, phase status) and commit `chore: Phase A review, iPad pass and screenshot suite`.
- [ ] **Step 7: Request review** with superpowers:requesting-code-review on the whole branch before declaring Phase A complete.

---

## Self-review notes

- **Spec coverage (Phase A scope):** app shell/navigation (T9), dashboard (T10), new project incl. blank/template choice (T10), setup incl. levels/paper/orientation/plan deletion (T11), planner layout + library + inspector + live totals + legend + level/plan switching (T12), review totals (T13), export centre with configuration (T13), catalogue (T14), templates (T14), admin settings incl. icon size/colour/badge, branding, favourites (T14), help (T9), empty/loading states and iPad (T15), design system (T8), domain foundations incl. snapshot-aware totals (T2–T7). Deferred to later phases by design: uploads/crop/rotate interaction (C), drag-from-library/rotation/marquee/undo/autosave (E), path drawing (F), exports generation (I), templates creation (J).
- **Types:** `Scene`/`SceneOptions` (T6) consumed by `PlanStage` (T12); `TotalLine`/`ReviewLine` (T5) by `LiveTotals` (T12) and Review (T13); `Settings.categoryStyles` (T3) by `resolveCategoryStyle` (T6) and Admin (T14); hook signatures (T9) by all screens.
- **Review Focus** items each have a named test in T5, T6, T8, T15.
