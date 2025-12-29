/**
 * PuzzleEngine.js
 * Motor gráfico basado en Canvas 2D.
 * Gestiona el ciclo de renderizado, input de usuario y lógica de puzzle.
 *
 * Cambios principales:
 * - Las piezas ya no se dibujan como rectángulos simples: ahora usan Path2D con
 *   "tabs" (entrantes/salientes) para dar la forma clásica de rompecabezas.
 * - Hit-test usa isPointInPath para respetar la forma visual.
 * - Clip + drawImage por pieza usando la forma Path2D (masking).
 * - Se añaden sombras/outline al seleccionar para mejorar percepción de "elevación".
 */

export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d');

        // Configuración
        this.img = config.image; // Objeto Image() ya cargado
        this.gridSize = Math.sqrt(config.pieces); // Ej: 9 piezas -> 3x3
        this.callbacks = callbacks || {}; // { onWin, onSound }

        // Estado
        this.pieces = [];
        this.selectedPiece = null;
        this.isDragging = false;

        // Dimensiones lógicas vs Físicas
        this.pieceWidth = 0;
        this.pieceHeight = 0;
        this.scale = 1;

        // Input tracking
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Binds para no perder contexto 'this'
        this.handleStart = this.handleStart.bind(this);
        this.handleMove = this.handleMove.bind(this);
        this.handleEnd = this.handleEnd.bind(this);
        this.handleResize = this.handleResize.bind(this);

        // Parámetros configurables (tweakables)
        this.tabSizeRatio = 0.18; // tamaño de las pestañas respecto al tamaño de la pieza
        this.snapThresholdRatio = 0.30; // umbral de imantación (proporción)

        this.init();
    }

    init() {
        this.resizeCanvas();
        this.createPieces();
        this.shufflePieces();
        this.addEventListeners();
        this.render(); // Primer render estático
    }

    handleResize() {
        this.resizeCanvas();
        // Recompute piece paths on resize via createPieces (but keep progress)
        this.recomputePieceMetrics();
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

        finalWidth *= 0.95;
        finalHeight *= 0.95;

        this.canvas.width = Math.round(finalWidth);
        this.canvas.height = Math.round(finalHeight);

        this.pieceWidth = this.canvas.width / this.gridSize;
        this.pieceHeight = this.canvas.height / this.gridSize;

        this.scaleX = this.img.width / this.canvas.width;
        this.scaleY = this.img.height / this.canvas.height;
    }

    recomputePieceMetrics() {
        // Recalc sx/sy based on original img and grid
        const srcPieceW = this.img.width / this.gridSize;
        const srcPieceH = this.img.height / this.gridSize;
        this.pieces.forEach(p => {
            p.sx = p.correctCol * srcPieceW;
            p.sy = p.correctRow * srcPieceH;
        });
    }

    createPieces() {
        // Generate pieces with classic jigsaw edges (top/right/bottom/left)
        this.pieces = [];
        // We'll assign edges consistent between neighbors.
        // Edges: -1 = tab in, 0 = flat, 1 = tab out
        const randEdge = () => (Math.random() > 0.5 ? 1 : -1);

        // Temporary 2D array to hold edges for neighbor consistency
        const edgesGrid = Array.from({ length: this.gridSize }, () =>
            Array.from({ length: this.gridSize }, () => ({ top: 0, right: 0, bottom: 0, left: 0 }))
        );

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                // Top edge
                if (row === 0) {
                    edgesGrid[row][col].top = 0;
                } else {
                    // Opposite of the bottom of the piece above
                    edgesGrid[row][col].top = -edgesGrid[row - 1][col].bottom;
                }

                // Left edge
                if (col === 0) {
                    edgesGrid[row][col].left = 0;
                } else {
                    edgesGrid[row][col].left = -edgesGrid[row][col - 1].right;
                }

                // Right edge (if border -> 0 else random)
                if (col === this.gridSize - 1) {
                    edgesGrid[row][col].right = 0;
                } else {
                    // random for now; will be mirrored by neighbor's left when neighbor processed
                    edgesGrid[row][col].right = randEdge();
                }

                // Bottom edge (if border -> 0 else random)
                if (row === this.gridSize - 1) {
                    edgesGrid[row][col].bottom = 0;
                } else {
                    edgesGrid[row][col].bottom = randEdge();
                }
            }
        }

        // Now create piece objects
        const srcPieceW = this.img.width / this.gridSize;
        const srcPieceH = this.img.height / this.gridSize;

        for (let row = 0; row < this.gridSize; row++) {
            for (let col = 0; col < this.gridSize; col++) {
                const e = edgesGrid[row][col];
                const piece = {
                    correctCol: col,
                    correctRow: row,
                    currentX: 0,
                    currentY: 0,
                    isLocked: false,
                    sx: col * srcPieceW,
                    sy: row * srcPieceH,
                    edges: { top: e.top, right: e.right, bottom: e.bottom, left: e.left }
                    // note: path is generated on-demand (createPiecePath)
                };
                this.pieces.push(piece);
            }
        }
    }

    shufflePieces() {
        // Dispersar piezas aleatoriamente dentro del canvas
        this.pieces.forEach(p => {
            // Avoid putting piece exactly on target:
            p.currentX = Math.random() * (this.canvas.width - this.pieceWidth);
            p.currentY = Math.random() * (this.canvas.height - this.pieceHeight);
            p.isLocked = false;
        });
        this.render();
    }

    /* --- UTILS: forma de pieza (Path2D) y dibujo --- */

    // Crea un Path2D absoluto (coordenadas en espacio canvas) para la pieza p
    createPiecePath(p, withOffset = { x: 0, y: 0 }) {
        const pw = this.pieceWidth;
        const ph = this.pieceHeight;
        const x = p.currentX + (withOffset.x || 0);
        const y = p.currentY + (withOffset.y || 0);

        const tabW = Math.min(pw, ph) * this.tabSizeRatio;
        const tabH = Math.min(pw, ph) * this.tabSizeRatio;

        const path = new Path2D();

        // Start at top-left corner
        path.moveTo(x, y);

        // TOP edge: left -> right
        this._addEdgeToPath(path, x, y, 'top', p.edges.top, pw, ph, tabW, tabH);

        // RIGHT edge
        this._addEdgeToPath(path, x + pw, y, 'right', p.edges.right, pw, ph, tabW, tabH);

        // BOTTOM edge
        this._addEdgeToPath(path, x + pw, y + ph, 'bottom', p.edges.bottom, pw, ph, tabW, tabH);

        // LEFT edge
        this._addEdgeToPath(path, x, y + ph, 'left', p.edges.left, pw, ph, tabW, tabH);

        path.closePath();
        return path;
    }

    // Añade un lado al path. sidePoint es el corner start point (x,y) correspondiente.
    _addEdgeToPath(path, startX, startY, side, dir, pw, ph, tabW, tabH) {
        // dir: -1 (tab in), 0 (flat), 1 (tab out)
        // We'll draw the edge going clockwise: top -> right -> bottom -> left
        // For each side, compute coordinates of cubic Bezier tab centered in middle third.

        // Helper to compute points relative to the start point depending on side
        const thirdX = pw / 3;
        const thirdY = ph / 3;

        if (side === 'top') {
            // start at (startX, startY) which is top-left
            // line to 1/3
            path.lineTo(startX + thirdX, startY);
            if (dir === 0) {
                path.lineTo(startX + 2 * thirdX, startY);
            } else {
                // tab centered between thirdX and 2*thirdX
                const cx = startX + pw / 2;
                const cy = startY;
                const out = dir === 1; // true -> outwards (up), false -> inwards (down)
                const controlY = cy + (out ? -tabH : tabH);
                // Left half curve
                path.bezierCurveTo(
                    startX + thirdX + tabW * 0.2, startY,
                    cx - tabW * 0.6, controlY,
                    cx, controlY
                );
                // Right half curve
                path.bezierCurveTo(
                    cx + tabW * 0.6, controlY,
                    startX + 2 * thirdX - tabW * 0.2, startY,
                    startX + 2 * thirdX, startY
                );
            }
            path.lineTo(startX + pw, startY); // move to top-right corner
        } else if (side === 'right') {
            // start at top-right corner (startX, startY)
            path.lineTo(startX, startY + thirdY);
            if (dir === 0) {
                path.lineTo(startX, startY + 2 * thirdY);
            } else {
                const cx = startX;
                const cy = startY + ph / 2;
                const out = dir === 1; // outwards to right
                const controlX = cx + (out ? tabW : -tabW);
                path.bezierCurveTo(
                    cx, startY + thirdY + tabH * 0.2,
                    controlX, cy - tabH * 0.6,
                    controlX, cy
                );
                path.bezierCurveTo(
                    controlX, cy + tabH * 0.6,
                    cx, startY + 2 * thirdY - tabH * 0.2,
                    cx, startY + 2 * thirdY
                );
            }
            path.lineTo(startX, startY + ph); // bottom-right corner
        } else if (side === 'bottom') {
            // start at bottom-right corner (startX, startY)
            path.lineTo(startX - thirdX, startY);
            if (dir === 0) {
                path.lineTo(startX - 2 * thirdX, startY);
            } else {
                const cx = startX - pw / 2;
                const cy = startY;
                const out = dir === 1; // outwards down
                const controlY = cy + (out ? tabH : -tabH);
                path.bezierCurveTo(
                    startX - thirdX - tabW * 0.2, startY,
                    cx + tabW * 0.6, controlY,
                    cx, controlY
                );
                path.bezierCurveTo(
                    cx - tabW * 0.6, controlY,
                    startX - 2 * thirdX + tabW * 0.2, startY,
                    startX - 2 * thirdX, startY
                );
            }
            path.lineTo(startX - pw, startY); // bottom-left corner
        } else if (side === 'left') {
            // start at bottom-left corner (startX, startY)
            path.lineTo(startX, startY - thirdY);
            if (dir === 0) {
                path.lineTo(startX, startY - 2 * thirdY);
            } else {
                const cx = startX;
                const cy = startY - ph / 2;
                const out = dir === 1; // outwards left
                const controlX = cx + (out ? -tabW : tabW);
                path.bezierCurveTo(
                    cx, startY - thirdY - tabH * 0.2,
                    controlX, cy + tabH * 0.6,
                    controlX, cy
                );
                path.bezierCurveTo(
                    controlX, cy - tabH * 0.6,
                    cx, startY - 2 * thirdY + tabH * 0.2,
                    cx, startY - 2 * thirdY
                );
            }
            path.lineTo(startX, startY - ph); // back to top-left corner
        }
    }

    /* --- INPUT HANDLING (Touch & Mouse unificados) --- */

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

        // Buscar si tocamos una pieza (iterar al revés para agarrar la de arriba)
        for (let i = this.pieces.length - 1; i >= 0; i--) {
            const p = this.pieces[i];
            if (p.isLocked) continue; // No mover piezas ya colocadas

            // Use Path2D hit test for accurate shape interaction
            const path = this.createPiecePath(p);
            if (this.ctx.isPointInPath(path, x, y)) {
                this.selectedPiece = p;
                this.isDragging = true;

                // Offset para agarrar la pieza desde donde se hizo click
                this.dragOffsetX = x - p.currentX;
                this.dragOffsetY = y - p.currentY;

                // Traer al frente (mover al final del array)
                this.pieces.splice(i, 1);
                this.pieces.push(p);

                if (this.callbacks.onSound) this.callbacks.onSound('click');
                this.render();
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

        this.render();
    }

    handleEnd(e) {
        if (!this.isDragging || !this.selectedPiece) return;

        // Lógica Snap-to-Grid (por centro objetivo)
        const targetX = this.selectedPiece.correctCol * this.pieceWidth;
        const targetY = this.selectedPiece.correctRow * this.pieceHeight;

        const dist = Math.hypot(this.selectedPiece.currentX - targetX, this.selectedPiece.currentY - targetY);
        const snapThreshold = Math.min(this.pieceWidth, this.pieceHeight) * this.snapThresholdRatio;

        if (dist < snapThreshold) {
            // Smooth snap animation (simple)
            this._animateSnap(this.selectedPiece, targetX, targetY, () => {
                this.selectedPiece.isLocked = true;
                if (this.callbacks.onSound) this.callbacks.onSound('snap');
                this.checkVictory();
            });
        }

        this.isDragging = false;
        this.selectedPiece = null;
        this.render();
    }

    // Simple linear animation for snap (non-blocking)
    _animateSnap(piece, toX, toY, cb) {
        const fromX = piece.currentX;
        const fromY = piece.currentY;
        const duration = 140;
        const start = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - start) / duration);
            // easeOutQuad
            const eased = 1 - (1 - t) * (1 - t);
            piece.currentX = fromX + (toX - fromX) * eased;
            piece.currentY = fromY + (toY - fromY) * eased;
            this.render();
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                piece.currentX = toX;
                piece.currentY = toY;
                if (cb) cb();
            }
        };
        requestAnimationFrame(step);
    }

    /* --- RENDER LOOP --- */

    render() {
        // Limpiar canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1. Dibujar "Grid Fantasma" (Guía visual tenue)
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let i = 0; i <= this.gridSize; i++) {
            this.ctx.moveTo(i * this.pieceWidth, 0);
            this.ctx.lineTo(i * this.pieceWidth, this.canvas.height);
            this.ctx.moveTo(0, i * this.pieceHeight);
            this.ctx.lineTo(this.canvas.width, i * this.pieceHeight);
        }
        this.ctx.stroke();
        this.ctx.restore();

        // 2. Dibujar Piezas: dibujamos de abajo a arriba (order in array)
        for (let idx = 0; idx < this.pieces.length; idx++) {
            const p = this.pieces[idx];

            // Build shape path for this piece
            const path = this.createPiecePath(p);

            // If selected: add shadow + slightly larger stroke
            if (p === this.selectedPiece) {
                this.ctx.save();
                this.ctx.shadowColor = 'rgba(0,0,0,0.45)';
                this.ctx.shadowBlur = 16;
            } else {
                this.ctx.save();
                this.ctx.shadowBlur = 0;
            }

            // Clip to piece shape and draw the corresponding image region
            this.ctx.save();
            this.ctx.clip(path);

            // Map source image region to piece area:
            // Source size
            const srcW = this.img.width / this.gridSize;
            const srcH = this.img.height / this.gridSize;

            // Draw image clipped
            this.ctx.drawImage(
                this.img,
                p.sx, p.sy, srcW, srcH, // Source
                p.currentX, p.currentY, this.pieceWidth, this.pieceHeight // Dest
            );
            this.ctx.restore(); // restore after clip

            // Draw outline of piece
            this.ctx.strokeStyle = p === this.selectedPiece ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.6)';
            this.ctx.lineWidth = p === this.selectedPiece ? 2.5 : 1.2;
            this.ctx.stroke(path);

            this.ctx.restore(); // restore for next piece
        }
    }

    checkVictory() {
        const allLocked = this.pieces.every(p => p.isLocked);
        if (allLocked) {
            if (this.callbacks.onSound) this.callbacks.onSound('win');
            setTimeout(() => {
                if (this.callbacks.onWin) this.callbacks.onWin();
            }, 300);
            this.removeEventListeners();
        }
    }

    addEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleStart);
        this.canvas.addEventListener('mousemove', this.handleMove);
        window.addEventListener('mouseup', this.handleEnd);

        this.canvas.addEventListener('touchstart', this.handleStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handleMove, { passive: false });
        window.addEventListener('touchend', this.handleEnd);

        // Resize observer to adjust canvas when parent changes size
        if (!this._resizeObserver && typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(this.handleResize);
            this._resizeObserver.observe(this.canvas.parentElement);
        }
    }

    removeEventListeners() {
        this.canvas.removeEventListener('mousedown', this.handleStart);
        this.canvas.removeEventListener('mousemove', this.handleMove);
        window.removeEventListener('mouseup', this.handleEnd);

        this.canvas.removeEventListener('touchstart', this.handleStart);
        this.canvas.removeEventListener('touchmove', this.handleMove);
        window.removeEventListener('touchend', this.handleEnd);

        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    }

    destroy() {
        this.removeEventListeners();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
}
