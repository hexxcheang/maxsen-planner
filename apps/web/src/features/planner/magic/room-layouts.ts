import {
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
  if (plan.magicLayout) return plan.magicLayout;
  const builtIn = sample.sampleAnalysisFor(plan.background.fileId);
  if (builtIn) return layoutFromAnalysis(builtIn, plan.background.width / plan.background.height);
  return applyPreset({ presetId: 'hdb-4', floorAreaM2: 93, rooms: [] }, 'hdb-4');
}
