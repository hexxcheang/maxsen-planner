/**
 * A PDF's text with where each piece sits on its page, read on the server: the same as the app
 * reads in the browser, for when the browser can't (an older Safari, a blocked file). Scanned
 * pages have no text; the browser reads those itself.
 */
import { createRequire } from 'node:module';
import path from 'node:path';

/** The standard fonts shipped with pdf.js, for PDFs that name a font without including it. */
const FONTS = `${path.join(path.dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')), 'standard_fonts')}/`;

export interface PdfText {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  str: string;
  pageHeight: number;
}

/** Large drawings aren't invoices; anything bigger is refused. */
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export async function pdfText(data: Uint8Array): Promise<PdfText[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data,
    // No fonts or system access are needed to read the text.
    disableFontFace: true,
    useSystemFonts: false,
    standardFontDataUrl: FONTS,
  }).promise;
  const out: PdfText[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const pageHeight = page.getViewport({ scale: 1 }).height;
      for (const item of (await page.getTextContent()).items) {
        if (!('str' in item) || !item.str.trim()) continue;
        out.push({
          page: p,
          x: item.transform[4] as number,
          y: item.transform[5] as number,
          width: item.width,
          height: item.height,
          str: item.str,
          pageHeight,
        });
      }
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return out;
}
