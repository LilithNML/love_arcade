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
        title: '🌕 30 NOCHES BAJO NUESTRA LUNA',
        message: 'Gracias por estar aquí cada día. Has convertido este código en nuestro refugio personal. Para el jugador que ilumina mis noches, un regalo de tu Lunita.',
        rewards: [
            { type: 'coins', amount: 3250, label: 'Monedas' },
            { type: 'moon_blessing_days', amount: 21, label: 'Bendición Lunar' }
        ]
    }
]);
