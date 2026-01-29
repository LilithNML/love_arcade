const la_ws_rewards = {
    key: 'la_ws_completed_levels',

    // Obtiene lista de niveles ya pagados desde el almacenamiento local del juego
    getPaidLevels: function() {
        const data = localStorage.getItem(this.key);
        return data ? JSON.parse(data) : [];
    },

    markAsPaid: function(levelId) {
        const paid = this.getPaidLevels();
        if (!paid.includes(levelId)) {
            paid.push(levelId);
            localStorage.setItem(this.key, JSON.stringify(paid));
        }
    },

    [span_6](start_span)[span_7](start_span)// Intento de envío de monedas al GameCenter[span_6](end_span)[span_7](end_span)
    tryPay: function(levelId, coins) {
        const alreadyPaid = this.getPaidLevels().includes(levelId);
        
        if (alreadyPaid) {
            console.log(`[WordSearch] El nivel ${levelId} ya fue pagado anteriormente.`);
            return;
        }

        [span_8](start_span)[span_9](start_span)// Validación de seguridad: monedas debe ser entero positivo[span_8](end_span)[span_9](end_span)
        const finalCoins = Math.max(0, Math.floor(coins));

        [span_10](start_span)[span_11](start_span)// Verificación de existencia del Sistema Universal[span_10](end_span)[span_11](end_span)
        if (window.GameCenter && typeof window.GameCenter.completeLevel === 'function') {
            try {
                [span_12](start_span)[span_13](start_span)// Contrato de integración: gameId, levelId, coins[span_12](end_span)[span_13](end_span)
                window.GameCenter.completeLevel('wordsearch', levelId, finalCoins);
                this.markAsPaid(levelId);
                console.log(`[WordSearch] Recompensa enviada: ${finalCoins} monedas.`);
            } catch (error) {
                console.error('[WordSearch] Error crítico al contactar GameCenter:', error);
            }
        } else {
            [span_14](start_span)// Modo Standalone: El juego funciona pero no reporta al banco[span_14](end_span)
            console.warn('[WordSearch] GameCenter no detectado. Jugando en modo local.');
            this.markAsPaid(levelId);
        }
    }
};
