export default class InputHandler {
    constructor() {
        this.keys = {
            left: false,
            right: false,
            escape: false
        };
        
        // Zonas de toque para móviles (0 = izquierda, 1 = derecha)
        this.touchX = null;

        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        
        // Touch events básicos
        window.addEventListener('touchstart', (e) => this.onTouchStart(e));
        window.addEventListener('touchend', () => this.onTouchEnd());
    }

    onKeyDown(e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = true;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = true;
        if (e.code === 'Escape') this.keys.escape = true;
    }

    onKeyUp(e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
        if (e.code === 'Escape') this.keys.escape = false;
    }

    onTouchStart(e) {
        const touch = e.touches[0];
        const width = window.innerWidth;
        // Si toca la mitad izquierda -> Izquierda, si no -> Derecha
        if (touch.clientX < width / 2) {
            this.keys.left = true;
            this.keys.right = false;
        } else {
            this.keys.right = true;
            this.keys.left = false;
        }
    }

    onTouchEnd() {
        this.keys.left = false;
        this.keys.right = false;
    }
}
