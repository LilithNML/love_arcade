/**
 * analytics.js — Love Arcade v10.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Sistema de Analíticas "Ghost" — Captura eventos de interacción y los envía
 * en tiempo real a un canal privado de Discord mediante Webhooks HTTP.
 *
 * CAMBIOS v10.0 (Shadow-Gate — Developer Exclusion Filter):
 *  - Nuevo filtro Shadow-Gate: detecta el token ofuscado `?ref=x92_v0id_z1`
 *    en window.location.search al cargar el script.
 *  - Si el token está presente, se persiste un flag en sessionStorage bajo
 *    la clave `ghost_ignore` con valor `'true'`.
 *  - La exclusión se mantiene activa mientras la pestaña esté abierta
 *    (incluyendo navegaciones SPA y refrescos), y se anula al cerrar la pestaña.
 *  - track() verifica el flag en cada llamada mediante _isShadowGated().
 *    Si la exclusión está activa, el evento se descarta silenciosamente.
 *  - Los handlers de error globales (window.error / unhandledrejection) también
 *    quedan silenciados cuando Shadow-Gate está activo.
 *  - status() ahora informa si la sesión está bajo Shadow-Gate.
 *  - El token no contiene palabras como "admin" o "dev" para pasar desapercibido
 *    como un parámetro de tracking genérico en logs de red.
 *
 * CAMBIOS v9.9.2 (Hardening & Error Detection):
 *  - De-duplicación de redeem_code: track() eliminado de app.js/redeemPromoCode();
 *    el único punto de disparo es handleRedeem() en shop-logic.js (fin de la
 *    cadena de éxito de UI), eliminando el doble reporte anterior.
 *  - detected_error enriquecido con contexto forense: nueva función privada
 *    _getExecutionContext() que añade url, online, mem_mb y vista a cada error
 *    capturado por los handlers de window.error y unhandledrejection.
 *  - Nuevo evento invalid_promo_code: disparado en handleRedeem() cuando el
 *    código no existe en PROMO_CODES_HASHED, diferenciando intentos de adivinar
 *    códigos de errores reales de lógica.
 *  - Nuevo evento insufficient_funds: disparado en buyItem() y buyMoonBlessing()
 *    de app.js, registra wallpaper, precio y saldo actual para diagnóstico de
 *    precios elevados o HUD de saldo poco claro.
 *  - Nuevo evento wishlist_add: disparado al añadir (no al quitar) un ítem a
 *    la lista de deseos. Permite detectar tendencias de catálogo.
 *  - Nuevo evento daily_bonus: disparado en claimDaily() en éxito; registra
 *    recompensa base, bonus lunar y racha sin saturar el canal con intentos fallidos.
 *  - Nuevo evento user_snapshot: enviado UNA SOLA VEZ por sesión (sessionStorage)
 *    tras la carga del catálogo, con saldo, items comprados / disponibles, racha y
 *    códigos canjeados. No se repite en navigations SPA ni retries del catálogo.
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
 *   4. Ver el estado interno actual (rate limiter, modo debug, Shadow-Gate, etc.):
 *      window.GhostAnalytics.status()
 *
 * ACTIVAR SHADOW-GATE (exclusión de analíticas para el desarrollador):
 *
 *   Abre la plataforma con el token en la URL:
 *     https://tudominio.com/?ref=x92_v0id_z1
 *
 *   El flag se guarda en sessionStorage. A partir de ese momento, track()
 *   no enviará ningún evento durante toda la sesión, aunque navegues por
 *   otras páginas o refresques. Al cerrar la pestaña el flag se elimina.
 *
 *   Para verificar que está activo:
 *     window.GhostAnalytics.status()
 *     → "Shadow-Gate: ACTIVO 🔕 — esta sesión está excluida de las analíticas"
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

    // ── Shadow-Gate v10.0 — Developer Exclusion Filter ────────────────────────
    //
    // Token de alta entropía diseñado para pasar desapercibido como un
    // parámetro UTM/tracking genérico en logs de red y herramientas de QA.
    // No contiene palabras clave como "admin", "dev" o "test".
    //
    // URL de activación:  https://tudominio.com/?ref=x92_v0id_z1
    //
    // Una vez activado, el flag `ghost_ignore` en sessionStorage persiste
    // mientras la pestaña esté abierta (incluyendo refrescos y navegación SPA).
    // Al cerrar la pestaña sessionStorage se vacía automáticamente.
    //
    const _SHADOW_TOKEN = 'x92_v0id_z1';
    const _SHADOW_KEY   = 'ghost_ignore';

    /**
     * Detecta el token Shadow-Gate en la URL y activa la exclusión.
     * Se ejecuta de forma inmediata al cargar el script, antes de que
     * cualquier evento o función del módulo pueda dispararse.
     */
    (function _shadowGateInit() {
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.get('ref') === _SHADOW_TOKEN) {
                sessionStorage.setItem(_SHADOW_KEY, 'true');
            }
        } catch (_) { /* silencioso — sessionStorage puede estar bloqueado en modo privado */ }
    })();

    /**
     * Devuelve true si la sesión actual está bajo Shadow-Gate.
     * Envuelto en try/catch para no romper el módulo si sessionStorage
     * no está disponible (p. ej. iframes con sandbox estricto).
     *
     * @returns {boolean}
     */
    function _isShadowGated() {
        try {
            return sessionStorage.getItem(_SHADOW_KEY) === 'true';
        } catch (_) {
            return false;
        }
    }

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
        view_preview:        0x9b59ff,   // Violeta
        click_download:      0x22d07a,   // Verde esmeralda
        buy_item:            0xfbbf24,   // Dorado
        redeem_code:         0xff59b4,   // Rosa neón
        open_game:           0x00d4ff,   // Cyan Arcade
        detected_error:      0xe11d48,   // Carmesí
        // ── v9.9.2 ──────────────────────────────────────────────────────────
        invalid_promo_code:  0xf97316,   // Naranja — intento de código incorrecto
        insufficient_funds:  0xef4444,   // Rojo — intento de compra sin saldo
        wishlist_add:        0xec4899,   // Rosa — ítem añadido a la lista de deseos
        daily_bonus:         0x4ade80,   // Verde lima — bono diario reclamado
        user_snapshot:       0x38bdf8,   // Celeste — instantánea de estado por sesión
        sync_export:         0xa78bfa    // Violeta suave — exportación de partida
    };

    const EVENT_EMOJIS = {
        view_preview:        '👁️',
        click_download:      '⬇️',
        buy_item:            '🛒',
        redeem_code:         '🎁',
        open_game:           '🎮',
        detected_error:      '🚨',
        // ── v9.9.2 ──────────────────────────────────────────────────────────
        invalid_promo_code:  '🔑',
        insufficient_funds:  '💸',
        wishlist_add:        '💜',
        daily_bonus:         '🌟',
        user_snapshot:       '📊',
        sync_export:         '💾'
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
                footer:    { text: `Love Arcade · Ghost Analytics v10.0${isTest ? ' · TEST' : ''}` },
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
     * Si Shadow-Gate está activo (_isShadowGated() === true), el evento se
     * descarta silenciosamente sin enviar ninguna petición HTTP.
     *
     * @param {string} event   Nombre del evento.
     * @param {object} [meta]  Metadatos opcionales.
     */
    function track(event, meta) {
        try {
            // ── Shadow-Gate: salida temprana si la sesión está excluida ──────
            if (_isShadowGated()) return;

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
     * Nota: test() respeta Shadow-Gate. Si la sesión está excluida, se
     * muestra un aviso en consola en lugar de enviar la petición.
     *
     * Ejecutar desde DevTools:  window.GhostAnalytics.test()
     */
    function test() {
        if (_isShadowGated()) {
            console.warn(
                '%c[GhostAnalytics] 🔕 Shadow-Gate activo',
                'color:#f97316;font-weight:bold',
                '— test() bloqueado. Esta sesión está excluida de las analíticas.',
                '\n  Para desactivar: sessionStorage.removeItem(\'ghost_ignore\') y recarga.'
            );
            return;
        }
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
     * Incluye el estado de Shadow-Gate, modo debug y rate limiter.
     *
     * Ejecutar desde DevTools:  window.GhostAnalytics.status()
     */
    function status() {
        const now      = Date.now();
        const keys     = Object.keys(_lastSent);
        const gated    = _isShadowGated();
        const rl       = keys.map(k => {
            const remainingMs = RATE_LIMIT_MS - (now - _lastSent[k]);
            return `  · ${k}  →  ${remainingMs > 0 ? `rate-limited (${Math.ceil(remainingMs / 1000)}s)` : 'libre'}`;
        });
        console.log(
            '%c[GhostAnalytics] Estado actual',
            'color:#9b59ff;font-weight:bold',
            `\n  Shadow-Gate: ${gated
                ? '🔕 ACTIVO — esta sesión está excluida de las analíticas'
                : '✅ inactivo — analíticas operativas'}`,
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

    // ── Contexto de ejecución forense (v9.9.2) ────────────────────────────────

    /**
     * Construye el contexto de ejecución forense para enriquecer los eventos
     * detected_error. Nunca lanza — envuelto en try/catch para no afectar el
     * flujo de reporte de errores.
     *
     * Campos devueltos:
     *  - url      Ruta completa (máx 120 chars), útil para reproducir el error.
     *  - online   'sí' | 'no' — distingue fallos de código de fallos de red.
     *  - mem_mb   Heap JS usado en MB (solo Chrome/Edge; omitido en otros).
     *  - vista    Vista SPA activa ('home' | 'shop') como breadcrumb.
     *
     * @returns {object}
     */
    function _getExecutionContext() {
        try {
            const ctx = {};

            // Ruta completa — permite reproducir el error en el mismo contexto
            const href = window.location.href;
            ctx.url = href.length > 120 ? href.slice(0, 117) + '…' : href;

            // Estado de red — si offline, el error probablemente es de red, no de código
            ctx.online = navigator.onLine ? 'sí' : 'no';

            // Memoria JS (Chrome/Edge únicamente; performance.memory es no-estándar)
            // Útil para detectar fugas de memoria en gama baja que provoquen crashes.
            const mem = performance?.memory;
            if (mem?.usedJSHeapSize) {
                ctx.mem_mb = (mem.usedJSHeapSize / 1_048_576).toFixed(1) + ' MB';
            }

            // Vista SPA activa: breadcrumb que indica dónde estaba el usuario
            const view = window.SpaRouter?.getCurrentView?.();
            if (view) ctx.vista = view;

            return ctx;
        } catch (_) {
            return {}; // Nunca propagar un error desde el sistema de errores
        }
    }

    // ── Handler: errores síncronos (window.onerror) ───────────────────────────
    window.addEventListener('error', (e) => {
        try {
            // Shadow-Gate: silenciar también los handlers de error globales
            if (_isShadowGated()) return;

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

            // [v9.9.2] Contexto forense: url, online, mem_mb, vista
            Object.assign(meta, _getExecutionContext());

            track('detected_error', meta);
        } catch (_) { /* nunca propagar */ }
    });

    // ── Handler: promesas rechazadas sin capturar ─────────────────────────────
    window.addEventListener('unhandledrejection', (e) => {
        try {
            // Shadow-Gate: silenciar también los handlers de error globales
            if (_isShadowGated()) return;

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

            // [v9.9.2] Contexto forense: url, online, mem_mb, vista
            Object.assign(meta, _getExecutionContext());

            track('detected_error', meta);
        } catch (_) { /* nunca propagar */ }
    });

    // ── Confirmación de carga ─────────────────────────────────────────────────
    // Este log es el primer punto de diagnóstico: si no aparece, el <script>
    // no está incluido en index.html o hay un error de sintaxis en el módulo.
    // Si Shadow-Gate está activo, se indica explícitamente para que el
    // desarrollador sepa que la sesión está en modo silencioso.
    if (_isShadowGated()) {
        console.log(
            '%c[GhostAnalytics] 🔕 Módulo cargado en modo silencioso (v10.0) — Shadow-Gate activo.',
            'color:#f97316;font-weight:bold',
            '| Esta sesión está excluida de las analíticas.',
            '| status(): ver estado | debug(true): activar logs'
        );
    } else {
        console.log(
            '[GhostAnalytics] ✅ Módulo listo (v10.0).',
            '| test(): probar Webhook',
            '| debug(true): activar logs',
            '| status(): ver estado interno'
        );
    }

    // ── Exposición global ─────────────────────────────────────────────────────
    window.GhostAnalytics = Object.freeze({ track, test, debug, status });

})();