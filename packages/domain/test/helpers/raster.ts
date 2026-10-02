/**
 * A tiny rasterizer that paints the sample drawings the way `generate-sample-drawings.ts` draws
 * them as SVG (8 px walls, door gaps with a leaf and dashed swing, glazed windows, grey furniture
 * and text, title block, north arrow), so the floor-plan reader can be tested without a browser.
 */
import type { Drawing } from '../../src/sample/drawings.ts';
import type { GrayImage } from '../../src/magic/vision/image.ts';

const WALL = 8;
const INK = 26;
const GREY = 138;
const LIGHT = 201;

class Canvas {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height).fill(255);
  }

  /** Paints every pixel whose centre passes `inside`, within the given bounds. */
  paint(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    lum: number,
    inside: (x: number, y: number) => boolean,
  ) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.height, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.width, Math.ceil(x1)); x++) {
        if (inside(x + 0.5, y + 0.5)) this.data[y * this.width + x] = lum;
      }
    }
  }

  rect(x: number, y: number, w: number, h: number, lum: number) {
    this.paint(x, y, x + w, y + h, lum, (px, py) => px >= x && px < x + w && py >= y && py < y + h);
  }

  strokeRect(x: number, y: number, w: number, h: number, sw: number, lum: number) {
    const s = sw / 2;
    this.rect(x - s, y - s, w + sw, sw, lum);
    this.rect(x - s, y + h - s, w + sw, sw, lum);
    this.rect(x - s, y - s, sw, h + sw, lum);
    this.rect(x + w - s, y - s, sw, h + sw, lum);
  }

  line(x1: number, y1: number, x2: number, y2: number, sw: number, lum: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy || 1;
    const r = sw / 2;
    this.paint(
      Math.min(x1, x2) - r,
      Math.min(y1, y2) - r,
      Math.max(x1, x2) + r,
      Math.max(y1, y2) + r,
      lum,
      (px, py) => {
        const t = ((px - x1) * dx + (py - y1) * dy) / len2;
        if (t < 0 || t > 1) return false;
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) <= r;
      },
    );
  }

  /** A polyline dashed `on`/`off` along its length. */
  dashed(points: [number, number][], sw: number, lum: number, on: number, off: number) {
    let phase = 0;
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1]!;
      const [bx, by] = points[i]!;
      const len = Math.hypot(bx - ax, by - ay);
      let s = 0;
      while (s < len) {
        const inDash = phase < on;
        const step = Math.min(len - s, inDash ? on - phase : on + off - phase);
        if (inDash) {
          const f0 = s / len;
          const f1 = (s + step) / len;
          this.line(
            ax + (bx - ax) * f0,
            ay + (by - ay) * f0,
            ax + (bx - ax) * f1,
            ay + (by - ay) * f1,
            sw,
            lum,
          );
        }
        s += step;
        phase = (phase + step) % (on + off);
      }
    }
  }

  /** Stand-in for a line of text: a short stroke pair per character. */
  text(s: string, cx: number, baseline: number, size: number, lum: number, sw = 2.5) {
    const cw = size * 0.58;
    const x0 = cx - (s.length * cw) / 2;
    for (const [i, ch] of [...s].entries()) {
      if (ch === ' ') continue;
      const x = x0 + i * cw;
      this.line(x + cw * 0.2, baseline - size * 0.72, x + cw * 0.2, baseline, sw, lum);
      this.line(x + cw * 0.7, baseline - size * 0.72, x + cw * 0.7, baseline, sw, lum);
      this.line(
        x + cw * 0.2,
        baseline - size * 0.36,
        x + cw * 0.7,
        baseline - size * 0.36,
        sw * 0.8,
        lum,
      );
    }
  }
}

export interface Rendered {
  image: GrayImage;
}

/** Paints a sample drawing at `scale` × its 1400 × 1000 design size. */
export function rasterize(d: Drawing, scale = 1): Rendered {
  const W = Math.round(1400 * scale);
  const H = Math.round(1000 * scale);
  const c = new Canvas(W, H);
  const s = (n: number) => n * scale;

  for (const f of d.furniture ?? []) c.strokeRect(s(f.x), s(f.y), s(f.w), s(f.h), s(2), LIGHT);
  for (const r of d.rooms) {
    c.strokeRect(s(r.x), s(r.y), s(r.w), s(r.h), s(WALL), INK);
    const cx = r.lx ?? r.x + r.w / 2;
    const cy = r.ly ?? r.y + r.h / 2;
    if (r.label) {
      c.text(r.label, s(cx), s(cy + (r.sub ? 0 : 8)), s(26), GREY, s(2.5));
    }
    if (r.sub) {
      c.text(r.sub, s(cx), s(cy + 24), s(18), LIGHT, s(2));
    }
  }
  for (const w of d.windows) {
    const horizontal = w.y1 === w.y2;
    if (horizontal) {
      c.rect(
        s(Math.min(w.x1, w.x2)),
        s(w.y1 - WALL / 2 - 1),
        s(Math.abs(w.x2 - w.x1)),
        s(WALL + 2),
        255,
      );
      c.line(s(w.x1), s(w.y1 - 3), s(w.x2), s(w.y2 - 3), s(2), INK);
      c.line(s(w.x1), s(w.y1 + 3), s(w.x2), s(w.y2 + 3), s(2), INK);
    } else {
      c.rect(
        s(w.x1 - WALL / 2 - 1),
        s(Math.min(w.y1, w.y2)),
        s(WALL + 2),
        s(Math.abs(w.y2 - w.y1)),
        255,
      );
      c.line(s(w.x1 - 3), s(w.y1), s(w.x2 - 3), s(w.y2), s(2), INK);
      c.line(s(w.x1 + 3), s(w.y1), s(w.x2 + 3), s(w.y2), s(2), INK);
    }
  }
  for (const door of d.doors) {
    const endX = door.x + door.ax * door.size;
    const endY = door.y + door.ay * door.size;
    const gapW = Math.abs(door.ax) * door.size + Math.abs(door.px) * (WALL + 4);
    const gapH = Math.abs(door.ay) * door.size + Math.abs(door.py) * (WALL + 4);
    const gapX = Math.min(door.x, endX) - (door.ax === 0 ? (WALL + 4) / 2 : 0);
    const gapY = Math.min(door.y, endY) - (door.ay === 0 ? (WALL + 4) / 2 : 0);
    c.rect(s(gapX), s(gapY), s(gapW), s(gapH), 255);
    c.line(
      s(door.x),
      s(door.y),
      s(door.x + door.px * door.size),
      s(door.y + door.py * door.size),
      s(3),
      GREY,
    );
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const t = (i / 12) * (Math.PI / 2);
      pts.push([
        s(door.x + (door.ax * Math.cos(t) + door.px * Math.sin(t)) * door.size),
        s(door.y + (door.ay * Math.cos(t) + door.py * Math.sin(t)) * door.size),
      ]);
    }
    c.dashed(pts, s(1.5), GREY, s(4), s(3));
  }

  // Title block and north arrow.
  c.strokeRect(s(960), s(918), s(340), s(66), s(2), INK);
  c.line(s(960), s(950), s(1300), s(950), s(1), INK);
  c.text(d.title, s(1130), s(940), s(15), INK, s(2));
  c.text('SAMPLE DRAWING — NOT TO SCALE', s(1060), s(972), s(12), GREY, s(1.5));
  c.paint(
    s(1220),
    s(30),
    s(1280),
    s(90),
    INK,
    (px, py) => Math.abs(Math.hypot(px - s(1250), py - s(60)) - s(22)) <= s(1),
  );
  const tri: [number, number][] = [
    [1250, 42],
    [1258, 70],
    [1250, 64],
    [1242, 70],
  ].map(([x, y]) => [s(x!), s(y!)]);
  c.paint(s(1240), s(40), s(1260), s(72), INK, (px, py) => inPolygon(px, py, tri));

  return { image: { width: W, height: H, data: c.data } };
}

function inPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
