/**
 * Reads a PDF whose pages have no text in them (a scan, or a document printed with its letters
 * drawn as shapes, as WPS Office on a Mac does) by recognising the words in a picture of each
 * page, on this device. Gives the words with their positions, as a text PDF would, plus the
 * item table's row borders, for `pdfInvoiceGrid`.
 */
import type { PdfText, TableRule } from '@maxsen/domain';
import type { Worker as TesseractWorker } from 'tesseract.js';
import { loadPdfjs } from './pdfjs';

/** Pixels per PDF point: about 250 dpi, where Tesseract reads invoice print best. */
const SCALE = 250 / 72;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface Word {
  text: string;
  bbox: Box;
  /** The bottom of the word's line, so words on one line share it. */
  bottom: number;
}

const NUMBER = /^[(-]?\s*(S\$|\$)?-?[\d,]*\d(\.\d+)?\)?$/;

export async function ocrPdf(
  file: File,
  onProgress?: (message: string) => void,
): Promise<{ texts: PdfText[]; rules: TableRule[] }> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

  onProgress?.('Getting the text reader ready…');
  const { createWorker, PSM } = await import('tesseract.js');
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.href).href;
  const worker = await createWorker('eng', 1, {
    workerPath: `${base}worker.min.js`,
    corePath: base,
    langPath: base.replace(/\/$/, ''),
    workerBlobURL: false,
  });

  const texts: PdfText[] = [];
  const rules: TableRule[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      onProgress?.(`Reading page ${p} of ${doc.numPages}…`);
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist: '',
      });
      const clean = textOnly(canvas);
      let words = await recognise(worker, clean);

      // Tesseract drops lone digits ("1", "4") on a busy page, so the number columns are read
      // again on their own, as digits only.
      const head = tableHead(words);
      if (head) {
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
          tessedit_char_whitelist: '0123456789.,-()$S',
        });
        for (const strip of head.strips) {
          const crop = clearRules(clean, strip);
          const found = (await recognise(worker, crop)).filter((w) => NUMBER.test(w.text));
          release(crop);
          const inStrip = (w: Word) => {
            const cx = (w.bbox.x0 + w.bbox.x1) / 2;
            return cx > strip.x0 && cx < strip.x1 && w.bbox.y0 > strip.y0 && w.bbox.y1 < strip.y1;
          };
          words = [
            ...words.filter((w) => !(inStrip(w) && /\d/.test(w.text))),
            ...found.map((w) => ({
              text: w.text,
              bbox: {
                x0: w.bbox.x0 + strip.x0,
                x1: w.bbox.x1 + strip.x0,
                y0: w.bbox.y0 + strip.y0,
                y1: w.bbox.y1 + strip.y0,
              },
              bottom: w.bottom + strip.y0,
            })),
          ];
        }
        for (const y of rowBorders(canvas, head.desc, head.top, head.bottom))
          rules.push({ page: p, y: viewport.height / SCALE - y / SCALE });
      }

      // Safari on iPad stops drawing once page-sized canvases add up, so each page's go at once.
      release(clean);
      release(canvas);
      page.cleanup();

      const pageHeight = viewport.height / SCALE;
      for (const w of words)
        texts.push({
          page: p,
          x: w.bbox.x0 / SCALE,
          y: pageHeight - w.bottom / SCALE,
          width: (w.bbox.x1 - w.bbox.x0) / SCALE,
          height: (w.bbox.y1 - w.bbox.y0) / SCALE,
          str: w.text,
          pageHeight,
        });
    }
  } finally {
    await worker.terminate();
    void doc.destroy();
  }
  return { texts, rules };
}

/** Gives a canvas's memory back straight away, rather than whenever it's collected. */
function release(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

async function recognise(worker: TesseractWorker, image: HTMLCanvasElement): Promise<Word[]> {
  const { data } = await worker.recognize(image, {}, { blocks: true });
  const out: Word[] = [];
  for (const block of data.blocks ?? [])
    for (const para of block.paragraphs)
      for (const line of para.lines)
        for (const w of line.words)
          if (w.text.trim()) out.push({ text: w.text.trim(), bbox: w.bbox, bottom: line.bbox.y1 });
  return out;
}

/**
 * The item table's heading on the page: where its number columns are (as strips to read again)
 * and where the description column runs, down to the total line.
 */
function tableHead(words: Word[]) {
  const find = (re: RegExp) => words.find((w) => re.test(w.text));
  const qty = find(/^(qty|quantity)$/i);
  const unit = words.find(
    (w) => /^unit$/i.test(w.text) && qty && Math.abs(w.bbox.y1 - qty.bbox.y1) < 30,
  );
  if (!qty || !unit) return null;
  const line = words
    .filter((w) => Math.abs(w.bbox.y1 - qty.bbox.y1) < 30)
    .sort((a, b) => a.bbox.x0 - b.bbox.x0);
  // Heading cells: words with small gaps between them ("UNIT PRICE (S$)").
  const cells: Box[] = [];
  for (const w of line) {
    const last = cells.at(-1);
    if (last && w.bbox.x0 - last.x1 < 1.5 * (w.bbox.y1 - w.bbox.y0)) last.x1 = w.bbox.x1;
    else cells.push({ ...w.bbox });
  }
  const at = (w: Word) => cells.findIndex((c) => w.bbox.x0 >= c.x0 && w.bbox.x1 <= c.x1);
  const top = Math.max(qty.bbox.y1, unit.bbox.y1) + 4;
  const total = words.find(
    (w) => /^total$/i.test(w.text) && w.bbox.y0 > top && w.bbox.x1 < qty.bbox.x0,
  );
  const bottom = total ? total.bbox.y0 - 4 : Infinity;
  const strip = (i: number) => {
    const c = cells[i]!;
    const before = cells[i - 1];
    const after = cells[i + 1];
    const pad = (gap: number | undefined) => Math.min(60, 0.45 * (gap ?? 120));
    return {
      x0: Math.max(0, Math.round(c.x0 - pad(before && c.x0 - before.x1))),
      x1: Math.round(c.x1 + pad(after && after.x0 - c.x1)),
      y0: Math.round(top),
      y1: Number.isFinite(bottom) ? Math.round(bottom) : 0,
    };
  };
  const qtyAt = at(qty);
  const strips = [qtyAt, at(unit), ...(qtyAt > 1 ? [0] : [])].filter((i) => i >= 0).map(strip);
  // The description column: between the serial number and the quantity.
  const descLeft = qtyAt > 1 ? cells[0]!.x1 : 0;
  const descRight = cells[qtyAt]!.x0;
  const span = descRight - descLeft;
  return {
    strips,
    desc: { x0: descLeft + 0.25 * span, x1: descRight - 0.25 * span },
    top: top - 40,
    bottom,
  };
}

/**
 * The page as black text on white, without the table's ruled lines or shaded cells, which
 * Tesseract otherwise reads as rows of junk letters. Coloured text (red discounts, green and blue
 * services, an orange package name) stays: anything not near white is ink.
 */
function textOnly(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const { width: w, height: h } = canvas;
  const img = canvas.getContext('2d')!.getImageData(0, 0, w, h);
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++)
    ink[i] = Math.min(img.data[i * 4]!, img.data[i * 4 + 1]!, img.data[i * 4 + 2]!) < 150 ? 1 : 0;
  // A run of ink longer than any letter is a ruled line.
  const long = Math.round(0.35 * SCALE * 72); // about 9 mm
  const wipe = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x <= w; x++) {
      if (x < w && ink[y * w + x]) run++;
      else {
        if (run >= long) for (let k = x - run; k < x; k++) wipe[y * w + k] = 1;
        run = 0;
      }
    }
  }
  const tall = Math.round(0.25 * SCALE * 72); // about 6 mm, taller than a line of text
  for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = 0; y <= h; y++) {
      if (y < h && ink[y * w + x]) run++;
      else {
        if (run >= tall) for (let k = y - run; k < y; k++) wipe[k * w + x] = 1;
        run = 0;
      }
    }
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  const res = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = ink[i] && !wipe[i] ? 0 : 255;
    res.data[i * 4] = res.data[i * 4 + 1] = res.data[i * 4 + 2] = v;
    res.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(res, 0, 0);
  return out;
}

/** A strip of the page with its long lines (cell borders) whitened, for reading numbers. */
function clearRules(
  canvas: HTMLCanvasElement,
  strip: { x0: number; x1: number; y0: number; y1: number },
): HTMLCanvasElement {
  const w = Math.max(1, Math.min(canvas.width, strip.x1) - strip.x0);
  const y1 = strip.y1 > strip.y0 ? Math.min(canvas.height, strip.y1) : canvas.height;
  const h = Math.max(1, y1 - strip.y0);
  strip.y1 = y1;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(canvas, strip.x0, strip.y0, w, h, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const dark = (x: number, y: number) => img.data[(y * w + x) * 4]! < 150;
  const white = (x: number, y: number) => img.data.fill(255, (y * w + x) * 4, (y * w + x) * 4 + 3);
  for (let x = 0; x < w; x++) {
    let n = 0;
    for (let y = 0; y < h; y++) if (dark(x, y)) n++;
    if (n > 0.4 * h) for (let y = 0; y < h; y++) white(x, y);
  }
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (dark(x, y)) n++;
    if (n > 0.7 * w) for (let x = 0; x < w; x++) white(x, y);
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** The y of each line ruled across the description column, between the heading and the total. */
function rowBorders(
  canvas: HTMLCanvasElement,
  desc: { x0: number; x1: number },
  top: number,
  bottom: number,
): number[] {
  const x0 = Math.round(desc.x0);
  const w = Math.max(1, Math.round(desc.x1) - x0);
  const y0 = Math.max(0, Math.round(top));
  const y1 = Math.min(
    canvas.height,
    Number.isFinite(bottom) ? Math.round(bottom) + 40 : canvas.height,
  );
  if (y1 <= y0) return [];
  const img = canvas.getContext('2d')!.getImageData(x0, y0, w, y1 - y0);
  const ys: number[] = [];
  for (let y = 0; y < y1 - y0; y++) {
    let n = 0;
    for (let x = 0; x < w; x++) if (img.data[(y * w + x) * 4]! < 150) n++;
    if (n > 0.85 * w) ys.push(y + y0);
  }
  // A ruled line is a few pixels thick: one border per run.
  const out: number[] = [];
  for (const y of ys) {
    if (out.length && y - out.at(-1)! <= 3) out[out.length - 1] = y;
    else out.push(y);
  }
  return out;
}
