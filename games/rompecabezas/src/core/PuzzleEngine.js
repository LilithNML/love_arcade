/**
 * PuzzleEngine.js v2.0 - Jigsaw Edition
 * Motor gráfico con formas Bézier procedimentales,
 * sombras dinámicas y rendering por capas.
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        
        // Configuración
        this.img = config.image;
        this.gridSize = Math.sqrt(config.pieces); // Ej: 3x3, 4x4
        this.callbacks = callbacks;
        
        // Estado
        this.pieces = [];
        this.selectedPiece = null;
        this.isDragging = false;
        
        // Dimensiones
        this.pieceWidth = 0;
        this.pieceHeight = 0;
        
        // Binds
        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        
        this.init();
    }

    init() {
        this.resizeCanvas(); // Calcula dimensiones base
        this.generateJigsawShapes(); // Crea la matriz de pestañas/huecos
        this.createPieces(); // Genera los objetos pieza
        this.shufflePieces();
        this.addEventListeners();
        
        // Render Loop inicial
        requestAnimationFrame(() => this.render());
    }

    /**
     * Paso 1: Definir la geometría del rompecabezas.
     * Cada borde compartido entre dos piezas debe coincidir (1 = pestaña, -1 = hueco).
     */
    generateJigsawShapes() {
        this.jigsawGrid = []; 
        // Array bidimensional para guardar la forma: [top, right, bottom, left]
        // 0 = plano (borde), 1 = tab (saliente), -1 = slot (entrante)

        for (let y = 0; y < this.gridSize; y++) {
            const row = [];
            for (let x = 0; x < this.gridSize; x++) {
                let top = 0, right = 0, bottom = 0, left = 0;

                // Si no es la primera fila, el TOP debe ser el opuesto del BOTTOM de la pieza de arriba
                if (y > 0) top = -this.jigsawGrid[y - 1][x].bottom;
                
                // Si no es la última fila, generamos aleatorio para BOTTOM
                if (y < this.gridSize - 1) bottom = Math.random() > 0.5 ? 1 : -1;

                // Si no es la primera columna, LEFT es opuesto del RIGHT de la izquierda
                if (x > 0) left = -row[x - 1].right;

                // Si no es la última columna, aleatorio para RIGHT
                if (x < this.gridSize - 1) right = Math.random() > 0.5 ? 1 : -1;

                row.push({ top, right, bottom, left });
            }
            this.jigsawGrid.push(row);
        }
    }

    resizeCanvas() {
        const parent = this.canvas.parentElement;
        const maxWidth = parent.clientWidth;
        const maxHeight = parent.clientHeight;
        const imgRatio = this.img.width / this.img.height;

        let finalWidth = maxWidth;
        let finalHeight = finalWidth / imgRatio;

        if (finalHeight > maxHeight) {
            finalHeight = maxHeight;
            finalWidth = finalHeight * imgRatio;
        }

        // Margen para que las pestañas no se corten en los bordes
        finalWidth *= 0.90;
        finalHeight *= 0.90;

        this.canvas.width = finalWidth;
        this.canvas.height = finalHeight;

        this.pieceWidth = finalWidth / this.gridSize;
        this.pieceHeight = finalHeight / this.gridSize;
        
        // Radio de la pestaña (tab) = 20% del tamaño de la pieza
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * 0.2; 
    }

    createPieces() {
        this.pieces = [];
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                this.pieces.push({
                    gridX: x,
                    gridY: y,
                    correctX: x * this.pieceWidth,
                    correctY: y * this.pieceHeight,
                    currentX: 0, 
                    currentY: 0,
                    isLocked: false,
                    shape: this.jigsawGrid[y][x], // {top, right, bottom, left}
                    // Coordenadas en la imagen original
                    sx: x * (this.img.width / this.gridSize),
                    sy: y * (this.img.height / this.gridSize),
                    sWidth: (this.img.width / this.gridSize),
                    sHeight: (this.img.height / this.gridSize)
                });
            }
        }
    }

    shufflePieces() {
        this.pieces.forEach(p => {
            // Dispersar dentro del canvas pero dejando margen
            p.currentX = Math.random() * (this.canvas.width - this.pieceWidth);
            p.currentY = Math.random() * (this.canvas.height - this.pieceHeight);
            p.isLocked = false;
        });
        this.render();
    }

    /* --- LOGICA DE DIBUJADO (La parte difícil) --- */

    /**
     * Dibuja el camino (path) de una pieza de rompecabezas.
     * Usa curvas de Bézier para crear formas suaves.
     */
    drawPiecePath(ctx, x, y, width, height, shape) {
        ctx.beginPath();
        ctx.moveTo(x, y);

        // TOP
        if (shape.top === 0) ctx.lineTo(x + width, y);
        else this.drawTab(ctx, x, y, width, shape.top, false);

        // RIGHT
        if (shape.right === 0) ctx.lineTo(x + width, y + height);
        else this.drawTab(ctx, x + width, y, height, shape.right, true);

        // BOTTOM
        if (shape.bottom === 0) ctx.lineTo(x, y + height);
        else this.drawTab(ctx, x + width, y + height, width, shape.bottom, false, true);

        // LEFT
        if (shape.left === 0) ctx.lineTo(x, y);
        else this.drawTab(ctx, x, y + height, height, shape.left, true, true);

        ctx.closePath();
    }

    /**
     * Helper para dibujar una pestaña o hueco.
     * @param vertical: si el lado es vertical (right/left)
     * @param reverse: si dibujamos de derecha a izquierda o abajo a arriba
     */
    drawTab(ctx, x, y, size, type, vertical, reverse) {
        // Puntos de control para la Curva de Bézier cúbica
        // Ajustados para que parezca una pieza de puzzle clásica
        const tabHeight = this.tabSize * type; // Si type es -1, va hacia adentro
        const neck = 0.2 * size;
        const head = 0.5 * size; // Ancho de la cabeza

        // Coordenadas relativas
        let p1x, p1y, p2x, p2y, p3x, p3y;
        
        // Transformar coordenadas según orientación
        // (Lógica simplificada usando transformaciones de contexto sería más limpia, 
        // pero cálculo manual es más performante aquí).
        
        // Base points a lo largo del lado
        const b1 = size * 0.35;
        const b2 = size * 0.65;
        
        if (vertical) {
            // Lado vertical (Right / Left)
            const sign = reverse ? -1 : 1;
            const startY = y;
            const endY = y + size * sign;
            
            // Curva hacia la pestaña
            ctx.bezierCurveTo(
                x + (tabHeight * 0.2), startY + (b1 * sign), // CP1
                x + tabHeight, startY + (neck * sign),       // CP2
                x + tabHeight, startY + (head * sign)        // End Point (mitad)
            );
            // Curva de regreso
            ctx.bezierCurveTo(
                x + tabHeight, endY - (neck * sign),         // CP1
                x + (tabHeight * 0.2), endY - (b1 * sign),   // CP2
                x, endY                                      // End Point
            );
        } else {
            // Lado horizontal (Top / Bottom)
            const sign = reverse ? -1 : 1;
            const startX = x;
            const endX = x + size * sign;

            ctx.bezierCurveTo(
                startX + (b1 * sign), y + (tabHeight * 0.2),
                startX + (neck * sign), y + tabHeight,
                startX + (head * sign), y + tabHeight
            );
            ctx.bezierCurveTo(
                endX - (neck * sign), y + tabHeight,
                endX - (b1 * sign), y + (tabHeight * 0.2),
                endX, y
            );
        }
    }

    render() {
        // Limpiar
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Filtro de capas para el Z-Index visual
        const lockedPieces = this.pieces.filter(p => p.isLocked);
        const loosePieces = this.pieces.filter(p => !p.isLocked && p !== this.selectedPiece);

        // CAPA 1: Piezas Bloqueadas (Fondo)
        // Se dibujan SIN sombra y SIN borde para que la imagen se vea unida.
        lockedPieces.forEach(p => this.renderOnePiece(p, false));

        // CAPA 2: Piezas Sueltas (Medio)
        // Sombra suave, borde sutil
        this.ctx.shadowColor = "rgba(0,0,0,0.3)";
        this.ctx.shadowBlur = 5;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        loosePieces.forEach(p => this.renderOnePiece(p, true));

        // CAPA 3: Pieza Seleccionada (Tope)
        // Sombra fuerte, escala mayor
        if (this.selectedPiece) {
            this.ctx.shadowColor = "rgba(0,0,0,0.6)";
            this.ctx.shadowBlur = 15;
            this.ctx.shadowOffsetX = 5;
            this.ctx.shadowOffsetY = 5;
            
            // Efecto de levantado (Scale up)
            this.ctx.save();
            this.ctx.translate(this.selectedPiece.currentX + this.pieceWidth/2, this.selectedPiece.currentY + this.pieceHeight/2);
            this.ctx.scale(1.05, 1.05); // 5% más grande
            this.ctx.translate(-(this.selectedPiece.currentX + this.pieceWidth/2), -(this.selectedPiece.currentY + this.pieceHeight/2));
            
            this.renderOnePiece(this.selectedPiece, true);
            this.ctx.restore();
        }
        
        // Reset shadows
        this.ctx.shadowColor = "transparent";
    }

    renderOnePiece(p, showBorder) {
        this.ctx.save();
        
        // 1. Definir el PATH (la forma de puzzle)
        this.drawPiecePath(this.ctx, p.currentX, p.currentY, this.pieceWidth, this.pieceHeight, p.shape);
        
        // 2. Rellenar con la imagen (Clip)
        this.ctx.clip();
        
        // Calcular cuánto de la imagen original necesitamos
        // Necesitamos incluir los márgenes para las pestañas (tabs)
        // La matemática es compleja: mapeamos el rect del canvas al rect de la imagen fuente
        const imgScaleX = this.img.width / (this.gridSize * this.pieceWidth);
        const imgScaleY = this.img.height / (this.gridSize * this.pieceHeight);
        
        this.ctx.drawImage(
            this.img, 
            p.sx - (this.tabSize * imgScaleX), // Source X (con margen izquierdo)
            p.sy - (this.tabSize * imgScaleY), // Source Y (con margen superior)
            p.sWidth + (this.tabSize * 2 * imgScaleX), // Source Width (con márgenes)
            p.sHeight + (this.tabSize * 2 * imgScaleY), // Source Height
            p.currentX - this.tabSize, // Dest X
            p.currentY - this.tabSize, // Dest Y
            this.pieceWidth + (this.tabSize * 2), // Dest Width
            this.pieceHeight + (this.tabSize * 2) // Dest Height
        );
        
        this.ctx.restore(); // Quitar el clip para poder dibujar el borde

        // 3. Dibujar Borde (Stroke)
        if (showBorder) {
            this.ctx.save();
            this.drawPiecePath(this.ctx, p.currentX, p.currentY, this.pieceWidth, this.pieceHeight, p.shape);
            this.ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"; // Borde luz
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            
            // Borde oscuro sutil para contraste
            this.ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    /* --- INPUT HANDLING (Sin cambios mayores, solo hit detection mejorado) --- */
    
    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Soporte touch/mouse unificado
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
        
        // Iterar inverso para agarrar la de arriba
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            const p = this.pieces[i];
            if (p.isLocked) continue;

            // Hit detection simple (Caja bounding)
            // Podríamos usar isPointInPath para precisión extrema, pero caja es suficiente y rápido
            if (x > p.currentX && x < p.currentX + this.pieceWidth &&
                y > p.currentY && y < p.currentY + this.pieceHeight) {
                
                this.selectedPiece = p;
                this.isDragging = true;
                this.dragOffsetX = x - p.currentX;
                this.dragOffsetY = y - p.currentY;
                
                // Mover al final del array (traer al frente lógico)
                this.pieces.splice(i, 1);
                this.pieces.push(p);
                
                this.callbacks.onSound('click');
                requestAnimationFrame(() => this.render());
                return;
            }
        }
    }

    handleMove(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        e.preventDefault();
        const { x, y } = this.getPointerPos(e);
        
        this.selectedPiece.currentX = x - this.dragOffsetX;
        this.selectedPiece.currentY = y - this.dragOffsetY;
        
        requestAnimationFrame(() => this.render());
    }

    handleEnd(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        
        // Snap Logic
        const targetX = this.selectedPiece.correctX;
        const targetY = this.selectedPiece.correctY;
        const dist = Math.hypot(this.selectedPiece.currentX - targetX, this.selectedPiece.currentY - targetY);
        const snapThreshold = this.pieceWidth * 0.4; // 40% tolerancia

        if (dist < snapThreshold) {
            // SNAP!
            this.selectedPiece.currentX = targetX;
            this.selectedPiece.currentY = targetY;
            this.selectedPiece.isLocked = true;
            this.callbacks.onSound('snap');
            
            // Pequeño efecto visual en la pieza (Highlight momentáneo)
            // (Se maneja por el hecho de que isLocked pasa a la capa de fondo)
            
            this.checkVictory();
        }

        this.isDragging = false;
        this.selectedPiece = null;
        requestAnimationFrame(() => this.render());
    }

    checkVictory() {
        if (this.pieces.every(p => p.isLocked)) {
            this.callbacks.onSound('win');
            setTimeout(this.callbacks.onWin, 500);
            this.destroy();
        }
    }

    addEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleStart);
        window.addEventListener('mousemove', this.handleMove);
        window.addEventListener('mouseup', this.handleEnd);
        this.canvas.addEventListener('touchstart', this.handleStart, { passive: false });
        window.addEventListener('touchmove', this.handleMove, { passive: false });
        window.addEventListener('touchend', this.handleEnd);
    }

    destroy() {
        this.canvas.removeEventListener('mousedown', this.handleStart);
        window.removeEventListener('mousemove', this.handleMove);
        window.removeEventListener('mouseup', this.handleEnd);
        this.canvas.removeEventListener('touchstart', this.handleStart);
        window.removeEventListener('touchmove', this.handleMove);
        window.removeEventListener('touchend', this.handleEnd);
    }
}
