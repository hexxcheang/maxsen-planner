/*
 * Keeps the app on the device, so it opens even offline or while the server wakes up. Pages come
 * from the network when it answers within a few seconds (so updates arrive), else from the copy
 * kept here; built files (named by their content) and icons, templates and samples are kept once
 * fetched. The API (Claude, Gemini, sign-in) always goes to the network.
 */
const CACHE = 'maxsen-v1';
const PAGE_WAIT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const keep = async (request, response) => {
  if (response && response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Any page of the app is the same index.html; the app picks the screen.
    event.respondWith(
      (async () => {
        const cached = caches.match('/');
        const network = fetch(request)
          .then((r) => (r.ok ? keep('/', r.clone()).then(() => r) : r))
          .catch(() => null);
        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), PAGE_WAIT_MS));
        const first = await Promise.race([network, timeout]);
        return first || (await cached) || (await network) || Response.error();
      })(),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((r) => keep(request, r))),
  );
});
