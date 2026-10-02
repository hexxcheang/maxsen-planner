import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

test.describe('Magic Plan', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('plans a sample drawing with the chosen categories', async ({ page }, testInfo) => {
    await page.goto('/projects/proj_sample_tan/plan?level=lvl_tan_1&type=lighting');
    await page.getByRole('button', { name: 'Magic Plan' }).click();
    const dialog = page.getByRole('dialog', { name: 'Magic Plan' });
    await expect(dialog.getByRole('group', { name: 'Smart Home Plan categories' })).toBeVisible();

    // Leave curtains out.
    await dialog.getByRole('checkbox', { name: /Curtains/ }).click();
    await dialog.getByRole('button', { name: 'Create Magic Plan' }).click();

    await expect(dialog.getByText(/Found 10 rooms/)).toBeVisible();
    await expect(dialog.getByRole('cell', { name: /Smart Switches/ })).toBeVisible();
    await expect(dialog.getByRole('cell', { name: /Downlights/ })).toBeVisible();
    await expect(dialog.getByRole('cell', { name: /Curtains/ })).toHaveCount(0);
    await expect(dialog.getByRole('cell', { name: /Track Lights/ })).toHaveCount(0);
    await testInfo.attach('review', { body: await page.screenshot(), contentType: 'image/png' });
    await page.screenshot({
      path: `test-results/screens/magic-review-${testInfo.project.name}.png`,
    });

    await dialog.getByRole('button', { name: /Place \d+ items/ }).click();
    await expect(page.getByText(/Magic Plan placed \d+ items/)).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `test-results/screens/magic-lighting-${testInfo.project.name}.png`,
    });

    // One undo takes all of Magic Plan's lights off the Lighting Plan; redo puts them back.
    await page.getByRole('button', { name: 'Undo (Ctrl+Z)' }).click();
    await expect(page.getByRole('button', { name: 'Undo (Ctrl+Z)' })).toBeDisabled();
    await page.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)' }).click();

    await page.getByRole('radio', { name: 'Smart Home' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `test-results/screens/magic-smart-home-${testInfo.project.name}.png`,
    });
  });

  test('reads an uploaded drawing on this computer and plans it by room size', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.route('**/api/magic-plan/status', (route) =>
      route.fulfill({ json: { configured: false } }),
    );
    // A real drawing as a customer would send it: the sample 4-room plan as a PNG scan.
    await uploadAndOpen(page, drawHdbPng, { lighting: true });

    await page.getByRole('button', { name: 'Magic Plan' }).click();
    const dialog = page.getByRole('dialog', { name: 'Magic Plan' });
    await expect(dialog.getByRole('radio', { name: 'On this computer' })).toBeChecked();
    await expect(dialog.getByRole('radio', { name: 'With Claude' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Create Magic Plan' }).click();

    // Straight to the summary: rooms aren't named or classified, so there is nothing to check.
    await expect(dialog.getByText(/Found 10 rooms/)).toBeVisible({ timeout: 60_000 });
    await expect(dialog.getByText(/planned by its size and shape/)).toBeVisible();
    await expect(dialog.getByRole('list', { name: 'Rooms' })).toHaveCount(0);
    await expect(dialog.getByRole('cell', { name: /Ceiling Fans/ })).toBeVisible();
    await dialog.getByRole('button', { name: /Place \d+ items/ }).click();
    await expect(page.getByText(/Magic Plan placed \d+ items/)).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `test-results/screens/magic-local-${testInfo.project.name}.png`,
    });
    await page.getByRole('radio', { name: 'Lighting' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `test-results/screens/magic-local-lighting-${testInfo.project.name}.png`,
    });
  });

  test('suggests a crop to the floor plan and lets you adjust it', async ({ page }, testInfo) => {
    await createProjectWithUpload(page, drawHdbPng);
    const card = page.getByRole('region', { name: 'Smart Home Plan' });
    await card.getByRole('button', { name: 'Choose a drawing' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /plan.png, page 1/ }).click();
    const crop = dialog.getByRole('group', { name: 'Crop' });
    await expect(crop).toBeVisible();
    const read = async () =>
      (await crop.getAttribute('data-crop'))!.split(',').map(Number) as [
        number,
        number,
        number,
        number,
      ];
    // The plan sits inside the page with a margin; the title block and border are trimmed.
    const [x, y, w, h] = await read();
    expect(x).toBeGreaterThan(0.02);
    expect(y).toBeGreaterThan(0.02);
    expect(w).toBeLessThan(0.95);
    expect(h).toBeLessThan(0.95);
    await page.screenshot({ path: `test-results/screens/crop-${testInfo.project.name}.png` });

    // Drag the bottom-right handle in.
    const handle = dialog.getByRole('button', { name: 'Bottom-right corner of the crop' });
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x - 40, box.y - 30, { steps: 4 });
    await page.mouse.up();
    const dragged = await read();
    expect(dragged[2]).toBeLessThan(w);
    expect(dragged[3]).toBeLessThan(h);

    await dialog.getByRole('button', { name: 'Whole page' }).click();
    expect(await read()).toEqual([0, 0, 1, 1]);
    await dialog.getByRole('button', { name: 'Fit to floor plan' }).click();
    expect(await read()).toEqual([x, y, w, h]);

    await dialog.getByRole('button', { name: 'Use this drawing' }).click();
    await card.getByRole('link', { name: 'Open in planner' }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: `test-results/screens/crop-planner-${testInfo.project.name}.png`,
    });
  });

  test('explains when an uploaded page has no plan it can read', async ({ page }) => {
    await page.route('**/api/magic-plan/status', (route) =>
      route.fulfill({ json: { configured: false } }),
    );
    await uploadAndOpen(page, () => {
      const c = document.createElement('canvas');
      c.width = 800;
      c.height = 600;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 800, 600);
      ctx.strokeRect(50, 50, 700, 500);
      return Promise.resolve(c.toDataURL('image/png').split(',')[1]!);
    });
    await page.getByRole('button', { name: 'Magic Plan' }).click();
    const dialog = page.getByRole('dialog', { name: 'Magic Plan' });
    await expect(
      dialog.getByText('No Lighting Plan on Level 1. Set one up in Setup to include these.'),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Create Magic Plan' }).click();
    await expect(dialog.getByRole('alert')).toContainText('Couldn’t find any rooms', {
      timeout: 60_000,
    });
  });
});

/** The sample 4-room plan as a customer's PNG scan. */
async function drawHdbPng() {
  const img = new Image();
  img.src = '/sample/floorplan-hdb-4room.svg';
  await img.decode();
  const c = document.createElement('canvas');
  c.width = 2100;
  c.height = 1500;
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png').split(',')[1]!;
}

/** Creates a blank project and uploads a PNG drawn in the page. */
async function createProjectWithUpload(page: Page, drawPng: () => Promise<string>) {
  await page.goto('/projects/new');
  await page.getByRole('radio', { name: /Start from blank/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel('Project title').fill('Magic upload');
  await page.getByRole('button', { name: 'Create project' }).click();
  const png = await page.evaluate(drawPng);
  await page.getByLabel('Upload drawings').setInputFiles({
    name: 'plan.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
}

/**
 * Creates a blank project, uploads a PNG drawn in the page, uses it for the Smart Home Plan (and
 * the Lighting Plan when asked) and opens the Smart Home Plan.
 */
async function uploadAndOpen(
  page: Page,
  drawPng: () => Promise<string>,
  { lighting = false }: { lighting?: boolean } = {},
) {
  await createProjectWithUpload(page, drawPng);
  for (const name of lighting ? ['Lighting Plan', 'Smart Home Plan'] : ['Smart Home Plan']) {
    const card = page.getByRole('region', { name });
    await card.getByRole('button', { name: 'Choose a drawing' }).click();
    await page
      .getByRole('dialog')
      .getByRole('radio', { name: /plan.png, page 1/ })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Use this drawing' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page
    .getByRole('region', { name: 'Smart Home Plan' })
    .getByRole('link', { name: 'Open in planner' })
    .click();
}
