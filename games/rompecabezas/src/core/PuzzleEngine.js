/**
 * PuzzleEngine.js v10.0 - Performance & Visual Mastery
 * * MEJORAS DE RENDIMIENTO:
 * - Double Buffering: Usa un canvas en memoria (staticCanvas) para las piezas bloqueadas.
 * - Render Loop Inteligente: Solo dibuja lo que se mueve.
 * * MEJORAS VISUALES:
 * - Seam Healing: Micro-traslape en piezas bloqueadas para eliminar líneas de unión.
 * - Imagen Lisa: El resultado final se ve como una sola foto, no como un rompecabezas.
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        // alpha: false mejora rendimiento al decirle al navegador que no hay transparencia detrás del canvas
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        this.img = config.image;
        this.gridSize = Math.sqrt(config.pieces);
        this.callbacks = callbacks || {};
        
        // --- DOBLE BUFFERING (CLAVE PARA RENDIMIENTO) ---
        // Este canvas nunca se muestra en el DOM, vive en la memoria RAM
        this.staticCanvas = document.createElement('canvas');
        this.staticCtx = this.staticCanvas.getContext('2d', { alpha: true }); // Alpha true para capas
        this.needsStaticUpdate = true; // Bandera para redibujar el fondo solo cuando sea necesario

        // Estado
        this.pieces = [];
        this.particles = []; 
        this.selectedPiece = null;
        this.isDragging = false;
        this.showPreview = false;
        
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        
        this.verticalEdges = []; 
        this.horizontalEdges = []; 
        
        this.lastSound = 0;
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        
        // Loop Control (Para detener render si no hay actividad)
        this.isActive = true; 

        // Binds
        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        this.init();
    }

    init() {
        this.resizeCanvas();
        this.generateSharedTopology();
        this.createPieces(); 
        this.shufflePieces(); 
        this.addEventListeners();
        this.animate(); // Iniciar loop optimizado
    }

    /* --- RENDIMIENTO: GAME LOOP OPTIMIZADO --- */
    animate() {
        if (!this.isActive) return;

        // Solo renderizar si:
        // 1. Estamos arrastrando una pieza
        // 2. Hay partículas vivas (animación)
        // 3. Se solicitó una actualización forzada (resize, preview, init)
        if (this.isDragging || this.particles.length > 0 || this.needsStaticUpdate || this.showPreview) {
            this.render();
        }

        requestAnimationFrame(() => this.animate());
    }

    /* --- SETUP & RESIZE --- */
    handleResize() {
        this.resizeCanvas();
        this.createPiecesPathsOnly(); 
        this.shufflePieces(true);
        this.needsStaticUpdate = true; // Forzar redibujado del fondo
        this.render(); // Render inmediato
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

        const workAreaScale = 0.65; 
        cssWidth *= workAreaScale;
        cssHeight *= workAreaScale;

        // Configurar Main Canvas
        this.canvas.width = parent.clientWidth * this.dpr;
        this.canvas.height = parent.clientHeight * this.dpr;
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.ctx.scale(this.dpr, this.dpr);

        // Configurar Static Canvas (Mismo tamaño lógico)
        // No necesita estilo CSS ni scale dpr porque lo usamos como imagen fuente
        this.staticCanvas.width = this.canvas.width; 
        this.staticCanvas.height = this.canvas.height;
        this.staticCtx.scale(this.dpr, this.dpr);

        // Métricas
        this.boardWidth = cssWidth;
        this.boardHeight = cssHeight;
        this.boardX = Math.round((parent.clientWidth - cssWidth) / 2);
        this.boardY = Math.round((parent.clientHeight - cssHeight) / 2);

        this.pieceWidth = this.boardWidth / this.gridSize;
        this.pieceHeight = this.boardHeight / this.gridSize;
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * 0.25;
        
        this.logicalWidth = parent.clientWidth;
        this.logicalHeight = parent.clientHeight;
    }

    /* --- RENDERIZADO PRINCIPAL --- */
    render() {
        // 1. Actualizar Buffer Estático (Si hubo cambios)
        if (this.needsStaticUpdate) {
            this.updateStaticLayer();
            this.needsStaticUpdate = false;
        }

        // 2. Limpiar Canvas Visible
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        // 3. Dibujar Buffer Estático (Fondo + Piezas Bloqueadas)
        // Esto pinta TODAS las piezas armadas en una sola operación ultrarrápida
        this.ctx.drawImage(
            this.staticCanvas, 
            0, 0, this.logicalWidth, this.logicalHeight
        );

        // 4. Vista Previa (Fantasma)
        if (this.showPreview) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            this.ctx.drawImage(this.img, this.boardX, this.boardY, this.boardWidth, this.boardHeight);
            this.ctx.restore();
        }

        // 5. Dibujar Piezas Sueltas (Dinámicas)
        // Filtramos para dibujar solo las que NO están bloqueadas
        const loosePieces = this.pieces.filter(p => !p.isLocked && p !== this.selectedPiece);
        loosePieces.forEach(p => this.renderPieceToContext(this.ctx, p, false));

        // 6. Dibujar Pieza Seleccionada (Tope)
        if (this.selectedPiece) {
            this.renderPieceToContext(this.ctx, this.selectedPiece, true);
        }

        // 7. Partículas
        this.updateParticles();
    }

    /**
     * Dibuja el fondo estático: Tablero vacío + Piezas ya colocadas.
     * Esta función es pesada pero solo se llama cuando una pieza encaja.
     */
    updateStaticLayer() {
        const ctx = this.staticCtx;
        
        // Limpiar
        ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        // Dibujar borde del tablero (Guía)
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(this.boardX), Math.round(this.boardY), Math.round(this.boardWidth), Math.round(this.boardHeight));

        // Dibujar TODAS las piezas bloqueadas
        // IMPORTANTE: Al dibujarlas aquí, aplicamos el "Seam Healing"
        const lockedPieces = this.pieces.filter(p => p.isLocked);
        lockedPieces.forEach(p => {
            this.renderPieceToContext(ctx, p, false, true); // true = isStaticRender
        });
    }

    /**
     * Renderizador Universal de Pieza
     * @param ctx - Contexto donde dibujar (Main o Static)
     * @param p - Objeto pieza
     * @param isSelected - Si está siendo arrastrada
     * @param isStaticRender - Si estamos renderizando para el buffer estático (para aplicar fixes visuales)
     */
    renderPieceToContext(ctx, p, isSelected, isStaticRender = false) {
        ctx.save();
        
        const drawX = Math.round(p.currentX);
        const drawY = Math.round(p.currentY);
        ctx.translate(drawX, drawY);

        // Sombras (Solo si NO es render estático y NO está bloqueada)
        if (!isStaticRender && !p.isLocked) {
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.shadowBlur = isSelected ? 15 : 5;
            ctx.shadowOffsetY = isSelected ? 8 : 2;
            if (isSelected) {
                // Escala visual al levantar
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.1, 1.1);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }
        }

        // --- SEAM HEALING (SOLUCIÓN "IMAGEN LISA") ---
        // Si es render estático (pieza bloqueada), dibujamos un borde extra
        // alrededor del path para que se solape con sus vecinas.
        if (isStaticRender) {
            ctx.lineWidth = 1; // 1px de solapamiento
            ctx.strokeStyle = "rgba(0,0,0,0)"; // Truco: Stroke invisible pero expande el área de clip? No.
            // Mejor estrategia: Inflar el path ligeramente?
            // Haremos algo más simple: NO dibujamos borde stroke en estático.
            // La magia ocurre en el drawImage de abajo.
        }

        ctx.clip(p.path);

        // --- RENDERIZADO DE IMAGEN ---
        const scaleX = this.boardWidth / this.img.width;
        const scaleY = this.boardHeight / this.img.height;

        // Margen base
        let margin = Math.max(this.pieceWidth, this.pieceHeight);
        
        // TRUCO FINAL: Si es estático, dibujamos la imagen 0.5px más grande/desplazada
        // para cubrir el antialiasing del borde.
        let overlapFix = isStaticRender ? 0.6 : 0; 

        const srcRectX = p.srcOriginX - (margin / scaleX);
        const srcRectY = p.srcOriginY - (margin / scaleY);
        const srcRectW = p.srcPieceW + (margin * 2 / scaleX);
        const srcRectH = p.srcPieceH + (margin * 2 / scaleY);

        const dstX = -margin - overlapFix;
        const dstY = -margin - overlapFix;
        const dstW = this.pieceWidth + (margin * 2) + (overlapFix * 2);
        const dstH = this.pieceHeight + (margin * 2) + (overlapFix * 2);

        ctx.drawImage(this.img, srcRectX, srcRectY, srcRectW, srcRectH, dstX, dstY, dstW, dstH);

        ctx.restore();

        // BORDES VISUALES (Solo para piezas sueltas)
        // Si está bloqueada (static), NO dibujamos borde para que se vea lisa.
        if (!isStaticRender && !p.isLocked) {
            ctx.save();
            ctx.translate(drawX, drawY);
            if (isSelected) {
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.1, 1.1);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }
            ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1; ctx.stroke(p.path);
            ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 1; ctx.stroke(p.path);
            ctx.restore();
        }
    }

    /* --- TOPOLOGÍA Y CREACIÓN (Igual que v9, funciona bien) --- */
    generateSharedTopology() {
        const jitterStrength = this.gridSize > 6 ? 0.08 : 0.15;
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
        this.verticalEdges = []; 
        for(let y = 0; y < this.gridSize; y++) {
            const row = [];
            for(let x = 0; x <= this.gridSize; x++) {
                if (x === 0 || x === this.gridSize) row.push(0);
                else row.push((Math.random() - 0.5) * jitterStrength);
            }
            this.verticalEdges.push(row);
        }
        this.horizontalEdges = [];
        for(let y = 0; y <= this.gridSize; y++) {
            const row = [];
            for(let x = 0; x < this.gridSize; x++) {
                if (y === 0 || y === this.gridSize) row.push(0);
                else row.push((Math.random() - 0.5) * jitterStrength);
            }
            this.horizontalEdges.push(row);
        }
    }

    createPieces() {
        this.pieces = [];
        const srcPieceW = this.img.width / this.gridSize;
        const srcPieceH = this.img.height / this.gridSize;

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const shape = this.shapes[y][x];
                const jitter = {
                    top: this.horizontalEdges[y][x],
                    bottom: this.horizontalEdges[y+1][x],
                    left: this.verticalEdges[y][x],
                    right: this.verticalEdges[y][x+1]
                };
                const path = this.createPath(this.pieceWidth, this.pieceHeight, shape, jitter);
                this.pieces.push({
                    id: `${x}-${y}`,
                    gridX: x, gridY: y,
                    correctX: this.boardX + (x * this.pieceWidth),
                    correctY: this.boardY + (y * this.pieceHeight),
                    currentX: 0, currentY: 0,
                    isLocked: false,
                    shape, jitter, path,
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
            p.correctX = this.boardX + (p.gridX * this.pieceWidth);
            p.correctY = this.boardY + (p.gridY * this.pieceHeight);
            if(p.isLocked) {
                p.currentX = p.correctX;
                p.currentY = p.correctY;
            }
        }
    }

    shufflePieces(repositionOnly = false) {
        const loosePieces = this.pieces.filter(p => !p.isLocked);
        const leftLimit = this.boardX - this.pieceWidth; 
        const rightStart = this.boardX + this.boardWidth + 10;
        const topMargin = 80;
        const bottomMargin = this.logicalHeight - 80;
        const availHeight = bottomMargin - topMargin;
        const overlapY = this.pieceHeight * 0.4;
        const slotsPerColumn = Math.ceil(availHeight / overlapY);
        
        loosePieces.forEach((p, i) => {
            if (repositionOnly && p.isLocked) return;
            p.isLocked = false;
            const isLeft = i % 2 === 0;
            const indexInSide = Math.floor(i / 2);
            const columnOffset = Math.floor(indexInSide / slotsPerColumn) * (this.pieceWidth * 0.3);
            const rowInColumn = indexInSide % slotsPerColumn;
            let posX, posY;

            if (isLeft) {
                posX = 10 + columnOffset;
                posX = Math.min(posX, leftLimit - 10);
            } else {
                posX = rightStart + columnOffset;
                posX = Math.min(posX, this.logicalWidth - this.pieceWidth - 10);
            }
            posY = topMargin + (rowInColumn * overlapY);
            p.currentX = posX + (Math.random() * 5);
            p.currentY = posY + (Math.random() * 5);
        });
        this.needsStaticUpdate = true;
        this.render();
    }

    /* --- CURVAS --- */
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

    /* --- INPUT & EVENTS --- */
    handleEnd(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        const dist = Math.hypot(this.selectedPiece.currentX - this.selectedPiece.correctX, this.selectedPiece.currentY - this.selectedPiece.correctY);
        
        if (dist < this.pieceWidth * 0.3) {
            // SNAP & LOCK
            this.selectedPiece.currentX = this.selectedPiece.correctX;
            this.selectedPiece.currentY = this.selectedPiece.correctY;
            this.selectedPiece.isLocked = true;
            
            // EFECTO VISUAL: Actualizar el fondo estático
            this.needsStaticUpdate = true; // <--- CRÍTICO PARA EL RENDIMIENTO Y VISUAL
            
            this.spawnParticles(this.selectedPiece.currentX + this.pieceWidth/2, this.selectedPiece.currentY + this.pieceHeight/2, 'spark');
            if(this.callbacks.onSound) this.callbacks.onSound('snap');
            if(this.callbacks.onStateChange) this.callbacks.onStateChange();
            this.checkVictory();
        } else {
            if(this.callbacks.onStateChange) this.callbacks.onStateChange();
        }
        this.isDragging = false;
        this.selectedPiece = null;
        // No llamamos render() aquí, el loop animate() lo hará
    }

    /* --- BOILERPLATE --- */
    spawnParticles(x, y, type) { /* ... partículas igual ... */ 
        const count = type === 'confetti' ? 50 : 10;
        const colors = ['#f43f5e', '#3b82f6', '#10b981', '#fbbf24', '#fff'];
        for(let i=0; i<count; i++) this.particles.push({ x, y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 1.0, color: colors[Math.floor(Math.random()*colors.length)], size: Math.random()*4+2 });
    }
    updateParticles() {
        if(this.particles.length===0) return;
        for(let i=this.particles.length-1; i>=0; i--) {
            let p=this.particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.2; p.life-=0.03;
            if(p.life<=0) this.particles.splice(i,1);
            else { this.ctx.globalAlpha=p.life; this.ctx.fillStyle=p.color; this.ctx.fillRect(p.x,p.y,p.size,p.size); }
        }
        this.ctx.globalAlpha=1;
    }
    
    // Métodos estándar (sin cambios mayores, solo integración)
    getPointerPos(e) { const r=this.canvas.getBoundingClientRect(); const cx=e.touches?e.touches[0].clientX:e.clientX; const cy=e.touches?e.touches[0].clientY:e.clientY; return {x:cx-r.left, y:cy-r.top}; }
    handleStart(e) { e.preventDefault(); const {x,y}=this.getPointerPos(e); for(let i=this.pieces.length-1; i>=0; i--) { const p=this.pieces[i]; if(p.isLocked) continue; const m=this.tabSize*2; if(x>=p.currentX-m && x<=p.currentX+this.pieceWidth+m && y>=p.currentY-m && y<=p.currentY+this.pieceHeight+m) { this.selectedPiece=p; this.isDragging=true; this.dragOffsetX=x-p.currentX; this.dragOffsetY=y-p.currentY; this.pieces.splice(i,1); this.pieces.push(p); if(this.callbacks.onSound) this.callbacks.onSound('click'); return; } } }
    handleMove(e) { if(!this.isDragging||!this.selectedPiece) return; e.preventDefault(); const {x,y}=this.getPointerPos(e); this.selectedPiece.currentX=x-this.dragOffsetX; this.selectedPiece.currentY=y-this.dragOffsetY; }
    
    checkVictory() { if(this.pieces.every(p=>p.isLocked)) { this.spawnParticles(this.logicalWidth/2, this.logicalHeight/2, 'confetti'); if(this.callbacks.onSound) this.callbacks.onSound('win'); if(this.callbacks.onWin) setTimeout(this.callbacks.onWin, 1500); this.canvas.removeEventListener('mousedown', this.handleStart); this.canvas.removeEventListener('touchstart', this.handleStart); } }
    exportState() { return this.pieces.map(p => ({ id: p.id, cx: p.currentX, cy: p.currentY, locked: p.isLocked })); }
    importState(s) { if(!s) return; s.forEach(sp => { const p=this.pieces.find(x=>x.id===sp.id); if(p){ p.currentX=sp.cx; p.currentY=sp.cy; p.isLocked=sp.locked; } }); this.needsStaticUpdate=true; }
    togglePreview(a) { this.showPreview=a; }
    autoPlacePiece() { 
        const loose=this.pieces.filter(p=>!p.isLocked); if(loose.length===0) return false; 
        const p=loose[Math.floor(Math.random()*loose.length)]; 
        this.spawnParticles(p.correctX+this.pieceWidth/2, p.correctY+this.pieceHeight/2, 'gold'); 
        p.currentX=p.correctX; p.currentY=p.correctY; p.isLocked=true; this.needsStaticUpdate=true;
        if(this.callbacks.onSound) this.callbacks.onSound('snap'); this.checkVictory(); return true; 
    }
    addEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleStart); window.addEventListener('mousemove', this.handleMove); window.addEventListener('mouseup', this.handleEnd);
        this.canvas.addEventListener('touchstart', this.handleStart, {passive:false}); window.addEventListener('touchmove', this.handleMove, {passive:false}); window.addEventListener('touchend', this.handleEnd);
        if(!this._resizeObserver && typeof ResizeObserver!=='undefined') { this._resizeObserver=new ResizeObserver(()=>this.handleResize()); this._resizeObserver.observe(this.canvas.parentElement); }
    }
    destroy() {
        this.isActive=false;
        this.canvas.removeEventListener('mousedown', this.handleStart); window.removeEventListener('mousemove', this.handleMove); window.removeEventListener('mouseup', this.handleEnd);
        this.canvas.removeEventListener('touchstart', this.handleStart); window.removeEventListener('touchmove', this.handleMove); window.removeEventListener('touchend', this.handleEnd);
        if(this._resizeObserver) this._resizeObserver.disconnect();
    }
}
