import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type BrowserContext } from '@playwright/test';
import { signIn } from './helpers';

// A real API server, with its own folder, for this test's timetable and admin calls.
const PORT = 3998;
let server: ChildProcess;

test.beforeAll(async () => {
  server = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
    cwd: path.resolve(import.meta.dirname, '../../server'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: mkdtempSync(path.join(tmpdir(), 'timetable-')),
      PLANNER_PASSCODE: '',
      ADMIN_PASSCODE: 'boss',
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

async function device(context: BrowserContext) {
  for (const pattern of ['**/api/timetable**', '**/api/auth/admin**'])
    await context.route(pattern, async (route) => {
      const url = new URL(route.request().url());
      url.host = `127.0.0.1:${PORT}`;
      await route.fulfill({ response: await route.fetch({ url: url.toString() }) });
    });
  const page = await context.newPage();
  await signIn(page);
  return page;
}

test('the admin schedules the timetable; everyone sees it', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One device size is enough');
  const admin = await device(await browser.newContext());
  const worker = await device(await browser.newContext());

  // Unlocking admin is checked on the server: the old local passcode doesn't work.
  await admin.goto('/timetable');
  await admin.getByRole('button', { name: 'Admin: schedule' }).click();
  const unlock = admin.getByRole('dialog', { name: 'Unlock admin' });
  await unlock.getByLabel('Admin passcode').fill('admin');
  await unlock.getByRole('button', { name: /Unlock/ }).click();
  await expect(unlock.getByText(/isn't right/)).toBeVisible();
  await unlock.getByLabel('Admin passcode').fill('boss');
  await unlock.getByRole('button', { name: /Unlock/ }).click();
  await expect(unlock).toBeHidden();

  // A sales meet-up, then an installation overlapping it with the same person.
  const book = async (kind: string, title: string, start: string, end: string) => {
    await admin.getByRole('button', { name: 'New appointment', exact: true }).click();
    const d = admin.getByRole('dialog', { name: 'New appointment' });
    await d.getByRole('radio', { name: kind }).click();
    await d.getByLabel('What').fill(title);
    await d.getByLabel('From').fill(start);
    await d.getByLabel('To').fill(end);
    await d.getByLabel('Add someone').fill('Jo');
    await d.getByRole('button', { name: 'Add', exact: true }).click();
    await d.getByRole('button', { name: 'Save' }).click();
    await expect(d).toBeHidden();
  };
  await book('Sales meet-up', 'Showroom visit, Mr Lim', '10:00', '11:00');
  await book('Installation', 'Install switches, Tan residence', '10:30', '16:00');
  const grid = admin.getByRole('grid');
  await expect(grid.getByRole('button', { name: /^Sales meet-up: Showroom visit/ })).toBeVisible();
  await expect(grid.getByRole('button', { name: /^Installation: Install switches/ })).toBeVisible();
  await expect(grid.getByLabel('Double-booked: Jo')).toHaveCount(2);
  await admin.getByRole('radio', { name: /^Installations/ }).click();
  await expect(grid.getByRole('button', { name: /^Sales meet-up/ })).toHaveCount(0);
  await admin.getByRole('radio', { name: 'All', exact: true }).click();
  await admin.screenshot({ path: 'test-results/screens/timetable-admin.png', fullPage: true });

  // Another device: sees both, can't change them.
  await worker.goto('/timetable');
  const wgrid = worker.getByRole('grid');
  await expect(wgrid.getByRole('button', { name: /^Sales meet-up: Showroom visit/ })).toBeVisible();
  await expect(worker.getByRole('button', { name: 'New appointment', exact: true })).toHaveCount(0);
  await wgrid.getByRole('button', { name: /^Installation: Install switches/ }).click();
  const details = worker.getByRole('dialog', { name: 'Install switches, Tan residence' });
  await expect(details).toContainText('Only the admin can change it');
  await expect(details).toContainText('Jo');

  // And the server refuses a change from it.
  const res = await worker.evaluate(() =>
    fetch('/api/timetable/events/tt_hack1234', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'sales',
        date: '2026-10-12',
        start: '09:00',
        end: '10:00',
        title: 'x',
        people: [],
      }),
    }).then((r) => r.status),
  );
  expect(res).toBe(403);
});
