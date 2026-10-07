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

## Saving projects for the team

Each device keeps its work as it's made. To share a project, press **Save for team** at the top
right of the project. Everyone else then sees it:

- A project they don't have yet is listed on **Projects** under **Saved by the team**; **Open**
  brings it to their device with its drawings.
- A project they have opens at the latest save automatically, if they haven't changed it since.
  If they have, **Newer from …** offers to load the other version instead of theirs.
- Saving over someone's newer save asks first, so work isn't lost by accident.

The first save on each device asks for a name, shown with each save. The catalogue, prices and
settings stay per device (Admin on each one).

The saved projects are kept on the service's **disk** (`/var/data`). Without one they are wiped on
every deploy, so check it is there once:

- Created from the Blueprint: Render adds it when it syncs `render.yaml` (check **Disks**).
- Created earlier, or by hand: Render › your service › **Disks** › **Add disk**, name
  `maxsen-data`, mount path `/var/data`, size 1 GB. Then **Environment** › add `DATA_DIR` =
  `/var/data`, and save (it redeploys). A disk needs a paid instance (Starter); with a disk,
  each deploy has a few seconds of downtime.

## Good to know

- Projects not saved for the team stay on the device they were made on.
- Optional: your own address, e.g. `planner.maxsen.sg` (Render › Settings › Custom Domains).
- Change the passcode in Render › Environment; everyone signs in again.
