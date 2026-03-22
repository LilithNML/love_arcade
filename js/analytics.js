/**
 * analytics.js — Love Arcade v9.9
 * ─────────────────────────────────────────────────────────────────────────────
 * Sistema de Analíticas "Ghost" — Envía eventos en tiempo real a Discord
 * mediante Webhooks HTTP. Fire-and-forget, sin backend, sin datos personales.
 *
 * DIAGNÓSTICO RÁPIDO (pegar en la consola del navegador):
 *   window.GhostAnalytics.test()
 *
 * Si ves "✅ Ghost Analytics: test enviado" en consola y llega el mensaje
 * a Discord, el módulo está funcionando correctamente.
 * Si ves "❌ Ghost Analytics: error en fetch", revisa la URL del Webhook
 * o si hay una política CSP que bloquea peticiones a discord.com.
 *
 * PARA ACTIVAR LOGS DETALLADOS EN CONSOLA:
 *   window.GhostAnalytics.debug(true)
 *   window.GhostAnalytics.debug(false)  // desactivar
 */

(function() {
  'use strict';
  
  // ── Endpoint — ofuscación XOR (clave: 42) ────────────────────────────────
  // Array generado programáticamente; round-trip verificado mediante Python.
  // Reconstrucción: String.fromCharCode(..._r.map(c => c ^ 42))
  const _r = [
    66, 94, 94, 90, 89, 16, 5, 5, 78, 67, 89, 73, 69, 88,
    78, 4, 73, 69, 71, 5, 75, 90, 67, 5, 93, 79, 72, 66,
    69, 69, 65, 89, 5, 27, 30, 18, 31, 24, 28, 31, 19, 19,
    19, 30, 18, 26, 30, 19, 24, 26, 30, 24, 5, 69, 115, 95,
    122, 103, 75, 27, 115, 92, 122, 99, 109, 112, 66, 76, 124, 109,
    83, 72, 27, 103, 108, 102, 103, 115, 19, 64, 109, 68, 97, 101,
    69, 104, 97, 100, 78, 122, 105, 110, 115, 109, 28, 69, 82, 102,
    125, 108, 124, 83, 121, 88, 91, 73, 101, 83, 69, 92, 120, 66,
    120, 104, 100, 94, 125, 97, 26, 77, 83
  ];
  
  function _endpoint() {
    return String.fromCharCode(..._r.map(c => c ^ 42));
  }
  
  // ── Estado interno ────────────────────────────────────────────────────────
  let _debugMode = false;
  
  function _log(...args) {
    if (_debugMode) console.log('[GhostAnalytics]', ...args);
  }
  
  // ── Metadatos visuales por tipo de evento ─────────────────────────────────
  const EVENT_COLORS = {
    view_preview: 0x9b59ff,
    click_download: 0x22d07a,
    redeem_code: 0xfbbf24,
    open_game: 0x00d4ff,
    detected_error: 0xe11d48
  };
  
  const EVENT_EMOJIS = {
    view_preview: '👁️',
    click_download: '⬇️',
    redeem_code: '🎁',
    open_game: '🎮',
    detected_error: '🚨'
  };
  
  // ── Rate limiting ─────────────────────────────────────────────────────────
  const _lastSent = {};
  const RATE_LIMIT_MS = 3000;
  
  function _isRateLimited(key) {
    const now = Date.now();
    if (_lastSent[key] && (now - _lastSent[key]) < RATE_LIMIT_MS) {
      _log('Rate limited:', key);
      return true;
    }
    _lastSent[key] = now;
    return false;
  }
  
  // ── Envío ─────────────────────────────────────────────────────────────────
  function _send(event, meta) {
    const emoji = EVENT_EMOJIS[event] || '📊';
    const color = EVENT_COLORS[event] || 0x9b59ff;
    const description = meta && Object.keys(meta).length ?
      Object.entries(meta).map(([k, v]) => `**${k}:** ${v}`).join('\n') :
      '*sin metadatos*';
    
    const payload = {
      embeds: [{
        title: `${emoji} ${event.replace(/_/g, ' ').toUpperCase()}`,
        description,
        color,
        footer: { text: 'Love Arcade · Ghost Analytics v9.9' },
        timestamp: new Date().toISOString()
      }]
    };
    
    _log('Enviando evento:', event, meta);
    
    fetch(_endpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => {
        // Discord responde 204 No Content en éxito
        if (res.ok || res.status === 204) {
          _log('✅ Enviado correctamente:', event, `(HTTP ${res.status})`);
        } else {
          console.warn('[GhostAnalytics] HTTP', res.status, '| Evento:', event);
        }
      })
      .catch(err => {
        // Siempre visible — necesario para diagnosticar problemas de red o CSP
        console.error('[GhostAnalytics] ❌ Error de red:', err.message, '| Evento:', event);
      });
  }
  
  // ── API pública ───────────────────────────────────────────────────────────
  
  /**
   * Registra un evento y lo envía al canal de Discord.
   * @param {string} event  — Nombre del evento admitido.
   * @param {object} [meta] — Metadatos opcionales { clave: valor }.
   */
  function track(event, meta) {
    try {
      if (!event || typeof event !== 'string') return;
      const key = `${event}:${JSON.stringify(meta || {})}`;
      if (_isRateLimited(key)) return;
      _send(event, meta || null);
    } catch (err) {
      console.error('[GhostAnalytics] Error interno en track():', err);
    }
  }
  
  /**
   * Envía un evento de prueba a Discord para verificar que el Webhook funciona.
   * Úsalo desde DevTools:  window.GhostAnalytics.test()
   */
  function test() {
    console.log('[GhostAnalytics] Enviando evento de prueba…');
    // Saltamos el rate limiter para que el test siempre se envíe
    _send('open_game', { juego: '✅ TEST — analytics.js funcionando' });
    console.log('[GhostAnalytics] Petición enviada. Revisa el canal de Discord.');
  }
  
  /**
   * Activa o desactiva logs detallados en consola.
   * @param {boolean} enabled
   */
  function debug(enabled) {
    _debugMode = Boolean(enabled);
    console.log(`[GhostAnalytics] Modo debug ${_debugMode ? 'ACTIVADO' : 'desactivado'}.`);
  }
  
  // ── Captura automática de errores globales ────────────────────────────────
  window.addEventListener('error', (e) => {
    track('detected_error', {
      mensaje: (e.message || 'desconocido').slice(0, 100),
      archivo: (e.filename || '').split('/').pop().slice(0, 30) || 'desconocido',
      línea: e.lineno || '?'
    });
  });
  
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason;
    const msg = reason instanceof Error ?
      reason.message :
      String(reason ?? 'Promise rechazada');
    track('detected_error', {
      mensaje: msg.slice(0, 100),
      tipo: 'unhandledrejection'
    });
  });
  
  // ── Confirmación de carga ─────────────────────────────────────────────────
  // Este log confirma que el script se ejecutó correctamente.
  // Si no aparece en la consola, revisa que el <script> está en index.html.
  console.log('[GhostAnalytics] ✅ Módulo cargado. Usa window.GhostAnalytics.test() para verificar Discord.');
  
  // ── Exposición global ─────────────────────────────────────────────────────
  window.GhostAnalytics = Object.freeze({ track, test, debug });
  
})();