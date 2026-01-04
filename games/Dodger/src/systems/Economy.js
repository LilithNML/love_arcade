export default class EconomyManager {
    constructor() {
        this.gameId = 'dodger';
        // AJUSTE 1: Bajamos la base para reducir inflación temprana.
        // Antes 2, ahora 1.
        this.baseReward = 1; 
    }

    calculateCoins(score) {
        // AJUSTE 3: Umbral más permisivo para no frustrar en partidas cortas.
        // Antes 50, ahora 30.
        if (score <= 30) return 0; 
        
        // AJUSTE 2: Factor 0.45 para una curva más lenta y "arcade".
        // Ejemplo: 266 pts -> sqrt(16.3) * 0.45 = 7.3 (+1 base) = 8 monedas. (Antes 11)
        const raw = Math.sqrt(score) * 0.45;
        
        // AJUSTE 4: Soft Cap de rendimiento puro.
        // Limitamos lo que el score puro puede dar a 60 monedas.
        // Esto obliga a que, para llegar al Cap Global (100), se dependa de futuros bonos (Récords, etc).
        const performanceCoins = Math.min(raw, 60);

        let total = this.baseReward + Math.floor(performanceCoins);
        
        // Cap Global de Seguridad (Anti-Exploit / God Mode)
        // Mantenemos 100 como límite absoluto de la transacción.
        return Math.min(total, 100); 
    }

    payout(score) {
        const coins = this.calculateCoins(score);

        // --- VALIDACIONES DEL SISTEMA UNIVERSAL ---
        
        // 1. Verificar existencia del GameCenter (Love Arcade Core)
        if (!window.GameCenter) {
            console.warn('[Dodger] Love Arcade no detectado (Modo Offline). Monedas calculadas: ' + coins);
            return { sent: false, coins: coins };
        }

        // 2. No enviar transacciones de 0 o negativas
        if (coins <= 0) return { sent: false, coins: 0 };

        // 3. Generar ID único por sesión (Idempotencia)
        const levelId = `session_${Date.now()}`;

        try {
         // 4. Ejecutar transacción
            window.GameCenter.completeLevel(this.gameId, levelId, coins);
            console.log(`[Dodger] Payout exitoso: ${coins} monedas.`);
            return { sent: true, coins: coins };
        } catch (error) {
            console.error('[Dodger] Error enviando monedas:', error);
            return { sent: false, coins: 0 };
        }
    }
}
