/**
 * Reads a floor-plan image with Claude and returns a validated `FloorAnalysis` (rooms, doors with
 * hinge/latch/swing, windows, scale). The placement itself is done by the domain's rule engine.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { floorAnalysisSchema, ROOM_TYPES, type FloorAnalysis } from '@maxsen/domain';

export interface AnalyseInput {
  /** Base64 image data without the data: prefix. */
  image: string;
  mediaType: 'image/png' | 'image/jpeg';
  /** Optional notes from the planner, e.g. "the TV wall is in the living room facing the balcony". */
  notes?: string;
}

export type Analyser = (input: AnalyseInput) => Promise<FloorAnalysis>;

export class AnalysisError extends Error {
  override name = 'AnalysisError';
}

/**
 * The shape requested from the model. It mirrors `floorAnalysisSchema` but avoids tuple and range
 * constraints that structured outputs can't express; the result is re-validated afterwards.
 */
const point = z.object({ x: z.number(), y: z.number() });
const wireSchema = z.object({
  rooms: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(ROOM_TYPES),
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    }),
  ),
  doors: z.array(
    z.object({
      id: z.string(),
      hinge: point,
      latch: point,
      swingsInto: z.string().nullable(),
      sides: z.array(z.string().nullable()),
      isMainEntrance: z.boolean(),
    }),
  ),
  windows: z.array(
    z.object({ id: z.string(), start: point, end: point, roomId: z.string().nullable() }),
  ),
  imageWidthMetres: z.number().nullable(),
});

const INSTRUCTIONS = `You are reading an architectural floor plan for a smart-home and lighting planner. Report the
plan's geometry precisely; another program places devices from your answer.

Coordinates: every x and y is a fraction of the image (0 = left/top edge, 1 = right/bottom edge).

Rooms
- Include every enclosed space: bedrooms, bathrooms, kitchens, living and dining areas, corridors and
  unlabelled walkways, foyers, stairs, stores, balconies, yards, porches, gardens.
- x, y, w, h is the room's floor-area bounding box, measured to the inside faces of its walls. For an
  L-shaped room give the box of its larger rectangle.
- Use the drawn label for "name" (or a sensible name for unlabelled spaces) and pick the closest
  "type". Use "living-dining" for a combined living and dining space, "master-bedroom" for the main
  bedroom, "bathroom" for any bath, WC or powder room, "outdoor" for gardens, porches and terraces.

Doors
- One entry per door opening. A door is drawn as a straight leaf line plus a quarter-circle swing arc.
- "hinge" is the end of the opening the leaf pivots on (the centre of the arc). "latch" is the other
  end of the opening, where the handle is. Both points lie on the wall line.
- "swingsInto" is the id of the room the arc is drawn in, or null if it swings outside the home.
- "sides" lists the two rooms the opening connects; use null for the outside of the home.
- Exactly one door should have "isMainEntrance": true: the front door into the home.
- Openings without a leaf (archways, open plan) are not doors; omit them.

Windows
- One entry per window, with its two ends on the wall line and the room it serves.

Scale
- "imageWidthMetres" is the real-world width of the whole image in metres. Read it from dimension
  strings or a scale bar if present. Otherwise estimate it from door openings (about 0.9 m for room
  doors and 1.0 m for the main door). Use null only if nothing allows an estimate.`;

/** Validates the model's answer and repairs small slips (ids that don't exist, out-of-range points). */
export function normaliseAnalysis(raw: z.infer<typeof wireSchema>): FloorAnalysis {
  const ids = new Set(raw.rooms.map((r) => r.id));
  const ref = (id: string | null | undefined) => (id && ids.has(id) ? id : null);
  const c = (n: number) => Math.min(1.05, Math.max(-0.05, n));
  const candidate = {
    rooms: raw.rooms
      .filter((r) => r.w > 0 && r.h > 0)
      .map((r) => ({ ...r, x: c(r.x), y: c(r.y), w: Math.min(1.1, r.w), h: Math.min(1.1, r.h) })),
    doors: raw.doors.map((d) => ({
      ...d,
      hinge: { x: c(d.hinge.x), y: c(d.hinge.y) },
      latch: { x: c(d.latch.x), y: c(d.latch.y) },
      swingsInto: ref(d.swingsInto),
      sides: [ref(d.sides[0]), ref(d.sides[1])] as [string | null, string | null],
    })),
    windows: raw.windows.map((w) => ({
      ...w,
      start: { x: c(w.start.x), y: c(w.start.y) },
      end: { x: c(w.end.x), y: c(w.end.y) },
      roomId: ref(w.roomId),
    })),
    imageWidthMetres:
      raw.imageWidthMetres && raw.imageWidthMetres > 0 ? raw.imageWidthMetres : null,
  };
  const result = floorAnalysisSchema.safeParse(candidate);
  if (!result.success)
    throw new AnalysisError(
      'The drawing could not be read reliably. Try a clearer or larger drawing.',
    );
  return result.data;
}

export function createAnalyser(client: Anthropic = new Anthropic()): Analyser {
  return async ({ image, mediaType, notes }) => {
    const stream = client.beta.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      // Fall back to another model if the request is declined, instead of failing outright.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: zodOutputFormat(wireSchema) },
      system: INSTRUCTIONS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            {
              type: 'text',
              text: notes?.trim()
                ? `Read this floor plan. Notes from the planner:\n${notes.trim()}`
                : 'Read this floor plan.',
            },
          ],
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === 'refusal')
      throw new AnalysisError('The drawing could not be analysed.');
    if (message.stop_reason === 'max_tokens')
      throw new AnalysisError('The drawing was too complex to read in one go.');
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AnalysisError('The drawing could not be read reliably. Try again.');
    }
    const wire = wireSchema.safeParse(json);
    if (!wire.success)
      throw new AnalysisError('The drawing could not be read reliably. Try again.');
    return normaliseAnalysis(wire.data);
  };
}
