/**
 * Reads a plan's drawing on this computer: room names come from the PDF's own text where there is
 * one, otherwise from on-device OCR (tesseract.js, served by the app), and the walls, doors and
 * windows from the image itself. Nothing leaves the browser.
 */
import {
  cropLabel,
  readFloorPlan,
  rotateLabel,
  toGray,
  type DrawingLabel,
  type FloorReading,
  type Plan,
  type SourceFile,
  type SourcePage,
} from '@maxsen/domain';
import { fileUrl } from '@/lib/files';
import { loadImage } from '@/lib/images';

/** Long edge the drawing is read at: enough for 8–10 px walls on a typical plan. */
const READ_LONG_EDGE = 1600;
/** Long edge used for OCR; small room labels need more pixels than walls do. */
const OCR_LONG_EDGE = 2400;

export type ReadStage = 'labels' | 'walls';

function draw(img: HTMLImageElement, longEdge: number): HTMLCanvasElement {
  const k = Math.min(1, longEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Text on a PDF page, as label centres in fractions of the page. */
async function pdfLabels(fileId: string, pageIndex: number): Promise<DrawingLabel[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const data = new Uint8Array(await (await fetch(fileUrl(fileId))).arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const labels: DrawingLabel[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const [, , , , e, f] = item.transform as number[];
      const size =
        Math.hypot(item.transform[2] as number, item.transform[3] as number) || item.height;
      // Baseline start, then halfway along the text and up half its height.
      const [x0] = viewport.convertToViewportPoint(e!, f!) as [number, number];
      const [x1, y1] = viewport.convertToViewportPoint(e! + item.width, f! + size / 2) as [
        number,
        number,
      ];
      labels.push({
        text: item.str,
        x: (x0 + x1) / 2 / viewport.width,
        y: y1 / viewport.height,
      });
    }
    return labels;
  } finally {
    await doc.destroy();
  }
}

/** Lines of text found by OCR on the image, as label centres in fractions of the image. */
async function ocrLabels(img: HTMLImageElement): Promise<DrawingLabel[]> {
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/',
    langPath: '/ocr/',
    gzip: true,
    workerBlobURL: false,
    cacheMethod: 'none',
  });
  try {
    const canvas = draw(img, OCR_LONG_EDGE);
    // Sparse text: find as much text as possible in no particular order.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(canvas, {}, { blocks: true, text: false });
    const labels: DrawingLabel[] = [];
    for (const block of data.blocks ?? []) {
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          const words = line.words.filter((w) => w.confidence >= 30);
          const text = words
            .map((w) => w.text)
            .join(' ')
            .trim();
          if (!text) continue;
          labels.push({
            text,
            x: (line.bbox.x0 + line.bbox.x1) / 2 / canvas.width,
            y: (line.bbox.y0 + line.bbox.y1) / 2 / canvas.height,
            confidence: Math.min(...words.map((w) => w.confidence)),
          });
        }
      }
    }
    return labels;
  } finally {
    await worker.terminate();
  }
}

/** Room labels for a plan's drawing: from the PDF text layer when it has one, else by OCR. */
async function labelsFor(
  plan: Plan,
  img: HTMLImageElement,
  pages: SourcePage[],
  files: SourceFile[],
): Promise<DrawingLabel[]> {
  const page = pages.find((p) => p.id === plan.background.sourcePageId);
  const file = files.find((f) => f.id === page?.sourceFileId);
  if (page && file?.kind === 'pdf') {
    try {
      const found = await pdfLabels(file.fileId, page.pageIndex);
      // A scanned PDF has no text layer; fall through to OCR.
      if (found.some((l) => /[a-z]{3}/i.test(l.text))) {
        return found
          .map((l) => cropLabel(rotateLabel(l, plan.background.rotation), plan.background.crop))
          .filter((l): l is DrawingLabel => l !== null);
      }
    } catch (e) {
      console.warn('PDF text could not be read; using OCR', e);
    }
  }
  try {
    return await ocrLabels(img);
  } catch (e) {
    console.warn('OCR failed; rooms will be named by size and shape', e);
    return [];
  }
}

/** Reads the plan's background drawing in the browser. */
export async function readPlanLocally(
  plan: Plan,
  source: { pages: SourcePage[]; files: SourceFile[] },
  onStage?: (stage: ReadStage) => void,
): Promise<FloorReading> {
  const img = await loadImage(fileUrl(plan.background.fileId));
  onStage?.('labels');
  const labels = await labelsFor(plan, img, source.pages, source.files);
  onStage?.('walls');
  // Let the progress message paint before the (synchronous) image work.
  await new Promise((r) => setTimeout(r, 30));
  const canvas = draw(img, READ_LONG_EDGE);
  const rgba = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  return readFloorPlan(toGray(rgba.data, canvas.width, canvas.height), { labels });
}
