import type { CategoryId, Pt, Scene } from '@maxsen/domain';

/** Lights that line up with each other as they're placed or dragged. */
export const ALIGNED_LIGHTS: CategoryId[] = ['downlights', 'surface-lights'];
/** How close (screen pixels) a light must come before it snaps into line. */
export const SNAP_PX = 8;

/** Where the lights on the plan are, other than those in `except`. */
export function lightSpots(scene: Scene, except: Set<string> = new Set()): Pt[] {
  return scene.items.flatMap((i) =>
    i.type === 'marker' && ALIGNED_LIGHTS.includes(i.categoryId) && !except.has(i.elementId)
      ? [{ x: i.x, y: i.y }]
      : [],
  );
}
