import { test } from '@playwright/test';
import { shoot, signIn } from './helpers';

test.describe('screens', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('styleguide renders', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'styleguide', '/dev/styleguide');
  });
});
