(function PushNotificationsModule() {
  'use strict';

  const STORAGE = {
    prefs: 'la_push_prefs_v1'
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
      ? 'Este dispositivo puede recibir recordatorios.'
      : 'Este navegador no permite recordatorios automáticos.';
    supportEl.style.color = supported ? 'var(--success, #68d391)' : 'var(--error, #fc8181)';

    if (!supported) {
      setStatus('Puedes seguir usando Love Arcade sin notificaciones.');
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
      platform: /android/i.test(navigator.userAgent)
        ? 'android'
        : (/iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'other'),
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

  function bindButtons() {
    _$( 'btn-push-enable')?.addEventListener('click', async () => {
      try {
        setStatus('Preparando recordatorios…');
        await subscribePush();
        const prefs = loadPrefs();
        prefs.enabled = true;
        savePrefs(prefs);
        setStatus('¡Listo! Ya recibirás avisos importantes de Love Arcade.');
      } catch (err) {
        setStatus(err?.message || 'No pudimos activar los recordatorios.', true);
      }
    });

    _$( 'btn-push-disable')?.addEventListener('click', async () => {
      try {
        await unsubscribePush();
        const prefs = loadPrefs();
        prefs.enabled = false;
        savePrefs(prefs);
        setStatus('Recordatorios pausados. Puedes activarlos cuando quieras.');
      } catch (err) {
        setStatus(err?.message || 'No pudimos pausar los recordatorios.', true);
      }
    });

    _$( 'btn-push-test')?.addEventListener('click', async () => {
      try {
        await showLocalNotification({
          title: 'Recordatorio de prueba',
          body: '¡Todo bien! Tus avisos están funcionando correctamente.',
          tag: 'push-test',
          view: 'home',
          url: '/#view=home'
        });
        setStatus('Prueba enviada correctamente.');
      } catch (err) {
        setStatus(err?.message || 'No pudimos enviar la prueba.', true);
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

    if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
      return;
    }

    await fetchPushConfig();
    await registerServiceWorker();
    bindServiceWorkerDeepLinkBridge();

    setStatus('Push habilitado. Los envíos automáticos son gestionados por Supabase.');
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((err) => {
      setStatus(`Error inicializando push: ${err?.message || 'desconocido'}`, true);
    });
  });
})();
