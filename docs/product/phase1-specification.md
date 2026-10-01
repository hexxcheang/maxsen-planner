**MAXSEN**

**SMART HOME PLANNER**

Phase 1 Product Requirements Specification

*Internal planning, device-counting and export system*

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Document purpose</strong></p>
<p>This specification consolidates the confirmed Phase 1 requirements
for the Maxsen Smart Home Planner. It is intended to guide
implementation in Claude. AI floor-plan interpretation and automatic
device placement are intentionally excluded from this phase.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

Version 1.0 \| 1 October 2026

# 1. Product Overview

The Maxsen Smart Home Planner is a private internal web application for
preparing smart-home and lighting layouts from uploaded floor plans.
Users upload PDF or image drawings, organise them by level, place
editable device markers and lighting paths, review automatically
calculated quantities, and generate a marked-up floor-plan PDF, a
consolidated Excel quantity file, and a customer-facing product
description PDF.

The Phase 1 application is deliberately manual-first. The floor plan
remains a locked background while all planning items are editable
overlays. This creates a reliable foundation for a later AI-assisted
version without making Phase 1 dependent on floor-plan recognition
accuracy.

## 1.1 Phase 1 goals

**•** Make smart-home and lighting planning faster and more consistent.

**•** Allow multiple levels and separate Smart Home and Lighting plans
for each level.

**•** Keep the original floor plan non-editable while allowing freeform
overlay planning.

**•** Automatically calculate consolidated product quantities from the
planned layout.

**•** Support Maxsen-specific LED-strip, track-light and driver counting
logic.

**•** Generate professional internal and customer-facing exports.

**•** Keep the system simple enough for a small internal team using one
shared access passcode.

## 1.2 Explicit Phase 1 exclusions

**•** No AI floor-plan reading, room detection, wall detection or
automatic device placement.

**•** No automated lighting design or electrical engineering
calculations.

**•** No pricing, unit prices, installation prices, quotation totals or
payment collection.

**•** No stock/inventory management, CRM automation or accounting
integration.

**•** No customer portal or customer login.

**•** No individual staff user accounts or per-user permissions.

**•** No project versioning such as Option A / Option B.

**•** No custom shapes such as arrows, circles or rectangles, except
supported lighting path geometry and text-note highlights.

# 2. End-to-End User Workflow

**1.** Enter the application using the shared internal passcode.

**2.** Create a new project from blank or from an approved reusable
template.

**3.** Enter the required project title and optional customer details.

**4.** Upload one or more source files: multi-page PDFs and/or JPG, JPEG
or PNG images.

**5.** Review uploaded pages/images as thumbnails, select usable
drawings, rotate/crop them, organise levels and assign plan types.

**6.** For each level, create up to two independent plans: Smart Home
Plan and Lighting Plan.

**7.** Open the planner and drag product variants from the device
library onto the active plan.

**8.** Move, rotate, relabel or edit placed devices; draw LED-strip and
track-light paths; add optional text notes.

**9.** Use live counts while planning and review the consolidated
quantity list before export.

**10.** Optionally adjust final export quantities and review any
warnings caused by plan changes.

**11.** Generate the marked-up floor-plan PDF, Excel quantity file and
customer-facing product description PDF.

# 3. Access and Security Model

| **Access level**         | **Purpose**               | **Capabilities**                                                                  |
|--------------------------|---------------------------|-----------------------------------------------------------------------------------|
| Shared internal passcode | Normal application access | Open projects, create/edit plans, use catalogue, generate exports, use templates. |
| Admin-only passcode      | Protected configuration   | Edit catalogue, templates, branding, icon sizes/colours and protected settings.   |

**•** There are no individual staff accounts in Phase 1.

**•** Anyone with the shared internal passcode can use the planning
workflow.

**•** Admin-protected screens/actions require the separate admin
passcode.

# 4. Project Dashboard and Project Data

## 4.1 Project dashboard

**•** Show all active projects in a clean dashboard.

**•** Display project title, project status, last updated date/time, and
a thumbnail preview of the first floor plan.

**•** Allow search by project title, customer name or property address.

**•** Clicking the project title or thumbnail opens directly into the
planning workspace.

**•** When reopened, the project returns to the most recently edited
level and plan type.

**•** Project status values: Draft (default), In Progress, Completed.

**•** Do not provide a project-status filter in Phase 1.

**•** Do not show product/device counts on the dashboard.

**•** Allow permanent project deletion with a confirmation step.

**•** No archived-project workflow is required.

## 4.2 Project details

| **Field**               | **Requirement**                                                             |
|-------------------------|-----------------------------------------------------------------------------|
| Project title           | Required. Used automatically in both PDF cover pages and export filenames.  |
| Customer name           | Optional. Can be shown/hidden in each PDF export.                           |
| Customer contact number | Optional. Can be shown/hidden in PDFs; included in the Excel quantity file. |
| Property address        | Optional. Can be shown/hidden in each PDF export.                           |
| Property type           | Optional: HDB, Condo, Landed, Commercial, Other.                            |
| Project status          | Draft, In Progress, Completed.                                              |

**•** Project details can be edited later from the planning workspace.

# 5. Floor-Plan Upload and Setup

## 5.1 Supported uploads

**•** Support PDF uploads, including multi-page PDFs.

**•** Support JPG, JPEG and PNG image uploads.

**•** Allow multiple uploaded source files in one project.

**•** Show PDF pages and uploaded images together as selectable
thumbnails during setup.

## 5.2 Level setup

**•** A project may contain multiple levels.

**•** Users can add levels, rename levels and reorder levels.

**•** Level names are defined during initial setup and reused
automatically in the planner and exports.

**•** An entire level cannot be deleted in Phase 1.

**•** Each level stores its own export paper size and orientation even
if one plan type is later deleted and re-added.

**•** Paper size options: A4 or A3.

**•** Orientation options: Portrait or Landscape.

## 5.3 Plan types per level

| **Plan type**   | **Purpose**                                                                                                                              | **Background**                  |
|-----------------|------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------|
| Smart Home Plan | Switches, panels, curtains/blinds, aircon controls, gateways, sensors, cameras, network devices, smart locks and smart-home accessories. | One uploaded PDF page or image. |
| Lighting Plan   | Downlights, surface lights, track lights, LED strips, magnetic track lights, pendants, spotlights and lighting accessories.              | One uploaded PDF page or image. |

**•** The Smart Home Plan and Lighting Plan for the same level may use
different uploaded pages/images.

**•** Either plan type may initially be left blank and added later.

**•** Each plan supports one background only; no background overlays or
multi-drawing composites.

**•** Once a background is assigned to a plan, it is not directly
replaceable.

**•** A plan may be deleted with confirmation; deleting it removes its
background, markers, paths and notes.

**•** A deleted or missing plan may later be re-added to the existing
level with a new background.

## 5.4 Background preparation

**•** Before planning, allow rotation by 90°, 180° or 270°.

**•** Allow cropping to remove borders, title blocks, unused content or
other distractions.

**•** Show a crop preview and allow the crop to be reset/re-done during
setup.

**•** No brightness, contrast or opacity controls are needed.

**•** After setup, the selected background is locked: it cannot be
edited, moved or deleted inside the planner.

# 6. Planning Workspace

## 6.1 Main layout

**•** Provide a large central floor-plan canvas.

**•** Provide a left-side device library with search, Favourites and
Recently Used sections.

**•** Provide contextual editing controls for a selected
marker/path/note.

**•** Provide navigation to Project Dashboard, Current Project /
Planner, Exports, Product Catalogue, Templates, Admin Settings and Help.

**•** Provide zoom, pan and reset-zoom controls.

**•** Placement is completely freeform; no snap-to-grid or snap-to-wall
behaviour.

**•** Autosave all project edits continuously.

**•** Provide Undo and Redo.

## 6.2 Device placement

**•** Device library flow: Category → Product → Variant → drag onto
plan.

**•** Placement is drag-and-drop from the library onto the plan.

**•** Placed items remain draggable for repositioning.

**•** Point devices use simple fixed category icons rather than product
photographs.

**•** Each placed item stores its selected product and variant behind
the icon.

**•** Selecting a placed device allows its product/variant to be changed
later without deleting the marker.

**•** If changed to a different category, the icon and category
colour/badge update automatically.

**•** Each placed device represents one unit for counting purposes,
except specialised lighting-path logic described later.

**•** Placed items do not have manual quantity, price,
installation-price, note or device-status fields.

## 6.3 Labels and notes

**•** Each placed device may have an optional short editable label;
labels are not compulsory.

**•** Labels can be shown or hidden in the marked-up floor-plan export.

**•** Custom text notes can be placed directly on the floor plan
independently of device labels.

**•** Text notes are movable, editable and deletable.

**•** Text-note formatting: font size, bold, text colour and background
highlight.

**•** Text notes are included in marked-up PDF export by default, with
an option to hide them.

## 6.4 Selection and editing behaviour

**•** Support Shift + click multi-selection.

**•** Support drag/marquee selection box to select multiple markers or
paths.

**•** Multi-selected items can be moved together or deleted together.

**•** Group duplication is not required.

**•** Single items can be duplicated or deleted directly.

**•** Individual device icons can be rotated.

**•** Basic layer ordering is required: Bring to Front, Send to Back,
Bring Forward, Send Backward.

**•** No individual item-locking feature is required.

**•** No delete confirmation for individual markers, line paths or text
notes.

## 6.5 Category visibility and legend

**•** Allow device categories to be shown/hidden while editing without
affecting counts.

**•** Allow categories to be included/excluded from the marked-up
floor-plan PDF without affecting saved data or totals.

**•** Show/hide the legend while editing.

**•** Each exported plan page can include a legend showing only
categories actually present on that page.

**•** The legend can be included or hidden during export.

# 7. Device Icon System

**•** Use a simple fixed icon shape per device category.

**•** Use category-based colours or badges to distinguish device types
quickly.

**•** Admin can change the global icon colour/badge style for each
category.

**•** Admin can change the global icon size for each point-device
category.

**•** Changing a category icon size updates all icons of that category
globally across plans.

**•** Users cannot resize point-device icons individually.

**•** Icon shapes themselves are fixed and cannot be replaced/uploaded
in Phase 1.

**•** Category order in the device library and legend is fixed in Phase
1.

# 8. Device Library and Product Catalogue

## 8.1 Smart Home Plan categories

**•** Smart Switches

**•** Control Panels

**•** Curtains / Blinds

**•** Aircon Controllers

**•** Gateways

**•** Sensors

**•** Cameras

**•** Network Devices

**•** Smart Locks

**•** Miscellaneous Smart Home Accessories

## 8.2 Lighting Plan categories

**•** Downlights

**•** Surface Lights

**•** Track Lights

**•** LED Strips

**•** Magnetic Track Lights

**•** Pendant Lights

**•** Spotlights

**•** Miscellaneous Lighting Accessories

LED Drivers are not manually placeable products in the Lighting Plan
device library.

## 8.3 Product catalogue behaviour

**•** Admin-only catalogue management.

**•** Products can be added, edited, hidden or unhidden.

**•** Each product can contain multiple selectable variants.

**•** Each variant can have its own name, image and standard
customer-facing description.

**•** Products/variants can be hidden from the planning library without
being deleted.

**•** Hidden items do not appear in search, Favourites or the normal
device library.

**•** Existing projects continue to display/export previously used
products even if those products are later hidden.

**•** Admin may edit catalogue names, images, descriptions and variant
details later.

**•** Existing saved projects preserve the original selected
product/variant snapshot unless that placed item is manually changed.

**•** No price or quotation fields are required in the catalogue for
Phase 1.

## 8.4 Product discovery

**•** Search bar in the device library for product and variant names.

**•** Shared Favourites / Frequently Used section.

**•** Favourites are managed under the admin-only passcode.

**•** Recently Used section is separate from Favourites.

**•** Recently Used is remembered only for the current project/session,
not globally across all projects.

# 9. Special Lighting Drawing and Counting Logic

## 9.1 LED strips

**•** LED strips are drawn as editable path elements rather than point
icons.

**•** Supported geometry: straight runs, 90-degree L-shaped/multi-point
paths, and circular/curved loop layouts.

**•** One continuous LED-strip path is treated as one LED-strip run.

**•** For each LED-strip run, the user manually enters the total length
in metres.

**•** The app does not calculate LED-strip length from the floor-plan
scale.

**•** The entered metre value may be displayed directly on the plan,
e.g. “3.5m LED Strip”.

**•** LED-strip length labels can be shown or hidden in the marked-up
PDF.

**•** Lengths from all runs using the same selected LED-strip variant
are summed automatically across the project.

**•** Each continuous LED-strip run automatically adds one Smart LED
Driver to live totals and the Excel quantity file.

**•** Auto-added Smart LED Drivers are not drawn on the plan and do not
appear in the customer-facing product description PDF.

## 9.2 Track lights

**•** Track lighting is drawn as an editable path element.

**•** Supported geometry: straight runs and 90-degree
L-shaped/multi-point paths.

**•** One continuous path is treated as one track.

**•** Each track has an editable number of light heads/modules.

**•** The selected number of heads/modules is shown visually distributed
along the track path.

**•** Track labels such as “3-head Track” can be shown or hidden in the
marked-up PDF.

**•** Track-light paths can later be changed to another compatible track
variant without redrawing the path.

**•** Changing the variant preserves the path and head count.

**•** Each continuous track automatically adds one Track Driver to live
totals and the Excel quantity file.

**•** Auto-added Track Drivers are not drawn on the plan and do not
appear in the customer-facing product description PDF.

## 9.3 Fixed accessory rules

| **Trigger**           | **Automatic item** | **Count rule**         | **Where shown**          |
|-----------------------|--------------------|------------------------|--------------------------|
| Each LED-strip run    | Smart LED Driver   | 1 per continuous run   | Live totals + Excel only |
| Each track-light path | Track Driver       | 1 per continuous track | Live totals + Excel only |

**•** These automatic accessory rules are fixed in Phase 1 and are not
admin-configurable.

**•** In live totals, automatic items are labelled “auto-added”.

**•** In the Excel quantity file, automatic items are listed normally
without an “auto-added” label.

# 10. Quantity Calculation and Review

## 10.1 Automatic counting

**•** All normal point-device markers are automatically counted by
selected product/variant.

**•** Smart switches are quoted/countable by number of switch units, not
by gang count.

**•** Gang count may exist as a planning variant detail but must not
create separate quantity logic unless the selected catalogue variant
itself is different.

**•** Identical product variants placed multiple times or on multiple
levels are consolidated into one project-wide total.

**•** Quantities are not grouped by room or zone.

**•** Live category totals are shown while planning, without prices.

**•** Automatic driver items are included in the live totals.

## 10.2 Review Totals screen

**•** Provide a Review Totals screen before export.

**•** Show the full consolidated project quantity list.

**•** Allow users to manually adjust final export quantities.

**•** Manual adjustments are saved inside the project until changed
again.

**•** Show both calculated quantity and adjusted quantity when an item
has been modified.

**•** No separate “Reset to Calculated Quantity” button is required.

**•** If plan changes alter the calculated quantity after a manual
adjustment was saved, show a warning that the saved adjustment may need
review.

**•** Warnings do not block export.

**•** Manual adjustments affect quantity-based exports; they do not
change the actual floor-plan markers or drawn geometry.

# 11. Export Centre

**•** Provide a dedicated Exports section.

**•** Provide individual generation buttons for each export.

**•** Provide a single “Generate All Exports” button.

**•** Exports are regenerated fresh each time; generated files do not
need to remain stored inside the project.

**•** After generation, show a clear success message and Download
button.

**•** No direct print function is needed.

**•** Export filenames use the project title and automatically
remove/replace unsafe filename characters.

| **Export**               | **Filename pattern**                        |
|--------------------------|---------------------------------------------|
| Marked-up floor-plan PDF | \[Project Title\] - Marked Floor Plan.pdf   |
| Product description PDF  | \[Project Title\] - Product Description.pdf |
| Quantity Excel           | \[Project Title\] - Quantity List.xlsx      |

# 12. Marked-Up Floor-Plan PDF

**•** Generate one combined multi-page PDF for the entire project.

**•** Start with a Maxsen-branded cover page.

**•** Cover page uses the project title by default.

**•** Customer name, customer contact number and property address can
each be independently shown or hidden for the export.

**•** Do not show export date.

**•** User can choose which levels to include.

**•** For each selected level, user can include Smart Home Plan,
Lighting Plan, or both.

**•** Each plan page clearly shows the saved level name and plan type.

**•** Use the level’s saved A4/A3 paper size and Portrait/Landscape
orientation.

**•** Use a white background with black text.

**•** Include a small Maxsen logo and contact line on every plan page.

**•** Use category visibility choices for export.

**•** Show/hide device labels, LED-strip length labels, track-head
labels, custom text notes and legend independently as supported by the
export controls.

**•** Each page legend contains only the categories visible on that
page.

# 13. Excel Quantity File

The Excel output is a clean operational quantity file, not a priced
quotation. It contains one consolidated worksheet and one project-wide
quantity list.

**•** Single workbook, single quantity sheet.

**•** Do not split Smart Home and Lighting into separate sheets.

**•** Use two visual sections within the same sheet if useful: Smart
Home Products and Lighting Products.

**•** Each product/variant appears once with the overall combined
project quantity.

**•** Do not provide level-by-level or room-by-room breakdowns.

**•** Include the customer contact number.

**•** Do not include project title, customer name, property address or
date.

**•** No product images or customer-facing descriptions.

**•** Use columns: Category, Product, Variant, Quantity.

**•** Sort by fixed category order, then product name, then variant
name.

**•** LED-strip quantity is shown as combined metres using built-in
display logic.

**•** Normal devices, track heads/modules and drivers are shown as
whole-number quantities.

**•** Auto-added Smart LED Drivers and Track Drivers are included and
listed normally.

# 14. Customer-Facing Product Description PDF

**•** Generate one combined customer-facing PDF, not separate Smart Home
and Lighting PDFs.

**•** Start with a Maxsen-branded cover page.

**•** Project title is shown by default.

**•** Customer name, customer contact number and property address can
each be independently shown or hidden.

**•** Do not show export date.

**•** Use two main sections: Smart Home Products, then Lighting
Products.

**•** Within each section, follow the same fixed category order as the
Excel file.

**•** Allow the user to choose which product categories are included for
a specific product-description export.

**•** Excluding a category from this PDF does not remove it from the
plan, live totals or Excel quantity file.

**•** Each selected product variant appears only once, with its combined
project-wide quantity.

**•** Each variant uses its catalogue image and standard customer-facing
description.

**•** Show quantity for each variant.

**•** Do not show prices.

**•** Do not show auto-added Smart LED Drivers or Track Drivers.

**•** End with a Maxsen contact page using admin-managed logo, showroom
details, WhatsApp number, website and contact-page wording.

# 15. Admin Settings and Branding

**•** Admin settings are protected by the separate admin-only passcode.

**•** Upload the Maxsen logo once and reuse it automatically in exports.

**•** Maintain default Maxsen WhatsApp number, website, showroom
addresses and contact-page wording.

**•** Maintain global point-icon sizes by category.

**•** Maintain category icon colours or badge styles.

**•** Manage shared Favourites.

**•** Manage reusable templates.

**•** Manage the product catalogue.

**•** Icon shapes remain fixed.

**•** Category order remains fixed.

**•** No separate admin backup/export function is required.

# 16. Reusable Project Templates

**•** New Project offers two choices: Start from Blank or Start from
Saved Template.

**•** Only admin can create, edit or delete templates.

**•** Any normal planner user can start a project from an approved
template.

**•** A template can preserve the full layout structure: levels and
names, Smart Home/Lighting plan structure, placed icons, line paths,
LED-strip metre values, track-light head counts, selected variants and
export settings.

**•** Starting from a template creates a copy that can be edited
independently.

**•** For a new project created from a template, the user should be able
to assign the new project’s plan backgrounds during setup before normal
planning continues.

**•** After a background is assigned to the new project plan, the
standard background immutability rule applies.

**•** Do not support copying an entire active plan from one level to
another outside the template workflow.

# 17. Help / Instructions

**•** Provide a simple fixed Help / Instructions page.

**•** Explain the workflow: upload → select pages/images → crop/rotate →
name levels → assign Smart Home and Lighting plans → place devices →
review totals → export.

**•** Help content does not need an admin editor in Phase 1.

**•** No planning disclaimer is required in Phase 1.

# 18. Saving and Data Persistence

**•** Autosave project changes while the user works.

**•** Save level structure, plan assignments, crops/rotations, paper
size/orientation, placed markers, selected variants, labels, line paths,
text notes, visibility/export settings, manual quantity adjustments and
last edited location.

**•** Reopening a project returns to the most recently edited level and
plan type.

**•** Existing projects retain their historical selected product
snapshots even when the live catalogue changes.

# 19. Conceptual Data Model

Claude may refine the actual database implementation, but the following
logical entities should remain distinct so that editing, counting and
exports stay reliable.

| **Entity**        | **Key information**                                                                                                         |
|-------------------|-----------------------------------------------------------------------------------------------------------------------------|
| Project           | Title, optional customer details, property type, status, last-updated, last-opened level/plan, manual quantity adjustments. |
| Level             | Level name, display order, A4/A3 paper size, Portrait/Landscape orientation.                                                |
| Plan              | Level ID, plan type (Smart Home / Lighting), assigned background, crop/rotation data, plan-specific markers/paths/notes.    |
| Catalogue Product | Category, product name, active/hidden state.                                                                                |
| Product Variant   | Variant name, image, customer description, hidden state, snapshot fields for project use.                                   |
| Point Marker      | Plan ID, product/variant, normalized x/y position, rotation, optional label, layer order.                                   |
| LED Strip Path    | Plan ID, variant, path points/geometry, total entered metres, optional label visibility, layer order.                       |
| Track Path        | Plan ID, variant, path points/geometry, head/module count, label visibility, layer order.                                   |
| Text Note         | Plan ID, position, text, font size, bold, text colour, background highlight, layer order.                                   |
| Template          | Reusable project/level/plan/layout structure and settings.                                                                  |
| Admin Settings    | Branding, contacts, logo, icon sizes, icon colours/badges, favourites.                                                      |

# 20. Recommended Claude Development Roadmap

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th><p><strong>Implementation principle</strong></p>
<p>This is a recommended build order, not a restriction on Claude’s
technical reasoning. Claude may refine implementation details, but
should avoid skipping ahead into complex editor or export logic before
the underlying data model is stable.</p></th>
</tr>
</thead>
<tbody>
</tbody>
</table>

**Phase A — Static UX and design system** — Build the app shell,
navigation, project dashboard, planner layout, export screen, catalogue
screen, template screen, admin settings and Help page using realistic
sample data.

**Phase B — Data model and persistence** — Define projects, levels,
plans, backgrounds, catalogue products/variants, markers, paths, notes,
templates, settings and saved quantity adjustments. Implement
shared-passcode and admin-passcode access.

**Phase C — Project creation and floor-plan setup** — Implement upload
of PDFs/images, thumbnail selection, crop, rotation, level
naming/reordering, two-plan assignment, plan deletion/re-addition, paper
size and orientation.

**Phase D — Product catalogue and admin settings** — Implement catalogue
CRUD/hide-unhide, variant images/descriptions, favourites,
branding/contact settings and global icon style settings.

**Phase E — Point-device planner** — Implement locked background canvas,
drag/drop, freeform repositioning, rotation, labels, multi-select,
marquee selection, layer order, category visibility, legend, undo/redo
and autosave.

**Phase F — Lighting-path planner** — Implement LED-strip paths
including 90-degree and circular/curved loops; implement track paths,
head distribution, metre/head labels and variant swapping while
preserving geometry.

**Phase G — Quantity engine** — Implement project-wide consolidation,
LED-strip metres, track heads, fixed auto-driver rules, live counts and
grouping by product/variant.

**Phase H — Review Totals** — Implement saved manual adjustments,
calculated-vs-adjusted display, change warnings and non-blocking export
warnings.

**Phase I — Exports** — Implement combined marked-up PDF, clean Excel
quantity file, customer-facing product-description PDF, filename
sanitisation and Generate All Exports.

**Phase J — Templates** — Implement admin-managed reusable templates and
Start from Blank / Start from Template project creation.

**Phase K — QA and polish** — Test with realistic single-level and
multi-level projects, validate autosave, export accuracy, product
snapshots, visibility rules and responsive desktop/iPad use.

# 21. Key Acceptance Scenarios

| **Scenario**        | **Expected result**                                                                                                                                                                                                                          |
|---------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Multi-level setup   | Upload one multi-page PDF plus PNG files; create Level 1, Level 2 and Attic; assign separate Smart Home and Lighting backgrounds; set A3 Landscape for one level and A4 Portrait for another.                                                |
| Smart-home planning | Drag 12 switch markers, 2 control panels and 3 curtain markers across multiple levels; change one marker’s variant; totals consolidate correctly by variant.                                                                                 |
| LED-strip planning  | Draw several strip runs including an L-shape and circular run; manually enter metres; totals sum metres by variant; one Smart LED Driver is added per run.                                                                                   |
| Track planning      | Draw straight and L-shaped tracks; set different head counts; heads display along each path; one Track Driver is added per continuous path.                                                                                                  |
| Multi-select        | Shift-select and marquee-select multiple markers; move/delete them together without corrupting counts.                                                                                                                                       |
| Review adjustments  | Manually adjust a quantity, save project, change the plan later and receive a non-blocking warning that the calculated quantity changed.                                                                                                     |
| Catalogue history   | Hide or rename a catalogue variant after it was used; existing project still retains its original selected variant snapshot.                                                                                                                 |
| Exports             | Generate all exports; filenames use the project title; floor-plan PDF honours selected levels/plan types; Excel contains consolidated quantities and customer contact number; product PDF contains selected categories and excludes drivers. |
| Template            | Save an approved project as a template; start a new project from it; preserve layouts/settings and assign new floor-plan backgrounds during new-project setup.                                                                               |

# 22. Implementation Details Intentionally Left to Claude

The product behaviour above is fixed. The following technical choices
may be selected or refined by Claude based on maintainability and
implementation quality:

**•** Frontend framework and component structure.

**•** Canvas/rendering library used for point markers and editable
paths.

**•** Database/storage provider and exact schema/normalisation.

**•** PDF rendering/generation library.

**•** Excel generation library.

**•** Exact UI component library, spacing system and responsive
breakpoints.

**•** Autosave debounce timing and technical conflict-handling strategy.

**•** How thumbnail rendering and PDF-page rasterisation are
implemented.

# 23. Claude Prompt Generation Note

Separate module-by-module Claude prompts are intentionally not included
in this document. When prompts are required, use the phrase “AI PROMPT
PLEASE” in ChatGPT to request Claude-ready prompts based on this
specification.

# 24. Final Phase 1 Scope Snapshot

| **Area**       | **Included**                                                                                         |
|----------------|------------------------------------------------------------------------------------------------------|
| Access         | Shared internal passcode + separate admin-only passcode                                              |
| Projects       | Dashboard, project title, optional customer details, status, last updated, thumbnail                 |
| Levels         | Multiple levels; add/rename/reorder; no level deletion                                               |
| Plans          | Smart Home + Lighting plan per level; independent backgrounds; plan deletion/re-addition             |
| Uploads        | PDF, JPG, JPEG, PNG                                                                                  |
| Setup          | Thumbnail selection, crop, rotate, level naming, plan assignment, A4/A3 + orientation                |
| Planner        | Locked background, drag/drop, move, rotate, labels, notes, multi-select, layers, undo/redo, autosave |
| Lighting paths | LED-strip straight/L/circle/curved; track straight/L; manual metres/head counts                      |
| Counting       | Automatic consolidation + fixed auto-driver rules + live category totals                             |
| Review         | Saved manual quantity adjustments + warnings after plan changes                                      |
| Excel          | One clean consolidated sheet with Category/Product/Variant/Quantity + customer contact number        |
| Floor-plan PDF | One combined project PDF with cover, selected plan pages, legends and Maxsen branding                |
| Product PDF    | One combined PDF, Smart Home + Lighting sections, product images/descriptions/quantities             |
| Templates      | Admin-managed reusable full-layout templates                                                         |
| Admin          | Catalogue, favourites, branding/contact, icon sizes and colours/badges                               |
| Help           | Fixed workflow instructions                                                                          |
| AI             | Not included in Phase 1                                                                              |
| Pricing        | Not included in Phase 1                                                                              |

**END OF SPECIFICATION**
