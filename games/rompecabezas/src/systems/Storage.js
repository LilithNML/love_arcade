/**
 * Storage.js v2.0 - Secure & Versioned
 * Gestiona el localStorage con protección contra corrupción y versiones de esquema.
 */

const SCHEMA_VERSION = 1; // Incrementa esto si cambias drásticamente la estructura de datos en el futuro
const PREFIX = 'puz_arcade_'; // Prefijo para no mezclar con otras apps en el mismo dominio

export const Storage = {
    /**
     * Guarda un valor con metadata de versión.
     */
    set: (key, value) => {
        try {
            const payload = {
                ver: SCHEMA_VERSION,
                timestamp: Date.now(),
                data: value
            };
            localStorage.setItem(PREFIX + key, JSON.stringify(payload));
        } catch (e) {
            console.error('[Storage] Error al guardar:', e);
        }
    },

    /**
     * Recupera un valor validando su integridad y versión.
     * Retorna 'defaultValue' si falla o no existe.
     */
    get: (key, defaultValue = null) => {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            if (!raw) return defaultValue;

            const parsed = JSON.parse(raw);

            // Verificación de esquema
            // Si el dato guardado no tiene versión o es vieja, lo descartamos (o migramos)
            if (!parsed.ver || parsed.ver !== SCHEMA_VERSION) {
                console.warn(`[Storage] Datos obsoletos para ${key}. Se usará valor por defecto.`);
                // Aquí podrías implementar lógica de migración si fuera necesario
                return defaultValue;
            }

            return parsed.data;
        } catch (e) {
            console.error('[Storage] Datos corruptos, reseteando:', key);
            return defaultValue;
        }
    },

    /**
     * Helpers específicos para el juego
     */
    
    // Guarda el progreso de estrellas (0 a 3)
    saveStars: (levelId, stars) => {
        const current = Storage.get('progress', {});
        // Solo guardamos si mejoramos la puntuación anterior
        if (!current[levelId] || stars > current[levelId]) {
            current[levelId] = stars;
            Storage.set('progress', current);
            return true; // Nuevo récord
        }
        return false;
    },

    getStars: (levelId) => {
        const progress = Storage.get('progress', {});
        return progress[levelId] || 0;
    },

    // Desbloqueo de niveles
    unlockLevel: (levelId) => {
        const unlocked = Storage.get('unlocked', ['lvl_1']); // Nivel 1 siempre desbloqueado
        if (!unlocked.includes(levelId)) {
            unlocked.push(levelId);
            Storage.set('unlocked', unlocked);
        }
    },

    isUnlocked: (levelId) => {
        const unlocked = Storage.get('unlocked', ['lvl_1']);
        return unlocked.includes(levelId);
    }
};
