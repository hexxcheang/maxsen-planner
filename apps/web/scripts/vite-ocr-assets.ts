/**
 * Serves the on-device OCR engine (tesseract.js worker, WebAssembly core and English data) from the
 * app itself under /ocr/, so reading room names never needs the internet.
 */
import { createReadStream, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);

function assets(): Record<string, string> {
  const worker = path.join(path.dirname(require.resolve('tesseract.js/package.json')), 'dist/worker.min.js');
  const core = path.dirname(
    require.resolve('tesseract.js-core/package.json', { paths: [path.dirname(require.resolve('tesseract.js/package.json'))] }),
  );
  const lang = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int/eng.traineddata.gz');
  const files: Record<string, string> = { 'worker.min.js': worker, 'eng.traineddata.gz': lang };
  for (const variant of ['lstm', 'simd-lstm', 'relaxedsimd-lstm']) {
    for (const ext of ['.wasm.js', '.js', '.wasm']) {
      const name = `tesseract-core-${variant}${ext}`;
      files[name] = path.join(core, name);
    }
  }
  return files;
}

const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.gz': 'application/octet-stream',
};

export function ocrAssets(): Plugin {
  return {
    name: 'maxsen-ocr-assets',
    configureServer(server) {
      const files = assets();
      server.middlewares.use('/ocr', (req, res, next) => {
        const name = (req.url ?? '').replace(/^\//, '').split('?')[0]!;
        const file = files[name];
        if (!file) return next();
        res.setHeader('content-type', TYPES[path.extname(name)] ?? 'application/octet-stream');
        res.setHeader('cache-control', 'max-age=86400');
        createReadStream(file).pipe(res);
      });
    },
    generateBundle() {
      for (const [name, file] of Object.entries(assets())) {
        this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: readFileSync(file) });
      }
    },
  };
}
