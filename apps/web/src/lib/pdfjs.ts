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

/** How long a PDF may take to open before the reader is taken not to work in this browser. */
const OPEN_WAIT_MS = 15_000;

/**
 * Opens a PDF. Where pdf.js can't start its reader in this browser it waits forever rather than
 * failing, so after a while this gives up with an error (and the caller can try another way).
 */
export async function openPdf(file: File) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void task.destroy();
      reject(new Error('The PDF reader didn’t start in this browser.'));
    }, OPEN_WAIT_MS);
  });
  try {
    return await Promise.race([task.promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
