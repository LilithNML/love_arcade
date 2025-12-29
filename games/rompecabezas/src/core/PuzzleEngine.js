export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.img = config.image;
        this.gridSize = Math.sqrt(config.pieces);
        this.callbacks = callbacks || {};
        
        this.pieces = [];
        this.particles = []; // Sistema de Partículas
        this.selectedPiece = null;
        this.isDragging = false;
        this.showPreview = false;
        
        // Jitter Seed: Para que la variación aleatoria sea constante por sesión
        this.jitterMap = []; 

        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        
        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        this.init();
    }

    init() {
        this.resizeCanvas();
        this.generateTopology();
        this.createPieces(); // Aquí se aplica el Jitter
        this.shufflePieces();
        this.addEventListeners();
        requestAnimationFrame(() => this.render());
    }

    /* --- GESTIÓN DE ESTADO (PERSISTENCIA) --- */
    exportState() {
        return this.pieces.map(p => ({
            id: p.id,
            cx: p.currentX,
            cy: p.currentY,
            locked: p.isLocked
        }));
    }

    importState(savedState) {
        if (!savedState || !Array.isArray(savedState)) return;
        savedState.forEach(savedP => {
            const piece = this.pieces.find(p => p.id === savedP.id);
            if (piece) {
                piece.currentX = savedP.cx;
                piece.currentY = savedP.cy;
                piece.isLocked = savedP.locked;
            }
        });
        this.render();
    }

    /* --- POWER-UPS & FEATURES --- */
    togglePreview(active) {
        this.showPreview = active;
        this.render();
    }

    autoPlacePiece() {
        // Buscar una pieza suelta aleatoria
        const loosePieces = this.pieces.filter(p => !p.isLocked);
        if (loosePieces.length === 0) return false;

        const piece = loosePieces[Math.floor(Math.random() * loosePieces.length)];
        
        // Animación de "Imán" (teletransporte suave)
        this.spawnParticles(piece.correctX + this.pieceWidth/2, piece.correctY + this.pieceHeight/2, 'gold');
        piece.currentX = piece.correctX;
        piece.currentY = piece.correctY;
        piece.isLocked = true;
        
        if(this.callbacks.onSound) this.callbacks.onSound('snap');
        this.checkVictory();
        this.render();
        return true;
    }

    /* --- CORE SETUP --- */
    generateTopology() {
        this.shapes = [];
        this.jitterMap = []; // Generar offset aleatorio para cada lado
        
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
                
                // Jitter: variaciones sutiles (-10% a +10%)
                jitterRow.push({
                    top: (Math.random() - 0.5) * 0.2,
                    right: (Math.random() - 0.5) * 0.2,
                    bottom: (Math.random() - 0.5) * 0.2,
                    left: (Math.random() - 0.5) * 0.2
                });
            }
            this.shapes.push(row);
            this.jitterMap.push(jitterRow);
        }
    }

    createPieces() {
        this.pieces = [];
        const srcW = this.img.width / this.gridSize;
        const srcH = this.img.height / this.gridSize;

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const shape = this.shapes[y][x];
                const jitter = this.jitterMap[y][x];
                
                // Pasamos el jitter al creador de paths
                const path = this.createPath(this.pieceWidth, this.pieceHeight, shape, jitter);

                this.pieces.push({
                    id: `${x}-${y}`,
                    correctX: x * this.pieceWidth,
                    correctY: y * this.pieceHeight,
                    currentX: 0, currentY: 0,
                    isLocked: false,
                    shape, jitter, path,
                    imgData: { sx: x * srcW, sy: y * srcH, sw: srcW, sh: srcH }
                });
            }
        }
    }

    createPath(w, h, shape, jitter) {
        const path = new Path2D();
        const t = this.tabSize; 
        path.moveTo(0, 0);
        // Añadimos el jitter al cálculo de la curva
        shape.top !== 0 ? this.lineToTab(path, 0, 0, w, 0, shape.top * t, jitter.top * t) : path.lineTo(w, 0);
        shape.right !== 0 ? this.lineToTab(path, w, 0, w, h, shape.right * t, jitter.right * t) : path.lineTo(w, h);
        shape.bottom !== 0 ? this.lineToTab(path, w, h, 0, h, shape.bottom * t, jitter.bottom * t) : path.lineTo(0, h);
        shape.left !== 0 ? this.lineToTab(path, 0, h, 0, 0, shape.left * t, jitter.left * t) : path.lineTo(0, 0);
        path.closePath();
        return path;
    }

    lineToTab(path, x1, y1, x2, y2, amp, shift) {
        const w = x2 - x1; const h = y2 - y1;
        const cx = x1 + w * 0.5 + (w===0 ? shift : 0); // Jitter aplica desplazamiento perpendicular
        const cy = y1 + h * 0.5 + (h===0 ? shift : 0);
        const perpX = -h / Math.abs(h || 1); const perpY = w / Math.abs(w || 1);
        const xA = x1 + w * 0.35; const yA = y1 + h * 0.35;
        const xB = x1 + w * 0.65; const yB = y1 + h * 0.65;

        path.lineTo(xA, yA);
        path.bezierCurveTo(xA + (perpX * amp * 0.2), yA + (perpY * amp * 0.2), cx - (w * 0.1) + (perpX * amp), cy - (h * 0.1) + (perpY * amp), cx + (perpX * amp), cy + (perpY * amp));
        path.bezierCurveTo(cx + (w * 0.1) + (perpX * amp), cy + (h * 0.1) + (perpY * amp), xB + (perpX * amp * 0.2), yB + (perpY * amp * 0.2), xB, yB);
        path.lineTo(x2, y2);
    }

    /* --- RENDERING & PARTICLES --- */
    render() {
        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        // 1. Vista Previa (Fantasma)
        if (this.showPreview) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.3;
            this.ctx.drawImage(this.img, 0, 0, this.logicalWidth, this.logicalHeight);
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

        // 2. Renderizar Partículas
        this.updateParticles();
        if (this.particles.length > 0 || this.isDragging) {
            requestAnimationFrame(() => this.render());
        }
    }

    renderPiece(p, type) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(p.currentX, p.currentY);

        if (type !== 'locked') {
            ctx.shadowColor = "rgba(0,0,0,0.3)";
            ctx.shadowBlur = type === 'selected' ? 10 : 3;
            ctx.shadowOffsetY = type === 'selected' ? 5 : 2;
            if (type === 'selected') {
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.05, 1.05);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }
        } else {
            ctx.shadowColor = "transparent";
        }

        ctx.clip(p.path);
        const sX = p.imgData.sw / this.pieceWidth;
        const sY = p.imgData.sh / this.pieceHeight;
        const bleed = this.tabSize * 1.5;

        ctx.drawImage(this.img, p.imgData.sx - (bleed*sX), p.imgData.sy - (bleed*sY), p.imgData.sw + (bleed*2*sX), p.imgData.sh + (bleed*2*sY), -bleed, -bleed, this.pieceWidth+(bleed*2), this.pieceHeight+(bleed*2));
        ctx.restore();

        if (type !== 'locked') {
            ctx.save();
            ctx.translate(p.currentX, p.currentY);
            if (type === 'selected') {
                ctx.translate(this.pieceWidth/2, this.pieceHeight/2);
                ctx.scale(1.05, 1.05);
                ctx.translate(-this.pieceWidth/2, -this.pieceHeight/2);
            }
            ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1.5; ctx.stroke(p.path);
            ctx.strokeStyle = "rgba(0,0,0,0.15)"; ctx.lineWidth = 1; ctx.stroke(p.path);
            ctx.restore();
        }
    }

    /* --- SISTEMA DE PARTÍCULAS --- */
    spawnParticles(x, y, type = 'spark') {
        const count = type === 'confetti' ? 50 : 10;
        const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#ffffff'];
        
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x, y: y,
                vx: (Math.random() - 0.5) * (type === 'confetti' ? 10 : 5),
                vy: (Math.random() - 0.5) * (type === 'confetti' ? 10 : 5),
                life: 1.0,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 4 + 2
            });
        }
        this.render(); // Despierta el loop si estaba quieto
    }

    updateParticles() {
        if (this.particles.length === 0) return;
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.2; // Gravedad
            p.life -= 0.02;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        this.ctx.globalAlpha = 1.0;
    }

    /* --- INPUT & EVENTS --- */
    handleEnd(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        const dist = Math.hypot(this.selectedPiece.currentX - this.selectedPiece.correctX, this.selectedPiece.currentY - this.selectedPiece.correctY);
        
        if (dist < this.pieceWidth * 0.3) {
            this.selectedPiece.currentX = this.selectedPiece.correctX;
            this.selectedPiece.currentY = this.selectedPiece.correctY;
            this.selectedPiece.isLocked = true;
            this.spawnParticles(this.selectedPiece.currentX + this.pieceWidth/2, this.selectedPiece.currentY + this.pieceHeight/2, 'spark');
            if(this.callbacks.onSound) this.callbacks.onSound('snap');
            
            // GUARDADO AUTOMÁTICO AL SOLTAR
            if(this.callbacks.onStateChange) this.callbacks.onStateChange();
            this.checkVictory();
        } else {
            // Guardar también si la mueve y la deja suelta
            if(this.callbacks.onStateChange) this.callbacks.onStateChange();
        }

        this.isDragging = false;
        this.selectedPiece = null;
        requestAnimationFrame(() => this.render());
    }
    
    // (handleStart, handleMove, getPointerPos, resizeCanvas, etc. similares a V5 pero adaptados a Jitter)
    // Se omiten por brevedad pero están incluidos implícitamente en la estructura de clase completa
    // IMPORTANTE: Asegúrate de copiar las funciones handleStart, handleMove y getPointerPos de la V5 anterior
    // ya que no cambian drásticamente, solo usan la lógica de BoundingBox.
    
    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }
    handleStart(e) {
        e.preventDefault(); const { x, y } = this.getPointerPos(e);
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            const p = this.pieces[i]; if (p.isLocked) continue;
            const m = this.tabSize * 1.5;
            if (x >= p.currentX - m && x <= p.currentX + this.pieceWidth + m && y >= p.currentY - m && y <= p.currentY + this.pieceHeight + m) {
                this.selectedPiece = p; this.isDragging = true;
                this.dragOffsetX = x - p.currentX; this.dragOffsetY = y - p.currentY;
                this.pieces.splice(i, 1); this.pieces.push(p);
                if(this.callbacks.onSound) this.callbacks.onSound('click');
                requestAnimationFrame(() => this.render()); return;
            }
        }
    }
    handleMove(e) {
        if (!this.isDragging || !this.selectedPiece) return;
        e.preventDefault(); const { x, y } = this.getPointerPos(e);
        this.selectedPiece.currentX = x - this.dragOffsetX;
        this.selectedPiece.currentY = y - this.dragOffsetY;
        requestAnimationFrame(() => this.render());
    }

    shufflePieces() {
        this.pieces.forEach(p => {
            p.currentX = Math.random() * (this.logicalWidth - this.pieceWidth);
            p.currentY = Math.random() * (this.logicalHeight - this.pieceHeight);
            p.isLocked = false;
        });
        this.render();
    }
    resizeCanvas() {
        const parent = this.canvas.parentElement;
        const maxWidth = parent.clientWidth; const maxHeight = parent.clientHeight;
        const imgRatio = this.img.width / this.img.height;
        let cssWidth = maxWidth; let cssHeight = cssWidth / imgRatio;
        if (cssHeight > maxHeight) { cssHeight = maxHeight; cssWidth = cssHeight * imgRatio; }
        cssWidth *= 0.85; cssHeight *= 0.85;
        this.canvas.width = cssWidth * this.dpr; this.canvas.height = cssHeight * this.dpr;
        this.canvas.style.width = `${cssWidth}px`; this.canvas.style.height = `${cssHeight}px`;
        this.ctx.scale(this.dpr, this.dpr);
        this.logicalWidth = cssWidth; this.logicalHeight = cssHeight;
        this.pieceWidth = this.logicalWidth / this.gridSize; this.pieceHeight = this.logicalHeight / this.gridSize;
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * 0.20;
    }

    checkVictory() {
        if (this.pieces.every(p => p.isLocked)) {
            // CONFETTI EXPLOSION
            this.spawnParticles(this.logicalWidth/2, this.logicalHeight/2, 'confetti');
            if(this.callbacks.onSound) this.callbacks.onSound('win');
            if(this.callbacks.onWin) setTimeout(this.callbacks.onWin, 1500); // Dar tiempo al confetti
            
            // Limpiar eventos pero dejar render para partículas
            this.canvas.removeEventListener('mousedown', this.handleStart);
            this.canvas.removeEventListener('touchstart', this.handleStart);
        }
    }
    // addEventListeners y destroy igual que V5
    addEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleStart); window.addEventListener('mousemove', this.handleMove); window.addEventListener('mouseup', this.handleEnd);
        this.canvas.addEventListener('touchstart', this.handleStart, { passive: false }); window.addEventListener('touchmove', this.handleMove, { passive: false }); window.addEventListener('touchend', this.handleEnd);
    }
    destroy() {
        this.canvas.removeEventListener('mousedown', this.handleStart); window.removeEventListener('mousemove', this.handleMove); window.removeEventListener('mouseup', this.handleEnd);
        this.canvas.removeEventListener('touchstart', this.handleStart); window.removeEventListener('touchmove', this.handleMove); window.removeEventListener('touchend', this.handleEnd);
    }
}
