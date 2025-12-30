/**
 * PuzzleEngine.js v8.0 - Anchor Point & Side Scatter
 * * MEJORAS CRÍTICAS:
 * 1. RENDERIZADO POR ANCLAJE: Se alinea el punto (0,0) del Path con el punto exacto de la imagen fuente.
 * Ya no importa cuánto se deforme la pieza o el sangrado, la imagen siempre coincidirá.
 * 2. ORGANIZACIÓN LATERAL: Las piezas aparecen ordenadas en columnas a los lados (Left/Right columns).
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimización
        
        this.img = config.image;
        this.gridSize = Math.sqrt(config.pieces);
        this.callbacks = callbacks || {};
        
        // Estado
        this.pieces = [];
        this.particles = []; 
        this.selectedPiece = null;
        this.isDragging = false;
        this.showPreview = false;
        
        // Input Vars
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        
        // Configuración visual
        this.jitterMap = []; 
        this.lastSound = 0;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        
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

    /* --- SETUP & RESIZE --- */
    handleResize() {
        this.resizeCanvas();
        this.createPiecesPathsOnly(); 
        // Si se redimensiona, reordenar las piezas sueltas para que no queden fuera
        this.shufflePieces(true); // true = solo reposicionar, no reiniciar juego
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

        // MARGEN DE TRABAJO: 70% del tamaño para dejar espacio a las columnas laterales
        const workAreaScale = 0.70; 
        cssWidth *= workAreaScale;
        cssHeight *= workAreaScale;

        // Configuración de resolución
        this.canvas.width = parent.clientWidth * this.dpr; // Canvas ocupa todo el contenedor padre
        this.canvas.height = parent.clientHeight * this.dpr;
        
        // Estilo CSS para que ocupe todo
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";

        this.ctx.scale(this.dpr, this.dpr);

        // Definir el "Tablero de Juego" centrado en el canvas
        this.boardWidth = cssWidth;
        this.boardHeight = cssHeight;
        this.boardX = (parent.clientWidth - cssWidth) / 2;
        this.boardY = (parent.clientHeight - cssHeight) / 2;

        // Tamaño de pieza
        this.pieceWidth = this.boardWidth / this.gridSize;
        this.pieceHeight = this.boardHeight / this.gridSize;
        
        // Tamaño pestaña
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * 0.25;
    }

    generateTopology() {
        this.shapes = [];
        this.jitterMap = [];
        for (let y = 0; y < this.gridSize; y++) {
            const row = [];
            const jitterRow = [];
            for (let x = 0; x < this.gridSize; x++) {
                let top = 0, right = 0, bottom = 0, left = 0;
                if (y > 0) top = -this.shapes[y - 1][x].bottom;
                if (y < this.gridSize - 1) bottom = Math.random() > 0.5 ? 1 : -1;
                if (x > 0) left = -row[x - 1].right;
                if (x < this.gridSize - 1) right = Math.random() > 0.5 ? 1 : -1;
                
                row.push({ top, right, bottom, left });
                // Jitter moderado para evitar distorsiones extremas
                jitterRow.push({
                    top: (Math.random() - 0.5) * 0.15,
                    right: (Math.random() - 0.5) * 0.15,
                    bottom: (Math.random() - 0.5) * 0.15,
                    left: (Math.random() - 0.5) * 0.15
                });
            }
            this.shapes.push(row);
            this.jitterMap.push(jitterRow);
        }
    }

    createPieces() {
        this.pieces = [];
        // Calculamos la fuente basándonos en la imagen original
        const srcPieceW = this.img.width / this.gridSize;
        const srcPieceH = this.img.height / this.gridSize;

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const shape = this.shapes[y][x];
                const jitter = this.jitterMap[y][x];
                const path = this.createPath(this.pieceWidth, this.pieceHeight, shape, jitter);

                this.pieces.push({
                    id: `${x}-${y}`,
                    gridX: x, gridY: y, // Guardamos índices para cálculos matemáticos
                    
                    // Posición "Correcta" absoluta en el canvas (Board Offset + Grid Pos)
                    correctX: this.boardX + (x * this.pieceWidth),
                    correctY: this.boardY + (y * this.pieceHeight),
                    
                    currentX: 0, currentY: 0,
                    isLocked: false,
                    shape, jitter, path,
                    
                    // Datos de origen exactos
                    srcOriginX: x * srcPieceW,
                    srcOriginY: y * srcPieceH,
                    srcPieceW: srcPieceW,
                    srcPieceH: srcPieceH
                });
            }
        }
    }

    createPiecesPathsOnly() {
        for (let p of this.pieces) {
            p.path = this.createPath(this.pieceWidth, this.pieceHeight, p.shape, p.jitter);
            // Recalcular posición correcta basada en el nuevo board
            p.correctX = this.boardX + (p.gridX * this.pieceWidth);
            p.correctY = this.boardY + (p.gridY * this.pieceHeight);
            
            if(p.isLocked) {
                p.currentX = p.correctX;
                p.currentY = p.correctY;
            }
        }
    }

    /* --- FIX #2: ORGANIZACIÓN EN COLUMNAS (SIDE SCATTER) --- */
    shufflePieces(repositionOnly = false) {
        const loosePieces = this.pieces.filter(p => !p.isLocked);
        
        // Áreas laterales disponibles
        const leftAreaX = 10;
        const rightAreaX = this.canvas.parentElement.clientWidth - this.pieceWidth - 10;
        const startY = 80; // Dejar espacio para el header
        
        // ¿Caben todas en una columna?
        let yCursorLeft = startY;
        let yCursorRight = startY;
        const stepY = this.pieceHeight * 0.6; // Solapamiento vertical para que quepan más

        loosePieces.forEach((p, index) => {
            if (repositionOnly && p.isLocked) return;

            p.isLocked = false; // Resetear estado si es shuffle inicial

            // Alternar Izquierda / Derecha
            if (index % 2 === 0) {
                // Izquierda
                p.currentX = Math.random() * (this.boardX - this.pieceWidth); // Random en zona izq
                if (p.currentX < 0) p.currentX = 10;
                
                // Si preferimos columnas estrictas:
                // p.currentX = 10 + (Math.random() * 20); 
                
                p.currentY = yCursorLeft;
                yCursorLeft += stepY;
                
                // Si llegamos abajo, volver arriba con offset X
                if (yCursorLeft > this.canvas.parentElement.clientHeight - this.pieceHeight) {
                    yCursorLeft = startY;
                }
            } else {
                // Derecha
                p.currentX = (this.boardX + this.boardWidth) + Math.random() * (this.boardX - this.pieceWidth);
                // Clamp
                if (p.currentX > this.canvas.parentElement.clientWidth - this.pieceWidth) {
                    p.currentX = this.canvas.parentElement.clientWidth - this.pieceWidth - 10;
                }

                p.currentY = yCursorRight;
                yCursorRight += stepY;

                if (yCursorRight > this.canvas.parentElement.clientHeight - this.pieceHeight) {
                    yCursorRight = startY;
                }
            }
        });

        this.render();
    }

    /* --- RENDERIZADO AVANZADO (FIX #1: ANCHOR POINT) --- */
    render() {
        // Limpiar todo el canvas lógico
        const logicalW = this.canvas.parentElement.clientWidth;
        const logicalH = this.canvas.parentElement.clientHeight;
        this.ctx.clearRect(0, 0, logicalW, logicalH);

        // 1. Dibujar el "Hueco" del tablero (Guía visual)
        this.ctx.strokeStyle = "rgba(255,255,255,0.1)";
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.boardX, this.boardY, this.boardWidth, this.boardHeight);

        // 2. Vista Previa
        if (this.showPreview) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.2;
            this.ctx.drawImage(this.img, this.boardX, this.boardY, this.boardWidth, this.boardHeight);
            this.ctx.restore();
        }

        const locked = [], loose = [];
        let selected = null;
        this.pieces.forEach(p => {
            if(p === this.selectedPiece) selected = p;
            else if(p.isLocked) locked.push(p);
            else loose.push(p);
        });

        locked.forEach(p => this.renderPiece(p, 'locked'));
        loose.forEach(p => this.renderPiece(p, 'loose'));
        if(selected) this.renderPiece(selected, 'selected');

        this.updateParticles();
        if (this.particles.length > 0 || this.isDragging) {
            requestAnimationFrame(() => this.render());
        }
    }

    renderPiece(p, type) {
        const ctx = this.ctx;
        ctx.save();
        
        // Mover el contexto a la posición de la pieza (0,0 ahora es la esquina superior izquierda de la pieza)
        ctx.translate(p.currentX, p.currentY);

        // Sombras (Solo sueltas)
        if (type !== 'locked') {
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.shadowBlur = type === 'selected' ? 15 : 5;
            ctx.shadowOffsetY = type === 'selected' ? 8 : 2;
            if (type === 'selected') {
                // Escalar desde el centro
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.1, 1.1);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }
        } else {
            ctx.shadowColor = "transparent";
        }

        // --- MÁSCARA ---
        // Dibujamos el path (que incluye pestañas salientes)
        // El path es relativo a 0,0
        ctx.clip(p.path);

        // --- DIBUJADO DE IMAGEN POR ANCLAJE (SOLUCIÓN DEFINITIVA) ---
        // En lugar de calcular recortes, calculamos la relación de escala global
        const scaleX = this.boardWidth / this.img.width; // Cuánto se encoge la imagen para caber en el tablero
        
        // Invertimos la lógica: 
        // Queremos dibujar la imagen ENTERA (o un trozo enorme), pero desplazada de tal forma
        // que el punto (srcOriginX, srcOriginY) de la imagen caiga exactamente en (0,0) del contexto.
        
        // 1. Calculamos dónde empieza la imagen relativa a esta pieza si la pieza estuviera en (0,0)
        //    Es negativo porque movemos la imagen hacia "atrás"
        const drawImgX = - (p.srcOriginX * scaleX);
        const drawImgY = - (p.srcOriginY * scaleY);
        
        // 2. Calculamos el tamaño al que debe dibujarse la imagen completa
        const drawImgW = this.img.width * scaleX;
        const drawImgH = this.img.height * scaleY; // Debería ser igual scaleX si mantenemos ratio

        // 3. Dibujamos la imagen completa (el clip se encarga de mostrar solo lo necesario)
        //    Esto elimina CUALQUIER problema de sangrado, porque la imagen es continua.
        //    Para optimizar rendimiento, podemos recortar un trozo más pequeño pero seguro.
        
        // OPTIMIZACIÓN: Dibujar solo un trozo "seguro" alrededor de la pieza (2x tamaño)
        const margin = Math.max(this.pieceWidth, this.pieceHeight); // Margen de 1 pieza completa
        
        // Coordenadas en la imagen fuente
        const srcRectX = p.srcOriginX - (margin / scaleX);
        const srcRectY = p.srcOriginY - (margin / scaleX); // Asumiendo ratio cuadrado por simplicidad de margen
        const srcRectW = p.srcPieceW + (margin * 2 / scaleX);
        const srcRectH = p.srcPieceH + (margin * 2 / scaleX);

        // Coordenadas en el canvas destino (relativo a 0,0 de la pieza)
        const dstX = -margin;
        const dstY = -margin;
        const dstW = this.pieceWidth + (margin * 2);
        const dstH = this.pieceHeight + (margin * 2);

        ctx.drawImage(this.img, srcRectX, srcRectY, srcRectW, srcRectH, dstX, dstY, dstW, dstH);

        ctx.restore(); // Quitar Clip

        // Bordes (Solo sueltas)
        if (type !== 'locked') {
            ctx.save();
            ctx.translate(p.currentX, p.currentY);
            if (type === 'selected') {
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.1, 1.1);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }
            // Borde interno sutil
            ctx.strokeStyle = "rgba(255,255,255,0.3)"; 
            ctx.lineWidth = 1; 
            ctx.stroke(p.path);
            
            // Borde externo oscuro
            ctx.strokeStyle = "rgba(0,0,0,0.2)"; 
            ctx.lineWidth = 1; 
            ctx.stroke(p.path);
            ctx.restore();
        }
    }

    /* --- CURVAS BÉZIER --- */
    createPath(w, h, shape, jitter) {
        const path = new Path2D();
        const t = this.tabSize; 
        path.moveTo(0, 0);
        shape.top !== 0 ? this.lineToTab(path, 0, 0, w, 0, shape.top * t, jitter.top * t) : path.lineTo(w, 0);
        shape.right !== 0 ? this.lineToTab(path, w, 0, w, h, shape.right * t, jitter.right * t) : path.lineTo(w, h);
        shape.bottom !== 0 ? this.lineToTab(path, w, h, 0, h, shape.bottom * t, jitter.bottom * t) : path.lineTo(0, h);
        shape.left !== 0 ? this.lineToTab(path, 0, h, 0, 0, shape.left * t, jitter.left * t) : path.lineTo(0, 0);
        path.closePath();
        return path;
    }

    lineToTab(path, x1, y1, x2, y2, amp, shift) {
        const w = x2 - x1; const h = y2 - y1;
        const cx = x1 + w * 0.5 + (w===0 ? shift : 0);
        const cy = y1 + h * 0.5 + (h===0 ? shift : 0);
        const perpX = -h / Math.abs(h || 1); const perpY = w / Math.abs(w || 1);
        const xA = x1 + w * 0.35; const yA = y1 + h * 0.35;
        const xB = x1 + w * 0.65; const yB = y1 + h * 0.65;

        path.lineTo(xA, yA);
        path.bezierCurveTo(xA + (perpX * amp * 0.2), yA + (perpY * amp * 0.2), cx - (w * 0.1) + (perpX * amp), cy - (h * 0.1) + (perpY * amp), cx + (perpX * amp), cy + (perpY * amp));
        path.bezierCurveTo(cx + (w * 0.1) + (perpX * amp), cy + (h * 0.1) + (perpY * amp), xB + (perpX * amp * 0.2), yB + (perpY * amp * 0.2), xB, yB);
        path.lineTo(x2, y2);
    }

    /* --- INPUT HANDLING --- */
    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    handleStart(e) {
        e.preventDefault(); 
        const { x, y } = this.getPointerPos(e);
        
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            const p = this.pieces[i]; 
            if (p.isLocked) continue;
            
            const m = this.tabSize * 2.0; 
            if (x >= p.currentX - m && x <= p.currentX + this.pieceWidth + m && 
                y >= p.currentY - m && y <= p.currentY + this.pieceHeight + m) {
                
                this.selectedPiece = p; 
                this.isDragging = true;
                this.dragOffsetX = x - p.currentX; 
                this.dragOffsetY = y - p.currentY;
                
                this.pieces.splice(i, 1); 
                this.pieces.push(p);
                
                if(this.callbacks.onSound) this.callbacks.onSound('click');
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
        
        // SNAP Tolerance (30% de la pieza)
        if (dist < this.pieceWidth * 0.3) {
            this.selectedPiece.currentX = this.selectedPiece.correctX;
            this.selectedPiece.currentY = this.selectedPiece.correctY;
            this.selectedPiece.isLocked = true;
            this.spawnParticles(this.selectedPiece.currentX + this.pieceWidth/2, this.selectedPiece.currentY + this.pieceHeight/2, 'spark');
            
            if(this.callbacks.onSound) this.callbacks.onSound('snap');
            if(this.callbacks.onStateChange) this.callbacks.onStateChange();
            
            this.checkVictory();
        } else {
            if(this.callbacks.onStateChange) this.callbacks.onStateChange();
        }

        this.isDragging = false;
        this.selectedPiece = null;
        requestAnimationFrame(() => this.render());
    }

    checkVictory() {
        if (this.pieces.every(p => p.isLocked)) {
            this.spawnParticles(this.canvas.width/2, this.canvas.height/2, 'confetti');
            if(this.callbacks.onSound) this.callbacks.onSound('win');
            if(this.callbacks.onWin) setTimeout(this.callbacks.onWin, 1500);
            
            this.canvas.removeEventListener('mousedown', this.handleStart);
            this.canvas.removeEventListener('touchstart', this.handleStart);
        }
    }

    /* --- MISC & PARTICLES --- */
    spawnParticles(x, y, type) { /* ... lógica de partículas igual ... */ 
        const count = type === 'confetti' ? 60 : 15;
        const colors = ['#f43f5e', '#3b82f6', '#10b981', '#fbbf24', '#fff'];
        for(let i=0; i<count; i++) {
            this.particles.push({
                x: x, y: y,
                vx: (Math.random()-0.5)*(type==='confetti'?12:6),
                vy: (Math.random()-0.5)*(type==='confetti'?12:6),
                life: 1.0, color: colors[Math.floor(Math.random()*colors.length)], size: Math.random()*5+2
            });
        }
        this.render();
    }
    updateParticles() {
        if(this.particles.length===0) return;
        for(let i=this.particles.length-1; i>=0; i--) {
            let p=this.particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.3; p.life-=0.03;
            if(p.life<=0) this.particles.splice(i,1);
            else { this.ctx.globalAlpha=p.life; this.ctx.fillStyle=p.color; this.ctx.fillRect(p.x,p.y,p.size,p.size); }
        }
        this.ctx.globalAlpha=1;
    }

    exportState() { return this.pieces.map(p => ({ id: p.id, cx: p.currentX, cy: p.currentY, locked: p.isLocked })); }
    importState(s) { if(!s) return; s.forEach(sp => { const p = this.pieces.find(x=>x.id===sp.id); if(p){ p.currentX=sp.cx; p.currentY=sp.cy; p.isLocked=sp.locked; } }); this.render(); }
    togglePreview(a) { this.showPreview = a; this.render(); }
    
    autoPlacePiece() {
        const loose = this.pieces.filter(p => !p.isLocked);
        if(loose.length === 0) return false;
        const p = loose[Math.floor(Math.random()*loose.length)];
        // Animación simple: teletransportar
        this.spawnParticles(p.correctX+this.pieceWidth/2, p.correctY+this.pieceHeight/2, 'gold');
        p.currentX = p.correctX; p.currentY = p.correctY; p.isLocked = true;
        if(this.callbacks.onSound) this.callbacks.onSound('snap');
        this.checkVictory(); this.render();
        return true;
    }

    addEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleStart);
        window.addEventListener('mousemove', this.handleMove);
        window.addEventListener('mouseup', this.handleEnd);
        this.canvas.addEventListener('touchstart', this.handleStart, { passive: false });
        window.addEventListener('touchmove', this.handleMove, { passive: false });
        window.addEventListener('touchend', this.handleEnd);
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
