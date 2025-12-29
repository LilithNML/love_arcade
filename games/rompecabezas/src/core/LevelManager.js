import { Storage } from '../systems/Storage.js';

export class LevelManager {
    constructor() {
        this.levelsConfig = [];
        this.currentLevel = null;
    }

    async loadLevels() {
        try {
            // Carga el JSON estático
            const response = await fetch('./public/levels.json'); // Ruta relativa
            if (!response.ok) throw new Error('No se pudo cargar levels.json');
            this.levelsConfig = await response.json();
            return this.levelsConfig;
        } catch (error) {
            console.error('[LevelManager] Error crítico cargando niveles:', error);
            return [];
        }
    }

    getLevelById(id) {
        return this.levelsConfig.find(l => l.id === id);
    }

    getAllLevelsWithStatus() {
        const progress = Storage.get('progress');
        
        return this.levelsConfig.map((level, index) => {
            const isUnlocked = progress.unlockedLevels.includes(level.id);
            const isCompleted = progress.completedLevels.includes(level.id);
            const bestTime = progress.bestTimes[level.id] || null;

            return {
                ...level,
                status: isUnlocked ? (isCompleted ? 'completed' : 'unlocked') : 'locked',
                bestTime: bestTime,
                index: index // Para saber el orden
            };
        });
    }

    getNextLevelId(currentId) {
        const currentIndex = this.levelsConfig.findIndex(l => l.id === currentId);
        if (currentIndex !== -1 && currentIndex < this.levelsConfig.length - 1) {
            return this.levelsConfig[currentIndex + 1].id;
        }
        return null;
    }
}
