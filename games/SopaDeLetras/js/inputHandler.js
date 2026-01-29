class LA_WS_InputHandler {
    constructor(canvas, gridSize, onSelectEnd) {
        this.canvas = canvas;
        this.gridSize = gridSize;
        this.onSelectEnd = onSelectEnd;
        this.isSelecting = false;
        this.selectionPath = [];
        this.init();
    }

    getCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Soporte touch mejorado para obtener la posición exacta en el canvas
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        const cellSize = rect.width / this.gridSize;
        return {
            r: Math.floor(y / cellSize),
            c: Math.floor(x / cellSize)
        };
    }

    init() {
        const start = (e) => {
            if (e.touches) e.preventDefault(); // Evita scroll en móviles
            this.isSelecting = true;
            this.selectionPath = [this.getCoords(e)];
        };

        const move = (e) => {
            if (!this.isSelecting) return;
            if (e.touches) e.preventDefault(); 
            
            const pos = this.getCoords(e);
            // Validar que las coordenadas estén dentro de la grilla
            if (pos.r >= 0 && pos.r < this.gridSize && pos.c >= 0 && pos.c < this.gridSize) {
                const last = this.selectionPath[this.selectionPath.length - 1];
                if (pos.r !== last.r || pos.c !== last.c) {
                    this.selectionPath.push(pos);
                }
            }
        };

        const end = (e) => {
            if (this.isSelecting) {
                this.isSelecting = false;
                this.onSelectEnd(this.selectionPath);
                this.selectionPath = [];
            }
        };

        // Mouse Events
        this.canvas.addEventListener('mousedown', start);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);

        // Touch Events con passive: false para permitir preventDefault()
        this.canvas.addEventListener('touchstart', start, { passive: false });
        this.canvas.addEventListener('touchmove', move, { passive: false });
        this.canvas.addEventListener('touchend', end, { passive: false });
    }
}
