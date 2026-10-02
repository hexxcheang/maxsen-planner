import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

async function viewport(page: Page) {
  const raw = await page.getByTestId('plan-canvas').getAttribute('data-viewport');
  const [x, y, scale] = (raw ?? '0,0,1').split(',').map(Number);
  const box = (await page.getByTestId('plan-canvas').boundingBox())!;
  /** Screen position of a plan-unit point. */
  return (px: number, py: number) => ({ x: box.x + x! + px * scale!, y: box.y + y! + py * scale! });
}

async function totalFor(page: Page, category: string) {
  const row = page
    .getByRole('list', { name: 'Live totals by category' })
    .getByRole('button', { name: new RegExp(category) });
  return (await row.textContent())?.replace(category, '').trim();
}

async function openDetails(page: Page) {
  const show = page.getByRole('button', { name: 'Show details' });
  if (await show.isVisible()) await show.click();
}

async function openLibrary(page: Page) {
  const show = page.getByRole('button', { name: 'Show library' });
  if (await show.isVisible()) await show.click();
}

test.describe('MVP editing', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('place a device, undo, redo, and it survives a reload', async ({ page }) => {
    await page.goto('/projects/proj_sample_marina/plan?level=lvl_mar_1&type=smart-home');
    await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-scale', '1.00');
    await openDetails(page);
    expect(await totalFor(page, 'Control Panels')).toBe('1');

    await openLibrary(page);
    await page.getByRole('searchbox', { name: 'Search devices' }).fill('Nova S8');
    await page.getByRole('list', { name: 'Search results' }).getByRole('button').first().click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Click the plan to place' }),
    ).toBeVisible();
    const at = await viewport(page);
    const p = at(300, 300);
    await page.mouse.click(p.x, p.y);
    await page.keyboard.press('Escape');
    await openDetails(page);
    await expect.poll(() => totalFor(page, 'Control Panels')).toBe('2');

    await page.getByRole('button', { name: 'Undo (Ctrl+Z)' }).click();
    await expect.poll(() => totalFor(page, 'Control Panels')).toBe('1');
    await page.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)' }).click();
    await expect.poll(() => totalFor(page, 'Control Panels')).toBe('2');

    await page.reload();
    // Wait for the planner to render before looking for the (collapsed on iPad) details panel.
    await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-scale', '1.00');
    await openDetails(page);
    await expect.poll(() => totalFor(page, 'Control Panels')).toBe('2');
  });

  test('draw an LED strip and enter its length', async ({ page }) => {
    await page.goto('/projects/proj_sample_tan/plan?level=lvl_tan_1&type=lighting');
    await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-scale', '1.00');
    await page.getByRole('button', { name: /Draw LED strip/ }).click();
    const at = await viewport(page);
    for (const [x, y] of [
      [150, 600],
      [350, 600],
      [350, 650],
    ]) {
      const p = at(x!, y!);
      await page.mouse.click(p.x, p.y);
    }
    await page.keyboard.press('Enter');
    await openDetails(page);
    const length = page
      .getByRole('complementary', { name: 'Details' })
      .getByLabel('Length', { exact: true });
    await expect(length).toBeVisible();
    await length.fill('3.5');
    await length.press('Enter');
    await expect(
      page
        .getByRole('complementary', { name: 'Details' })
        .getByText('Enter the length so totals are right'),
    ).toHaveCount(0);

    // Two LED runs in the sample plus this one: three Smart LED Drivers.
    await page.goto('/projects/proj_sample_tan/review');
    const driver = page.getByRole('textbox', {
      name: 'Export quantity for Smart LED Driver, Standard',
    });
    await expect(driver).toHaveValue('3');
  });

  test('upload a drawing, assign it, and open the plan', async ({ page }) => {
    await page.goto('/projects/new');
    await page.getByRole('radio', { name: /Start from blank/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Project title').fill('Upload test');
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByRole('heading', { name: 'Setup' })).toBeVisible();

    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 1400;
      c.height = 1000;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 1400, 1000);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 10;
      ctx.strokeRect(100, 100, 1200, 800);
      return c.toDataURL('image/png').split(',')[1]!;
    });
    await page.getByLabel('Upload drawings').setInputFiles({
      name: 'customer-plan.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
    await expect(page.getByText('customer-plan.png', { exact: false }).first()).toBeVisible();

    const card = page.getByRole('region', { name: 'Smart Home Plan' });
    await card.getByRole('button', { name: 'Choose a drawing' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /customer-plan.png, page 1/ }).click();
    await dialog.getByRole('radio', { name: '90°' }).click();
    await dialog.getByRole('button', { name: 'Use this drawing' }).click();
    await expect(card.getByRole('link', { name: 'Open in planner' })).toBeVisible();
    await card.getByRole('link', { name: 'Open in planner' }).click();
    await expect(page.locator('canvas').first()).toBeVisible();

    // The drawing is in browser storage, so it is still there after a reload.
    await page.reload();
    await expect(page.locator('canvas').first()).toBeVisible();
  });
});
