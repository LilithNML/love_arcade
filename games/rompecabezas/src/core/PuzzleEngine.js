/**
 * PuzzleEngine.js vFinal - Classic Jigsaw Fix
 * Soluciona el problema de recorte de imagen (Bleeding) y formas estándar.
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
        
        // Throttle para sonido
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
        // Recalcular métricas sin perder progreso
        // (En una versión prod, aquí actualizaríamos currentX/Y proporcionalmente)
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

        // Dejar espacio para las piezas sueltas (85%)
        finalWidth *= 0.85;
        finalHeight *= 0.85;

        this.canvas.width = finalWidth;
        this.canvas.height = finalHeight;

        this.pieceWidth = finalWidth / this.gridSize;
        this.pieceHeight = finalHeight / this.gridSize;
        
        // El tamaño de la pestaña es el 20% del lado más corto
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * 0.20;
    }

    /**
     * Define qué pieza tiene pestaña y cual hueco.
     * 1 = Tab (Saliente), -1 = Slot (Entrante), 0 = Borde
     */
    generateTopology() {
        this.shapes = [];
        for (let y = 0; y < this.gridSize; y++) {
            const row = [];
            for (let x = 0; x < this.gridSize; x++) {
                let top = 0, right = 0, bottom = 0, left = 0;

                // Coherencia con vecinos
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
        
        // Calcular dimensiones de la celda en la IMAGEN ORIGINAL
        const srcW = this.img.width / this.gridSize;
        const srcH = this.img.height / this.gridSize;

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const shape = this.shapes[y][x];
                
                // Generar el Path vectorizado de la forma
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
                    // Datos de recorte de la imagen original
                    imgData: {
                        sx: x * srcW,
                        sy: y * srcH,
                        sw: srcW,
                        sh: srcH
                    }
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

    /* --- DIBUJO DE FORMAS (Bézier Clásico) --- */

    createPath(w, h, shape) {
        const path = new Path2D();
        const t = this.tabSize; 

        path.moveTo(0, 0);

        // TOP
        if (shape.top !== 0) this.lineToTab(path, 0, 0, w, 0, shape.top * t);
        else path.lineTo(w, 0);

        // RIGHT
        if (shape.right !== 0) this.lineToTab(path, w, 0, w, h, shape.right * t);
        else path.lineTo(w, h);

        // BOTTOM
        if (shape.bottom !== 0) this.lineToTab(path, w, h, 0, h, shape.bottom * t);
        else path.lineTo(0, h);

        // LEFT
        if (shape.left !== 0) this.lineToTab(path, 0, h, 0, 0, shape.left * t);
        else path.lineTo(0, 0);

        path.closePath();
        return path;
    }

    /**
     * Dibuja una curva de rompecabezas estándar entre (x1,y1) y (x2,y2).
     * amp = amplitud de la pestaña (positiva o negativa)
     */
    lineToTab(path, x1, y1, x2, y2, amp) {
        const w = x2 - x1;
        const h = y2 - y1;
        
        // Puntos base a lo largo del segmento
        // Cuello de la pestaña ocupa el 30% central
        const cx = x1 + w * 0.5;
        const cy = y1 + h * 0.5;
        
        // Vectores para "salir" perpendicularmente del lado
        // Si vamos horizontal (h=0), la perpendicular es en Y
        // Si vamos vertical (w=0), la perpendicular es en X
        const perpX = -h / Math.abs(h || 1); 
        const perpY = w / Math.abs(w || 1);

        // Geometría clásica Jigsaw
        // Hombros
        const xA = x1 + w * 0.35;
        const yA = y1 + h * 0.35;
        const xB = x1 + w * 0.65;
        const yB = y1 + h * 0.65;

        // Puntos de control para la curva Bézier
        // Base del cuello
        path.lineTo(xA, yA);

        path.bezierCurveTo(
            xA + (perpX * amp * 0.2), yA + (perpY * amp * 0.2), // CP1
            cx - (w * 0.1) + (perpX * amp), cy - (h * 0.1) + (perpY * amp), // CP2
            cx + (perpX * amp), cy + (perpY * amp) // Punta
        );
        
        path.bezierCurveTo(
            cx + (w * 0.1) + (perpX * amp), cy + (h * 0.1) + (perpY * amp), // CP1
            xB + (perpX * amp * 0.2), yB + (perpY * amp * 0.2), // CP2
            xB, yB // Base derecha
        );

        path.lineTo(x2, y2);
    }

    /* --- RENDER LOOP (FIX CRÍTICO AQUÍ) --- */

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Ordenar piezas: Locked al fondo, Selected al tope
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

        // 1. Sombra (solo si está suelta)
        if (!p.isLocked) {
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            ctx.shadowBlur = isSelected ? 15 : 4;
            ctx.shadowOffsetY = isSelected ? 5 : 2;
            if(isSelected) {
                // Escala visual al levantar
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.05, 1.05);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }
        }

        // 2. Definir Máscara de Recorte
        ctx.stroke(p.path); // Fix antialiasing en bordes clip
        ctx.clip(p.path);

        /* --- FIX CRÍTICO DE IMAGEN CORTADA --- 
           Calculamos un margen extra (bleed) proporcional al tamaño de la pestaña.
           Tomamos más imagen de la fuente para rellenar la pestaña.
        */
        
        // Escala entre la imagen original HD y el canvas
        const scaleX = p.imgData.sw / this.pieceWidth;
        const scaleY = p.imgData.sh / this.pieceHeight;
        
        // Margen de seguridad: Tamaño de la pestaña + un poco más
        const bleed = this.tabSize * 1.5; 

        // Dibujamos la imagen DESPLAZADA hacia atrás (-bleed)
        // y con tamaño AUMENTADO (+bleed*2)
        ctx.drawImage(
            this.img,
            // Source (Imagen original): Restamos margen escalado
            p.imgData.sx - (bleed * scaleX),
            p.imgData.sy - (bleed * scaleY),
            p.imgData.sw + (bleed * 2 * scaleX),
            p.imgData.sh + (bleed * 2 * scaleY),
            // Destination (Canvas local 0,0): Restamos margen local
            -bleed, 
            -bleed,
            this.pieceWidth + (bleed * 2),
            this.pieceHeight + (bleed * 2)
        );

        // 3. Efectos de Borde (Solo piezas sueltas)
        // Si está locked, no dibujamos borde para que se funda la imagen
        ctx.restore(); // Salimos del CLIP

        if (!p.isLocked) {
            ctx.save();
            ctx.translate(p.currentX, p.currentY);
            if(isSelected) {
                // Escala debe coincidir
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.05, 1.05);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }

            // Brillo Biselado
            ctx.strokeStyle = "rgba(255,255,255,0.5)";
            ctx.lineWidth = 1.5;
            ctx.stroke(p.path);
            
            // Contorno sutil
            ctx.strokeStyle = "rgba(0,0,0,0.2)";
            ctx.lineWidth = 1;
            ctx.stroke(p.path);
            
            ctx.restore();
        }
    }

    /* --- INPUT & LOGICA --- */

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

        // Hit detection preciso usando isPointInPath
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            const p = this.pieces[i];
            if (p.isLocked) continue;

            this.ctx.save();
            this.ctx.translate(p.currentX, p.currentY);
            const hit = this.ctx.isPointInPath(p.path, x - p.currentX, y - p.currentY);
            this.ctx.restore();

            if (hit) {
                this.selectedPiece = p;
                this.isDragging = true;
                this.dragOffsetX = x - p.currentX;
                this.dragOffsetY = y - p.currentY;
                
                // Mover al final (top z-index)
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
        
        // SNAP Logic
        const dist = Math.hypot(
            this.selectedPiece.currentX - this.selectedPiece.correctX,
            this.selectedPiece.currentY - this.selectedPiece.correctY
        );

        // Umbral de 25% del tamaño de pieza
        if (dist < this.pieceWidth * 0.25) {
            // SNAP DURO
            this.selectedPiece.currentX = this.selectedPiece.correctX;
            this.selectedPiece.currentY = this.selectedPiece.correctY;
            this.selectedPiece.isLocked = true;
            this.playSound('snap');
            
            // Check Victory INMEDIATO
            if (this.checkVictory()) {
                this.isDragging = false;
                this.selectedPiece = null;
                this.render();
                return;
            }
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
        return wins;
    }

    playSound(type) {
        const now = Date.now();
        if (now - this.lastSound > 100) {
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
    }

    destroy() {
        // Limpiar todo al ganar/salir
        const c = this.canvas; // alias
        c.removeEventListener('mousedown', this.handleStart);
        window.removeEventListener('mousemove', this.handleMove);
        window.removeEventListener('mouseup', this.handleEnd);
        c.removeEventListener('touchstart', this.handleStart);
        window.removeEventListener('touchmove', this.handleMove);
        window.removeEventListener('touchend', this.handleEnd);
    }
}
