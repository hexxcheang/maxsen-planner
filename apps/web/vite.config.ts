import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

/**
 * Reading scanned invoices (OCR) runs Tesseract in the browser. Its worker, engine and English
 * data are served from the app itself under /ocr/ (not a CDN), so it works offline and wherever
 * CDNs are blocked; they're only downloaded when a scanned PDF is read.
 */
function ocrAssets(): Plugin {
  const require = createRequire(import.meta.url);
  const tesseract = path.dirname(require.resolve('tesseract.js/package.json'));
  const core = path.dirname(
    createRequire(path.join(tesseract, 'package.json')).resolve('tesseract.js-core/package.json'),
  );
  const eng = path.dirname(require.resolve('@tesseract.js-data/eng/package.json'));
  const files: Record<string, string> = {
    'worker.min.js': path.join(tesseract, 'dist/worker.min.js'),
    'eng.traineddata.gz': path.join(eng, '4.0.0_best_int/eng.traineddata.gz'),
    ...Object.fromEntries(
      ['relaxedsimd-lstm', 'simd-lstm', 'lstm'].map((v) => [
        `tesseract-core-${v}.wasm.js`,
        path.join(core, `tesseract-core-${v}.wasm.js`),
      ]),
    ),
  };
  return {
    name: 'maxsen-ocr-assets',
    configureServer(server) {
      server.middlewares.use('/ocr/', (req, res, next) => {
        const file = files[(req.url ?? '').replace(/^\//, '').split('?')[0]!];
        if (!file) return next();
        res.setHeader(
          'content-type',
          file.endsWith('.gz') ? 'application/octet-stream' : 'text/javascript',
        );
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const [name, file] of Object.entries(files))
        this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: readFileSync(file) });
    },
  };
}

/** Which version of the app this is: the commit it was built from (Render names it). */
function appVersion(): string {
  let commit = process.env.RENDER_GIT_COMMIT ?? '';
  if (!commit)
    try {
      commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
      commit = 'dev';
    }
  return `${commit.trim().slice(0, 7)} (${new Date().toISOString().slice(0, 10)})`;
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ocrAssets()],
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Pre-bundle the lazily imported export and PDF libraries at startup; otherwise Vite discovers
  // them on first use and reloads the page mid-session.
  optimizeDeps: {
    include: ['pdfjs-dist/legacy/build/pdf.mjs', 'jspdf', 'exceljs', 'tesseract.js'],
  },
  server: {
    // Also reachable from other devices on the same Wi-Fi (a tablet), at the Network address
    // Vite prints when it starts.
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/files': 'http://localhost:3000',
    },
  },
});
