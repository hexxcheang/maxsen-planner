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
    // The sample drawing comes with its rooms already outlined.
    await expect(dialog.getByText(/10 of 10 outlined/)).toBeVisible();
    await page.screenshot({
      path: `test-results/screens/magic-rooms-sample-${testInfo.project.name}.png`,
    });
    await dialog.getByRole('button', { name: 'Next', exact: true }).click();
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

  test('outlines the rooms of an uploaded drawing, then plans them', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.route('**/api/magic-plan/status', (route) =>
      route.fulfill({ json: { configured: false } }),
    );
    // The sample 4-room plan as a customer's PNG scan, used whole so drawing coordinates match.
    await uploadAndOpen(page, drawHdbPng, { lighting: true, wholePage: true });

    await page.getByRole('button', { name: 'Magic Plan' }).click();
    const dialog = page.getByRole('dialog', { name: 'Magic Plan' });
    await expect(dialog.getByRole('combobox', { name: 'Type of home' })).toHaveValue('hdb-4');
    await expect(dialog.getByText(/0 of 7 outlined/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();

    const canvas = dialog.getByTestId('room-canvas');
    const box = (await canvas.boundingBox())!;
    // Drawing units (1400 × 1000) to screen points.
    const P = (x: number, y: number) => ({
      x: box.x + (x / 1400) * box.width,
      y: box.y + (y / 1000) * box.height,
    });
    // Rooms are boxed one after another; the doors are marked afterwards, all at once.
    const doors: [number, number][] = [];
    const outline = async (
      name: string,
      [x, y, w, h]: [number, number, number, number],
      door: [number, number],
    ) => {
      await dialog.getByRole('button', { name: new RegExp(`^${name}:`) }).click();
      const a = P(x + 8, y + 8);
      const b = P(x + w - 8, y + h - 8);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 5 });
      await page.mouse.up();
      await expect(dialog.getByRole('button', { name: `${name}: Door not marked` })).toBeVisible();
      doors.push(door);
    };
    await outline('Master Bedroom', [880, 100, 420, 360], [882, 360]);
    await outline('Bedroom 2', [880, 460, 420, 220], [882, 540]);
    await outline('Bedroom 3', [720, 680, 580, 220], [810, 682]);
    await outline('Living / Dining', [100, 360, 620, 540], [305, 898]);
    // An odd-shaped room: select it again, press + and drag another area on to it, overlapping.
    await dialog.getByRole('button', { name: /^Living \/ Dining:/ }).click();
    await dialog.getByRole('button', { name: 'Add another area to the Living / Dining' }).click();
    await expect(
      dialog.getByText(/drag a box over the rest of the Living \/ Dining/),
    ).toBeVisible();
    const p1 = P(700, 380);
    const p2 = P(860, 640);
    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down();
    await page.mouse.move(p2.x, p2.y, { steps: 5 });
    await page.mouse.up();
    await expect(dialog.getByTestId('room-part')).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: /^Living \/ Dining:/ })).toContainText(
      '2 areas',
    );
    await page.screenshot({
      path: `test-results/screens/magic-room-part-${testInfo.project.name}.png`,
    });
    // Its door is kept; the area can be taken off again and put back.
    await dialog.getByRole('button', { name: 'Remove area 2 of the Living / Dining' }).click();
    await expect(dialog.getByTestId('room-part')).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Add another area to the Living / Dining' }).click();
    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down();
    await page.mouse.move(p2.x, p2.y, { steps: 5 });
    await page.mouse.up();
    await expect(dialog.getByTestId('room-part')).toHaveCount(1);
    await outline('Kitchen', [280, 100, 280, 260], [480, 358]);
    // The rest straight onto the drawing: each box outlines the next room in the list.
    const drawNext = async (
      name: string,
      [x, y, w, h]: [number, number, number, number],
      door: [number, number],
    ) => {
      await canvas.scrollIntoViewIfNeeded();
      const b = (await canvas.boundingBox())!;
      const Pn = (px: number, py: number) => ({
        x: b.x + (px / 1400) * b.width,
        y: b.y + (py / 1000) * b.height,
      });
      const a = Pn(x + 8, y + 8);
      const z = Pn(x + w - 8, y + h - 8);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(z.x, z.y, { steps: 5 });
      await page.mouse.up();
      await expect(dialog.getByRole('button', { name: `${name}: Door not marked` })).toBeVisible();
      doors.push(door);
    };
    await drawNext('Master Toilet', [1140, 100, 160, 200], [1142, 255]);
    await drawNext('Common Toilet', [720, 100, 160, 200], [795, 298]);
    // Tapping a box selects its room.
    const b3 = (await canvas.boundingBox())!;
    await page.mouse.click(b3.x + (1000 / 1400) * b3.width, b3.y + (560 / 1000) * b3.height);
    await expect(dialog.getByRole('button', { name: /^Bedroom 2:/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(dialog.getByText(/7 of 7 outlined/)).toBeVisible();

    // Then every door in one go: each tap goes to the room whose wall it's on.
    await expect(dialog.getByText('Doors (0 of 7)')).toBeVisible();
    await dialog.getByRole('button', { name: 'Mark doors' }).click();
    for (const [x, y] of doors) {
      await canvas.scrollIntoViewIfNeeded();
      const b = (await canvas.boundingBox())!;
      await page.mouse.click(b.x + (x / 1400) * b.width, b.y + (y / 1000) * b.height);
    }
    await expect(dialog.getByText('Doors (7 of 7)')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Master Toilet: Done' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Kitchen: Done' })).toBeVisible();
    // Tapping a door again takes it off; tapping its place puts it back.
    {
      const b = (await canvas.boundingBox())!;
      const k = { x: b.x + (480 / 1400) * b.width, y: b.y + (358 / 1000) * b.height };
      await page.mouse.click(k.x, k.y);
      await expect(dialog.getByText('Doors (6 of 7)')).toBeVisible();
      await page.mouse.click(k.x, k.y);
      await expect(dialog.getByText('Doors (7 of 7)')).toBeVisible();
    }
    await page.screenshot({
      path: `test-results/screens/magic-doors-${testInfo.project.name}.png`,
    });
    await dialog.getByRole('button', { name: 'Done marking doors' }).click();

    // Windows are marked by hand: an X on each window line finds the whole window.
    await expect(dialog.getByText('Windows (0)')).toBeVisible();
    await dialog.getByRole('button', { name: 'Mark windows' }).click();
    // Clicking may scroll the dialog: measure the drawing again.
    await canvas.scrollIntoViewIfNeeded();
    const box2 = (await canvas.boundingBox())!;
    const Q = (x: number, y: number) => ({
      x: box2.x + (x / 1400) * box2.width,
      y: box2.y + (y / 1000) * box2.height,
    });
    const tap = async (x: number, y: number) => {
      const q = Q(x, y);
      await page.mouse.click(q.x, q.y);
    };
    await tap(100, 650); // Living / Dining, west wall
    await expect(dialog.getByText('Windows (1)')).toBeVisible();
    await tap(1075, 900); // Bedroom 3, south wall
    await expect(dialog.getByText('Windows (2)')).toBeVisible();
    await tap(1300, 380); // Master Bedroom, east wall
    await expect(dialog.getByText('Windows (3)')).toBeVisible();
    // The window runs out to its ends, not just where the X is.
    const marks = dialog.getByTestId('window-mark');
    await expect(marks).toHaveCount(3);
    // Tapping an X again removes it; tapping the line again brings it back.
    await tap(100, 650);
    await expect(dialog.getByText('Windows (2)')).toBeVisible();
    await tap(100, 650);
    await expect(dialog.getByText('Windows (3)')).toBeVisible();
    // A tap away from any line says so.
    await tap(600, 620);
    await expect(dialog.getByRole('alert')).toContainText('No window line there');
    // Or drag along a window to draw it.
    const w1 = Q(1300, 510);
    const w2 = Q(1300, 630);
    await page.mouse.move(w1.x, w1.y);
    await page.mouse.down();
    await page.mouse.move(w2.x, w2.y, { steps: 4 });
    await page.mouse.up();
    await expect(dialog.getByText('Windows (4)')).toBeVisible();
    await dialog.getByRole('button', { name: 'Done marking windows' }).click();
    await page.screenshot({
      path: `test-results/screens/magic-rooms-drawn-${testInfo.project.name}.png`,
    });

    await dialog.getByRole('button', { name: 'Next', exact: true }).click();
    await dialog.getByRole('button', { name: 'Create Magic Plan' }).click();
    await expect(dialog.getByText(/Found 7 rooms/)).toBeVisible();
    await dialog.getByRole('button', { name: /Place \d+ items/ }).click();
    await expect(page.getByText(/Magic Plan placed \d+ items/)).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `test-results/screens/magic-drawn-smart-home-${testInfo.project.name}.png`,
    });
    await page.getByRole('radio', { name: 'Lighting' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `test-results/screens/magic-drawn-lighting-${testInfo.project.name}.png`,
    });

    // The outlines are kept for next time.
    await page.getByRole('button', { name: 'Magic Plan' }).click();
    await expect(dialog.getByText(/7 of 7 outlined/)).toBeVisible();
  });

  test('a tap outlines a room with its door; or skip and find them all', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.route('**/api/magic-plan/status', (route) =>
      route.fulfill({ json: { configured: false } }),
    );
    await uploadAndOpen(page, drawHdbPng, { wholePage: true });
    await page.getByRole('button', { name: 'Magic Plan' }).click();
    const dialog = page.getByRole('dialog', { name: 'Magic Plan' });
    await expect(
      dialog.getByText('Tap inside the Master Bedroom (or drag a box over it).'),
    ).toBeVisible();
    const canvas = dialog.getByTestId('room-canvas');
    const tap = async (x: number, y: number) => {
      await canvas.scrollIntoViewIfNeeded();
      const b = (await canvas.boundingBox())!;
      await page.mouse.click(b.x + (x / 1400) * b.width, b.y + (y / 1000) * b.height);
    };

    // One tap each: the room's walls are followed (the master bedroom wraps round its bathroom,
    // so it gets two areas) and its door is found, then on to the next room.
    await tap(1000, 300);
    await expect(dialog.getByRole('button', { name: 'Master Bedroom: Done' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Master Bedroom:/ })).toContainText('2 areas');
    await expect(
      dialog.getByText(
        'The Master Bedroom is outlined. Tap inside the Bedroom 2 next. Odd shape? Press +.',
      ),
    ).toBeVisible();
    await tap(1090, 570);
    await expect(dialog.getByRole('button', { name: 'Bedroom 2: Done' })).toBeVisible();
    // Tapped the wrong room for the list? Rename it from its label on the drawing.
    await tap(400, 600); // the living room, while Bedroom 3 is next
    await expect(dialog.getByRole('button', { name: 'Bedroom 3: Done' })).toBeVisible();
    await tap(400, 600);
    await dialog
      .getByRole('combobox', { name: 'Rename the Bedroom 3' })
      .selectOption('Living / Dining');
    await expect(dialog.getByRole('button', { name: 'Living / Dining: Done' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Bedroom 3: Not outlined' })).toBeVisible();
    await expect(dialog.getByText(/3 of 7 outlined/)).toBeVisible();
    await page.screenshot({
      path: `test-results/screens/magic-tap-rooms-${testInfo.project.name}.png`,
    });

    // A tap outside the home finds no walls, and says so.
    await tap(40, 40);
    await expect(dialog.getByRole('alert')).toContainText('Couldn’t find closed walls');

    // Find the rest at once: rooms not outlined yet are replaced by the rooms found.
    await dialog.getByRole('button', { name: 'Find all rooms' }).click();
    await expect(dialog.getByText(/10 of 10 outlined/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Living / Dining: Done' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Next', exact: true }).click();
    await dialog.getByRole('button', { name: 'Create Magic Plan' }).click();
    await expect(dialog.getByText(/Found 10 rooms/)).toBeVisible();

    // Or skip outlining altogether on a fresh drawing.
    await uploadAndOpen(page, drawHdbPng, { wholePage: true });
    await page.getByRole('button', { name: 'Magic Plan' }).click();
    await dialog.getByRole('button', { name: 'Skip: find rooms for me' }).click();
    await dialog.getByRole('button', { name: 'Create Magic Plan' }).click();
    await expect(dialog.getByText(/Found 10 rooms/)).toBeVisible();
    await dialog.getByRole('button', { name: /Place \d+ items/ }).click();
    await expect(page.getByText(/Magic Plan placed \d+ items/)).toBeVisible();
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
  { lighting = false, wholePage = false }: { lighting?: boolean; wholePage?: boolean } = {},
) {
  await createProjectWithUpload(page, drawPng);
  const card = page.getByRole('region', { name: 'Smart Home Plan' });
  await card.getByRole('button', { name: 'Choose a drawing' }).click();
  await page
    .getByRole('dialog')
    .getByRole('radio', { name: /plan.png, page 1/ })
    .click();
  if (wholePage) {
    await expect(page.getByRole('dialog').getByRole('group', { name: 'Crop' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Whole page' }).click();
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Use this drawing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  if (lighting) {
    // The Lighting Plan reuses the Smart Home Plan's drawing, cropped the same.
    await page
      .getByRole('region', { name: 'Lighting Plan' })
      .getByRole('button', { name: 'Use the Smart Home Plan’s drawing' })
      .click();
    await expect(
      page
        .getByRole('region', { name: 'Lighting Plan' })
        .getByRole('link', { name: 'Open in planner' }),
    ).toBeVisible();
  }
  await page
    .getByRole('region', { name: 'Smart Home Plan' })
    .getByRole('link', { name: 'Open in planner' })
    .click();
}
