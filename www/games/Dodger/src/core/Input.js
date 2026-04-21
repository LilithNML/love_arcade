export default class InputHandler {
    constructor() {
        this.keys = {
            left: false,
            right: false
        };

        // --- TECLADO (PC) ---
        window.addEventListener('keydown', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = true;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = true;
            if (e.code === 'Escape') this.keys.escape = true;
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
            if (e.code === 'Escape') this.keys.escape = false;
        });

        // --- TÁCTIL (MÓVIL - ZONAS INDEPENDIENTES) ---
        // Recuperamos la lógica de la Beta: Zonas físicas invisibles.
        // Esto permite Multi-touch (frenado al pulsar ambos) y evita saltos.

        const leftZone = document.getElementById('touchLeft');
        const rightZone = document.getElementById('touchRight');
        const touchControls = document.getElementById('touchControls');

        // Activamos las zonas (quitamos el hidden del HTML)
        if (touchControls && leftZone && rightZone) {
            touchControls.classList.remove('hidden');
            touchControls.style.display = 'flex'; // Asegurar layout

            // Helper para asignar eventos y prevenir scroll
            const bindTouch = (zone, key) => {
                // Inicio del toque
                zone.addEventListener('touchstart', (e) => {
                    if (e.cancelable) e.preventDefault(); // Evita scroll y zoom
                    this.keys[key] = true;
                }, { passive: false });

                // Fin del toque
                zone.addEventListener('touchend', (e) => {
                    if (e.cancelable) e.preventDefault();
                    this.keys[key] = false;
                });

                // Si el dedo sale de la zona o se cancela (ej: llamada entrante)
                zone.addEventListener('touchcancel', (e) => {
                    this.keys[key] = false;
                });
            };

            bindTouch(leftZone, 'left');
            bindTouch(rightZone, 'right');
            
            console.log("[Input] Controles táctiles de zona activados.");
        }
    }
}
