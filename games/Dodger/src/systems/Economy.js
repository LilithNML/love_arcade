export default class EconomyManager {
    constructor() {
        [span_1](start_span)//[span_1](end_span) Identificador único del juego (minúsculas, sin espacios)
        this.gameId = 'dodger';
        this.baseReward = 2;
    }

    /**
     * Calcula monedas basadas en el tiempo sobrevivido (score).
     * Fórmula: Curva de raíz cuadrada para evitar farming infinito.
     * Ejemplo: 10s -> ~5 monedas, 60s -> ~9 monedas.
     */
    calculateCoins(timeScore) {
        if (timeScore <= 5) return 0; // Mínimo esfuerzo requerido
        
        // Fórmula de rendimientos decrecientes
        const performanceCoins = Math.sqrt(timeScore) * 1.5; 
        let total = this.baseReward + Math.floor(performanceCoins);
        
        [span_2](start_span)//[span_2](end_span) Validación interna lógica (no ceros)
        // Cap de seguridad por sesión
        return Math.min(total, 50); 
    }

    /**
     * Envía la transacción al Sistema Universal.
     * Se llama SOLO al Game Over.
     */
    payout(timeScore) {
        const coins = this.calculateCoins(timeScore);

        [span_3](start_span)//[span_3](end_span) Verificación de existencia del sistema
        if (!window.GameCenter) {
            console.warn('[Dodger] Love Arcade (GameCenter) no detectado. Modo Standalone.');
            return { sent: false, coins: 0 };
        }

        if (coins <= 0) return { sent: false, coins: 0 };

        [span_4](start_span)//[span_4](end_span) LevelId único para evitar duplicidad de transacción
        // Usamos timestamp para que cada partida cuente como un "nivel" único superado
        const uniqueSessionId = `session_${Date.now()}`;

        try {
            [span_5](start_span)//[span_5](end_span) Llamada al método de reporte oficial
            window.GameCenter.completeLevel(this.gameId, uniqueSessionId, coins);
            console.log(`[Dodger] Transacción enviada: ${coins} monedas.`);
            return { sent: true, coins: coins };
        } catch (error) {
            console.error('[Dodger] Error enviando monedas:', error);
            return { sent: false, coins: 0 };
        }
    }
}
