import { Storage } from '../systems/Storage.js';

// ─────────────────────────────────────────────────────────────
//  Constantes de configuración
// ─────────────────────────────────────────────────────────────
const TOTAL_LEVELS = 150;
const CLOUDINARY_BASE = 'https://res.cloudinary.com/dyspgn0sw/image/upload';

// ─────────────────────────────────────────────────────────────
//  Capacidad del dispositivo — calculada una sola vez al cargar
//  el módulo. Reutilizable en buildImageUrl / buildThumbnailUrl
//  sin recomputar por nivel.
// ─────────────────────────────────────────────────────────────
const _dpr = Math.min(window.devicePixelRatio || 1, 3);
const _maxDim = Math.max(
    (window.screen.width || 375) * _dpr,
    (window.screen.height || 667) * _dpr
);

/**
 * Calcula el ancho de imagen completa óptimo para este dispositivo.
 *
 * Las imágenes de nivel son nativas de 1600×1600px. En dispositivos
 * de baja gama solicitar la resolución completa satura la VRAM cuando
 * se crean los buffers de canvas del motor. El escalonado reduce la
 * transferencia de red y la memoria de textura sin pérdida visual
 * perceptible a esas densidades de pantalla.
 *
 * Umbrales:
 *   _maxDim >= 2560  (iPad Pro 12.9" 3×, QHD Android)  → 1600px (nativo)
 *   _maxDim >= 1440  (Pixel 7 / iPhone 14 Pro DPR 3×)   → 1200px
 *   _maxDim >= 960   (iPhone SE 2×, Galaxy A-series 2×)  → 900px
 *   _maxDim  < 960   (gama baja DPR 1×, pantallas <480px)→ 700px
 *
 * @returns {number}
 */
function getFullImageWidth() {
    if (_maxDim >= 2560) return 1600;
    if (_maxDim >= 1440) return 1200;
    if (_maxDim >= 960) return 900;
    return 700;
}

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

// Pre-calculados una sola vez para todos los niveles.
const _fullW = getFullImageWidth();
const _thumbW = getThumbnailWidth();

// ─────────────────────────────────────────────────────────────
//  Constructores de URL
// ─────────────────────────────────────────────────────────────

/**
 * URL de imagen completa con ancho adaptado al dispositivo.
 *
 * Cuando _fullW === 1600 se omite la transformación w_ para que
 * Cloudinary sirva la resolución original sin reescalado en servidor.
 *
 * @param {string} publicId
 * @returns {string}
 */
function buildImageUrl(publicId) {
    const wTransform = _fullW === 1600 ? '' : `,w_${_fullW}`;
    return `${CLOUDINARY_BASE}/f_auto,q_auto${wTransform}/v1/${publicId}`;
}

/**
 * URL de thumbnail con ancho dinámico según DPR.
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