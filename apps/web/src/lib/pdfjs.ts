/**
 * pdf.js for reading PDFs in the browser. Its legacy build, which carries its own stand-ins for
 * the newest JavaScript features (in the page and in its worker), so PDFs read on older Safari on
 * Mac and iPad as well as on the newest Chrome.
 */
export async function loadPdfjs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}
