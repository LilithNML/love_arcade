import { LevelManager } from './core/LevelManager.js';
import { UI } from './ui/UIController.js';
import { Storage } from './systems/Storage.js';
import { PuzzleEngine } from './core/PuzzleEngine.js';
import { AudioMgr } from './systems/AudioManager.js';
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

function startGame(levelId, loadSaved = false) {
    const levelConfig = levelManager.getLevelById(levelId);
    if (!levelConfig) return;
    currentLevelId = levelId;

    const allLevels = levelManager.getAllLevelsWithStatus();
    const levelIndex = allLevels.findIndex(l => l.id === levelId);
    const lvlDisplay = document.getElementById('hud-level');
    if(lvlDisplay) lvlDisplay.textContent = `LVL ${levelIndex + 1}`;

    if (activeGame) { activeGame.destroy(); activeGame = null; }
    clearInterval(gameTimer);

    UI.showScreen('game');
    
    const bg = document.getElementById('dynamic-bg');
    if(bg) bg.style.backgroundImage = `url('${levelConfig.image}')`;

    const loader = document.getElementById('game-loader');
    if(loader) loader.classList.remove('hidden');

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = levelConfig.image;
    
    img.onload = () => {
        if(loader) loader.classList.add('hidden');
        const canvas = document.getElementById('puzzle-canvas');
        
        activeGame = new PuzzleEngine(canvas, {
            image: img, pieces: levelConfig.pieces
        }, {
            onSound: (t) => AudioMgr.play(t),
            onWin: () => handleVictory(levelConfig),
            onStateChange: () => saveProgress(levelId)
        });

        if (loadSaved) {
            const savedState = Storage.get(`save_${levelId}`);
            if (savedState) activeGame.importState(savedState);
        }

        if (levelConfig.timeLimit && levelConfig.timeLimit > 0) startTimer(levelConfig.timeLimit);
        else {
            const timerDisplay = document.getElementById('hud-timer');
            if(timerDisplay) { timerDisplay.textContent = "∞"; timerDisplay.classList.remove('low-time'); }
        }

        setupGameControls();
    };

    img.onerror = () => {
        if(loader) loader.classList.add('hidden');
        alert("Error cargando la imagen del nivel.");
        UI.showScreen('levels');
    };
}

/* --- FIX NAVEGACIÓN VICTORIA --- */
function handleVictory(levelConfig) {
    clearInterval(gameTimer);
    Storage.markCompleted(levelConfig.id, 0);
    Storage.set(`save_${levelConfig.id}`, null);
    
    const nextLvlId = levelManager.getNextLevelId(levelConfig.id);
    if (nextLvlId) Storage.unlockLevel(nextLvlId);
    
    Economy.payout(levelConfig.id, levelConfig.rewardCoins);
    
    // Mostrar Modal
    const modal = document.getElementById('modal-victory');
    modal.classList.remove('hidden');
    
    // Asignar Datos UI
    document.getElementById('victory-coins').textContent = levelConfig.rewardCoins;
    document.getElementById('victory-time').textContent = document.getElementById('hud-timer').textContent;

    // FIX: Reemplazar botones para asegurar listeners limpios
    const btnNext = document.getElementById('btn-next-level');
    const btnMenu = document.getElementById('btn-victory-menu');
    
    const newBtnNext = btnNext.cloneNode(true);
    const newBtnMenu = btnMenu.cloneNode(true);
    
    btnNext.parentNode.replaceChild(newBtnNext, btnNext);
    btnMenu.parentNode.replaceChild(newBtnMenu, btnMenu);

    // Lógica Botón Siguiente
    if (nextLvlId) {
        newBtnNext.style.display = 'flex';
        newBtnNext.onclick = () => {
            modal.classList.add('hidden');
            startGame(nextLvlId);
        };
    } else {
        newBtnNext.style.display = 'none'; // Ocultar si es el último nivel
    }

    // Lógica Botón Menú
    newBtnMenu.onclick = () => {
        modal.classList.add('hidden');
        if(activeGame) activeGame.destroy();
        UI.showScreen('menu');
    };
}

/* --- CONTROLES Y UTILIDADES --- */
function setupGameControls() {
    const btnPreview = document.getElementById('btn-preview');
    const newBtnPreview = btnPreview.cloneNode(true);
    btnPreview.parentNode.replaceChild(newBtnPreview, btnPreview);
    
    const startP = () => activeGame && activeGame.togglePreview(true);
    const endP = () => activeGame && activeGame.togglePreview(false);
    
    newBtnPreview.addEventListener('mousedown', startP);
    newBtnPreview.addEventListener('mouseup', endP);
    newBtnPreview.addEventListener('mouseleave', endP);
    newBtnPreview.addEventListener('touchstart', (e) => { e.preventDefault(); startP(); });
    newBtnPreview.addEventListener('touchend', endP);

    const btnMagnet = document.getElementById('btn-magnet');
    const newBtnMagnet = btnMagnet.cloneNode(true);
    btnMagnet.parentNode.replaceChild(newBtnMagnet, btnMagnet);

    newBtnMagnet.onclick = () => {
        if (!window.GameCenter) {
            if(confirm("Modo Offline: ¿Usar Imán gratis?")) {
                const placed = activeGame.autoPlacePiece();
                if(!placed) alert("¡No quedan piezas sueltas!");
            }
            return;
        }
        const balance = window.GameCenter.getBalance ? window.GameCenter.getBalance() : 0;
        const COST = 10;
        if (balance < COST) { alert(`Saldo insuficiente.\nTienes: ${balance} 💰`); return; }
        if(confirm(`¿Usar Imán por ${COST} monedas?`)) {
            const result = window.GameCenter.buyItem({ id: 'magnet', price: COST });
            if (result && result.success) {
                const placed = activeGame.autoPlacePiece();
                if(!placed) alert("¡No quedan piezas!");
            } else alert("Error transacción.");
        }
    };
}

function setupNavigation() {
    document.getElementById('btn-play').onclick = () => { refreshLevelsScreen(); UI.showScreen('levels'); };
    document.getElementById('btn-levels').onclick = () => { refreshLevelsScreen(); UI.showScreen('levels'); };
    document.getElementById('btn-settings').onclick = () => UI.showScreen('settings');

    document.getElementById('btn-pause').onclick = () => {
        document.getElementById('modal-pause').classList.remove('hidden');
    };

    document.querySelectorAll('.btn-back').forEach(b => b.onclick = (e) => {
        const t = e.currentTarget.dataset.target;
        if(activeGame) { activeGame.destroy(); activeGame = null; clearInterval(gameTimer); }
        UI.showScreen(t);
    });

    // Fix botón abandonar en pausa
    document.getElementById('btn-resume').onclick = () => document.getElementById('modal-pause').classList.add('hidden');
    document.getElementById('btn-quit-level').onclick = () => {
        document.getElementById('modal-pause').classList.add('hidden');
        if(activeGame) activeGame.destroy();
        clearInterval(gameTimer);
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
            const btnYes = document.getElementById('btn-yes-resume');
            const btnNo = document.getElementById('btn-no-resume');
            const newYes = btnYes.cloneNode(true);
            const newNo = btnNo.cloneNode(true);
            btnYes.parentNode.replaceChild(newYes, btnYes);
            btnNo.parentNode.replaceChild(newNo, btnNo);

            newYes.onclick = () => { modal.classList.add('hidden'); startGame(id, true); };
            newNo.onclick = () => { modal.classList.add('hidden'); Storage.set(`save_${id}`, null); startGame(id, false); };
        } else {
            startGame(id, false);
        }
    });
}

function startTimer(seconds) {
    let timeLeft = seconds;
    const display = document.getElementById('hud-timer');
    if(!display) return;
    display.classList.remove('low-time');
    updateTimerDisplay(timeLeft);
    gameTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);
        if (timeLeft <= 10) display.classList.add('low-time');
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            if(activeGame) activeGame.destroy();
            document.getElementById('modal-gameover').classList.remove('hidden');
        }
    }, 1000);
}

function updateTimerDisplay(s) {
    const m = Math.floor(s/60).toString().padStart(2,'0');
    const sc = (s%60).toString().padStart(2,'0');
    const el = document.getElementById('hud-timer');
    if(el) el.textContent = `${m}:${sc}`;
}

function saveProgress(lid) { if(activeGame) Storage.set(`save_${lid}`, activeGame.exportState()); }

function setupSettings() {
    const chk = document.getElementById('setting-sound');
    if(chk) chk.addEventListener('change', () => { 
        const s = Storage.get('settings'); s.sound = chk.checked; Storage.set('settings', s); 
    });
    const btnReset = document.getElementById('btn-reset-progress');
    if(btnReset) {
        btnReset.onclick = () => {
            if(confirm("¿Borrar todo el progreso?")) { 
                localStorage.removeItem('puz_rompecabezas_progress'); 
                location.reload(); 
            }
        };
    }
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => { if(activeGame) activeGame.handleResize(); }, 100);
});

window.addEventListener('DOMContentLoaded', init);
        
