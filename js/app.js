/**
 * Game Center Core v11.0 — Meta-Gameplay & Event Engine
 * Compatible con gamecenter_v6_promos — migración silenciosa incluida.
 *
 * NOVEDADES v11.0 (Meta-Gameplay & Event Engine):
 *  - addCoins(amount): nuevo método público de GameCenter que permite a
 *    event-logic.js depositar monedas sin pasar por completeLevel().
 *    Usado por la Cacería de Tesoros y el Gachapón Relámpago.
 *  - Multiplicador de bonificación con expiración: store.bonus_multiplier y
 *    store.bonus_multiplier_expires. completeLevel() aplica el multiplicador
 *    si Date.now() < bonus_multiplier_expires antes de sumar al saldo.
 *  - Evento personalizado 'la:levelcomplete': completeLevel() despacha este
 *    CustomEvent en document tras cada pago exitoso. event-logic.js lo escucha
 *    para actualizar el progreso de Hitos Personales y Misiones del Día sin
 *    acoplamiento directo entre módulos.
 *  - Contador de sesiones de juego: incrementMissionStat(stat, delta) expuesto
 *    en GameCenter. Actualiza store.missions con estadísticas diarias (juegos
 *    jugados, tiempo activo en segundos). Se reinicia automáticamente si la
 *    fecha cambia respecto a missions.date.
 *  - Tracker de tiempo activo: setInterval de 1 s en DOMContentLoaded que suma
 *    al contador de playtime solo cuando document.visibilityState === 'visible'.
 *  - getMissionStats(): devuelve las estadísticas del día actual del store.
 *  - getBonusMultiplierStatus(): devuelve el estado del multiplicador activo.
 *  - migrateState(): incorpora los campos bonus_multiplier, bonus_multiplier_expires
 *    y missions con valores seguros por defecto.
 *
 * NOVEDADES v10.2 (External Game Event Fix):
 *  - isEventActive(): el stub seguro ya no devuelve siempre false. Ahora lee
 *    el caché 'love_arcade_events_v1' de localStorage, escrito por event-logic.js
 *    cada vez que carga events.json con éxito. Esto garantiza que los juegos
 *    externos (games/*.html) apliquen el multiplicador de Invasión de Monedas
 *    y cualquier otro efecto de evento aunque no carguen event-logic.js.
 *    TTL del caché: 24 horas. Comportamiento conservador (devuelve false) si
 *    el caché está ausente, expirado o malformado.
 *  - Comentario del stub actualizado para documentar el contrato de caché.
 *
 *
 * NOVEDADES v10.0 (LTE Events System):
 *  - isEventActive(id): función global stub definida aquí como fallback seguro.
 *    La implementación real vive en event-logic.js y sobreescribe este stub al
 *    cargarse. Permite que claimDaily() y completeLevel() llamen a isEventActive()
 *    independientemente del orden de carga de los módulos.
 *  - claimDaily(): incorpora streak_boost_v1. Si el evento está activo, el
 *    incremento de racha pasa de +1 a +2 (max continúa siendo dailyStreakCap).
 *  - completeLevel(): incorpora coin_invasion_v1. Si el evento está activo,
 *    el rewardAmount se multiplica por 1.5 antes de sumarse al saldo.
 *
 * NOVEDADES v9.9.2 (Hardening & Error Detection):
 *  - Eliminado track('redeem_code') de redeemPromoCode(): la fuente única de
 *    disparo es handleRedeem() en shop-logic.js, al final de la cadena de éxito
 *    de UI. Elimina el doble reporte que saturaba el canal de Discord.
 *  - buyItem(): nueva rama de tracking insufficient_funds cuando reason === 'coins'.
 *    Registra wallpaper, precio final y saldo actual para detectar si los precios
 *    son demasiado elevados o el HUD de saldo no es claro para el usuario.
 *  - buyMoonBlessing(): ídem para insufficient_funds; registra el costo del buff
 *    y el saldo disponible.
 *  - claimDaily(): nuevo track('daily_bonus') en la rama de éxito. Registra
 *    recompensa total, racha y si la Bendición Lunar contribuyó. Solo disparado
 *    en éxito para no saturar el canal con intentos fallidos del botón.
 *  - GameCenter.getRedeemedCount(): nuevo método expuesto que devuelve el número
 *    de códigos ya canjeados, usado por el user_snapshot de shop-logic.js.
 *
 * NOVEDADES v9.9 (Ghost Analytics):
 *  - Integración con el módulo analytics.js (debe cargarse ANTES en el HTML).
 *  - Evento open_game: delegación global en DOMContentLoaded sobre cualquier
 *    <a href*="games/"> para registrar qué minijuego fue abierto.
 *  - Evento redeem_code: llamada a GhostAnalytics.track() dentro de
 *    redeemPromoCode() cuando el canje es exitoso. El código original nunca
 *    se envía; se trunca con *** para proteger el texto plano.
 *  - Los eventos detected_error se capturan automáticamente en analytics.js
 *    mediante window.addEventListener('error') y 'unhandledrejection'.
 *  - Todas las llamadas usan optional chaining (?.) para ser no-operativas
 *    si analytics.js no está cargado (degradación elegante).
 *
 * NOVEDADES v9.4 (Identity Update):
 *  - store.nickname (string, max 15 chars): nombre personalizado del usuario.
 *  - store.gender ('o'|'a'|'@'): sufijo del saludo ("Bienvenid@").
 *  - migrateState(): incluye validación silenciosa de ambos campos nuevos.
 *  - applyIdentity(): escribe nickname y sufijo en el DOM de forma síncrona
 *    antes de revealUI(), manteniendo la Zero-Flicker Initiative.
 *  - GameCenter.setIdentity(nickname, gender): guarda y aplica identidad.
 *  - GameCenter.getIdentity(): lectura segura de nickname y gender.
 *  - GameCenter.hasIdentity(): comprueba si el nickname está configurado.
 *  - Flujo de bienvenida: si nickname está vacío al cargar, el inline script
 *    de index.html muestra el Identity Modal y llama a revealUI() al confirmar.
 *    El .player-hud permanece en opacity:0 durante ese tiempo.
 *
 * NOVEDADES v9.3 (Zero-Flicker Initiative):
 *  - Script crítico inline en <head> de index.html: lee el tema del
 *    localStorage y sobreescribe los CSS custom properties en :root ANTES
 *    del primer paint, eliminando el "salto violeta" al 100%.
 *  - INIT síncrono: applyTheme(), init de saldo, updateDailyButton(),
 *    updateMoonBlessingUI() y applyAvatar() se ejecutan síncronamente al
 *    final de <body> (fuera de DOMContentLoaded). Dado que app.js está al
 *    final del body, el DOM ya existe pero el navegador aún no ha pintado,
 *    por lo que todos los valores correctos se escriben antes del primer frame.
 *  - revealUI(): añade .is-ready y .coin-badge--visible en el siguiente RAF,
 *    garantizando que los contenedores de datos críticos sólo se revelan
 *    después de que sus valores reales han sido escritos.
 *  - styles.css: .player-hud y .hud-avatar-wrap comienzan con opacity:0 y
 *    transicionan a 1 cuando reciben .is-ready.
 *
 * NOVEDADES v9.2 (Font FOIT/FOUT, Coin Init & Treasury Grid):
 *  - Init silencioso del saldo: escribe el valor formateado síncronamente.
 *  - .coin-badge--visible: fade-in de 150ms tras la sincronización inicial.
 *
 * NOVEDADES v9.1 (History API, Retry UI & Theme Fix):
 *  - applyTheme(): clase theme-{key} en <body> + data-theme en <html>.
 *
 * NOVEDADES v9.0 (SPA Migration):
 *  - Arquitectura SPA unificada. shop.html eliminado.
 *  - getState(), syncUI() expuestos para módulos externos.
 *
 * NOVEDADES v8.1 (Daily Claim Security):
 *  - _syncTimeBackground() / _readTimeCache(): verificación de tiempo desacoplada del reclamo (v9.6).
 */

// =====================================================
// CONFIGURACIÓN GLOBAL
// =====================================================
const CONFIG = {
    stateKey:      'gamecenter_v6_promos', // ← NO modificar jamás
    initialCoins:  0,
    dailyReward:   20,     // Monedas base del día 1 (se escala con racha)
    dailyStreakCap: 60,    // Máximo de monedas por bono diario
    dailyStreakStep: 5,    // Incremento por día de racha
    wallpapersPath: 'https://res.cloudinary.com/dyspgn0sw/image/upload/'
};
// Exponer globalmente para que shop-logic.js pueda acceder a CONFIG.wallpapersPath
// sin depender del scope de cierre del bundle (resuelve fragilidad en módulos ES).
window.CONFIG = CONFIG;

// Salt para checksums de sincronización — mantener secreto
const SYNC_SALT = 'love_arcade_v75_integrity_2026';

// =====================================================
// ECONOMÍA — Editar aquí para eventos especiales
// =====================================================
const ECONOMY = {
    isSaleActive:   false,
    saleMultiplier: 0.9,
    saleLabel:      '10% OFF',
    cashbackRate:   0.1
};
window.ECONOMY = ECONOMY;

// =====================================================
// EVENTOS POR TIEMPO LIMITADO — Implementación con fallback a localStorage
//
// [v10.2 — FIX external games] La implementación completa vive en
// event-logic.js y sobreescribe esta función al cargar. Sin embargo,
// los juegos externos (games/*.html) ejecutan app.js en su propio contexto
// de página, sin cargar event-logic.js. Para que el multiplicador de monedas
// y otros efectos de evento funcionen también en esos contextos, esta
// implementación lee el caché que event-logic.js persiste en localStorage
// ('love_arcade_events_v1') cada vez que carga events.json con éxito.
//
// Contrato del caché:
//   localStorage['love_arcade_events_v1'] = JSON.stringify({ data: {…}, ts: number })
//   Clave 'data': objeto idéntico a la respuesta de events.json.
//   Clave 'ts':   timestamp (ms) de la última escritura.
//   TTL:          24 horas. Pasado ese tiempo se ignora y la función devuelve
//                 false de forma conservadora hasta la próxima visita al hub.
//
// Si event-logic.js ESTÁ cargado (contexto del hub), sobreescribirá esta
// función con la implementación en memoria, más eficiente. El resultado
// observable es idéntico en ambos casos.
// =====================================================
if (typeof window.isEventActive !== 'function') {
    window.isEventActive = function(eventId) {
        try {
            const raw = localStorage.getItem('love_arcade_events_v1');
            if (!raw) return false;
            const { data, ts } = JSON.parse(raw);
            // Caché expirado (> 24 h) → conservador: negar
            if (!data || (Date.now() - ts) > 86_400_000) return false;
            const ev = (data.activeEvents || []).find(e => e.id === eventId);
            if (!ev) return false;
            return Date.now() < new Date(ev.endDate).getTime();
        } catch (_) {
            return false;
        }
    };
}

// =====================================================
// TEMAS
// =====================================================
const THEMES = {
    violet:  { accent: '#9b59ff', glow: 'rgba(155, 89, 255, 0.4)',  name: 'Violeta' },
    pink:    { accent: '#ff59b4', glow: 'rgba(255, 89, 180, 0.4)',  name: 'Rosa Neón' },
    cyan:    { accent: '#00d4ff', glow: 'rgba(0, 212, 255, 0.4)',   name: 'Cyan Arcade' },
    gold:    { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)',  name: 'Dorado' },
    crimson: { accent: '#e11d48', glow: 'rgba(225, 29, 72, 0.4)',   name: 'Carmesí Arcade' }
};
window.THEMES = THEMES;

// =====================================================
// CÓDIGOS PROMOCIONALES — SHA-256 (no texto plano)
// Generados con: echo -n "CODIGO" | sha256sum
// Para agregar nuevos códigos ver DOCUMENTACION.md §10
// =====================================================
const PROMO_CODES_HASHED = {
'4564f1daae1dd157925088fce37fefc9869dabbbd7f860069dcf593d4d620a4b': 2500,   // PVZGW2500
'5136694194f15aecc6eae3645b56b6a8273876d6d830709cf7591dd89a05b066': 500,   // PVZGW500
'fe499ddb40f6bf77d1b7b18efe6c365848b46a9522e8c37155bcf306fad2e0ee': 1000,   // BOCCHICAT1000
'aec9091f68e1f1324e1ed9b8ccb6ce86a137a9b2c3440ea5d2fa83bb2fb70523': 1000,// 09112024  
'a6670a5454af70c97e1fc2fc457af9521383055a257ba58ac549c5ccc7766a85': 200,   // VERSION9
'02d936b1e7ecebb010709ccc9b82509f092b98a89731dcf474829451dd627ee9': 13000, // PAGO_QA
};

// =====================================================
// UTILIDADES
// =====================================================

/**
 * Calcula el SHA-256 de un texto y devuelve el hash en hexadecimal.
 * Usa la API nativa crypto.subtle — disponible en todos los navegadores modernos.
 * @param {string} text
 * @returns {Promise<string>}
 */
async function sha256(text) {
    const buffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(text)
    );
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Crea una versión con debounce de una función.
 * Útil para controlar la frecuencia de operaciones costosas (buscador, resize).
 * @param {Function} fn    Función a debounce-ar.
 * @param {number}   delay Espera en ms antes de ejecutar (por defecto 300ms).
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
window.debounce = debounce; // Disponible globalmente para shop-logic.js

// =====================================================
// TIEMPO DE RED — Fuente de verdad externa para el bono diario
// =====================================================

/** Máxima discrepancia tolerable entre reloj local y de red: 5 minutos. */
const CLOCK_SKEW_LIMIT = 5 * 60 * 1000;

/** Timeout de cada petición a una API de tiempo (ms). */
const TIME_API_TIMEOUT = 4000;

/**
 * Clave de localStorage para el caché de tiempo de red.
 * Separada del store principal para no contaminar checksums de sincronización.
 */
const TIME_CACHE_KEY = 'love_arcade_time_cache';

/**
 * TTL del caché de tiempo (ms). Mientras el caché sea más reciente que este
 * valor, claimDaily() lo usa directamente sin ninguna petición de red.
 * 4 horas es suficiente: el usuario abre la app, el sync corre en background,
 * y el caché queda listo para el reclamo de ese día y el siguiente.
 */
const TIME_CACHE_TTL = 4 * 60 * 60 * 1000;

// ── Lectura / escritura del caché ─────────────────────────────────────────

/**
 * Escribe el resultado de una sincronización en el caché local.
 * @param {{ drift: number, desynced: boolean }} data
 */
function _writeTimeCache(data) {
    try {
        localStorage.setItem(TIME_CACHE_KEY, JSON.stringify({
            drift:       data.drift,
            desynced:    data.desynced,
            capturedAt:  Date.now()
        }));
    } catch (_) {}
}

/**
 * Lee el caché y devuelve una estimación del tiempo de red actual.
 * No hace ninguna petición de red — es puramente síncrono.
 *
 * @returns {{
 *   time:       number,   — estimación del timestamp de red en ms
 *   verified:   boolean,  — true si el caché existe y no ha expirado
 *   desynced:   boolean,  — true si se detectó manipulación de reloj en el último sync
 *   cacheAge:   number    — antigüedad del caché en ms (0 si no existe)
 * }}
 */
function _readTimeCache() {
    try {
        const raw = localStorage.getItem(TIME_CACHE_KEY);
        if (!raw) return { time: Date.now(), verified: false, desynced: false, cacheAge: Infinity };

        const { drift, desynced, capturedAt } = JSON.parse(raw);
        const cacheAge = Date.now() - capturedAt;
        const verified = cacheAge <= TIME_CACHE_TTL;

        return {
            time:     Date.now() + (drift || 0),
            verified,
            desynced: Boolean(desynced),
            cacheAge
        };
    } catch (_) {
        return { time: Date.now(), verified: false, desynced: false, cacheAge: Infinity };
    }
}

// ── Sincronización en segundo plano ──────────────────────────────────────

/**
 * Lanza una petición a una URL de tiempo con timeout propio.
 * @param {string}   url
 * @param {function} extract  Extrae el timestamp del objeto JSON.
 * @returns {Promise<number>} Timestamp en ms.
 */
function _fetchTimeSource(url, extract) {
    return new Promise((resolve, reject) => {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => { ctrl.abort(); reject(new Error('timeout')); }, TIME_API_TIMEOUT);
        fetch(url, { cache: 'no-store', signal: ctrl.signal })
            .then(r  => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(d  => { clearTimeout(tid); resolve(extract(d)); })
            .catch(e => { clearTimeout(tid); reject(e); });
    });
}

/**
 * Sincroniza el caché de tiempo en segundo plano: consulta las APIs en
 * paralelo (Promise.any) y persiste el resultado SIN bloquear la UI.
 *
 * No retorna ningún valor útil — su único efecto es actualizar el caché.
 * Se llama automáticamente al cargar la página, al volver a la pestaña
 * y cada 30 min mientras la app está abierta.
 */
async function _syncTimeBackground() {
    try {
        const networkTime = await Promise.any([
            _fetchTimeSource(
                'https://timeapi.io/api/time/current/ip',
                d => new Date(d.dateTime ?? d.datetime).getTime()
            ),
            _fetchTimeSource(
                'https://worldtimeapi.org/api/ip',
                d => new Date(d.datetime).getTime()
            )
        ]);

        const drift    = networkTime - Date.now();
        const desynced = Math.abs(drift) > CLOCK_SKEW_LIMIT;
        _writeTimeCache({ drift, desynced });
    } catch (_) {
        // Todas las fuentes fallaron (sin conexión) — no tocar el caché existente.
        // claimDaily() seguirá usando el último caché válido o el reloj local.
    }
}

// =====================================================
// WEB WORKER — Sincronización en hilo separado
// =====================================================
let _syncWorker = null;

function getSyncWorker() {
    if (_syncWorker) return _syncWorker;
    try {
        _syncWorker = new Worker('js/sync-worker.js');
        _syncWorker.onerror = () => { _syncWorker = null; };
    } catch (e) {
        _syncWorker = null;
    }
    return _syncWorker;
}

/**
 * Envía una tarea al Web Worker de sincronización y devuelve una Promise con el resultado.
 *
 * COMPORTAMIENTO DE FALLBACK: si el worker no está disponible (navegador sin soporte,
 * error de instanciación, o contexto sin origen — e.g. file://), la Promise es rechazada
 * con Error('Worker no disponible'). Los llamadores (exportSave / importSave) tienen
 * bloques try/catch que capturan este rechazo y ejecutan la operación en el hilo
 * principal como fallback. El sistema nunca bloquea la UI incluso sin worker.
 *
 * IDEMPOTENCIA: cada llamada crea un `id` único ({timestamp}-{random}) para correlacionar
 * la respuesta del worker. Múltiples llamadas concurrentes se resuelven de forma
 * independiente gracias a este id.
 *
 * @param {{ action: 'export'|'import', [key: string]: any }} payload
 * @returns {Promise<any>}
 */
function workerTask(payload) {
    return new Promise((resolve, reject) => {
        const worker = getSyncWorker();
        if (!worker) { reject(new Error('Worker no disponible')); return; }
        const id = `${Date.now()}-${Math.random()}`;
        const handler = (e) => {
            if (e.data.id !== id) return;
            worker.removeEventListener('message', handler);
            if (e.data.error) reject(new Error(e.data.error));
            else resolve(e.data.result);
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ ...payload, id });
    });
}

// =====================================================
// MIGRACIÓN SILENCIOSA
// Garantiza retrocompatibilidad con stores de versiones anteriores.
// Nunca sobrescribe datos existentes; solo rellena campos faltantes.
// =====================================================
function migrateState(loadedStore) {
    const defaults = {
        coins:          CONFIG.initialCoins,
        progress:       { maze: [], wordsearch: [], secretWordsFound: [] },
        inventory:      {},
        redeemedCodes:  [],   // Legado (texto plano): se conserva por historial
        redeemedHashes: [],   // v7.5: hashes SHA-256 de códigos canjeados
        history:        [],
        userAvatar:     null,
        theme:          'violet',
        wishlist:       [],
        daily:          { lastClaim: 0, streak: 0 },
        buffs:          { moonBlessingExpiry: 0 },
        // v9.4 — Identity
        nickname:       '',    // Máx. 15 chars. Vacío = primer acceso → flujo de bienvenida.
        gender:         '@',   // 'o' | 'a' | '@' — controla el sufijo del saludo.
        // v11.0 — Multiplicador de bonificación con expiración (Hitos Personales)
        bonus_multiplier:         1,   // Factor activo (ej: 2 = ×2). Base = 1 (sin efecto).
        bonus_multiplier_expires: 0,   // Timestamp ms. 0 = sin multiplicador activo.
        // v11.0 — Estadísticas diarias para Misiones del Día
        missions: {
            date:         '',  // Fecha YYYY-MM-DD del último reinicio.
            playtime:     0,   // Segundos de juego activo en el día actual.
            games_played: 0,   // Partidas completadas en el día actual.
            claimed:      []   // IDs de misiones reclamadas hoy.
        }
    };

    const merged = { ...defaults, ...loadedStore };

    // Migración: lastDaily (string fecha) → daily.lastClaim (timestamp)
    if (merged.lastDaily && merged.daily.lastClaim === 0) {
        const lastDate = new Date(merged.lastDaily);
        if (!isNaN(lastDate.getTime())) {
            merged.daily = { lastClaim: lastDate.getTime(), streak: 1 };
        }
    }
    delete merged.lastDaily; // Eliminar campo legado

    // Asegurar sub-objetos faltantes
    if (!merged.daily   || typeof merged.daily !== 'object')  merged.daily = defaults.daily;
    if (!merged.buffs   || typeof merged.buffs !== 'object')  merged.buffs = defaults.buffs;
    if (!Array.isArray(merged.wishlist))        merged.wishlist = [];
    if (!Array.isArray(merged.redeemedHashes))  merged.redeemedHashes = [];
    if (!Array.isArray(merged.history))         merged.history = [];

    // v9.4 — Validación de identidad (migración silenciosa)
    if (typeof merged.nickname !== 'string')           merged.nickname = '';
    if (!['o', 'a', '@'].includes(merged.gender))      merged.gender   = '@';

    // v11.0 — Multiplicador de bonificación
    if (typeof merged.bonus_multiplier !== 'number' || merged.bonus_multiplier < 1) {
        merged.bonus_multiplier = 1;
    }
    if (typeof merged.bonus_multiplier_expires !== 'number') {
        merged.bonus_multiplier_expires = 0;
    }

    // v11.0 — Misiones diarias
    if (!merged.missions || typeof merged.missions !== 'object') {
        merged.missions = { date: '', playtime: 0, games_played: 0, claimed: [] };
    }
    if (typeof merged.missions.date         !== 'string') merged.missions.date         = '';
    if (typeof merged.missions.playtime     !== 'number') merged.missions.playtime     = 0;
    if (typeof merged.missions.games_played !== 'number') merged.missions.games_played = 0;
    if (!Array.isArray(merged.missions.claimed))          merged.missions.claimed      = [];

    return merged;
}


// =====================================================
// STORE — Carga y fusión con migración automática
// =====================================================
let store = migrateState({});

try {
    const raw = localStorage.getItem(CONFIG.stateKey);
    if (raw) store = migrateState(JSON.parse(raw));
} catch (e) {
    console.error('GameCenter: Error al cargar estado', e);
    store = migrateState({});
}

// =====================================================
// ANIMACIÓN DE CONTADOR (requestAnimationFrame)
// =====================================================

/**
 * Anima el contador de monedas de `start` a `end` en `duration` ms usando
 * una curva ease-out cúbica, y escribe el valor en cada elemento del array.
 *
 * CONTRATO IMPORTANTE: esta función modifica `_displayedCoins` como efecto
 * secundario al terminar la animación. Cualquier llamada a `syncUI()` antes
 * de que termine la animación debe primero resetear `_displayedCoins` al
 * valor actual del store para que `animateValue` arranque desde el valor
 * correcto. Ver `GameCenter.syncUI()`.
 *
 * @param {HTMLElement[]} elements  Nodos cuyo `textContent` se actualiza en cada frame.
 * @param {number}        start     Valor inicial de la animación.
 * @param {number}        end       Valor final de la animación.
 * @param {number}        [duration=650] Duración en milisegundos.
 */
let _displayedCoins = store.coins;

function animateValue(elements, start, end, duration = 650) {
    if (!elements || !elements.length) return;
    if (start === end) { elements.forEach(el => el.textContent = end); return; }
    const range = end - start;
    const t0 = performance.now();
    const step = (now) => {
        const p     = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cúbico
        elements.forEach(el => el.textContent = Math.round(start + range * eased));
        if (p < 1) requestAnimationFrame(step);
        else _displayedCoins = end;
    };
    requestAnimationFrame(step);
}

// =====================================================
// HISTORIAL DE TRANSACCIONES
// =====================================================
/**
 * Registra una transacción en store.history con formato estructurado.
 * @param {'ingreso'|'gasto'} tipo
 * @param {number}             cantidad
 * @param {string}             motivo
 */
function logTransaction(tipo, cantidad, motivo) {
    if (!Array.isArray(store.history)) store.history = [];
    store.history.push({ tipo, cantidad, motivo, fecha: Date.now() });
    // Limitar a las últimas 150 entradas para no inflar el localStorage
    if (store.history.length > 150) {
        store.history = store.history.slice(-150);
    }
}

// =====================================================
// API PÚBLICA — window.GameCenter
// =====================================================
window.GameCenter = {

    // ── JUEGOS ──────────────────────────────────────────────────────────────

    /**
     * Registra un nivel completado y otorga la recompensa indicada.
     * Es idempotente: si el levelId ya fue registrado, no vuelve a pagar.
     */
    completeLevel: (gameId, levelId, rewardAmount) => {
        if (!store.progress[gameId]) store.progress[gameId] = [];
        if (store.progress[gameId].includes(levelId)) {
            return { paid: false, coins: store.coins };
        }
        store.progress[gameId].push(levelId);

        // [v10.0] Invasión de Monedas: si el evento coin_invasion_v1 está activo,
        // el reward se multiplica ×1.5 antes de sumarse al saldo.
        let finalAmount = rewardAmount;
        if (window.isEventActive('coin_invasion_v1')) {
            finalAmount = Math.floor(rewardAmount * 1.5);
        }

        // [v11.0] Multiplicador de bonificación con expiración (Hitos Personales).
        // Si el timestamp de expiración es posterior a ahora, aplicar el factor.
        const now = Date.now();
        if (store.bonus_multiplier > 1 && now < store.bonus_multiplier_expires) {
            finalAmount = Math.floor(finalAmount * store.bonus_multiplier);
        } else if (store.bonus_multiplier_expires > 0 && now >= store.bonus_multiplier_expires) {
            // Limpiar multiplicador expirado para no dejarlo en el store indefinidamente.
            store.bonus_multiplier         = 1;
            store.bonus_multiplier_expires = 0;
        }

        store.coins += finalAmount;
        logTransaction('ingreso', finalAmount,
            `Nivel ${levelId} completado · ${gameId}` +
            (finalAmount !== rewardAmount ? ' [multiplicador activo]' : '')
        );
        saveState();

        // [v11.0] Incrementar estadísticas diarias de misiones.
        window.GameCenter.incrementMissionStat('games_played', 1);

        // [v11.0] Despachar evento personalizado para que event-logic.js pueda
        // actualizar el progreso de Hitos Personales sin acoplamiento directo.
        document.dispatchEvent(new CustomEvent('la:levelcomplete', {
            detail: { gameId, levelId, reward: finalAmount }
        }));

        return { paid: true, coins: store.coins, multiplied: finalAmount !== rewardAmount };
    },

    // ── TIENDA ───────────────────────────────────────────────────────────────

    buyItem: (itemData) => {
        const bought = store.inventory[itemData.id] || 0;
        if (bought > 0) return { success: false, reason: 'owned' };

        const finalPrice = ECONOMY.isSaleActive
            ? Math.floor(itemData.price * ECONOMY.saleMultiplier)
            : itemData.price;

        if (store.coins < finalPrice) {
            // [v9.9.2] Fricción de usuario: intento de compra sin saldo suficiente.
            // Ayuda a detectar precios demasiado elevados o HUD de saldo poco claro.
            window.GhostAnalytics?.track('insufficient_funds', {
                wallpaper: itemData.name,
                precio:    `${finalPrice} ⭐`,
                saldo:     store.coins
            });
            return { success: false, reason: 'coins' };
        }

        const cashback = Math.floor(finalPrice * ECONOMY.cashbackRate);

        store.coins -= finalPrice;
        store.coins += cashback;
        store.inventory[itemData.id] = bought + 1;

        logTransaction('gasto',   finalPrice, `Compra: ${itemData.name}`);
        if (cashback > 0) {
            logTransaction('ingreso', cashback, `Cashback: ${itemData.name}`);
        }

        saveState();
        return { success: true, finalPrice, cashback };
    },

    /**
     * Deduce monedas del saldo directamente.
     * Usado por el Gachapón Relámpago (event-logic.js) para cobrar el costo
     * de giro sin pasar por buyItem(), que requiere un catálogo de ítem.
     * No registra en store.progress ni invalida idempotencia de completeLevel().
     * @param {number} amount  Cantidad entera positiva a deducir.
     * @param {string} [motivo]  Descripción para el historial.
     * @returns {{ success: boolean, coins: number }}
     */
    spendCoins: (amount, motivo = 'Gasto directo') => {
        const n = Math.floor(amount);
        if (!Number.isFinite(n) || n <= 0) return { success: false, coins: store.coins };
        if (store.coins < n) return { success: false, reason: 'insufficient', coins: store.coins };
        store.coins -= n;
        logTransaction('gasto', n, motivo);
        saveState();
        return { success: true, coins: store.coins };
    },

    getBoughtCount: (id) => store.inventory[id] || 0,
    getBalance:     ()   => store.coins,
    getInventory:   ()   => ({ ...store.inventory }),

    // ── v11.0 — ECONOMÍA DIRECTA ──────────────────────────────────────────────

    /**
     * Deposita monedas directamente en el saldo sin pasar por completeLevel().
     * Usado por la Cacería de Tesoros y el Gachapón Relámpago (event-logic.js).
     * No despacha 'la:levelcomplete' ni incrementa estadísticas de misiones.
     * @param {number} amount  Cantidad entera positiva de monedas a añadir.
     * @param {string} [motivo] Descripción para el historial de transacciones.
     * @returns {{ success: boolean, coins: number }}
     */
    addCoins: (amount, motivo = 'Depósito directo') => {
        const n = Math.floor(amount);
        if (!Number.isFinite(n) || n <= 0) return { success: false, coins: store.coins };
        store.coins += n;
        logTransaction('ingreso', n, motivo);
        saveState();
        return { success: true, coins: store.coins };
    },

    // ── v11.0 — MISIONES DIARIAS ──────────────────────────────────────────────

    /**
     * Obtiene la fecha local del día en formato YYYY-MM-DD.
     * Usado para verificar si las misiones deben reiniciarse.
     * @returns {string}
     */
    _getTodayString: () => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
},

    /**
     * Incrementa una estadística diaria de misiones.
     * Reinicia automáticamente el objeto missions si la fecha cambió (nuevo día).
     * @param {'playtime'|'games_played'} stat  Estadística a incrementar.
     * @param {number} delta  Cantidad a sumar (positiva).
     */
    incrementMissionStat: (stat, delta) => {
        const today = window.GameCenter._getTodayString();
        // Reinicio automático a medianoche local
        if (store.missions.date !== today) {
            store.missions = { date: today, playtime: 0, games_played: 0, claimed: [] };
        }
        if (stat === 'playtime') {
            store.missions.playtime = (store.missions.playtime || 0) + delta;
        } else if (stat === 'games_played') {
            store.missions.games_played = (store.missions.games_played || 0) + delta;
        }
        // No llamar a saveState() aquí para playtime (se llama cada segundo).
        // El guardado se delega a saveState() al final del ciclo de 60 s, o en
        // cualquier otra escritura del store (compra, daily, etc.).
        // Para games_played sí guardamos inmediatamente.
        if (stat === 'games_played') saveState();
    },

    /**
     * Devuelve las estadísticas de misiones del día actual.
     * Si la fecha cambió, reinicia antes de devolver.
     * @returns {{ date: string, playtime: number, games_played: number, claimed: string[] }}
     */
    getMissionStats: () => {
        const today = window.GameCenter._getTodayString();
        if (store.missions.date !== today) {
            store.missions = { date: today, playtime: 0, games_played: 0, claimed: [] };
        }
        return { ...store.missions };
    },

    /**
     * Marca una misión como reclamada y deposita su recompensa.
     * Idempotente: ignorado si la misión ya fue reclamada hoy.
     * @param {string} missionId  ID de la misión.
     * @param {number} reward     Monedas a otorgar.
     * @returns {{ success: boolean, coins: number }}
     */
    claimMissionReward: (missionId, reward) => {
        const today = window.GameCenter._getTodayString();
        if (store.missions.date !== today) {
            store.missions = { date: today, playtime: 0, games_played: 0, claimed: [] };
        }
        if (store.missions.claimed.includes(missionId)) {
            return { success: false, reason: 'already_claimed', coins: store.coins };
        }
        store.missions.claimed.push(missionId);
        store.coins += reward;
        logTransaction('ingreso', reward, `Misión completada: ${missionId}`);
        saveState();
        return { success: true, coins: store.coins };
    },

    // ── v11.0 — MULTIPLICADOR DE BONIFICACIÓN ─────────────────────────────────

    /**
     * Activa el multiplicador de bonificación con un timestamp de expiración.
     * Si ya hay uno activo, lo sobreescribe si el nuevo factor es mayor.
     * @param {number} multiplier        Factor multiplicador (ej: 2 = ×2).
     * @param {number} durationMs        Duración en ms.
     * @param {string} [motivo]          Descripción del origen del multiplicador.
     * @returns {{ success: boolean, expiresAt: number }}
     */
    activateBonusMultiplier: (multiplier, durationMs, motivo = 'Hito de evento') => {
        if (!Number.isFinite(multiplier) || multiplier <= 1) {
            return { success: false };
        }
        const expiresAt = Date.now() + durationMs;
        store.bonus_multiplier         = multiplier;
        store.bonus_multiplier_expires = expiresAt;
        logTransaction('ingreso', 0, `Multiplicador ×${multiplier} activado · ${motivo}`);
        saveState();
        return { success: true, expiresAt };
    },

    /**
     * Devuelve el estado del multiplicador de bonificación activo.
     * @returns {{ active: boolean, multiplier: number, remainingMs: number }}
     */
    getBonusMultiplierStatus: () => {
        const now    = Date.now();
        const active = store.bonus_multiplier > 1 && store.bonus_multiplier_expires > now;
        return {
            active,
            multiplier:  active ? store.bonus_multiplier : 1,
            remainingMs: active ? store.bonus_multiplier_expires - now : 0
        };
    },

    /**
     * Devuelve el número de códigos promocionales ya canjeados.
     * Usado por el user_snapshot de shop-logic.js para enriquecer la
     * instantánea de sesión sin exponer el array completo de hashes.
     * @returns {number}
     */
    getRedeemedCount: () => (store.redeemedHashes || []).length,

    getDownloadUrl: (itemId, fileName) => {
        if (!fileName) return null;
        if ((store.inventory[itemId] || 0) === 0) return null;
        // Strip file extension — Cloudinary download URL uses the base public ID
        // without extension or transformation parameters so the original master
        // file is served (no crop, no resize, no format override).
        const base = fileName.replace(/\.[^.]+$/, '');
        return CONFIG.wallpapersPath + base;
    },

    // ── WISHLIST ─────────────────────────────────────────────────────────────

    /**
     * Alterna el estado de favorito de un ítem.
     * @returns {boolean} true si quedó en wishlist, false si fue removido.
     */
    toggleWishlist: (itemId) => {
        if (!Array.isArray(store.wishlist)) store.wishlist = [];
        const idx = store.wishlist.indexOf(itemId);
        if (idx > -1) store.wishlist.splice(idx, 1);
        else          store.wishlist.push(itemId);
        saveState();
        return store.wishlist.includes(itemId);
    },

    isWishlisted: (itemId) =>
        Array.isArray(store.wishlist) && store.wishlist.includes(itemId),

    // ── HISTORIAL ────────────────────────────────────────────────────────────

    /**
     * Devuelve el historial de transacciones en orden cronológico inverso
     * (la más reciente primero).
     */
    getHistory: () => [...(store.history || [])].reverse(),

    // ── CÓDIGOS PROMO (async — SHA-256) ──────────────────────────────────────

    /**
     * Canjea un código promocional.
     * El código se hashea en el cliente antes de compararlo; el texto plano
     * nunca se almacena ni se compara directamente, protegiendo los códigos
     * de una lectura trivial en DevTools.
     * @returns {Promise<{success: boolean, reward?: number, message: string}>}
     */
    redeemPromoCode: async (inputCode) => {
        const code = inputCode.trim().toUpperCase();
        const hash = await sha256(code);

        const reward = PROMO_CODES_HASHED[hash];
        if (!reward) return { success: false, message: 'Código inválido' };

        if (store.redeemedHashes.includes(hash)) {
            return { success: false, message: 'Ya canjeaste este código' };
        }

        store.coins += reward;
        store.redeemedHashes.push(hash);
        // Mantener compatibilidad con panel de historial antiguo
        store.redeemedCodes.push(code);
        logTransaction('ingreso', reward, `Código canjeado`);
        saveState();

        // [v9.9.2] track('redeem_code') fue movido a handleRedeem() en shop-logic.js
        // para que el disparo ocurra UNA SOLA VEZ, al final de la cadena de éxito
        // de UI. No se trackea aquí para evitar el doble reporte.

        return { success: true, reward, message: `¡+${reward} Monedas!` };
    },

    // ── BONO DIARIO CON RACHA ────────────────────────────────────────────────

    /**
     * Reclama el bono diario. Función async — consulta una API de tiempo externa
     * como fuente de verdad antes de evaluar el reclamo.
     *
     * Lógica de días calendario (v8.1+):
     *   diff_días == 0 → ya reclamado hoy.
     *   diff_días == 1 → racha continúa (streak + 1).
     *   diff_días  > 1 → racha se reinicia (streak = 1).
     *
     * Seguridad (v9.6 — Background Sync):
     *   El tiempo de red se verifica en segundo plano (_syncTimeBackground),
     *   no en el momento del reclamo. claimDaily() lee el caché sincrónico
     *   (_readTimeCache) y no hace ninguna petición de red, garantizando
     *   respuesta instantánea en todos los casos.
     *
     *   - currentTime < lastClaimTime → salto negativo; bloquear sin tocar racha.
     *   - caché desynced: true → reloj adelantado detectado en el último sync; bloquear.
     *   - caché expirado o inexistente → permitir (primera visita o sin conexión reciente).
     *
     * @returns {{ success: boolean, reward?: number, baseReward?: number,
     *             moonBonus?: number, streak?: number, verified: boolean, message: string }}
     */
    claimDaily: () => {
        const { time: now, verified, desynced } = _readTimeCache();
        const { lastClaim, streak } = store.daily;

        // ── 1. Salto negativo (manipulación de reloj detectada por el caché) ──
        if (lastClaim > 0 && now < lastClaim) {
            return {
                success:  false,
                verified,
                message:  'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.'
            };
        }

        // ── 2. Reloj adelantado detectado en el último sync en background ──
        if (desynced) {
            return {
                success:  false,
                verified,
                message:  'Reloj desincronizado. Verifica la hora de tu dispositivo e inténtalo de nuevo.'
            };
        }

        // ── 3. Cálculo de días calendario (normalizar a medianoche) ──
        const nowMidnight  = new Date(now).setHours(0, 0, 0, 0);
        const lastMidnight = lastClaim > 0
            ? new Date(lastClaim).setHours(0, 0, 0, 0)
            : null;

        const diffDays = lastMidnight !== null
            ? Math.round((nowMidnight - lastMidnight) / 86_400_000)
            : 1;

        if (diffDays === 0) {
            return {
                success:  false,
                verified,
                message:  '¡Ya reclamaste tu bono hoy! Vuelve mañana.'
            };
        }

        // ── 4. Calcular nueva racha ──
        // [v10.0] Hot Streak Weekend: si streak_boost_v1 está activo, el
        // incremento de racha pasa de +1 a +2 (el cap dailyStreakCap sigue vigente).
        const streakBoost = window.isEventActive('streak_boost_v1') ? 2 : 1;
        const newStreak = diffDays === 1 ? streak + streakBoost : 1;

        const baseReward = Math.min(
            CONFIG.dailyReward + (newStreak - 1) * CONFIG.dailyStreakStep,
            CONFIG.dailyStreakCap
        );

        // ── 5. Bendición Lunar ──────────────────────────────────────────────
        // Se concede siempre que el buff esté activo. El único escenario donde
        // podría abusarse (offline + reloj adelantado) queda cubierto por la
        // detección de desynced en el sync anterior. Sin conexión genuina el
        // usuario tampoco puede comprar la Bendición Lunar, por lo que el
        // riesgo neto es despreciable.
        const moonActive  = store.buffs.moonBlessingExpiry > now;
        const moonBonus   = moonActive ? 90 : 0;
        const totalReward = baseReward + moonBonus;

        // ── 6. Aplicar y persistir ──
        store.coins += totalReward;
        store.daily  = { lastClaim: now, streak: newStreak };

        logTransaction(
            'ingreso',
            totalReward,
            `Bono diario · racha ${newStreak}` + (moonBonus ? ' + Bendición Lunar' : '')
        );

        saveState();
        updateMoonBlessingUI();

        // [v9.9.2] Analítica — daily_bonus: solo en éxito para no saturar el canal.
        // Registra cuánto ganó el usuario y si la Bendición Lunar contribuyó,
        // lo que permite detectar días de mayor actividad y valor del buff.
        window.GhostAnalytics?.track('daily_bonus', {
            recompensa:   totalReward,
            base:         baseReward,
            luna:         moonBonus > 0 ? `+${moonBonus}` : 'no',
            racha:        newStreak
        });

        return {
            success:    true,
            reward:     totalReward,
            baseReward,
            moonBonus,
            streak:     newStreak,
            verified,
            message:    `¡+${totalReward} monedas! Racha: ${newStreak} día${newStreak !== 1 ? 's' : ''}`
        };
    },

    /**
     * Comprueba si el usuario puede reclamar el bono diario.
     * Usa el reloj local para la UI (sin coste de red); la validación real
     * con tiempo de red ocurre dentro de claimDaily().
     * Lógica: el bono está disponible si hoy (medianoche) > último reclamo (medianoche).
     *
     * @returns {boolean}
     */
    canClaimDaily: () => {
        const { lastClaim } = store.daily;
        if (lastClaim === 0) return true;
        const nowMidnight  = new Date().setHours(0, 0, 0, 0);
        const lastMidnight = new Date(lastClaim).setHours(0, 0, 0, 0);
        return (nowMidnight - lastMidnight) >= 86_400_000; // al menos 1 día de diferencia
    },

    /**
     * Devuelve información sobre el estado de la racha actual.
     * Usa días calendario (medianoche) para consistencia con claimDaily().
     */
    getStreakInfo: () => {
        const { lastClaim, streak } = store.daily;
        const nowMidnight  = new Date().setHours(0, 0, 0, 0);
        const lastMidnight = lastClaim > 0
            ? new Date(lastClaim).setHours(0, 0, 0, 0)
            : null;
        const diffDays   = lastMidnight !== null
            ? Math.round((nowMidnight - lastMidnight) / 86_400_000)
            : 1;

        // [v10.1] Reflejar streak_boost_v1 en la previsualización de nextStreak.
        // claimDaily() aplica el mismo cálculo; así la UI muestra siempre el
        // valor real que se otorgará al reclamar (sin sorpresas).
        const streakBoost = window.isEventActive?.('streak_boost_v1') ? 2 : 1;
        const nextStreak  = diffDays === 1 ? streak + streakBoost : 1;

        const nextReward = Math.min(
            CONFIG.dailyReward + (nextStreak - 1) * CONFIG.dailyStreakStep,
            CONFIG.dailyStreakCap
        );
        return {
            streak,
            nextReward,
            canClaim:     diffDays >= 1,
            streakBoosted: streakBoost === 2
        };
    },

    // ── BENDICIÓN LUNAR ──────────────────────────────────────────────────────

    /**
     * Activa (o extiende) la Bendición Lunar. Costo: 100 monedas.
     * Efecto: +90 monedas extra por cada reclamo diario.
     * Vigencia: 7 días. Si ya está activa, extiende desde el vencimiento actual.
     */
    buyMoonBlessing: () => {
        const COST = 100;
        const DURATION = 7 * 86_400_000; // 7 días en ms

        if (store.coins < COST) {
            // [v9.9.2] Fricción de usuario: saldo insuficiente para activar el buff.
            window.GhostAnalytics?.track('insufficient_funds', {
                wallpaper: 'Bendición Lunar (buff)',
                precio:    `${COST} ⭐`,
                saldo:     store.coins
            });
            return { success: false, reason: 'coins' };
        }

        const now = Date.now();
        const isActive = store.buffs.moonBlessingExpiry > now;
        store.coins -= COST;
        store.buffs.moonBlessingExpiry = (isActive
            ? store.buffs.moonBlessingExpiry
            : now
        ) + DURATION;

        logTransaction('gasto', COST, 'Bendición Lunar activada (7 días)');
        saveState();
        updateMoonBlessingUI();

        const expiresAt = new Date(store.buffs.moonBlessingExpiry).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric'
        });

        return { success: true, expiresAt };
    },

    getMoonBlessingStatus: () => {
        const now    = Date.now();
        const expiry = store.buffs.moonBlessingExpiry;
        const active = expiry > now;
        return {
            active,
            expiresAt: active
                ? new Date(expiry).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'long', year: 'numeric'
                  })
                : null,
            remainingMs: active ? expiry - now : 0
        };
    },

    // ── SINCRONIZACIÓN (async — Worker + Checksum) ───────────────────────────

    /**
     * Genera un código de exportación con checksum de integridad.
     * La operación pesada se delega al Web Worker cuando está disponible.
     */
    exportSave: async () => {
        try {
            const result = await workerTask({ action: 'export', store, salt: SYNC_SALT });
            return result;
        } catch (_) {
            // Fallback síncrono si el worker no está disponible
        }
        // Fallback: operación en hilo principal
        // TextEncoder convierte el payload UTF-8 a bytes, luego btoa codifica en Base64.
        // Reemplaza el patrón obsoleto btoa(unescape(encodeURIComponent())) que usa
        // funciones deprecadas en motores modernos.
        const json     = JSON.stringify(store);
        const checksum = await sha256(json + SYNC_SALT);
        const payload  = JSON.stringify({ data: store, checksum });
        try {
            const bytes  = new TextEncoder().encode(payload);
            const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
            return btoa(binary);
        } catch { return null; }
    },

    /**
     * Importa un código de partida validando su checksum antes de aplicarlo.
     * Si el checksum no coincide, la importación es rechazada para prevenir
     * manipulación manual del saldo.
     */
    importSave: async (code) => {
        try {
            let data;
            try {
                const result = await workerTask({ action: 'import', code, salt: SYNC_SALT });
                if (!result.valid) {
                    return {
                        success: false,
                        message: 'El código fue modificado manualmente. Importación rechazada por integridad.'
                    };
                }
                data = result.data;
            } catch (_) {
                // Fallback sin worker — operación en hilo principal con TextDecoder
                // (reemplaza escape()/unescape() que están deprecados en todos los motores modernos)
                const raw     = atob(code.trim());
                const bytes   = Uint8Array.from(raw, c => c.charCodeAt(0));
                const json    = new TextDecoder().decode(bytes);
                const payload = JSON.parse(json);
                if (payload.checksum && payload.data) {
                    const expected = await sha256(JSON.stringify(payload.data) + SYNC_SALT);
                    if (payload.checksum !== expected) {
                        return {
                            success: false,
                            message: 'El código fue modificado manualmente. Importación rechazada.'
                        };
                    }
                    data = payload.data;
                } else {
                    // Formato legado v7.2
                    data = payload;
                }
            }

            if (typeof data.coins !== 'number') throw new Error('invalid');
            store = migrateState(data);
            saveState();
            return { success: true };
        } catch {
            return { success: false, message: 'Código inválido o corrupto.' };
        }
    },

    // ── AVATAR ───────────────────────────────────────────────────────────────

    setAvatar: (dataUrl) => { store.userAvatar = dataUrl; saveState(); applyAvatar(); },
    getAvatar: ()        => store.userAvatar,

    // Alias de compatibilidad — mantenido por si juegos externos llaman a activateMoonBlessing().
    // shop.html fue eliminado en la migración SPA v9.0; la función real es buyMoonBlessing().
    // Puede retirarse cuando se confirme que ningún juego integrado usa este alias.
    activateMoonBlessing: function() { return this.buyMoonBlessing(); },

    // ── TEMA ─────────────────────────────────────────────────────────────────

    setTheme: (key) => {
        if (!THEMES[key]) return;
        store.theme = key;
        saveState();
        applyTheme(key);
    },
    getTheme: () => store.theme || 'violet',

    // ── IDENTIDAD — v9.4 ─────────────────────────────────────────────────────

    /**
     * Guarda el nickname y género elegidos por el usuario y actualiza el DOM.
     * @param {string} nickname  Nombre a mostrar (max 15 chars, se recorta).
     * @param {'o'|'a'|'@'} gender  Sufijo del saludo.
     */
    setIdentity: (nickname, gender) => {
        const VALID_GENDERS = ['o', 'a', '@'];
        store.nickname = String(nickname).trim().slice(0, 15);
        store.gender   = VALID_GENDERS.includes(gender) ? gender : '@';
        saveState();
        applyIdentity();
    },

    /** @returns {{ nickname: string, gender: 'o'|'a'|'@' }} */
    getIdentity: () => ({
        nickname: store.nickname || '',
        gender:   store.gender   || '@'
    }),

    /** @returns {boolean} true si el usuario ya eligió un nickname. */
    hasIdentity: () => Boolean(store.nickname?.trim()),

    // ── SPA / MÓDULOS EXTERNOS ────────────────────────────────────────────────

    /**
     * Devuelve una lectura segura (sin referencia) del estado público del store.
     * Usado por shop-logic.js (renderStreakCalendar) y spa-router.js.
     * No expone el objeto store completo para evitar mutaciones externas.
     * @returns {{ coins: number, streak: number, theme: string, moonBlessingExpiry: number, nickname: string, gender: string }}
     */
    getState: () => ({
        coins:               store.coins,
        streak:              store.daily?.streak || 0,
        theme:               store.theme || 'violet',
        moonBlessingExpiry:  store.buffs?.moonBlessingExpiry || 0,
        nickname:            store.nickname || '',
        gender:              store.gender   || '@'
    }),

    /**
     * Fuerza una sincronización visual completa del saldo en todos los
     * indicadores de la UI (Navbar .coin-display + HUD .coin-display).
     * Llamado por spa-router.js al navegar entre vistas para garantizar
     * que el saldo sea siempre correcto al entrar a cualquier vista.
     * Resetea _displayedCoins para que animateValue arranque desde el valor
     * correcto en vez del último valor animado.
     */
    syncUI: () => {
        _displayedCoins = store.coins;
        updateUI();
    }
};

// =====================================================
// MAIL HELPER — Utilidades mailto: (sin backend)
// =====================================================

/** Clave de localStorage exclusiva para el último correo utilizado.
 *  Separada del store del juego para no contaminar exportaciones/checksums. */
const MAIL_RECIPIENT_KEY = 'love_arcade_last_recipient';

/** Umbral de caracteres a partir del cual el mailto: puede truncarse
 *  en algunos clientes de correo (RFC 2368 / límite práctico). */
const MAILTO_MAX_LENGTH = 1800;

/**
 * Regex de validación de correo electrónico (sintáctica básica, FR3).
 * No pretende cubrir toda la RFC 5322; cubre el 99 % de los casos reales.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida si la cadena tiene forma de correo electrónico válido.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    return EMAIL_REGEX.test(email.trim());
}

/**
 * Persiste el último correo utilizado en localStorage (FR6 / guardado explícito
 * tras acción del usuario de confirmar el envío).
 * @param {string} email
 */
function saveLastMailRecipient(email) {
    try { localStorage.setItem(MAIL_RECIPIENT_KEY, email.trim()); }
    catch (_) { /* localStorage lleno — ignorar silenciosamente */ }
}

/**
 * Recupera el último correo guardado para pre-rellenar el campo (FR spec).
 * @returns {string}  Correo guardado, o cadena vacía si no hay ninguno.
 */
function getLastMailRecipient() {
    try { return localStorage.getItem(MAIL_RECIPIENT_KEY) || ''; }
    catch (_) { return ''; }
}

/**
 * Construye un URI mailto: con los campos To, Subject y Body codificados.
 * Todos los valores se pasan por encodeURIComponent para evitar inyecciones (FR4).
 *
 * @param {{ name: string, tags?: string[] }} item    Metadatos del wallpaper.
 * @param {string} absoluteUrl  URL absoluta de descarga (construida en la UI).
 * @param {string} email        Correo destino ya validado.
 * @returns {{ uri: string, tooLong: boolean }}
 */
function buildMailtoLink(item, absoluteUrl, email) {
    const tipo = Array.isArray(item.tags) && item.tags.includes('Mobile')
        ? 'Wallpaper Mobile'
        : 'Wallpaper PC';

    const subject = encodeURIComponent(`Tu ${tipo} de Love Arcade: ${item.name}`);

    const bodyRaw =
        `¡Hola!\n\n` +
        `Aquí está tu wallpaper de Love Arcade: "${item.name}".\n\n` +
        `Enlace de descarga:\n${absoluteUrl}\n\n` +
        `Instrucciones:\n` +
        `Abre este enlace en tu PC o dispositivo para descargar el archivo.\n` +
        `Si el enlace no funciona directamente, cópialo y pégalo en tu navegador.\n\n` +
        `— Love Arcade`;

    const body = encodeURIComponent(bodyRaw);
    const uri  = `mailto:${encodeURIComponent(email.trim())}?subject=${subject}&body=${body}`;

    return { uri, tooLong: uri.length > MAILTO_MAX_LENGTH };
}

/**
 * Intenta copiar un texto al portapapeles.
 * Usa la Clipboard API moderna con fallback a execCommand.
 * @param {string} text
 * @returns {Promise<boolean>}  true si tuvo éxito.
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (_) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            Object.assign(ta.style, { position: 'fixed', opacity: '0', top: '0', left: '0' });
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        } catch (_2) {
            return false;
        }
    }
}

/** API pública del módulo de correo. */
window.MailHelper = {
    isValidEmail,
    saveLastMailRecipient,
    getLastMailRecipient,
    buildMailtoLink,
    copyToClipboard
};

// =====================================================
// FUNCIONES INTERNAS
// =====================================================

function saveState() {
    localStorage.setItem(CONFIG.stateKey, JSON.stringify(store));
    updateUI();
}

/**
 * Formatea un número de monedas para la Navbar.
 * < 10 000 → número completo (ej: 9 500 → "9500")
 * ≥ 10 000 → formato "k" con un decimal si aplica (ej: 25 500 → "25.5k", 20 000 → "20k")
 * El Player Hub siempre recibe el número exacto; esta función es solo para .navbar .coin-display.
 * @param {number} n
 * @returns {string}
 */
function formatCoinsNavbar(n) {
    if (n < 10_000) return String(n);
    const k = n / 1000;
    // Usar un decimal solo si el resultado no es entero
    return (Number.isInteger(k) ? k : Math.floor(k * 10) / 10) + 'k';
}

function updateUI() {
    // Separar elementos: navbar (formato abreviado) vs. el resto (número exacto)
    const navbarDisplays = Array.from(
        document.querySelectorAll('.navbar .coin-display')
    );
    const otherDisplays = Array.from(
        document.querySelectorAll('.coin-display:not(.navbar .coin-display)')
    );

    if (_displayedCoins === store.coins) {
        // Sin delta: escribir valores formateados directamente, sin animación.
        // Evita sobrescribir el valor formateado que ya pintó el init silencioso.
        navbarDisplays.forEach(el => {
            el.textContent = formatCoinsNavbar(store.coins);
            // El tooltip muestra el valor exacto cuando la navbar usa formato abreviado
            // (ej: "25.5k"). El usuario puede ver el número preciso sin ir al HUD.
            el.closest('.coin-badge')?.setAttribute('title', `${store.coins} monedas`);
        });
        otherDisplays.forEach(el  => { el.textContent = store.coins; });
    } else {
        // Con delta: animar con número exacto y formatear navbar al terminar
        animateValue([...navbarDisplays, ...otherDisplays], _displayedCoins, store.coins);

        // Sobrescribir la navbar con el valor formateado al terminar la animación
        // (animateValue dura ~650 ms; con 700 ms de margen evitamos parpadeos)
        if (navbarDisplays.length) {
            setTimeout(() => {
                navbarDisplays.forEach(el => {
                    el.textContent = formatCoinsNavbar(store.coins);
                });
            }, 700);
        }
    }

    applyAvatar();
    updateDailyButton();
    updateMoonBlessingUI();
}

/** Exponer formatCoinsNavbar para uso en shop.html si fuera necesario. */
window.formatCoinsNavbar = formatCoinsNavbar;

function applyAvatar() {
    if (!store.userAvatar) return;
    // Selecciona el avatar de la navbar (#user-avatar-display) y el HUD (.hud-avatar)
    document.querySelectorAll('#user-avatar-display, #hud-avatar-display, .hud-avatar').forEach(el => {
        el.style.backgroundImage = `url('${store.userAvatar}')`;
        const icon = el.querySelector('i, svg');
        if (icon) icon.style.display = 'none';
    });
}

/**
 * Escribe el nickname y el sufijo de género en el DOM del HUD de forma síncrona.
 * Llamada antes de revealUI() para que el usuario nunca vea el estado por defecto.
 * Si el store no tiene nickname, no modifica el DOM (el modal se encargará).
 */
function applyIdentity() {
    const suffixEl   = document.getElementById('pref-suffix');
    const nicknameEl = document.getElementById('display-nickname');
    if (suffixEl)   suffixEl.textContent   = store.gender   || '@';
    if (nicknameEl) nicknameEl.textContent = store.nickname || '';
}

function applyTheme(key) {
    const t    = THEMES[key] || THEMES.violet;
    const root = document.documentElement;

    // ── CSS custom properties (retrocompatibilidad con juegos) ────────────────
    root.style.setProperty('--accent',       t.accent);
    root.style.setProperty('--accent-hover', t.accent + 'cc');
    root.style.setProperty('--accent-glow',  t.glow);
    root.style.setProperty('--accent-dim',    t.accent + '99');
    root.style.setProperty('--accent-soft',   t.glow.replace(/[\d.]+\)$/, '0.12)'));
    root.style.setProperty('--accent-border', t.glow.replace(/[\d.]+\)$/, '0.38)'));

    // ── Clase en <body>: eliminar todas las anteriores y añadir la nueva ──────
    // Este es el mecanismo principal para que CSS pueda usar
    // body.theme-violet .selector { ... } sin variables dinámicas.
    const bodyClasses = document.body.classList;
    Object.keys(THEMES).forEach(k => bodyClasses.remove(`theme-${k}`));
    bodyClasses.add(`theme-${key}`);

    // ── data-theme en <html> (retrocompatibilidad con atributo CSS selector) ──
    document.documentElement.setAttribute('data-theme', key);

    // ── Actualizar estado visual de los botones de tema ───────────────────────
    document.querySelectorAll('.theme-btn').forEach(btn => {
        const isActive = btn.dataset.theme === key;
        btn.classList.toggle('theme-btn--active', isActive);
        // aria-pressed comunica el estado seleccionado a lectores de pantalla (WCAG 4.1.2)
        btn.setAttribute('aria-pressed', String(isActive));
    });
}

function updateDailyButton() {
    const btn = document.getElementById('btn-daily');
    if (!btn) return;

    const can  = window.GameCenter.canClaimDaily();
    const info = window.GameCenter.getStreakInfo();

    btn.disabled      = !can;
    btn.style.opacity = can ? '1' : '0.5';
    btn.style.cursor  = can ? 'pointer' : 'not-allowed';

    // HUD button: tiene elementos hijos específicos (#hud-reward-amount)
    const rewardEl = document.getElementById('hud-reward-amount');
    if (rewardEl) {
        // Solo actualizar la cifra; la etiqueta "BONO DIARIO" se queda fija
        if (!can) {
            rewardEl.textContent = `×${info.streak}`;
        } else {
            const moonStatus = window.GameCenter.getMoonBlessingStatus();
            const total = info.nextReward + (moonStatus.active ? 90 : 0);
            rewardEl.textContent = `+${total}`;
        }
        return; // HUD manejado: salir para no tocar el span genérico
    }

    // Botón clásico (por si se usa en otra vista)
    const span = btn.querySelector('span');
    if (span) {
        if (!can) {
            span.textContent = `Vuelve mañana · Racha: ${info.streak}`;
        } else {
            const moonStatus = window.GameCenter.getMoonBlessingStatus();
            const moonNote   = moonStatus.active ? ' +Luna' : '';
            span.textContent = `Bono Diario (+${info.nextReward}${moonNote})`;
        }
    }
}

function updateMoonBlessingUI() {
    const status   = window.GameCenter.getMoonBlessingStatus();
    const moonBadges = document.querySelectorAll('.moon-blessing-badge');

    moonBadges.forEach(badge => {
        badge.classList.toggle('hidden', !status.active);
        if (status.active) {
            badge.title = `Bendición Lunar activa hasta ${status.expiresAt}`;
        }
    });

    // Botón de compra en tienda
    const moonBtn = document.getElementById('btn-moon-blessing');
    if (moonBtn) {
        const statusEl = document.getElementById('moon-blessing-status');
        if (status.active) {
            moonBtn.textContent = 'Extender Bendición (+7 días)';
            if (statusEl) statusEl.textContent = `Activa hasta ${status.expiresAt}`;
        } else {
            moonBtn.textContent = 'Activar Bendición Lunar (100 monedas)';
            if (statusEl) statusEl.textContent = 'Inactiva';
        }
    }
}

// =====================================================
// REVEAL UI — v9.3 Zero-Flicker
// =====================================================
/**
 * Añade la clase .is-ready a los contenedores de datos críticos,
 * disparando su transición de opacidad (0 → 1) en el siguiente frame.
 * Se llama DESPUÉS de escribir los valores correctos en el DOM para que
 * el usuario nunca vea el estado "vacío" o con datos por defecto del HTML.
 */
function revealUI() {
    requestAnimationFrame(() => {
        // coin-badge: usa su propia clase para compatibilidad con v9.2
        document.querySelectorAll('.coin-badge').forEach(el => {
            el.classList.add('coin-badge--visible');
        });
        // hud-avatar-wrap: se revela solo cuando el avatar (o el placeholder)
        // ya está correctamente pintado
        document.querySelectorAll('.hud-avatar-wrap').forEach(el => {
            el.classList.add('is-ready');
        });
        // player-hud: se revela completo una vez que botón diario, countdown
        // y barras de racha están en su estado correcto en el DOM oculto.
        // Esto evita:
        //  - El fade del botón disabled (transition:all disparada por CSS)
        //  - El layout-shift del countdown (display:none → block mueve .hud-streak)
        document.querySelectorAll('.player-hud').forEach(el => {
            el.classList.add('is-ready');
        });
    });
}
// Expuesta globalmente para que el inline script de index.html pueda llamarla
// DESPUÉS de que updateStreakBar() y updateCountdownDisplay() hayan corrido.
window.revealUI = revealUI;

// =====================================================
// INIT SÍNCRONO — v9.3 Zero-Flicker Initiative
// ─────────────────────────────────────────────────────────────────────────────
// app.js está posicionado al FINAL de <body>. En ese punto el navegador ya
// ha parseado todo el HTML y los elementos del DOM existen, pero NO ha
// realizado el primer layout/paint todavía (las scripts síncronas bloquean el
// render). Esto nos permite escribir datos reales en el DOM ANTES de que el
// usuario vea cualquier píxel, eliminando los tres tipos de parpadeo:
//
//   1. Theme Flash     → applyTheme() antes del primer paint
//   2. Coin Jitter     → escribe saldo formateado antes del primer paint
//   3. State Sync Gap  → updateDailyButton() y updateMoonBlessingUI() inmediatos
// =====================================================

// 1. TEMA — elimina el "salto violeta" para cualquier usuario con otro tema.
//    El script crítico del <head> ya habrá ajustado los CSS vars; applyTheme()
//    añade la clase theme-{key} al <body> y actualiza los botones de ajustes.
applyTheme(store.theme || 'violet');

// 2. SALDO — escribe el valor formateado síncronamente.
//    El .coin-badge tiene opacity:0 por CSS; nunca pintará el "0" del HTML.
_displayedCoins = store.coins;
document.querySelectorAll('.navbar .coin-display').forEach(el => {
    el.textContent = formatCoinsNavbar(store.coins);
});
document.querySelectorAll('.coin-display:not(.navbar .coin-display)').forEach(el => {
    el.textContent = store.coins;
});

// 3. BOTÓN DIARIO Y LUNA — corrige el estado (activo/desactivado, texto de
//    recompensa) antes del primer paint, eliminando el "salto de estado".
updateDailyButton();
updateMoonBlessingUI();

// 4. AVATAR — aplica la imagen guardada síncronamente (si existe).
applyAvatar();

// 5. IDENTIDAD — escribe nickname y sufijo de género en el DOM antes del reveal.
//    Solo actúa si hay nickname guardado; si no, el modal de bienvenida (en el
//    inline script de index.html) se encarga de llamar a revealUI() al confirmar.
applyIdentity();

// NOTA: revealUI() se llama desde el inline script de index.html, DESPUÉS de
// que updateStreakBar() y updateCountdownDisplay() también hayan corrido.
// Esto garantiza que .player-hud se revela con TODOS sus estados correctos
// (botón, countdown, barras de racha y avatar) en un solo RAF.
//
// ¿Por qué revealUI() NO se llama aquí directamente?
// ──────────────────────────────────────────────────────────────────────────
// app.js no tiene acceso a las funciones updateStreakBar() y
// updateCountdownDisplay(), que viven en el inline script de index.html.
// Si revealUI() se llamara aquí, el HUD se revelaría ANTES de que esas
// funciones hayan ejecutado, causando un salto visual de estado ("jitter"):
//   1. El botón aparece con el texto correcto (updateDailyButton ya corrió)
//   2. Pero las barras de racha aparecen vacías (updateStreakBar no corrió aún)
//   3. El countdown aparece oculto (updateCountdownDisplay no corrió aún)
// Al delegarlo al inline script del <body>, se garantiza el orden correcto:
//   updateStreakBar() → updateCountdownDisplay() → revealUI()
// Todos en el mismo hilo, antes del primer paint.

// =====================================================
// EVENT LISTENERS — DOMContentLoaded
// Los listeners no afectan al primer paint; se registran aquí por claridad.
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    // Re-sincronizar UI por si algún sub-módulo modificó el DOM
    updateUI();

    // ── Analítica — open_game ─────────────────────────────────────────────────
    // Delegación global para detectar la apertura de cualquier minijuego.
    // Se escucha el click en cualquier <a> cuya href contenga "games/" para no
    // requerir data-attributes específicos en cada tarjeta de juego del HTML.
    // passive:true garantiza que no bloquea el scroll ni el propio navegador.
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href*="games/"]');
        if (!link) return;
        // Intentar obtener el ID del juego desde data-game-id, data-game-name,
        // o derivarlo del nombre del archivo HTML (último segmento de la URL).
        const gameId = link.dataset.gameId
            || link.dataset.gameName
            || link.getAttribute('href')?.split('/').pop()?.replace(/\.html?$/, '')
            || 'desconocido';
        window.GhostAnalytics?.track('open_game', { juego: gameId });
    }, { passive: true });

    // ── v11.0 — Tracker de tiempo activo (Misiones del Día) ──────────────────
    // Cada segundo que la pestaña esté visible se suma 1 al contador de playtime.
    // El guardado en localStorage se realiza cada 60 s para no saturar el disco.
    let _missionSaveTimer = 0;
    setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        window.GameCenter.incrementMissionStat('playtime', 1);
        _missionSaveTimer++;
        if (_missionSaveTimer >= 60) {
            _missionSaveTimer = 0;
            saveState(); // Persistir playtime acumulado cada minuto
        }
    }, 1_000);

    // ── Background time sync (v9.6) ───────────────────────────────────────
    // Se lanza 800 ms después del DOMContentLoaded para no competir con el
    // primer paint. El resultado se almacena en TIME_CACHE_KEY y será leído
    // por claimDaily() de forma síncrona, sin espera de red en el reclamo.
    setTimeout(_syncTimeBackground, 800);

    // Actualizar el caché cuando el usuario vuelve a la pestaña
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') _syncTimeBackground();
    });

    // Refresco periódico cada 30 min por si la app permanece abierta mucho tiempo
    setInterval(_syncTimeBackground, 30 * 60 * 1000);

    // Avatar upload — delegado único
    document.addEventListener('change', (e) => {
        if (e.target.id === 'avatar-upload' || e.target.id === 'avatar-upload-hud') {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                window.GameCenter.setAvatar(evt.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    // Bono diario — el botón se desactiva SÍNCRONAMENTE antes de cualquier operación
    // asíncrona para prevenir el "double-tap bug" (race condition por clics rápidos).
    const dailyBtn = document.getElementById('btn-daily');
    if (dailyBtn) {
        dailyBtn.addEventListener('click', () => {
            // ── Paso 1: desactivar de inmediato ──
            dailyBtn.disabled      = true;
            dailyBtn.style.opacity = '0.5';
            dailyBtn.style.cursor  = 'not-allowed';

            // ── Paso 2: ejecutar reclamo (instantáneo — sin red) ──
            const result = window.GameCenter.claimDaily();

            // ── Paso 3: mostrar mensaje y actualizar UI ──
            const msg = document.getElementById('daily-msg');
            if (msg) {
                msg.textContent   = result.message;
                msg.style.color   = result.success ? '#4ade80' : '#facc15';
                msg.style.opacity = '1';
                setTimeout(() => { msg.style.opacity = '0'; }, 3500);
            }

            // updateDailyButton() recalcula el estado correcto del botón
            // (puede habilitarlo si el reclamo falló por error recuperable,
            //  o dejarlo desactivado con el contador si fue exitoso).
            updateDailyButton();
        });
    }

    // ── Selector de temas — fuente de verdad única (migrado desde shop-logic.js) ──
    // El tema es configuración global (afecta a toda la app, no solo a la Tienda).
    // shop-logic.js eliminó su propio listener durante la migración SPA; este es
    // el único registro. setTheme() actualiza el store, los CSS vars, la clase
    // theme-{key} en <body> y el estado visual de todos los .theme-btn.
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.GameCenter) window.GameCenter.setTheme(btn.dataset.theme);
        });
    });

    // NOTA: El listener de #btn-moon-blessing fue eliminado en v9.x (SPA Migration).
    // La Bendición Lunar es un elemento de la vista Tienda; su handler vive
    // exclusivamente en shop-logic.js para evitar el doble-registro de eventos.
});