const GAME_ID = 'rompecabezas';

export const Economy = {
    payout: (levelId, rewardCoins) => {
        if (!Number.isInteger(rewardCoins) || rewardCoins <= 0) {
            console.error(`[Economy] Error: Cantidad inválida (${rewardCoins}). Debe ser entero positivo.`);
            return;
        }
        
        if (!levelId || typeof levelId !== 'string') {
            console.error('[Economy] Error: levelId inválido.');
            return;
        }
        
        if (window.GameCenter && typeof window.GameCenter.completeLevel === 'function') {
            try {
                window.GameCenter.completeLevel(GAME_ID, levelId, rewardCoins);
                console.log(`[Economy] Transacción enviada: ${rewardCoins} monedas | Nivel: ${levelId}`);
            } catch (error) {
                console.error('[Economy] Excepción crítica al contactar GameCenter:', error);
            }
        } else {
            console.warn('[Economy] Modo Dev/Standalone: GameCenter no detectado. Victoria simulada.');
        }
    }
};
