/**
 * WORD HUNT - Game Logic
 * LoveArcade Integration
 * Prefix: la_ws_ (LoveArcade WordSearch)
 */

(function() {
    'use strict';

    // ========================================
    // CONFIGURACIÓN Y CONSTANTES
    // ========================================
    
    const STORAGE_KEY = 'la_ws_completedLevels';
    const GAME_ID = 'wordsearch';
    
    const COLORS = {
        bg: '#1a2035',
        grid: '#2a3555',
        text: '#ffffff',
        textDim: '#8892b0',
        selection: 'rgba(255, 0, 128, 0.3)',
        found: 'rgba(0, 255, 136, 0.5)',
        foundBorder: '#00ff88',
        highlight: '#ff0080'
    };

    // ========================================
    // ESTADO DEL JUEGO
    // ========================================
    
    const la_ws_state = {
        currentScreen: 'main',
        currentLevel: null,
        currentLevelIndex: -1,
        grid: [],
        words: [],
        foundWords: new Set(),
        completedLevels: new Set(),
        
        // Selección actual
        selecting: false,
        startCell: null,
        currentCell: null,
        selectedCells: [],
        
        // Canvas
        canvas: null,
        ctx: null,
        cellSize: 0,
        offsetX: 0,
        offsetY: 0
    };

    // ========================================
    // INICIALIZACIÓN
    // ========================================
    
    function la_ws_init() {
        console.log('[WordSearch] Inicializando...');
        
        // Cargar progreso guardado
        la_ws_loadProgress();
        
        // Configurar partículas de fondo
        la_ws_initParticles();
        
        // Configurar event listeners
        la_ws_setupEventListeners();
        
        // Actualizar UI inicial
        la_ws_updateStats();
        
        console.log('[WordSearch] ✓ Inicialización completa');
    }

    // ========================================
    // GESTIÓN DE PROGRESO
    // ========================================
    
    function la_ws_loadProgress() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const levelIds = JSON.parse(saved);
                la_ws_state.completedLevels = new Set(levelIds);
                console.log(`[WordSearch] Progreso cargado: ${levelIds.length} niveles completados`);
            }
        } catch (e) {
            console.error('[WordSearch] Error cargando progreso:', e);
        }
    }

    function la_ws_saveProgress() {
        try {
            const levelIds = Array.from(la_ws_state.completedLevels);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(levelIds));
        } catch (e) {
            console.error('[WordSearch] Error guardando progreso:', e);
        }
    }

    function la_ws_markLevelCompleted(levelId) {
        la_ws_state.completedLevels.add(levelId);
        la_ws_saveProgress();
    }

    // ========================================
    // NAVEGACIÓN DE PANTALLAS
    // ========================================
    
    function la_ws_showScreen(screenName) {
        // Ocultar todas las pantallas
        document.querySelectorAll('.la-ws-screen').forEach(screen => {
            screen.classList.remove('la-ws-screen--active');
        });
        
        // Mostrar la pantalla solicitada
        const targetScreen = document.getElementById(`la_ws_${screenName}Screen`);
        if (targetScreen) {
            targetScreen.classList.add('la-ws-screen--active');
            la_ws_state.currentScreen = screenName;
        }
        
        // Acciones específicas por pantalla
        if (screenName === 'levels') {
            la_ws_renderLevelsList();
        } else if (screenName === 'main') {
            la_ws_updateStats();
        }
    }

    // ========================================
    // PANTALLA DE NIVELES
    // ========================================
    
    function la_ws_renderLevelsList() {
        const container = document.getElementById('la_ws_levelsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        window.LA_WS_LEVELS.forEach((level, index) => {
            const isCompleted = la_ws_state.completedLevels.has(level.id);
            const isLocked = false; // Todos los niveles están desbloqueados
            
            const card = document.createElement('div');
            card.className = 'la-ws-level-card';
            if (isCompleted) card.classList.add('la-ws-level-card--completed');
            if (isLocked) card.classList.add('la-ws-level-card--locked');
            
            card.innerHTML = `
                <div class="la-ws-level-card__number">${index + 1}</div>
                <div class="la-ws-level-card__title">${level.title}</div>
                <div class="la-ws-level-card__reward">
                    <svg viewBox="0 0 24 24" fill="none" style="width:16px;height:16px">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="currentColor" opacity="0.3"/>
                    </svg>
                    +${level.rewardCoins}
                </div>
                ${isCompleted ? `
                    <svg class="la-ws-level-card__badge" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12 L11 14 L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                    </svg>
                ` : ''}
            `;
            
            if (!isLocked) {
                card.addEventListener('click', () => la_ws_startLevel(index));
            }
            
            container.appendChild(card);
        });
    }

    // ========================================
    // GENERACIÓN DE GRID
    // ========================================
    
    function la_ws_generateGrid(size, words) {
        // Crear grid vacío
        const grid = Array(size).fill(null).map(() => 
            Array(size).fill(null).map(() => ({
                letter: '',
                isPartOfWord: false,
                wordIndex: -1
            }))
        );
        
        // Direcciones posibles: horizontal, vertical, diagonal (4 direcciones)
        const directions = [
            { dx: 1, dy: 0 },   // horizontal →
            { dx: 0, dy: 1 },   // vertical ↓
            { dx: 1, dy: 1 },   // diagonal ↘
            { dx: -1, dy: 1 }   // diagonal ↙
        ];
        
        const placedWords = [];
        
        // Intentar colocar cada palabra
        words.forEach((word, wordIndex) => {
            const upperWord = word.toUpperCase();
            let placed = false;
            let attempts = 0;
            const maxAttempts = 100;
            
            while (!placed && attempts < maxAttempts) {
                attempts++;
                
                // Posición y dirección aleatorias
                const dir = directions[Math.floor(Math.random() * directions.length)];
                const startX = Math.floor(Math.random() * size);
                const startY = Math.floor(Math.random() * size);
                
                // Verificar si la palabra cabe
                let canPlace = true;
                const positions = [];
                
                for (let i = 0; i < upperWord.length; i++) {
                    const x = startX + (dir.dx * i);
                    const y = startY + (dir.dy * i);
                    
                    // Verificar límites
                    if (x < 0 || x >= size || y < 0 || y >= size) {
                        canPlace = false;
                        break;
                    }
                    
                    // Verificar si la celda está vacía o tiene la misma letra
                    const cell = grid[y][x];
                    if (cell.letter !== '' && cell.letter !== upperWord[i]) {
                        canPlace = false;
                        break;
                    }
                    
                    positions.push({ x, y, letter: upperWord[i] });
                }
                
                // Colocar la palabra si es posible
                if (canPlace) {
                    positions.forEach(pos => {
                        grid[pos.y][pos.x].letter = pos.letter;
                        grid[pos.y][pos.x].isPartOfWord = true;
                        grid[pos.y][pos.x].wordIndex = wordIndex;
                    });
                    
                    placedWords.push({
                        word: upperWord,
                        positions: positions,
                        found: false
                    });
                    
                    placed = true;
                }
            }
            
            if (!placed) {
                console.warn(`[WordSearch] No se pudo colocar la palabra: ${word}`);
            }
        });
        
        // Rellenar celdas vacías con letras aleatorias
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                if (grid[y][x].letter === '') {
                    grid[y][x].letter = letters[Math.floor(Math.random() * letters.length)];
                }
            }
        }
        
        return { grid, placedWords };
    }

    // ========================================
    // INICIO DE NIVEL
    // ========================================
    
    function la_ws_startLevel(levelIndex) {
        const level = window.LA_WS_LEVELS[levelIndex];
        if (!level) return;
        
        la_ws_state.currentLevel = level;
        la_ws_state.currentLevelIndex = levelIndex;
        la_ws_state.foundWords.clear();
        
        // Generar grid
        const { grid, placedWords } = la_ws_generateGrid(level.gridSize, level.words);
        la_ws_state.grid = grid;
        la_ws_state.words = placedWords;
        
        // Configurar canvas
        la_ws_setupCanvas();
        
        // Actualizar UI
        document.getElementById('la_ws_currentLevelTitle').textContent = `NIVEL ${levelIndex + 1}`;
        document.getElementById('la_ws_wordsTotal').textContent = level.words.length;
        document.getElementById('la_ws_wordsFound').textContent = '0';
        
        la_ws_renderWordsList();
        la_ws_showScreen('game');
        la_ws_drawGrid();
    }

    // ========================================
    // CONFIGURACIÓN DE CANVAS
    // ========================================
    
    function la_ws_setupCanvas() {
        const canvas = document.getElementById('la_ws_gameCanvas');
        if (!canvas) return;
        
        la_ws_state.canvas = canvas;
        la_ws_state.ctx = canvas.getContext('2d');
        
        // Ajustar tamaño del canvas
        const container = canvas.parentElement;
        const size = Math.min(container.clientWidth - 32, container.clientHeight - 32, 600);
        
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        
        // Calcular tamaño de celda
        const gridSize = la_ws_state.currentLevel.gridSize;
        la_ws_state.cellSize = size / gridSize;
        la_ws_state.offsetX = 0;
        la_ws_state.offsetY = 0;
        
        // Event listeners para el canvas
        canvas.addEventListener('mousedown', la_ws_handleMouseDown);
        canvas.addEventListener('mousemove', la_ws_handleMouseMove);
        canvas.addEventListener('mouseup', la_ws_handleMouseUp);
        canvas.addEventListener('mouseleave', la_ws_handleMouseUp);
        
        // Touch events para móvil
        canvas.addEventListener('touchstart', la_ws_handleTouchStart);
        canvas.addEventListener('touchmove', la_ws_handleTouchMove);
        canvas.addEventListener('touchend', la_ws_handleTouchEnd);
    }

    // ========================================
    // RENDERIZADO DE GRID
    // ========================================
    
    function la_ws_drawGrid() {
        const { ctx, grid, cellSize } = la_ws_state;
        if (!ctx || !grid) return;
        
        const canvas = la_ws_state.canvas;
        
        // Limpiar canvas
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar palabras encontradas (fondo)
        la_ws_state.words.forEach(wordData => {
            if (wordData.found) {
                la_ws_drawFoundWord(wordData.positions);
            }
        });
        
        // Dibujar selección actual
        if (la_ws_state.selecting && la_ws_state.selectedCells.length > 0) {
            la_ws_drawSelection(la_ws_state.selectedCells);
        }
        
        // Dibujar grid
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                la_ws_drawCell(x, y, grid[y][x]);
            }
        }
    }

    function la_ws_drawCell(x, y, cell) {
        const { ctx, cellSize } = la_ws_state;
        const px = x * cellSize;
        const py = y * cellSize;
        
        // Border de celda
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, cellSize, cellSize);
        
        // Letra
        ctx.fillStyle = COLORS.text;
        ctx.font = `bold ${cellSize * 0.5}px 'Orbitron', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cell.letter, px + cellSize / 2, py + cellSize / 2);
    }

    function la_ws_drawSelection(cells) {
        const { ctx, cellSize } = la_ws_state;
        
        ctx.fillStyle = COLORS.selection;
        cells.forEach(({ x, y }) => {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        });
    }

    function la_ws_drawFoundWord(positions) {
        const { ctx, cellSize } = la_ws_state;
        
        // Fondo de palabra encontrada
        ctx.fillStyle = COLORS.found;
        positions.forEach(({ x, y }) => {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        });
        
        // Línea que conecta las letras
        if (positions.length > 1) {
            ctx.strokeStyle = COLORS.foundBorder;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            
            ctx.beginPath();
            const first = positions[0];
            ctx.moveTo(
                first.x * cellSize + cellSize / 2,
                first.y * cellSize + cellSize / 2
            );
            
            for (let i = 1; i < positions.length; i++) {
                const pos = positions[i];
                ctx.lineTo(
                    pos.x * cellSize + cellSize / 2,
                    pos.y * cellSize + cellSize / 2
                );
            }
            ctx.stroke();
        }
    }

    // ========================================
    // INTERACCIÓN CON EL GRID
    // ========================================
    
    function la_ws_getCellFromEvent(event) {
        const canvas = la_ws_state.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        let clientX, clientY;
        
        if (event.type.startsWith('touch')) {
            const touch = event.touches[0] || event.changedTouches[0];
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        const x = Math.floor((clientX - rect.left) * scaleX / la_ws_state.cellSize);
        const y = Math.floor((clientY - rect.top) * scaleY / la_ws_state.cellSize);
        
        const gridSize = la_ws_state.grid.length;
        if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) {
            return { x, y };
        }
        return null;
    }

    function la_ws_handleMouseDown(event) {
        event.preventDefault();
        const cell = la_ws_getCellFromEvent(event);
        if (!cell) return;
        
        la_ws_state.selecting = true;
        la_ws_state.startCell = cell;
        la_ws_state.currentCell = cell;
        la_ws_state.selectedCells = [cell];
        la_ws_drawGrid();
    }

    function la_ws_handleMouseMove(event) {
        if (!la_ws_state.selecting) return;
        event.preventDefault();
        
        const cell = la_ws_getCellFromEvent(event);
        if (!cell) return;
        
        // Solo actualizar si la celda cambió
        if (!la_ws_state.currentCell || 
            cell.x !== la_ws_state.currentCell.x || 
            cell.y !== la_ws_state.currentCell.y) {
            
            la_ws_state.currentCell = cell;
            la_ws_updateSelection();
            la_ws_drawGrid();
        }
    }

    function la_ws_handleMouseUp(event) {
        if (!la_ws_state.selecting) return;
        event.preventDefault();
        
        la_ws_state.selecting = false;
        la_ws_checkWord();
        la_ws_state.selectedCells = [];
        la_ws_state.startCell = null;
        la_ws_state.currentCell = null;
        la_ws_drawGrid();
    }

    function la_ws_handleTouchStart(event) {
        la_ws_handleMouseDown(event);
    }

    function la_ws_handleTouchMove(event) {
        la_ws_handleMouseMove(event);
    }

    function la_ws_handleTouchEnd(event) {
        la_ws_handleMouseUp(event);
    }

    function la_ws_updateSelection() {
        const start = la_ws_state.startCell;
        const current = la_ws_state.currentCell;
        if (!start || !current) return;
        
        // Calcular dirección
        const dx = Math.sign(current.x - start.x);
        const dy = Math.sign(current.y - start.y);
        
        // Solo permitir líneas rectas (horizontal, vertical, diagonal)
        if (dx !== 0 && dy !== 0 && Math.abs(current.x - start.x) !== Math.abs(current.y - start.y)) {
            return;
        }
        
        // Construir lista de celdas seleccionadas
        const cells = [];
        let x = start.x;
        let y = start.y;
        
        while (true) {
            cells.push({ x, y });
            
            if (x === current.x && y === current.y) break;
            
            if (x !== current.x) x += dx;
            if (y !== current.y) y += dy;
        }
        
        la_ws_state.selectedCells = cells;
    }

    function la_ws_checkWord() {
        if (la_ws_state.selectedCells.length < 2) return;
        
        // Obtener palabra de las celdas seleccionadas
        const word = la_ws_state.selectedCells
            .map(({ x, y }) => la_ws_state.grid[y][x].letter)
            .join('');
        
        // También verificar al revés
        const reverseWord = word.split('').reverse().join('');
        
        // Buscar en palabras del nivel
        la_ws_state.words.forEach((wordData, index) => {
            if (wordData.found) return;
            
            if (wordData.word === word || wordData.word === reverseWord) {
                // ¡Palabra encontrada!
                wordData.found = true;
                la_ws_state.foundWords.add(wordData.word);
                
                // Actualizar UI
                la_ws_updateProgress();
                la_ws_renderWordsList();
                
                // Verificar si completó el nivel
                if (la_ws_state.foundWords.size === la_ws_state.words.length) {
                    setTimeout(() => la_ws_completeLevel(), 500);
                }
            }
        });
    }

    // ========================================
    // UI DE JUEGO
    // ========================================
    
    function la_ws_renderWordsList() {
        const container = document.getElementById('la_ws_wordsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        la_ws_state.words.forEach(wordData => {
            const item = document.createElement('div');
            item.className = 'la-ws-word-item';
            if (wordData.found) {
                item.classList.add('la-ws-word-item--found');
            }
            item.textContent = wordData.word;
            container.appendChild(item);
        });
    }

    function la_ws_updateProgress() {
        const found = la_ws_state.foundWords.size;
        const total = la_ws_state.words.length;
        document.getElementById('la_ws_wordsFound').textContent = found;
    }

    // ========================================
    // COMPLETAR NIVEL
    // ========================================
    
    function la_ws_completeLevel() {
        const level = la_ws_state.currentLevel;
        if (!level) return;
        
        const wasCompleted = la_ws_state.completedLevels.has(level.id);
        
        // Llamar a GameCenter solo si NO fue completado antes
        if (!wasCompleted && window.GameCenter && typeof window.GameCenter.completeLevel === 'function') {
            try {
                // Asegurar que coins es entero
                const coins = Math.floor(level.rewardCoins);
                
                const result = window.GameCenter.completeLevel(GAME_ID, level.id, coins);
                console.log(`[WordSearch] GameCenter.completeLevel resultado:`, result);
                
                // Marcar como completado solo si GameCenter respondió correctamente
                if (result && result.paid) {
                    la_ws_markLevelCompleted(level.id);
                }
            } catch (e) {
                console.error('[WordSearch] Error llamando a GameCenter:', e);
            }
        } else if (wasCompleted) {
            console.log(`[WordSearch] Nivel "${level.id}" ya fue completado anteriormente`);
        } else {
            console.warn('[WordSearch] GameCenter no disponible, ejecutando en modo standalone');
            // Guardar localmente de todos modos
            la_ws_markLevelCompleted(level.id);
        }
        
        // Mostrar modal de victoria
        la_ws_showVictoryModal(wasCompleted);
    }

    function la_ws_showVictoryModal(wasCompleted) {
        const modal = document.getElementById('la_ws_victoryModal');
        const rewardDisplay = document.getElementById('la_ws_rewardDisplay');
        
        if (wasCompleted) {
            rewardDisplay.textContent = '¡YA COMPLETADO!';
        } else {
            rewardDisplay.textContent = `+${la_ws_state.currentLevel.rewardCoins} MONEDAS`;
        }
        
        modal.classList.add('la-ws-modal--active');
        
        // Verificar si hay siguiente nivel
        const nextLevelIndex = la_ws_state.currentLevelIndex + 1;
        const hasNext = nextLevelIndex < window.LA_WS_LEVELS.length;
        
        const btnNext = document.getElementById('la_ws_btnNextLevel');
        if (hasNext) {
            btnNext.style.display = 'flex';
            btnNext.onclick = () => {
                modal.classList.remove('la-ws-modal--active');
                la_ws_startLevel(nextLevelIndex);
            };
        } else {
            btnNext.style.display = 'none';
        }
    }

    // ========================================
    // ESTADÍSTICAS
    // ========================================
    
    function la_ws_updateStats() {
        document.getElementById('la_ws_completedCount').textContent = 
            la_ws_state.completedLevels.size;
        document.getElementById('la_ws_totalLevels').textContent = 
            window.LA_WS_LEVELS.length;
    }

    // ========================================
    // PARTÍCULAS DE FONDO
    // ========================================
    
    function la_ws_initParticles() {
        const canvas = document.getElementById('la_ws_particles');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const particles = [];
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1
            });
        }
        
        function animate() {
            ctx.fillStyle = 'rgba(10, 14, 26, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                
                if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
                
                ctx.fillStyle = 'rgba(255, 0, 128, 0.6)';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            
            requestAnimationFrame(animate);
        }
        
        animate();
        
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    }

    // ========================================
    // EVENT LISTENERS
    // ========================================
    
    function la_ws_setupEventListeners() {
        // Botón de niveles (main screen)
        document.getElementById('la_ws_btnLevels')?.addEventListener('click', () => {
            la_ws_showScreen('levels');
        });
        
        // Botón de volver (levels screen)
        document.getElementById('la_ws_btnBack')?.addEventListener('click', () => {
            la_ws_showScreen('main');
        });
        
        // Botón de salir del juego
        document.getElementById('la_ws_btnExitGame')?.addEventListener('click', () => {
            la_ws_showScreen('levels');
        });
        
        // Botón toggle de palabras (móvil)
        document.getElementById('la_ws_btnToggleWords')?.addEventListener('click', function() {
            const list = document.getElementById('la_ws_wordsList');
            const isHidden = list.style.display === 'none';
            list.style.display = isHidden ? 'flex' : 'none';
            this.textContent = isHidden ? '🔼 PALABRAS' : '🔽 PALABRAS';
        });
        
        // Botón de volver a niveles (modal victoria)
        document.getElementById('la_ws_btnBackToLevels')?.addEventListener('click', () => {
            document.getElementById('la_ws_victoryModal').classList.remove('la-ws-modal--active');
            la_ws_showScreen('levels');
        });
    }

    // ========================================
    // INICIAR CUANDO EL DOM ESTÉ LISTO
    // ========================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', la_ws_init);
    } else {
        la_ws_init();
    }

})();
