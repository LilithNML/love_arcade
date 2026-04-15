export class PuzzleEngine {
    constructor(canvasElement, config, callbacks) {
        this.canvas = canvasElement;
        this.debug = Boolean(config?.debug || window.__PUZZLE_DEBUG__);

        // ── Contexto principal ────────────────────────────────────────────────
        // alpha: false evita que el compositor mezcle el canal alfa del canvas
        // con los capas del DOM en cada frame, reduciendo el coste de composición
        // en GPU en ~15% en Chromium.
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        _applySmoothing(this.ctx);

        // config.image puede ser un HTMLImageElement o un ImageBitmap.
        // ImageBitmap (creado en main.js con createImageBitmap) es preferido
        // porque ya está decodificado fuera del hilo principal y su transferencia
        // al sourceCanvas no bloquea la UI.
        this.img      = config.image;
        this.gridSize = Math.sqrt(config.pieces);
        this.callbacks = callbacks || {};

        // ── Buffers offscreen ─────────────────────────────────────────────────
        // staticCanvas  : tablero + piezas encajadas. Se redibujan sólo cuando
        //                 needsStaticUpdate === true (snap, resize, import).
        // sourceCanvas  : imagen completa escalada al tamaño del tablero en DPR.
        //                 Fuente de píxeles para drawImage de cada pieza.
        //                 A partir de v19.0 se rellena mediante step-down scaling
        //                 de alta fidelidad en _buildSourceCanvasHQ().
        // gridCanvas    : rejilla de fondo con parallax, también offscreen.
        this.staticCanvas = document.createElement('canvas');
        this.staticCtx    = this.staticCanvas.getContext('2d', { alpha: true });
        _applySmoothing(this.staticCtx);

        this.sourceCanvas = document.createElement('canvas');
        this.sourceCtx    = this.sourceCanvas.getContext('2d', { alpha: false });
        _applySmoothing(this.sourceCtx);

        this.gridCanvas = document.createElement('canvas');
        this.gridCtx    = this.gridCanvas.getContext('2d');
        _applySmoothing(this.gridCtx);

        this.gridCanvasW = 0;
        this.gridCanvasH = 0;
        this.gridPad     = 0;

        this.needsStaticUpdate = true;

        this.pieces      = [];
        this.lockedPieces = [];
        this.loosePieces  = [];
        this.particles    = [];

        this.snapFlashes = [];
        this.edgePulses  = [];

        this.parallaxX       = 0;
        this.parallaxY       = 0;
        this.targetParallaxX = 0;
        this.targetParallaxY = 0;

        this.blinkDots = [];

        this.selectedPiece = null;
        this.isDragging    = false;
        this.showPreview   = false;

        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this.verticalEdges   = [];
        this.horizontalEdges = [];

        // DPR capado a 3× para renderizar nativamente en pantallas de alta densidad
        // (iPhone 14/15 Pro, Galaxy S-series, Pixel 6/7). El cap en 3 previene
        // consumos extremos en posibles DPR futuros (>3×) sin afectar ningún
        // dispositivo comercial actual. El coste de VRAM se amortiza por el
        // imageamiento 1:1 que elimina el escalado por software; ver resizeCanvas().
        this.dpr = Math.min(window.devicePixelRatio || 1, 3);

        this.isMobilePortrait = false;

        this.isLoopRunning = false;
        this._idleWakeCount = 0;
        this._layoutRetryRaf = null;
        this._layoutRetryAttempts = 0;
        this._invalidFrameReason = null;

        this.shadowBlur    = 0;
        this.particleLimit = this.gridSize >= 8 ? 20 : 50;

        this.handleStart    = this.handleStart.bind(this);
        this.handleMove     = this.handleMove.bind(this);
        this.handleEnd      = this.handleEnd.bind(this);
        this.handleResize   = this.handleResize.bind(this);
        this._onOrientation = this._onOrientation.bind(this);
        this._onVisibilityChange = this._onVisibilityChange.bind(this);

        this.init();
    }

    init() {
        this.resizeCanvas();
        this.buildGridCanvas();
        this._ensureLayoutReady('init');
        this.generateBlinkDots();
        this.generateSharedTopology();
        this.createPieces();
        this.shufflePieces();
        this.addEventListeners();
        this.wakeUp();

        this._idleTimer = setInterval(() => {
            if (!this.isLoopRunning) {
                this._idleWakeCount = 70;
                this.wakeUp();
            }
        }, 5000);
    }

    wakeUp() {
        if (!this.isLoopRunning) {
            this.isLoopRunning = true;
            this.animate();
        }
    }

    animate() {
        if (this._idleWakeCount > 0) this._idleWakeCount--;

        const canStop =
            !this.isDragging &&
            this.particles.length   === 0 &&
            this.snapFlashes.length === 0 &&
            this.edgePulses.length  === 0 &&
            this._idleWakeCount     <= 0  &&
            !this.needsStaticUpdate &&
            !this.showPreview;

        if (canStop) {
            this.isLoopRunning = false;
            return;
        }

        this.render();
        requestAnimationFrame(() => this.animate());
    }

    handleResize() {
        const oldW = this.logicalWidth  || 1;
        const oldH = this.logicalHeight || 1;

        this.resizeCanvas();
        if (!this._hasValidLogicalSize()) {
            this._logSkippedFrame('resize_invalid_logical_size', {
                logicalWidth: this.logicalWidth,
                logicalHeight: this.logicalHeight
            });
            this._ensureLayoutReady('resize');
            return;
        }

        this.buildGridCanvas();
        this.generateBlinkDots();
        this.createPiecesPathsOnly();

        const scaleX = this.logicalWidth  / oldW;
        const scaleY = this.logicalHeight / oldH;

        for (const p of this.loosePieces) {
            if (!p.isLocked) {
                p.currentX *= scaleX;
                p.currentY *= scaleY;
                this.clampPosition(p);
            }
        }

        this.updatePieceCaches();
        this.needsStaticUpdate = true;
        this.wakeUp();
    }

    _hasValidLogicalSize() {
        return Number.isFinite(this.logicalWidth) &&
            Number.isFinite(this.logicalHeight) &&
            this.logicalWidth > 0 &&
            this.logicalHeight > 0;
    }

    _ensureLayoutReady(reason = 'unknown') {
        if (this._hasValidLogicalSize()) {
            if (this._layoutRetryRaf) {
                cancelAnimationFrame(this._layoutRetryRaf);
                this._layoutRetryRaf = null;
            }
            this._layoutRetryAttempts = 0;
            return;
        }
        if (this._layoutRetryRaf) return;

        const maxAttempts = 60;
        const retry = () => {
            this._layoutRetryRaf = null;
            this._layoutRetryAttempts++;
            this.resizeCanvas();

            if (this._hasValidLogicalSize()) {
                this.buildGridCanvas();
                this.generateBlinkDots();
                if (this.pieces.length > 0) {
                    this.createPiecesPathsOnly();
                    this.updatePieceCaches();
                }
                this.needsStaticUpdate = true;
                this._layoutRetryAttempts = 0;
                this.wakeUp();
                this._debugLog('layout_recovered', { reason });
                return;
            }

            this._logSkippedFrame('layout_retry_pending', {
                reason,
                attempt: this._layoutRetryAttempts,
                logicalWidth: this.logicalWidth,
                logicalHeight: this.logicalHeight
            });

            if (this._layoutRetryAttempts < maxAttempts) {
                this._layoutRetryRaf = requestAnimationFrame(retry);
            } else {
                this._debugLog('layout_retry_exhausted', {
                    reason,
                    attempts: this._layoutRetryAttempts
                });
                this._layoutRetryAttempts = 0;
            }
        };

        this._layoutRetryRaf = requestAnimationFrame(retry);
    }

    _debugLog(event, details = {}) {
        if (!this.debug) return;
        console.debug(`[PuzzleEngine] ${event}`, details);
    }

    _logSkippedFrame(reason, details = {}) {
        if (this._invalidFrameReason === reason) return;
        this._invalidFrameReason = reason;
        this._debugLog('frame_skipped', { reason, ...details });
    }

    /**
     * Configura las dimensiones físicas (DPR) y lógicas de todos los canvases,
     * y escala la imagen al tamaño del tablero en el sourceCanvas.
     *
     * Alineación a la rejilla — pixel-perfect (v18.0, sin cambios en v19.0):
     *   El tablero se recorta al múltiplo inmediatamente inferior de `gridSize`
     *   mediante `Math.floor(cssW / gridSize) * gridSize`. Esto garantiza que:
     *
     *     pieceWidth  = boardWidth  / gridSize  →  entero exacto (sin residuo)
     *     pieceHeight = boardHeight / gridSize  →  entero exacto
     *     correctX    = boardX + col * pieceWidth  → entero (boardX es Math.round)
     *     correctY    = boardY + row * pieceHeight → entero
     *
     *   El sourceCanvas se alinea de la misma forma en el espacio físico:
     *     sourceCanvas.width  = Math.round(boardWidth  × DPR / gridSize) × gridSize
     *     sourceCanvas.height = Math.round(boardHeight × DPR / gridSize) × gridSize
     *
     *   Así srcPieceW_SC = sourceCanvas.width / gridSize es también un entero
     *   exacto, eliminando el muestreo sub-píxel en renderPieceToContext().
     *
     *   En DPR no-entero (e.g. 2.625×), el `Math.round` antes del snap absorbe
     *   el residuo fraccional sin perder más de medio píxel físico.
     *
     * Protección de VRAM — límite de 1600 px (v19.1):
     *   En dispositivos con DPR 3× y tablero grande, boardWidth × DPR puede
     *   superar los 1600 px nativos de la imagen fuente, asignando VRAM para
     *   píxeles inexistentes en el original. El cap en MAX_SRC_PX = 1600 evita
     *   este desbordamiento. El valor limitado se redondea hacia abajo al
     *   múltiplo de gridSize más cercano (Math.floor), preservando la propiedad
     *   pixel-perfect. Ver el bloque de comentario en resizeCanvas() para el
     *   razonamiento completo.
     *
     * Relleno del sourceCanvas — step-down scaling (v19.0, sin cambios en v19.1):
     *   La imagen nativa 1600×1600 ya no se vierte en un único drawImage al
     *   tamaño final (que causaba el blur bilineal). En su lugar,
     *   `_buildSourceCanvasHQ()` reduce la textura de forma escalonada,
     *   nunca más del 50% por paso, hasta alcanzar las dimensiones del
     *   sourceCanvas. Ver el método para el análisis completo.
     *
     * Calidad de imagen:
     *   `_applySmoothing(ctx)` se reaplica después de cada cambio de dimensión
     *   porque `canvas.width = N` resetea el contexto 2D a sus valores por defecto
     *   (`imageSmoothingQuality = 'low'`). La interpolación bicúbica ('high') es
     *   necesaria tanto en los pasos intermedios del step-down como en el paso
     *   final al tamaño del tablero.
     */
    resizeCanvas() {
        const parent   = this.canvas.parentElement;
        const w        = parent.clientWidth;
        const h        = parent.clientHeight;
        const imgRatio = this.img.width / this.img.height;

        // Canvas principal
        this.canvas.width  = w * this.dpr;
        this.canvas.height = h * this.dpr;
        this.canvas.style.width  = '100%';
        this.canvas.style.height = '100%';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
        _applySmoothing(this.ctx);

        // Canvas estático (tablero + encajadas)
        this.staticCanvas.width  = this.canvas.width;
        this.staticCanvas.height = this.canvas.height;
        this.staticCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.staticCtx.scale(this.dpr, this.dpr);
        _applySmoothing(this.staticCtx);

        this.logicalWidth  = w;
        this.logicalHeight = h;

        const isMobilePortrait = w < h && w < 520;
        this.isMobilePortrait  = isMobilePortrait;

        let cssW, cssH;

        if (isMobilePortrait) {
            cssW = w * 0.97;
            cssH = cssW / imgRatio;
            const maxH = h * 0.68;
            if (cssH > maxH) { cssH = maxH; cssW = cssH * imgRatio; }
        } else {
            cssW = w; cssH = w / imgRatio;
            if (cssH > h) { cssH = h; cssW = cssH * imgRatio; }
            cssW *= 0.65; cssH *= 0.65;
        }

        // ── Alineación pixel-perfect a la rejilla ─────────────────────────
        // Truncar cssW/cssH al múltiplo inferior de gridSize para que
        // pieceWidth y pieceHeight sean enteros exactos sin residuo decimal.
        this.boardWidth  = Math.floor(cssW / this.gridSize) * this.gridSize;
        this.boardHeight = Math.floor(cssH / this.gridSize) * this.gridSize;
        this.boardX = Math.round((w - this.boardWidth)  / 2);
        this.boardY = isMobilePortrait ? 8 : Math.round((h - this.boardHeight) / 2);

        this.pieceWidth  = this.boardWidth  / this.gridSize;  // entero exacto
        this.pieceHeight = this.boardHeight / this.gridSize;  // entero exacto
        this.tabSize     = Math.min(this.pieceWidth, this.pieceHeight) * 0.25;

        // ── sourceCanvas alineado al espacio físico de la rejilla ─────────
        // Math.round neutraliza el residuo de DPR no-entero (ej. 2.625×).
        // El snap posterior al múltiplo de gridSize garantiza que
        // sourceCanvas.width / gridSize sea un entero exacto, eliminando
        // el muestreo sub-píxel en drawImage() dentro de renderPieceToContext.
        //
        // Protección de VRAM — límite de 1600 px (v19.1):
        //   En dispositivos con DPR 3× y tablero grande (ej. 600px CSS),
        //   boardWidth * dpr = 1800 px, lo que generaría un sourceCanvas
        //   de 1800×1800 px = ~12 MB de VRAM, superando la resolución
        //   nativa de la imagen fuente (1600×1600) sin aportar información
        //   visual adicional. El cap evita este despilfarro:
        //     a) Se calcula el valor natural (rawSrcW/rawSrcH).
        //     b) Si supera MAX_SRC_PX, se recorta al múltiplo inferior de
        //        gridSize ≤ MAX_SRC_PX, preservando la propiedad pixel-perfect.
        //     c) El cap se aplica con Math.floor (no Math.round) para
        //        garantizar que el resultado nunca supere MAX_SRC_PX.
        //   Efecto neto: el sourceCanvas nunca excede la resolución de la
        //   imagen fuente, y cualquier dimensión resultante sigue siendo
        //   un múltiplo exacto de gridSize.
        const MAX_SRC_PX = 1600;
        const rawSrcW = Math.round(this.boardWidth  * this.dpr / this.gridSize) * this.gridSize;
        const rawSrcH = Math.round(this.boardHeight * this.dpr / this.gridSize) * this.gridSize;
        const srcW = rawSrcW > MAX_SRC_PX
            ? Math.floor(MAX_SRC_PX / this.gridSize) * this.gridSize
            : rawSrcW;
        const srcH = rawSrcH > MAX_SRC_PX
            ? Math.floor(MAX_SRC_PX / this.gridSize) * this.gridSize
            : rawSrcH;
        this.sourceCanvas.width  = srcW;
        this.sourceCanvas.height = srcH;
        _applySmoothing(this.sourceCtx);
        this.sourceCtx.clearRect(0, 0, srcW, srcH);

        // ── Relleno del sourceCanvas con step-down scaling (v19.1) ────────
        // Sustituye el anterior drawImage directo (1600→srcW en un solo paso)
        // que causaba blur bilineal y pérdida colorimétrica. Ver
        // _buildSourceCanvasHQ() para el análisis completo del algoritmo.
        this._buildSourceCanvasHQ(this.img, srcW, srcH);

        this.needsStaticUpdate = true;
    }

    /**
     * Rellena el sourceCanvas con la textura escalada mediante step-down
     * (reducción escalonada) para preservar la máxima fidelidad visual.
     *
     * PROBLEMA QUE RESUELVE
     * ─────────────────────
     * El método `drawImage(img, 0, 0, srcW, srcH)` en un solo paso aplica
     * interpolación bilineal al reducir la imagen. Bilineal toma 4 píxeles
     * vecinos por cada píxel destino y los promedia con pesos lineales.
     * Cuando la ratio de reducción supera 2:1 (ej. 1600→600 = 2.67:1),
     * el muestreo bilineal salta píxeles de la fuente, resultando en:
     *   • Aliasing en líneas diagonales y bordes duros (anime, ilustración).
     *   • Desaturación generalizada: el promediado diluye los colores.
     *   • "Ruido de mosquito": rebote de alta frecuencia no atenuado entre
     *     el kernel y los píxeles descartados.
     *   • Blur generalizado: pérdida de energía de alta frecuencia.
     *
     * SOLUCIÓN: STEP-DOWN SCALING (reducción escalonada)
     * ───────────────────────────────────────────────────
     * Nunca reducimos más del 50% en un solo paso. Cuando la imagen fuente
     * supera 2× el tamaño destino en cualquier dimensión, la reducimos a la
     * mitad iterativamente en canvases offscreen intermedios hasta quedar
     * dentro de ese umbral. El paso final realiza la reducción residual.
     *
     * Por qué ≤50% es la frontera óptima:
     *   Un filtro bilineal con ratio ≤2:1 es equivalente a un filtro de caja
     *   2×2 (box filter), que es la base del mipmap de nivel 1. A este ratio,
     *   el kernel cubre la mayoría de la señal de alta frecuencia antes de
     *   muestrearla, actuando como un pre-filtro antialiasing. Por encima de
     *   2:1 el filtro empieza a descartar ciclos de frecuencia enteros,
     *   generando los artefactos descritos.
     *
     * Con `imageSmoothingQuality = 'high'` (bicúbico, ya activo en todos los
     * contextos via `_applySmoothing`), cada paso intermedio aplica un kernel
     * bicúbico de 4×4 muestras, equivalente a un filtro paso-bajo Catmull-Rom
     * que preserva la nitidez mientras suprime el aliasing.
     *
     * PRESERVACIÓN DE LA MATEMÁTICA PIXEL-PERFECT
     * ────────────────────────────────────────────
     * Los canvases intermedios no necesitan ser múltiplos de gridSize; sólo
     * son buffers transitorios de paso. La única dimensión que importa para
     * la aritmética pixel-perfect es la final: `srcW` × `srcH`, que ya llega
     * a este método como múltiplo exacto de `gridSize` (garantizado por
     * `resizeCanvas()`). El algoritmo no toca ni modifica `srcW`/`srcH`.
     *
     * LIBERACIÓN DE BUFFERS INTERMEDIOS
     * ───────────────────────────────────
     * Cada canvas intermedio se invalida asignando `width = 0` / `height = 0`
     * inmediatamente después de ser copiado al siguiente paso. Esto libera la
     * textura de VRAM de forma síncrona sin esperar al GC.
     *
     * FALLBACK PARA IMÁGENES YA PEQUEÑAS
     * ────────────────────────────────────
     * Si la imagen fuente ya cabe en 2× el destino en ambas dimensiones
     * (p.ej. DPR 3× con tablero grande), se dibuja directamente sobre el
     * sourceCanvas sin crear ningún intermedio. El suavizado bicúbico
     * garantiza calidad óptima también en este camino.
     *
     * @param {HTMLImageElement|ImageBitmap} img  Textura fuente (1600×1600).
     * @param {number} srcW  Ancho final del sourceCanvas (múltiplo de gridSize, ≤ 1600).
     * @param {number} srcH  Alto  final del sourceCanvas (múltiplo de gridSize, ≤ 1600).
     */
    _buildSourceCanvasHQ(img, srcW, srcH) {
        // Dimensiones intrínsecas de la fuente.
        // HTMLImageElement: naturalWidth/naturalHeight (disponibles post-decode).
        // ImageBitmap:      width/height (siempre definidos).
        // El fallback a 1600 cubre cualquier fuente sin metadatos de dimensión.
        const NW = (img.naturalWidth  || img.width)  || 1600;
        const NH = (img.naturalHeight || img.height) || 1600;

        // ── Camino directo ─────────────────────────────────────────────────
        // La imagen ya cabe en ≤2× el destino en ambas dimensiones.
        // Se dibuja directamente; el bicúbico maneja la reducción final.
        if (NW <= srcW * 2 && NH <= srcH * 2) {
            this.sourceCtx.drawImage(img, 0, 0, srcW, srcH);
            return;
        }

        // ── Step-down: preparar el primer intermedio a tamaño nativo ──────
        // Copiamos la imagen en un canvas del tamaño original para tener
        // una fuente rasterizable independientemente del tipo de `img`.
        let curCanvas = document.createElement('canvas');
        curCanvas.width  = NW;
        curCanvas.height = NH;
        const curCtx0 = curCanvas.getContext('2d');
        _applySmoothing(curCtx0);
        curCtx0.drawImage(img, 0, 0, NW, NH);

        let cw = NW;
        let ch = NH;

        // ── Bucle de reducciones al 50% ────────────────────────────────────
        // Condición: si cualquier dimensión aún supera 2× su destino,
        // se requiere otro paso de halvening. Así nunca hay una reducción
        // superior a 2:1 en ningún eje en el paso siguiente.
        while (cw > srcW * 2 || ch > srcH * 2) {
            // Halving: Math.ceil evita llegar a 0 en dimensiones impares
            // y garantiza que el canvas intermedio sea siempre ≥ 1px.
            const halfW = Math.ceil(cw / 2);
            const halfH = Math.ceil(ch / 2);

            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width  = halfW;
            tmpCanvas.height = halfH;
            const tmpCtx = tmpCanvas.getContext('2d');
            _applySmoothing(tmpCtx);

            // Dibujamos el canvas anterior a la mitad de su tamaño.
            // Con imageSmoothingQuality='high' cada paso aplica bicúbico 4×4,
            // equivalente al mipmap lineal usado en motores de renderizado 3D.
            tmpCtx.drawImage(curCanvas, 0, 0, halfW, halfH);

            // Invalidar el canvas previo para liberar VRAM de inmediato.
            curCanvas.width  = 0;
            curCanvas.height = 0;

            curCanvas = tmpCanvas;
            cw = halfW;
            ch = halfH;
        }

        // ── Paso final: reducción residual al tamaño exacto del sourceCanvas
        // En este punto cw ≤ srcW×2 y ch ≤ srcH×2, por lo que la ratio de
        // reducción no supera 2:1 en ningún eje. El bicúbico produce un
        // resultado limpio sin aliasing ni pérdida colorimétrica.
        this.sourceCtx.drawImage(curCanvas, 0, 0, srcW, srcH);

        // Liberar el último buffer intermedio.
        curCanvas.width  = 0;
        curCanvas.height = 0;
    }

    buildGridCanvas() {
        if (!this._hasValidLogicalSize()) {
            this.gridCanvasW = 0;
            this.gridCanvasH = 0;
            this.gridCanvas.width = 0;
            this.gridCanvas.height = 0;
            this._logSkippedFrame('build_grid_invalid_logical_size', {
                logicalWidth: this.logicalWidth,
                logicalHeight: this.logicalHeight
            });
            return;
        }

        const ext        = 0.12;
        const lw         = this.logicalWidth;
        const lh         = this.logicalHeight;
        this.gridPad     = Math.max(lw, lh) * ext;
        this.gridCanvasW = Math.ceil(lw + this.gridPad * 2);
        this.gridCanvasH = Math.ceil(lh + this.gridPad * 2);

        this.gridCanvas.width  = this.gridCanvasW * this.dpr;
        this.gridCanvas.height = this.gridCanvasH * this.dpr;
        _applySmoothing(this.gridCtx);

        const ctx = this.gridCtx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.gridCanvasW, this.gridCanvasH);

        const cell = 40;

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
        ctx.lineWidth   = 1;

        for (let x = 0; x < this.gridCanvasW; x += cell) {
            ctx.beginPath();
            ctx.moveTo(x + 0.5, 0);
            ctx.lineTo(x + 0.5, this.gridCanvasH);
            ctx.stroke();
        }
        for (let y = 0; y < this.gridCanvasH; y += cell) {
            ctx.beginPath();
            ctx.moveTo(0, y + 0.5);
            ctx.lineTo(this.gridCanvasW, y + 0.5);
            ctx.stroke();
        }
    }

    generateBlinkDots() {
        this.blinkDots = [];
        const cell = 40;

        for (let x = 0; x <= this.gridCanvasW; x += cell) {
            for (let y = 0; y <= this.gridCanvasH; y += cell) {
                if (Math.random() < 0.22) {
                    this.blinkDots.push({
                        x,
                        y,
                        phase: Math.random() * Math.PI * 2,
                        speed: 0.25 + Math.random() * 1.1
                    });
                }
            }
        }
    }

    _updateParallaxTarget(px, py) {
        const cx = this.logicalWidth  / 2;
        const cy = this.logicalHeight / 2;
        this.targetParallaxX = -((px - cx) / cx) * this.logicalWidth  * 0.05;
        this.targetParallaxY = -((py - cy) / cy) * this.logicalHeight * 0.05;
        if (!this.isLoopRunning) this.wakeUp();
    }

    _onOrientation(e) {
        const px = this.logicalWidth  * (0.5 + (e.gamma || 0) / 90  * 0.5);
        const py = this.logicalHeight * (0.5 + (e.beta  || 0) / 180 * 0.5);
        this._updateParallaxTarget(px, py);
        this._ensureLayoutReady('orientation');
    }

    _onVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.handleResize();
            this._ensureLayoutReady('visibility');
        }
    }

    render() {
        if (!this._hasValidLogicalSize()) {
            this._logSkippedFrame('invalid_logical_dimensions', {
                logicalWidth: this.logicalWidth,
                logicalHeight: this.logicalHeight
            });
            this._ensureLayoutReady('render');
            return;
        }
        this._invalidFrameReason = null;

        if (this.needsStaticUpdate) {
            this.updateStaticLayer();
            this.needsStaticUpdate = false;
        }

        this.parallaxX += (this.targetParallaxX - this.parallaxX) * 0.08;
        this.parallaxY += (this.targetParallaxY - this.parallaxY) * 0.08;

        this.ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        this._renderGridLayer();

        this.ctx.drawImage(this.staticCanvas, 0, 0, this.logicalWidth, this.logicalHeight);

        if (this.showPreview) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.28;
            this.ctx.drawImage(
                this.sourceCanvas, 0, 0, this.sourceCanvas.width, this.sourceCanvas.height,
                this.boardX, this.boardY, this.boardWidth, this.boardHeight
            );
            this.ctx.restore();
        }

        for (let i = 0; i < this.loosePieces.length; i++) {
            const p = this.loosePieces[i];
            if (p !== this.selectedPiece) this.renderPieceToContext(this.ctx, p, false);
        }

        if (this.selectedPiece) {
            const p    = this.selectedPiece;
            const dist = Math.hypot(p.currentX - p.correctX, p.currentY - p.correctY);
            if (dist < this.pieceWidth * 0.4) {
                this.ctx.save();
                this.ctx.translate(p.correctX, p.correctY);
                this.ctx.fillStyle   = 'rgba(255,255,255,0.1)';
                this.ctx.fill(p.path);
                this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                this.ctx.lineWidth   = 2;
                this.ctx.stroke(p.path);
                this.ctx.restore();
            }
            this.renderPieceToContext(this.ctx, this.selectedPiece, true);
        }

        this.updateParticles();
        this._updateSnapFlashes();
        this._updateEdgePulses();
    }

    _renderGridLayer() {
        if (this.gridCanvas.width === 0 ||
            this.gridCanvas.height === 0 ||
            this.gridCanvasW <= 0 ||
            this.gridCanvasH <= 0) {
            this._logSkippedFrame('invalid_grid_canvas', {
                width: this.gridCanvas.width,
                height: this.gridCanvas.height,
                gridCanvasW: this.gridCanvasW,
                gridCanvasH: this.gridCanvasH
            });
            return;
        }

        const dx = -this.gridPad + this.parallaxX;
        const dy = -this.gridPad + this.parallaxY;

        this.ctx.drawImage(
            this.gridCanvas,
            0, 0, this.gridCanvasW * this.dpr, this.gridCanvasH * this.dpr,
            dx, dy, this.gridCanvasW, this.gridCanvasH
        );

        const now = performance.now() / 1000;

        for (let i = 0; i < this.blinkDots.length; i++) {
            const d     = this.blinkDots[i];
            const alpha = 0.12 + 0.10 * Math.sin(now * d.speed + d.phase);
            const sx    = Math.round(d.x + dx);
            const sy    = Math.round(d.y + dy);
            if (sx < 0 || sx > this.logicalWidth || sy < 0 || sy > this.logicalHeight) continue;
            this.ctx.fillStyle = `rgba(99,102,241,${alpha.toFixed(2)})`;
            this.ctx.fillRect(sx - 1, sy - 1, 2, 2);
        }
    }

    updateStaticLayer() {
        const ctx = this.staticCtx;
        ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight);

        const bx = Math.round(this.boardX);
        const by = Math.round(this.boardY);
        const bw = Math.round(this.boardWidth);
        const bh = Math.round(this.boardHeight);

        ctx.fillStyle = '#151C2C';
        ctx.fillRect(bx, by, bw, bh);

        ctx.save();
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth   = 1;
        for (let col = 0; col <= this.gridSize; col++) {
            const x = Math.round(bx + col * this.pieceWidth);
            ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x, by + bh); ctx.stroke();
        }
        for (let row = 0; row <= this.gridSize; row++) {
            const y = Math.round(by + row * this.pieceHeight);
            ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx + bw, y); ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = '#6366F1';
        ctx.lineWidth   = 2;
        ctx.strokeRect(bx, by, bw, bh);

        for (let i = 0; i < this.lockedPieces.length; i++) {
            this.renderPieceToContext(ctx, this.lockedPieces[i], false, true);
        }
    }

    renderPieceToContext(ctx, p, isSelected, isStaticRender = false) {
        ctx.save();
        const drawX = Math.round(p.currentX);
        const drawY = Math.round(p.currentY);
        ctx.translate(drawX, drawY);

        if (!isStaticRender && !p.isLocked && isSelected) {
            ctx.translate(this.pieceWidth / 2, this.pieceHeight / 2);
            ctx.scale(1.05, 1.05);
            ctx.translate(-this.pieceWidth / 2, -this.pieceHeight / 2);
        }

        ctx.clip(p.path);

        // ── Coordenadas pixel-perfect para drawImage (v18.0, sin cambios) ──
        //
        // margin: redondeado a entero para que el rectángulo de origen y destino
        //   no caigan entre píxeles físicos. Se calcula en espacio lógico (CSS px).
        //
        // srcMargin: margen escalado al espacio físico del sourceCanvas.
        //   Math.round absorbe el residuo de DPR no-entero (ej. 2.625×).
        //
        // overlapFix: 1px entero en renders estáticos (antes era 0.6 fraccionario).
        //   Elimina la grieta de medio píxel visible entre piezas adyacentes sin
        //   introducir un solapamiento perceptible.
        //
        // srcPieceW/H_SC: enteros exactos garantizados porque sourceCanvas.width/height
        //   son múltiplos de gridSize (ver resizeCanvas()). La división no produce
        //   residuo fraccional.
        //
        // Con todos los argumentos enteros, el navegador realiza un blit 1:1
        // (copia directa de píxeles) sin interpolación, obteniendo la máxima
        // nitidez posible. En renders estáticos se deshabilita además el
        // imageSmoothingEnabled para blindar ese path ante cualquier interpolación
        // de hardware que el driver pudiera aplicar en el drawImage.
        //
        // Nota v19.0: el sourceCanvas ahora contiene una textura de alta fidelidad
        // generada por step-down scaling. La lógica de coordenadas aquí no cambia;
        // la mejora es exclusivamente en la fuente de datos del sourceCanvas.

        const margin     = Math.round(Math.min(Math.max(this.pieceWidth, this.pieceHeight), this.tabSize * 3));
        const srcMargin  = Math.round(margin * this.dpr);
        const overlapFix = isStaticRender ? 1 : 0;

        const srcPieceW_SC  = this.sourceCanvas.width  / this.gridSize;  // entero exacto
        const srcPieceH_SC  = this.sourceCanvas.height / this.gridSize;  // entero exacto
        const srcOriginX_SC = p.gridX * srcPieceW_SC;                    // entero × entero
        const srcOriginY_SC = p.gridY * srcPieceH_SC;

        // En renders estáticos el mapeo es 1:1 píxel físico → desactivar suavizado
        // elimina cualquier dispersión de color entre píxeles adyacentes de la rejilla.
        // El par save/restore garantiza que el estado original se restaura.
        if (isStaticRender) ctx.imageSmoothingEnabled = false;

        ctx.drawImage(
            this.sourceCanvas,
            srcOriginX_SC - srcMargin,
            srcOriginY_SC - srcMargin,
            srcPieceW_SC  + srcMargin * 2,
            srcPieceH_SC  + srcMargin * 2,
            -margin - overlapFix,
            -margin - overlapFix,
            this.pieceWidth  + margin * 2 + overlapFix * 2,
            this.pieceHeight + margin * 2 + overlapFix * 2
        );

        if (isStaticRender) ctx.imageSmoothingEnabled = true;

        ctx.restore();

        if (!isStaticRender && !p.isLocked) {
            ctx.save();
            ctx.translate(drawX, drawY);

            if (isSelected) {
                ctx.translate(this.pieceWidth / 2, this.pieceHeight / 2);
                ctx.scale(1.05, 1.05);
                ctx.translate(-this.pieceWidth / 2, -this.pieceHeight / 2);
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth   = 3;
                ctx.stroke(p.path);
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.lineWidth   = 1.5;
                ctx.stroke(p.path);
            }

            ctx.restore();
        }
    }

    _updateSnapFlashes() {
        if (this.snapFlashes.length === 0) return;
        const now = performance.now();
        for (let i = this.snapFlashes.length - 1; i >= 0; i--) {
            const f = this.snapFlashes[i];
            if (!f.startTime) f.startTime = now;
            const t = (now - f.startTime) / 200;
            if (t >= 1) { this.snapFlashes.splice(i, 1); continue; }
            const p = f.piece;
            this.ctx.save();
            this.ctx.translate(Math.round(p.currentX), Math.round(p.currentY));
            this.ctx.strokeStyle = `rgba(16,185,129,${1 - t})`;
            this.ctx.lineWidth   = 6 - t * 4;
            this.ctx.stroke(p.path);
            this.ctx.restore();
        }
    }

    _spawnEdgePulse(x, y) {
        const maxR = Math.hypot(this.logicalWidth, this.logicalHeight);
        this.edgePulses.push({ x, y, maxR, startTime: null, delay: 0,   color: '16,185,129' });
        this.edgePulses.push({ x, y, maxR, startTime: null, delay: 100, color: '99,102,241' });
    }

    _updateEdgePulses() {
        if (this.edgePulses.length === 0) return;
        const now = performance.now();
        for (let i = this.edgePulses.length - 1; i >= 0; i--) {
            const ep = this.edgePulses[i];
            if (!ep.startTime) ep.startTime = now;
            const elapsed = now - ep.startTime - ep.delay;
            if (elapsed < 0) continue;
            const t = elapsed / 600;
            if (t >= 1) { this.edgePulses.splice(i, 1); continue; }
            const eased = 1 - Math.pow(1 - t, 2);
            const r     = ep.maxR * eased;
            const a     = (1 - t) * 0.4;
            const lw    = Math.max(1, 4 - t * 3);
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.arc(ep.x, ep.y, r, 0, Math.PI * 2);
            this.ctx.strokeStyle = `rgba(${ep.color},${a.toFixed(2)})`;
            this.ctx.lineWidth   = lw;
            this.ctx.stroke();
            this.ctx.restore();
        }
    }

    updatePieceCaches() {
        this.lockedPieces = this.pieces.filter(p =>  p.isLocked);
        this.loosePieces  = this.pieces.filter(p => !p.isLocked);
    }

    createPieces() {
        this.pieces = [];
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const shape  = this.shapes[y][x];
                const jitter = {
                    top:    this.horizontalEdges[y][x],
                    bottom: this.horizontalEdges[y + 1][x],
                    left:   this.verticalEdges[y][x],
                    right:  this.verticalEdges[y][x + 1]
                };
                const path = this.createPath(this.pieceWidth, this.pieceHeight, shape, jitter);
                this.pieces.push({
                    id: `${x}-${y}`, gridX: x, gridY: y,
                    correctX: this.boardX + x * this.pieceWidth,
                    correctY: this.boardY + y * this.pieceHeight,
                    currentX: 0, currentY: 0, isLocked: false,
                    shape, jitter, path
                });
            }
        }
        this.updatePieceCaches();
    }

    createPiecesPathsOnly() {
        for (const p of this.pieces) {
            p.path     = this.createPath(this.pieceWidth, this.pieceHeight, p.shape, p.jitter);
            p.correctX = this.boardX + p.gridX * this.pieceWidth;
            p.correctY = this.boardY + p.gridY * this.pieceHeight;
            if (p.isLocked) { p.currentX = p.correctX; p.currentY = p.correctY; }
        }
    }

    shufflePieces(repositionOnly = false) {
        this.updatePieceCaches();
        const loose = this.loosePieces;

        if (!repositionOnly) {
            for (let i = loose.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [loose[i], loose[j]] = [loose[j], loose[i]];
            }
        }

        const topSafe    = 80;
        const bottomSafe = 20;

        let zones;
        if (this.isMobilePortrait) {
            const belowY = this.boardY + this.boardHeight + 10;
            const belowH = this.logicalHeight - belowY - bottomSafe;
            zones = [{ x: 4, y: belowY, w: this.logicalWidth - 8, h: Math.max(0, belowH) }];
        } else {
            zones = [
                { x: 10, y: topSafe, w: Math.max(0, this.boardX - 20), h: this.logicalHeight - topSafe - bottomSafe },
                { x: this.boardX + this.boardWidth + 10, y: topSafe, w: Math.max(0, this.logicalWidth - (this.boardX + this.boardWidth) - 20), h: this.logicalHeight - topSafe - bottomSafe },
                { x: 10, y: this.boardY + this.boardHeight + 10, w: this.logicalWidth - 20, h: Math.max(0, this.logicalHeight - (this.boardY + this.boardHeight) - bottomSafe) }
            ];
        }

        const validZones = zones.filter(z => z.w > this.pieceWidth && z.h > this.pieceHeight);
        if (validZones.length === 0) {
            validZones.push({ x: 4, y: this.boardY + this.boardHeight + 4, w: this.logicalWidth - 8, h: Math.max(this.pieceHeight * 2, this.logicalHeight - (this.boardY + this.boardHeight) - 8) });
        }

        const placed = [];
        for (const p of loose) {
            if (!repositionOnly) p.isLocked = false;
            if (p.isLocked) continue;

            let ok = false, tries = 0;
            while (!ok && tries < 50) {
                tries++;
                const z  = validZones[Math.floor(Math.random() * validZones.length)];
                const cx = z.x + Math.random() * (z.w - this.pieceWidth);
                const cy = z.y + Math.random() * (z.h - this.pieceHeight);
                const collision = placed.some(pos => Math.hypot(pos.x - cx, pos.y - cy) < this.pieceWidth * 0.7);
                if (!collision) { p.currentX = cx; p.currentY = cy; placed.push({ x: cx, y: cy }); ok = true; }
            }
            if (!ok) { p.currentX = Math.random() * (this.logicalWidth - this.pieceWidth); p.currentY = Math.random() * (this.logicalHeight - this.pieceHeight); }
            this.clampPosition(p);
        }

        this.updatePieceCaches();
        this.needsStaticUpdate = true;
        this.wakeUp();
    }

    clampPosition(p) {
        p.currentX = Math.max(0, Math.min(p.currentX, this.logicalWidth  - this.pieceWidth));
        p.currentY = Math.max(0, Math.min(p.currentY, this.logicalHeight - this.pieceHeight));
    }

    generateSharedTopology() {
        const js = this.gridSize > 6 ? 0.08 : 0.15;
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
        for (let y = 0; y < this.gridSize; y++) {
            const row = [];
            for (let x = 0; x <= this.gridSize; x++) row.push((x === 0 || x === this.gridSize) ? 0 : (Math.random() - 0.5) * js);
            this.verticalEdges.push(row);
        }
        this.horizontalEdges = [];
        for (let y = 0; y <= this.gridSize; y++) {
            const row = [];
            for (let x = 0; x < this.gridSize; x++) row.push((y === 0 || y === this.gridSize) ? 0 : (Math.random() - 0.5) * js);
            this.horizontalEdges.push(row);
        }
    }

    createPath(w, h, shape, jitter) {
        const path = new Path2D();
        const t    = this.tabSize;
        path.moveTo(0, 0);
        shape.top    !== 0 ? this.lineToTab(path, 0, 0, w, 0, shape.top    * t, jitter.top    * t) : path.lineTo(w, 0);
        shape.right  !== 0 ? this.lineToTab(path, w, 0, w, h, shape.right  * t, jitter.right  * t) : path.lineTo(w, h);
        shape.bottom !== 0 ? this.lineToTab(path, w, h, 0, h, shape.bottom * t, jitter.bottom * t) : path.lineTo(0, h);
        shape.left   !== 0 ? this.lineToTab(path, 0, h, 0, 0, shape.left   * t, jitter.left   * t) : path.lineTo(0, 0);
        path.closePath();
        return path;
    }

    lineToTab(path, x1, y1, x2, y2, amp, shift) {
        const w = x2 - x1, h = y2 - y1;
        const cx = x1 + w * 0.5 + (w === 0 ? shift : 0);
        const cy = y1 + h * 0.5 + (h === 0 ? shift : 0);
        const perpX = -h / Math.abs(h || 1), perpY = w / Math.abs(w || 1);
        const xA = x1 + w * 0.35, yA = y1 + h * 0.35;
        const xB = x1 + w * 0.65, yB = y1 + h * 0.65;
        path.lineTo(xA, yA);
        path.bezierCurveTo(xA + perpX*amp*0.2, yA + perpY*amp*0.2, cx - w*0.1 + perpX*amp, cy - h*0.1 + perpY*amp, cx + perpX*amp, cy + perpY*amp);
        path.bezierCurveTo(cx + w*0.1 + perpX*amp, cy + h*0.1 + perpY*amp, xB + perpX*amp*0.2, yB + perpY*amp*0.2, xB, yB);
        path.lineTo(x2, y2);
    }

    getPointerPos(e) {
        const rect    = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    cancelDrag() {
        if (this.isDragging && this.selectedPiece) {
            if (this.selectedPiece.originalX !== undefined && this.selectedPiece.originalY !== undefined) {
                this.selectedPiece.currentX = this.selectedPiece.originalX;
                this.selectedPiece.currentY = this.selectedPiece.originalY;
            }
            this.isDragging    = false;
            this.selectedPiece = null;
            this.needsStaticUpdate = true;
            this.wakeUp();
        }
    }

    handleStart(e) {
        e.preventDefault();
        const { x, y } = this.getPointerPos(e);
        this._updateParallaxTarget(x, y);

        for (let i = this.loosePieces.length - 1; i >= 0; i--) {
            const p = this.loosePieces[i];
            const m = this.tabSize * 2.0;
            if (x >= p.currentX - m && x <= p.currentX + this.pieceWidth  + m &&
                y >= p.currentY - m && y <= p.currentY + this.pieceHeight + m) {
                this.selectedPiece = p;
                this.isDragging    = true;
                this.dragOffsetX   = x - p.currentX;
                this.dragOffsetY   = y - p.currentY;
                p.originalX        = p.currentX;
                p.originalY        = p.currentY;
                this.wakeUp();
                this.callbacks.onSound && this.callbacks.onSound('click');
                if (navigator.vibrate) navigator.vibrate(10);
                this.loosePieces.splice(i, 1);
                this.loosePieces.push(p);
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
        this.clampPosition(this.selectedPiece);
        this._updateParallaxTarget(x, y);
    }

    handleEnd(e) {
        if (!this.isDragging || !this.selectedPiece) return;

        const dist = Math.hypot(
            this.selectedPiece.currentX - this.selectedPiece.correctX,
            this.selectedPiece.currentY - this.selectedPiece.correctY
        );

        if (dist < this.pieceWidth * 0.3) {
            this.selectedPiece.currentX = this.selectedPiece.correctX;
            this.selectedPiece.currentY = this.selectedPiece.correctY;
            this.selectedPiece.isLocked = true;
            this.needsStaticUpdate = true;
            this.updatePieceCaches();

            this.snapFlashes.push({ piece: this.selectedPiece, startTime: null });
            this._spawnEdgePulse(
                this.selectedPiece.currentX + this.pieceWidth  / 2,
                this.selectedPiece.currentY + this.pieceHeight / 2
            );
            this.wakeUp();

            this.callbacks.onSound && this.callbacks.onSound('snap');
            this.callbacks.onSnap && this.callbacks.onSnap();

            this.spawnParticles(
                this.selectedPiece.currentX + this.pieceWidth  / 2,
                this.selectedPiece.currentY + this.pieceHeight / 2,
                'ripple'
            );

            if (this.callbacks.onStateChange) this.callbacks.onStateChange();
            this.checkVictory();
        } else {
            if (this.callbacks.onStateChange) this.callbacks.onStateChange();
        }

        this.isDragging    = false;
        this.selectedPiece = null;
    }

    checkVictory() {
        if (this.loosePieces.length === 0) {
            if (this.gridSize < 8) this.spawnParticles(this.logicalWidth / 2, this.logicalHeight / 2, 'confetti');
            if (this.callbacks.onSound) this.callbacks.onSound('win');
            this._spawnEdgePulse(this.logicalWidth / 2, this.logicalHeight / 2);
            if (this.callbacks.onWin) setTimeout(this.callbacks.onWin, 1500);
            this.canvas.removeEventListener('mousedown', this.handleStart);
            this.canvas.removeEventListener('touchstart', this.handleStart);
        }
    }

    spawnParticles(x, y, type) {
        if (type === 'ripple') {
            this.particles.push({ type: 'ripple', x, y, radius: 10, alpha: 1.0, color: '#ffffff', lineWidth: 4, speed: 3 });
            this.particles.push({ type: 'ripple', x, y, radius: 5,  alpha: 1.0, color: '#38BDF8', lineWidth: 2, speed: 1.5 });
        } else {
            if (this.particles.length > this.particleLimit) return;
            const colors = ['#6366F1', '#38BDF8', '#10B981', '#F59E0B', '#fff'];
            for (let i = 0; i < 30; i++) {
                this.particles.push({ type: 'confetti', x, y, vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10, life: 1.0, color: colors[i % colors.length], size: Math.random()*4+2 });
            }
        }
    }

    updateParticles() {
        if (this.particles.length === 0) return;
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (p.type === 'ripple') {
                p.radius += p.speed; p.alpha -= 0.04; p.lineWidth *= 0.95;
                if (p.alpha <= 0) { this.particles.splice(i, 1); continue; }
                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.strokeStyle = p.color; this.ctx.lineWidth = p.lineWidth; this.ctx.globalAlpha = p.alpha;
                this.ctx.stroke();
                this.ctx.restore();
            } else {
                p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.03;
                if (p.life <= 0) { this.particles.splice(i, 1); continue; }
                this.ctx.globalAlpha = p.life;
                this.ctx.fillStyle   = p.color;
                this.ctx.fillRect(p.x, p.y, p.size, p.size);
            }
        }
        this.ctx.globalAlpha = 1;
    }

    exportState() { return this.pieces.map(p => ({ id: p.id, cx: p.currentX, cy: p.currentY, locked: p.isLocked })); }

    importState(s) {
        if (!s) return;
        s.forEach(sp => { const p = this.pieces.find(x => x.id === sp.id); if (p) { p.currentX = sp.cx; p.currentY = sp.cy; p.isLocked = sp.locked; } });
        this.updatePieceCaches(); this.needsStaticUpdate = true; this.wakeUp();
    }

    togglePreview(a) { this.showPreview = a; this.wakeUp(); }

    autoPlacePiece() {
        if (this.loosePieces.length === 0) return false;
        const p = this.loosePieces[Math.floor(Math.random() * this.loosePieces.length)];
        this.spawnParticles(p.correctX + this.pieceWidth / 2, p.correctY + this.pieceHeight / 2, 'ripple');
        p.currentX = p.correctX; p.currentY = p.correctY; p.isLocked = true;
        this.snapFlashes.push({ piece: p, startTime: null });
        this._spawnEdgePulse(p.correctX + this.pieceWidth / 2, p.correctY + this.pieceHeight / 2);
        this.updatePieceCaches(); this.needsStaticUpdate = true;
        if (this.callbacks.onSound) this.callbacks.onSound('snap');
        this.checkVictory(); this.wakeUp();
        return true;
    }

    addEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleStart);
        window.addEventListener('mousemove', this.handleMove);
        window.addEventListener('mouseup', this.handleEnd);
        this.canvas.addEventListener('touchstart', this.handleStart, { passive: false });
        window.addEventListener('touchmove', this.handleMove, { passive: false });
        window.addEventListener('touchend', this.handleEnd);
        document.addEventListener('visibilitychange', this._onVisibilityChange);
        window.addEventListener('pageshow', this.handleResize, { passive: true });
        window.addEventListener('orientationchange', this.handleResize, { passive: true });

        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', this._onOrientation, { passive: true });
        }

        if (!this._resizeObserver && typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this.handleResize());
            this._resizeObserver.observe(this.canvas.parentElement);
        }
    }

    /**
     * Detiene el loop, elimina todos los listeners y libera memoria de GPU.
     *
     * Liberación de buffers (v17.0, sin cambios en v19.0):
     *   Asignar width = 0 / height = 0 a un canvas HTMLCanvasElement fuerza
     *   al browser a liberar inmediatamente la textura de VRAM asociada.
     *   Esto es especialmente crítico para imágenes 1600×1600 a DPR 2×:
     *   cada buffer ocupa ~13 MB (1600×1600×4 bytes×2×2) y sin este paso
     *   el GC tarda varios segundos en reclamar esa memoria, provocando
     *   picos de uso y posibles OOM en dispositivos con ≤2 GB de RAM.
     *
     *   ImageBitmap.close():
     *   Si config.image era un ImageBitmap (el camino de alta prioridad en
     *   main.js v8.0), llamar a .close() libera su memoria nativa antes de
     *   que el GC lo recoja, lo que equivale a una liberación determinista
     *   de la textura en el worker de decodificación.
     *
     *   Nota v19.1: el sourceCanvas tiene ahora un cap de 1600 px por lado
     *   (MAX_SRC_PX), por lo que su tamaño máximo es ~10 MB en DPR 3×,
     *   en lugar de los ~14 MB que habría generado sin el límite.
     *   Los canvases intermedios de _buildSourceCanvasHQ() ya
     *   se invalidan durante su propia ejecución (width=0/height=0). No
     *   quedan referencias pendientes al finalizar resizeCanvas().
     */
    destroy() {
        // 1. Detener el loop de animación.
        this.isLoopRunning = false;
        clearInterval(this._idleTimer);

        // 2. Eliminar listeners de input.
        this.canvas.removeEventListener('mousedown', this.handleStart);
        window.removeEventListener('mousemove', this.handleMove);
        window.removeEventListener('mouseup', this.handleEnd);
        this.canvas.removeEventListener('touchstart', this.handleStart);
        window.removeEventListener('touchmove', this.handleMove);
        window.removeEventListener('touchend', this.handleEnd);
        document.removeEventListener('visibilitychange', this._onVisibilityChange);
        window.removeEventListener('pageshow', this.handleResize);
        window.removeEventListener('orientationchange', this.handleResize);
        window.removeEventListener('deviceorientation', this._onOrientation);
        if (this._resizeObserver) this._resizeObserver.disconnect();
        if (this._layoutRetryRaf) {
            cancelAnimationFrame(this._layoutRetryRaf);
            this._layoutRetryRaf = null;
        }

        // 3. Liberar VRAM de los buffers offscreen.
        //    Asignar 0 invalida la textura en la GPU de forma síncrona.
        this.sourceCanvas.width  = 0;
        this.sourceCanvas.height = 0;
        this.staticCanvas.width  = 0;
        this.staticCanvas.height = 0;
        this.gridCanvas.width    = 0;
        this.gridCanvas.height   = 0;

        // 4. Liberar el ImageBitmap si aplica (API determinista de liberación).
        if (this.img && typeof this.img.close === 'function') {
            this.img.close();
        }

        // 5. Nulificar referencias para facilitar al GC.
        this.img          = null;
        this.pieces        = [];
        this.lockedPieces  = [];
        this.loosePieces   = [];
        this.particles     = [];
        this.snapFlashes   = [];
        this.edgePulses    = [];
        this.selectedPiece = null;
    }
}

// ─────────────────────────────────────────────────────────────
//  Utilidad de calidad de imagen — módulo privado
// ─────────────────────────────────────────────────────────────

/**
 * Aplica configuración de suavizado de calidad máxima a un contexto 2D.
 *
 * Se llama después de cada cambio de dimensión del canvas porque asignar
 * canvas.width o canvas.height resetea el contexto a sus valores por defecto:
 *   - imageSmoothingEnabled: true   (ya es el default, pero lo forzamos)
 *   - imageSmoothingQuality: 'low'  (default del navegador — cambiamos a 'high')
 *
 * 'high' activa interpolación bicúbica (vs bilinear en 'low'/'medium').
 * En el contexto del step-down scaling (v19.0), bicúbico en cada paso
 * intermedio equivale a un filtro Catmull-Rom 4×4 que preserva las altas
 * frecuencias (bordes, líneas finas) mientras suprime el aliasing de Nyquist.
 * En el paso final (copia 1:1 del sourceCanvas a piezas encajadas), el
 * suavizado se desactiva puntualmente en isStaticRender para un blit exacto.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
function _applySmoothing(ctx) {
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
}
