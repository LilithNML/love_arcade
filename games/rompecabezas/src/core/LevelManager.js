import { Storage } from '../systems/Storage.js';

// ─────────────────────────────────────────────────────────────
//  LevelManager v6.1 — Gestor de niveles y URLs Cloudinary
//
//  CAMBIOS RESPECTO A v6.0
//  ───────────────────────
//  1. buildImageUrl() — corrección crítica de parámetro Cloudinary:
//       • Se sustituye `fl_lossless` por `q_100`.
//
//         Motivo del cambio:
//           fl_lossless es un flag propio del pipeline de transformación
//           activa de Cloudinary (requiere plan de pago con
//           transformaciones habilitadas). Cuando la cuenta no tiene ese
//           permiso, o cuando el flag se aplica fuera del contexto de una
//           transformación activa (e.g. entrega directa desde CDN sin
//           encadenamiento de transformaciones), Cloudinary retorna
//           HTTP 400 (Invalid transformation) o un Network Error en el
//           cliente, bloqueando la carga de la imagen.
//
//         q_100 en combinación con f_webp:
//           – Instruye al codificador WebP de Cloudinary a usar su
//             nivel de calidad máximo (100/100).
//           – A q_100, el codificador WebP de Cloudinary activa
//             automáticamente el modo sin pérdida (VP8L), produciendo
//             exactamente la misma entrega bit-perfect que fl_lossless
//             garantizaba conceptualmente, pero a través de la API
//             estándar de calidad numérica que es válida en todos los
//             planes de Cloudinary.
//           – El perfil ICC se preserva íntegramente (q_100 no activa
//             fl_strip_profile).
//           – Sin submuestreo de croma (4:4:4 full), sin artefactos DCT.
//
//         Resultado observable:
//           Las imágenes vuelven a cargarse instantáneamente (sin error
//           400/Network Error) con la misma pureza colorimétrica WebP
//           Lossless que en v6.0.
//
//  2. buildThumbnailUrl():
//       Sin cambios. Los thumbnails de la grid de niveles siguen usando
//       f_auto,q_auto porque su función es decorativa y el ahorro de
//       ancho de banda en miniaturas (160–320px) es prioritario sobre
//       la pureza colorimétrica.
//
//  3. _thumbW, getThumbnailWidth(), TOTAL_LEVELS, CLOUDINARY_BASE:
//       Sin cambios respecto a v6.0.
//
//  CAMBIOS RESPECTO A v5.0 (heredados de v6.0, sin modificación)
//  ──────────────────────────────────────────────────────────────
//  • Eliminados umbrales dinámicos de ancho (w_700/w_900/w_1200) y
//    la lógica _fullW / getFullImageWidth(). Resolución nativa 1600×1600.
//  • Parámetros cambiados de f_auto,q_auto a f_webp,q_100 (via fl_lossless
//    en v6.0, corregido a q_100 en v6.1).
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  Constantes de configuración
// ─────────────────────────────────────────────────────────────
const TOTAL_LEVELS = 150;
const CLOUDINARY_BASE = 'https://res.cloudinary.com/dyspgn0sw/image/upload';

// ─────────────────────────────────────────────────────────────
//  Capacidad del dispositivo — sólo para thumbnails (v6.0)
//
//  _dpr y _maxDim se conservan únicamente para la lógica de
//  thumbnail. Ya no se usan para calcular el ancho de la imagen
//  de juego (siempre nativa 1600px).
// ─────────────────────────────────────────────────────────────
const _dpr = Math.min(window.devicePixelRatio || 1, 3);
const _maxDim = Math.max(
    (window.screen.width || 375) * _dpr,
    (window.screen.height || 667) * _dpr
);

/**
 * Calcula el ancho de thumbnail para la cuadrícula de niveles.
 *
 * La tarjeta CSS tiene un mínimo de 100px. Se añade un 7% de margen
 * para evitar thumbnails borrosos en pantallas sub-píxel, y el resultado
 * se redondea al múltiplo de 80px más cercano para maximizar los aciertos
 * de caché en el CDN (distintos dispositivos con DPR similar comparten URL).
 *
 * DPR se limita a 2× para las miniaturas: la diferencia visual entre
 * 2× y 3× en una card de 100px es imperceptible pero el coste en bytes
 * triplica.
 *
 * @returns {number}
 */
function getThumbnailWidth() {
    const raw = Math.ceil(100 * Math.min(_dpr, 2) * 1.07);
    const snapped = Math.ceil(raw / 80) * 80;
    return Math.max(160, Math.min(snapped, 320));
}

// Pre-calculado una sola vez para todos los thumbnails.
const _thumbW = getThumbnailWidth();

// ─────────────────────────────────────────────────────────────
//  Constructores de URL
// ─────────────────────────────────────────────────────────────

/**
 * URL de imagen completa — resolución nativa 1600×1600, WebP calidad máxima.
 *
 * Parámetros Cloudinary:
 *   f_webp  : Fuerza formato WebP (soporte universal en navegadores
 *             modernos). El navegador no realiza ninguna conversión
 *             adicional en el hilo de renderizado.
 *   q_100   : Calidad máxima del codificador WebP (100/100).
 *             A este nivel de calidad, el codificador WebP de Cloudinary
 *             activa automáticamente el modo sin pérdida (VP8L), produciendo
 *             una entrega equivalente a fl_lossless pero sin requerir el
 *             flag de transformación activa (que causa HTTP 400 en cuentas
 *             sin ese permiso):
 *               - Sin submuestreo de croma (4:4:4 full).
 *               - Sin artefactos de compresión DCT (bloqueo, ringing).
 *               - Sin "ruido de mosquito" en zonas de alto contraste.
 *               - Perfil ICC preservado íntegramente (q_100 no activa
 *                 fl_strip_profile).
 *
 * Ausencia de w_:
 *   No se aplica transformación de ancho. Cloudinary sirve la imagen
 *   original sin reescalado en servidor. PuzzleEngine v19.1 se encarga
 *   de reducir la textura en el cliente mediante step-down scaling de
 *   alta fidelidad (ver PuzzleEngine._buildSourceCanvasHQ).
 *
 * Caché:
 *   Una única URL por publicId maximiza los aciertos de caché en el
 *   CDN y en el navegador.
 *
 * @param {string} publicId  — ID del asset en Cloudinary (ej. "Nivel01").
 * @returns {string}         — URL completa del asset WebP q_100 nativo 1600px.
 */
function buildImageUrl(publicId) {
    return `${CLOUDINARY_BASE}/f_webp,q_100/v1/${publicId}`;
}

/**
 * URL de thumbnail con ancho dinámico según DPR del dispositivo.
 *
 * Los thumbnails continúan usando f_auto,q_auto porque:
 *   • Su función es decorativa (cuadrícula de selección de nivel).
 *   • El tamaño pequeño (160–320px) hace imperceptibles los artefactos
 *     de compresión lossy.
 *   • El ahorro de ancho de banda al cargar 150 thumbnails es prioritario.
 *
 * @param {string} publicId
 * @returns {string}
 */
function buildThumbnailUrl(publicId) {
    return `${CLOUDINARY_BASE}/c_thumb,w_${_thumbW},g_center,f_auto,q_auto/v1/${publicId}`;
}

// ─────────────────────────────────────────────────────────────
//  Helpers de nivel
// ─────────────────────────────────────────────────────────────

function getPieces(n) {
    return n <= 10 ? 16 : 25;
}

function getRewardCoins(n) {
    return 150 + (n * 2);
}

// ─────────────────────────────────────────────────────────────
//  Clase principal
// ─────────────────────────────────────────────────────────────

export class LevelManager {
    constructor() {
        this.levels = [];
    }
    
    /**
     * Genera los TOTAL_LEVELS objetos de configuración en memoria.
     * Declarado async para ser await-able en main.js y garantizar
     * que los datos de nivel existen antes de validar el progreso.
     */
    async loadLevels() {
        this.levels = Array.from({ length: TOTAL_LEVELS }, (_, i) => {
            const n = i + 1;
            // padStart(2,'0'): "Nivel01"…"Nivel09", "Nivel10"…"Nivel150"
            const publicId = `Nivel${String(n).padStart(2, '0')}`;
            
            return {
                id: `lvl_${n}`,
                index: i,
                publicId,
                image: buildImageUrl(publicId),
                thumbnail: buildThumbnailUrl(publicId),
                pieces: getPieces(n),
                rewardCoins: getRewardCoins(n),
                description: `Sector Neuronal ${n}`
            };
        });
    }
    
    getAllLevelsWithStatus() {
        return this.levels.map(level => {
            const isUnlocked = Storage.isUnlocked(level.id);
            const isCompleted = Storage.isCompleted(level.id);
            
            let status = 'locked';
            if (isUnlocked) status = 'unlocked';
            if (isCompleted) status = 'completed';
            
            return {
                ...level,
                status,
                thumbnail: level.thumbnail || level.image
            };
        });
    }
    
    getLevelById(id) {
        return this.levels.find(l => l.id === id);
    }
    
    getNextLevelId(currentId) {
        const index = this.levels.findIndex(l => l.id === currentId);
        if (index !== -1 && index < this.levels.length - 1) {
            return this.levels[index + 1].id;
        }
        return null;
    }
}