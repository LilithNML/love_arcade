/**
 * PuzzleEngine.js v12.0 - Phase 1 Polish
 * - Feature: Partículas "Snap" (Onda expansiva de luz).
 * - Fix: Zona de seguridad UI (Evita que las piezas queden bajo los botones).
 * - Optimization: SourceCanvas y Double Buffering mantenidos.
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        
        this.img = config.image;
        this.gridSize = Math.sqrt(config.pieces);
        this.callbacks = callbacks || {};
        
        // Buffers
        this.staticCanvas = document.createElement('canvas');
        this.staticCtx = this.staticCanvas.getContext('2d', { alpha: true });
        this.sourceCanvas = document.createElement('canvas');
        this.sourceCtx = this.sourceCanvas.getContext('2d', { alpha: false });

        this.needsStaticUpdate = true;

        // Estado
        this.pieces = [];
        this.lockedPieces = []; 
        this.loosePieces = [];  
        
        this.particles = []; // Array mixto (Confetti + Ripples)
        this.selectedPiece = null;
        this.isDragging = false;
        this.showPreview = false;
        
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        
        this.verticalEdges = []; 
        this.horizontalEdges = []; 
        
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.isActive = true; 

        // Configuración visual
        this.shadowBlur = this.gridSize > 6 ? 2 : 5;
        this.particleLimit = this.gridSize > 6 ? 30 : 60;

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
        this.animate(); 
    }

    animate() {
        if (!this.isActive) return;
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
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        const imgRatio = this.img.width / this.img.height;

        let cssW = w;
        let cssH = w / imgRatio;

        if (cssH > h) {
            cssH = h;
            cssW = cssH * imgRatio;
        }

        const workAreaScale = 0.65; 
        cssW *= workAreaScale;
        cssH *= workAreaScale;

        // Canvas Setup
        this.canvas.width = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width = "100%";
        this.canvas.style.height = "100%";
        this.ctx.scale(this.dpr, this.dpr);

        this.staticCanvas.width = this.canvas.width; 
        this.staticCanvas.height = this.canvas.height;
        this.staticCtx.scale(this.dpr, this.dpr);

        // Métricas
        this.boardWidth = cssW;
        this.boardHeight = cssH;
        this.boardX = Math.round((w - cssW) / 2);
        this.boardY = Math.round((h - cssH) / 2);

        this.pieceWidth = this.boardWidth / this.gridSize;
        this.pieceHeight = this.boardHeight / this.gridSize;
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * 0.25;
        this.logicalWidth = w;
        this.logicalHeight = h;

        // Source Canvas
        this.sourceCanvas.width = Math.ceil(this.boardWidth * this.dpr);
        this.sourceCanvas.height = Math.ceil(this.boardHeight * this.dpr);
        this.sourceCtx.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
        this.sourceCtx.drawImage(this.img, 0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    }

    /* --- BUG FIX: Zona Prohibida (UI Buttons) --- */
    // Determina si una coordenada está debajo de los botones (esquina inferior derecha)
    isInRestrictedArea(x, y) {
        // Los botones ocupan aprox 80px x 150px en la esquina inferior derecha
        const safeMarginRight = 90; 
        const safeMarginBottom = 160; 
        
        return (x > this.logicalWidth - safeMarginRight) && 
               (y > this.logicalHeight - safeMarginBottom);
    }

    // Clamper inteligente que evita la zona de UI
    clampPosition(p) {
        // 1. Clamp básico a pantalla
        let x = Math.max(0, Math.min(p.currentX, this.logicalWidth - this.pieceWidth));
        let y = Math.max(0, Math.min(p.currentY, this.logicalHeight - this.pieceHeight));

        // 2. Clamp UI (Si entra en zona prohibida, empujar hacia arriba o izquierda)
        if (this.isInRestrictedArea(x + this.pieceWidth/2, y + this.pieceHeight/2)) {
            // Empujar hacia arriba
            y = this.logicalHeight - 170 - this.pieceHeight;
        }
        
        p.currentX = x;
        p.currentY = y;
    }

    /* --- LOGICA DE PARTICULAS (Ripple & Confetti) --- */
    spawnParticles(x, y, type) {
        if (type === 'ripple') {
            // Efecto SNAP: Onda expansiva
            this.particles.push({
                type: 'ripple',
                x: x, y: y,
                radius: 10,
                alpha: 1.0,
                color: '#ffffff',
                lineWidth: 4
            });
            // Destello secundario
            this.particles.push({
                type: 'ripple',
                x: x, y: y,
                radius: 5,
                alpha: 1.0,
                color: '#fbbf24', // Gold
                lineWidth: 2,
                speed: 1.5
            });
        } else {
            // Confetti existente
            if (this.particles.length > this.particleLimit) return;
            const count = 30;
            const colors = ['#f43f5e', '#3b82f6', '#10b981', '#fbbf24', '#fff'];
            for(let i=0; i<count; i++) {
                this.particles.push({
                    type: 'confetti',
                    x, y, 
                    vx: (Math.random()-0.5)*10, 
                    vy: (Math.random()-0.5)*10,
                    life: 1.0, color: colors[Math.floor(Math.random()*colors.length)], 
                    size: Math.random()*4+2
                });
            }
        }
        this.render(); // Force render start
    }

    updateParticles() {
        if(this.particles.length===0) return;
        
        for(let i=this.particles.length-1; i>=0; i--) {
            let p = this.particles[i];
            
            if (p.type === 'ripple') {
                // Lógica Ripple
                p.radius += (p.speed || 3);
                p.alpha -= 0.04;
                p.lineWidth *= 0.95;
                
                if(p.alpha <= 0) {
                    this.particles.splice(i, 1);
                } else {
                    this.ctx.save();
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    this.ctx.strokeStyle = p.color;
                    this.ctx.lineWidth = p.lineWidth;
                    this.ctx.globalAlpha = p.alpha;
                    this.ctx.stroke();
                    this.ctx.restore();
                }
            } else {
                // Lógica Confetti
                p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.03;
                if(p.life<=0) {
                    this.particles.splice(i, 1);
                } else { 
                    this.ctx.globalAlpha = p.life; 
                    this.ctx.fillStyle = p.color; 
                    this.ctx.fillRect(p.x, p.y, p.size, p.size); 
                }
            }
        }
        this.ctx.globalAlpha = 1;
    }

    /* --- RENDER --- */
    render() {
        if (this.needsStaticUpdate) {
            this.updateStaticLayer();
            this.needsStaticUpdate = false;
        }

        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
        this.ctx.drawImage(this.staticCanvas, 0, 0, this.logicalWidth, this.logicalHeight);

        if (this.showPreview) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            this.ctx.drawImage(this.sourceCanvas, 0, 0, this.sourceCanvas.width, this.sourceCanvas.height, this.boardX, this.boardY, this.boardWidth, this.boardHeight);
            this.ctx.restore();
        }

        for(let i=0; i<this.loosePieces.length; i++) {
            const p = this.loosePieces[i];
            if(p !== this.selectedPiece) this.renderPieceToContext(this.ctx, p, false);
        }

        if (this.selectedPiece) {
            this.renderPieceToContext(this.ctx, this.selectedPiece, true);
        }

        this.updateParticles();
    }

    updateStaticLayer() {
        const ctx = this.staticCtx;
        ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(this.boardX), Math.round(this.boardY), Math.round(this.boardWidth), Math.round(this.boardHeight));

        for(let i=0; i<this.lockedPieces.length; i++) {
            this.renderPieceToContext(ctx, this.lockedPieces[i], false, true);
        }
    }

    renderPieceToContext(ctx, p, isSelected, isStaticRender = false) {
        ctx.save();
        const drawX = Math.round(p.currentX);
        const drawY = Math.round(p.currentY);
        ctx.translate(drawX, drawY);

        if (!isStaticRender && !p.isLocked) {
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.shadowBlur = isSelected ? 15 : this.shadowBlur;
            ctx.shadowOffsetY = isSelected ? 8 : 2;
            if (isSelected) {
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.1, 1.1);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }
        }

        ctx.clip(p.path);

        const margin = Math.max(this.pieceWidth, this.pieceHeight);
        let overlapFix = isStaticRender ? 0.6 : 0; 

        const srcPieceW_SC = (this.sourceCanvas.width / this.gridSize);
        const srcPieceH_SC = (this.sourceCanvas.height / this.gridSize);
        const srcOriginX_SC = p.gridX * srcPieceW_SC;
        const srcOriginY_SC = p.gridY * srcPieceH_SC;
        const scaleToSource = this.dpr; 

        const srcX = srcOriginX_SC - (margin * scaleToSource);
        const srcY = srcOriginY_SC - (margin * scaleToSource);
        const srcW = srcPieceW_SC + (margin * 2 * scaleToSource);
        const srcH = srcPieceH_SC + (margin * 2 * scaleToSource);

        const dstX = -margin - overlapFix;
        const dstY = -margin - overlapFix;
        const dstW = this.pieceWidth + (margin * 2) + (overlapFix * 2);
        const dstH = this.pieceHeight + (margin * 2) + (overlapFix * 2);

        ctx.drawImage(this.sourceCanvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
        ctx.restore();

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

    updatePieceCaches() {
        this.lockedPieces = this.pieces.filter(p => p.isLocked);
        this.loosePieces = this.pieces.filter(p => !p.isLocked);
    }

    /* --- INIT LOGIC --- */
    createPieces() {
        this.pieces = [];
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
                    id: `${x}-${y}`, gridX: x, gridY: y,
                    correctX: this.boardX + (x * this.pieceWidth),
                    correctY: this.boardY + (y * this.pieceHeight),
                    currentX: 0, currentY: 0, isLocked: false,
                    shape, jitter, path
                });
            }
        }
        this.updatePieceCaches();
    }

    shufflePieces(repositionOnly = false) {
        this.updatePieceCaches();
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
            
            // Asegurar que no nazcan en la zona prohibida
            this.clampPosition(p);
        });
        
        this.updatePieceCaches();
        this.needsStaticUpdate = true;
        this.render();
    }

    generateSharedTopology() { /* ...Misma lógica V9... */
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
            const row = []; for(let x = 0; x <= this.gridSize; x++) row.push((x===0||x===this.gridSize)?0:(Math.random()-0.5)*jitterStrength);
            this.verticalEdges.push(row);
        }
        this.horizontalEdges = [];
        for(let y = 0; y <= this.gridSize; y++) {
            const row = []; for(let x = 0; x < this.gridSize; x++) row.push((y===0||y===this.gridSize)?0:(Math.random()-0.5)*jitterStrength);
            this.horizontalEdges.push(row);
        }
    }

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
    lineToTab(path, x1, y1, x2, y2, amp, shift) { /* ...Misma lógica Bézier... */
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

    /* --- INPUT --- */
    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }
    handleStart(e) {
        e.preventDefault(); const { x, y } = this.getPointerPos(e);
        for (let i = this.loosePieces.length - 1; i >= 0; i--) {
            const p = this.loosePieces[i]; 
            const m = this.tabSize * 2.0; 
            if (x >= p.currentX - m && x <= p.currentX + this.pieceWidth + m && 
                y >= p.currentY - m && y <= p.currentY + this.pieceHeight + m) {
                
                this.selectedPiece = p; 
                this.isDragging = true;
                this.dragOffsetX = x - p.currentX; 
                this.dragOffsetY = y - p.currentY;
                
                // Audio Click
                this.callbacks.onSound && this.callbacks.onSound('click');
                
                this.loosePieces.splice(i, 1);
                this.loosePieces.push(p);
                this.render(); 
                return;
            }
        }
    }
    handleMove(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        e.preventDefault(); 
        const { x, y } = this.getPointerPos(e);
        
        // Mover
        this.selectedPiece.currentX = x - this.dragOffsetX;
        this.selectedPiece.currentY = y - this.dragOffsetY;
        
        // Aplicar Zona Prohibida (Clamp)
        this.clampPosition(this.selectedPiece);
    }
    handleEnd(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        const dist = Math.hypot(this.selectedPiece.currentX - this.selectedPiece.correctX, this.selectedPiece.currentY - this.selectedPiece.correctY);
        
        if (dist < this.pieceWidth * 0.3) {
            this.selectedPiece.currentX = this.selectedPiece.correctX;
            this.selectedPiece.currentY = this.selectedPiece.correctY;
            this.selectedPiece.isLocked = true;
            this.needsStaticUpdate = true; 
            this.updatePieceCaches();
            
            // Audio Snap & Partículas Ripple
            this.callbacks.onSound && this.callbacks.onSound('snap');
            this.spawnParticles(this.selectedPiece.currentX + this.pieceWidth/2, this.selectedPiece.currentY + this.pieceHeight/2, 'ripple');
            
            if(this.callbacks.onStateChange) this.callbacks.onStateChange();
            this.checkVictory();
        } else {
            // Drop normal
            if(this.callbacks.onStateChange) this.callbacks.onStateChange();
        }
        this.isDragging = false;
        this.selectedPiece = null;
        this.render();
    }
    
    // Boilerplate final (CheckVictory, exportState, etc.) - Igual que antes
    checkVictory() { if (this.loosePieces.length === 0) { this.spawnParticles(this.logicalWidth/2, this.logicalHeight/2, 'confetti'); if(this.callbacks.onSound) this.callbacks.onSound('win'); if(this.callbacks.onWin) setTimeout(this.callbacks.onWin, 1500); this.canvas.removeEventListener('mousedown', this.handleStart); this.canvas.removeEventListener('touchstart', this.handleStart); } }
    exportState() { return this.pieces.map(p => ({ id: p.id, cx: p.currentX, cy: p.currentY, locked: p.isLocked })); }
    importState(s) { if(!s) return; s.forEach(sp => { const p = this.pieces.find(x=>x.id===sp.id); if(p){ p.currentX=sp.cx; p.currentY=sp.cy; p.isLocked=sp.locked; } }); this.updatePieceCaches(); this.needsStaticUpdate=true; this.render(); }
    togglePreview(a) { this.showPreview=a; this.render(); }
    autoPlacePiece() { 
        if(this.loosePieces.length===0) return false; 
        const p = this.loosePieces[Math.floor(Math.random()*this.loosePieces.length)]; 
        this.spawnParticles(p.correctX+this.pieceWidth/2, p.correctY+this.pieceHeight/2, 'ripple'); 
        p.currentX=p.correctX; p.currentY=p.correctY; p.isLocked=true; 
        this.updatePieceCaches(); this.needsStaticUpdate=true;
        if(this.callbacks.onSound) this.callbacks.onSound('snap'); this.checkVictory(); return true; 
    }
    addEventListeners() { /* ... */ this.canvas.addEventListener('mousedown', this.handleStart); window.addEventListener('mousemove', this.handleMove); window.addEventListener('mouseup', this.handleEnd); this.canvas.addEventListener('touchstart', this.handleStart, {passive:false}); window.addEventListener('touchmove', this.handleMove, {passive:false}); window.addEventListener('touchend', this.handleEnd); if(!this._resizeObserver && typeof ResizeObserver!=='undefined') { this._resizeObserver=new ResizeObserver(()=>this.handleResize()); this._resizeObserver.observe(this.canvas.parentElement); } }
    destroy() { this.isActive=false; this.canvas.removeEventListener('mousedown', this.handleStart); window.removeEventListener('mousemove', this.handleMove); window.removeEventListener('mouseup', this.handleEnd); this.canvas.removeEventListener('touchstart', this.handleStart); window.removeEventListener('touchmove', this.handleMove); window.removeEventListener('touchend', this.handleEnd); if(this._resizeObserver) this._resizeObserver.disconnect(); }
}
