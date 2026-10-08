import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type BrowserContext } from '@playwright/test';
import { signIn } from './helpers';

// A real API server, with its own folder, for this test's leads and admin calls.
const PORT = 3996;
let server: ChildProcess;

test.beforeAll(async () => {
  server = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
    cwd: path.resolve(import.meta.dirname, '../../server'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: mkdtempSync(path.join(tmpdir(), 'leads-')),
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

const contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((c) => c.close()));
});

test.afterAll(() => {
  server?.kill();
});

async function device(context: BrowserContext) {
  contexts.push(context);
  for (const pattern of ['**/api/leads**', '**/api/auth/admin**'])
    await context.route(pattern, async (route) => {
      const url = new URL(route.request().url());
      url.host = `127.0.0.1:${PORT}`;
      // Pages left polling after the test (and its server) has ended just stop.
      const response = await route.fetch({ url: url.toString() }).catch(() => null);
      await (response ? route.fulfill({ response }) : route.abort().catch(() => undefined));
    });
  const page = await context.newPage();
  await signIn(page);
  return page;
}

test('everyone adds and works leads; edits never overwrite each other', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One device size is enough');
  const jo = await device(await browser.newContext());
  const sam = await device(await browser.newContext());

  // Jo adds a lead from MyDigitalLock with just a name and phone.
  await jo.goto('/leads');
  await jo.getByRole('button', { name: 'New lead' }).click();
  const form = jo.getByRole('dialog', { name: 'New lead' });
  await form.getByRole('radio', { name: 'MyDigitalLock' }).click();
  await form.getByLabel('Name').fill('Mr Tan');
  await form.getByLabel('Phone').fill('9123 4567');
  await jo.screenshot({ path: 'test-results/screens/new-lead.png' });
  await form.getByRole('button', { name: 'Add lead' }).click();
  const who = jo.getByRole('dialog', { name: 'Your name' });
  await who.getByLabel('Name').fill('Jo');
  await who.getByRole('button', { name: 'Continue' }).click();
  await expect(form).toBeHidden();

  // And a Maxsen lead; the two lists are kept apart.
  await jo.getByRole('button', { name: 'New lead' }).click();
  await form.getByLabel('Name').fill('Ms Lim');
  await form.getByRole('button', { name: 'Add lead' }).click();
  await expect(form).toBeHidden();
  const split = jo.getByRole('radiogroup', { name: 'Lead from' });
  const leadList = jo.getByRole('list', { name: 'Leads' });
  await split.getByRole('radio', { name: /MyDigitalLock/ }).click();
  await expect(leadList.getByRole('button', { name: 'Mr Tan' })).toBeVisible();
  await expect(leadList.getByRole('button', { name: 'Ms Lim' })).toBeHidden();
  await split.getByRole('radio', { name: /Maxsen leads/ }).click();
  await expect(leadList.getByRole('button', { name: 'Ms Lim' })).toBeVisible();
  await expect(leadList.getByRole('button', { name: 'Mr Tan' })).toBeHidden();
  await split.getByRole('radio', { name: /All leads/ }).click();

  // Later, Jo fills in more: a follow-up already due, where they came from, and a note.
  await jo.getByRole('list', { name: 'Leads' }).getByRole('button', { name: 'Mr Tan' }).click();
  const lead = jo.getByRole('dialog', { name: 'Mr Tan' });
  await expect(lead.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
    'href',
    'https://wa.me/6591234567',
  );
  await lead.getByLabel('Next follow-up').fill('2026-01-05');
  await lead.getByLabel('Interested in').fill('Switches and lighting');
  await lead.getByText('More details').click();
  await lead.getByLabel('Where they came from').selectOption('Instagram');
  await lead.getByRole('button', { name: 'Save changes' }).click();
  await expect(lead.getByLabel('Where they came from')).toHaveValue('Instagram');
  await lead.getByLabel('New note').fill('Called, wants a showroom visit');
  await lead.getByRole('button', { name: 'Add note' }).click();
  await expect(lead.getByText('Called, wants a showroom visit')).toBeVisible();

  // Sam sees it, overdue, and moves it on.
  await sam.goto('/leads');
  await expect(sam.getByText('1 follow-up overdue')).toBeVisible();
  await sam.getByRole('button', { name: 'Mr Tan' }).click();
  const samLead = sam.getByRole('dialog', { name: 'Mr Tan' });
  await samLead.getByLabel('Status').selectOption('contacted');
  await samLead.getByRole('button', { name: 'Save changes' }).click();
  const samName = sam.getByRole('dialog', { name: 'Your name' });
  await samName.getByLabel('Name').fill('Sam');
  await samName.getByRole('button', { name: 'Continue' }).click();
  await samLead.getByLabel('New note').fill('Sent the brochure');
  await samLead.getByRole('button', { name: 'Add note' }).click();
  await expect(samLead.getByText('Sent the brochure')).toBeVisible();

  // Jo, still in the lead from before, changes it too: told, not overwritten.
  await lead.getByLabel('Budget').fill('S$8k');
  await lead.getByRole('button', { name: 'Save changes' }).click();
  await expect(lead.getByRole('alert')).toContainText('Sam changed this lead');
  await lead.getByRole('button', { name: 'Load theirs' }).click();
  await expect(lead.getByLabel('Status')).toHaveValue('contacted');
  // Both people's notes are there.
  await expect(lead.getByText('Called, wants a showroom visit')).toBeVisible();
  await expect(lead.getByText('Sent the brochure')).toBeVisible();
  await jo.screenshot({ path: 'test-results/screens/lead-dialog.png' });
  await lead.getByRole('button', { name: 'Close', exact: true }).last().click();

  // The list: Mr Tan, contacted, follow-up overdue.
  await jo.reload();
  const list = jo.getByRole('list', { name: 'Leads' });
  await expect(list.getByLabel('Status of Mr Tan')).toHaveValue('contacted');
  await jo.screenshot({ path: 'test-results/screens/leads.png', fullPage: true });

  // Won: it becomes a project.
  await list.getByRole('button', { name: 'Mr Tan' }).click();
  await jo
    .getByRole('dialog', { name: 'Mr Tan' })
    .getByRole('button', { name: 'Convert to project' })
    .click();
  await expect(jo.getByRole('heading', { name: 'Setup' })).toBeVisible();
});
