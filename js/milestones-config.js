/**
 * Catálogo de hitos de racha (fuente de verdad).
 *
 * Escalabilidad:
 *  - Añadir nuevos objetos al array (60, 90, 120, ...).
 *  - La lógica del motor es agnóstica al número de hitos.
 */
window.STREAK_MILESTONES = Object.freeze([
    {
        id: 'streak_30d_lunar_01',
        threshold: 30,
        title: '🌙 30 DÍAS DE LEALTAD',
        message: '¡Gracias por jugar cada día! Tu constancia enciende el arcade. Reclama tu recompensa épica.',
        rewards: [
            { type: 'coins', amount: 2250, label: 'Monedas' },
            { type: 'moon_blessing_days', amount: 21, label: 'Bendición Lunar' }
        ]
    }
]);
