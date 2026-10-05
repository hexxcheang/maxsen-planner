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

## Good to know

- Each device keeps its own projects (saved in that browser), as on the Mac. Sharing projects
  between devices and workers needs the shared database planned next.
- Optional: your own address, e.g. `planner.maxsen.sg` (Render › Settings › Custom Domains).
- Change the passcode in Render › Environment; everyone signs in again.
