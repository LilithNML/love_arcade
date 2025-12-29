/**
 * Storage.js
 * Wrapper para localStorage con namespacing para evitar conflictos.
 * [span_6](start_span)PROHIBIDO tocar claves reservadas del sistema[span_6](end_span).
 */

const PREFIX = 'puz_rompecabezas_'; // Namespacing propio

const DEFAULTS = {
    progress: {
        unlockedLevels: ['lvl_1'], // Nivel 1 desbloqueado por defecto
        completedLevels: [],       // IDs de niveles terminados
        bestTimes: {}              // { 'lvl_1': 45 } (segundos)
    },
    settings: {
        sound: true,
        volume: 0.8,
        performanceMode: false // false = alta calidad, true = ahorro
    }
};

export const Storage = {
    /**
     * Obtiene datos del almacenamiento
     * @param {string} key - 'progress' o 'settings'
     */
    get: (key) => {
        try {
            const data = localStorage.getItem(PREFIX + key);
            return data ? JSON.parse(data) : DEFAULTS[key];
        } catch (e) {
            console.error('[Storage] Error leyendo datos:', e);
            return DEFAULTS[key];
        }
    },

    /**
     * Guarda datos en el almacenamiento
     * @param {string} key - 'progress' o 'settings'
     * @param {object} value - Objeto a guardar
     */
    set: (key, value) => {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch (e) {
            console.error('[Storage] Error guardando datos:', e);
        }
    },

    /**
     * Actualiza una propiedad parcial del progreso
     */
    unlockLevel: (levelId) => {
        const progress = Storage.get('progress');
        if (!progress.unlockedLevels.includes(levelId)) {
            progress.unlockedLevels.push(levelId);
            Storage.set('progress', progress);
        }
    },
    
    markCompleted: (levelId, timeSeconds) => {
        const progress = Storage.get('progress');
        // Marcar completado
        if (!progress.completedLevels.includes(levelId)) {
            progress.completedLevels.push(levelId);
        }
        // Guardar mejor tiempo
        const prevTime = progress.bestTimes[levelId];
        if (!prevTime || timeSeconds < prevTime) {
            progress.bestTimes[levelId] = timeSeconds;
        }
        Storage.set('progress', progress);
    }
};
