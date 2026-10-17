import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

/** The plan's view as [x, y, scale]. */
const viewport = async (page: Page) =>
  (await page.getByTestId('plan-canvas').getAttribute('data-viewport'))!.split(',').map(Number);

test.describe('on a touch tablet', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'magicpad', 'Touch gestures are for the tablet');
    await signIn(page);
  });

  test('the plan pinches, pans and draws with fingers', async ({ page }, testInfo) => {
    await page.goto('/projects/proj_sample_tan/plan?level=lvl_tan_1&type=lighting');
    const canvas = page.getByTestId('plan-canvas');
    await expect(canvas.locator('canvas').first()).toBeVisible();
    const box = (await canvas.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const touch = (
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      points: { x: number; y: number }[],
    ) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id })),
      });

    // Two fingers spreading apart zoom in around them.
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const [, , before] = await viewport(page);
    await touch('touchStart', [
      { x: cx - 40, y: cy },
      { x: cx + 40, y: cy },
    ]);
    for (let i = 1; i <= 6; i++)
      await touch('touchMove', [
        { x: cx - 40 - i * 20, y: cy },
        { x: cx + 40 + i * 20, y: cy },
      ]);
    await touch('touchEnd', []);
    const [, , after] = await viewport(page);
    expect(after! / before!).toBeGreaterThan(2);

    // One finger on empty plan pans it.
    const [x0, y0] = await viewport(page);
    const start = { x: box.x + 12, y: box.y + box.height - 140 };
    await touch('touchStart', [start]);
    for (let i = 1; i <= 5; i++)
      await touch('touchMove', [{ x: start.x + i * 20, y: start.y - i * 10 }]);
    await touch('touchEnd', []);
    const [x1, y1] = await viewport(page);
    expect(Math.round(x1! - x0!)).toBe(100);
    expect(Math.round(y1! - y0!)).toBe(-50);

    // Buttons are finger-sized.
    const undo = page.getByRole('button', { name: 'Undo (Ctrl+Z)' });
    expect((await undo.boundingBox())!.height).toBeGreaterThanOrEqual(36);

    // Draw an LED strip by tapping, and finish it with the button (no keyboard or double-tap).
    await page.getByRole('button', { name: 'Fit to screen' }).tap();
    await page.getByRole('button', { name: /^Draw LED strip/ }).tap();
    const status = page.getByRole('status').filter({ hasText: /Tap the start/ });
    await expect(status).toBeVisible();
    const b = (await canvas.boundingBox())!;
    await page.touchscreen.tap(b.x + b.width * 0.45, b.y + b.height * 0.45);
    await page.touchscreen.tap(b.x + b.width * 0.6, b.y + b.height * 0.45);
    await expect(page.getByText(/Tap Finish when done/)).toBeVisible();
    await page.screenshot({
      path: `test-results/screens/tablet-drawing-${testInfo.project.name}.png`,
    });
    await page.getByRole('button', { name: 'Finish', exact: true }).tap();
    await expect(page.getByText(/Tap Finish when done/)).toBeHidden();

    // A + at each end extends the strip from either end.
    const details = page.getByRole('complementary', { name: 'Details' });
    await expect(details.getByText('2 points', { exact: true })).toBeVisible();
    // The start + sits twice 22 px (finger-sized) before the first point, away from the strip.
    await page.touchscreen.tap(b.x + b.width * 0.45 - 44, b.y + b.height * 0.45);
    await expect(details.getByText('3 points', { exact: true })).toBeVisible();
    await page.touchscreen.tap(b.x + b.width * 0.6 + 44, b.y + b.height * 0.45);
    await expect(details.getByText('4 points', { exact: true })).toBeVisible();

    // The new strip is selected: copy and paste it from the toolbar.
    const copy = page.getByRole('button', { name: 'Copy (Ctrl+C)' });
    await expect(copy).toBeEnabled();
    await copy.tap();
    const paste = page.getByRole('button', { name: 'Paste beside it (Ctrl+V)' });
    await expect(paste).toBeEnabled();
    await paste.tap();
    await page
      .getByRole('toolbar', { name: 'Plan tools' })
      .getByRole('button', { name: 'Delete (Delete)' })
      .tap();
    await expect(page.getByRole('button', { name: 'Copy (Ctrl+C)' })).toBeDisabled();
  });

  test('installs as an app with the Maxsen icon', async ({ page }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = (await (await page.request.get(href!)).json()) as {
      display: string;
      icons: { src: string }[];
    };
    expect(manifest.display).toBe('standalone');
    for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
  });

  test('one tap places one device, and a curtain drawn with taps is straight', async ({ page }) => {
    await page.goto('/projects/proj_sample_tan/plan?level=lvl_tan_1&type=smart-home');
    const canvas = page.getByTestId('plan-canvas');
    await expect(canvas.locator('canvas').first()).toBeVisible();
    const elements = (kind: string) =>
      page.evaluate((k) => {
        const st = JSON.parse(localStorage.getItem('maxsen.mvp.state.v1') ?? '{"plans":[]}') as {
          plans: { document: { elements: { id: string; kind: string; points?: unknown }[] } }[];
        };
        return st.plans.flatMap((p) => p.document.elements).filter((e) => e.kind === k);
      }, kind);
    const b = (await canvas.boundingBox())!;

    // A tap is followed by the browser's made-up click; only one sensor is placed.
    await page.getByRole('searchbox', { name: 'Search devices' }).fill('Motion');
    await page.getByRole('list', { name: 'Search results' }).getByRole('button').first().tap();
    const sensors = async () =>
      Number(
        /Sensors\s+(\d+)/.exec(
          await page.getByRole('complementary', { name: 'Details' }).innerText(),
        )?.[1],
      );
    const before = await sensors();
    await page.touchscreen.tap(b.x + b.width * 0.5, b.y + b.height * 0.5);
    await expect.poll(sensors).toBe(before + 1);
    await page.waitForTimeout(600);
    expect(await sensors()).toBe(before + 1);
    await page.getByRole('button', { name: 'Stop' }).tap();

    // A curtain from one end of the window to the other: two points, in a straight line.
    await page.waitForTimeout(1200);
    const existing = new Set((await elements('curtain')).map((e) => e.id));
    await page.getByRole('searchbox', { name: 'Search devices' }).fill('Curtain Track');
    await page.getByRole('list', { name: 'Search results' }).getByRole('button').first().tap();
    await page.touchscreen.tap(b.x + b.width * 0.3, b.y + b.height * 0.3);
    await page.touchscreen.tap(b.x + b.width * 0.55, b.y + b.height * 0.31);
    await page.getByRole('button', { name: 'Finish', exact: true }).tap();
    await expect
      .poll(async () => (await elements('curtain')).filter((e) => !existing.has(e.id)).length)
      .toBe(1);
    const curtain = (await elements('curtain')).find((e) => !existing.has(e.id))!;
    const points = curtain.points as { x: number; y: number }[];
    expect(points).toHaveLength(2);
    expect(points[0]!.y).toBe(points[1]!.y);
  });
});
