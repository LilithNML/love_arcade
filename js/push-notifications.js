(function PushNotificationsModule() {
  'use strict';

  const STORAGE = {
    prefs: 'la_push_prefs_v1',
    lastNotice: 'la_push_last_notice_v1',
    lastShopHash: 'la_push_shop_hash_v1'
  };

  const DEFAULT_PREFS = {
    enabled: false,
    dailyClaim: true,
    moonExpiry: true,
    newShop: true,
    eventUrgent: true
  };

  let swReg = null;
  let vapidPublicKey = '';
  let lastRuleCheck = 0;

  function _$(id) { return document.getElementById(id); }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE.prefs);
      if (!raw) return { ...DEFAULT_PREFS };
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch (_) {
      return { ...DEFAULT_PREFS };
    }
  }

  function savePrefs(prefs) {
    localStorage.setItem(STORAGE.prefs, JSON.stringify({ ...DEFAULT_PREFS, ...prefs }));
  }

  function loadLastNoticeMap() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE.lastNotice) || '{}');
    } catch (_) {
      return {};
    }
  }

  function markNotified(key) {
    const map = loadLastNoticeMap();
    map[key] = Date.now();
    localStorage.setItem(STORAGE.lastNotice, JSON.stringify(map));
  }

  function alreadyNotifiedRecently(key, windowMs) {
    const map = loadLastNoticeMap();
    const ts = Number(map[key] || 0);
    return Date.now() - ts < windowMs;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function fetchPushConfig() {
    try {
      const res = await fetch('/api/push-public-config', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      vapidPublicKey = String(data?.vapidPublicKey || '');
    } catch (_) {
      vapidPublicKey = 'BMxdhgSVCuO4Vad8c_Wj8a-nAC3AgUBqjDhGKJb6Fm1ZvJ1ZFvNd1VzeF1KZsl2kvJYMbC6hBjaK93dH9jeGFqg';
    }
  }

  function setStatus(text, isError = false) {
    const el = _$('push-status-msg');
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? 'var(--error, #fc8181)' : 'var(--text-low)';
  }

  function updateUiSupportState() {
    const supportEl = _$('push-support-state');
    if (!supportEl) return;

    const supported = ('serviceWorker' in navigator) && ('Notification' in window) && ('PushManager' in window);
    supportEl.textContent = supported
      ? 'Soportado (Push API disponible en este navegador)'
      : 'No soportado (falta Service Worker, Notification o Push API)';
    supportEl.style.color = supported ? 'var(--success, #68d391)' : 'var(--error, #fc8181)';

    if (!supported) {
      setStatus('Este navegador no soporta Web Push completo.');
    }
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return swReg;
  }

  async function upsertSubscriptionOnSupabase(subscription, enabled) {
    const sentinel = window.Sentinel;
    const sb = sentinel?.getClient?.();
    const session = sentinel?.getSession?.();
    if (!sb || !session?.user?.id) {
      return { ok: false, reason: 'no-session' };
    }

    const json = subscription ? subscription.toJSON() : null;
    const payload = {
      user_id: session.user.id,
      endpoint: json?.endpoint || null,
      p256dh: json?.keys?.p256dh || null,
      auth: json?.keys?.auth || null,
      user_agent: navigator.userAgent,
      platform: /android/i.test(navigator.userAgent) ? 'android' : 'other',
      is_active: Boolean(enabled)
    };

    const { error } = await sb
      .from('push_subscriptions')
      .upsert(payload, { onConflict: 'endpoint' });

    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  }

  async function subscribePush() {
    if (!swReg) await registerServiceWorker();
    if (!swReg) throw new Error('No se pudo registrar service worker.');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permiso de notificaciones no concedido.');
    }

    const existing = await swReg.pushManager.getSubscription();
    if (existing) {
      await upsertSubscriptionOnSupabase(existing, true);
      return existing;
    }

    if (!vapidPublicKey) await fetchPushConfig();

    const sub = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    await upsertSubscriptionOnSupabase(sub, true);
    return sub;
  }

  async function unsubscribePush() {
    if (!swReg) await registerServiceWorker();
    const sub = await swReg?.pushManager?.getSubscription?.();
    if (!sub) return;
    await upsertSubscriptionOnSupabase(sub, false);
    await sub.unsubscribe();
  }

  async function showLocalNotification(payload) {
    if (!swReg) await registerServiceWorker();
    if (!swReg) return;

    if (Notification.permission !== 'granted') return;
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', payload });
      return;
    }

    await swReg.showNotification(payload.title || 'Love Arcade', {
      body: payload.body || '',
      tag: payload.tag || 'love-arcade-local',
      data: payload
    });
  }

  async function maybeNotifyDailyClaim(prefs) {
    if (!prefs.dailyClaim) return;
    const canClaim = window.GameCenter?.canClaimDaily?.();
    if (!canClaim) return;

    const dayKey = `daily_${new Date().toISOString().slice(0, 10)}`;
    if (alreadyNotifiedRecently(dayKey, 24 * 60 * 60 * 1000)) return;

    await showLocalNotification({
      title: 'Racha diaria disponible',
      body: 'Tu bono diario ya está listo para reclamar en Love Arcade.',
      tag: 'daily-claim-ready',
      view: 'home',
      url: '/#view=home'
    });
    markNotified(dayKey);
  }

  async function maybeNotifyMoonExpiry(prefs) {
    if (!prefs.moonExpiry) return;
    const status = window.GameCenter?.getMoonBlessingStatus?.();
    const expiry = Number(status?.expiry || 0);
    if (!expiry) return;
    const remaining = expiry - Date.now();
    if (remaining <= 0 || remaining > 12 * 60 * 60 * 1000) return;

    if (alreadyNotifiedRecently('moon_expiry_12h', 8 * 60 * 60 * 1000)) return;

    await showLocalNotification({
      title: 'Tu Bendición Lunar está por vencer',
      body: 'Quedan menos de 12 horas. Renueva para mantener el bono diario extra.',
      tag: 'moon-expiry',
      view: 'shop',
      url: '/#view=shop'
    });
    markNotified('moon_expiry_12h');
  }

  async function maybeNotifyUrgentEvent(prefs) {
    if (!prefs.eventUrgent) return;
    const summary = await window.EventView?.getHomeEventsSummary?.(2);
    const urgent = summary?.urgentEvent;
    const remaining = Number(urgent?.remainingMs || 0);
    if (!urgent || !remaining || remaining > 6 * 60 * 60 * 1000) return;

    const key = `event_urgent_${urgent.id}`;
    if (alreadyNotifiedRecently(key, 6 * 60 * 60 * 1000)) return;

    await showLocalNotification({
      title: 'Evento por terminar',
      body: `${urgent.title} finaliza pronto. Revisa la sección de eventos.`,
      tag: 'event-urgent',
      view: 'events',
      url: '/#view=events'
    });
    markNotified(key);
  }

  async function maybeNotifyShopNews(prefs) {
    if (!prefs.newShop) return;
    const res = await fetch('data/shop.json', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const ids = Array.isArray(data) ? data.map((item) => Number(item.id || 0)).sort((a, b) => a - b) : [];
    const hash = ids.join('-');

    const prev = localStorage.getItem(STORAGE.lastShopHash);
    if (!prev) {
      localStorage.setItem(STORAGE.lastShopHash, hash);
      return;
    }

    if (prev !== hash && !alreadyNotifiedRecently('shop_news', 12 * 60 * 60 * 1000)) {
      await showLocalNotification({
        title: 'Hay novedades en la tienda',
        body: 'Se detectaron cambios en el catálogo de Love Arcade.',
        tag: 'shop-news',
        view: 'shop',
        url: '/#view=shop'
      });
      markNotified('shop_news');
      localStorage.setItem(STORAGE.lastShopHash, hash);
    }
  }

  async function evaluatePredefinedRules() {
    const prefs = loadPrefs();
    if (!prefs.enabled) return;
    if (Notification.permission !== 'granted') return;

    const now = Date.now();
    if (now - lastRuleCheck < 60_000) return;
    lastRuleCheck = now;

    try {
      await maybeNotifyDailyClaim(prefs);
      await maybeNotifyMoonExpiry(prefs);
      await maybeNotifyUrgentEvent(prefs);
      await maybeNotifyShopNews(prefs);
    } catch (_) {
      // silent fail, checks are best-effort
    }
  }

  function bindToggles() {
    const prefs = loadPrefs();
    const map = {
      'push-rule-daily': 'dailyClaim',
      'push-rule-moon': 'moonExpiry',
      'push-rule-shop': 'newShop',
      'push-rule-events': 'eventUrgent'
    };

    Object.entries(map).forEach(([id, key]) => {
      const el = _$(id);
      if (!el) return;
      el.checked = Boolean(prefs[key]);
      el.addEventListener('change', () => {
        const next = loadPrefs();
        next[key] = Boolean(el.checked);
        savePrefs(next);
      });
    });
  }

  function bindManualCampaignForm() {
    const form = _$('push-manual-form');
    const msgEl = _$('push-manual-msg');
    if (!form || !msgEl) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = _$( 'push-manual-title')?.value?.trim();
      const body = _$( 'push-manual-body')?.value?.trim();
      const target = _$( 'push-manual-target')?.value || 'all';
      const scheduledFor = _$( 'push-manual-scheduled')?.value || null;

      if (!title || !body) {
        msgEl.textContent = 'Escribe título y mensaje.';
        msgEl.style.color = 'var(--error, #fc8181)';
        return;
      }

      const sb = window.Sentinel?.getClient?.();
      const session = window.Sentinel?.getSession?.();
      if (!sb || !session?.user?.id) {
        msgEl.textContent = 'Necesitas iniciar sesión para crear campañas manuales.';
        msgEl.style.color = 'var(--error, #fc8181)';
        return;
      }

      msgEl.textContent = 'Guardando campaña…';
      msgEl.style.color = 'var(--text-low)';

      const payload = {
        title,
        body,
        payload_json: {
          title,
          body,
          url: '/#view=home'
        },
        target_filter_json: { target },
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : new Date().toISOString(),
        status: 'pending',
        created_by: session.user.id
      };

      const { error } = await sb.from('push_campaigns').insert(payload);
      if (error) {
        msgEl.textContent = `No se pudo crear la campaña: ${error.message}`;
        msgEl.style.color = 'var(--error, #fc8181)';
        return;
      }

      form.reset();
      msgEl.textContent = 'Campaña manual guardada. Será enviada por el dispatcher de Supabase.';
      msgEl.style.color = 'var(--success, #68d391)';
    });
  }

  function bindButtons() {
    _$( 'btn-push-enable')?.addEventListener('click', async () => {
      try {
        setStatus('Solicitando permiso…');
        await subscribePush();
        const prefs = loadPrefs();
        prefs.enabled = true;
        savePrefs(prefs);
        setStatus('Notificaciones push activadas correctamente.');
      } catch (err) {
        setStatus(err?.message || 'No se pudo activar push.', true);
      }
    });

    _$( 'btn-push-disable')?.addEventListener('click', async () => {
      try {
        await unsubscribePush();
        const prefs = loadPrefs();
        prefs.enabled = false;
        savePrefs(prefs);
        setStatus('Notificaciones desactivadas.');
      } catch (err) {
        setStatus(err?.message || 'No se pudo desactivar push.', true);
      }
    });

    _$( 'btn-push-test')?.addEventListener('click', async () => {
      try {
        await showLocalNotification({
          title: 'Prueba de notificación',
          body: 'Si ves este mensaje, la configuración local funciona.',
          tag: 'push-test',
          view: 'home',
          url: '/#view=home'
        });
        setStatus('Notificación de prueba enviada.');
      } catch (err) {
        setStatus(err?.message || 'No se pudo enviar notificación de prueba.', true);
      }
    });
  }

  function bindServiceWorkerDeepLinkBridge() {
    navigator.serviceWorker?.addEventListener?.('message', (event) => {
      const msg = event.data || {};
      if (msg.type !== 'LA_NOTIFICATION_OPEN') return;
      const url = String(msg.url || '');
      if (url.includes('#view=shop')) window.SpaRouter?.navigateTo?.('shop');
      else if (url.includes('#view=events')) window.SpaRouter?.navigateTo?.('events');
      else window.SpaRouter?.navigateTo?.('home');
    });
  }

  async function init() {
    updateUiSupportState();
    bindButtons();
    bindToggles();
    bindManualCampaignForm();

    if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
      return;
    }

    await fetchPushConfig();
    await registerServiceWorker();
    bindServiceWorkerDeepLinkBridge();

    setInterval(() => {
      evaluatePredefinedRules();
    }, 60_000);

    evaluatePredefinedRules();
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((err) => {
      setStatus(`Error inicializando push: ${err?.message || 'desconocido'}`, true);
    });
  });
})();
