export default class EconomyManager {
    constructor() {
        this.gameId = 'dodger';
        this.baseReward = 2;
        this.multiplier = 1.5;
    }

    calculateCoins(score) {
        if (score <= 5) return 0;
        const performanceBonus = Math.floor(Math.sqrt(score) * this.multiplier);
        const total = this.baseReward + performanceBonus;
        return Math.min(total, 50); 
    }

    payout(score) {
        const coins = this.calculateCoins(score);
        
        if (!window.GameCenter) {
            console.warn("Love Arcade System no detectado. Modo Standalone.");
            return { sent: false, coins: 0 };
        }

        if (coins <= 0) return { sent: false, coins: 0 };

        const levelId = `session_${Date.now()}`;

        try {
            window.GameCenter.completeLevel(this.gameId, levelId, coins);
            console.log(`[Dodger] Enviadas ${coins} monedas.`);
            return { sent: true, coins: coins };
        } catch (e) {
            console.error("[Dodger] Error en transacción:", e);
            return { sent: false, coins: 0 };
        }
    }
}
