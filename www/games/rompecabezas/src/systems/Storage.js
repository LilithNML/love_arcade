const SCHEMA_VERSION = 1;
const PREFIX = 'puz_arcade_';

export const Storage = {
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

    get: (key, defaultValue = null) => {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            if (!raw) return defaultValue;

            const parsed = JSON.parse(raw);

            if (!parsed.ver || parsed.ver !== SCHEMA_VERSION) {
                console.warn(`[Storage] Datos obsoletos para ${key}. Se usará valor por defecto.`);
                return defaultValue;
            }

            return parsed.data;
        } catch (e) {
            console.error('[Storage] Datos corruptos, reseteando:', key);
            return defaultValue;
        }
    },
    
    markCompleted: (levelId) => {
        const current = Storage.get('progress', {});
        if (!current[levelId]) {
            current[levelId] = true;
            Storage.set('progress', current);
            return true;
        }
        return false;
    },

    isCompleted: (levelId) => {
        const progress = Storage.get('progress', {});
        return !!progress[levelId];
    },

    unlockLevel: (levelId) => {
        const unlocked = Storage.get('unlocked', ['lvl_1']);
        if (!unlocked.includes(levelId)) {
            unlocked.push(levelId);
            Storage.set('unlocked', unlocked);
        }
    },

    isUnlocked: (levelId) => {
        const unlocked = Storage.get('unlocked', ['lvl_1']);
        return unlocked.includes(levelId);
    },

    validateUnlockedLevels: (allLevels) => {
        if (!allLevels || allLevels.length === 0) return;

        const progress = Storage.get('progress', {});
        const currentlyUnlocked = Storage.get('unlocked', ['lvl_1']);
        let needsUpdate = false;

        for (let i = 0; i < allLevels.length; i++) {
            const currentLevel = allLevels[i];
            const currentLevelId = currentLevel.id;
            
            if (progress[currentLevelId]) {
                if (i + 1 < allLevels.length) {
                    const nextLevelId = allLevels[i + 1].id;
                    
                    if (!currentlyUnlocked.includes(nextLevelId)) {
                        currentlyUnlocked.push(nextLevelId);
                        needsUpdate = true;
                    }
                }
            }
        }

        if (needsUpdate) {
            Storage.set('unlocked', currentlyUnlocked);
        }
    }
};
