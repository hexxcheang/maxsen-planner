import { expect, test, type Page } from '@playwright/test';
import { shoot, signIn } from './helpers';

const MARINA = '/projects/proj_sample_marina/plan?level=lvl_mar_1&type=smart-home';
// The Lenovo smart lock at the entrance, authored at (650, 912) on the 1400-wide drawing.
const LOCK = { x: (650 * 1000) / 1400, y: (912 * 1000) / 1400 };

async function viewport(page: Page) {
  const raw = await page.getByTestId('plan-canvas').getAttribute('data-viewport');
  const [x, y, scale] = (raw ?? '0,0,1').split(',').map(Number);
  return { x: x!, y: y!, scale: scale! };
}

test.describe('planner', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('renders the sample plan with markers and paths', async ({ page }, testInfo) => {
    await page.goto('/projects/proj_sample_tan/plan?level=lvl_tan_1&type=lighting');
    await expect(page.locator('canvas').first()).toBeVisible();
    const legend = page.getByRole('region', { name: 'Legend' });
    await expect(legend).toContainText('Downlights');
    await expect(legend).toContainText('LED Strips');
    await shoot(
      page,
      testInfo,
      'planner-lighting',
      '/projects/proj_sample_tan/plan?level=lvl_tan_1&type=lighting',
      { fullPage: false },
    );
    await shoot(
      page,
      testInfo,
      'planner-smart-home',
      '/projects/proj_sample_lim/plan?level=lvl_lim_1&type=smart-home',
      { fullPage: false },
    );
  });

  test('clicking a marker shows its inspector', async ({ page }) => {
    await page.goto(MARINA);
    await expect(page.getByTestId('plan-canvas')).toHaveAttribute('data-scale', '1.00');
    const v = await viewport(page);
    const box = (await page.getByTestId('plan-canvas').boundingBox())!;
    await page.mouse.click(box.x + v.x + LOCK.x * v.scale, box.y + v.y + LOCK.y * v.scale);
    const show = page.getByRole('button', { name: 'Show details' });
    if (await show.isVisible()) await show.click();
    const details = page.getByRole('complementary', { name: 'Details' });
    await expect(details).toContainText('Lenovo Smart Lock');
    await expect(details.getByLabel('Label')).toHaveValue('Entrance');
  });

  test('zoom buttons change the scale', async ({ page }) => {
    await page.goto(MARINA);
    const canvas = page.getByTestId('plan-canvas');
    await expect(canvas).toHaveAttribute('data-scale', '1.00');
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(canvas).toHaveAttribute('data-scale', '1.25');
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect(canvas).toHaveAttribute('data-scale', '0.80');
    await page.getByRole('button', { name: 'Fit to screen' }).click();
    await expect(canvas).toHaveAttribute('data-scale', '1.00');
  });

  test('a missing plan shows the set-up prompt', async ({ page }) => {
    await page.goto('/projects/proj_sample_lim/plan?level=lvl_lim_3&type=smart-home');
    await expect(
      page.getByRole('heading', { name: 'No Smart Home Plan on Attic yet' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Set up in Setup' })).toBeVisible();
  });
});
