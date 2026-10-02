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
