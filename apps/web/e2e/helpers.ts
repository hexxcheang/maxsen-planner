import type { Page, TestInfo } from '@playwright/test';

/** Signs in by setting the Phase A session flag before the app boots. */
export async function signIn(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('maxsen.session', '1');
  });
}

export async function unlockAdmin(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('maxsen.admin', '1');
  });
}

/** Navigates, waits for the screen to mark itself ready, and saves a screenshot for review. */
export async function shoot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  url: string,
  opts: { fullPage?: boolean } = {},
) {
  await page.goto(url);
  await page.locator('[data-screen-ready]').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  const fullPage = opts.fullPage ?? true;
  if (fullPage) {
    // The shell scrolls inside <main>; let the document grow so the whole screen is captured.
    await page.addStyleTag({
      content:
        '#app-shell{height:auto!important;overflow:visible!important;min-height:100dvh}#main{overflow:visible!important}',
    });
  }
  await page.screenshot({
    path: `test-results/screens/${name}-${testInfo.project.name}.png`,
    fullPage,
  });
}
