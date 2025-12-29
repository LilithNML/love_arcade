/**
 * Economy.js
 * Gestiona la comunicación con el Sistema Universal de Monedas (Love Arcade).
 * Cumple con la especificación técnica: Contrato de Integración.
 */

const GAME_ID = 'rompecabezas'; // Identificador único

export const Economy = {
    /**
     * Envía la solicitud de depósito al núcleo.
     * @param {string} levelId - Identificador del nivel completado (ej: 'lvl_1')
     * @param {number} rewardCoins - Cantidad de monedas a otorgar
     */
    payout: (levelId, rewardCoins) => {
        // 1. Validación estricta de tipos
        // Aseguramos que sea entero y positivo según doc 
        if (!Number.isInteger(rewardCoins) || rewardCoins <= 0) {
            console.error(`[Economy] Error: Cantidad inválida (${rewardCoins}). Debe ser entero positivo.`);
            return;
        }

        if (!levelId || typeof levelId !== 'string') {
            console.error('[Economy] Error: levelId inválido.');
            return;
        }

        // 2. Comprobación de existencia del Sistema Universal
        // Verificamos window.GameCenter antes de llamar 
        if (window.GameCenter && typeof window.GameCenter.completeLevel === 'function') {
            try {
                // 3. Ejecución del contrato
                // window.GameCenter.completeLevel(gameId, levelId, coins) 
                window.GameCenter.completeLevel(GAME_ID, levelId, rewardCoins);
                console.log(`[Economy] Transacción enviada: ${rewardCoins} monedas | Nivel: ${levelId}`);
            } catch (error) {
                console.error('[Economy] Excepción crítica al contactar GameCenter:', error);
            }
        } else {
            // 4. Modo Standalone (Fallback)
            // Si window.GameCenter es undefined, no hacemos nada (el juego sigue) 
            console.warn('[Economy] Modo Dev/Standalone: GameCenter no detectado. Victoria simulada.');
        }
    }
};
