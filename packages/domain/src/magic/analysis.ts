/**
 * What Magic Plan needs to know about a drawing: rooms, doors (with the side they swing into) and
 * windows. Coordinates are fractions (0–1) of the background image's width and height, so the same
 * analysis works at any size; the vision model returns this shape and the samples ship with it.
 */
import { z } from 'zod';

export const ROOM_TYPES = [
  'living',
  'dining',
  'living-dining',
  'family',
  'kitchen',
  'bedroom',
  'master-bedroom',
  'bathroom',
  'study',
  'corridor',
  'foyer',
  'staircase',
  'balcony',
  'utility',
  'store',
  'garage',
  'outdoor',
  'other',
] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

const frac = z.number().min(-0.05).max(1.05);
const point = z.object({ x: frac, y: frac });

export const floorAnalysisSchema = z.object({
  rooms: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string(),
        type: z.enum(ROOM_TYPES),
        /** Axis-aligned bounding box of the room's floor area. */
        x: frac,
        y: frac,
        w: z.number().positive().max(1.1),
        h: z.number().positive().max(1.1),
        /**
         * Set on an extra rectangle of an odd-shaped room (an L-shaped living room, say): the id of
         * the room it belongs to. It's planned as part of that room, not as a room of its own.
         */
        partOf: z.string().optional(),
      }),
    )
    .min(1),
  doors: z.array(
    z.object({
      id: z.string().min(1),
      /** Hinge end of the door opening. */
      hinge: point,
      /** Latch (handle) end of the door opening. */
      latch: point,
      /** Room the door leaf swings into, or null if it swings outside. */
      swingsInto: z.string().nullable(),
      /** Rooms on either side of the opening; null for the outside of the home. */
      sides: z.tuple([z.string().nullable(), z.string().nullable()]),
      isMainEntrance: z.boolean(),
    }),
  ),
  windows: z.array(
    z.object({
      id: z.string().min(1),
      start: point,
      end: point,
      roomId: z.string().nullable(),
    }),
  ),
  /** Real-world width of the whole image in metres, when it can be read or estimated; else null. */
  imageWidthMetres: z.number().positive().nullable(),
});

export type FloorAnalysis = z.infer<typeof floorAnalysisSchema>;
export type AnalysisRoom = FloorAnalysis['rooms'][number];
export type AnalysisDoor = FloorAnalysis['doors'][number];
export type AnalysisWindow = FloorAnalysis['windows'][number];
