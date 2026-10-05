import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Pre-bundle the lazily imported export and PDF libraries at startup; otherwise Vite discovers
  // them on first use and reloads the page mid-session.
  optimizeDeps: {
    include: ['pdfjs-dist', 'jspdf', 'exceljs'],
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
