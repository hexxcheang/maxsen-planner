import { expect, test } from '@playwright/test';
import { shoot, signIn, unlockAdmin } from './helpers';

test.describe('signed out', () => {
  test('login', async ({ page }, testInfo) => {
    await shoot(page, testInfo, 'login', '/login', { fullPage: false });
  });
});

test.describe('screens', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  const SCREENS: [name: string, url: string, fullPage?: boolean][] = [
    ['dashboard', '/'],
    ['dashboard-empty', '/?sample=empty'],
    ['dashboard-loading', '/?sample=loading'],
    ['new-project', '/projects/new?template=tpl_hdb_4room'],
    ['setup', '/projects/proj_sample_lim/setup'],
    ['planner-smart-home', '/projects/proj_sample_lim/plan?level=lvl_lim_1&type=smart-home', false],
    ['planner-lighting', '/projects/proj_sample_tan/plan?level=lvl_tan_1&type=lighting', false],
    ['review', '/projects/proj_sample_tan/review'],
    ['exports', '/projects/proj_sample_lim/exports'],
    ['catalogue', '/catalogue'],
    ['templates', '/templates'],
    ['help', '/help'],
    ['styleguide', '/dev/styleguide'],
    ['not-found', '/no-such-page'],
  ];

  for (const [name, url, fullPage] of SCREENS) {
    test(name, async ({ page }, testInfo) => {
      await shoot(page, testInfo, name, url, { fullPage });
    });
  }

  test('admin', async ({ page }, testInfo) => {
    await unlockAdmin(page);
    await shoot(page, testInfo, 'admin', '/admin');
    await page.getByRole('tab', { name: 'Icon styles' }).click();
    await page.screenshot({
      path: `test-results/screens/admin-icons-${testInfo.project.name}.png`,
      fullPage: true,
    });
    await page.getByRole('tab', { name: 'Favourites' }).click();
    await page.screenshot({
      path: `test-results/screens/admin-favourites-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });

  test('empty states render with primary action', async ({ page }) => {
    await page.goto('/?sample=empty');
    await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'New project' })).toBeVisible();

    await page.goto('/catalogue?sample=empty');
    await expect(page.getByRole('heading', { name: 'The catalogue is empty' })).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('button', { name: 'Add product' }).first(),
    ).toBeVisible();

    await page.goto('/templates?sample=empty');
    await expect(page.getByRole('heading', { name: 'No templates yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start a blank project' })).toBeVisible();
  });

  test('keyboard focus is visible on the first control', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-screen-ready]').waitFor();
    await page.keyboard.press('Tab');
    const outline = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? getComputedStyle(el).outlineStyle : 'none';
    });
    expect(outline).toBe('solid');
  });
});
