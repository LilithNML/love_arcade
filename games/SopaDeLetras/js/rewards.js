/**
 * Gestión de recompensas compatible con GameCenter Core v6
 */
const la_ws_rewards = {
    storageKey: 'la_ws_completed_levels',

    getPaidLevels: function() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    markAsPaid: function(levelId) {
        const paid = this.getPaidLevels();
        if (!paid.includes(levelId)) {
            paid.push(levelId);
            localStorage.setItem(this.storageKey, JSON.stringify(paid));
        }
    },

    tryPay: function(levelId, coins) {
        const paidLevels = this.getPaidLevels();
        
        // Evitar doble pago localmente
        if (paidLevels.includes(levelId)) {
            console.log("Nivel ya pagado anteriormente.");
            return;
        }

        // Interacción con el app.js canónico
        if (window.GameCenter && typeof window.GameCenter.completeLevel === 'function') {
            [span_4](start_span)// El app.js canónico recibe (gameId, levelId, rewardAmount)[span_4](end_span)
            const result = window.GameCenter.completeLevel('wordsearch', levelId, Math.floor(coins));
            
            if (result && result.paid) {
                this.markAsPaid(levelId);
                console.log(`Recompensa de ${coins} procesada por GameCenter.`);
            }
        } else {
            // Modo standalone
            this.markAsPaid(levelId);
        }
    }
};
