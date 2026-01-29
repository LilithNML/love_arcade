class LA_WS_GridRenderer {
    constructor(canvasId, gridSize) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = gridSize;
        this.cellSize = 0;
        this.colors = {
            grid: '#2a2a40',
            text: '#ffffff',
            highlight: 'rgba(0, 255, 204, 0.4)',
            found: 'rgba(112, 0, 255, 0.5)'
        };
    }

    resize(containerWidth) {
        const size = Math.min(containerWidth, 600); // Max width 600px
        this.canvas.width = size;
        this.canvas.height = size;
        this.cellSize = size / this.gridSize;
    }

    draw(grid, selection = [], foundPaths = []) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Dibujar letras y celdas
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = `${this.cellSize * 0.5}px monospace`;

        for (let r = 0; r < this.gridSize; r++) {
            for (let c = 0; c < this.gridSize; c++) {
                const x = c * this.cellSize;
                const y = r * this.cellSize;

                // Fondo de celda
                this.ctx.strokeStyle = this.colors.grid;
                this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);

                // Dibujar letra
                this.ctx.fillStyle = this.colors.text;
                this.ctx.fillText(grid[r][c], x + this.cellSize/2, y + this.cellSize/2);
            }
        }

        // Resaltar selección actual y palabras encontradas (Lógica de dibujo omitida por brevedad)
    }
}
