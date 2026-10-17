import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type BrowserContext } from '@playwright/test';
import { signIn } from './helpers';

// A real API server, with its own folder, for this test's claims, receipts and admin calls.
const PORT = 3994;
let server: ChildProcess;

test.beforeAll(async () => {
  // Its tests run on desktop only. Started once there, so another device size finishing first
  // can't stop the server under them.
  if (test.info().project.name !== 'desktop') return;
  server = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
    cwd: path.resolve(import.meta.dirname, '../../server'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: mkdtempSync(path.join(tmpdir(), 'claims-')),
      PLANNER_PASSCODE: '',
      ADMIN_PASSCODE: 'boss',
    },
    stdio: 'ignore',
    // Its own process group, so stopping it stops the server itself, not just pnpm.
    detached: true,
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
  if (server?.pid) process.kill(-server.pid);
});

async function device(context: BrowserContext) {
  contexts.push(context);
  for (const pattern of ['**/api/claims**', '**/api/auth/admin**'])
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

// A tiny picture and PDF to stand in for receipts.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

test('anyone claims with receipts; only the admin approves or rejects', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One device size is enough');
  const jo = await device(await browser.newContext());
  const boss = await device(await browser.newContext());

  // Jo claims for cable ties, with a photo and a PDF of the receipt.
  await jo.goto('/claims');
  await jo.getByRole('button', { name: 'New claim' }).click();
  const form = jo.getByRole('dialog', { name: 'New claim' });
  await expect(form.getByRole('button', { name: 'Submit claim' })).toBeDisabled();
  await form.getByLabel('Amount (S$)').fill('42.50');
  await form.getByLabel('What it was for').fill('Cable ties and trunking for the Tan site');
  await form.getByLabel('Category').selectOption('Materials');
  await form.getByLabel('Receipt files').setInputFiles([
    { name: 'receipt.png', mimeType: 'image/png', buffer: PNG },
    { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: PDF },
  ]);
  await expect(form.getByRole('link', { name: /^Open receipt/ })).toHaveCount(2);
  await form.getByRole('button', { name: 'Submit claim' }).click();
  const who = jo.getByRole('dialog', { name: 'Your name' });
  await who.getByLabel('Name').fill('Jo');
  await who.getByRole('button', { name: 'Continue' }).click();
  await expect(form).toBeHidden();
  const list = jo.getByRole('list', { name: 'Claims' });
  await expect(list).toContainText('Cable ties and trunking');
  await expect(list).toContainText('Waiting for approval');
  await expect(jo.getByTestId('claims-pending')).toContainText('S$42.50');

  // And a second one, for lunch.
  await jo.getByRole('button', { name: 'New claim' }).click();
  await form.getByLabel('Amount (S$)').fill('18');
  await form.getByLabel('What it was for').fill('Lunch');
  await form.getByLabel('Receipt files').setInputFiles({
    name: 'lunch.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await expect(form.getByRole('link', { name: /^Open receipt/ })).toHaveCount(1);
  await form.getByRole('button', { name: 'Submit claim' }).click();
  await expect(form).toBeHidden();
  await jo.screenshot({ path: 'test-results/screens/claims.png', fullPage: true });

  // The admin, on another device, sees both; approving asks for the admin passcode.
  await boss.goto('/claims');
  const bossList = boss.getByRole('list', { name: 'Claims' });
  await bossList.getByRole('button', { name: /Cable ties/ }).click();
  const claim = boss.getByRole('dialog', { name: 'Claim by Jo' });
  await expect(claim.getByRole('img', { name: 'receipt.png' })).toBeVisible();
  await claim.getByRole('button', { name: 'Approve S$42.50' }).click();
  const unlock = boss.getByRole('dialog', { name: 'Unlock admin' });
  await unlock.getByLabel('Admin passcode').fill('boss');
  await unlock.getByRole('button', { name: /Unlock/ }).click();
  const bossName = boss.getByRole('dialog', { name: 'Your name' });
  await bossName.getByLabel('Name').fill('Hexiang');
  await bossName.getByRole('button', { name: 'Continue' }).click();
  await expect(claim).toBeHidden();

  // Rejecting says why.
  await bossList.getByRole('button', { name: /Lunch/ }).click();
  const lunch = boss.getByRole('dialog', { name: 'Claim by Jo' });
  await lunch.getByRole('button', { name: 'Reject' }).click();
  await expect(lunch.getByRole('button', { name: 'Reject claim' })).toBeDisabled();
  await lunch.getByLabel('Why it’s rejected').fill('Meals aren’t claimable');
  await lunch.getByRole('button', { name: 'Reject claim' }).click();
  await expect(lunch).toBeHidden();

  // Jo sees where each stands, and can't change a decided claim.
  await jo.reload();
  await jo.getByRole('radio', { name: /^All/ }).click();
  await expect(list.getByRole('button', { name: /Cable ties/ })).toContainText('Approved');
  await expect(list.getByRole('button', { name: /Lunch/ })).toContainText('Rejected');
  await list.getByRole('button', { name: /Lunch/ }).click();
  const seen = jo.getByRole('dialog', { name: 'Claim by Jo' });
  await expect(seen).toContainText('Rejected by Hexiang');
  await expect(seen).toContainText('Meals aren’t claimable');
  await expect(seen.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  await jo.screenshot({ path: 'test-results/screens/claim-rejected.png' });
});
