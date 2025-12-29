/**
 * PuzzleEngine.js
 * Motor gráfico basado en Canvas 2D.
 * Gestiona el ciclo de renderizado, input de usuario y lógica de puzzle.
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        
        // Configuración
        this.img = config.image; // Objeto Image() ya cargado
        this.gridSize = Math.sqrt(config.pieces); // Ej: 9 piezas -> 3x3
        this.callbacks = callbacks; // { onWin, onSound }
        
        // Estado
        this.pieces = [];
        this.selectedPiece = null;
        this.isDragging = false;
        
        // Dimensiones lógicas vs Físicas
        this.pieceWidth = 0;
        this.pieceHeight = 0;
        this.scale = 1;
        
        // Input tracking
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Binds para no perder contexto 'this'
        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        
        this.init();
    }

    init() {
        this.resizeCanvas();
        this.createPieces();
        this.shufflePieces();
        this.addEventListeners();
        this.render(); // Primer render estático
    }

    resizeCanvas() {
        // Ajustar canvas al contenedor padre manteniendo aspect ratio de la imagen
        const parent = this.canvas.parentElement;
        const maxWidth = parent.clientWidth;
        const maxHeight = parent.clientHeight;
        
        const imgRatio = this.img.width / this.img.height;
        
        let finalWidth = maxWidth;
        let finalHeight = maxWidth / imgRatio;

        if (finalHeight > maxHeight) {
            finalHeight = maxHeight;
            finalWidth = finalHeight * imgRatio;
        }

        this.canvas.width = finalWidth;
        this.canvas.height = finalHeight;
        
        // Calcular tamaño de pieza en pantalla
        this.pieceWidth = finalWidth / this.gridSize;
        this.pieceHeight = finalHeight / this.gridSize;
        
        // Factor de escala (Imagen Real vs Canvas)
        this.scaleX = this.img.width / finalWidth;
        this.scaleY = this.img.height / finalHeight;
    }

    createPieces() {
        this.pieces = [];
        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                this.pieces.push({
                    correctCol: col,
                    correctRow: row,
                    currentX: 0, // Se definirá en shuffle
                    currentY: 0,
                    isLocked: false, // true cuando está en su lugar correcto
                    // Coordenadas de corte en la imagen original
                    sx: col * (this.img.width / this.gridSize),
                    sy: row * (this.img.height / this.gridSize)
                });
            }
        }
    }

    shufflePieces() {
        // Dispersar piezas aleatoriamente dentro del canvas
        this.pieces.forEach(p => {
            p.currentX = Math.random() * (this.canvas.width - this.pieceWidth);
            p.currentY = Math.random() * (this.canvas.height - this.pieceHeight);
            p.isLocked = false;
        });
        this.render();
    }

    /* --- INPUT HANDLING (Touch & Mouse unificados) --- */
    
    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    handleStart(e) {
        e.preventDefault();
        const { x, y } = this.getPointerPos(e);
        
        // Buscar si tocamos una pieza (iterar al revés para agarrar la de arriba)
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            const p = this.pieces[i];
            if (p.isLocked) continue; // No mover piezas ya colocadas

            if (x > p.currentX && x < p.currentX + this.pieceWidth &&
                y > p.currentY && y < p.currentY + this.pieceHeight) {
                
                this.selectedPiece = p;
                this.isDragging = true;
                
                // Offset para agarrar la pieza desde donde se hizo click
                this.dragOffsetX = x - p.currentX;
                this.dragOffsetY = y - p.currentY;
                
                // Traer al frente (mover al final del array)
                this.pieces.splice(i, 1);
                this.pieces.push(p);
                
                this.callbacks.onSound('click');
                this.render();
                return;
            }
        }
    }

    handleMove(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        e.preventDefault(); // Evitar scroll en móviles
        
        const { x, y } = this.getPointerPos(e);
        this.selectedPiece.currentX = x - this.dragOffsetX;
        this.selectedPiece.currentY = y - this.dragOffsetY;
        
        this.render();
    }

    handleEnd(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        
        // Lógica Snap-to-Grid
        const targetX = this.selectedPiece.correctCol * this.pieceWidth;
        const targetY = this.selectedPiece.correctRow * this.pieceHeight;
        
        // Distancia al objetivo
        const dist = Math.hypot(this.selectedPiece.currentX - targetX, this.selectedPiece.currentY - targetY);
        
        // Umbral de imantación (20% del tamaño de la pieza)
        const snapThreshold = this.pieceWidth * 0.3;

        if (dist < snapThreshold) {
            this.selectedPiece.currentX = targetX;
            this.selectedPiece.currentY = targetY;
            this.selectedPiece.isLocked = true;
            this.callbacks.onSound('snap');
            
            // Comprobar victoria
            this.checkVictory();
        }

        this.isDragging = false;
        this.selectedPiece = null;
        this.render();
    }

    /* --- RENDER LOOP --- */

    render() {
        // Limpiar canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Dibujar "Grid Fantasma" (Guía visual tenue)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        for (let i=0; i<=this.gridSize; i++) {
            this.ctx.moveTo(i * this.pieceWidth, 0);
            this.ctx.lineTo(i * this.pieceWidth, this.canvas.height);
            this.ctx.moveTo(0, i * this.pieceHeight);
            this.ctx.lineTo(this.canvas.width, i * this.pieceHeight);
        }
        this.ctx.stroke();

        // 2. Dibujar Piezas
        this.pieces.forEach(p => {
            // Sombra si está seleccionada
            if (p === this.selectedPiece) {
                this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
                this.ctx.shadowBlur = 10;
            } else {
                this.ctx.shadowBlur = 0;
            }

            this.ctx.drawImage(
                this.img,
                p.sx, p.sy, this.img.width / this.gridSize, this.img.height / this.gridSize, // Source
                p.currentX, p.currentY, this.pieceWidth, this.pieceHeight // Dest
            );

            // Borde de pieza
            this.ctx.strokeRect(p.currentX, p.currentY, this.pieceWidth, this.pieceHeight);
        });
    }

    checkVictory() {
        const allLocked = this.pieces.every(p => p.isLocked);
        if (allLocked) {
            this.callbacks.onSound('win');
            // Pequeño delay para que el usuario vea la última pieza encajar
            setTimeout(() => {
                this.callbacks.onWin();
            }, 300);
            this.removeEventListeners();
        }
    }

    addEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleStart);
        this.canvas.addEventListener('mousemove', this.handleMove);
        window.addEventListener('mouseup', this.handleEnd); // Window por si suelta fuera

        this.canvas.addEventListener('touchstart', this.handleStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handleMove, { passive: false });
        window.addEventListener('touchend', this.handleEnd);
    }

    removeEventListeners() {
        this.canvas.removeEventListener('mousedown', this.handleStart);
        this.canvas.removeEventListener('mousemove', this.handleMove);
        window.removeEventListener('mouseup', this.handleEnd);
        this.canvas.removeEventListener('touchstart', this.handleStart);
        this.canvas.removeEventListener('touchmove', this.handleMove);
        window.removeEventListener('touchend', this.handleEnd);
    }

    destroy() {
        this.removeEventListeners();
        this.ctx.clearRect(0,0, this.canvas.width, this.canvas.height);
    }
}
