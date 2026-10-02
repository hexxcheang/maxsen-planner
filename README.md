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
   set paper size and orientation, and choose a drawing for each Smart Home or Lighting plan. Turn it
   upright, then crop it: the app suggests a crop to just the floor plan (trimming borders, title blocks
   and notes), and you can drag the box or its handles to adjust it.
4. **Planner:** click a library item then click the plan (or drag it on) to place devices; draw LED strips
   and tracks by clicking points (Shift for straight runs, double-click or Enter to finish); circle LED loops;
   text notes. Edit everything in Details: variant, label, rotation, LED metres, head counts, note styling,
   layer order, duplicate, delete. Undo/redo, Ctrl/Cmd+A, Delete, Esc. Live totals update as you go.
5. **Review totals:** adjust export quantities; warnings if plans change afterwards.
6. **Exports:** generate the marked floor plan PDF, the product description PDF and the quantity Excel
   file, one at a time or all together, then download them.
7. **Admin:** catalogue editing with product images, branding with logo upload, icon styles, favourites,
   and _Your data_ (restore samples or erase everything).

**Magic Plan:** in the Plan tab, _Magic Plan_ reads the level's drawing (rooms, the openings between
them, windows, scale) and places devices by fixed rules based on Singapore renovation practice:
- **Downlights** go in a symmetric grid at least 0.6 m off the walls, about 1.5 m apart in living
  areas and 1.4 m in bedrooms. There is roughly one per 1.5 m² at most, so ceilings aren't
  over-lit, and rows line up across adjoining rooms.
- **Bedrooms** keep the pillow end of the bed clear. The master bedroom also gets a switch on each
  side of the bed.
- **Kitchens** get a row of downlights over the worktop and an under-cabinet LED strip.
- **Corridors** get a single centre row.
- **Bathrooms** get one to three downlights.
- **Service yards, stores and balconies** get one surface light. The household shelter gets exactly
  one surface light, because it may not be hacked.
- **LED coves** go in living areas and the master bedroom, with fewer downlights there. Dining
  gets a pendant. Track lights are used only in long, narrow spaces.
- **Ceiling fans** (with light) go in living areas and bedrooms: 52" in the living room and master
  bedroom, 46" in common bedrooms. Downlights stay 0.5 m clear of the blades, and the fan gets a
  gang on the room's switch.
- **Switches** go inside each room, beside the opening, on the side with more wall (which way a
  door swings isn't needed). Bathrooms, stores, the shelter and the service yard are switched from
  outside.
- **Smart devices:** control panels at the entrance and in the master bedroom, curtains at living
  and bedroom windows, and a router, gateway and mesh nodes.

Tick or untick categories before it runs; review the counts; one Undo
removes the result. The sample drawings work straight away.

Uploaded drawings are read **on this computer** by default; nothing is sent anywhere. Magic Plan finds the
thick wall lines, closes the door and window gaps to get the rooms, finds the openings between rooms and
the windows on outside walls, and works out the scale from the door widths. It doesn't try to tell which
room is which: each room is planned by its size and shape. Long narrow rooms are planned as corridors
and tiny ones as stores. Small rooms are planned like bathrooms and switched from outside. The largest
room is planned as the living area, with a cove and a fan, and the rest like bedrooms, with a fan,
downlights and curtains. Move or delete anything that doesn't suit a room once it's placed. Magic Plan
reads clean architectural plans with solid walls best.

**Optional: reading with Claude.** For unusual or hand-drawn plans you can let Claude (vision) read the
drawing instead, on the app's server. This needs an Anthropic API key; once set up, choose _With Claude_ in
the Magic Plan window:

1. Create a key at https://console.anthropic.com/settings/keys (this is billed to your Anthropic account;
   reading one drawing usually costs well under US$1).
2. In the `maxsen-planner` folder, copy `.env.example` to a new file named `.env` and paste the key after
   `ANTHROPIC_API_KEY=`. The `.env` file is never uploaded to GitHub.
3. Restart the app (Control + C, then `pnpm dev`). The Terminal shows `Magic Plan: ready`.

**Where data lives:** this browser only (localStorage for projects and settings, IndexedDB for uploaded
files). Another device or browser starts from the sample data. Shared storage, the API and real passcode
checks are Phase B.

**Not yet:** marquee selection,
vertex editing of drawn paths, and saving a project as a template.

See `docs/superpowers/notes/phase-a-review.md` for the Phase A review.
