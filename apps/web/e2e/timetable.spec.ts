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
      EXCLUSIVE_PASSCODE: 'owner-only',
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

const contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

test.afterAll(() => {
  server?.kill();
});

async function device(context: BrowserContext) {
  contexts.push(context);
  for (const pattern of ['**/api/timetable**', '**/api/team**', '**/api/auth/admin**'])
    await context.route(pattern, async (route) => {
      const url = new URL(route.request().url());
      url.host = `127.0.0.1:${PORT}`;
      // Pages left polling after the test (and its server) has ended just stop.
      const response = await route
        // Like the dev server's proxy: the page's own host goes along, so the request is
        // the app's own, not another site's.
        .fetch({
          url: url.toString(),
          headers: { ...route.request().headers(), host: new URL(route.request().url()).host },
        })
        .catch(() => null);
      await (response ? route.fulfill({ response }) : route.abort().catch(() => undefined));
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
  const book = async (kind: string, title: string, start: string, end: string, first = false) => {
    await admin.getByRole('button', { name: 'New appointment', exact: true }).click();
    const d = admin.getByRole('dialog', { name: 'New appointment' });
    await d.getByRole('radio', { name: kind }).click();
    await d.getByLabel('What').fill(title);
    await d.getByLabel('From').fill(start);
    await d.getByLabel('To', { exact: true }).fill(end);
    await d.getByLabel('Add someone').fill('Jo');
    await d.getByRole('button', { name: 'Add', exact: true }).click();
    await d.getByRole('button', { name: 'Save' }).click();
    // The first save asks once who's scheduling.
    if (first) {
      const who = admin.getByRole('dialog', { name: 'Your name' });
      await who.getByLabel('Name').fill('Hexiang');
      await who.getByRole('button', { name: 'Continue' }).click();
    }
    await expect(d).toBeHidden();
  };
  await book('Sales meet-up', 'Showroom visit, Mr Lim', '10:00', '11:00', true);
  await book('Installation', 'Install switches, Tan residence', '10:30', '16:00');
  const grid = admin.getByRole('grid');
  await expect(grid.getByRole('button', { name: /^Sales meet-up: Showroom visit/ })).toBeVisible();
  await expect(grid.getByRole('button', { name: /^Installation: Install switches/ })).toBeVisible();
  await expect(grid.getByLabel('Double-booked: Jo')).toHaveCount(2);
  // Deliveries, site visits and integration appointments too, each in its own colour.
  await book('Delivery', 'Deliver switches, Tan residence', '08:00', '09:00');
  await expect(grid.getByRole('button', { name: /^Delivery: Deliver switches/ })).toBeVisible();
  await admin.getByLabel('Appointment type').selectOption('installation');
  await expect(grid.getByRole('button', { name: /^Sales meet-up/ })).toHaveCount(0);
  await expect(grid.getByRole('button', { name: /^Delivery/ })).toHaveCount(0);
  await admin.getByLabel('Appointment type').selectOption('all');

  // A quick one: just the time, filled in later. It's named after its type until then.
  await admin.getByRole('button', { name: 'New appointment', exact: true }).click();
  const quick = admin.getByRole('dialog', { name: 'New appointment' });
  await expect(quick.getByLabel('Client')).toBeHidden();
  await quick.getByLabel('From').fill('17:00');
  await admin.screenshot({ path: 'test-results/screens/new-appointment.png' });
  await quick.getByRole('button', { name: 'Save' }).click();
  await expect(quick).toBeHidden();
  await grid.getByRole('button', { name: /^Sales meet-up: Sales meet-up/ }).click();
  const later = admin.getByRole('dialog', { name: 'Appointment' });
  await later.getByText('More details').click();
  await later.getByLabel('Client').fill('Mdm Ong');
  await later.getByRole('button', { name: 'Save' }).click();
  await expect(later).toBeHidden();
  await admin.screenshot({ path: 'test-results/screens/timetable-admin.png', fullPage: true });

  // Jo's WhatsApp number on the team; messages on: changing an appointment offers to tell them.
  // Jo joined the team when first assigned; their profile takes a checked WhatsApp number.
  // The admin doesn't see the team: only the exclusive admin does.
  const nav = admin.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Team' })).toHaveCount(0);
  await expect(admin.getByRole('button', { name: 'Team' })).toHaveCount(0);
  await admin.goto('/team');
  await expect(admin.getByText('Only the exclusive admin can see the team')).toBeVisible();
  await expect(admin.getByRole('list', { name: 'Team' })).toHaveCount(0);
  await admin.getByRole('button', { name: 'Unlock exclusive admin' }).click();
  const owner = admin.getByRole('dialog', { name: 'Unlock exclusive admin' });
  await owner.getByLabel('Exclusive admin passcode').fill('boss');
  await owner.getByRole('button', { name: /Unlock/ }).click();
  await expect(owner.getByText('That’s the admin passcode.', { exact: false })).toBeVisible();
  await owner.getByLabel('Exclusive admin passcode').fill('owner-only');
  await owner.getByRole('button', { name: /Unlock/ }).click();
  await expect(owner).toBeHidden();
  await expect(nav.getByRole('link', { name: 'Team' })).toBeVisible();
  await admin.getByRole('list', { name: 'Team' }).getByRole('button', { name: 'Jo' }).click();
  const profile = admin.getByRole('dialog', { name: 'Jo' });
  await profile.getByLabel('WhatsApp number').fill('6123 4567');
  await expect(profile.getByText('Singapore mobiles start with 8 or 9')).toBeVisible();
  await expect(profile.getByRole('button', { name: 'Save' })).toBeDisabled();
  await profile.getByLabel('WhatsApp number').fill('9123 4567');
  await expect(profile.getByText('Saved as +65 9123 4567.')).toBeVisible();
  await expect(profile.getByRole('link', { name: /Test it/ })).toHaveAttribute(
    'href',
    'https://wa.me/6591234567',
  );
  await profile.getByLabel('Role').selectOption('Installer');
  await profile.getByRole('button', { name: 'Save' }).click();
  await expect(profile).toBeHidden();
  const card = admin
    .getByRole('list', { name: 'Team' })
    .getByRole('listitem')
    .filter({ hasText: 'Jo' });
  await expect(card).toContainText('Installer');
  await expect(card.getByRole('link', { name: 'WhatsApp Jo' })).toContainText('+65 9123 4567');
  await admin.screenshot({ path: 'test-results/screens/team.png' });
  await admin.goto('/timetable');
  await admin.getByRole('switch', { name: 'WhatsApp the people assigned' }).click();
  await expect(admin.getByRole('switch', { name: 'WhatsApp the people assigned' })).toBeChecked();
  await grid.getByRole('button', { name: /^Installation: Install switches/ }).click();
  const appt = admin.getByRole('dialog', { name: 'Appointment' });
  await appt.getByText('More details').click();
  await appt.getByLabel('Notes').fill('Bring the ladder');
  await appt.getByRole('button', { name: 'Save' }).click();
  const tell = admin.getByRole('dialog', { name: 'Tell them on WhatsApp' });
  const send = tell.getByRole('link', { name: 'Send on WhatsApp' });
  const href = decodeURIComponent((await send.getAttribute('href')) ?? '');
  expect(href).toMatch(
    /^https:\/\/wa\.me\/6591234567\?text=Hi Jo, your installation has been updated:/,
  );
  expect(href).toContain('*Install switches, Tan residence*');
  expect(href).toContain('Notes: Bring the ladder');
  await admin.screenshot({ path: 'test-results/screens/timetable-whatsapp.png' });
  await tell.getByRole('button', { name: 'Not now' }).click();

  // Another device: sees both, can't change them; the WhatsApp switch is there for everyone.
  await worker.goto('/timetable');
  await expect(worker.getByRole('switch', { name: 'WhatsApp the people assigned' })).toBeChecked();
  const wgrid = worker.getByRole('grid');
  await expect(wgrid.getByRole('button', { name: /^Sales meet-up: Showroom visit/ })).toBeVisible();
  await expect(worker.getByRole('button', { name: 'New appointment', exact: true })).toHaveCount(0);
  await wgrid.getByRole('button', { name: /^Installation: Install switches/ }).click();
  const details = worker.getByRole('dialog', { name: 'Install switches, Tan residence' });
  await expect(details).toContainText('Only the admin can change it');
  await expect(details).toContainText('Jo');
  await expect(details).toContainText('Scheduled by Hexiang');
  await details.press('Escape');

  // No Team for it, and the server keeps the team and their numbers from it.
  await expect(
    worker.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Team' }),
  ).toHaveCount(0);
  const seen = await worker.evaluate(async () => ({
    team: (await fetch('/api/team')).status,
    phones: ((await (await fetch('/api/timetable')).json()) as { phones: object }).phones,
  }));
  expect(seen).toEqual({ team: 403, phones: {} });

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
