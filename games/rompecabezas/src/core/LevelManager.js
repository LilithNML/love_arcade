/**
 * LevelManager.js
 * Encargado de cargar la configuración de niveles y gestionar el estado (bloqueado/desbloqueado)
 * integrándose con el nuevo sistema Storage v2.
 */

import { Storage } from '../systems/Storage.js';

export class LevelManager {
    constructor() {
        this.levels = [];
    }

    /**
     * Carga el JSON de niveles.
     */
    async loadLevels() {
        try {
            // Nota: Usamos ./public/levels.json para compatibilidad con el Service Worker
            const response = await fetch('./public/levels.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.levels = await response.json();
            
            // Asignar índice numérico para facilitar cálculos
            this.levels.forEach((lvl, index) => {
                lvl.index = index;
            });
            
            console.log(`[LevelManager] ${this.levels.length} niveles cargados.`);
        } catch (e) {
            console.error('[LevelManager] Error crítico cargando niveles:', e);
            alert("Error cargando configuración de niveles. Intenta recargar.");
        }
    }

    /**
     * Retorna todos los niveles combinados con su estado actual de progreso.
     * Esta función era la causante del ERROR ANTERIOR.
     */
    getAllLevelsWithStatus() {
        return this.levels.map(level => {
            // --- FIX CRÍTICO ---
            // Antes intentaba leer propiedades de un objeto null.
            // Ahora usamos los métodos seguros de Storage.js
            
            const isUnlocked = Storage.isUnlocked(level.id);
            const stars = Storage.getStars(level.id);

            let status = 'locked';
            
            if (isUnlocked) {
                status = 'unlocked';
            }
            
            if (stars > 0) {
                status = 'completed';
            }

            return {
                ...level,
                status: status,    // locked | unlocked | completed
                stars: stars,      // 0, 1, 2, 3
                thumbnail: level.thumbnail || level.image // Fallback de seguridad
            };
        });
    }

    /**
     * Obtiene la configuración de un nivel por su ID.
     */
    getLevelById(id) {
        return this.levels.find(l => l.id === id);
    }

    /**
     * Calcula cuál es el siguiente nivel basado en el ID actual.
     */
    getNextLevelId(currentId) {
        const index = this.levels.findIndex(l => l.id === currentId);
        
        // Si existe y no es el último
        if (index !== -1 && index < this.levels.length - 1) {
            return this.levels[index + 1].id;
        }
        
        return null; // No hay más niveles
    }
}
