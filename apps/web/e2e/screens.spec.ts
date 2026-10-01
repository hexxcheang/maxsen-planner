import { test } from '@playwright/test';
import { shoot, signIn } from './helpers';

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

  test('styleguide renders', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'styleguide', '/dev/styleguide');
  });
});
