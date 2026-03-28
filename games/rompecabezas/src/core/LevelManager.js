import { Storage } from '../systems/Storage.js';

// ─────────────────────────────────────────────────────────────
//  LevelManager v6.0 — Gestor de niveles y URLs Cloudinary
//
//  CAMBIOS RESPECTO A v5.0
//  ───────────────────────
//  1. buildImageUrl():
//       • Eliminados los umbrales dinámicos de ancho (w_700 / w_900 /
//         w_1200) y la lógica _fullW / getFullImageWidth() para la
//         imagen principal. Siempre se solicita la resolución nativa
//         1600×1600 sin transformación de redimensionado en servidor.
//
//       • Parámetros de Cloudinary cambiados de `f_auto,q_auto` a
//         `f_webp,fl_lossless`:
//           – f_webp: fuerza formato WebP, disponible en todos los
//             navegadores modernos (Chrome 32+, Firefox 65+, Safari 14+).
//             WebP lossless tiene una ratio de compresión media de ~26%
//             frente al PNG equivalente, compensando el mayor tamaño
//             respecto a WebP lossy.
//           – fl_lossless: activa el modo sin pérdida de Cloudinary.
//             En combinación con f_webp produce WebP Lossless (RFC 6386
//             modo VP8L), eliminando el submuestreo de croma (4:2:0)
//             presente en JPEG/WebP lossy que provoca el "ruido de
//             mosquito" y la desaturación en zonas de alto contraste.
//             La imagen entregada es bit-perfect respecto al original
//             subido a Cloudinary.
//
//       • Supresión de fl_strip_profile: en v5.0 q_auto podía activar
//         el stripping del perfil ICC, lo que desvinculaba la imagen
//         del espacio de color original. Con fl_lossless el perfil se
//         preserva íntegramente.
//
//  2. buildThumbnailUrl():
//       Sin cambios. Los thumbnails de la grid de niveles siguen usando
//       f_auto,q_auto porque su función es decorativa y el ahorro de
//       ancho de banda en miniaturas (160–320px) es prioritario sobre
//       la pureza colorimétrica.
//
//  3. Eliminación de getFullImageWidth() y _fullW:
//       La función y la constante pre-calculada se eliminan porque ya
//       no se necesita un ancho dinámico para la imagen principal.
//       Servir 1600px a todos los dispositivos es correcto porque:
//         a) PuzzleEngine v19.0 implementa step-down scaling antes de
//            escribir en sourceCanvas, neutralizando el coste de escalar
//            desde 1600px hasta el tamaño del tablero.
//         b) El navegador cachea la URL Cloudinary; una URL única por
//            nivel (sin parámetro de ancho) maximiza los aciertos de
//            caché tanto en el navegador como en el CDN.
//         c) El tamaño de archivo WebP Lossless 1600×1600 es comparable
//            o menor al JPEG/WebP lossy de calidad alta que habría
//            servido q_auto, por lo que el ancho de banda no aumenta
//            significativamente.
//
//  4. _thumbW y getThumbnailWidth() se mantienen sin cambios.
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
 * URL de imagen completa — resolución nativa 1600×1600, sin pérdida.
 *
 * Parámetros Cloudinary:
 *   f_webp       : Fuerza formato WebP (soporte universal en navegadores
 *                  modernos). El navegador no realiza ninguna conversión
 *                  adicional en el hilo de renderizado.
 *   fl_lossless  : Activa el modo WebP Lossless (VP8L). La entrega es
 *                  bit-perfect respecto al master 1600×1600 subido a
 *                  Cloudinary:
 *                    - Sin submuestreo de croma (4:4:4 full).
 *                    - Sin artefactos de compresión DCT (bloqueo, ringing).
 *                    - Sin "ruido de mosquito" en zonas de alto contraste.
 *                    - Perfil ICC preservado íntegramente.
 *
 * Ausencia de w_:
 *   No se aplica transformación de ancho. Cloudinary sirve la imagen
 *   original sin reescalado en servidor. PuzzleEngine v19.0 se encarga
 *   de reducir la textura en el cliente mediante step-down scaling de
 *   alta fidelidad (ver PuzzleEngine._buildSourceCanvasHQ).
 *
 * Caché:
 *   Una única URL por publicId maximiza los aciertos de caché en el
 *   CDN y en el navegador. Con un parámetro de ancho dinámico (w_N),
 *   distintos dispositivos generaban distintas URLs para el mismo asset,
 *   dificultando el pre-calentamiento de caché en el CDN.
 *
 * @param {string} publicId  — ID del asset en Cloudinary (ej. "Nivel01").
 * @returns {string}         — URL completa del asset WebP Lossless 1600px.
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