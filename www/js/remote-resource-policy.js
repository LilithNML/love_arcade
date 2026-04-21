(function initRemoteResourcePolicy(global) {
  'use strict';

  const ALLOWED_REMOTE_HOSTS = new Set([
    'res.cloudinary.com',
    'timeapi.io',
    'api.timeapi.io',
    'qlyssagnmfnflxqpgrgy.supabase.co'
  ]);

  const CDN_BLOCKLIST = [
    'cdn.jsdelivr.net',
    'unpkg.com',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ];

  function parseUrl(value) {
    try {
      return new URL(value, global.location.href);
    } catch {
      return null;
    }
  }

  function isBlockedRuntimeCdn(url) {
    if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) return false;
    const hostname = url.hostname.toLowerCase();
    return CDN_BLOCKLIST.some(host => hostname === host || hostname.endsWith(`.${host}`));
  }

  function isAllowedRemote(url) {
    if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:')) return true;
    const hostname = url.hostname.toLowerCase();
    return ALLOWED_REMOTE_HOSTS.has(hostname);
  }

  function sanitizeNode(node, attr) {
    const raw = node.getAttribute(attr);
    if (!raw) return;

    const url = parseUrl(raw);
    if (!url) return;

    if (isBlockedRuntimeCdn(url) || !isAllowedRemote(url)) {
      node.removeAttribute(attr);
      node.setAttribute('data-disabled-by-policy', 'true');
      console.warn(`[RemotePolicy] Recurso bloqueado en runtime: ${raw}`);
    }
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;

        if (node.matches('script[src]')) sanitizeNode(node, 'src');
        if (node.matches('link[href][rel="stylesheet"]')) sanitizeNode(node, 'href');
      });
    });
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  global.__remoteResourcePolicy = {
    allowedRemoteHosts: Array.from(ALLOWED_REMOTE_HOSTS),
    blockedCdnHosts: CDN_BLOCKLIST.slice()
  };
})(window);
