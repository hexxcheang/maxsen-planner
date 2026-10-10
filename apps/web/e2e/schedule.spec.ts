import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test.describe('project schedule', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('dates are picked from a calendar on the Projects page', async ({ page }, testInfo) => {
    // A fixed "today" so the calendar and the relative dates are predictable.
    await page.clock.setFixedTime(new Date('2026-10-05T10:00:00+08:00'));
    await page.goto('/');
    const schedule = page.getByRole('list', {
      name: 'Schedule for Tan Residence — Tampines 4-room',
    });

    // Site liaising: today, from the calendar's Today button.
    await schedule.getByRole('button', { name: /^Site liaising: no date yet/ }).click();
    const picker = page.getByRole('dialog', { name: 'Site liaising date' });
    await expect(picker.getByRole('gridcell', { name: 'Mon, 5 Oct 2026' })).toBeFocused();
    await picker.getByRole('button', { name: 'Today' }).click();
    await expect(schedule).toContainText('Mon, 5 Oct');
    await expect(schedule).toContainText('Today');

    // Installation: next month, picked with the keyboard.
    await schedule.getByRole('button', { name: /^Installation: no date yet/ }).click();
    const install = page.getByRole('dialog', { name: 'Installation date' });
    await install.getByRole('button', { name: 'Next month' }).click();
    await page.screenshot({
      path: `test-results/screens/schedule-calendar-${testInfo.project.name}.png`,
    });
    await install.getByRole('gridcell', { name: 'Mon, 9 Nov 2026' }).click();
    await expect(install).toBeHidden();
    await expect(
      schedule.getByRole('button', { name: /^Installation: Mon, 9 Nov 2026/ }),
    ).toBeVisible();
    await expect(schedule).toContainText('In 5 weeks');

    // Integration: a click, then arrow keys and Enter.
    await schedule.getByRole('button', { name: /^Integration: no date yet/ }).click();
    const integ = page.getByRole('dialog', { name: 'Integration date' });
    await expect(integ.getByRole('gridcell', { name: 'Mon, 5 Oct 2026' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(
      schedule.getByRole('button', { name: /^Integration: Tue, 13 Oct 2026/ }),
    ).toBeVisible();
    // Earlier than installation: flagged.
    await expect(schedule).toContainText('Before installation');

    // No lights for this project.
    await schedule.getByRole('button', { name: /^Lights delivery: no date yet/ }).click();
    await page.getByRole('button', { name: 'No lights to deliver' }).click();
    await expect(
      schedule.getByRole('button', { name: /^Lights delivery: not needed/ }),
    ).toBeVisible();

    await page.screenshot({ path: `test-results/screens/schedule-${testInfo.project.name}.png` });

    // Saved with the project.
    await page.reload();
    await expect(
      schedule.getByRole('button', { name: /^Installation: Mon, 9 Nov 2026/ }),
    ).toBeVisible();

    // Clearing a date.
    await schedule.getByRole('button', { name: /^Integration: Tue, 13 Oct/ }).click();
    await page.getByRole('button', { name: 'Clear date' }).click();
    await expect(schedule.getByRole('button', { name: /^Integration: no date yet/ })).toBeVisible();
  });
});
