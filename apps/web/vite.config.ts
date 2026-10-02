import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { ocrAssets } from './scripts/vite-ocr-assets';

export default defineConfig({
  plugins: [react(), tailwindcss(), ocrAssets()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Pre-bundle the lazily imported export and PDF libraries at startup; otherwise Vite discovers
  // them on first use and reloads the page mid-session.
  optimizeDeps: {
    include: ['pdfjs-dist', 'jspdf', 'exceljs', 'tesseract.js'],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/files': 'http://localhost:3000',
    },
  },
});
