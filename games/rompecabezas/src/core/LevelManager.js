/**
 * LevelManager.js v2.2 — Cloudinary Edition
 * Genera la configuración de niveles de forma algorítmica a partir de una
 * constante única (TOTAL_LEVELS). Elimina la dependencia de levels.json.
 *
 * Arquitectura de activos:
 *   Base URL : https://res.cloudinary.com/dyspgn0sw/image/upload
 *   Imagen   : .../f_auto,q_auto/v1/NivelNN
 *   Thumbnail: .../c_thumb,w_240,g_center,f_auto,q_auto/v1/NivelNN
 *
 * Convención de nombres en Cloudinary:
 *   El número del nivel se formatea con cero a la izquierda para n < 10
 *   (ej: Nivel01, Nivel02, … Nivel09, Nivel10, Nivel11, …).
 *   Esto asegura orden lexicográfico correcto en el panel de Cloudinary.
 *   ADVERTENCIA: usar "Nivel1" en lugar de "Nivel01" causará pantalla de carga
 *   infinita en los niveles del 1 al 9.
 *
 * Cambios v2.2:
 *   - Thumbnail: w_400 → w_240. Las tarjetas se muestran a 112px CSS mínimo;
 *     con DPR 2× se necesitan 224px efectivos. w_240 cubre DPR 2× con margen
 *     y reduce el peso por imagen ~64% respecto a w_400, acelerando la carga
 *     inicial de la pantalla de niveles.
 *
 * Para añadir un nuevo nivel basta con:
 *   1. Subir la imagen a Cloudinary con el nombre "NivelNN" (ej: Nivel65).
 *   2. Incrementar TOTAL_LEVELS en 1.
 */

import { Storage } from '../systems/Storage.js';

// ─── Constantes de control ────────────────────────────────────────────────────

/** Única variable que controla el total de niveles del juego. */
const TOTAL_LEVELS = 100;

/** URL base del CDN de Cloudinary. Actualizar si cambia el cloud name. */
const CLOUDINARY_BASE = 'https://res.cloudinary.com/dyspgn0sw/image/upload';

// ─── Helpers de URL ───────────────────────────────────────────────────────────

/**
 * Construye la URL de la imagen de juego (resolución completa).
 * Cloudinary selecciona automáticamente el formato más ligero soportado
 * por el navegador (WebP, AVIF) y aplica compresión adaptativa.
 *
 * @param {string} publicId - Nombre del asset en Cloudinary (ej: "Nivel05")
 * @returns {string} URL optimizada lista para usar en new Image()
 */
function buildImageUrl(publicId) {
    return `${CLOUDINARY_BASE}/f_auto,q_auto/v1/${publicId}`;
}

/**
 * Construye la URL de la miniatura con recorte inteligente centrado.
 *
 * Parámetros de transformación:
 *   c_thumb  → recorte por sujeto principal (más inteligente que c_fill)
 *   w_240    → ancho de 240px; suficiente para 112px CSS a DPR 2× con margen
 *   g_center → punto de gravedad central para el recorte
 *   f_auto   → formato óptimo según el cliente (WebP/AVIF)
 *   q_auto   → calidad adaptativa según el contenido de la imagen
 *
 * Por qué 240 y no 400:
 *   Las tarjetas tienen min-width 112px CSS. En un dispositivo DPR 2×
 *   (la mayoría de móviles actuales) se necesitan 224px físicos.
 *   w_240 cubre ese requerimiento con 7% de margen. w_400 servía
 *   160px extra completamente innecesarios, aumentando el peso ~64%.
 *
 * @param {string} publicId - Nombre del asset en Cloudinary
 * @returns {string} URL de miniatura optimizada
 */
function buildThumbnailUrl(publicId) {
    return `${CLOUDINARY_BASE}/c_thumb,w_240,g_center,f_auto,q_auto/v1/${publicId}`;
}

// ─── Lógica de progresión ─────────────────────────────────────────────────────

/**
 * Determina el número de piezas según el índice ordinal del nivel.
 *
 *   n ≤ 10  →  16 piezas (cuadrícula 4×4) — tramo básico.
 *   n > 10  →  25 piezas (cuadrícula 5×5) — tramo avanzado.
 *
 * Ambos valores son cuadrados perfectos, requisito técnico de PuzzleEngine
 * para calcular `gridSize = Math.sqrt(pieces)`. Cualquier otro valor
 * produce un tablero defectuoso.
 *
 * @param {number} n - Número ordinal del nivel (1-based)
 * @returns {16|25}
 */
function getPieces(n) {
    return n <= 10 ? 16 : 25;
}

/**
 * Escalado lineal de recompensa para incentivar el progreso.
 * Fórmula: R = 150 + (n × 2)
 *
 * Rango resultante: lvl_1 → 152 monedas, lvl_64 → 278 monedas.
 * Economy.js acepta cualquier entero positivo; no hay tope forzado en cliente.
 *
 * @param {number} n - Número ordinal del nivel (1-based)
 * @returns {number} Entero positivo de monedas
 */
function getRewardCoins(n) {
    return 150 + (n * 2);
}

// ─── Clase principal ──────────────────────────────────────────────────────────

export class LevelManager {
    constructor() {
        /** @type {Array<Object>} Array plano de objetos de nivel generados en memoria. */
        this.levels = [];
    }
    
    /**
     * Genera todos los niveles algorítmicamente en memoria.
     *
     * Esta función es async únicamente para mantener compatibilidad con el
     * contrato de main.js (`await loadLevels()`), pero NO realiza ninguna
     * petición de red. La generación es completamente síncrona.
     *
     * Para agregar un nivel: incrementar TOTAL_LEVELS y subir el asset a Cloudinary.
     * Para cambiar la dificultad: modificar getPieces() o getRewardCoins().
     */
    async loadLevels() {
        this.levels = Array.from({ length: TOTAL_LEVELS }, (_, i) => {
            const n = i + 1;
            // Cero a la izquierda para n < 10: Nivel01, Nivel02, … Nivel09, Nivel10, …
            // CRÍTICO: este formato debe coincidir exactamente con el nombre del asset
            // en Cloudinary. Cambiar a `Nivel${n}` romperá los niveles 1-9.
            const publicId = `Nivel${String(n).padStart(2, '0')}`;
            
            return {
                id: `lvl_${n}`,
                index: i,
                publicId,
                image: buildImageUrl(publicId),
                thumbnail: buildThumbnailUrl(publicId),
                pieces: getPieces(n),
                rewardCoins: getRewardCoins(n),
                description: `Sector Neuronal ${n}`,
                timeLimit: 0 // 0 = sin límite de tiempo; main.js muestra "∞" en HUD
            };
        });
        
        console.log(`[LevelManager] ${this.levels.length} niveles generados (Cloudinary).`);
    }
    
    /**
     * Retorna todos los niveles combinados con su estado actual de progreso.
     * Consulta Storage en cada llamada para reflejar el estado más reciente.
     *
     * @returns {Array<Object>} Niveles con campos `status`, `stars` y `thumbnail` añadidos
     */
    getAllLevelsWithStatus() {
        return this.levels.map(level => {
            const isUnlocked = Storage.isUnlocked(level.id);
            const stars = Storage.getStars(level.id);
            
            let status = 'locked';
            if (isUnlocked) status = 'unlocked';
            if (stars > 0) status = 'completed';
            
            return {
                ...level,
                status,
                stars,
                thumbnail: level.thumbnail || level.image // Fallback de seguridad
            };
        });
    }
    
    /**
     * Obtiene la configuración de un nivel por su ID.
     *
     * @param {string} id - Identificador del nivel (ej: "lvl_5")
     * @returns {Object|undefined} Objeto de nivel o undefined si no existe
     */
    getLevelById(id) {
        return this.levels.find(l => l.id === id);
    }
    
    /**
     * Calcula el ID del siguiente nivel basado en el ID actual.
     * Retorna null si el nivel actual es el último (lvl_64).
     *
     * @param {string} currentId - ID del nivel actual
     * @returns {string|null} ID del siguiente nivel o null
     */
    getNextLevelId(currentId) {
        const index = this.levels.findIndex(l => l.id === currentId);
        if (index !== -1 && index < this.levels.length - 1) {
            return this.levels[index + 1].id;
        }
        return null;
    }
}