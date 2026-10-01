# Maxsen Smart Home Planner — Phase 1 Technical Design

**Date:** 2026-10-01
**Status:** Approved for implementation (per the product brief: "present briefly, then proceed")
**Source of truth:** *Maxsen Smart Home Planner – Phase 1 Product Requirements Specification v1.0 (1 Oct 2026)*. Where this design and that specification disagree, the specification wins.

---

## 1. Purpose of this document

The product behaviour is fixed by the specification. This document records the *technical* decisions the specification leaves to the implementer (§22): architecture, data model, editor model, export pipeline, phase plan and risks. It also writes back our understanding of the product so it can be corrected before code is written.

Out of scope for Phase 1 (restated so nobody adds them): AI floor-plan reading or auto-placement, pricing/quotation values, individual staff accounts, project versioning, stock/CRM/accounting, customer portal, custom shapes beyond lighting paths and note highlights.

---

## 2. Product understanding (in our own words)

Maxsen's planners currently mark up customer floor plans by hand to work out which smart-home devices and lights go where, then count everything up for quoting and produce customer-facing material. The Planner replaces that with one internal web app:

1. A planner signs in with the shared team passcode and creates a project (blank, or from an admin-approved template).
2. They upload the customer's drawings (multi-page PDFs and/or images), pick the usable pages, rotate/crop them, name the levels (e.g. Level 1, Level 2, Attic), and attach a drawing to each level's **Smart Home Plan** and/or **Lighting Plan**. Each level also stores the paper size (A4/A3) and orientation its pages will be exported at.
3. In the planner, the drawing is a **locked background**. The planner drags product variants from a category-organised library onto it. Point devices (switches, panels, curtains, sensors, downlights …) are icons that can be moved, rotated, relabelled, re-assigned to another variant, multi-selected and layered. **LED strips** and **track lights** are *paths* (straight, L-shaped, multi-point; LED strips may also be curved/circular loops). Each LED run carries a manually typed metre value; each track carries a head count whose heads are drawn along the track. Text notes can be placed anywhere.
4. Quantities are derived deterministically: one unit per point marker; metres summed per LED-strip variant; heads summed per track variant; plus one Smart LED Driver per LED run and one Track Driver per track. Everything consolidates project-wide by variant (not by level or room). Live totals are visible while planning.
5. Before export, a **Review Totals** screen shows the consolidated list and lets the planner override export quantities. Overrides persist in the project; if later plan edits change a calculated figure, the screen warns but never blocks.
6. Three exports are generated fresh on demand: a branded **marked-up floor-plan PDF** (cover + selected plan pages with legends, honouring per-level paper size/orientation), a plain **quantity Excel** (one sheet, four columns, customer contact number, drivers included) and a customer-facing **product description PDF** (cover, Smart Home and Lighting sections with catalogue images/descriptions/quantities, contact page; drivers excluded).
7. An admin (separate passcode) maintains the catalogue (Category → Product → Variant, with images and descriptions, hide/unhide), shared Favourites, branding and contact details, global icon sizes and colours/badges, and reusable templates. Projects keep a snapshot of the product/variant names, images and descriptions they used, so later catalogue edits do not rewrite history.

Success looks like: a planner can go from uploaded PDF to all three exports for a multi-level home in one sitting without losing work (autosave + undo/redo), with counts that are always right and exports that look like they came from a premium brand.

Who it is for: a small internal team (planners/sales/installers) on desktops and iPads. No customers ever touch it.

---

## 3. Core workflows

| # | Workflow | Entry | Key steps | Exit |
|---|----------|-------|-----------|------|
| 1 | Application access | Any URL while signed out | Enter shared passcode → session cookie. Admin screens/actions additionally prompt for the admin passcode (session-scoped unlock, lockable). | Dashboard |
| 2 | Project creation | Dashboard → *New Project* | Choose **Start from Blank** or **Start from Template** → enter title (required), customer name/contact/address, property type → project created in *Draft* | Floor-plan setup |
| 3 | Floor-plan upload & setup | New project, or *Setup* from the planner | Upload PDFs/images → pages rasterised to thumbnails → add/rename/reorder levels → per level set paper size & orientation → assign a page to Smart Home Plan and/or Lighting Plan (rotate 0/90/180/270, crop with preview and reset) → background locked | Planner |
| 4 | Multi-level management | Setup, planner level switcher | Switch level/plan type; add level; rename; reorder; delete a plan (confirm) and re-add later with a new background; levels never deleted | — |
| 5 | Smart Home Plan editing | Planner (level, *Smart Home*) | Library shows only smart-home categories → drag variants to canvas → move/rotate/label/duplicate/delete/re-assign → shift-click & marquee multi-select → group move/delete → layer order → notes → category show/hide, legend toggle → undo/redo → autosave | — |
| 6 | Lighting Plan editing | Planner (level, *Lighting*) | As above with lighting categories, plus path tools: draw LED strip (polyline, orthogonal assist, smooth/closed loop, circle) with metres; draw track (polyline) with head count and drawn heads; swap variant keeping geometry | — |
| 7 | Product catalogue management | Catalogue (admin unlock) | Add/edit products & variants, upload images, edit descriptions, hide/unhide, manage shared favourites | — |
| 8 | Templates | Admin: *Save as template* from a project; planner: *Start from Template* | Template stores levels/plans/elements/metres/heads/variants/export settings; new project copies it and assigns new backgrounds during setup | — |
| 9 | Quantity calculation | Continuous | Domain engine computes consolidated lines from all plan documents in the project; live totals panel in planner | — |
| 10 | Review Totals | Project → *Review Totals* | Table of lines: category, product, variant, calculated, export qty (editable), warning when calculated changed after adjustment | Exports |
| 11 | Export generation | Project → *Exports* | Configure per-export options (saved) → generate one or all → success + download; filenames from sanitised project title | Downloaded files |
| 12 | Admin settings | Admin (unlock) | Logo, WhatsApp, website, showrooms, contact wording, per-category icon size and colour/badge style, favourites, templates | — |

---

## 4. Technical architecture

### 4.1 Shape of the system

The specification implies a **shared** system: one team, one catalogue, shared favourites and templates, projects reopened from any machine. A browser-only app would silo data per device, so the Planner is a small client–server application:

```
┌──────────────────────────────┐        JSON over HTTPS        ┌──────────────────────────────┐
│  apps/web  (React SPA)       │ ───────────────────────────▶ │  apps/server (Node)           │
│  Vite · TypeScript · Tailwind│ ◀─────────────────────────── │  Hono API · Drizzle · SQLite  │
│  react-konva editor          │     files (uploads/images)   │  blob store on disk           │
│  pdf.js page rasterisation   │                              │  react-pdf + exceljs exports  │
└──────────────┬───────────────┘                              └──────────────┬───────────────┘
               │                    packages/domain (pure TS)                │
               └────────── types · categories · icons · geometry · totals ───┘
```

One Node process serves the API **and** the built SPA, with a single `data/` directory (SQLite file + uploaded files). It runs on a laptop, a Mac mini in the showroom, or any VPS/container host with a persistent volume. Backup = copy `data/`.

### 4.2 Stack and justification

| Concern | Choice | Why (and what was rejected) |
|---|---|---|
| Language | TypeScript everywhere, strict | Shared types between client, server and domain |
| Repo layout | pnpm workspace: `packages/domain`, `apps/web`, `apps/server` | The domain package (geometry, totals, export models, category config) must run identically in the browser (live totals, editor) and in Node (exports). A workspace makes that sharing first-class instead of a path alias hack. |
| Front end | React 19 + Vite 7 (SPA) | The brief suggested React/Next.js. Next.js was rejected: the app is fully behind a passcode (no SEO, no SSR benefit), is a long-lived canvas editor, and react-konva requires `ssr: false` workarounds under Next. Vite gives faster iteration and a plain static build the server can host. |
| Routing | react-router v7 (library mode) | Nested layouts (project shell → planner/review/exports) |
| Server data | TanStack Query | Caching, optimistic updates, request de-duplication for catalogue/settings/projects |
| Editor state | Zustand store + hand-rolled undo/redo over an immutable `PlanDocument` (immer) | Document-level snapshots are tiny (hundreds of elements); gives precise control of what is undoable (drag = one step) |
| Canvas | **Konva + react-konva** | Needs: locked raster background (cacheable layer), draggable nodes with mouse *and* touch, rotation handle (Transformer with resize disabled), hit-testing of paths, stage-level zoom/pan, hundreds of elements. Konva covers these natively and integrates declaratively with React state as the single source of truth. Fabric.js rejected (imperative object model becomes a second source of truth); tldraw/Excalidraw rejected (fighting their data models); plain SVG DOM considered viable but would require re-implementing drag/touch/hit-testing from scratch and repaints the whole background on every pan. |
| PDF reading | pdfjs-dist (browser) | Rasterises each page to PNG at a capped resolution (long edge ≤ 3500 px) plus a thumbnail, in the browser, so the server stays a dumb blob store with no native image dependencies |
| PDF writing | **@react-pdf/renderer** on the server | Declarative pages, exact A4/A3 portrait/landscape, embeds PNG/JPEG backgrounds, and renders **vector** overlays through its `Svg`/`Path`/`Circle`/`Text` primitives. Marker icons and paths are defined as SVG path strings in the domain package and drawn by both Konva (`Konva.Path`) and react-pdf (`<Path d>`), guaranteeing editor/export parity. Server-side rendering keeps big documents off the iPad's memory and makes "Generate All Exports" a single request. HTML→PDF via headless Chromium rejected (400 MB runtime dependency). jsPDF/pdf-lib rejected (imperative layout for cover/product pages). |
| Excel | exceljs (server) | Mature, styles, column widths, number formats |
| API | Hono on `@hono/node-server` | Tiny, typed, zod-validated routes; serves the SPA in production |
| Database | SQLite via better-sqlite3 + Drizzle ORM | Zero-ops single file, synchronous and fast for this scale; Drizzle gives typed schema + SQL migrations. Postgres would add an external service for no benefit. Storage is behind a small repository/blob-store interface so it could be swapped later. |
| Validation | zod schemas in `packages/domain`, used by API and forms | One definition of valid data |
| UI kit | Tailwind CSS v4 + Radix primitives (dialog, popover, dropdown, tooltip, select, switch, tabs, slider) + our own components | Headless accessibility with a fully custom visual language (no stock SaaS look) |
| Icons | lucide-react (UI chrome only) | Thin, consistent, not playful; **device category icons are our own fixed geometric shapes** |
| Fonts | Self-hosted variable sans (Manrope or similar via @fontsource), tabular numerals for quantities; the same TTF/WOFF registered in react-pdf, Helvetica fallback | Brand consistency on screen and in PDFs; works offline |
| Testing | Vitest (domain, server, components with Testing Library), Playwright (E2E + screenshots, desktop and iPad viewports) | Every phase ends with automated verification |
| Tooling | ESLint (typescript-eslint), Prettier, `tsx` for server dev, Docker image for deployment | — |

### 4.3 Runtime topology

- **Dev:** `pnpm dev` runs Vite (port 5173, proxying `/api` and `/files`) and the server (port 3000, `tsx watch`).
- **Prod:** `pnpm build` → `apps/web/dist` + `apps/server/dist`; `pnpm start` runs the server which serves the SPA, `/api/*` and `/files/*`. A `Dockerfile` produces one image; `data/` is a volume.
- **Config (env):** `PLANNER_PASSCODE`, `ADMIN_PASSCODE`, `SESSION_SECRET`, `DATA_DIR` (default `./data`), `PORT`. Passcodes are configuration, not database rows (no UI for changing them in Phase 1; this is the minimal secure option).

### 4.4 Access model

- `POST /api/auth/login {passcode}` → signed, httpOnly, SameSite=Lax cookie (`role: user`, 30 days).
- `POST /api/auth/admin/unlock {passcode}` → cookie upgraded with `admin: true` for 8 hours; `POST /api/auth/admin/lock` downgrades. Admin-only routes check the claim server-side; the SPA shows an unlock dialog when it receives 403.
- Simple in-memory rate limit on both endpoints (5 attempts/minute/IP). Constant-time comparison.

### 4.5 Files (blob store)

`files` table + `DATA_DIR/files/<id>` on disk. Kinds: `source` (original upload), `page` (rasterised page), `thumbnail`, `background` (rotated+cropped plan background), `project-thumbnail`, `product-image`, `logo`. Files are immutable once written; a new upload creates a new id, so project snapshots that reference an old product image keep working. Nothing is garbage-collected in Phase 1 (a periodic orphan sweep is a later nicety).

---

## 5. Data model

### 5.1 Fixed configuration (code, not database) — `packages/domain`

```ts
type PlanType = 'smart-home' | 'lighting';
type ElementKind = 'point' | 'led-strip' | 'track';
type IconShape = 'circle' | 'square' | 'diamond' | 'hexagon' | 'triangle' | 'pill' | 'ring' | 'shield' | 'roundedSquare' | 'star4';

interface CategoryDef {
  id: CategoryId;            // e.g. 'smart-switches'
  planType: PlanType;
  name: string;              // 'Smart Switches'
  order: number;             // fixed order used by library, legend, Excel, product PDF
  kind: ElementKind;         // 'led-strip' for LED Strips; 'track' for Track Lights & Magnetic Track Lights; else 'point'
  shape: IconShape;          // fixed per category
  defaults: { color: string; badge: string; badgeStyle: 'filled' | 'outline'; size: number };
}
```

Eighteen categories in the spec's fixed order (10 Smart Home, 8 Lighting). Two **system products** exist in the catalogue seed for the auto-added accessories: *Smart LED Driver* and *Track Driver* (category *Miscellaneous Lighting Accessories*, `system: true`, never shown in the library, never hideable or deletable; names editable). Their ids are constants in the domain package so the totals engine can reference them.

### 5.2 Relational tables (SQLite via Drizzle)

| Table | Columns (abridged) | Notes |
|---|---|---|
| `settings` | `id=1`, `json` | Singleton: branding, contact details, per-category icon styles, favourite variant ids |
| `products` | `id`, `category_id`, `name`, `hidden`, `system`, `sort_order`, timestamps | |
| `variants` | `id`, `product_id`, `name`, `description`, `image_file_id?`, `hidden`, `sort_order`, timestamps | |
| `files` | `id`, `kind`, `mime`, `width?`, `height?`, `bytes`, `original_name?`, `created_at` | Blob metadata; bytes on disk |
| `projects` | `id`, `title`, `customer_name`, `customer_contact`, `property_address`, `property_type?`, `status`, `thumbnail_file_id?`, `last_opened_level_id?`, `last_opened_plan_type?`, `catalogue_snapshot` (json), `quantity_adjustments` (json), `export_settings` (json), `recent_variant_ids` (json), timestamps | |
| `source_files` | `id`, `project_id`, `file_id`, `name`, `kind` (`pdf`/`image`), `page_count`, `sort_order` | Uploaded originals |
| `source_pages` | `id`, `project_id`, `source_file_id`, `page_index`, `file_id` (rasterised page), `thumbnail_file_id`, `width`, `height` | One per PDF page / image |
| `levels` | `id`, `project_id`, `name`, `sort_order`, `paper_size` (`A4`/`A3`), `orientation` | Never deleted |
| `plans` | `id`, `project_id`, `level_id`, `type`, `source_page_id`, `rotation` (0/90/180/270), `crop` (json, fractions of the rotated page), `background_file_id`, `background_width`, `background_height`, `document` (json), `revision`, timestamps; **unique (level_id, type)** | Deleting a plan deletes the row (background/elements go with it) |
| `templates` | `id`, `name`, `description`, `source_project_id?`, `structure` (json), timestamps | Admin-only writes |

### 5.3 JSON documents (typed + versioned + zod-validated)

```ts
interface PlanDocument {
  schemaVersion: 1;                 // migrations run on load: migratePlanDocument(raw) → latest
  elements: PlanElement[];          // z-order = ascending `z`
  view: { hiddenCategories: CategoryId[]; legendVisible: boolean };   // editor view state, saved, not undoable
}

type PlanElement = PointMarker | LedStripPath | TrackPath | TextNote;

interface PointMarker { kind: 'marker'; id; z; variantId; x; y; rotation; label: string }
interface LedStripPath { kind: 'led-strip'; id; z; variantId; points: Pt[]; closed: boolean; smooth: boolean; metres: number | null; showLabel: boolean }
interface TrackPath    { kind: 'track';     id; z; variantId; points: Pt[]; headCount: number; showLabel: boolean }
interface TextNote     { kind: 'note';      id; z; x; y; text: string; fontSize: number; bold: boolean; color: string; highlight: string | null }
```

**Coordinate system (normalised plan units).** Every plan has an isotropic coordinate space where the background's width is exactly **1000 units** and its height is `1000 × H/W`. Positions, path points, icon sizes, stroke widths and note font sizes are all in plan units, so an element looks the same relative to the drawing in the editor at any zoom and on the exported page at any paper size. Rendering scale is simply `displayedWidth / 1000`.

Other project-level JSON:

```ts
interface VariantSnapshot { variantId; productId; categoryId; productName; variantName; description; imageFileId: string | null; capturedAt }
// project.catalogueSnapshot: Record<variantId, VariantSnapshot> — captured the first time a variant (or auto driver) is used in the project; never auto-refreshed.

interface QuantityAdjustment { quantity: number; calculatedAtAdjustment: number; adjustedAt }
// project.quantityAdjustments: Record<LineKey, QuantityAdjustment>; LineKey = `variant:${variantId}`

interface ExportSettings {
  floorPlan: { showCustomerName; showCustomerContact; showPropertyAddress; levels: Record<levelId, { smartHome: boolean; lighting: boolean }>; hiddenCategories: CategoryId[]; showLabels; showLedLengths; showTrackLabels; showNotes; showLegend };
  productDescription: { showCustomerName; showCustomerContact; showPropertyAddress; excludedCategories: CategoryId[] };
}

interface TemplateStructure {
  levels: { name; sortOrder; paperSize; orientation; plans: { type: PlanType; document: PlanDocument }[] }[];
  exportSettings: ExportSettings;            // level entries re-keyed on instantiation
  catalogueSnapshot: Record<variantId, VariantSnapshot>;   // fallback only; new projects re-snapshot from the live catalogue
}

interface Settings {
  branding: { logoFileId: string | null; whatsapp: string; website: string; showrooms: { name: string; address: string }[]; contactWording: string };
  categoryStyles: Partial<Record<CategoryId, { color?: string; badge?: string; badgeStyle?: 'filled' | 'outline'; size?: number }>>;  // overrides of CategoryDef.defaults
  favouriteVariantIds: string[];
}
```

### 5.4 Snapshot rule (spec §8.3, §18, §21)

- Markers and paths store only `variantId`. Names, descriptions and images for totals and exports are resolved from `project.catalogueSnapshot`, which is written the first time a variant is used in that project. Later catalogue renames/hides/image changes therefore never alter an existing project's totals or exports.
- Hidden variants stay resolvable (hiding only removes them from the library, search and favourites).
- Changing a marker to a *different* variant captures that variant's current snapshot if the project has none yet.
- New projects created from a template re-snapshot from the live catalogue (falling back to the template's stored snapshot if a variant no longer exists).

---

## 6. Domain rules

### 6.1 Quantity engine — `computeTotals(input): TotalLine[]`

Input: every `PlanDocument` in the project (all levels, both plan types) + a resolver `variantId → VariantSnapshot`. Output lines, consolidated project-wide:

| Element | Grouping | Quantity | Unit |
|---|---|---|---|
| Point marker | `variantId` | count of markers | pcs |
| LED strip path | `variantId` | Σ `metres` (null counts as 0, flagged `missingMetres`) | m (1 dp) |
| Track path | `variantId` | Σ `headCount` | pcs |
| LED strip path | system *Smart LED Driver* | number of LED runs (all variants) | pcs, `autoAdded: true` |
| Track path | system *Track Driver* | number of tracks (all variants) | pcs, `autoAdded: true` |

Switches count by marker (one unit per placed switch), never by gang count — gangs only matter if they are different catalogue variants, which the grouping already handles. Lines carry `categoryId`, `productName`, `variantName`, `unit`, `calculated`, `autoAdded`. Sorting is fixed: category order → product name → variant name (used by live totals, Review Totals, Excel and the product PDF).

### 6.2 Review Totals — `applyAdjustments(lines, adjustments)`

`exportQuantity = adjustment?.quantity ?? calculated`; `warning = adjustment && adjustment.calculatedAtAdjustment !== calculated`. Adjustments live in the project, survive reloads, never touch plan elements, and never block export. Setting the export quantity equal to the calculated value clears the adjustment (no separate reset button, per spec).

### 6.3 Exports

- **Filenames:** `sanitiseFilename(title)` strips `\ / : * ? " < > |` and control characters, collapses whitespace, trims, caps at 100 chars, falls back to `Project`; patterns exactly as spec §11.
- **Marked floor-plan PDF:** cover (logo, "Marked Floor Plan", title, optional customer fields) → for each selected level in order, for each selected plan type that exists: page in the level's size/orientation, 10 mm margins, header (level name · plan type, logo + contact line), background image fitted (contain) into the plan area, overlays drawn in the same transform with export settings applied (hidden categories removed, labels/LED lengths/track labels/notes toggles), legend strip listing only categories present *and visible* on that page. White background, black text, category colours on icons only.
- **Quantity Excel:** one sheet "Quantities"; row 1 `Customer contact number: …`; header row `Category | Product | Variant | Quantity`; section rows *Smart Home Products* / *Lighting Products*; LED lines show metres as a number with "m" number format; drivers listed normally; nothing else.
- **Product description PDF:** cover → *Smart Home Products* → *Lighting Products* (category headings in fixed order, each variant once with image, product + variant name, description, quantity) → contact page from settings. Excluded categories and system drivers omitted. Uses export quantities (post-adjustment).

### 6.4 Editor rules

- Background locked: not selectable, movable or deletable in the planner; replacing it means deleting the plan (confirmation) and re-adding it in Setup.
- Library shows only the active plan type's categories; hidden products/variants and the system drivers never appear; search matches product and variant names; Favourites (global, admin-managed) and Recently Used (per project, last 12) sections.
- Point placement is freeform (no grid/wall snapping). Path drawing offers an *orthogonal* assist toggle (Shift inverts it) for 90° turns — a drawing aid, not a snap-to-grid.
- Category icon size/colour/badge come from settings (global); users cannot resize icons individually; shapes are fixed.
- Labels: marker label text below the icon; LED label `"{metres}m LED Strip"`; track label `"{n}-head Track"` (or `"{n}-module Magnetic Track"`), each toggleable per element and globally in export.
- Track heads are drawn at `(i + 0.5) / n` of the path length; changing the variant keeps geometry and head count.
- LED paths: `smooth: true` renders a Catmull-Rom spline (converted to cubic Béziers) through the points; `closed: true` joins the last point to the first; the *Circle* tool creates a closed smooth 8-point path; vertices are draggable; segments can be split by double-click.
- Selection: click, Shift+click toggle, marquee on empty canvas (select tool), Ctrl/Cmd+A. Group move by dragging any selected element; Delete/Backspace removes the selection (no confirmation). Single-element duplicate (Ctrl/Cmd+D, offset by one icon size). Layer: bring to front / forward / backward / send to back (`[`, `]`, with Shift).
- Undo/redo: document snapshots; one entry per completed gesture (drag end, text commit, property change); Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z / Ctrl+Y. View state (zoom, pan, hidden categories, legend) is not undoable.
- Autosave: debounced 750 ms after the last document change, plus flush on blur/visibilitychange/route change; `PUT /api/plans/:id/document {document, baseRevision}`; the server bumps `revision`; a 409 (changed elsewhere) reloads the server copy and tells the user. Unsaved changes are mirrored to `localStorage` keyed by plan id + revision as a crash safety net, offered for restore on reopen. Save state is always visible ("Saved", "Saving…", "Unsaved changes").
- Last opened level/plan type is patched on every switch; reopening a project lands there.

---

## 7. Front-end structure

```
apps/web/src/
  app/            router, providers (query client, auth, admin-unlock), AppShell (top bar, nav rail)
  components/ui/  Button, IconButton, Input, Textarea, Select, Switch, Tabs, Dialog, ConfirmDialog, Popover, DropdownMenu, Tooltip,
                  Badge, Table, SegmentedControl, NumberStepper, ColorSwatch, EmptyState, Skeleton, Toast, PageHeader, Panel
  features/
    auth/         PasscodeScreen, AdminUnlockDialog
    dashboard/    ProjectDashboard, ProjectCard, NewProjectDialog
    setup/        SourceUploader (pdf.js), PageThumbnails, LevelList, PlanAssignment, CropRotateEditor
    planner/      PlannerScreen, canvas/ (PlanStage, BackgroundLayer, ElementsLayer, MarkerNode, PathNode, NoteNode, SelectionLayer, LegendOverlay),
                  library/ (DeviceLibrary, CategorySection, VariantTile), inspector/ (MarkerInspector, LedPathInspector, TrackInspector, NoteInspector, MultiInspector),
                  totals/ (LiveTotalsPanel), store/ (plannerStore, undo, autosave, selection, viewport), tools/ (select, pan, drawPath, placeMarker)
    review/       ReviewTotalsScreen
    exports/      ExportsScreen, FloorPlanExportOptions, ProductPdfOptions
    catalogue/    CatalogueScreen, ProductEditor, VariantEditor
    templates/    TemplatesScreen, SaveAsTemplateDialog
    admin/        AdminSettingsScreen (Branding, IconStyles, Favourites)
    help/         HelpScreen
  lib/            api client (typed fetch + zod), images (pdf.js, crop/rotate via canvas), keyboard shortcuts, format helpers
  styles/         tokens.css (colour, type, spacing, radius, shadow), globals.css
```

Rendering parity: `packages/domain/src/render/` produces a *scene* (icon path strings with transforms, path `d` strings, label positions, head positions, legend entries) from a `PlanDocument` + styles. The Konva layer and the react-pdf page are thin adapters over that scene, so what you see is what you export.

---

## 8. Visual direction (summary; detailed with the frontend-design skill in Phase A)

Premium, architectural, minimal, built for long sessions. Warm off-white surfaces, charcoal type, a restrained brushed-gold accent used only for primary actions, focus and the active state, hairline warm-grey borders, a strong spacing scale, uppercase tracked section labels for the "technical editor" feel, tabular numerals for quantities. No gradients, no heavy shadows, no oversized cards, no decorative animation (only purposeful 120–160 ms transitions). The planner gives the canvas the whole viewport: 56 px top bar, 280 px library (collapsible), 320 px inspector/totals (collapsible), floating toolbar, all usable at 1024 × 768 (iPad landscape) and beyond. Category colours are a curated 18-hue palette chosen to print legibly on white.

---

## 9. Development phases and exit criteria

Phases follow the specification's roadmap (§20). Each phase ends only after: implemented → tests pass → lint/typecheck clean → Playwright run/screenshots inspected → regressions fixed.

| Phase | Scope | Exit criteria |
|---|---|---|
| **A — Foundation, design system, static UX** | Workspace scaffold, tooling, domain package (categories, icon shapes, types, zod schemas, sample data), design tokens and UI primitives, app shell + navigation, every screen with realistic sample data: passcode, dashboard, new project, floor-plan setup, planner (library, canvas with sample background and elements rendered in Konva, inspector, live totals, legend), review totals, exports, catalogue, templates, admin settings, help; empty and loading states; iPad layout | All routes render; screenshots at 1440 × 900 and 1024 × 768 reviewed; `pnpm test`, `pnpm lint`, `pnpm typecheck` green; sample data flows through the same hooks real data will |
| **B — Data model, API, persistence, access** | Drizzle schema + migrations + seed (catalogue incl. system drivers, default settings), blob store, Hono routes for auth/settings/catalogue/files/projects/levels/plans/templates, session cookies, admin unlock, typed client, dashboard + project details on real data | API integration tests; passcode gate works end-to-end; create/open/delete project persists |
| **C — Project creation & floor-plan setup** | Uploads (PDF via pdf.js, images), page rasterisation + thumbnails, level add/rename/reorder, paper size/orientation, plan assignment with rotate/crop preview/reset, plan delete/re-add, background lock, project thumbnail | Acceptance scenario *Multi-level setup* passes in Playwright |
| **D — Catalogue & admin settings** | Catalogue CRUD, variants, images, descriptions, hide/unhide, favourites, branding/contact, icon size/colour/badge per category, admin passcode protection | Scenario *Catalogue history* (snapshot retained) passes |
| **E — Point-device planner** | Konva editor: locked background, zoom/pan/reset, library drag-and-drop (pointer-based, touch-friendly), move/rotate/duplicate/delete, labels, variant change, multi-select + marquee, group move/delete, layer order, category visibility, legend, text notes, undo/redo, autosave with revision + local safety net, last-opened restore | Scenarios *Smart-home planning* and *Multi-select* pass |
| **F — Lighting paths** | LED strip and track drawing/editing (polyline, orthogonal assist, smooth/closed loops, circle tool, vertex edit, split), metres and head counts, head distribution, labels, variant swap preserving geometry | Scenarios *LED-strip planning* and *Track planning* pass |
| **G — Quantity engine & live totals** | Domain engine with exhaustive unit tests; live totals panel with "auto-added" labelling | Engine tests cover consolidation across levels/plan types, metres, heads, drivers, hidden variants |
| **H — Review Totals** | Adjustments, calculated vs export display, change warnings, persistence | Scenario *Review adjustments* passes |
| **I — Exports** | Floor-plan PDF, Excel, product PDF, filename sanitisation, Generate All, export settings saved | Scenario *Exports* passes; PDFs inspected visually; Excel opened and checked |
| **J — Templates** | Save as template (admin), start from template with background assignment, independence of copies | Scenario *Template* passes |
| **K — QA & polish** | Full acceptance run, iPad pass, performance with large backgrounds, Docker image, README/runbook | All nine acceptance scenarios automated and green |

---

## 10. Critical risks and mitigations

1. **Editor feel on touch (iPad).** Konva drag works with touch, but pinch-zoom, two-finger pan and marquee need custom pointer handling and conflict carefully with drag. *Mitigation:* a single gesture controller in `planner/tools`, Playwright touch-emulation tests, iPad pass in Phase E and K.
2. **Editor ↔ PDF parity.** Two renderers can drift. *Mitigation:* one scene model in `domain/render` consumed by both; snapshot tests comparing scene output; visual review of every export in Phase I.
3. **Large uploads / memory.** Multi-page A3 PDFs rasterised at high resolution can exhaust iPad memory. *Mitigation:* cap long edge at 3500 px, rasterise one page at a time, PNG for line drawings and JPEG (q 0.9) for photos, upload per page.
4. **Autosave conflicts / data loss.** *Mitigation:* revision-checked saves, visible save state, localStorage safety net, flush on navigation and unload.
5. **Hosting target unknown.** SQLite + disk assumes a persistent volume (any VPS/Docker/laptop). Serverless hosts (e.g. Vercel) would need Postgres + object storage. *Mitigation:* storage behind `ProjectRepository`/`BlobStore` interfaces; decision needed from Maxsen before Phase K packaging.
6. **Fonts in react-pdf.** WOFF2 is not supported by pdfkit; *Mitigation:* ship a TTF/WOFF copy of the UI font; fall back to Helvetica.
7. **Scope.** Eleven phases is a lot of surface. *Mitigation:* phase gates with automated acceptance scenarios; no phase declared done with placeholder buttons.
8. **Environment (immediate).** The cloud session's network allowlist blocks the npm registry, so dependencies cannot be installed until `registry.npmjs.org` is allowed (or the work moves to a machine with npm access).

---

## 11. Testing strategy

- **Domain (Vitest):** geometry (lengths, point-at-length, head positions, spline conversion, bounds), totals engine (every rule in §6.1, consolidation across plans, missing metres), adjustments/warnings, filename sanitisation, document migrations, template instantiation.
- **Server (Vitest + Hono `app.request`):** auth and rate limit, admin gating, CRUD, revision conflict, export endpoints produce valid PDF/XLSX (parsed back and asserted).
- **Web (Vitest + Testing Library):** store reducers (undo/redo, selection, layer order), inspectors, review table logic.
- **E2E (Playwright, Chromium):** the nine acceptance scenarios from spec §21, run at 1440 × 900 and 1024 × 768 with touch emulation for the planner; screenshot review at the end of every phase.

---

## 12. Ambiguities resolved (recorded so they can be challenged)

| Topic | Decision |
|---|---|
| Magnetic Track Lights | Treated as path-based (track) like Track Lights: head/module count, one Track Driver per path |
| Where auto drivers live | System products in *Miscellaneous Lighting Accessories*; appear in totals/Excel only |
| Recently Used scope | Persisted per project (last 12 variants); never global |
| Icon size units | Plan units (fraction of drawing width) with presets XS–XL and a numeric field; print size therefore scales with paper size, which matches how the drawing itself scales |
| Orthogonal drawing assist | Toggle in the path toolbar (Shift inverts) — a drawing aid, not snap-to-grid |
| Passcodes | Environment configuration; no in-app change screen in Phase 1 |
| Level without any plan | Allowed (both plans may be added later); exports skip it |
| Export quantity equal to calculated | Clears the adjustment |
| Template backgrounds | Templates store no backgrounds; the new project's setup screen asks for one per plan |
| Deleting a project | Hard delete of project rows and plan documents; uploaded files are left on disk (no GC in Phase 1) |
