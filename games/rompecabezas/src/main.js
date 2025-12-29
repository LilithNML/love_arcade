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
    setupNavigation(); // Configura TODOS los botones
    setupSettings();
    UI.showScreen('menu');
}

function startGame(levelId, loadSaved = false) {
    const levelConfig = levelManager.getLevelById(levelId);
    if (!levelConfig) return;
    currentLevelId = levelId;

    if (activeGame) { activeGame.destroy(); activeGame = null; }
    clearInterval(gameTimer);

    UI.showScreen('game');
    
    const bg = document.getElementById('dynamic-bg');
    bg.style.backgroundImage = `url('${levelConfig.image}')`;

    const loader = document.getElementById('game-loader');
    loader.classList.remove('hidden');

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = levelConfig.image;
    
    img.onload = () => {
        loader.classList.add('hidden');
        const canvas = document.getElementById('puzzle-canvas');
        
        activeGame = new PuzzleEngine(canvas, {
            image: img, pieces: levelConfig.pieces
        }, {
            onSound: (t) => AudioSynth.play(t),
            onWin: () => handleVictory(levelConfig),
            onStateChange: () => saveProgress(levelId)
        });

        if (loadSaved) {
            const savedState = Storage.get(`save_${levelId}`);
            if (savedState) activeGame.importState(savedState);
        }

        if (levelConfig.timeLimit) startTimer(levelConfig.timeLimit);
        else document.getElementById('hud-timer').textContent = "∞";

        // IMPORTANTE: Configurar botones in-game cada vez que inicia
        setupGameControls();
    };

    img.onerror = () => {
        loader.classList.add('hidden');
        alert("Error cargando la imagen del nivel.");
        UI.showScreen('levels');
    };
}

function setupGameControls() {
    const btnPreview = document.getElementById('btn-preview');
    // Eliminar eventos previos para evitar duplicados (clonando)
    const newBtnPreview = btnPreview.cloneNode(true);
    btnPreview.parentNode.replaceChild(newBtnPreview, btnPreview);
    
    const startP = () => activeGame && activeGame.togglePreview(true);
    const endP = () => activeGame && activeGame.togglePreview(false);
    
    newBtnPreview.addEventListener('mousedown', startP);
    newBtnPreview.addEventListener('mouseup', endP);
    newBtnPreview.addEventListener('mouseleave', endP);
    newBtnPreview.addEventListener('touchstart', (e) => { e.preventDefault(); startP(); });
    newBtnPreview.addEventListener('touchend', endP);

    // Botón Imán con ECONOMÍA REAL
    const btnMagnet = document.getElementById('btn-magnet');
    const newBtnMagnet = btnMagnet.cloneNode(true);
    btnMagnet.parentNode.replaceChild(newBtnMagnet, btnMagnet);

    newBtnMagnet.onclick = () => {
        if (!window.GameCenter) {
            alert("Modo Offline: El imán es gratis.");
            activeGame.autoPlacePiece();
            return;
        }

        const balance = window.GameCenter.getBalance();
        if (balance < 10) {
            alert(`No tienes suficientes monedas. Tienes: ${balance}, Costo: 10.`);
            return;
        }

        if(confirm(`¿Usar Imán por 10 monedas?\nSaldo actual: ${balance}`)) {
            // Comprar ítem "magnet_use"
            const result = window.GameCenter.buyItem({
                id: 'magnet_use', // ID único para este consumible
                price: 10,
                stock: 999999 // Stock infinito virtual
            });

            if (result.success) {
                const placed = activeGame.autoPlacePiece();
                if(!placed) alert("¡No quedan piezas sueltas!");
            } else {
                alert("Error en la transacción.");
            }
        }
    };
}

function setupNavigation() {
    // Botones Menú Principal
    document.getElementById('btn-play').onclick = () => { refreshLevelsScreen(); UI.showScreen('levels'); };
    document.getElementById('btn-levels').onclick = () => { refreshLevelsScreen(); UI.showScreen('levels'); };
    document.getElementById('btn-settings').onclick = () => UI.showScreen('settings');

    // Botón Pausa
    document.getElementById('btn-pause').onclick = () => {
        document.getElementById('modal-pause').classList.remove('hidden');
    };

    // Botones Atrás
    document.querySelectorAll('.btn-back').forEach(b => b.onclick = (e) => {
        const t = e.currentTarget.dataset.target;
        if(activeGame) { activeGame.destroy(); activeGame = null; clearInterval(gameTimer); }
        UI.showScreen(t);
    });

    // Modales
    document.getElementById('btn-resume').onclick = () => document.getElementById('modal-pause').classList.add('hidden');
    document.getElementById('btn-quit-level').onclick = () => {
        document.getElementById('modal-pause').classList.add('hidden');
        if(activeGame) activeGame.destroy();
        UI.showScreen('menu');
    };

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
        if(Storage.get(`save_${id}`)) {
            const modal = document.getElementById('modal-resume');
            modal.classList.remove('hidden');
            
            // Re-asignar eventos del modal resume dinámicamente
            const btnYes = document.getElementById('btn-yes-resume');
            const btnNo = document.getElementById('btn-no-resume');
            
            // Clonar para limpiar listeners viejos
            const newBtnYes = btnYes.cloneNode(true);
            const newBtnNo = btnNo.cloneNode(true);
            btnYes.parentNode.replaceChild(newBtnYes, btnYes);
            btnNo.parentNode.replaceChild(newBtnNo, btnNo);

            newBtnYes.onclick = () => { modal.classList.add('hidden'); startGame(id, true); };
            newBtnNo.onclick = () => { modal.classList.add('hidden'); Storage.set(`save_${id}`, null); startGame(id, false); };
        } else {
            startGame(id, false);
        }
    });
}

function handleVictory(levelConfig) {
    clearInterval(gameTimer);
    Storage.markCompleted(levelConfig.id, 0);
    Storage.set(`save_${levelConfig.id}`, null);
    
    const nextLvlId = levelManager.getNextLevelId(levelConfig.id);
    if (nextLvlId) Storage.unlockLevel(nextLvlId);
    
    Economy.payout(levelConfig.id, levelConfig.rewardCoins);
    
    UI.showVictoryModal(levelConfig.rewardCoins, "WIN", 
        () => nextLvlId ? startGame(nextLvlId) : UI.showScreen('menu'), 
        () => UI.showScreen('menu')
    );
}

// Utils Timer/Save/Settings... (Se mantienen simplificados aquí)
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
function updateTimerDisplay(s) {
    const m = Math.floor(s/60).toString().padStart(2,'0');
    const sc = (s%60).toString().padStart(2,'0');
    document.getElementById('hud-timer').textContent = `${m}:${sc}`;
}
function saveProgress(lid) { if(activeGame) Storage.set(`save_${lid}`, activeGame.exportState()); }
function setupSettings() {
    const chk = document.getElementById('setting-sound');
    if(chk) chk.addEventListener('change', () => { 
        const s = Storage.get('settings'); s.sound = chk.checked; Storage.set('settings', s); 
    });
    document.getElementById('btn-reset-progress').onclick = () => {
        if(confirm("¿Borrar todo?")) { localStorage.removeItem('puz_rompecabezas_progress'); location.reload(); }
    };
}

window.addEventListener('DOMContentLoaded', init);
        
