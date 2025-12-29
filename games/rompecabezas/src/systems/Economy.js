/**
 * Economy.js
 * Gestiona la comunicación con el Sistema Universal de Monedas (Love Arcade).
 * Cumple con la especificación técnica: Contrato de Integración (Sección 5).
 */

const GAME_ID = 'rompecabezas'; [span_0](start_span)// ID único del juego[span_0](end_span)

export const Economy = {
    /**
     * Envía la solicitud de depósito al núcleo.
     * @param {string} levelId - Identificador del nivel completado (ej: 'lvl_1')
     * @param {number} amount - Cantidad de monedas a otorgar
     * @returns {boolean} - true si la transacción se envió (o simuló), false si hubo error de validación.
     */
    payout: (levelId, amount) => {
        [span_1](start_span)[span_2](start_span)// 1. Validación de tipos y lógica (Sección 5.3)[span_1](end_span)[span_2](end_span)
        if (!Number.isInteger(amount) || amount <= 0) {
            console.error(`[Economy] Error: Cantidad inválida (${amount}). Debe ser entero positivo.`);
            return false;
        }

        if (!levelId || typeof levelId !== 'string') {
            console.error('[Economy] Error: levelId inválido.');
            return false;
        }

        [span_3](start_span)// 2. Comprobación de existencia del Sistema Universal[span_3](end_span)
        if (window.GameCenter && typeof window.GameCenter.completeLevel === 'function') {
            try {
                [span_4](start_span)// 3. Ejecución del contrato[span_4](end_span)
                window.GameCenter.completeLevel(GAME_ID, levelId, amount);
                console.info(`[Economy] Transacción enviada: ${amount} monedas | Nivel: ${levelId}`);
                return true;
            } catch (error) {
                console.error('[Economy] Excepción crítica al contactar GameCenter:', error);
                return false;
            }
        } else {
            [span_5](start_span)// 4. Modo Standalone (Fallback)[span_5](end_span)
            // El juego funciona, pero las monedas no se acumulan en el saldo global.
            console.warn('[Economy] Modo Offline/Dev: GameCenter no detectado. Monedas no depositadas globalmente.');
            return true; // Retornamos true para no interrumpir el flujo del juego
        }
    }
};
