/**
 * PuzzleEngine.js v3.0 - Classic Jigsaw (Gap-Free)
 * Motor basado en Path2D con lógica de bordes compartidos y máscaras de recorte.
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        
        // Configuración
        this.img = config.image;
        this.gridSize = Math.sqrt(config.pieces); 
        this.callbacks = callbacks;
        
        // Estado
        this.pieces = [];
        this.selectedPiece = null;
        this.isDragging = false;
        
        // Audio throttling (evitar saturación de sonido)
        this.lastSoundTime = 0;
        
        this.init();
    }

    init() {
        this.resizeCanvas();
        this.generateTopology(); // Generar la matriz de formas 0/1/-1
        this.createPieces();
        this.shufflePieces();
        this.addEventListeners();
        requestAnimationFrame(() => this.render());
    }

    /**
     * Paso 1: Definir la topología.
     * 0 = Borde plano (exterior)
     * 1 = Tab (Saliente)
     * -1 = Slot (Entrante)
     */
    generateTopology() {
        this.shapes = [];
        
        for (let y = 0; y < this.gridSize; y++) {
            const row = [];
            for (let x = 0; x < this.gridSize; x++) {
                let top = 0, right = 0, bottom = 0, left = 0;

                // TOP: Si no es la fila 0, copiamos el bottom de arriba invertido
                if (y > 0) top = -this.shapes[y - 1][x].bottom;
                
                // BOTTOM: Si no es la última fila, aleatorio 1 o -1
                if (y < this.gridSize - 1) bottom = Math.random() > 0.5 ? 1 : -1;

                // LEFT: Si no es columna 0, copiamos el right de la izquierda invertido
                if (x > 0) left = -row[x - 1].right;

                // RIGHT: Si no es última columna, aleatorio 1 o -1
                if (x < this.gridSize - 1) right = Math.random() > 0.5 ? 1 : -1;

                row.push({ top, right, bottom, left });
            }
            this.shapes.push(row);
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

        // Margen del 15% para espacio de maniobra
        finalWidth *= 0.85;
        finalHeight *= 0.85;

        this.canvas.width = finalWidth;
        this.canvas.height = finalHeight;

        this.pieceWidth = finalWidth / this.gridSize;
        this.pieceHeight = finalHeight / this.gridSize;
    }

    createPieces() {
        this.pieces = [];
        const scaleX = this.img.width / this.canvas.width;
        const scaleY = this.img.height / this.canvas.height;

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const shape = this.shapes[y][x];
                
                // Path local (forma de la pieza base 0,0)
                const path = this.createPiecePath(this.pieceWidth, this.pieceHeight, shape);

                this.pieces.push({
                    id: `${x}-${y}`,
                    correctX: x * this.pieceWidth,
                    correctY: y * this.pieceHeight,
                    currentX: 0, 
                    currentY: 0,
                    isLocked: false,
                    path: path, // Guardamos el Path2D para reusarlo
                    shape: shape,
                    // Datos para el recorte de imagen (Source)
                    imgData: {
                        sx: x * (this.img.width / this.gridSize),
                        sy: y * (this.img.height / this.gridSize),
                        sw: this.img.width / this.gridSize,
                        sh: this.img.height / this.gridSize
                    }
                });
            }
        }
    }

    /**
     * Crea un Path2D perfecto usando curvas Bézier estandarizadas.
     */
    createPiecePath(w, h, shape) {
        const path = new Path2D();
        const tabSize = Math.min(w, h) * 0.25; // Tamaño de la pestaña (25%)

        path.moveTo(0, 0);

        // TOP
        if (shape.top !== 0) this.addTab(path, w, 0, w, tabSize * shape.top, false);
        else path.lineTo(w, 0);

        // RIGHT
        if (shape.right !== 0) this.addTab(path, w, 0, h, tabSize * shape.right, true);
        else path.lineTo(w, h);

        // BOTTOM
        if (shape.bottom !== 0) this.addTab(path, w, h, -w, tabSize * shape.bottom, false);
        else path.lineTo(0, h);

        // LEFT
        if (shape.left !== 0) this.addTab(path, 0, h, -h, tabSize * shape.left, true);
        else path.lineTo(0, 0);

        path.closePath();
        return path;
    }

    /**
     * Dibuja una pestaña estandarizada.
     * @param ctx: El Path2D
     * @param x, y: Punto de inicio
     * @param length: Longitud del lado (positivo o negativo para dirección)
     * @param size: Altura de la pestaña (positivo = fuera, negativo = dentro)
     * @param isVertical: Si estamos dibujando en eje Y
     */
    addTab(path, x, y, length, size, isVertical) {
        // Puntos de control relativos (0.0 a 1.0) para una forma de puzzle bonita
        const currX = x; 
        const currY = y;
        
        // Definición de curva suave (Neck -> Head -> Neck)
        const l1 = length * 0.35;
        const l2 = length * 0.65;
        const lEnd = length;
        
        // Puntos base
        // Si es vertical, operamos en Y, sino en X
        if (isVertical) {
            // Curva 1: Inicio al cuello
            path.bezierCurveTo(
                x + size * 0.2, y + length * 0.33, // CP1
                x + size,       y + length * 0.33, // CP2
                x + size,       y + length * 0.5   // Fin (Punta)
            );
            // Curva 2: Punta al final
            path.bezierCurveTo(
                x + size,       y + length * 0.66, // CP1
                x + size * 0.2, y + length * 0.66, // CP2
                x,              y + length         // Fin del lado
            );
        } else {
            // Horizontal
            path.bezierCurveTo(
                x + length * 0.33, y + size * 0.2,
                x + length * 0.33, y + size,
                x + length * 0.5,  y + size
            );
            path.bezierCurveTo(
                x + length * 0.66, y + size,
                x + length * 0.66, y + size * 0.2,
                x + length,        y
            );
        }
    }

    shufflePieces() {
        this.pieces.forEach(p => {
            // Random en rango visible
            const rangeX = this.canvas.width - this.pieceWidth;
            const rangeY = this.canvas.height - this.pieceHeight;
            
            p.currentX = Math.random() * rangeX;
            p.currentY = Math.random() * rangeY;
            p.isLocked = false;
        });
        this.render();
    }

    /* --- RENDER --- */
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. DIBUJAR GUÍA TENUE (Opcional, ayuda a saber dónde armar)
        this.ctx.strokeStyle = "rgba(255,255,255,0.05)";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, this.gridSize * this.pieceWidth, this.gridSize * this.pieceHeight);

        // Separar grupos
        const locked = this.pieces.filter(p => p.isLocked);
        const loose = this.pieces.filter(p => !p.isLocked && p !== this.selectedPiece);

        // CAPA 1: LOCKED (Imagen limpia, sin bordes entre ellas)
        // Optimizacion: Dibujamos piezas locked sin sombra para que parezca una sola imagen
        locked.forEach(p => this.drawPiece(p, false));

        // CAPA 2: LOOSE (Sombra suave)
        loose.forEach(p => this.drawPiece(p, true));

        // CAPA 3: SELECTED (Sombra fuerte + Escala)
        if (this.selectedPiece) {
            this.ctx.save();
            // Levantar pieza (Offset + Sombra)
            this.ctx.shadowColor = "rgba(0,0,0,0.5)";
            this.ctx.shadowBlur = 20;
            this.ctx.shadowOffsetX = 5;
            this.ctx.shadowOffsetY = 10;
            
            // Dibujar un poco más grande
            const cx = this.selectedPiece.currentX + this.pieceWidth/2;
            const cy = this.selectedPiece.currentY + this.pieceHeight/2;
            
            this.ctx.translate(cx, cy);
            this.ctx.scale(1.05, 1.05);
            this.ctx.translate(-cx, -cy);
            
            this.drawPiece(this.selectedPiece, true, true);
            this.ctx.restore();
        }
    }

    drawPiece(p, isLoose, isSelected = false) {
        this.ctx.save();
        this.ctx.translate(p.currentX, p.currentY);

        if (isLoose && !isSelected) {
            this.ctx.shadowColor = "rgba(0,0,0,0.3)";
            this.ctx.shadowBlur = 5;
            this.ctx.shadowOffsetY = 2;
        }

        // 1. CLIP: Crear máscara con la forma del puzzle
        this.ctx.stroke(p.path); // Truco para suavizar bordes en algunos navegadores
        this.ctx.clip(p.path);

        // 2. IMAGEN: Dibujar el trozo correspondiente
        // Calculamos el factor de escala entre la imagen original y el tamaño de la pieza en canvas
        // Importante: necesitamos un margen extra para cubrir las pestañas (tabs)
        const tabMargin = Math.min(this.pieceWidth, this.pieceHeight) * 0.35;
        
        // Dimensiones en la imagen original
        const srcW = this.img.width / this.gridSize;
        const srcH = this.img.height / this.gridSize;
        
        // Escalas
        const scaleX = srcW / this.pieceWidth;
        const scaleY = srcH / this.pieceHeight;

        // Dibujamos la imagen con un offset negativo para cubrir las pestañas salientes
        this.ctx.drawImage(
            this.img,
            p.imgData.sx - (tabMargin * scaleX),
            p.imgData.sy - (tabMargin * scaleY),
            p.imgData.sw + (tabMargin * 2 * scaleX),
            p.imgData.sh + (tabMargin * 2 * scaleY),
            -tabMargin, // en el canvas local (0,0 es top-left de pieza base)
            -tabMargin,
            this.pieceWidth + (tabMargin * 2),
            this.pieceHeight + (tabMargin * 2)
        );

        // 3. EFECTOS DE BORDE (Bevel / Iluminación)
        // Solo para piezas sueltas, para que las locked se vean fusionadas
        if (isLoose) {
            // Brillo superior/izquierdo (Luz)
            this.ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            this.ctx.lineWidth = 2;
            this.ctx.stroke(p.path);

            // Sombra interior sutil (simulada dibujando el path otra vez desplazado)
            // O simplemente un borde oscuro muy fino
            this.ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
            this.ctx.lineWidth = 1;
            this.ctx.stroke(p.path);
        }

        this.ctx.restore();
    }

    /* --- INPUT HANDLING --- */
    
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
        
        // Buscar de arriba a abajo
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            const p = this.pieces[i];
            if (p.isLocked) continue;

            // Hit detection aproximado (Caja) para rendimiento
            // Sumamos márgenes por las pestañas
            const m = this.pieceWidth * 0.25;
            if (x > p.currentX - m && x < p.currentX + this.pieceWidth + m &&
                y > p.currentY - m && y < p.currentY + this.pieceHeight + m) {
                
                // Hit detection preciso (Path)
                // Translate temporal para chequear path
                this.ctx.save();
                this.ctx.translate(p.currentX, p.currentY);
                const isInside = this.ctx.isPointInPath(p.path, x - p.currentX, y - p.currentY);
                this.ctx.restore();

                if (isInside) {
                    this.selectedPiece = p;
                    this.isDragging = true;
                    this.dragOffsetX = x - p.currentX;
                    this.dragOffsetY = y - p.currentY;
                    
                    // Traer al frente
                    this.pieces.splice(i, 1);
                    this.pieces.push(p);
                    
                    this.playSound('click');
                    requestAnimationFrame(() => this.render());
                    return;
                }
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
        
        // SNAP Logic
        const dist = Math.hypot(
            this.selectedPiece.currentX - this.selectedPiece.correctX, 
            this.selectedPiece.currentY - this.selectedPiece.correctY
        );
        
        // Umbral generoso (30% del ancho de pieza)
        const snapThreshold = this.pieceWidth * 0.3;

        if (dist < snapThreshold) {
            this.selectedPiece.currentX = this.selectedPiece.correctX;
            this.selectedPiece.currentY = this.selectedPiece.correctY;
            this.selectedPiece.isLocked = true;
            this.playSound('snap');
            this.checkVictory();
        }

        this.isDragging = false;
        this.selectedPiece = null;
        requestAnimationFrame(() => this.render());
    }

    checkVictory() {
        if (this.pieces.every(p => p.isLocked)) {
            this.playSound('win');
            setTimeout(this.callbacks.onWin, 500);
            this.destroy();
        }
    }

    playSound(type) {
        const now = Date.now();
        if (now - this.lastSoundTime > 50) { // Throttle 50ms
            this.callbacks.onSound(type);
            this.lastSoundTime = now;
        }
    }

    addEventListeners() {
        // Binds
        this.fnStart = this.handleStart.bind(this);
        this.fnMove = this.handleMove.bind(this);
        this.fnEnd = this.handleEnd.bind(this);

        this.canvas.addEventListener('mousedown', this.fnStart);
        window.addEventListener('mousemove', this.fnMove);
        window.addEventListener('mouseup', this.fnEnd);
        
        this.canvas.addEventListener('touchstart', this.fnStart, { passive: false });
        window.addEventListener('touchmove', this.fnMove, { passive: false });
        window.addEventListener('touchend', this.fnEnd);
    }

    destroy() {
        this.canvas.removeEventListener('mousedown', this.fnStart);
        window.removeEventListener('mousemove', this.fnMove);
        window.removeEventListener('mouseup', this.fnEnd);
        this.canvas.removeEventListener('touchstart', this.fnStart);
        window.removeEventListener('touchmove', this.fnMove);
        window.removeEventListener('touchend', this.fnEnd);
    }
}
