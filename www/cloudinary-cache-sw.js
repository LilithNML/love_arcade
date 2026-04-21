'use strict';

const CLOUDINARY_HOST = 'res.cloudinary.com';
const ASSET_CACHE = 'love-arcade-cloudinary-assets-v1';
const IN_FLIGHT = new Map();

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'skipWaiting') {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (data.type !== 'warm-cloudinary-assets' || !Array.isArray(data.urls)) return;

  const urls = Array.from(new Set(data.urls.filter((raw) => isCloudinaryUrl(raw))));
  event.waitUntil(warmCloudinaryAssets(urls));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = safeUrl(req.url);
  if (!url || url.hostname !== CLOUDINARY_HOST) return;

  event.respondWith(handleCloudinaryRequest(req));
});

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isCloudinaryUrl(value) {
  const url = safeUrl(value);
  return Boolean(url && (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname === CLOUDINARY_HOST);
}

async function warmCloudinaryAssets(urls) {
  const queue = urls.slice();
  const workers = [];
  const concurrency = 4;

  for (let i = 0; i < concurrency; i += 1) {
    workers.push((async () => {
      while (queue.length > 0) {
        const nextUrl = queue.shift();
        if (!nextUrl) continue;
        const req = new Request(nextUrl, { mode: 'cors', credentials: 'omit' });
        try {
          await handleCloudinaryRequest(req);
        } catch {
          // Ignorar fallos de una URL individual para no interrumpir el lote.
        }
      }
    })());
  }

  await Promise.all(workers);
}

async function handleCloudinaryRequest(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const key = request.url;

  if (cached) {
    revalidateInBackground(cache, request, cached, key);
    return cached;
  }

  const fresh = await fetchAndStore(cache, request, null);
  if (fresh) return fresh;

  throw new Error(`No se pudo obtener asset remoto: ${request.url}`);
}

function revalidateInBackground(cache, request, cached, key) {
  if (IN_FLIGHT.has(key)) return;

  const work = fetchAndStore(cache, request, cached)
    .catch(() => null)
    .finally(() => {
      IN_FLIGHT.delete(key);
    });

  IN_FLIGHT.set(key, work);
}

async function fetchAndStore(cache, request, cached) {
  const headers = new Headers(request.headers || {});

  if (cached) {
    const etag = cached.headers.get('ETag');
    const lastModified = cached.headers.get('Last-Modified');
    if (etag) headers.set('If-None-Match', etag);
    if (lastModified) headers.set('If-Modified-Since', lastModified);
  }

  const networkReq = new Request(request.url, {
    method: 'GET',
    headers,
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'follow'
  });

  const networkRes = await fetch(networkReq);

  if (networkRes.status === 304 && cached) {
    return cached;
  }

  if (!networkRes.ok) {
    if (cached) return cached;
    throw new Error(`HTTP ${networkRes.status}`);
  }

  await cache.put(request, networkRes.clone());
  return networkRes;
}
