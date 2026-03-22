/**
 * analytics.js — Love Arcade v9.9.1
 * ─────────────────────────────────────────────────────────────────────────────
 * Sistema de Analíticas "Ghost" — Captura eventos de interacción y los envía
 * en tiempo real a un canal privado de Discord mediante Webhooks HTTP.
 *
 * CÓMO DIAGNOSTICAR DESDE DEVTOOLS:
 *
 *   1. Verificar que el módulo cargó:
 *      Busca en consola → "[GhostAnalytics] ✅ Módulo listo"
 *
 *   2. Enviar un evento de prueba a Discord:
 *      window.GhostAnalytics.test()
 *
 *   3. Activar logs detallados (muestra cada evento antes de enviarse):
 *      window.GhostAnalytics.debug(true)
 *      → También resetea el rate limiter para poder re-disparar eventos
 *         sin esperar los 3 s.
 *
 *   4. Ver el estado interno actual (rate limiter, modo debug, etc.):
 *      window.GhostAnalytics.status()
 *
 * PRINCIPIOS DE DISEÑO:
 *  - Fire-and-forget: fetch nunca bloquea el hilo principal.
 *  - Sin feedback loop: las peticiones de analytics no disparan el handler
 *    de errores mediante WeakSet de promesas en vuelo.
 *  - Rate limiting: máximo 1 evento idéntico cada 3 s.
 *  - Sin datos personales: sin IPs, IDs de usuario ni cookies.
 *  - Silencioso en producción: ningún console.log salvo errores reales y
 *    el mensaje de carga inicial.
 *  - Degradación elegante: si el módulo no carga, las llamadas con ?.track()
 *    en app.js y shop-logic.js son no-operativas.
 *
 * ORDEN DE CARGA REQUERIDO EN index.html:
 *   <script src="js/analytics.js"></script>   ← primero
 *   <script src="js/app.js"></script>
 *   <script src="js/shop-logic.js"></script>
 *   <script src="js/spa-router.js"></script>
 */

(function () {
    'use strict';

    // ── Endpoint — ofuscación XOR (clave: 42) ────────────────────────────────
    //
    // Array generado programáticamente y verificado con round-trip en Python:
    //   url  = "https://discord.com/api/webhooks/…"
    //   xored = [ord(c) ^ 42 for c in url]
    //   assert ''.join(chr(v ^ 42) for v in xored) == url  # True
    //
    // Reconstrucción en runtime:
    //   String.fromCharCode(..._r.map(c => c ^ 42))
    //
    // No protege contra DevTools; sí evita scrapers de texto plano y grep.
    const _r = [
         66, 94, 94, 90, 89, 16,  5,  5, 78, 67, 89, 73, 69, 88,
         78,  4, 73, 69, 71,  5, 75, 90, 67,  5, 93, 79, 72, 66,
         69, 69, 65, 89,  5, 27, 30, 18, 31, 24, 28, 31, 19, 19,
         19, 30, 18, 26, 30, 19, 24, 26, 30, 24,  5, 69,115, 95,
        122,103, 75, 27,115, 92,122, 99,109,112, 66, 76,124,109,
         83, 72, 27,103,108,102,103,115, 19, 64,109, 68, 97,101,
         69,104, 97,100, 78,122,105,110,115,109, 28, 69, 82,102,
        125,108,124, 83,121, 88, 91, 73,101, 83, 69, 92,120, 66,
        120,104,100, 94,125, 97, 26, 77, 83
    ];

    function _endpoint() {
        return String.fromCharCode(..._r.map(c => c ^ 42));
    }

    // ── Estado interno ────────────────────────────────────────────────────────
    let _debugMode = false;

    /** WeakSet de Promises en vuelo: evita que un fetch fallido de analytics
     *  dispare el handler de unhandledrejection y genere un bucle infinito. */
    const _pendingFetches = new WeakSet();

    /** Cache del rate limiter: clave → timestamp del último envío. */
    const _lastSent = {};

    /** Intervalo mínimo entre eventos con la misma clave (ms). */
    const RATE_LIMIT_MS = 3000;

    // ── Metadatos visuales por tipo de evento ─────────────────────────────────

    const EVENT_COLORS = {
        view_preview:   0x9b59ff,   // Violeta
        click_download: 0x22d07a,   // Verde esmeralda
        buy_item:       0xfbbf24,   // Dorado
        redeem_code:    0xff59b4,   // Rosa neón
        open_game:      0x00d4ff,   // Cyan Arcade
        detected_error: 0xe11d48    // Carmesí
    };

    const EVENT_EMOJIS = {
        view_preview:   '👁️',
        click_download: '⬇️',
        buy_item:       '🛒',
        redeem_code:    '🎁',
        open_game:      '🎮',
        detected_error: '🚨'
    };

    // ── Logging condicional ───────────────────────────────────────────────────

    function _log(...args) {
        if (_debugMode) console.log('%c[GhostAnalytics]', 'color:#9b59ff;font-weight:bold', ...args);
    }

    // ── Rate limiting ─────────────────────────────────────────────────────────

    function _isRateLimited(key) {
        const now = Date.now();
        if (_lastSent[key] !== undefined && (now - _lastSent[key]) < RATE_LIMIT_MS) {
            _log('⏱ Rate limited (', Math.round((RATE_LIMIT_MS - (now - _lastSent[key])) / 1000), 's restantes):', key);
            return true;
        }
        _lastSent[key] = now;
        return false;
    }

    // ── Envío ─────────────────────────────────────────────────────────────────

    /**
     * Construye el embed de Discord y lo envía.
     * Fire-and-forget: el caller nunca espera. Los errores de red se loguean
     * en consola pero nunca se propagan.
     *
     * @param {string}      event
     * @param {object|null} meta
     * @param {boolean}     [isTest=false]  Omite el rate limiter.
     */
    function _send(event, meta, isTest) {
        const emoji       = EVENT_EMOJIS[event] || '📊';
        const color       = EVENT_COLORS[event]  || 0x9b59ff;
        const description = (meta && Object.keys(meta).length)
            ? Object.entries(meta).map(([k, v]) => `**${k}:** ${v}`).join('\n')
            : '*sin metadatos*';

        const payload = {
            embeds: [{
                title:       `${emoji} ${event.replace(/_/g, ' ').toUpperCase()}`,
                description,
                color,
                footer:    { text: `Love Arcade · Ghost Analytics v9.9.1${isTest ? ' · TEST' : ''}` },
                timestamp: new Date().toISOString()
            }]
        };

        _log('→ Enviando:', event, meta || '');

        // keepalive:true — el request sobrevive a navegaciones de página.
        const promise = fetch(_endpoint(), {
            method:    'POST',
            headers:   { 'Content-Type': 'application/json' },
            body:      JSON.stringify(payload),
            keepalive: true
        });

        // Registrar en WeakSet ANTES de encadenar then/catch para que el
        // handler de unhandledrejection pueda identificarlo como propio.
        _pendingFetches.add(promise);

        promise
            .then(res => {
                // Discord responde 204 No Content en éxito; cualquier 2xx es válido.
                if (res.ok || res.status === 204) {
                    _log('✅ Entregado:', event, `(HTTP ${res.status})`);
                } else {
                    // Errores 4xx/5xx del Webhook (URL revocada, canal eliminado…)
                    console.warn('[GhostAnalytics] Webhook respondió HTTP', res.status,
                        '— Evento:', event,
                        '| Posibles causas: URL revocada, canal eliminado, Webhook desactivado.');
                }
            })
            .catch(err => {
                // Error de red (sin conexión, CORS, timeout). Siempre visible en
                // consola para que sea diagnosticable, nunca silenciado.
                console.error(
                    '[GhostAnalytics] ❌ Error de red al enviar "' + event + '":',
                    err.message,
                    '\n  Posibles causas:',
                    '\n  · Sin conexión a internet',
                    '\n  · CSP del servidor bloquea peticiones a discord.com',
                    '\n  · URL del Webhook inválida o caducada',
                    '\n  → Ejecuta window.GhostAnalytics.test() para diagnosticar.'
                );
            });
    }

    // ── API pública ───────────────────────────────────────────────────────────

    /**
     * Registra un evento analítico y lo envía al canal de Discord.
     *
     * Uso:
     *   window.GhostAnalytics.track('view_preview',   { wallpaper: 'Cyber Neon' });
     *   window.GhostAnalytics.track('click_download', { wallpaper: 'Cyber Neon', fuente: 'biblioteca' });
     *   window.GhostAnalytics.track('buy_item',       { wallpaper: 'Cyber Neon', precio: 500, cashback: 50 });
     *   window.GhostAnalytics.track('redeem_code',    { recompensa: 1000, código: 'PVZ***' });
     *   window.GhostAnalytics.track('open_game',      { juego: 'dodge' });
     *   window.GhostAnalytics.track('detected_error', { mensaje: '...', tipo: '...' });
     *
     * @param {string} event   Nombre del evento.
     * @param {object} [meta]  Metadatos opcionales.
     */
    function track(event, meta) {
        try {
            if (!event || typeof event !== 'string') return;
            const key = `${event}:${JSON.stringify(meta || {})}`;
            if (_isRateLimited(key)) return;
            _send(event, meta || null);
        } catch (err) {
            // Error interno inesperado — nunca debe romper la UI
            console.error('[GhostAnalytics] Error interno en track():', err);
        }
    }

    /**
     * Envía un evento de prueba a Discord, saltando el rate limiter.
     * Confirma que el Webhook está activo y que el módulo está funcionando.
     *
     * Ejecutar desde DevTools:  window.GhostAnalytics.test()
     */
    function test() {
        console.log('[GhostAnalytics] Enviando evento de prueba…');
        _send('open_game', {
            juego: '✅ TEST — Webhook activo y módulo cargado correctamente'
        }, /* isTest= */ true);
        console.log('[GhostAnalytics] Petición enviada. Revisa el canal de Discord.');
    }

    /**
     * Activa o desactiva logs detallados en consola.
     * Al activar, resetea el rate limiter para poder re-disparar eventos
     * inmediatamente sin esperar los 3 s.
     *
     * Ejecutar desde DevTools:
     *   window.GhostAnalytics.debug(true)   // activar
     *   window.GhostAnalytics.debug(false)  // desactivar
     *
     * @param {boolean} enabled
     */
    function debug(enabled) {
        _debugMode = Boolean(enabled);
        if (_debugMode) {
            // Limpiar rate limiter para que los próximos eventos se envíen de inmediato
            Object.keys(_lastSent).forEach(k => delete _lastSent[k]);
            console.log(
                '%c[GhostAnalytics] 🔍 Modo debug ACTIVADO',
                'color:#9b59ff;font-weight:bold',
                '\n  → Rate limiter reseteado. Todos los eventos se loguearán.',
                '\n  → Dispara cualquier acción en la UI para ver los eventos.',
                '\n  → Desactivar con: window.GhostAnalytics.debug(false)'
            );
        } else {
            console.log('[GhostAnalytics] Modo debug desactivado.');
        }
    }

    /**
     * Muestra el estado interno del módulo en consola.
     * Útil para verificar qué eventos están siendo rate-limitados.
     *
     * Ejecutar desde DevTools:  window.GhostAnalytics.status()
     */
    function status() {
        const now  = Date.now();
        const keys = Object.keys(_lastSent);
        const rl   = keys.map(k => {
            const remainingMs = RATE_LIMIT_MS - (now - _lastSent[k]);
            return `  · ${k}  →  ${remainingMs > 0 ? `rate-limited (${Math.ceil(remainingMs / 1000)}s)` : 'libre'}`;
        });
        console.log(
            '%c[GhostAnalytics] Estado actual',
            'color:#9b59ff;font-weight:bold',
            `\n  Debug mode: ${_debugMode}`,
            `\n  Rate limiter (${keys.length} clave${keys.length !== 1 ? 's' : ''}):\n${rl.join('\n') || '  (vacío)'}`
        );
    }

    // ── Captura automática de errores globales ────────────────────────────────

    /**
     * Clasifica un error según su constructor para enriquecer el mensaje de Discord.
     * @param {Error|null} err
     * @returns {string}
     */
    function _classifyError(err) {
        if (!err) return 'Error desconocido';
        const name = err.constructor?.name || err.name || 'Error';
        const knownTypes = {
            TypeError:        'TypeError — acceso a propiedad/método inválido',
            ReferenceError:   'ReferenceError — variable no definida',
            SyntaxError:      'SyntaxError — código mal formado',
            RangeError:       'RangeError — valor fuera de rango permitido',
            URIError:         'URIError — URI malformado',
            NetworkError:     'NetworkError — fallo de red',
            AbortError:       'AbortError — petición cancelada',
            TimeoutError:     'TimeoutError — tiempo de espera agotado',
            NotFoundError:    'NotFoundError — recurso no encontrado',
            SecurityError:    'SecurityError — violación de política de seguridad'
        };
        return knownTypes[name] || name;
    }

    /**
     * Extrae el primer frame relevante del stack trace de un Error.
     * Descarta frames internos del navegador (chrome-extension://, etc.)
     * @param {Error|null} err
     * @returns {string}
     */
    function _firstStackFrame(err) {
        if (!err?.stack) return '';
        const lines = err.stack.split('\n').slice(1); // saltar la primera línea (mensaje)
        for (const line of lines) {
            const trimmed = line.trim();
            // Ignorar frames del navegador o extensiones
            if (!trimmed || trimmed.includes('chrome-extension://') ||
                trimmed.includes('extensions::')) continue;
            // Extraer solo la parte útil: "en funcion (archivo:linea:col)"
            return trimmed.replace(/^\s*at\s+/, '').slice(0, 80);
        }
        return '';
    }

    /**
     * Determina si una URL apunta a un recurso de la plataforma (no externo).
     * @param {string} url
     * @returns {boolean}
     */
    function _isLocalFile(url) {
        if (!url) return false;
        const origin = window.location.origin;
        return url.startsWith(origin) || url.startsWith('/') || url.startsWith('./');
    }

    // ── Handler: errores síncronos (window.onerror) ───────────────────────────
    window.addEventListener('error', (e) => {
        try {
            const err  = e.error;
            const tipo = _classifyError(err);
            const frame = _firstStackFrame(err);

            // Filtrar errores de recursos externos (imágenes, CDN, etc.)
            // El evento 'error' con e.target !== window es un error de carga de recurso,
            // no un error de JS — no es relevante para analytics.
            if (e.target && e.target !== window) return;

            const meta = {
                tipo:    tipo.slice(0, 60),
                mensaje: (e.message || 'sin mensaje').slice(0, 120)
            };

            // Añadir archivo solo si es un fichero de la plataforma (no CDN externo)
            const archivo = (e.filename || '').split('/').pop();
            if (archivo) meta.archivo = `${archivo}:${e.lineno || '?'}`;

            // Añadir stack frame si aporta contexto
            if (frame) meta.stack = frame;

            track('detected_error', meta);
        } catch (_) { /* nunca propagar */ }
    });

    // ── Handler: promesas rechazadas sin capturar ─────────────────────────────
    window.addEventListener('unhandledrejection', (e) => {
        try {
            // Evitar feedback loop: ignorar rechazos que vienen de nuestros propios fetchs
            if (_pendingFetches.has(e.promise)) return;

            const reason = e.reason;
            let mensaje, tipo;

            if (reason instanceof Error) {
                tipo    = _classifyError(reason);
                mensaje = reason.message || 'sin mensaje';
            } else if (typeof reason === 'string') {
                tipo    = 'Rejection string';
                mensaje = reason;
            } else if (reason === null || reason === undefined) {
                tipo    = 'Rejection vacía';
                mensaje = 'Promise rechazada sin motivo';
            } else {
                tipo    = 'Rejection object';
                mensaje = JSON.stringify(reason).slice(0, 100);
            }

            // "Failed to fetch": añadir contexto de la página actual
            if (mensaje.includes('Failed to fetch') || mensaje.includes('NetworkError')) {
                tipo    = 'NetworkError — fallo de red o CSP';
                mensaje = `${mensaje} (página: ${window.location.pathname})`;
            }

            const meta = {
                tipo:    tipo.slice(0, 80),
                mensaje: mensaje.slice(0, 120)
            };

            // Stack del reason si está disponible
            const frame = _firstStackFrame(reason instanceof Error ? reason : null);
            if (frame) meta.stack = frame;

            track('detected_error', meta);
        } catch (_) { /* nunca propagar */ }
    });

    // ── Confirmación de carga ─────────────────────────────────────────────────
    // Este log es el primer punto de diagnóstico: si no aparece, el <script>
    // no está incluido en index.html o hay un error de sintaxis en el módulo.
    console.log(
        '[GhostAnalytics] ✅ Módulo listo (v9.9.1).',
        '| test(): probar Webhook',
        '| debug(true): activar logs',
        '| status(): ver estado interno'
    );

    // ── Exposición global ─────────────────────────────────────────────────────
    window.GhostAnalytics = Object.freeze({ track, test, debug, status });

})();