const la_ws_game = {
    currentLevel: null,
    grid: [],
    renderer: null,
    finder: null,

    init() {
        // Eventos de botones principales
        document.getElementById('la_ws_btn_play').onclick = () => this.startLevel(window.LA_WS_LEVELS[0]);
        document.getElementById('la_ws_btn_levels').onclick = () => {
            la_ws_ui.renderLevelList(window.LA_WS_LEVELS, (lvl) => this.startLevel(lvl));
            la_ws_ui.showScreen('la_ws_screen_levels');
        };
        document.querySelector('.la-ws-btn-back').onclick = () => la_ws_ui.showScreen('la_ws_screen_main');
        document.getElementById('la_ws_btn_back_menu').onclick = () => la_ws_ui.showScreen('la_ws_screen_main');

        console.log("[WordSearch] Inicializado correctamente.");
    },

    startLevel(level) {
        this.currentLevel = level;
        document.getElementById('la_ws_current_level_name').innerText = level.title;
        document.getElementById('la_ws_reward_val').innerText = level.rewardCoins;

        // 1. Generar grilla lógica (rellenada con letras aleatorias y palabras del config)
        this.grid = this.generateGrid(level.gridSize, level.words);
        
        // 2. Inicializar lógica de búsqueda
        this.finder = new LA_WS_WordFinder(this.grid, level.words);
        
        // 3. Inicializar renderizado y entrada
        this.renderer = new LA_WS_GridRenderer('la_ws_canvas', level.gridSize);
        this.renderer.resize(window.innerWidth - 40);
        
        new LA_WS_InputHandler(this.renderer.canvas, level.gridSize, (path) => this.handleSelection(path));

        la_ws_ui.updateWordList(level.words, []);
        la_ws_ui.showScreen('la_ws_screen_game');
        this.renderLoop();
    },

    generateGrid(size, words) {
        let grid = la_ws_utils.createEmptyGrid(size);
        // Aquí iría la lógica para insertar palabras en el grid...
        // Por brevedad, llenamos todo con letras aleatorias (el equipo front debe implementar la inserción)
        for(let r=0; r<size; r++) {
            for(let c=0; c<size; c++) {
                if(grid[r][c] === '') grid[r][c] = la_ws_utils.getRandomChar();
            }
        }
        return grid;
    },

    handleSelection(path) {
        const foundWord = this.finder.checkSelection(path);
        if (foundWord) {
            la_ws_ui.updateWordList(this.currentLevel.words, this.finder.foundWords);
            if (this.finder.isLevelComplete()) {
                this.onVictory();
            }
        }
    },

    onVictory() {
        alert(`¡Felicidades! Has ganado ${this.currentLevel.rewardCoins} monedas.`);
        
        [span_1](start_span)[span_2](start_span)// LLAMADA OBLIGATORIA A LOVECARDE[span_1](end_span)[span_2](end_span)
        // Se envía el gameId 'wordsearch', el ID del nivel y las monedas.
        la_ws_rewards.tryPay(this.currentLevel.id, this.currentLevel.rewardCoins);
        
        la_ws_ui.showScreen('la_ws_screen_main');
    },

    renderLoop() {
        if (!this.currentLevel) return;
        this.renderer.draw(this.grid);
        requestAnimationFrame(() => this.renderLoop());
    }
};

// Iniciar al cargar el DOM
window.onload = () => la_ws_game.init();
