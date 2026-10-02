/**
 * Browser-side image work: turning uploads (PDF pages, JPG, PNG) into page images and thumbnails,
 * and rotating a page into a plan background. Long edges are capped to keep iPad memory in check.
 */
import { suggestCrop, toGray, type CropRect, type Rotation } from '@maxsen/domain';

const PAGE_LONG_EDGE = 3000;
const THUMB_LONG_EDGE = 360;

export interface RasterPage {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
      type,
      quality,
    ),
  );
}

function fit(w: number, h: number, longEdge: number) {
  const k = Math.min(1, longEdge / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image ${url}`));
    img.src = url;
  });
}

async function fromDrawable(source: CanvasImageSource, w: number, h: number): Promise<RasterPage> {
  const size = fit(w, h, PAGE_LONG_EDGE);
  const page = document.createElement('canvas');
  page.width = size.width;
  page.height = size.height;
  const ctx = page.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.drawImage(source, 0, 0, size.width, size.height);
  const t = fit(w, h, THUMB_LONG_EDGE);
  const thumb = document.createElement('canvas');
  thumb.width = t.width;
  thumb.height = t.height;
  thumb.getContext('2d')!.drawImage(page, 0, 0, t.width, t.height);
  return {
    blob: await canvasToBlob(page),
    thumb: await canvasToBlob(thumb, 'image/jpeg', 0.85),
    width: size.width,
    height: size.height,
  };
}

export async function rasterizeImage(file: File): Promise<RasterPage> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return await fromDrawable(img, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Renders each PDF page to an image, one page at a time. */
export async function rasterizePdf(
  file: File,
  onPage?: (done: number, total: number) => void,
): Promise<RasterPage[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: RasterPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = PAGE_LONG_EDGE / Math.max(base.width, base.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    pages.push(await fromDrawable(canvas, canvas.width, canvas.height));
    page.cleanup();
    onPage?.(i, doc.numPages);
  }
  await doc.destroy();
  return pages;
}

/** Draws a page turned clockwise by 0/90/180/270 degrees, scaled by `k`, onto a new canvas. */
function rotatedCanvas(img: HTMLImageElement, rotation: Rotation, k = 1): HTMLCanvasElement {
  const w = (img.naturalWidth || 1400) * k;
  const h = (img.naturalHeight || 1000) * k;
  const quarter = rotation === 90 || rotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(quarter ? h : w));
  canvas.height = Math.max(1, Math.round(quarter ? w : h));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return canvas;
}

/**
 * Turns a page image clockwise by 0/90/180/270 degrees, then crops it to `crop` (fractions of the
 * turned page), into a new PNG.
 */
export async function rotateImage(
  url: string,
  rotation: Rotation,
  crop: CropRect = { x: 0, y: 0, w: 1, h: 1 },
): Promise<{ blob: Blob; width: number; height: number }> {
  const turned = rotatedCanvas(await loadImage(url), rotation);
  const sx = Math.round(crop.x * turned.width);
  const sy = Math.round(crop.y * turned.height);
  const sw = Math.max(1, Math.round(crop.w * turned.width));
  const sh = Math.max(1, Math.round(crop.h * turned.height));
  if (sx === 0 && sy === 0 && sw === turned.width && sh === turned.height) {
    return { blob: await canvasToBlob(turned), width: turned.width, height: turned.height };
  }
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext('2d')!.drawImage(turned, sx, sy, sw, sh, 0, 0, sw, sh);
  return { blob: await canvasToBlob(canvas), width: sw, height: sh };
}

/**
 * A small preview of a page turned by `rotation`, plus a suggested crop to just the floor plan
 * (worked out on this computer).
 */
export async function previewForCrop(
  url: string,
  rotation: Rotation,
  longEdge = 1200,
): Promise<{ url: string; aspect: number; suggested: CropRect }> {
  const img = await loadImage(url);
  const k = Math.min(1, longEdge / Math.max(img.naturalWidth || 1400, img.naturalHeight || 1000));
  const canvas = rotatedCanvas(img, rotation, k);
  const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  let suggested: CropRect = { x: 0, y: 0, w: 1, h: 1 };
  try {
    suggested = suggestCrop(toGray(data.data, canvas.width, canvas.height));
  } catch (e) {
    console.warn('Could not suggest a crop', e);
  }
  return { url: canvas.toDataURL('image/png'), aspect: canvas.width / canvas.height, suggested };
}

/** Rasterises any image URL (including SVG) to PNG data for PDF embedding. */
/**
 * An image as a JPEG for full-page artwork, `longEdge` pixels on its long side. Vector art (SVG)
 * is drawn at that size, however small its own size is; on white, as JPEG has no transparency.
 */
export async function imageToArtwork(
  url: string,
  longEdge = 2400,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(url);
  const w = img.naturalWidth || longEdge;
  const h = img.naturalHeight || Math.round(longEdge * 0.7);
  const k = longEdge / Math.max(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width: canvas.width, height: canvas.height };
}

export async function imageToPngDataUrl(
  url: string,
  longEdge = 1200,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImage(url);
  const size = fit(img.naturalWidth || longEdge, img.naturalHeight || longEdge, longEdge);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size.width, size.height);
  return { dataUrl: canvas.toDataURL('image/png'), ...size };
}
