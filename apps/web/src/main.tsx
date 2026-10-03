import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { appRoutes } from './app/router';
import { Providers } from './app/providers';
import { initFileStore } from './lib/storage/file-store';
import './styles/globals.css';

const router = createBrowserRouter(appRoutes);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
// Uploaded drawings and images must be loaded before the first render can show them.
await initFileStore();
createRoot(root).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
