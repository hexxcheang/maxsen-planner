import { describe, expect, it } from 'vitest';
import { dragCrop } from '../crop-math';

const c = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };

describe('dragCrop', () => {
  it('moves the box without leaving the page', () => {
    const moved = dragCrop(c, 'move', 0.1, -0.1);
    expect(moved.x).toBeCloseTo(0.3);
    expect(moved.y).toBeCloseTo(0.1);
    expect(dragCrop(c, 'move', 1, 1)).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  });

  it('resizes from a corner and keeps a minimum size', () => {
    const r = dragCrop(c, 'se', 0.1, 0.1);
    expect(r.w).toBeCloseTo(0.6);
    expect(r.h).toBeCloseTo(0.6);
    const tiny = dragCrop(c, 'nw', 0.9, 0.9);
    expect(tiny.w).toBeCloseTo(0.08);
    expect(tiny.h).toBeCloseTo(0.08);
  });

  it('moves only the dragged edge', () => {
    const r = dragCrop(c, 'w', -0.1, 0.3);
    expect(r.x).toBeCloseTo(0.1);
    expect(r.w).toBeCloseTo(0.6);
    expect(r.y).toBeCloseTo(0.2);
    expect(r.h).toBeCloseTo(0.5);
  });
});
