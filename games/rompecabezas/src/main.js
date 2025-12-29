import { LevelManager } from './core/LevelManager.js';
import { UI } from './ui/UIController.js';
import { Storage } from './systems/Storage.js';
import { PuzzleEngine } from './core/PuzzleEngine.js';
import { AudioSynth } from './systems/AudioSynth.js';
import { Economy } from './systems/Economy.js';

const levelManager = new LevelManager();
let activeGame = null;
let gameTimer = null;
let currentLevelId = null;

async function init() {
    await levelManager.loadLevels();
    setupNavigation();
    setupSettings();
    UI.showScreen('menu');
}

/* --- LOGICA PRINCIPAL DE JUEGO --- */
function startGame(levelId, loadSaved = false) {
    const levelConfig = levelManager.getLevelById(levelId);
    if (!levelConfig) return;
    currentLevelId = levelId;

    if (activeGame) { activeGame.destroy(); activeGame = null; }
    clearInterval(gameTimer);

    UI.showScreen('game');
    
    // Configurar Fondo Dinámico
    const bg = document.getElementById('dynamic-bg');
    bg.style.backgroundImage = `url('${levelConfig.image}')`;

    // Mostrar Loader
    const loader = document.getElementById('game-loader');
    loader.classList.remove('hidden');

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = levelConfig.image;
    
    img.onload = () => {
        loader.classList.add('hidden');
        const canvas = document.getElementById('puzzle-canvas');
        
        // Iniciar Engine
        activeGame = new PuzzleEngine(canvas, {
            image: img, pieces: levelConfig.pieces
        }, {
            onSound: (t) => AudioSynth.play(t),
            onWin: () => handleVictory(levelConfig),
            onStateChange: () => saveProgress(levelId) // Guardado automático
        });

        // Cargar estado guardado si aplica
        if (loadSaved) {
            const savedState = Storage.get(`save_${levelId}`);
            if (savedState) activeGame.importState(savedState);
        }

        // Iniciar Timer si hay límite
        if (levelConfig.timeLimit) startTimer(levelConfig.timeLimit);
        else document.getElementById('hud-timer').textContent = "∞";

        // Setup controles in-game
        setupGameControls();
    };

    img.onerror = () => {
        loader.classList.add('hidden');
        alert("Error cargando la imagen del nivel (Fallback activado).");
        // Aquí podrías cargar una imagen local por defecto
        UI.showScreen('levels');
    };
}

/* --- FEATURES & UTILS --- */
function startTimer(seconds) {
    let left = seconds;
    const display = document.getElementById('hud-timer');
    display.classList.remove('low-time');
    
    updateTimerDisplay(left);
    
    gameTimer = setInterval(() => {
        left--;
        updateTimerDisplay(left);
        if (left <= 10) display.classList.add('low-time');
        
        if (left <= 0) {
            clearInterval(gameTimer);
            if(activeGame) activeGame.destroy();
            document.getElementById('modal-gameover').classList.remove('hidden');
        }
    }, 1000);
}

function updateTimerDisplay(seconds) {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('hud-timer').textContent = `${min}:${sec}`;
}

function saveProgress(levelId) {
    if (!activeGame) return;
    const state = activeGame.exportState();
    Storage.set(`save_${levelId}`, state);
}

/* --- UI HELPERS --- */
function setupGameControls() {
    // Botón Ojo (Preview)
    const btnPreview = document.getElementById('btn-preview');
    const startP = () => activeGame && activeGame.togglePreview(true);
    const endP = () => activeGame && activeGame.togglePreview(false);
    
    btnPreview.onmousedown = startP; btnPreview.onmouseup = endP;
    btnPreview.ontouchstart = (e) => { e.preventDefault(); startP(); };
    btnPreview.ontouchend = endP;

    // Botón Imán
    document.getElementById('btn-magnet').onclick = () => {
        // Simular gasto (si existiera método de gasto en Economy/GameCenter)
        // Por ahora asumimos que siempre puede o verificamos saldo visualmente
        if(confirm("¿Usar imán por 10 monedas?")) {
            // Aquí llamarías a window.GameCenter.spendCoins(10) si existiera
            const success = activeGame.autoPlacePiece();
            if(!success) alert("¡Ya no quedan piezas sueltas!");
        }
    };
}

/* --- NAVIGATION & EVENTS --- */
function setupNavigation() {
    // Lógica Resume
    const checkResume = (levelId) => {
        if(Storage.get(`save_${levelId}`)) {
            const modal = document.getElementById('modal-resume');
            modal.classList.remove('hidden');
            document.getElementById('btn-yes-resume').onclick = () => {
                modal.classList.add('hidden'); startGame(levelId, true);
            };
            document.getElementById('btn-no-resume').onclick = () => {
                modal.classList.add('hidden'); Storage.set(`save_${levelId}`, null); startGame(levelId, false);
            };
        } else {
            startGame(levelId, false);
        }
    };

    document.getElementById('btn-play').onclick = () => { 
        refreshLevelsScreen(); UI.showScreen('levels'); 
    };
    
    document.getElementById('btn-levels').onclick = () => { 
        refreshLevelsScreen(); UI.showScreen('levels'); 
    };

    document.querySelectorAll('.btn-back').forEach(b => b.onclick = (e) => {
        const t = e.currentTarget.dataset.target;
        if(activeGame) { activeGame.destroy(); activeGame = null; clearInterval(gameTimer); }
        UI.showScreen(t);
    });

    // Modales
    document.getElementById('btn-retry').onclick = () => {
        document.getElementById('modal-gameover').classList.add('hidden');
        startGame(currentLevelId, false);
    };
    document.getElementById('btn-quit-fail').onclick = () => {
        document.getElementById('modal-gameover').classList.add('hidden');
        UI.showScreen('menu');
    };
}

function refreshLevelsScreen() {
    const levels = levelManager.getAllLevelsWithStatus();
    UI.renderLevelsGrid(levels, (id) => {
        // Chequear savegame antes de iniciar
        if(Storage.get(`save_${id}`)) {
            const modal = document.getElementById('modal-resume');
            modal.classList.remove('hidden');
            document.getElementById('btn-yes-resume').onclick = () => { modal.classList.add('hidden'); startGame(id, true); };
            document.getElementById('btn-no-resume').onclick = () => { modal.classList.add('hidden'); Storage.set(`save_${id}`, null); startGame(id, false); };
        } else {
            startGame(id, false);
        }
    });
}

function handleVictory(levelConfig) {
    clearInterval(gameTimer);
    Storage.markCompleted(levelConfig.id, 0); // Tiempo dummy, se podría pasar el real
    Storage.set(`save_${levelConfig.id}`, null); // Borrar save al ganar
    
    const nextLvlId = levelManager.getNextLevelId(levelConfig.id);
    if (nextLvlId) Storage.unlockLevel(nextLvlId);
    
    Economy.payout(levelConfig.id, levelConfig.rewardCoins);
    
    UI.showVictoryModal(levelConfig.rewardCoins, "WIN", 
        () => nextLvlId ? startGame(nextLvlId) : UI.showScreen('menu'), 
        () => UI.showScreen('menu')
    );
}

function setupSettings() { /* (Igual que versión anterior) */ }

// DEBOUNCE RESIZE
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if(activeGame) activeGame.handleResize();
    }, 100);
});

window.addEventListener('DOMContentLoaded', init);
