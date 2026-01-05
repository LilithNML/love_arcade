export default class InputHandler {
    constructor() {
        this.keys = {
            left: false,
            right: false
        };

        // Referencia al canvas para distinguir toques de juego vs toques de UI
        const canvas = document.getElementById('gameCanvas');

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

        // --- TÁCTIL (MÓVIL) ---
        
        const handleTouch = (e) => {
            // CRÍTICO: Si lo que tocamos NO es el canvas (es un botón, menú, texto...),
            // salimos inmediatamente para dejar que el navegador procese el clic.
            if (e.target !== canvas) {
                return;
            }

            // Si tocamos el canvas, prevenimos comportamientos nativos (scroll/zoom)
            // y procesamos la dirección de la nave.
            if(e.cancelable) e.preventDefault();

            this.keys.left = false;
            this.keys.right = false;

            // Lógica de "Mitad Izquierda / Mitad Derecha"
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
            // Misma regla: solo intervenimos si se soltó el dedo del canvas
            if (e.target !== canvas) return;
            
            if(e.cancelable) e.preventDefault();
            
            // Si no quedan dedos en el juego, detenemos el movimiento
            if (e.touches.length === 0) {
                this.keys.left = false;
                this.keys.right = false;
            }
        };

        // Escuchamos globalmente pero filtramos por 'e.target' dentro de la función
        // Usamos { passive: false } para poder usar preventDefault()
        window.addEventListener('touchstart', handleTouch, { passive: false });
        window.addEventListener('touchmove', handleTouch, { passive: false });
        window.addEventListener('touchend', handleTouchEnd, { passive: false });
        window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    }
}
