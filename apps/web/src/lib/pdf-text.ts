import type { PdfText } from '@maxsen/domain';
import { readPdfText } from './images';
import { isStaleApp } from './stale';

/**
 * A PDF's text, read in the browser; if the browser can't (an older Safari, a browser setting),
 * read by the team server instead. Empty for a scanned PDF.
 */
export async function pdfTextAnywhere(file: File): Promise<PdfText[]> {
  try {
    return await readPdfText(file);
  } catch (e) {
    // A piece of an older version of the app: reloading fixes that, not the server.
    if (isStaleApp(e)) throw e;
    console.warn('Reading the PDF in the browser failed; asking the server.', e);
    const res = await fetch('/api/pdf/text', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/pdf' },
      body: file,
    }).catch(() => null);
    if (!res?.ok) throw e;
    return ((await res.json()) as { texts: PdfText[] }).texts;
  }
}
