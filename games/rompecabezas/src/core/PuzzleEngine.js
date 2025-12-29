/**
 * PuzzleEngine.js v4.0 - Hybrid Edition
 * VISUALES: Jigsaw Pro (V3)
 * INPUT: Grid System (V1 - Ultra Fast & Reliable)
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');
        
        // Configuración
        this.img = config.image;
        this.gridSize = Math.sqrt(config.pieces); 
        this.callbacks = callbacks || {};
        
        // Estado
        this.pieces = [];
        this.selectedPiece = null;
        this.isDragging = false;
        
        // Variables para el movimiento (Lógica V1)
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        
        // Throttle de sonido
        this.lastSound = 0;
        
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
        requestAnimationFrame(() => this.render());
    }

    handleResize() {
        this.resizeCanvas();
        this.render();
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

        // Espacio de trabajo (85% para dejar margen a piezas sueltas)
        finalWidth *= 0.85;
        finalHeight *= 0.85;

        this.canvas.width = finalWidth;
        this.canvas.height = finalHeight;

        this.pieceWidth = finalWidth / this.gridSize;
        this.pieceHeight = finalHeight / this.gridSize;
        
        // Tamaño de pestaña (20%)
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * 0.20;
    }

    generateTopology() {
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
                // Generamos el Path visual
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
                    imgData: { sx: x * srcW, sy: y * srcH, sw: srcW, sh: srcH }
                });
            }
        }
    }

    shufflePieces() {
        this.pieces.forEach(p => {
            p.currentX = Math.random() * (this.canvas.width - this.pieceWidth);
            p.currentY = Math.random() * (this.canvas.height - this.pieceHeight);
            p.isLocked = false;
        });
        this.render();
    }

    /* --- LÓGICA DE DIBUJO (VISUALES V3) --- */

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

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render Order: Locked -> Loose -> Selected
        const renderList = [
            ...this.pieces.filter(p => p.isLocked),
            ...this.pieces.filter(p => !p.isLocked && p !== this.selectedPiece)
        ];
        if (this.selectedPiece) renderList.push(this.selectedPiece);

        renderList.forEach(p => this.renderPiece(p));
    }

    renderPiece(p) {
        const ctx = this.ctx;
        const isSelected = p === this.selectedPiece;
        
        ctx.save();
        ctx.translate(p.currentX, p.currentY);

        // Sombra
        if (!p.isLocked) {
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            ctx.shadowBlur = isSelected ? 15 : 4;
            ctx.shadowOffsetY = isSelected ? 5 : 2;
            if(isSelected) {
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.05, 1.05);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }
        }

        // Clip & Draw
        ctx.stroke(p.path); 
        ctx.clip(p.path);

        const scaleX = p.imgData.sw / this.pieceWidth;
        const scaleY = p.imgData.sh / this.pieceHeight;
        const bleed = this.tabSize * 1.5; 

        ctx.drawImage(
            this.img,
            p.imgData.sx - (bleed * scaleX), p.imgData.sy - (bleed * scaleY),
            p.imgData.sw + (bleed * 2 * scaleX), p.imgData.sh + (bleed * 2 * scaleY),
            -bleed, -bleed,
            this.pieceWidth + (bleed * 2), this.pieceHeight + (bleed * 2)
        );

        ctx.restore(); // Exit clip

        // Borders
        if (!p.isLocked) {
            ctx.save();
            ctx.translate(p.currentX, p.currentY);
            if(isSelected) {
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.05, 1.05);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }
            ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5; ctx.stroke(p.path);
            ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 1; ctx.stroke(p.path);
            ctx.restore();
        }
    }

    /* --- INPUT HANDLING: REGRESO A LÓGICA V1 (RÁPIDA) --- */
    
    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Soporte unificado Mouse/Touch
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    handleStart(e) {
        // Prevenimos scroll y otros gestos
        e.preventDefault(); 
        const { x, y } = this.getPointerPos(e);

        // ITERAMOS AL REVÉS (De arriba a abajo)
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            const p = this.pieces[i];
            if (p.isLocked) continue;

            // --- LÓGICA V1: CAJA SIMPLE (BOUNDING BOX) ---
            // Mucho más rápido que isPointInPath.
            // Añadimos un margen generoso (tabSize) para agarrar las pestañas fácilmente.
            const margin = this.tabSize * 1.5;

            if (x >= p.currentX - margin && 
                x <= p.currentX + this.pieceWidth + margin &&
                y >= p.currentY - margin && 
                y <= p.currentY + this.pieceHeight + margin) {
                
                // ¡PIEZA ENCONTRADA!
                this.selectedPiece = p;
                this.isDragging = true;
                
                // Calculamos el offset para que la pieza no "salte" al centro del dedo
                this.dragOffsetX = x - p.currentX;
                this.dragOffsetY = y - p.currentY;
                
                // Traer al frente en el array
                this.pieces.splice(i, 1);
                this.pieces.push(p);
                
                this.playSound('click');
                requestAnimationFrame(() => this.render());
                return; // Salimos del loop inmediatamente
            }
        }
    }

    handleMove(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        e.preventDefault();
        
        const { x, y } = this.getPointerPos(e);
        
        // Movimiento directo 1:1 (Lógica V1)
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

        // Umbral de 30% del tamaño
        if (dist < this.pieceWidth * 0.3) {
            this.selectedPiece.currentX = this.selectedPiece.correctX;
            this.selectedPiece.currentY = this.selectedPiece.correctY;
            this.selectedPiece.isLocked = true;
            this.playSound('snap');
            this.checkVictory();
        }

        // Reset de estado garantizado
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
        // Mouse
        this.canvas.addEventListener('mousedown', this.handleStart);
        window.addEventListener('mousemove', this.handleMove);
        window.addEventListener('mouseup', this.handleEnd);
        
        // Touch (Passive: false es CRÍTICO para evitar scroll)
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
