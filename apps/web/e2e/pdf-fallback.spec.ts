import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// A real API server, to read the PDF when this browser can't.
const PORT = 3995;
let server: ChildProcess;

test.beforeAll(async () => {
  server = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
    cwd: path.resolve(import.meta.dirname, '../../server'),
    env: {
      ...process.env,
      PORT: String(PORT),
      DATA_DIR: mkdtempSync(path.join(tmpdir(), 'pdf-')),
      PLANNER_PASSCODE: '',
    },
    stdio: 'ignore',
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

test.afterAll(() => {
  if (server?.pid) process.kill(-server.pid);
});

test('reads an old invoice PDF on the server when the browser’s PDF reader can’t run', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'File handling is viewport-independent');
  test.setTimeout(90_000);
  // As on a browser where pdf.js can't start its reader.
  await page.route('**/pdf.worker*.mjs*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: "throw new Error('This browser can’t run it');",
    }),
  );
  let asked = 0;
  await page.route('**/api/pdf/text', async (route) => {
    asked++;
    const url = new URL(route.request().url());
    url.host = `127.0.0.1:${PORT}`;
    const response = await route
      .fetch({
        url: url.toString(),
        headers: { ...route.request().headers(), host: new URL(route.request().url()).host },
      })
      .catch(() => null);
    await (response ? route.fulfill({ response }) : route.abort().catch(() => undefined));
  });
  await signIn(page);
  await page.goto('/quote');
  await page.getByRole('radio', { name: 'Old invoice: next payment' }).click();
  await page
    .getByLabel('Old invoice file')
    .setInputFiles(path.join(import.meta.dirname, 'fixtures/multipage-invoice.pdf'));
  await expect(page.getByText(/Read 40 lines/)).toBeVisible({ timeout: 45_000 });
  expect(asked).toBe(1);
  const lines = page.getByRole('region', { name: 'Invoice lines' });
  await expect(lines.getByRole('row', { name: /^Total\s*S\$/ })).toContainText('S$15,764.00');
});
