/**
 * PuzzleEngine.js v5.0
 * - Visuales: High DPI (Retina), Seamless locking (sin líneas).
 * - Performance: Gestión eficiente de sombras y renderizado bajo demanda.
 * - Input: Hitbox rápida (Bounding Box).
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimización: alpha false si el fondo es opaco
        
        // Configuración
        this.img = config.image;
        this.gridSize = Math.sqrt(config.pieces); 
        this.callbacks = callbacks || {};
        
        // Estado
        this.pieces = [];
        this.selectedPiece = null;
        this.isDragging = false;
        
        // Variables Input V1 (Caja)
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        
        // Throttle de sonido
        this.lastSound = 0;
        
        // Manejo de DPI para nitidez
        this.dpr = Math.min(window.devicePixelRatio || 1, 2); // Capado a 2x para rendimiento
        
        // Binds
        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        this.init();
    }

    init() {
        this.resizeCanvas();
        this.generateTopology(); 
        this.createPieces();
        this.shufflePieces();
        this.addEventListeners();
        
        // Primer render forzado
        requestAnimationFrame(() => this.render());
    }

    handleResize() {
        this.resizeCanvas();
        // Al redimensionar, necesitamos regenerar los paths para la nueva escala
        this.createPiecesPathsOnly(); 
        this.render();
    }

    resizeCanvas() {
        const parent = this.canvas.parentElement;
        const maxWidth = parent.clientWidth;
        const maxHeight = parent.clientHeight;
        const imgRatio = this.img.width / this.img.height;

        let cssWidth = maxWidth;
        let cssHeight = cssWidth / imgRatio;

        if (cssHeight > maxHeight) {
            cssHeight = maxHeight;
            cssWidth = cssHeight * imgRatio;
        }

        // Margen del 15% para espacio de trabajo
        cssWidth *= 0.85;
        cssHeight *= 0.85;

        // --- SISTEMA HIGH DPI (PREMIUM LOOK) ---
        // Ajustamos la resolución interna del canvas multiplicando por el DPR
        this.canvas.width = cssWidth * this.dpr;
        this.canvas.height = cssHeight * this.dpr;
        
        // Forzamos el tamaño visual con CSS
        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;

        // Normalizamos el contexto para que las coordenadas lógicas sigan siendo CSS pixels
        this.ctx.scale(this.dpr, this.dpr);

        // Guardamos dimensiones lógicas
        this.logicalWidth = cssWidth;
        this.logicalHeight = cssHeight;

        this.pieceWidth = this.logicalWidth / this.gridSize;
        this.pieceHeight = this.logicalHeight / this.gridSize;
        
        // Tamaño de pestaña (20% del lado menor)
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * 0.20;
    }

    generateTopology() {
        // Matriz de formas (1: Tab, -1: Slot, 0: Flat)
        this.shapes = [];
        for (let y = 0; y < this.gridSize; y++) {
            const row = [];
            for (let x = 0; x < this.gridSize; x++) {
                let top = 0, right = 0, bottom = 0, left = 0;
                if (y > 0) top = -this.shapes[y - 1][x].bottom;
                if (y < this.gridSize - 1) bottom = Math.random() > 0.5 ? 1 : -1;
                if (x > 0) left = -row[x - 1].right;
                if (x < this.gridSize - 1) right = Math.random() > 0.5 ? 1 : -1;
                row.push({ top, right, bottom, left });
            }
            this.shapes.push(row);
        }
    }

    createPieces() {
        this.pieces = [];
        const srcW = this.img.width / this.gridSize;
        const srcH = this.img.height / this.gridSize;

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const shape = this.shapes[y][x];
                // Path visual
                const path = this.createPath(this.pieceWidth, this.pieceHeight, shape);

                this.pieces.push({
                    id: `${x}-${y}`,
                    correctX: x * this.pieceWidth,
                    correctY: y * this.pieceHeight,
                    currentX: 0,
                    currentY: 0,
                    isLocked: false,
                    shape: shape,
                    path: path,
                    // Fuente de imagen
                    imgData: { sx: x * srcW, sy: y * srcH, sw: srcW, sh: srcH }
                });
            }
        }
    }
    
    // Optimización: Regenerar solo paths al redimensionar (ahorra memoria)
    createPiecesPathsOnly() {
        for (let p of this.pieces) {
            p.path = this.createPath(this.pieceWidth, this.pieceHeight, p.shape);
            // Recalcular posición correcta en nueva escala
            p.correctX = (p.id.split('-')[0]) * this.pieceWidth;
            p.correctY = (p.id.split('-')[1]) * this.pieceHeight;
            
            // Si estaba locked, forzar posición; si no, mantener relativa (simplificado: reset visual)
            if(p.isLocked) {
                p.currentX = p.correctX;
                p.currentY = p.correctY;
            }
        }
    }

    shufflePieces() {
        this.pieces.forEach(p => {
            p.currentX = Math.random() * (this.logicalWidth - this.pieceWidth);
            p.currentY = Math.random() * (this.logicalHeight - this.pieceHeight);
            p.isLocked = false;
        });
        this.render();
    }

    /* --- GENERADOR DE CURVAS BÉZIER (JIGSAW) --- */

    createPath(w, h, shape) {
        const path = new Path2D();
        const t = this.tabSize; 
        path.moveTo(0, 0);
        if (shape.top !== 0) this.lineToTab(path, 0, 0, w, 0, shape.top * t); else path.lineTo(w, 0);
        if (shape.right !== 0) this.lineToTab(path, w, 0, w, h, shape.right * t); else path.lineTo(w, h);
        if (shape.bottom !== 0) this.lineToTab(path, w, h, 0, h, shape.bottom * t); else path.lineTo(0, h);
        if (shape.left !== 0) this.lineToTab(path, 0, h, 0, 0, shape.left * t); else path.lineTo(0, 0);
        path.closePath();
        return path;
    }

    lineToTab(path, x1, y1, x2, y2, amp) {
        const w = x2 - x1;
        const h = y2 - y1;
        const cx = x1 + w * 0.5;
        const cy = y1 + h * 0.5;
        const perpX = -h / Math.abs(h || 1); 
        const perpY = w / Math.abs(w || 1);
        const xA = x1 + w * 0.35; const yA = y1 + h * 0.35;
        const xB = x1 + w * 0.65; const yB = y1 + h * 0.65;

        path.lineTo(xA, yA);
        path.bezierCurveTo(xA + (perpX * amp * 0.2), yA + (perpY * amp * 0.2), cx - (w * 0.1) + (perpX * amp), cy - (h * 0.1) + (perpY * amp), cx + (perpX * amp), cy + (perpY * amp));
        path.bezierCurveTo(cx + (w * 0.1) + (perpX * amp), cy + (h * 0.1) + (perpY * amp), xB + (perpX * amp * 0.2), yB + (perpY * amp * 0.2), xB, yB);
        path.lineTo(x2, y2);
    }

    /* --- RENDER LOOP --- */

    render() {
        // Limpieza teniendo en cuenta la escala del DPR
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
        
        // Orden de dibujado:
        // 1. Locked (Fondo, sin sombras, se fusionan)
        // 2. Loose (Medio, sombra ligera)
        // 3. Selected (Tope, sombra fuerte)
        
        const locked = [];
        const loose = [];
        let selected = null;

        for(let p of this.pieces) {
            if(p === this.selectedPiece) selected = p;
            else if(p.isLocked) locked.push(p);
            else loose.push(p);
        }

        // Dibujamos Locked primero
        for(let p of locked) this.renderPiece(p, 'locked');
        // Dibujamos Loose
        for(let p of loose) this.renderPiece(p, 'loose');
        // Dibujamos Selected al final
        if(selected) this.renderPiece(selected, 'selected');
    }

    renderPiece(p, type) {
        const ctx = this.ctx;
        
        ctx.save();
        ctx.translate(p.currentX, p.currentY);

        // --- 1. SOMBRAS (Optimización Mobile) ---
        // SOLO aplicamos sombras a las piezas sueltas o seleccionadas.
        // Las piezas 'locked' NO tienen sombra para unirse visualmente.
        if (type !== 'locked') {
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            
            if (type === 'selected') {
                ctx.shadowBlur = 10; // Blur moderado para performance
                ctx.shadowOffsetY = 5;
                // Escala visual al levantar (Feedback)
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.05, 1.05);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            } else {
                ctx.shadowBlur = 3; // Blur muy bajo para piezas sueltas (ahorro GPU)
                ctx.shadowOffsetY = 2;
            }
        } else {
            // Locked: Sin sombra
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
        }

        // --- 2. CLIP & DRAW ---
        // Truco para bordes suaves en algunos navegadores
        // Solo stroke invisible si es necesario para el clip anti-aliasing
        // ctx.stroke(p.path); 
        ctx.clip(p.path);

        const scaleX = p.imgData.sw / this.pieceWidth;
        const scaleY = p.imgData.sh / this.pieceHeight;
        
        // BLEED (Sangrado): Clave para que las piezas encajen sin huecos blancos
        // Tomamos un margen extra de la imagen y la dibujamos desplazada
        const bleed = this.tabSize * 1.5; 

        ctx.drawImage(
            this.img,
            p.imgData.sx - (bleed * scaleX), p.imgData.sy - (bleed * scaleY),
            p.imgData.sw + (bleed * 2 * scaleX), p.imgData.sh + (bleed * 2 * scaleY),
            -bleed, -bleed,
            this.pieceWidth + (bleed * 2), this.pieceHeight + (bleed * 2)
        );

        ctx.restore(); // Salir del clip

        // --- 3. BORDES / STROKE ---
        // AQUÍ ESTÁ LA SOLUCIÓN AL "GRID SUCIO":
        // Si la pieza está LOCKED, NO dibujamos ningún borde.
        // Al tener 'bleed' y superponerse, se verá como una imagen continua.
        
        if (type !== 'locked') {
            ctx.save();
            ctx.translate(p.currentX, p.currentY);
            
            if (type === 'selected') {
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.05, 1.05);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }

            // Bevel (Biselado 3D)
            ctx.strokeStyle = "rgba(255,255,255,0.4)"; 
            ctx.lineWidth = 1.5; 
            ctx.stroke(p.path);
            
            // Contorno fino oscuro
            ctx.strokeStyle = "rgba(0,0,0,0.15)"; 
            ctx.lineWidth = 1; 
            ctx.stroke(p.path);
            
            ctx.restore();
        }
    }

    /* --- INPUT HANDLING (Bounding Box V1 - Fast) --- */
    
    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        // Ajustamos la coordenada del puntero al escalado del DPR si fuera necesario,
        // pero como usamos ctx.scale(), logicalWidth coincide con CSS width, así que directo.
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    handleStart(e) {
        e.preventDefault(); 
        const { x, y } = this.getPointerPos(e);

        // Iterar al revés (z-index visual)
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            const p = this.pieces[i];
            if (p.isLocked) continue;

            // Hitbox generosa para dedos (Bounding Box)
            const margin = this.tabSize * 1.5;

            if (x >= p.currentX - margin && 
                x <= p.currentX + this.pieceWidth + margin &&
                y >= p.currentY - margin && 
                y <= p.currentY + this.pieceHeight + margin) {
                
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
        
        const dist = Math.hypot(
            this.selectedPiece.currentX - this.selectedPiece.correctX,
            this.selectedPiece.currentY - this.selectedPiece.correctY
        );

        // Umbral de Snap (30%)
        if (dist < this.pieceWidth * 0.3) {
            this.selectedPiece.currentX = this.selectedPiece.correctX;
            this.selectedPiece.currentY = this.selectedPiece.correctY;
            this.selectedPiece.isLocked = true;
            this.playSound('snap');
            
            // Al bloquearse, se redibujará sin borde y sin sombra (Flat)
            this.checkVictory();
        }

        this.isDragging = false;
        this.selectedPiece = null;
        requestAnimationFrame(() => this.render());
    }

    checkVictory() {
        const wins = this.pieces.every(p => p.isLocked);
        if (wins) {
            this.playSound('win');
            if(this.callbacks.onWin) setTimeout(this.callbacks.onWin, 300);
            this.destroy();
        }
    }

    playSound(type) {
        const now = Date.now();
        if (now - this.lastSound > 80) {
            if(this.callbacks.onSound) this.callbacks.onSound(type);
            this.lastSound = now;
        }
    }

    addEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleStart);
        window.addEventListener('mousemove', this.handleMove);
        window.addEventListener('mouseup', this.handleEnd);
        this.canvas.addEventListener('touchstart', this.handleStart, { passive: false });
        window.addEventListener('touchmove', this.handleMove, { passive: false });
        window.addEventListener('touchend', this.handleEnd);
        
        // Observer para redimensionado responsivo automático
        if (!this._resizeObserver && typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this.handleResize());
            this._resizeObserver.observe(this.canvas.parentElement);
        }
    }

    destroy() {
        this.canvas.removeEventListener('mousedown', this.handleStart);
        window.removeEventListener('mousemove', this.handleMove);
        window.removeEventListener('mouseup', this.handleEnd);
        this.canvas.removeEventListener('touchstart', this.handleStart);
        window.removeEventListener('touchmove', this.handleMove);
        window.removeEventListener('touchend', this.handleEnd);
        if (this._resizeObserver) this._resizeObserver.disconnect();
    }
}
