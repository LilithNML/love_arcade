export default class EconomyManager {
    constructor() {
        this.gameId = 'dodger';
        this.baseReward = 2; // Monedas fijas por participar
    }

    calculateCoins(score) {
        if (score <= 50) return 0; // Mínimo esfuerzo requerido
        
        // --- REBALANCEO V2 ---
        // Fórmula anterior: Math.sqrt(score) * 1.5 (Muy agresiva al inicio)
        // Fórmula nueva: Math.sqrt(score) * 0.6 (Crecimiento más controlado)
        
        // Ejemplo: 800 pts -> sqrt(800)=28. 28 * 0.6 = 16.8 (+2 base) = ~19 monedas.
        // Ejemplo: 5000 pts -> sqrt(5000)=70. 70 * 0.6 = 42 (+2 base) = ~44 monedas.
        // Ejemplo: 10000 pts -> sqrt(10000)=100. 100 * 0.6 = 60 (+2 base) = ~62 monedas.

        const performanceCoins = Math.sqrt(score) * 0.6; 
        let total = this.baseReward + Math.floor(performanceCoins);
        
        // Aumentamos el Cap máximo a 100 para motivar récords altos
        return Math.min(total, 100); 
    }

    payout(score) {
        const coins = this.calculateCoins(score);

        // Validación de sistema
        if (!window.GameCenter) {
            console.warn('[Dodger] Love Arcade no detectado (Modo Offline). Monedas calculadas: ' + coins);
            return { sent: false, coins: coins };
        }

        if (coins <= 0) return { sent: false, coins: 0 };

        const levelId = `session_${Date.now()}`;

        try {
            window.GameCenter.completeLevel(this.gameId, levelId, coins);
            console.log(`[Dodger] Payout exitoso: ${coins} monedas.`);
            return { sent: true, coins: coins };
        } catch (error) {
            console.error('[Dodger] Error enviando monedas:', error);
            return { sent: false, coins: 0 };
        }
    }
}
