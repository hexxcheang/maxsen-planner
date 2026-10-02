import { loadImage } from '@/lib/images';
import {
  toGray,
  windowReader,
  type DrawnWindow,
  type FoundWindow,
  FLAT_PRESETS,
  layoutFromAnalysis,
  newId,
  sample,
  type DrawnRoom,
  type Plan,
  type RoomLayout,
} from '@maxsen/domain';

export const drawn = (r: DrawnRoom) => r.w > 0 && r.h > 0;

export const blank = (type: DrawnRoom['type'], name: string): DrawnRoom => ({
  id: newId('room'),
  type,
  name,
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  door: null,
});

/** The rooms a preset lists, keeping anything already drawn for a room of the same name. */
export function applyPreset(layout: RoomLayout, presetId: string): RoomLayout {
  const preset = FLAT_PRESETS.find((p) => p.id === presetId)!;
  const keep = new Map(layout.rooms.map((r) => [r.name, r]));
  const listed = preset.rooms.map((r) => keep.get(r.name) ?? blank(r.type, r.name));
  // Rooms already drawn that the preset doesn't list stay too.
  const extra = layout.rooms.filter(
    (r) => drawn(r) && !preset.rooms.some((p) => p.name === r.name),
  );
  return { presetId, floorAreaM2: preset.floorAreaM2, rooms: [...listed, ...extra] };
}

/**
 * The rooms to start Magic Plan from: what was outlined last time, the built-in rooms of a sample
 * drawing, or the 4-room flat checklist with nothing drawn yet.
 */
export function startingLayout(plan: Plan): RoomLayout {
  if (plan.magicLayout) {
    // Windows the app once guessed by itself are dropped: they're marked by hand now.
    const windows = plan.magicLayout.windows?.filter((w) => w.marked);
    return { ...plan.magicLayout, windows };
  }
  const builtIn = sample.sampleAnalysisFor(plan.background.fileId);
  if (builtIn) return layoutFromAnalysis(builtIn, plan.background.width / plan.background.height);
  return applyPreset({ presetId: 'hdb-4', floorAreaM2: 93, rooms: [] }, 'hdb-4');
}

const readers = new Map<string, Promise<(x: number, y: number) => FoundWindow | null>>();

/** The drawing read once (on this computer), ready to find the window under each mark. */
function readerFor(imageUrl: string) {
  let reader = readers.get(imageUrl);
  if (!reader) {
    reader = loadImage(imageUrl).then((img) => {
      const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return windowReader(toGray(data.data, canvas.width, canvas.height));
    });
    reader.catch(() => readers.delete(imageUrl));
    readers.set(imageUrl, reader);
  }
  return reader;
}

/**
 * The window marked with an X at (x, y) on the drawing (fractions): the glazing line under the
 * mark, followed to its ends. `null` when there's no line there.
 */
export async function windowAt(
  imageUrl: string,
  x: number,
  y: number,
): Promise<DrawnWindow | null> {
  const found = (await readerFor(imageUrl))(x, y);
  return found && { id: newId('room'), ...found, marked: true };
}
