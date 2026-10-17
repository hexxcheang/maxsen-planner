import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

/** A product photo drawn in the page: a white switch plate on grey. */
const photo = (page: Page) =>
  page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ddd';
    g.fillRect(0, 0, 400, 300);
    g.fillStyle = '#fff';
    g.fillRect(150, 100, 100, 100);
    return c.toDataURL('image/png').split(',')[1]!;
  });

test.describe('product sample', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('makes a picture of the product in a home', async ({ page }, testInfo) => {
    let sent: { image: string; mediaType: string; prompt: string } | null = null;
    await page.route('**/api/product-sample/status', (r) =>
      r.fulfill({ json: { configured: true, provider: 'gemini' } }),
    );
    await page.route('**/api/product-sample/render', async (r) => {
      sent = r.request().postDataJSON() as typeof sent;
      // The model's picture: here, the photo sent straight back.
      await r.fulfill({ json: { image: sent!.image, mediaType: 'image/jpeg' } });
    });
    await page.goto('/product-sample');
    await expect(page.getByRole('heading', { name: 'Product sample' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Make picture' })).toBeDisabled();

    await page.getByLabel('Product photo').setInputFiles({
      name: 'switch.png',
      mimeType: 'image/png',
      buffer: Buffer.from(await photo(page), 'base64'),
    });
    await expect(page.getByAltText('Your product photo')).toBeVisible();
    await page.getByLabel('Category').selectOption('smart-switches');
    const product = page.getByLabel('Product (optional)');
    const first = await product.locator('option').nth(1).textContent();
    await product.selectOption({ index: 1 });
    await page.getByLabel('Room').selectOption('master');
    await page.getByLabel('Interior style').selectOption('japandi');
    await page.getByRole('button', { name: 'Make picture' }).click();

    await expect(page.getByAltText('Product sample')).toBeVisible();
    expect(sent!.mediaType).toBe('image/jpeg');
    expect(sent!.prompt).toContain(`(${first!})`);
    expect(sent!.prompt).toContain('master bedroom');
    expect(sent!.prompt).toContain('Japandi');
    expect(sent!.prompt).toContain('beside a doorway');
    expect(sent!.prompt).toContain('Keep the product exactly as photographed');
    await page.screenshot({
      path: `test-results/screens/product-sample-${testInfo.project.name}.png`,
    });

    if (testInfo.project.name !== 'desktop') return;
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download JPG' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/ - Master bedroom\.jpg$/);
  });

  test('without an image model, explains the setup and offers the instructions', async ({
    page,
  }) => {
    await page.route('**/api/product-sample/status', (r) =>
      r.fulfill({ json: { configured: false, provider: null } }),
    );
    await page.goto('/product-sample');
    await expect(page.getByText('Set up picture making')).toBeVisible();
    await expect(page.getByText(/GEMINI_API_KEY=your-key/)).toBeVisible();
    await page.getByText('Instructions for the image model').click();
    await expect(page.getByRole('button', { name: 'Copy instructions' })).toBeVisible();
  });
});
