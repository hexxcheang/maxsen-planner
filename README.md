# Maxsen Smart Home Planner

Internal planning, device-counting and export tool for Maxsen Smart Solutions (Phase 1).

## Layout

- `packages/domain` — framework-free TypeScript: categories, icon shapes, geometry, quantity engine, scene model, sample data.
- `apps/web` — React + Vite single-page app (the planner UI).
- `apps/server` — Hono server: `GET /api/health` and the built web app (API and SQLite arrive in Phase B).
- `docs/` — product specification, technical design and implementation plans.

## Running

```bash
pnpm install
pnpm dev        # web on http://localhost:5173, API on http://localhost:3000
pnpm test       # unit tests (domain + web + server)
pnpm typecheck
pnpm lint       # zero warnings allowed
pnpm check      # typecheck + lint + test
pnpm e2e        # Playwright screens (desktop + iPad) → test-results/screens/*.png
pnpm build && pnpm start   # production: single server on :3000
```

Phase A sample passcodes: team `maxsen`, admin `admin`.

If Chromium is already installed somewhere (CI images, cloud sessions), point Playwright at it instead of
running `playwright install`: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome pnpm e2e`.

Review URLs: `?sample=empty` starts with no projects, catalogue or templates; `?sample=loading` shows loading
states; `/dev/styleguide` (dev server only) shows every UI primitive and category glyph.

## Status

**Usable MVP (runs entirely in the browser).** On top of Phase A, the app now works end to end:

1. **Sign in** with `maxsen`; unlock admin with `admin`.
2. **New project** from blank or a template (templates copy levels and export settings).
3. **Setup:** upload PDFs (each page is rendered in the browser) or JPG/PNG images, add and order levels,
   set paper size and orientation, and choose a drawing for each Smart Home or Lighting plan, rotated upright.
4. **Planner:** click a library item then click the plan (or drag it on) to place devices; draw LED strips
   and tracks by clicking points (Shift for straight runs, double-click or Enter to finish); circle LED loops;
   text notes. Edit everything in Details: variant, label, rotation, LED metres, head counts, note styling,
   layer order, duplicate, delete. Undo/redo, Ctrl/Cmd+A, Delete, Esc. Live totals update as you go.
5. **Review totals:** adjust export quantities; warnings if plans change afterwards.
6. **Exports:** generate the marked floor plan PDF, the product description PDF and the quantity Excel
   file, one at a time or all together, then download them.
7. **Admin:** catalogue editing with product images, branding with logo upload, icon styles, favourites,
   and _Your data_ (restore samples or erase everything).

**Magic Plan:** in the Plan tab, _Magic Plan_ reads the level's drawing (rooms, doors and which way they
swing, windows, scale) and places devices by fixed planning rules: switches beside the handle side of each
door (bathrooms and balconies switched from outside, two-way switches where walkways meet), downlight grids,
surface lights in service spaces, LED coves and kitchen strips, a dining pendant, track lights only in long
narrow spaces, control panels at the entrance and master bedroom, curtains at living and bedroom windows,
router, gateway and mesh nodes. Tick or untick categories before it runs; review the counts; one Undo
removes the result. The sample drawings work straight away. For your own uploaded drawings it uses Claude
(vision) on the app's server, which needs an Anthropic API key:

1. Create a key at https://console.anthropic.com/settings/keys (this is billed to your Anthropic account;
   reading one drawing usually costs well under US$1).
2. In the `maxsen-planner` folder, copy `.env.example` to a new file named `.env` and paste the key after
   `ANTHROPIC_API_KEY=`. The `.env` file is never uploaded to GitHub.
3. Restart the app (Control + C, then `pnpm dev`). The Terminal shows `Magic Plan: ready`.

**Where data lives:** this browser only (localStorage for projects and settings, IndexedDB for uploaded
files). Another device or browser starts from the sample data. Shared storage, the API and real passcode
checks are Phase B.

**Not yet:** dragging the crop rectangle (drawings are used full-page, rotation only), marquee selection,
vertex editing of drawn paths, and saving a project as a template.

See `docs/superpowers/notes/phase-a-review.md` for the Phase A review.
