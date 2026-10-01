import { test } from '@playwright/test';
import { shoot, signIn, unlockAdmin } from './helpers';

test.describe('screens', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('dashboard', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'dashboard', '/');
  });

  test('new-project', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'new-project', '/projects/new?template=tpl_hdb_4room');
  });

  test('setup', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'setup', '/projects/proj_sample_lim/setup');
  });

  test('review', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'review', '/projects/proj_sample_tan/review');
  });

  test('exports', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'exports', '/projects/proj_sample_lim/exports');
  });

  test('catalogue', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'catalogue', '/catalogue');
  });

  test('templates', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'templates', '/templates');
  });

  test('admin', async ({ page }, testInfo) => {
    await unlockAdmin(page);
    await shoot(page, testInfo, 'admin', '/admin');
    await page.getByRole('tab', { name: 'Icon styles' }).click();
    await page.screenshot({
      path: `test-results/screens/admin-icons-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test('help', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'help', '/help');
  });

  test('styleguide renders', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'styleguide', '/dev/styleguide');
  });
});
