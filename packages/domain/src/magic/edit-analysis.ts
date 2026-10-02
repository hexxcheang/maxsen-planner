/**
 * Corrections the user can make to a floor reading before Magic Plan places devices. Each returns
 * a new analysis and keeps doors and windows consistent with the rooms that remain.
 */
import type { FloorAnalysis, RoomType } from './analysis.ts';

export function renameRoom(a: FloorAnalysis, roomId: string, name: string): FloorAnalysis {
  return { ...a, rooms: a.rooms.map((r) => (r.id === roomId ? { ...r, name } : r)) };
}

export function retypeRoom(a: FloorAnalysis, roomId: string, type: RoomType): FloorAnalysis {
  return { ...a, rooms: a.rooms.map((r) => (r.id === roomId ? { ...r, type } : r)) };
}

/** Drops a room that isn't one (a shaft, a stray region); doors into it go too. */
export function removeRoom(a: FloorAnalysis, roomId: string): FloorAnalysis {
  if (a.rooms.length <= 1) return a;
  return {
    ...a,
    rooms: a.rooms.filter((r) => r.id !== roomId),
    doors: a.doors.filter((d) => !d.sides.includes(roomId)),
    windows: a.windows.map((w) => (w.roomId === roomId ? { ...w, roomId: null } : w)),
  };
}

export function removeDoor(a: FloorAnalysis, doorId: string): FloorAnalysis {
  return { ...a, doors: a.doors.filter((d) => d.id !== doorId) };
}

/** The door swings into the room on its other side instead. */
export function flipDoorSwing(a: FloorAnalysis, doorId: string): FloorAnalysis {
  return {
    ...a,
    doors: a.doors.map((d) =>
      d.id === doorId ? { ...d, swingsInto: d.sides[1], sides: [d.sides[1], d.sides[0]] } : d,
    ),
  };
}

/** The door is hinged at its other end (the switch goes beside the handle). */
export function swapDoorHinge(a: FloorAnalysis, doorId: string): FloorAnalysis {
  return {
    ...a,
    doors: a.doors.map((d) => (d.id === doorId ? { ...d, hinge: d.latch, latch: d.hinge } : d)),
  };
}

/** Makes one door the main entrance, or none with `null`. */
export function setMainEntrance(a: FloorAnalysis, doorId: string | null): FloorAnalysis {
  return { ...a, doors: a.doors.map((d) => ({ ...d, isMainEntrance: d.id === doorId })) };
}
