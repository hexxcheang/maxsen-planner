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
  folder, so it can be recovered.
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

After that, updates (every push to `main`) keep all projects, the catalogue and settings. Each
device also keeps its own copy in its browser.

## Timetable

The **Timetable** tab shows sales meet-ups (blue) and installation duties (brass) week by week,
the same for everyone signed in; it refreshes every minute. Only the admin schedules it:
**Admin: schedule** asks for the admin passcode, which the server checks. Set your own in Render ›
Environment › `ADMIN_PASSCODE` (until then it is `admin`). Appointments that book the same person
twice at once are marked with a warning triangle. **Team** keeps the list of names to assign.

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

## Good to know

- Optional: your own address, e.g. `planner.maxsen.sg` (Render › Settings › Custom Domains).
- Change the passcode in Render › Environment; everyone signs in again.
