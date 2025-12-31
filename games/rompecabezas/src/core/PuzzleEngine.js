/**
 * PuzzleEngine.js v11.0 
 * * OPTIMIZACIÓN CRÍTICA (High-Res Images):
 * - Source Canvas: Pre-escala la imagen gigante al tamaño del tablero una sola vez.
 * Esto elimina el costoso downsampling en tiempo real de imágenes 4K/WebP.
 * * OPTIMIZACIONES DE LOOP:
 * - List Caching: Cachea listas de 'locked' y 'loose' para evitar .filter() en cada frame.
 * - Dynamic Shadows: Reduce calidad de sombras en tableros densos.
 * - Particle Throttling: Limita partículas si hay muchas piezas.
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        this.img = config.image; // Imagen original (potencialmente gigante)
        this.gridSize = Math.sqrt(config.pieces);
        this.callbacks = callbacks || {};
        
        // --- DOBLE BUFFERING (Capas) ---
        // 1. Static Canvas: Fondo + Piezas bloqueadas (Ya implementado en v10)
        this.staticCanvas = document.createElement('canvas');
        this.staticCtx = this.staticCanvas.getContext('2d', { alpha: true });
        
        // 2. Source Canvas (NUEVO): Buffer pre-escalado de la imagen original
        //    Evita reescalar una imagen de 40MB en cada frame.
        this.sourceCanvas = document.createElement('canvas');
        this.sourceCtx = this.sourceCanvas.getContext('2d', { alpha: false });

        this.needsStaticUpdate = true;

        // Estado
        this.pieces = [];
        this.lockedPieces = []; // Cache
        this.loosePieces = [];  // Cache
        
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
        this.isActive = true; 

        // Configuración de rendimiento dinámica
        this.shadowBlur = this.gridSize > 6 ? 2 : 5; // Menos blur en puzzles grandes
        this.particleLimit = this.gridSize > 6 ? 30 : 60;

        // Binds
        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        this.init();
    }

    init() {
        this.resizeCanvas(); // Aquí se genera el sourceCanvas
        this.generateSharedTopology();
        this.createPieces(); 
        this.shufflePieces(); 
        this.addEventListeners();
        this.animate(); 
    }

    animate() {
        if (!this.isActive) return;

        // Render bajo demanda
        if (this.isDragging || this.particles.length > 0 || this.needsStaticUpdate || this.showPreview) {
            this.render();
        }

        requestAnimationFrame(() => this.animate());
    }

    handleResize() {
        this.resizeCanvas();
        this.createPiecesPathsOnly(); 
        this.shufflePieces(true);
        this.needsStaticUpdate = true; 
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

        const workAreaScale = 0.65; 
        cssWidth *= workAreaScale;
        cssHeight *= workAreaScale;

        // Configurar Main & Static Canvas
        this.canvas.width = parent.clientWidth * this.dpr;
        this.canvas.height = parent.clientHeight * this.dpr;
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.ctx.scale(this.dpr, this.dpr);

        this.staticCanvas.width = this.canvas.width; 
        this.staticCanvas.height = this.canvas.height;
        this.staticCtx.scale(this.dpr, this.dpr);

        // Métricas del Tablero
        this.boardWidth = cssWidth;
        this.boardHeight = cssHeight;
        this.boardX = Math.round((parent.clientWidth - cssWidth) / 2);
        this.boardY = Math.round((parent.clientHeight - cssHeight) / 2);

        this.pieceWidth = this.boardWidth / this.gridSize;
        this.pieceHeight = this.boardHeight / this.gridSize;
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * 0.25;
        this.logicalWidth = parent.clientWidth;
        this.logicalHeight = parent.clientHeight;

        // --- OPTIMIZACIÓN CRÍTICA: SOURCE CANVAS ---
        // Pre-escalamos la imagen gigante al tamaño exacto que tendrá en el tablero.
        // Esto reduce el consumo de memoria efectiva de pintado y acelera la GPU.
        this.sourceCanvas.width = Math.ceil(this.boardWidth * this.dpr); // Usar resolución real
        this.sourceCanvas.height = Math.ceil(this.boardHeight * this.dpr);
        
        // Dibujamos la imagen original redimensionada UNA SOLA VEZ
        this.sourceCtx.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
        this.sourceCtx.drawImage(
            this.img, 
            0, 0, 
            this.sourceCanvas.width, 
            this.sourceCanvas.height
        );
        
        // Nota: sourceCanvas está en resolución de dispositivo (high dpi), 
        // pero sourceCtx no está escalado, trabajamos en pixeles físicos para nitidez máxima.
    }

    /* --- RENDERIZADO PRINCIPAL --- */
    render() {
        // 1. Actualizar Buffer Estático
        if (this.needsStaticUpdate) {
            this.updateStaticLayer();
            this.needsStaticUpdate = false;
        }

        // 2. Limpiar
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        // 3. Dibujar Fondo Estático (1 sola llamada a GPU)
        this.ctx.drawImage(this.staticCanvas, 0, 0, this.logicalWidth, this.logicalHeight);

        // 4. Preview
        if (this.showPreview) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            // Usamos sourceCanvas para preview también (es más rápido)
            this.ctx.drawImage(
                this.sourceCanvas, 
                0, 0, this.sourceCanvas.width, this.sourceCanvas.height,
                this.boardX, this.boardY, this.boardWidth, this.boardHeight
            );
            this.ctx.restore();
        }

        // 5. Piezas Sueltas (Usando cache)
        // Filtramos la seleccionada del cache loosePieces para no dibujarla dos veces
        for(let i=0; i<this.loosePieces.length; i++) {
            const p = this.loosePieces[i];
            if(p !== this.selectedPiece) {
                this.renderPieceToContext(this.ctx, p, false);
            }
        }

        // 6. Pieza Seleccionada
        if (this.selectedPiece) {
            this.renderPieceToContext(this.ctx, this.selectedPiece, true);
        }

        // 7. Partículas
        this.updateParticles();
    }

    updateStaticLayer() {
        const ctx = this.staticCtx;
        ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(this.boardX), Math.round(this.boardY), Math.round(this.boardWidth), Math.round(this.boardHeight));

        // Dibujar cache de Locked Pieces
        for(let i=0; i<this.lockedPieces.length; i++) {
            this.renderPieceToContext(ctx, this.lockedPieces[i], false, true);
        }
    }

    renderPieceToContext(ctx, p, isSelected, isStaticRender = false) {
        ctx.save();
        
        const drawX = Math.round(p.currentX);
        const drawY = Math.round(p.currentY);
        ctx.translate(drawX, drawY);

        // Sombra Dinámica (Optimizada)
        if (!isStaticRender && !p.isLocked) {
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.shadowBlur = isSelected ? 15 : this.shadowBlur; // Blur reducido si hay muchas piezas
            ctx.shadowOffsetY = isSelected ? 8 : 2;
            if (isSelected) {
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.1, 1.1);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }
        }

        ctx.clip(p.path);

        // --- RENDERIZADO OPTIMIZADO USANDO SOURCE CANVAS ---
        // Ya no calculamos ratios respecto a this.img.width, sino respecto al sourceCanvas pre-escalado.
        
        const margin = Math.max(this.pieceWidth, this.pieceHeight);
        let overlapFix = isStaticRender ? 0.6 : 0; 

        // Cálculo de coordenadas en el Source Canvas (Pre-escalado)
        // Como el sourceCanvas tiene el tamaño exacto del tablero (multiplicado por dpr),
        // las coordenadas son proporcionales a la posición de la pieza en el grid.
        
        // Ancho/Alto de pieza en el sourceCanvas
        const srcPieceW_SC = (this.sourceCanvas.width / this.gridSize);
        const srcPieceH_SC = (this.sourceCanvas.height / this.gridSize);
        
        // Origen de la pieza en sourceCanvas
        const srcOriginX_SC = p.gridX * srcPieceW_SC;
        const srcOriginY_SC = p.gridY * srcPieceH_SC;

        // Factor de escala entre canvas lógico y sourceCanvas (dpr)
        const scaleToSource = this.dpr; // sourceCanvas es boardWidth * dpr

        // Coordenadas Source (en sourceCanvas)
        const srcX = srcOriginX_SC - (margin * scaleToSource);
        const srcY = srcOriginY_SC - (margin * scaleToSource);
        const srcW = srcPieceW_SC + (margin * 2 * scaleToSource);
        const srcH = srcPieceH_SC + (margin * 2 * scaleToSource);

        // Coordenadas Destino (en canvas lógico local 0,0)
        const dstX = -margin - overlapFix;
        const dstY = -margin - overlapFix;
        const dstW = this.pieceWidth + (margin * 2) + (overlapFix * 2);
        const dstH = this.pieceHeight + (margin * 2) + (overlapFix * 2);

        // DIBUJAR DESDE CACHE PRE-ESCALADO (RÁPIDO ⚡)
        ctx.drawImage(this.sourceCanvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);

        ctx.restore();

        // Bordes (Solo sueltas)
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

    /* --- GESTIÓN DE PIEZAS & CACHE --- */
    updatePieceCaches() {
        this.lockedPieces = this.pieces.filter(p => p.isLocked);
        this.loosePieces = this.pieces.filter(p => !p.isLocked);
    }

    createPieces() {
        this.pieces = [];
        // Ya no necesitamos srcOrigin de la imagen original para el render loop,
        // pero lo guardamos por si acaso necesitamos referencia absoluta.
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const shape = this.shapes[y][x];
                // Jitter compartido desde matrices globales
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
                    shape, jitter, path
                });
            }
        }
        this.updatePieceCaches();
    }

    /* --- TOPOLOGÍA, SCATTER Y EVENTOS (Igual v9) --- */
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
        this.updatePieceCaches(); // Asegurar cache antes de iterar
        const loose = this.loosePieces;
        
        const leftLimit = this.boardX - this.pieceWidth; 
        const rightStart = this.boardX + this.boardWidth + 10;
        const topMargin = 80;
        const bottomMargin = this.logicalHeight - 80;
        const availHeight = bottomMargin - topMargin;
        const overlapY = this.pieceHeight * 0.4;
        const slotsPerColumn = Math.ceil(availHeight / overlapY);
        
        loose.forEach((p, i) => {
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
        
        this.updatePieceCaches(); // Actualizar después de shuffle
        this.needsStaticUpdate = true;
        this.render();
    }

    // Bézier Standard
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

    // Input Handling
    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }
    handleStart(e) {
        e.preventDefault(); 
        const { x, y } = this.getPointerPos(e);
        
        // Iterar solo sobre piezas sueltas (optimización)
        // Usar iteración inversa para seleccionar la de arriba
        for (let i = this.loosePieces.length - 1; i >= 0; i--) {
            const p = this.loosePieces[i]; 
            const m = this.tabSize * 2.0; 
            if (x >= p.currentX - m && x <= p.currentX + this.pieceWidth + m && 
                y >= p.currentY - m && y <= p.currentY + this.pieceHeight + m) {
                
                this.selectedPiece = p; 
                this.isDragging = true;
                this.dragOffsetX = x - p.currentX; 
                this.dragOffsetY = y - p.currentY;
                
                // Mover al frente visual (reordenar array y caché)
                // 1. Quitar de loosePieces
                this.loosePieces.splice(i, 1);
                // 2. Poner al final
                this.loosePieces.push(p);
                // 3. (Opcional) Sincronizar array principal si fuera necesario, 
                // pero como renderizamos desde loosePieces, esto basta visualmente.
                
                if(this.callbacks.onSound) this.callbacks.onSound('click');
                this.render(); // Render forzado para feedback inmediato
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
        // No llamamos render(), el loop animate() se encarga
    }
    handleEnd(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        const dist = Math.hypot(this.selectedPiece.currentX - this.selectedPiece.correctX, this.selectedPiece.currentY - this.selectedPiece.correctY);
        
        if (dist < this.pieceWidth * 0.3) {
            // SNAP
            this.selectedPiece.currentX = this.selectedPiece.correctX;
            this.selectedPiece.currentY = this.selectedPiece.correctY;
            this.selectedPiece.isLocked = true;
            this.needsStaticUpdate = true; // Redibujar fondo
            
            // Actualizar cachés
            this.updatePieceCaches();
            
            this.spawnParticles(this.selectedPiece.currentX + this.pieceWidth/2, this.selectedPiece.currentY + this.pieceHeight/2, 'spark');
            if(this.callbacks.onSound) this.callbacks.onSound('snap');
            if(this.callbacks.onStateChange) this.callbacks.onStateChange();
            this.checkVictory();
        } else {
            if(this.callbacks.onStateChange) this.callbacks.onStateChange();
        }
        this.isDragging = false;
        this.selectedPiece = null;
        this.render();
    }

    checkVictory() {
        if (this.loosePieces.length === 0) { // Check optimizado
            this.spawnParticles(this.logicalWidth/2, this.logicalHeight/2, 'confetti');
            if(this.callbacks.onSound) this.callbacks.onSound('win');
            if(this.callbacks.onWin) setTimeout(this.callbacks.onWin, 1500);
            this.canvas.removeEventListener('mousedown', this.handleStart);
            this.canvas.removeEventListener('touchstart', this.handleStart);
        }
    }

    spawnParticles(x, y, type) {
        if (this.particles.length > this.particleLimit) return; // Throttling
        const count = type === 'confetti' ? 50 : 10;
        const colors = ['#f43f5e', '#3b82f6', '#10b981', '#fbbf24', '#fff'];
        for(let i=0; i<count; i++) {
            this.particles.push({
                x, y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
                life: 1.0, color: colors[Math.floor(Math.random()*colors.length)], size: Math.random()*4+2
            });
        }
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
    importState(s) { 
        if(!s) return; 
        s.forEach(sp => { 
            const p = this.pieces.find(x=>x.id===sp.id); 
            if(p){ p.currentX=sp.cx; p.currentY=sp.cy; p.isLocked=sp.locked; } 
        }); 
        this.updatePieceCaches();
        this.needsStaticUpdate=true; 
        this.render();
    }
    togglePreview(a) { this.showPreview=a; this.render(); }
    autoPlacePiece() { 
        if(this.loosePieces.length===0) return false; 
        const p = this.loosePieces[Math.floor(Math.random()*this.loosePieces.length)]; 
        this.spawnParticles(p.correctX+this.pieceWidth/2, p.correctY+this.pieceHeight/2, 'gold'); 
        p.currentX=p.correctX; p.currentY=p.correctY; p.isLocked=true; 
        this.updatePieceCaches();
        this.needsStaticUpdate=true;
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
