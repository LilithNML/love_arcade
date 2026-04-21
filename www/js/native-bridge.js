(function () {
    'use strict';

    const DEFAULT_TIMEOUT_MS = 8000;
    const DEFAULT_RETRIES = 0;
    const OFFLINE_ANALYTICS_QUEUE_KEY = 'love_arcade_offline_analytics_v1';
    const OFFLINE_ANALYTICS_MAX = 150;

    const NativeBridge = {
        isNative() {
            try {
                return Boolean(window.Capacitor?.isNativePlatform?.());
            } catch (_) {
                return false;
            }
        },
        getCapacitorHttp() {
            return window.CapacitorHttp || window.Capacitor?.Plugins?.CapacitorHttp || null;
        }
    };

    function _loadQueue() {
        try {
            const raw = localStorage.getItem(OFFLINE_ANALYTICS_QUEUE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function _saveQueue(items) {
        try {
            localStorage.setItem(OFFLINE_ANALYTICS_QUEUE_KEY, JSON.stringify(items.slice(-OFFLINE_ANALYTICS_MAX)));
        } catch (_) {
            // localStorage puede estar bloqueado; degradar en silencio.
        }
    }

    function _toAbsoluteUrl(pathOrUrl, nativeBaseUrl) {
        if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
        const safePath = String(pathOrUrl || '');
        if (!NativeBridge.isNative()) return safePath;

        const base = (nativeBaseUrl || window.__LOVE_ARCADE_API_BASE_URL__ || '').replace(/\/+$/, '');
        if (!base) {
            throw new Error('NATIVE_BASE_URL_MISSING');
        }
        return `${base}${safePath.startsWith('/') ? '' : '/'}${safePath}`;
    }

    async function _webFetch(url, options, timeoutMs) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
        try {
            const res = await fetch(url, {
                method: options.method || 'GET',
                headers: options.headers || {},
                body: options.body,
                cache: options.cache,
                keepalive: options.keepalive,
                signal: controller.signal,
            });
            const text = await res.text();
            let data = null;
            try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
            return {
                ok: res.ok,
                status: res.status,
                headers: res.headers,
                text,
                data,
            };
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function _nativeFetch(url, options, timeoutMs) {
        const capHttp = NativeBridge.getCapacitorHttp();
        if (!capHttp?.request) {
            throw new Error('CAPACITOR_HTTP_UNAVAILABLE');
        }

        const response = await capHttp.request({
            url,
            method: options.method || 'GET',
            headers: options.headers || {},
            data: options.jsonBody !== undefined ? options.jsonBody : options.body,
            connectTimeout: timeoutMs,
            readTimeout: timeoutMs,
        });

        let text = '';
        let data = null;
        if (typeof response.data === 'string') {
            text = response.data;
            try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
        } else {
            data = response.data;
            try { text = JSON.stringify(response.data); } catch (_) { text = ''; }
        }

        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            headers: response.headers || {},
            text,
            data,
        };
    }

    async function request(pathOrUrl, config) {
        const cfg = config || {};
        const retries = Number.isInteger(cfg.retries) ? cfg.retries : DEFAULT_RETRIES;
        const timeoutMs = Number.isFinite(cfg.timeoutMs) ? cfg.timeoutMs : DEFAULT_TIMEOUT_MS;
        const queueIfOffline = Boolean(cfg.queueIfOffline);
        const isAnalytics = Boolean(cfg.analytics);

        if (navigator.onLine === false && queueIfOffline && isAnalytics) {
            const queued = _loadQueue();
            queued.push({
                pathOrUrl,
                options: {
                    method: cfg.method || 'POST',
                    headers: cfg.headers || {},
                    body: cfg.body,
                    jsonBody: cfg.jsonBody,
                    keepalive: cfg.keepalive,
                },
                queuedAt: Date.now(),
            });
            _saveQueue(queued);
            return { ok: false, queued: true, status: 0, data: null, text: '' };
        }

        let lastError = null;
        const url = _toAbsoluteUrl(pathOrUrl, cfg.nativeBaseUrl);
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
                if (NativeBridge.isNative()) {
                    return await _nativeFetch(url, cfg, timeoutMs);
                }
                return await _webFetch(url, cfg, timeoutMs);
            } catch (err) {
                lastError = err;
                if (attempt < retries) {
                    const backoff = (cfg.retryBackoffBaseMs || 300) * (2 ** attempt);
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    continue;
                }
            }
        }

        throw lastError || new Error('REQUEST_FAILED');
    }

    async function flushAnalyticsQueue(config) {
        const cfg = config || {};
        const queued = _loadQueue();
        if (!queued.length) return { sent: 0, pending: 0 };

        const remaining = [];
        let sent = 0;
        for (const item of queued) {
            try {
                const res = await request(item.pathOrUrl, {
                    ...item.options,
                    analytics: true,
                    queueIfOffline: false,
                    timeoutMs: cfg.timeoutMs || DEFAULT_TIMEOUT_MS,
                    retries: cfg.retries ?? 1,
                });
                if (res.ok) sent += 1;
                else remaining.push(item);
            } catch (_) {
                remaining.push(item);
            }
        }

        _saveQueue(remaining);
        return { sent, pending: remaining.length };
    }

    window.NativeBridge = NativeBridge;
    window.ApiClient = {
        request,
        flushAnalyticsQueue,
        isNative: NativeBridge.isNative,
    };

    window.addEventListener('online', () => {
        flushAnalyticsQueue({ retries: 1 }).catch(() => {});
    });
})();
