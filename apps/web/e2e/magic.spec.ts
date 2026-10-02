import { expect, test } from '@playwright/test';
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

  test('explains the API key when an uploaded drawing cannot be read yet', async ({ page }) => {
    await page.route('**/api/magic-plan/status', (route) =>
      route.fulfill({ json: { configured: false } }),
    );
    await page.goto('/projects/new');
    await page.getByRole('radio', { name: /Start from blank/ }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Project title').fill('Magic upload');
    await page.getByRole('button', { name: 'Create project' }).click();
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 800;
      c.height = 600;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 800, 600);
      ctx.strokeRect(50, 50, 700, 500);
      return c.toDataURL('image/png').split(',')[1]!;
    });
    await page.getByLabel('Upload drawings').setInputFiles({
      name: 'plan.png',
      mimeType: 'image/png',
      buffer: Buffer.from(png, 'base64'),
    });
    const card = page.getByRole('region', { name: 'Smart Home Plan' });
    await card.getByRole('button', { name: 'Choose a drawing' }).click();
    await page
      .getByRole('dialog')
      .getByRole('radio', { name: /plan.png, page 1/ })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Use this drawing' }).click();
    await card.getByRole('link', { name: 'Open in planner' }).click();

    await page.getByRole('button', { name: 'Magic Plan' }).click();
    const dialog = page.getByRole('dialog', { name: 'Magic Plan' });
    await expect(dialog.getByText(/needs an Anthropic API key/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Create Magic Plan' })).toBeDisabled();
    await expect(
      dialog.getByText('No Lighting Plan on Level 1. Set one up in Setup to include these.'),
    ).toBeVisible();
  });
});
