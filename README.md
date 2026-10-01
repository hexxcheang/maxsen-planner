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

**Phase A — foundation, design system and static UX: complete.** Every screen renders with realistic
sample data through the same data hooks Phase B will back with the API:

- Passcode gate and admin unlock (sample passcodes above)
- Projects dashboard with search and delete, new project from blank or template
- Floor-plan setup: levels (rename, reorder, paper size and orientation), plan cards, plan deletion
- Planner: Konva canvas rendering the shared scene model, zoom and pan, selection and marker drag,
  device library, inspector, live project totals, legend and category visibility, level and plan switching
- Review totals with export-quantity adjustments and change warnings
- Exports centre with saved options and sanitised filename previews
- Catalogue, templates and admin settings (branding, icon styles, favourites)

Controls that belong to later phases are visibly disabled with the tooltip "Available in a later phase"; see
`docs/superpowers/notes/phase-a-review.md` for the full list and the screenshot review. Next: Phase B (data
model, API, persistence, access).
