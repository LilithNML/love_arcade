/**
 * api/report.js — Love Arcade v12.1
 * ─────────────────────────────────────────────────────────────────────────────
 * Proxy Serverless para Telemetría Segura — Vercel Edge Function
 *
 * CAMBIOS v12.1 (Body Parser Hardening — Bugfix):
 *
 *  ── Problema corregido ────────────────────────────────────────────────────
 *  - req.body llegaba como `undefined`, `Buffer` o `string` en ciertos
 *    escenarios de Vercel runtime (cold start, requests con keepalive:true,
 *    streaming), lo que provocaba que los campos type/user/event/data
 *    cayeran en sus valores por defecto y los mensajes de Telegram mostraran
 *    UNKNOWN / desconocido / sin metadatos.
 *
 *  ── Solución implementada ─────────────────────────────────────────────────
 *  - NUEVO: export const config declara explícitamente el body parser JSON
 *    con un límite de 16 KB. Fuerza a Vercel a activarlo en todos los
 *    entornos (producción, preview, vercel dev) sin depender del valor por
 *    defecto del runtime.
 *  - NUEVO: helper privado _parseBody(req) actúa como red de seguridad:
 *      Caso A — req.body ya es un objeto plano → se usa directamente.
 *      Caso B — req.body es string → JSON.parse().
 *      Caso C — req.body es Buffer → toString('utf8') + JSON.parse().
 *      Caso D — req.body es undefined → se lee el raw stream de red.
 *    En cualquier caso de error de parseo se devuelve {} para que los
 *    defaults del destructuring entren en juego de forma controlada.
 *  - El resto de la lógica (validación, sanitización, Telegram) no ha
 *    cambiado. El bugfix es quirúrgico y no afecta el comportamiento nominal.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * RESPONSABILIDADES:
 *  1. Validar que la petición sea POST y provenga del dominio de producción.
 *  2. Sanitizar el nickname del jugador para evitar inyecciones HTML.
 *  3. Clasificar el evento en el hilo (Topic) de Telegram correspondiente.
 *  4. Construir el mensaje en modo HTML con emojis identificadores y
 *     timestamp de servidor para contrastar con el del cliente.
 *  5. Entregar el mensaje a la API de Telegram y devolver un estado 500
 *     silencioso al frontend si la API upstream falla, sin interrumpir el juego.
 *
 * VARIABLES DE ENTORNO REQUERIDAS (Vercel → Settings → Environment Variables):
 *   TELEGRAM_BOT_TOKEN   Token del bot obtenido vía @BotFather.
 *   TELEGRAM_CHAT_ID     ID del grupo/canal destino (negativo para grupos).
 *   PRODUCTION_DOMAIN    Dominio de producción (ej: love-arcade.vercel.app).
 *                        Puede ser parcial — se usa `.includes()` sobre el origen.
 *
 * MAPEO DE HILOS (message_thread_id):
 *   analytics   → Topic ID 2  — 📈 Analíticas
 *   achievement → Topic ID 3  — 🏆 Logros
 *   bug         → Topic ID 4  — 🚨 Bugs
 *
 * CONTRATO DE ENTRADA (payload JSON vía POST /api/report):
 *   {
 *     "type":  "analytics" | "bug" | "achievement",
 *     "user":  "nickname_desde_storage",
 *     "event": "nombre_del_evento",
 *     "data":  { "clave": "valor", ... }   ← detalles técnicos opcionales
 *   }
 *
 * SEGURIDAD:
 *   - El TELEGRAM_BOT_TOKEN nunca abandona el servidor.
 *   - Los caracteres HTML especiales del nickname y los datos son escapados
 *     antes de inyectarse en el mensaje, eliminando el riesgo de inyección.
 *   - Errores upstream de Telegram (rate limit, ban, etc.) se loguean en
 *     el servidor y se devuelve HTTP 500 sin cuerpo descriptivo al cliente.
 *
 * COMPATIBILIDAD:
 *   - Runtime: Node.js 18+ (Vercel Serverless Functions).
 *   - `fetch` nativo disponible a partir de Node 18; no requiere dependencias.
 */

// ── Configuración del Body Parser (v12.1) ─────────────────────────────────────
//
// Declaración explícita obligatoria para que Vercel active el parser JSON en
// todos los entornos (producción, preview, `vercel dev`).
//
// Sin esta declaración, en ciertos escenarios de runtime (cold start, requests
// con `keepalive: true`, streaming de red) Vercel puede omitir el parsing
// automático y entregar req.body como `undefined`, Buffer o string, haciendo
// que los campos del payload caigan en sus valores por defecto.
//
// sizeLimit '16kb': suficiente para cualquier payload de analíticas y evita
// abusos con bodies gigantes. Ajustar si en el futuro los payloads crecen.
//
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '16kb',
        },
    },
};

// ── Helper: parseo defensivo del body (v12.1) ─────────────────────────────────
//
// Aunque `export const config` activa el body parser, esta función actúa como
// red de seguridad para los cuatro estados posibles de req.body en producción:
//
//   Caso A — objeto plano  : Vercel parseó correctamente → devolver tal cual.
//   Caso B — string        : bodyParser desactivado o Content-Type no reconocido
//                            → JSON.parse() directo.
//   Caso C — Buffer        : bodyParser en modo raw o streaming parcial
//                            → toString('utf8') + JSON.parse().
//   Caso D — undefined     : cold start extremo o middleware conflictivo
//                            → leer el raw stream de la request.
//
// En cualquier fallo de parseo se devuelve {} para que los defaults del
// destructuring en el handler entren en juego de forma controlada y el
// mensaje de Telegram muestre los valores de fallback en lugar de crashear.
//
async function _parseBody(req) {
    const body = req.body;

    // Caso A: objeto plano ya parseado por Vercel
    if (
        body !== null &&
        body !== undefined &&
        typeof body === 'object' &&
        !Buffer.isBuffer(body)
    ) {
        return body;
    }

    // Caso B: string (bodyParser desactivado, Content-Type no reconocido)
    if (typeof body === 'string') {
        try { return JSON.parse(body); }
        catch (_) { return {}; }
    }

    // Caso C: Buffer (bodyParser en modo raw o streaming parcial)
    if (Buffer.isBuffer(body)) {
        try { return JSON.parse(body.toString('utf8')); }
        catch (_) { return {}; }
    }

    // Caso D: undefined — leer el raw stream directamente
    return new Promise((resolve) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk.toString('utf8'); });
        req.on('end', () => {
            try { resolve(JSON.parse(raw)); }
            catch (_) { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
}

export default async function handler(req, res) {

    // ── 1. Validación de método HTTP ──────────────────────────────────────────
    //
    // Solo se aceptan peticiones POST. Cualquier otro método (GET, HEAD, OPTIONS…)
    // recibe un 405 para evitar que crawlers o scrapers consuman el endpoint.
    //
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // ── 2. Seguridad de origen ────────────────────────────────────────────────
    //
    // Valida que la petición provenga del dominio de producción registrado en
    // la variable de entorno PRODUCTION_DOMAIN. La validación se hace sobre el
    // header `origin` (enviado por navegadores en peticiones cross-origin) o
    // `referer` como fallback. Si PRODUCTION_DOMAIN no está configurado, la
    // validación se omite para no bloquear entornos de preview de Vercel.
    //
    const PRODUCTION_DOMAIN = process.env.PRODUCTION_DOMAIN || '';

    if (PRODUCTION_DOMAIN) {
        const origin = req.headers['origin'] || req.headers['referer'] || '';
        if (!origin.includes(PRODUCTION_DOMAIN)) {
            console.warn('[report.js] Origen no autorizado:', origin);
            return res.status(403).json({ error: 'Forbidden' });
        }
    }

    // ── 3. Mapeo de hilos (Topics) de Telegram ────────────────────────────────
    //
    // Los IDs deben coincidir con los obtenidos al crear los Topics en el grupo.
    // Para obtenerlos: envía un mensaje en el Topic y usa getUpdates() en la API.
    //
    const THREAD_IDS = {
        analytics:   2,   // 📈 Analíticas — métricas de uso y sesión
        achievement: 3,   // 🏆 Logros     — compras, códigos, bonos diarios
        bug:         4,   // 🚨 Bugs       — errores capturados y códigos inválidos
    };

    // ── 4. Emojis identificadores por tipo ────────────────────────────────────
    //
    // Facilitan la lectura rápida en el panel de Telegram desde móvil.
    //
    const TYPE_EMOJIS = {
        analytics:   '📈',
        achievement: '🏆',
        bug:         '🚨',
    };

    // ── 5. Parseo defensivo del payload (v12.1) ───────────────────────────────
    //
    // _parseBody() garantiza que `body` sea siempre un objeto plano,
    // independientemente del estado en que Vercel entregue req.body.
    // Ver la documentación del helper más arriba para los cuatro casos cubiertos.
    //
    const body = await _parseBody(req);

    const {
        type  = 'analytics',
        user  = 'desconocido',
        event = 'unknown',
        data  = {},
    } = body;

    // Normalizar el tipo: si no es un valor conocido, caer en 'analytics'
    const safeType = Object.prototype.hasOwnProperty.call(THREAD_IDS, type)
        ? type
        : 'analytics';

    const threadId = THREAD_IDS[safeType];
    const emoji    = TYPE_EMOJIS[safeType];

    // ── 6. Sanitización contra inyecciones HTML ───────────────────────────────
    //
    // Telegram parsea el mensaje en modo HTML. Sin esta sanitización, un nickname
    // malicioso como "<b>hacked</b>" podría alterar el formato del mensaje.
    // Se escapan los cinco caracteres especiales del estándar HTML5.
    //
    function sanitize(value) {
        return String(value ?? '')
            .replace(/&/g,  '&amp;')
            .replace(/</g,  '&lt;')
            .replace(/>/g,  '&gt;')
            .replace(/"/g,  '&quot;')
            .replace(/'/g,  '&#39;');
    }

    const safeUser  = sanitize(user).slice(0, 50);
    const safeEvent = sanitize(event).slice(0, 80);

    // ── 7. Timestamp del servidor ─────────────────────────────────────────────
    //
    // Permite contrastar la hora del servidor con el `timestamp` del cliente
    // incluido en `data`, útil para detectar relojes desincronizados o eventos
    // retardados por la cola del Human Gate.
    //
    const serverTimestamp = new Date().toISOString();

    // ── 8. Construcción del mensaje en modo HTML ──────────────────────────────
    //
    // Formato Telegram HTML soportado: <b>, <i>, <code>, <pre>, <a>.
    // Se evita <u> y <s> por compatibilidad con clientes Telegram más antiguos.
    //
    const dataEntries = Object.entries(data || {})
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `  <code>${sanitize(k)}:</code> ${sanitize(String(v))}`)
        .join('\n');

    const eventLabel = safeEvent.replace(/_/g, ' ').toUpperCase();

    const text = [
        `${emoji} <b>${eventLabel}</b>`,
        '',
        `👤 <b>Usuario:</b> <code>${safeUser}</code>`,
        `📌 <b>Tipo:</b>    <i>${safeType}</i>`,
        '',
        dataEntries
            ? `📋 <b>Datos:</b>\n${dataEntries}`
            : '<i>Sin metadatos adicionales.</i>',
        '',
        `🕐 <b>Servidor:</b> <code>${serverTimestamp}</code>`,
        `<i>Love Arcade · Ghost Analytics v12.1</i>`,
    ].join('\n');

    // ── 9. Lectura de credenciales y envío a Telegram ─────────────────────────
    //
    // Las credenciales se leen en tiempo de ejecución desde process.env para
    // garantizar que nunca sean expuestas al cliente ni aparezcan en el bundle.
    //
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
        console.error(
            '[report.js] ❌ Variables de entorno no configuradas.',
            'Asegúrate de definir TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en Vercel.'
        );
        // 500 silencioso: el frontend no debe saber la causa interna
        return res.status(500).json({ error: 'Server misconfiguration' });
    }

    const telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

    try {
        const tgResponse = await fetch(telegramApiUrl, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id:           CHAT_ID,
                message_thread_id: threadId,
                text,
                parse_mode:        'HTML',
            }),
        });

        if (!tgResponse.ok) {
            // Rate limit (429), bot bloqueado (403), Topic eliminado (400)…
            // Se loguea en el servidor para diagnóstico pero el juego no se interrumpe.
            const errBody = await tgResponse.json().catch(() => ({}));
            console.warn(
                `[report.js] ⚠️  Telegram API respondió HTTP ${tgResponse.status}`,
                '— Evento:', event,
                '— Respuesta:', JSON.stringify(errBody)
            );
            return res.status(500).json({ error: 'Upstream error' });
        }

        // ✅ Entregado con éxito
        return res.status(200).json({ ok: true });

    } catch (networkErr) {
        // Error de red entre Vercel y Telegram (timeout, DNS, etc.)
        console.error('[report.js] ❌ Error de red al contactar Telegram:', networkErr.message);
        return res.status(500).json({ error: 'Network error' });
    }
}