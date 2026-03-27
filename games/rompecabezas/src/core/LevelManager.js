import { Storage } from '../systems/Storage.js';

const TOTAL_LEVELS = 100;
const CLOUDINARY_BASE = 'https://res.cloudinary.com/dyspgn0sw/image/upload';

function buildImageUrl(publicId) {
    return `${CLOUDINARY_BASE}/f_auto,q_auto/v1/${publicId}`;
}

function buildThumbnailUrl(publicId) {
    return `${CLOUDINARY_BASE}/c_thumb,w_240,g_center,f_auto,q_auto/v1/${publicId}`;
}

function getPieces(n) {
    return n <= 10 ? 16 : 25;
}

function getRewardCoins(n) {
    return 150 + (n * 2);
}

export class LevelManager {
    constructor() {
        this.levels = [];
    }
    
    async loadLevels() {
        this.levels = Array.from({ length: TOTAL_LEVELS }, (_, i) => {
            const n = i + 1;
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
