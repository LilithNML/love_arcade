import Game from './core/Game.js';

// Esperar a que el DOM esté listo
window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    
    // Instanciar el núcleo del juego
    const game = new Game(canvas);
    
    // Iniciar
    console.log('[Dodger] Juego inicializado.');
});
