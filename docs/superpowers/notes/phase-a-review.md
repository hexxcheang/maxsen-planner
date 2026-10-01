# Phase A review — screenshots, iPad pass and deferred controls

**Date:** 2026-10-01
**Scope:** Tasks 1–15 of `docs/superpowers/plans/2026-10-01-phase-a-foundation-design-system-static-ux.md`.

## How the review was run

`pnpm e2e` (Playwright, Chromium) captures every screen at 1440 × 900 (`desktop`) and 1024 × 768 with touch
(`ipad`) into `test-results/screens/{name}-{project}.png`: login, dashboard, dashboard-empty,
dashboard-loading, new-project, setup, planner-smart-home, planner-lighting, review, exports, catalogue,
templates, admin (branding, icon styles, favourites), help, styleguide and not-found. Each screenshot was
checked against the design tokens and the critique list: one accent, no caps labels in the UI, no nested
cards, line length under 80 ch, visible focus, canvas gets the most area, panels usable at 1024 × 768,
nothing truncated that matters.

## Findings and fixes

| #   | Screen         | Finding                                                                                  | Fix                                                                                                                                           |
| --- | -------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Shell          | Full-page screenshots cut off because the shell scrolls inside `<main>`                  | e2e helper lets the document grow before capture                                                                                              |
| 2   | Dashboard      | Chromium printed "Sept"; the updated date wrapped onto two lines                         | Month names spelled out by hand in `formatDateTime`; date column `nowrap` and wider                                                           |
| 3   | Top bar (iPad) | App name was hidden below 1180 px, leaving the bar empty                                 | App name always shown; the project title truncates instead                                                                                    |
| 4   | Dashboard      | Status badge rendered twice for the responsive layout                                    | One badge, repositioned with grid placement                                                                                                   |
| 5   | Setup          | Level meta text ran under the row's icon buttons                                         | Text spans constrained to the button width and truncated                                                                                      |
| 6   | Setup (iPad)   | Page "used by" badges truncated in two columns                                           | Thumbnails stack in one column below 1180 px                                                                                                  |
| 7   | Planner        | Click-to-select failed: the stage's mousedown ran after the shape's and cleared the pick | Selection is cleared only when the click target is the stage itself                                                                           |
| 8   | Planner        | Legend overlay was tall and covered devices                                              | Compact two-column legend at 10 px                                                                                                            |
| 9   | Planner        | Flat library lists (favourites, recent) led with "3000K"                                 | Tiles lead with the product name outside product groups                                                                                       |
| 10  | Planner        | White badge text was below 4.5:1 on five default colours                                 | Four mid-tone defaults darkened; `badgeTextColor` picks ink on light fills (Downlights); domain test asserts ≥ 4.5:1 for every point category |
| 11  | Sample data    | Variant names used middle dots ("2-gang · Black")                                        | Renamed to "2-gang, Black"                                                                                                                    |
| 12  | Review totals  | Change warning squeezed into the quantity cell                                           | Warning moved under the variant name with an icon                                                                                             |
| 13  | Exports        | Category checkbox names doubled ("Cameras Cameras") because glyphs were labelled images  | `CategoryGlyph` is decorative unless given a `title`                                                                                          |
| 14  | Logo           | Tagline overflowed the SVG viewBox                                                       | Tagline moved under the brass rule; assets regenerated                                                                                        |

## Deliberate deviations from the plan

- **New project** is a screen at `/projects/new` (two steps on one screen) rather than `NewProjectDialog.tsx`, matching the route in Task 9.
- **Select** uses a styled native `<select>`: reliable with iPad touch and assistive technology. `@radix-ui/react-select` stays installed for later phases.
- **Project navigation** appears in both the rail (Setup, Plan, Review, Exports, per product spec §6.1) and as a segmented sub-nav in the top bar.
- **e2e browser:** `PLAYWRIGHT_CHROMIUM_EXECUTABLE` lets environments with a preinstalled Chromium skip `playwright install`.
- **Domain tests** run on `node:test` via `tsx --test` (as already established in Tasks 2–7), not Vitest.

## Deferred controls (visibly disabled, tooltip "Available in a later phase")

`grep -rn "disabledReason={LATER_PHASE}\|disabledReason: LATER_PHASE" apps/web/src` → 22 occurrences outside
the styleguide, all intentional:

| Where                     | Controls                                                                                             | Phase |
| ------------------------- | ---------------------------------------------------------------------------------------------------- | ----- |
| Dashboard row menu        | Save as template                                                                                     | J     |
| Setup, drawings           | Upload                                                                                               | C     |
| Setup, plan card          | Choose a drawing                                                                                     | C     |
| Setup, crop and rotation  | Reset crop, Use this drawing                                                                         | C     |
| Planner toolbar           | Draw LED strip, Draw track, Circle LED loop, Add text note, Undo, Redo                               | E, F  |
| Planner inspector         | Bring to front, Bring forward, Send backward, Send to back, Duplicate, Delete (one shared component) | E     |
| Planner multi-select      | Delete n items                                                                                       | E     |
| Exports                   | Generate (×3, one shared component), Generate all exports                                            | I     |
| Catalogue, variant editor | Upload image                                                                                         | D     |
| Admin, branding           | Replace logo                                                                                         | D     |

Inspector fields (variant, label, rotation, metres, head count, note text and styling) show real values in
disabled controls with an "Editing: available in a later phase" title; library tiles carry the same reason
for drag-to-place. Everything else on every screen works against the sample store.

## Verification

`pnpm check` (typecheck, lint with zero warnings, domain + web + server unit tests) and `pnpm e2e`
(44 tests across both projects) pass.
