(function initCloudinaryCache(global) {
  'use strict';

  const SW_PATH = '/cloudinary-cache-sw.js';
  const CLOUDINARY_HOST = 'res.cloudinary.com';

  function toUrl(value) {
    try {
      return new URL(value, global.location.href);
    } catch {
      return null;
    }
  }

  function isCloudinaryUrl(value) {
    const url = toUrl(value);
    return Boolean(url && (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname === CLOUDINARY_HOST);
  }

  function extractCloudinaryUrlsFromInlineStyles() {
    const found = new Set();
    const nodes = global.document.querySelectorAll('[style]');
    const regex = /url\((['"]?)(https?:[^'"\)]+)\1\)/gi;

    nodes.forEach((node) => {
      const styleText = node.getAttribute('style') || '';
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(styleText)) !== null) {
        const raw = match[2];
        if (isCloudinaryUrl(raw)) found.add(raw);
      }
    });

    return found;
  }

  async function getShopCloudinaryUrls() {
    try {
      const res = await fetch('data/shop.json', { cache: 'no-store' });
      if (!res.ok) return new Set();
      const items = await res.json();
      if (!Array.isArray(items)) return new Set();

      const urls = new Set();
      items.forEach((item) => {
        if (item && typeof item.image === 'string' && isCloudinaryUrl(item.image)) {
          urls.add(item.image);
        }
      });
      return urls;
    } catch {
      return new Set();
    }
  }

  async function warmAssets(registration) {
    const domUrls = extractCloudinaryUrlsFromInlineStyles();
    const shopUrls = await getShopCloudinaryUrls();
    const urls = Array.from(new Set([...domUrls, ...shopUrls]));
    if (!urls.length) return;

    const active = registration.active || registration.waiting || registration.installing;
    if (!active) return;

    active.postMessage({ type: 'warm-cloudinary-assets', urls });
  }

  async function boot() {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });
      if (registration.waiting) registration.waiting.postMessage({ type: 'skipWaiting' });

      await navigator.serviceWorker.ready;
      await warmAssets(registration);
    } catch (err) {
      console.warn('[CloudinaryCache] No se pudo inicializar caché offline:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  global.CloudinaryCacheManager = {
    isCloudinaryUrl,
    extractCloudinaryUrlsFromInlineStyles
  };
})(window);
