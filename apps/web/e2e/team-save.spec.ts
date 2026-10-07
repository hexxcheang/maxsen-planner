import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type BrowserContext } from '@playwright/test';
import { signIn } from './helpers';

// A real API server with its own empty folder, reached only by this test's team calls.
const PORT = 3999;
let server: ChildProcess;

test.beforeAll(async () => {
  server = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
    cwd: path.resolve(import.meta.dirname, '../../server'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: mkdtempSync(path.join(tmpdir(), 'team-')),
      PLANNER_PASSCODE: '',
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/api/health`)).ok) return;
    } catch {
      // Still starting.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('The API server did not start');
});

test.afterAll(() => {
  server?.kill();
});

/** A device: its own browser storage, with team calls sent to the test server. */
async function device(context: BrowserContext) {
  await context.route('**/api/shared/**', async (route) => {
    const url = new URL(route.request().url());
    url.host = `127.0.0.1:${PORT}`;
    const response = await route.fetch({ url: url.toString() });
    await route.fulfill({ response });
  });
  const page = await context.newPage();
  await signIn(page);
  return page;
}

test('a project saved on one device opens, with its drawing, on another', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One device size is enough');
  test.setTimeout(90_000);
  const a = await device(await browser.newContext());
  const b = await device(await browser.newContext());

  // Device A: asked its name once, as everything it does is saved for the team.
  await a.goto('/projects/new');
  const nameA = a.getByRole('dialog', { name: 'Your name' });
  await nameA.getByLabel('Name').fill('Jo');
  await nameA.getByRole('button', { name: 'Continue' }).click();
  await expect(nameA).toBeHidden();
  await a.getByRole('radio', { name: /Start from blank/ }).click();
  await a.getByRole('button', { name: 'Continue' }).click();
  await a.getByLabel('Project title').fill('Team save test');
  await a.getByRole('button', { name: 'Create project' }).click();
  await expect(a.getByRole('heading', { name: 'Setup' })).toBeVisible();
  const png = await a.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 600;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 800, 600);
    ctx.strokeRect(50, 50, 700, 500);
    return c.toDataURL('image/png').split(',')[1]!;
  });
  await a.getByLabel('Upload drawings').setInputFiles({
    name: 'team-plan.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(a.getByText('team-plan.png').first()).toBeVisible();
  const projectUrl = new URL(a.url()).pathname.replace(/\/setup$/, '');
  // Saved by itself after a pause; "Save now" doesn't wait.
  await a.getByRole('button', { name: 'Save now' }).click();
  await expect(a.getByRole('status').filter({ hasText: 'Saved for team' })).toBeVisible();

  // Device B: the same sample catalogue as the team's, so nothing to choose; A's project is
  // listed, not on this device yet.
  await b.goto('/');
  const team = b.getByRole('region', { name: 'Saved by the team' });
  await expect(team.getByText('Team save test')).toBeVisible();
  await expect(team.getByText(/Saved by Jo/)).toBeVisible();
  await expect(b.getByRole('dialog')).toHaveCount(0);
  await b.screenshot({ path: 'test-results/screens/team-projects.png' });
  await team.getByRole('button', { name: 'Open' }).click();
  await expect(b).toHaveURL(new RegExp(`${projectUrl}/plan`));
  await b.goto(`${projectUrl}/setup`);
  await expect(b.getByText('team-plan.png').first()).toBeVisible();
  // The drawing itself came across, not just its name.
  const loaded = b.locator('img[src^="blob:"]').first();
  await expect(loaded).toBeVisible();
  expect(await loaded.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  // Just looking around doesn't count as a change.
  for (const tab of ['review', 'exports', 'plan']) {
    await b.goto(`${projectUrl}/${tab}`);
    await b.waitForTimeout(800);
    await expect(b.getByRole('status').filter({ hasText: 'Saved for team' })).toBeVisible();
  }
  await b.screenshot({ path: 'test-results/screens/team-saved.png' });
  await b.goto(`${projectUrl}/setup`);

  // B renames it (asked its name on its first save); A, with nothing changed since, picks it up.
  await b.getByRole('button', { name: 'Team save test' }).click();
  const details = b.getByRole('dialog');
  await details.getByLabel('Project title').fill('Team save test, rev B');
  await details.getByRole('button', { name: /Save/ }).click();
  await b.getByRole('button', { name: 'Save now' }).click();
  const nameB = b.getByRole('dialog', { name: 'Your name' });
  await nameB.getByLabel('Name').fill('Sam');
  await nameB.getByRole('button', { name: 'Continue' }).click();
  await expect(b.getByRole('status').filter({ hasText: 'Saved for team' })).toBeVisible();

  await a.goto(`${projectUrl}/setup`);
  await expect(a.getByRole('button', { name: 'Team save test, rev B' })).toBeVisible();

  // Deleted on B: it goes from A too.
  await b.goto('/');
  const row = b.getByRole('list', { name: 'Projects' }).getByRole('listitem').filter({
    hasText: 'Team save test, rev B',
  });
  await row
    .getByRole('button', { name: /More actions|Project actions/ })
    .first()
    .click();
  await b.getByRole('menuitem', { name: /Delete/ }).click();
  await expect(b.getByRole('alertdialog')).toContainText('goes for everyone');
  await b.getByRole('button', { name: 'Delete project' }).click();
  await expect
    .poll(
      async () =>
        (
          (await fetch(`http://127.0.0.1:${PORT}/api/shared/projects`).then((r) => r.json())) as {
            projects: unknown[];
          }
        ).projects.length,
    )
    .toBe(0);
  await a.goto('/');
  await expect(
    a.getByRole('list', { name: 'Projects' }).getByText('Team save test, rev B'),
  ).toHaveCount(0);
});

test('the catalogue, prices and settings are shared too', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One device size is enough');
  test.setTimeout(90_000);
  const a = await device(await browser.newContext());
  const b = await device(await browser.newContext());
  for (const page of [a, b])
    await page.addInitScript(() => window.sessionStorage.setItem('maxsen.admin', '1'));

  // A changes the deposit in Admin › Pricing; it's asked its name when that's first saved.
  await a.goto('/admin');
  await a.getByRole('tab', { name: 'Pricing' }).click();
  const formA = a.getByRole('form', { name: 'Pricing' });
  await formA.getByLabel('Deposit requested (%)').fill('45');
  await formA.getByRole('button', { name: 'Save pricing' }).click();
  const nameA = a.getByRole('dialog', { name: 'Your name' });
  await nameA.getByLabel('Name').fill('Jo', { timeout: 30_000 });
  await nameA.getByRole('button', { name: 'Continue' }).click();
  await expect
    .poll(
      async () => {
        const r = await fetch(`http://127.0.0.1:${PORT}/api/shared/workspace`);
        if (!r.ok) return null;
        const body = (await r.json()) as {
          workspace: { settings: { pricing?: { depositPercent?: number } } };
        };
        return body.workspace.settings.pricing?.depositPercent ?? null;
      },
      { timeout: 30_000 },
    )
    .toBe(45);

  // B differs from the team's now, so it's asked once which to use.
  await b.goto('/admin');
  const choose = b.getByRole('dialog', { name: 'The team’s catalogue and settings' });
  await choose.getByRole('button', { name: 'Use the team’s' }).click();
  await expect(choose).toBeHidden();
  await b.getByRole('tab', { name: 'Pricing' }).click();
  await expect(
    b.getByRole('form', { name: 'Pricing' }).getByLabel('Deposit requested (%)'),
  ).toHaveValue('45');
});
