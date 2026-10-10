import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type BrowserContext } from '@playwright/test';
import { signIn } from './helpers';

// A real API server, with its own folder, for this test's inventory and admin calls.
const PORT = 3997;
let server: ChildProcess;

test.beforeAll(async () => {
  server = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
    cwd: path.resolve(import.meta.dirname, '../../server'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: mkdtempSync(path.join(tmpdir(), 'inventory-')),
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
  for (const pattern of ['**/api/inventory**', '**/api/auth/admin**'])
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

const SWITCH = 'var_nova_pro_2g_black';

test('installers take out for a site; the manager checks it and restocks', async ({
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'One device size is enough');
  const manager = await device(await browser.newContext());
  const installer = await device(await browser.newContext());

  // The manager restocks 20 switches.
  await manager.goto('/inventory');
  await manager.getByRole('button', { name: 'Inventory manager' }).click();
  const unlock = manager.getByRole('dialog', { name: 'Unlock admin' });
  await unlock.getByLabel('Admin passcode').fill('boss');
  await unlock.getByRole('button', { name: /Unlock/ }).click();
  await expect(unlock).toBeHidden();
  await manager.getByRole('button', { name: 'Restock' }).click();
  const restock = manager.getByRole('dialog', { name: 'Restock' });
  await restock.getByLabel('Add an item').selectOption(SWITCH);
  await restock.getByLabel(/^How many/).fill('20');
  await restock.getByLabel('Supplier or reference (optional)').fill('PO 1042');
  await restock.getByRole('button', { name: 'Add to stock' }).click();
  // Asked once who's recording.
  const who = manager.getByRole('dialog', { name: 'Your name' });
  await who.getByLabel('Name').fill('Boss');
  await who.getByRole('button', { name: 'Continue' }).click();
  await expect(restock).toBeHidden();
  await expect(manager.getByTestId(`stock-${SWITCH}`)).toHaveText('20');

  // An installer takes 5 out for a site; they can't restock.
  await installer.goto('/inventory');
  await expect(installer.getByRole('button', { name: 'Restock' })).toHaveCount(0);
  await installer.getByRole('radio', { name: 'Take out / return' }).click();
  await installer.getByLabel('Your name').fill('Ali');
  await installer.getByLabel('Site').fill('Tan residence');
  await installer.getByLabel('Add an item').selectOption(SWITCH);
  await installer.getByLabel(/^How many/).fill('5');
  await installer.getByRole('button', { name: 'Record take-out' }).click();
  await expect(installer.getByText('Take-out recorded')).toBeVisible();
  await installer.getByRole('radio', { name: 'Stock' }).click();
  await expect(installer.getByTestId(`stock-${SWITCH}`)).toHaveText('15');

  // The manager checks the site: 6 were really taken.
  await manager.reload();
  await manager.getByRole('radio', { name: 'Site checks (1)' }).click();
  const card = manager.getByRole('article', { name: 'Take-out for Tan residence' });
  await expect(card).toContainText('Taken out by Ali');
  await card.getByLabel(/^Counted for Tan residence/).fill('6');
  await card.getByRole('button', { name: 'Confirm count' }).click();
  await expect(card).toContainText('Checked by Boss');
  await expect(card).toContainText('1 count differed');
  await manager.screenshot({ path: 'test-results/screens/inventory-checks.png', fullPage: true });
  await manager.getByRole('radio', { name: 'Stock' }).click();
  await expect(manager.getByTestId(`stock-${SWITCH}`)).toHaveText('14');

  // One unused comes back.
  await installer.getByRole('radio', { name: 'Take out / return' }).click();
  await installer.getByRole('radio', { name: 'Return unused' }).click();
  await installer.getByLabel('Site').fill('Tan residence');
  await installer.getByLabel('Add an item').selectOption(SWITCH);
  await installer.getByRole('button', { name: 'Record return' }).click();
  await installer.getByRole('radio', { name: 'Stock' }).click();
  await expect(installer.getByTestId(`stock-${SWITCH}`)).toHaveText('15');

  await installer.getByRole('radio', { name: 'History' }).click();
  const history = installer.getByRole('region', { name: 'History' });
  await expect(history.getByRole('row')).toHaveCount(4);
  await expect(history).toContainText('PO 1042');
  await installer.screenshot({
    path: 'test-results/screens/inventory-history.png',
    fullPage: true,
  });
});
