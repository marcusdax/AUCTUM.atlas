/*
 * AUCTUM · ATLAS service worker (hand-written, no build step, no dependencies).
 *
 * Strategy
 *  - Navigation requests (HTML documents): network-first. On success the page is stored
 *    in a pages cache; when the network is unavailable the cached copy is served, falling
 *    back to /offline.html.
 *  - Same-origin static assets (JS/CSS/images/fonts/manifest): stale-while-revalidate.
 *    The cached copy responds instantly and a background fetch refreshes it.
 *  - Never intercepted or cached: /api/, /socket.io/, /uploads/, non-GET requests and
 *    cross-origin requests. Customer data and websockets always go straight to the network.
 *
 * Bump SW_VERSION when the caching logic changes; activate cleans up old caches.
 */
const SW_VERSION = 'auctum-v2';
const PRECACHE = `${SW_VERSION}-precache`;
const PAGES_CACHE = `${SW_VERSION}-pages`;
const STATIC_CACHE = `${SW_VERSION}-static`;

const OFFLINE_URL = '/offline.html';
const NAVIGATION_TIMEOUT_MS = 10000;

// Static shell assets useful before any navigation has been cached.
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable-192.svg',
  '/icons/icon-maskable-512.svg',
  '/icons/apple-touch-icon.svg',
  '/favicon.svg',
];

// Paths that must always hit the network. Never cache API data, sockets or uploads.
const NEVER_CACHE_PREFIXES = ['/api/', '/socket.io/', '/uploads/'];
const NEVER_CACHE_EXACT = new Set(['/api', '/socket.io', '/uploads']);

const STATIC_EXTENSIONS = /\.(?:js|mjs|css|svg|png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|json|webmanifest|map|txt|xml)$/i;

const INLINE_OFFLINE_FALLBACK = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RoofPro CRM - Offline</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0e14;color:#e2e8f0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px}main{max-width:420px;text-align:center}h1{font-size:1.5rem;margin:0 0 8px}p{color:#94a3b8;line-height:1.5}button{margin-top:24px;padding:12px 24px;border-radius:8px;border:0;background:#2563eb;color:#fff;font-size:1rem;font-weight:600;cursor:pointer}</style></head><body><main><h1>You're offline</h1><p>RoofPro CRM can't reach the network right now. Check your connection and try again.</p><button type="button" onclick="location.reload()">Retry</button></main></body></html>`;

function isNeverCache(pathname) {
  if (NEVER_CACHE_EXACT.has(pathname)) return true;
  return NEVER_CACHE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isStaticAsset(pathname) {
  return pathname.startsWith('/assets/') || pathname.startsWith('/icons/') || STATIC_EXTENSIONS.test(pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // Precache individually so one missing file can never fail the whole install.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'reload' });
            if (response && response.ok) {
              await cache.put(url, response);
            }
          } catch (error) {
            // Offline or missing asset: non-fatal, the cache is best-effort.
          }
        })
      );
      // Activate the new worker immediately instead of waiting for all tabs to close.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PRECACHE, PAGES_CACHE, STATIC_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('roofpro-') && !keep.has(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  // Allow the page to trigger an immediate update when it shows an update prompt.
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function handleNavigationRequest(request) {
  const cache = await caches.open(PAGES_CACHE);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(request, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (response && response.ok) {
      // Store the fresh document; failures to cache must never break the response.
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cachedPage = await cache.match(request);
    if (cachedPage) return cachedPage;

    const offlinePage = await caches.match(OFFLINE_URL);
    if (offlinePage) return offlinePage;

    return new Response(INLINE_OFFLINE_FALLBACK, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = (await cache.match(request)) || (await caches.match(request));

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Stale-while-revalidate: answer from cache now, refresh in the background.
    network.catch(() => {});
    return cached;
  }

  const response = await network;
  if (response) return response;

  // Nothing cached and the network is down: let the browser surface the failure
  // (images/scripts simply fail rather than being replaced by HTML).
  return Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only same-origin GET requests are candidates. Everything else goes to the network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isNeverCache(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticRequest(request));
  }
});


