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
   text notes. Curtains are dotted lines along the window, drawn like an LED strip (click one end of the
   window, then the other) and adjusted the same way: drag the ends, or + to add a bend. Control panels
   are drawn larger than switches. Edit everything in Details: variant, label, rotation, LED metres, head
   counts, note styling, layer order, duplicate, delete. Ctrl/Cmd+C copies the selection and Ctrl/Cmd+V
   pastes it beside the original (further along each time, on any level of the same plan type).
   Downlights and surface lights snap into line with nearby lights as you place or drag them, and to
   even spacing once two or more share a line (magenta guides show it; hold Alt/Option to place freely).
   Undo/redo, Ctrl/Cmd+A, Delete, Esc. Live totals update as you go.
5. **Review totals:** adjust export quantities; warnings if plans change afterwards.
6. **Exports:** generate the marked floor plan PDF, the product description PDF and the quantity Excel
   file, one at a time or all together, then download them. The PDFs are laid out as a proposal: a
   cover with the logo over Maxsen's champagne monogram canvas (hexagon M roundels and sparkle
   diamonds in fine rose-gold lines, on white fading to warm sand; drawn seamlessly and centred on each
   page) or over a light background uploaded in Admin › Branding; plan pages with a framed plan, a
   legend with how many of each device and a title block; an at-a-glance overview, product cards, and
   a contact page. Curtains are marked
   "S. Curtains" on the plans.
7. **Admin:** catalogue editing with product images (delete a variant, or a whole series with its
   variants; projects already using them keep them), branding with logo upload, icon styles, favourites,
   and _Your data_ (restore samples or erase everything).

**Quick quote:** the _Quote_ tab prices a client's text message without a project. Paste the message
(a list or a sentence) and press _Read message_. Each item is matched to the catalogue by product name
("Lusano", "Nova S8") or everyday words ("switches", "downlights", "cctv", "aircon"), with the variant
from its details ("2 gang", "black", "warm white", "double") and the quantity or LED metres. LED
drivers are added for the strip (one per 5 m, the LED package's ratio). Anything with a number that
names no product is listed as not recognised. Check and adjust the items, and the quotation is priced
exactly as on the invoice (packages, add-ons, integration and deposit). _Copy as text_ gives a version
to paste into WhatsApp; _Download quotation (PDF)_ gives a proposal-style quotation (the champagne cover,
the priced items, total, deposit, warranty, terms and payment details); _Download quotation (Excel)_
fills the invoice template. The quote in progress
is kept in the browser until _New quote_.

**Magic Plan:** in the Plan tab, _Magic Plan_ places devices for you in two steps.

1. **Rooms.** Choose the type of home: a 2- to 5-room flat, an executive flat, a 2- or 3-bedroom condo,
   or "Other". The app lists the rooms that home has. A 5-room flat, for example, has a master bedroom,
   3 bedrooms, the living/dining room, the kitchen and 2 toilets. Drag a rough box over each room on
   the drawing, then tap where its door is; each box outlines the next room in the list, so there's no
   need to pick rooms first. Tap a box to select its room (to add an area, redraw it or move its door). Add or remove rooms as needed, for example a service
   yard, shelter, study or corridor. The floor area sets the drawing's scale, for spacing. Your outlines
   are kept, so the next run starts from them. The sample drawings come already outlined.
2. **What to place.** Tick the categories, then review the counts and place everything. One Undo
   removes it all.

How rooms are planned (Singapore practice). Light counts follow the size of the box you draw:

| Room                          | Downlights                                            | LED strips                                | Also                            |
| ----------------------------- | ----------------------------------------------------- | ----------------------------------------- | ------------------------------- |
| Living / family / dining area | 1 per 2.5 m², 2–12 (about 8–12 in a full living room) | 1–4 by size, in the L-box along the walls | 52" ceiling fan; dining pendant |
| Master bedroom                | 1 per 3.5 m², 2–6                                     | 1–3 by size                               | 52" ceiling fan                 |
| Other bedrooms                | 1 per 4 m², 2–4                                       | 0–2 by size                               | 46" ceiling fan                 |
| Kitchen                       | A row over the worktop                                | Under-cabinet strip                       |                                 |
| Toilets                       | 1–2                                                   |                                           | Switched from outside           |
| Service yard, store, shelter  | One surface light                                     |                                           | Switched from outside           |
| Corridor                      | A single centre row                                   |                                           |                                 |

Windows are marked by hand in the Rooms step: press _Mark windows_ and tap an X on each window's line
(on the home's outer walls, and the glass doors onto a balcony). The app follows the glazing lines from
the X both ways until they stop or meet a solid wall or column, and shows the window in blue. Tap an X
again to remove it, or drag along a window to draw it yourself. A window between two outlined rooms is
ignored. Windows the app used to guess by itself are dropped from saved plans, so mark them again.

Smart curtains go only at windows, and only in living rooms, bedrooms and the study (not dining or
family areas, kitchens or toilets). With no windows marked, no curtains are planned. A curtain room's window
wall also gets its first LED strip as a curtain cove. Strips run close along the walls, 0.3 m in.

Odd-shaped rooms (an L-shaped living room, a dining nook): after outlining a room, press the **+** on
its corner and drag another box over the rest of it. The boxes can overlap; they join into one room.
Press the **×** on an added area to take it off. A joined room is planned as one: lights spread over
every area (the count is for its whole floor), one switch, one fan, and no LED strip across the seam
between areas.

Room sizes come from the floor area, shared among the listed rooms by their typical sizes, so outlining
only some rooms doesn't inflate them.

- **Spacing:** downlights are spread evenly and symmetrically, at least 0.5 m off the walls. With a fan
  they ring the fan and stay clear of its blades. Track lights are used only in long, narrow spaces.
- **Switches:** each room gets one switch, beside its door on the side with more wall.
- **Smart devices:**
  - control panels at the entrance and in the master bedroom;
  - curtains at the windows of living rooms, bedrooms and the study;
  - a router, gateway and mesh nodes, when ticked (they're off by default).

**Optional: Claude.** If an Anthropic API key is set up, the Rooms step has a _Suggest rooms with Claude_
button that outlines the rooms for you to check:

1. Create a key at https://console.anthropic.com/settings/keys (billed to your Anthropic account; one
   drawing usually costs well under US$1).
2. In the `maxsen-planner` folder, copy `.env.example` to a new file named `.env` and paste the key after
   `ANTHROPIC_API_KEY=`. The `.env` file is never uploaded to GitHub.
3. Restart the app (Control + C, then `pnpm dev`). The Terminal shows `Magic Plan: ready`.

**Prices and the invoice:** the _Invoice_ export fills in your own invoice template
(`apps/web/public/templates/invoice-template.xlsx`). Quantities come from Review totals and are grouped
into packages:

| Package                  | Contents                                                      | Price   |
| ------------------------ | ------------------------------------------------------------- | ------- |
| Ark Core switch package  | 10 Ark switches, 4 aircon IR, 1 gateway (add-on S$100 each)   | S$1,390 |
| Nova+ Pro switch package | 10 Nova+ Pro switches, 4 IR, 1 gateway (add-on S$180 each)    | S$1,990 |
| Lusano+ Prestige package | 10 Lusano+ switches, 4 IR, 1 gateway (add-on S$360 each)      | S$3,590 |
| Light                    | 12 downlights / surface lights (add-on S$78 each)             | S$988   |
| LED                      | 30 m of LED strip with 6 drivers (add-on S$18/m, S$78/driver) | S$988   |

Switches belong to a series by product name (Ark, Nova, Lusano). The full catalogue is transcribed in
[`docs/pricing-catalogue.md`](docs/pricing-catalogue.md).

A quotation has at most one switch package (for the series with most switches), one light package and
one LED package; everything beyond is charged at the add-on rates. Integration per light and per driver is listed
and waived. Every other device is charged at its catalogue price, and the invoice adds the total and a
60% deposit.

- Set each device's price when editing a variant in **Catalogue**. Prices appear only on the invoice,
  never on the product description.
- Set package prices, add-on rates, company details, invoice prefix, deposit, terms and bank details in
  **Admin settings › Pricing**.
- Upload your newest price catalogue PDF in the same place, for reference. Prices aren't read from it
  automatically, because the catalogue PDF is made of images rather than text.

**LED strips:** select a strip on the plan to get round handles on its points. Drag them to bend,
lengthen or shorten the run. The **+** just past its end adds a point that you can drag to any angle.
Segments within 8° of level or plumb snap exactly straight (hold Shift while drawing to force it). Lengths
aren't shown on the plan; enter the final metres in Review totals.

**Where data lives:** this browser only (localStorage for projects and settings, IndexedDB for uploaded
files). Another device or browser starts from the sample data. Shared storage, the API and real passcode
checks are Phase B.

**Not yet:** marquee selection and saving a project as a template.

See `docs/superpowers/notes/phase-a-review.md` for the Phase A review.
