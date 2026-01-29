class LA_WS_InputHandler {
    constructor(canvas, gridSize, onSelectEnd) {
        this.canvas = canvas;
        this.gridSize = gridSize;
        this.onSelectEnd = onSelectEnd;
        this.isSelecting = false;
        this.selectionPath = []; // [{r, c}]
        this.init();
    }

    getCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
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
            this.isSelecting = true;
            this.selectionPath = [this.getCoords(e)];
        };

        const move = (e) => {
            if (!this.isSelecting) return;
            const pos = this.getCoords(e);
            const last = this.selectionPath[this.selectionPath.length - 1];
            if (pos.r !== last.r || pos.c !== last.c) {
                // Validación básica de línea recta omitida para brevedad
                this.selectionPath.push(pos);
            }
        };

        const end = () => {
            if (this.isSelecting) {
                this.isSelecting = false;
                this.onSelectEnd(this.selectionPath);
                this.selectionPath = [];
            }
        };

        this.canvas.addEventListener('mousedown', start);
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', end);
        this.canvas.addEventListener('touchstart', start, {passive: false});
        window.addEventListener('touchmove', move, {passive: false});
        window.addEventListener('touchend', end);
    }
}
