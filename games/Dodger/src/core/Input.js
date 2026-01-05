export default class InputHandler {
    constructor() {
        this.keys = {
            left: false,
            right: false
        };

        // --- CONTROLES DE TECLADO (PC) ---
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

        // --- CONTROLES TÁCTILES (MÓVIL - CORREGIDO) ---
        // Usamos una lógica global: Si el dedo está en la mitad izquierda, mueve a izquierda.
        // Esto evita que el movimiento se corte si deslizas el dedo un poco.
        
        const handleTouch = (e) => {
            // Evitamos comportamientos del navegador (scroll, zoom, refresh)
            if(e.cancelable) e.preventDefault();

            this.keys.left = false;
            this.keys.right = false;

            // Si hay al menos un dedo en la pantalla
            if (e.touches.length > 0) {
                const touchX = e.touches[0].clientX;
                const halfWidth = window.innerWidth / 2;

                if (touchX < halfWidth) {
                    this.keys.left = true;
                } else {
                    this.keys.right = true;
                }
            }
        };

        const handleTouchEnd = (e) => {
            if(e.cancelable) e.preventDefault();
            
            // Si ya no quedan dedos tocando, detenemos todo
            if (e.touches.length === 0) {
                this.keys.left = false;
                this.keys.right = false;
            }
        };

        // Escuchamos en 'window' con { passive: false } para poder bloquear el scroll
        // 'touchmove' es vital: asegura que si deslizas el dedo, la nave te siga obedeciendo
        window.addEventListener('touchstart', handleTouch, { passive: false });
        window.addEventListener('touchmove', handleTouch, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { passive: false });
        window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }
}
