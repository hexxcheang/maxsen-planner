# Putting the planner online (Render)

The whole app (its pages and the Claude/Gemini features) runs as one service on Render, in
Singapore. Tablets, phones and computers then open it at a web address, with no Mac running.
`render.yaml` in this repository describes the service, so Render sets it up for you.

## Set it up (once)

1. Go to https://render.com and sign up with **GitHub** (the same account that has
   `hexxcheang/maxsen-planner`). Allow Render to see the `maxsen-planner` repository.
2. In Render: **New** › **Blueprint**, pick `maxsen-planner`, and press **Apply**.
3. It asks for:
   - `PLANNER_PASSCODE`: the passcode your team signs in with (choose your own; it replaces
     "maxsen" online).
   - `ANTHROPIC_API_KEY` and `GEMINI_API_KEY`: optional; paste the same keys as in your `.env`
     to have "Suggest rooms" and product sample pictures online. Leave blank to skip.
4. Add a card when asked: the Starter plan is about US$7 a month and always on. (The free plan
   also works but sleeps after 15 minutes idle; the first open after that takes about a minute.)
5. Wait for the first deploy (about 5 minutes) until it says **Live**. Your address is shown at
   the top, like `https://maxsen-planner.onrender.com`.

Every push to `main` then updates the online app automatically.

## On the tablet

1. Open the address in Chrome and sign in with your `PLANNER_PASSCODE`.
2. Chrome menu (⋮) › **Install app** (or **Add to home screen**). The Maxsen icon opens it full
   screen, and it keeps working with a weak or no connection.

## Shared with the whole team

Everyone signed in to the online app shares one set of projects, catalogue, prices, settings and
templates. There's no Save button to remember:

- **Projects save by themselves** about 15 seconds after you stop editing, and at once when you
  leave the app. The top bar of a project says **Saved for team** (or **Save now** while a save is
  waiting; tap it to save at once). Drawings upload once; later saves send only the project.
- **Projects someone else saved** are listed on **Projects** under **Saved by the team**; **Open**
  brings one to your device with its drawings. Projects you already have update by themselves when
  you haven't changed them.
- **Two people changing the same project** at once doesn't overwrite anyone: the project shows
  **"… also changed this"**, and you choose whose version to keep.
- **The catalogue, prices (Admin › Pricing), settings and templates** are shared the same way. The
  first time a device connects with a catalogue different from the team's, it asks which to use;
  normally choose **Use the team's**.
- **Deleting a shared project** deletes it for everyone. The server keeps a copy in its `trash`
  folder, so it can be recovered. With admin unlocked, each project under **Saved by the team**
  also has **Delete**, so the admin can clear any of them without opening it first.
- **Live:** projects, the timetable, leads, claims, inventory and the team update on every open
  device the moment someone changes them, with no reload.
- Each device asks once for a name, shown with each save. Sample projects stay on each device.

Cost: saving adds next to nothing on Render. The plan is a flat monthly price; a project is a few
hundred KB at most, and drawings upload only once.

### Keeping the team's work through updates (important)

Everything shared is kept on the service's **disk** at `/var/data`. Without a disk, Render starts
each update on an empty folder and **every shared project and the shared catalogue are lost**. If
the disk is missing, the app shows a yellow warning at the top of every page. To add it (once):

- Created from the Blueprint: Render adds it when it syncs `render.yaml` (check **Disks**).
- Created earlier, or by hand: Render › your service › **Disks** › **Add disk**, name
  `maxsen-data`, mount path `/var/data`, size 1 GB (about US$0.25 a month). Then **Environment** ›
  add `DATA_DIR` = `/var/data`, and save (it redeploys). A disk needs a paid instance (Starter);
  with a disk, each deploy has a few seconds of downtime.

After that, updates (every push to `main`) keep all projects, the catalogue, settings, timetable,
leads, claims, inventory and team. Each device also keeps its own copy in its browser.

**Safety net:** if the server ever comes back empty (no disk yet, or the disk was replaced), the
first device to open the Timetable, Leads or Team puts back its last copy. The server only takes a
copy while it has none, so it can never replace the team's current data. It is a fallback, not a
backup: anything changed after that device last looked can be lost, so the disk is still needed.

## Timetable

The **Timetable** tab shows sales meet-ups, site visits, deliveries, installations and integration
appointments (each in its own colour) week by week,
the same for everyone signed in; changes show on every device at once. Only the admin schedules it:
**Admin: schedule** asks for the admin passcode, which the server checks. Set your own in Render ›
Environment › `ADMIN_PASSCODE` (until then it is `admin`). Appointments that book the same person
twice at once are marked with a warning triangle. With **WhatsApp the people assigned** switched on (on the
Timetable's toolbar; only the admin can change it), saving an appointment offers a message for each person assigned (what, when, where with a
map link, who else, notes), opened in WhatsApp to send; numbers are kept on the **Team** tab. A new appointment needs only the day and time;
what it is, who's going and the rest (project, client, address, notes under **More details**) can
be added later. The Timetable's **Team** button opens the Team tab.

## Team

The **Team** tab keeps everyone's profile: name, role (Sales, Installer, Electrician, Integrator,
Delivery, Manager, Office), WhatsApp number, email, joined date and notes. Everyone signed in sees
it; only the admin (`ADMIN_PASSCODE`) adds, changes or removes people.

- **WhatsApp numbers are checked as they're typed.** A Singapore mobile (8 digits starting 8 or 9)
  gets +65 added; a number from elsewhere needs its country code (+60…). A good number shows
  **Saved as +65 9123 4567** and a **Test it** link that opens their WhatsApp chat, so you can
  check it's the right person. A warning at the top lists anyone active without a number.
- **Active** people are the ones offered and messaged on the timetable. Switch someone to inactive
  to keep their profile without assigning them.
- The names and numbers already on the timetable were carried over the first time the tab opened.
  Anyone assigned on the timetable who isn't on the team yet is added to it.

## Inventory

The **Inventory** tab keeps stock as a record of every movement, shared by everyone signed in:

- **Take out / return** (installers): say which site, pick the products and how many. A take-out
  comes off stock at once; unused items go back with **Return unused**.
- **Site checks** (inventory manager): each take-out waits here until the manager counts what was
  really taken for that site and presses **Confirm count**; stock follows the count, and any
  difference is marked.
- **Restock** and **Count correction** (inventory manager): stock arriving, and fixes after a
  physical count.
- **Stock** shows what's in stock, what's out but not checked yet, and flags items at or below
  their low-stock level (the manager sets it per product).
- **History** lists every entry; the manager can remove one recorded by mistake.

The inventory manager is whoever has the admin passcode (`ADMIN_PASSCODE`). Products come from the
shared catalogue.

## Leads

The **Leads** tab is the team's list of enquiries, kept on the server disk like the projects, so
app updates never clear it. Anyone signed in can add a lead, change its status, assign it and set a
follow-up day; overdue follow-ups come first and are counted in red. Changes show on every device
at once, without touching a lead someone has open.

- Each lead is saved on its own, so two people working on different leads never overwrite each
  other. If someone else changed the same lead while you had it open, you're told who and can load
  their version or keep yours.
- Statuses run from New, Contacted, No reply yet, Meet-up set, Met / site visit done, Quoted and
  Considering quote to On hold (reno later), Won and Lost. Moving a lead to a stage that means you
  spoke (Contacted to Considering) sets **Last contacted** to today; change it if it was another
  day. **Expected reno date** shows on the list as the month.
- Leads are split by where they came from: **MyDigitalLock** or **Maxsen leads**. The switch at the
  top shows one list or both (each device remembers its choice); a new lead starts in the list
  being shown. Leads added before the split count as Maxsen leads.
- **New lead** asks only for a name (phone and interest are optional). Status, follow-up,
  assignee and the rest are filled in on the lead as things progress, with the less used details
  under **More details**.
- **Notes** are only ever added, never replaced, so everyone's notes are kept.
- **Convert to project** starts a project from the lead's details.
- Only the admin can delete a lead; everyone else marks it **Lost**.

## Claims

The **Claims** tab is for expenses paid for work. Anyone signed in adds a claim with the date,
amount, what it was for (and optionally a category and the site) and a photo or PDF of each
receipt; photos are made smaller before they're sent. Claims and receipts are kept on the server
disk. A claim can be changed or withdrawn while it waits; the admin (`ADMIN_PASSCODE`) approves it,
or rejects it with a reason, and everyone sees where theirs stands. **Download (Excel)** saves the
claims shown, for paying them out.

## Security

- **Set your own passcodes** in Render › Environment: `PLANNER_PASSCODE` for the team and
  `ADMIN_PASSCODE` for the admin. Until `ADMIN_PASSCODE` is set, the admin passcode is `admin`
  (the server log warns about it).
- **Other websites can't use the app.** The server sends no CORS permissions, so a page on another
  site can't read anything from it; changes (saving, deleting) are refused when the browser says
  they come from another site; and the sign-in cookies only travel with the app's own requests.
- **Passcode guessing is slowed:** after 10 wrong passcodes from one place, it waits 15 minutes.
- **Security headers:** the app can't be shown inside another site's frame, and uploaded files are
  never run as web pages.

## Good to know

- Optional: your own address, e.g. `planner.maxsen.sg` (Render › Settings › Custom Domains).
- Change the passcode in Render › Environment; everyone signs in again.
