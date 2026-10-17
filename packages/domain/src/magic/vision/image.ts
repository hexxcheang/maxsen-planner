/**
 * Small, dependency-free image routines for reading floor plans: thresholding, morphological
 * opening and connected components on binary masks. Everything works on flat typed arrays so it
 * runs the same in the browser and in tests.
 */

export interface GrayImage {
  width: number;
  height: number;
  /** Luminance 0 (black) – 255 (white), row-major. */
  data: Uint8Array | Uint8ClampedArray;
}

/** A binary mask: 1 = set. */
export type Mask = Uint8Array;

/** Otsu's threshold over the luminance histogram. */
export function otsuThreshold(img: GrayImage): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of img.data) hist[v]!++;
  const total = img.data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Pixels darker than the threshold. */
export function darkMask(img: GrayImage, threshold = Math.min(otsuThreshold(img), 170)): Mask {
  const m = new Uint8Array(img.width * img.height);
  for (let i = 0; i < m.length; i++) m[i] = img.data[i]! < threshold ? 1 : 0;
  return m;
}

/** Summed-area table of a mask, (w+1)×(h+1). */
function integral(mask: Mask, w: number, h: number): Int32Array {
  const s = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += mask[y * w + x]!;
      s[(y + 1) * (w + 1) + x + 1] = s[y * (w + 1) + x + 1]! + row;
    }
  }
  return s;
}

function boxSum(s: Int32Array, w: number, x0: number, y0: number, x1: number, y1: number): number {
  const W = w + 1;
  return s[y1 * W + x1]! - s[y0 * W + x1]! - s[y1 * W + x0]! + s[y0 * W + x0]!;
}

/** Morphological opening with a k×k square: keeps only strokes at least k pixels thick. */
export function open(mask: Mask, w: number, h: number, k: number): Mask {
  const s = integral(mask, w, h);
  const eroded = new Uint8Array(w * h);
  const r0 = Math.floor((k - 1) / 2);
  const r1 = k - 1 - r0;
  for (let y = r0; y < h - r1; y++) {
    for (let x = r0; x < w - r1; x++) {
      if (boxSum(s, w, x - r0, y - r0, x + r1 + 1, y + r1 + 1) === k * k) eroded[y * w + x] = 1;
    }
  }
  const e = integral(eroded, w, h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r1);
    const yb = Math.min(h, y + r0 + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r1);
      const xb = Math.min(w, x + r0 + 1);
      if (boxSum(e, w, xa, ya, xb, yb) > 0) out[y * w + x] = 1;
    }
  }
  return out;
}

/** Count of set pixels inside an axis-aligned box (clipped to the image). */
export function countIn(
  mask: Mask,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
  const xb = Math.min(w, Math.ceil(Math.max(x0, x1)));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
  const yb = Math.min(h, Math.ceil(Math.max(y0, y1)));
  let n = 0;
  for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) n += mask[y * w + x]!;
  return n;
}

export interface Component {
  label: number;
  area: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  touchesBorder: boolean;
}

/**
 * Labels 4-connected components of pixels where `value` matches. Returns the label image (0 = not
 * part of any component) and per-component stats (index = label − 1).
 */
export function components(
  mask: Mask,
  w: number,
  h: number,
  value: 0 | 1,
): { labels: Int32Array; stats: Component[] } {
  const labels = new Int32Array(w * h);
  const stats: Component[] = [];
  const stack = new Int32Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (labels[start] !== 0 || mask[start] !== value) continue;
    const label = stats.length + 1;
    const c: Component = { label, area: 0, x0: w, y0: h, x1: 0, y1: 0, touchesBorder: false };
    let top = 0;
    stack[top++] = start;
    labels[start] = label;
    while (top > 0) {
      const i = stack[--top]!;
      const x = i % w;
      const y = (i - x) / w;
      c.area++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) c.touchesBorder = true;
      if (x > 0 && labels[i - 1] === 0 && mask[i - 1] === value) {
        labels[i - 1] = label;
        stack[top++] = i - 1;
      }
      if (x < w - 1 && labels[i + 1] === 0 && mask[i + 1] === value) {
        labels[i + 1] = label;
        stack[top++] = i + 1;
      }
      if (y > 0 && labels[i - w] === 0 && mask[i - w] === value) {
        labels[i - w] = label;
        stack[top++] = i - w;
      }
      if (y < h - 1 && labels[i + w] === 0 && mask[i + w] === value) {
        labels[i + w] = label;
        stack[top++] = i + w;
      }
    }
    stats.push(c);
  }
  return { labels, stats };
}

/** The most common run length of set pixels (horizontal and vertical) within [min, max]. */
export function dominantRunLength(
  mask: Mask,
  w: number,
  h: number,
  min: number,
  max: number,
): number | null {
  const hist = new Array<number>(max + 1).fill(0);
  const tally = (len: number) => {
    if (len >= min && len <= max) hist[len]!++;
  };
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) run++;
      else if (run) {
        tally(run);
        run = 0;
      }
    }
    tally(run);
  }
  for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = 0; y < h; y++) {
      if (mask[y * w + x]) run++;
      else if (run) {
        tally(run);
        run = 0;
      }
    }
    tally(run);
  }
  let best = -1;
  let at: number | null = null;
  for (let i = min; i <= max; i++) {
    // Smooth over ±1 px so anti-aliasing doesn't split the peak.
    const v = 2 * ((hist[i - 1] ?? 0) + hist[i]! + (hist[i + 1] ?? 0)) + hist[i]!;
    if (v > best) {
      best = v;
      at = i;
    }
  }
  return best > 0 ? at : null;
}

/** Luminance of an RGBA buffer (canvas ImageData), with transparent pixels read as white paper. */
export function toGray(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): GrayImage {
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    const a = rgba[j + 3]! / 255;
    const lum = 0.299 * rgba[j]! + 0.587 * rgba[j + 1]! + 0.114 * rgba[j + 2]!;
    data[i] = Math.round(lum * a + 255 * (1 - a));
  }
  return { width, height, data };
}

/** Pixels lighter than paper but darker than `threshold`: pen lines of any weight. */
export function inkMask(img: GrayImage, threshold = 192): Mask {
  return darkMask(img, threshold);
}
