/**
 * Reads a plan's drawing on this computer: the rooms, the openings between them and the windows,
 * from the image itself. Rooms are not named or classified; Magic Plan plans each by its size and
 * shape. Nothing leaves the browser.
 */
import { readFloorPlan, toGray, type FloorReading, type Plan } from '@maxsen/domain';
import { fileUrl } from '@/lib/files';
import { loadImage } from '@/lib/images';

/** Long edge the drawing is read at: enough for 8–10 px walls on a typical plan. */
const READ_LONG_EDGE = 1600;

/** Reads the plan's background drawing in the browser. */
export async function readPlanLocally(plan: Plan): Promise<FloorReading> {
  const img = await loadImage(fileUrl(plan.background.fileId));
  // Let the progress message paint before the (synchronous) image work.
  await new Promise((r) => setTimeout(r, 30));
  const k = Math.min(1, READ_LONG_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return readFloorPlan(toGray(rgba.data, canvas.width, canvas.height));
}
