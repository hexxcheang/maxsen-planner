import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { signIn, unlockAdmin } from './helpers';

// Stand-in artwork: soft architectural lines on a warm ground.
const ART = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<rect width="1600" height="1000" fill="#c9b48a"/>
<g stroke="#5d4a26" stroke-width="3" fill="none" opacity="0.7">
<path d="M0 700 L600 300 L1600 500"/><path d="M200 1000 L800 200 L1500 0"/>
<rect x="900" y="350" width="420" height="300"/><circle cx="420" cy="420" r="160"/>
</g></svg>`;

test.describe('proposal exports', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await unlockAdmin(page);
  });

  test('the proposal background from Admin › Branding goes behind the export covers', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'File generation is viewport-independent');
    test.setTimeout(90_000);
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Branding' }).click();
    await page.getByLabel('Upload background').setInputFiles({
      name: 'proposal.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(ART),
    });
    await expect(page.getByAltText('Current proposal background')).toBeVisible();
    await page.getByRole('button', { name: 'Save branding' }).click();

    await page.goto('/projects/proj_sample_lim/exports');
    for (const name of ['Marked floor plan', 'Product description']) {
      const panel = page.getByRole('region', { name });
      await panel.getByRole('button', { name: /^Generate/ }).click();
      const link = panel.getByRole('link', { name: 'Download' });
      await expect(link).toBeVisible({ timeout: 60_000 });
      const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
      const path = testInfo.outputPath(download.suggestedFilename());
      await download.saveAs(path);
      const pdf = (await readFile(path)).toString('latin1');
      // The artwork is drawn as a JPEG image on the cover.
      expect(pdf).toContain('/DCTDecode');
    }
  });
});
