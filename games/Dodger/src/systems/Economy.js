export default class EconomyManager {
    constructor() {
        this.gameId = 'dodger';
        // AJUSTE 1: Base reward baja para evitar inflación en partidas cortas
        this.baseReward = 1; 
    }

    calculateCoins(score) {
        // AJUSTE 3: Umbral mínimo (30 puntos) para empezar a ganar
        if (score <= 30) return 0; 
        
        // AJUSTE 2: Curva suavizada (Factor 0.45)
        // Ejemplo: 266 pts -> ~8 monedas
        const raw = Math.sqrt(score) * 0.45;
        
        // AJUSTE 4: Soft Cap de rendimiento (máx 60 por habilidad pura)
        const performanceCoins = Math.min(raw, 60);

        let total = this.baseReward + Math.floor(performanceCoins);
        
        // Cap Global de Seguridad (100 monedas máx por transacción)
        return Math.min(total, 100); 
    }

    payout(score) {
        const coins = this.calculateCoins(score);

        // 1. Verificación de entorno (Love Arcade)
        if (!window.GameCenter) {
            console.warn('[Dodger] Offline Mode. Monedas calculadas: ' + coins);
            return { sent: false, coins: coins };
        }

        // 2. Validación básica
        if (coins <= 0) return { sent: false, coins: 0 };

        // 3. ID único para idempotencia
        const levelId = `session_${Date.now()}`;

        try {
            [span_0](start_span)// 4. Ejecución de la transacción[span_0](end_span)
            window.GameCenter.completeLevel(this.gameId, levelId, coins);
            console.log(`[Dodger] Payout exitoso: ${coins} monedas.`);
            return { sent: true, coins: coins };
        } catch (error) {
            console.error('[Dodger] Error enviando monedas:', error);
            return { sent: false, coins: 0 };
        }
    }
}
