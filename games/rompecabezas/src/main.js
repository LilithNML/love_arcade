import { LevelManager } from './core/LevelManager.js';
import { UI }            from './ui/UIController.js';
import { Storage }       from './systems/Storage.js';
import { PuzzleEngine }  from './core/PuzzleEngine.js';
import { AudioSynth }    from './systems/AudioSynth.js';
import { Economy }       from './systems/Economy.js';

const levelManager = new LevelManager();
let activeGame     = null;
let currentLevelId = null;

const GameState = {
    isPaused: false,
    isInGame: false
};

async function init() {
    console.log('[Main] Iniciando Rompecabezas Arcade v8.0...');

    await levelManager.loadLevels();
    Storage.validateUnlockedLevels(levelManager.levels);

    UI.initGlobalInteractions();

    setupAutoPause();
    setupNavigation();
    setupSettings();

    setupDevTools();

    UI.showScreen('menu');
}

function setupDevTools() {
    window.dev = {
        unlockAll() {
            levelManager.levels.forEach(l => Storage.unlockLevel(l.id));
            console.log(`[Dev] ✅ ${levelManager.levels.length} niveles desbloqueados.`);
        },
        addCoins(n) {
            if (!Number.isInteger(n) || n <= 0) {
                console.warn('[Dev] addCoins() requiere un entero positivo.');
                return;
            }
            if (window.GameCenter && typeof window.GameCenter.addCoins === 'function') {
                window.GameCenter.addCoins(n);
                console.log(`[Dev] ✅ +${n} monedas añadidas via GameCenter.`);
            } else {
                console.warn(`[Dev] GameCenter no disponible. Simulación: +${n} monedas (sin efecto real).`);
            }
        },
        skipLevel() {
            if (!currentLevelId || !activeGame) {
                console.warn('[Dev] No hay ningún nivel activo. Inicia una partida primero.');
                return;
            }
            const levelConfig = levelManager.getLevelById(currentLevelId);
            if (!levelConfig) {
                console.warn(`[Dev] Nivel "${currentLevelId}" no encontrado.`);
                return;
            }
            console.log(`[Dev] ✅ Saltando nivel ${currentLevelId} con 3 estrellas.`);
            handleVictory(levelConfig);
        }
    };
    console.log('[Dev] Herramientas disponibles: dev.unlockAll() · dev.addCoins(n) · dev.skipLevel()');
}

/**
 * Carga y lanza una partida para el nivel indicado.
 *
 * Flujo de carga de imagen (v8.0):
 *   1. Se crea un HTMLImageElement con crossOrigin para cumplir CORS.
 *   2. img.decode() — espera la decodificación en el hilo principal.
 *   3. createImageBitmap(img) — transfiere la imagen a un ImageBitmap,
 *      que es decodificado/procesado fuera del hilo principal (OffscreenCanvas).
 *      Esto evita que el parseo de 1600×1600px bloquee la UI al construir
 *      el sourceCanvas dentro de PuzzleEngine.
 *   4. Se pasa el ImageBitmap como config.image. Al terminar la partida
 *      PuzzleEngine llama a imageBitmap.close() desde destroy(), liberando
 *      la memoria de la textura inmediatamente.
 *
 * Si createImageBitmap no está disponible en el navegador (navegadores
 * muy antiguos), se hace fallback al HTMLImageElement directamente con
 * un aviso en consola; el juego continúa funcionando sin degradación
 * funcional.
 *
 * @param {string}  levelId     ID del nivel a cargar (ej. "lvl_5").
 * @param {boolean} loadSaved   Si true, intenta restaurar la partida guardada.
 */
async function startGame(levelId, loadSaved = false) {
    const levelConfig = levelManager.getLevelById(levelId);
    if (!levelConfig) return;

    currentLevelId     = levelId;
    GameState.isInGame = false;
    GameState.isPaused = false;

    const allLevels  = levelManager.getAllLevelsWithStatus();
    const levelIndex = allLevels.findIndex(l => l.id === levelId);
    const lvlDisplay = document.getElementById('hud-level');
    if (lvlDisplay) lvlDisplay.textContent = `LVL ${levelIndex + 1}`;

    if (activeGame) { activeGame.destroy(); activeGame = null; }

    UI.showScreen('game');

    const bg = document.getElementById('dynamic-bg');
    if (bg) bg.style.backgroundImage = `url('${levelConfig.image}')`;

    const puzzleCanvas = document.getElementById('puzzle-canvas');
    if (puzzleCanvas) puzzleCanvas.style.opacity = '0';

    const loader = document.getElementById('game-loader');
    if (loader) loader.classList.remove('hidden');

    const img = new Image();
    img.crossOrigin    = 'Anonymous';
    img.fetchPriority  = 'high';
    img.src            = levelConfig.image;

    try {
        // Paso 1: decodificar en el hilo principal.
        await img.decode();

        // Paso 2: transferir a ImageBitmap para liberar al hilo principal
        // del procesamiento de textura en PuzzleEngine.resizeCanvas().
        // createImageBitmap retorna una Promise y resuelve en un worker
        // interno del navegador en navegadores modernos (Chrome 50+, Firefox 42+,
        // Safari 15+). En entornos sin soporte se usa el img como fallback.
        let imageSource = img;
        if (typeof createImageBitmap === 'function') {
            try {
                imageSource = await createImageBitmap(img);
            } catch (bitmapErr) {
                console.warn('[Main] createImageBitmap falló, usando HTMLImageElement.', bitmapErr);
            }
        }

        if (loader) loader.classList.add('hidden');

        activeGame = new PuzzleEngine(puzzleCanvas, { image: imageSource, pieces: levelConfig.pieces }, {
            onSound:      (t) => AudioSynth.play(t),
            onWin:        () => handleVictory(levelConfig),
            onStateChange: () => saveProgress(levelId),
            onSnap: () => {
                if (navigator.vibrate) navigator.vibrate([30, 20, 10]);
            }
        });

        if (loadSaved) {
            const savedState = Storage.get(`save_${levelId}`);
            if (savedState) activeGame.importState(savedState);
        }

        requestAnimationFrame(() => {
            if (puzzleCanvas) puzzleCanvas.style.opacity = '1';
        });

        GameState.isInGame = true;
        setupGameControls();

    } catch (err) {
        console.error('[Main] Error cargando imagen del nivel:', err);
        if (loader) loader.classList.add('hidden');
        if (puzzleCanvas) puzzleCanvas.style.opacity = '1';
        UI.showAlert('Error', 'Error cargando la imagen del nivel. Verifica tu conexión.');
        UI.showScreen('levels');
    }
}

function handleVictory(levelConfig) {
    GameState.isInGame = false;

    Storage.markCompleted(levelConfig.id);
    Storage.set(`save_${levelConfig.id}`, null);

    const nextLvlId = levelManager.getNextLevelId(levelConfig.id);
    if (nextLvlId) Storage.unlockLevel(nextLvlId);

    Economy.payout(levelConfig.id, levelConfig.rewardCoins);

    if (navigator.vibrate) navigator.vibrate([100, 50, 80, 50, 200]);

    UI.showVictoryModal(levelConfig.rewardCoins,
        () => { if (nextLvlId) startGame(nextLvlId); },
        () => { if (activeGame) activeGame.destroy(); UI.showScreen('menu'); }
    );
}

function togglePause(shouldPause) {
    if (!GameState.isInGame) return;

    GameState.isPaused = shouldPause;

    if (shouldPause) {
        if (activeGame) activeGame.cancelDrag();
        document.getElementById('modal-pause').classList.remove('hidden');
    } else {
        document.getElementById('modal-pause').classList.add('hidden');
    }
}

function setupAutoPause() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) togglePause(true);
    });

    window.addEventListener('blur', () => {
        togglePause(true);
    });
}

function setupGameControls() {
    const btnPreview    = document.getElementById('btn-preview');
    const newBtnPreview = btnPreview.cloneNode(true);
    btnPreview.parentNode.replaceChild(newBtnPreview, btnPreview);

    const startP = () => activeGame && activeGame.togglePreview(true);
    const endP   = () => activeGame && activeGame.togglePreview(false);
    newBtnPreview.addEventListener('mousedown', startP);
    newBtnPreview.addEventListener('mouseup', endP);
    newBtnPreview.addEventListener('mouseleave', endP);
    newBtnPreview.addEventListener('touchstart', (e) => { e.preventDefault(); startP(); });
    newBtnPreview.addEventListener('touchend', endP);

    const btnMagnet    = document.getElementById('btn-magnet');
    const newBtnMagnet = btnMagnet.cloneNode(true);
    btnMagnet.parentNode.replaceChild(newBtnMagnet, btnMagnet);

    newBtnMagnet.onclick = () => {
        if (!window.GameCenter) {
            UI.showConfirm('Modo Pruebas', '¿Usar Imán gratis?', () => {
                const placed = activeGame.autoPlacePiece();
                if (!placed) UI.showAlert('Aviso', '¡No quedan piezas sueltas!');
            });
            return;
        }
        const balance = window.GameCenter.getBalance ? window.GameCenter.getBalance() : 0;
        const COST    = 10;
        if (balance < COST) {
            UI.showAlert('Saldo insuficiente', `Costo: ${COST}\nTienes: ${balance} 💰`);
            return;
        }
        UI.showConfirm('Comprar Imán', `¿Usar Imán por ${COST} monedas?`, () => {
            const result = window.GameCenter.buyItem({ id: 'magnet', price: COST });
            if (result?.success) {
                const placed = activeGame.autoPlacePiece();
                if (!placed) UI.showAlert('Aviso', '¡El rompecabezas ya está resuelto!');
            } else {
                UI.showAlert('Error', 'Error en la transacción.');
            }
        });
    };
}

function setupNavigation() {
    document.getElementById('btn-play').onclick = () => {
        const levels        = levelManager.getAllLevelsWithStatus();
        const firstUnplayed = levels.find(l => l.status === 'unlocked');

        let levelToPlayId;
        if (firstUnplayed) {
            levelToPlayId = firstUnplayed.id;
        } else {
            const unlockedLevels = levels.filter(l => l.status === 'completed' || l.status === 'unlocked');
            levelToPlayId = unlockedLevels[unlockedLevels.length - 1].id;
        }

        if (Storage.get(`save_${levelToPlayId}`)) {
            const modal  = document.getElementById('modal-resume');
            modal.classList.remove('hidden');
            const btnYes = document.getElementById('btn-yes-resume');
            const btnNo  = document.getElementById('btn-no-resume');
            const newYes = btnYes.cloneNode(true);
            const newNo  = btnNo.cloneNode(true);
            btnYes.parentNode.replaceChild(newYes, btnYes);
            btnNo.parentNode.replaceChild(newNo, btnNo);
            newYes.onclick = () => { modal.classList.add('hidden'); startGame(levelToPlayId, true); };
            newNo.onclick  = () => { modal.classList.add('hidden'); Storage.set(`save_${levelToPlayId}`, null); startGame(levelToPlayId, false); };
        } else {
            startGame(levelToPlayId, false);
        }
    };

    document.getElementById('btn-levels').onclick   = () => { refreshLevelsScreen(); UI.showScreen('levels'); };
    document.getElementById('btn-settings').onclick = () => UI.showScreen('settings');
    document.getElementById('btn-exit').onclick     = () => { window.location.href = '../../index.html'; };

    document.getElementById('btn-pause').onclick = () => togglePause(true);

    document.querySelectorAll('.btn-back').forEach(b => b.onclick = (e) => {
        const t = e.currentTarget.dataset.target;
        if (activeGame) { activeGame.destroy(); activeGame = null; }
        GameState.isInGame = false;
        UI.showScreen(t);
    });

    document.getElementById('btn-resume').onclick = () => togglePause(false);

    document.getElementById('btn-quit-level').onclick = () => {
        document.getElementById('modal-pause').classList.add('hidden');
        if (activeGame) activeGame.destroy();
        GameState.isInGame = false;
        if (currentLevelId) saveProgress(currentLevelId);
        UI.showScreen('menu');
    };
}

function refreshLevelsScreen() {
    const levels = levelManager.getAllLevelsWithStatus();
    UI.renderLevelsGrid(levels, (id) => {
        if (Storage.get(`save_${id}`)) {
            const modal  = document.getElementById('modal-resume');
            modal.classList.remove('hidden');
            const btnYes = document.getElementById('btn-yes-resume');
            const btnNo  = document.getElementById('btn-no-resume');
            const newYes = btnYes.cloneNode(true);
            const newNo  = btnNo.cloneNode(true);
            btnYes.parentNode.replaceChild(newYes, btnYes);
            btnNo.parentNode.replaceChild(newNo, btnNo);
            newYes.onclick = () => { modal.classList.add('hidden'); startGame(id, true); };
            newNo.onclick  = () => { modal.classList.add('hidden'); Storage.set(`save_${id}`, null); startGame(id, false); };
        } else {
            startGame(id, false);
        }
    });
}

function saveProgress(lid) {
    if (activeGame) Storage.set(`save_${lid}`, activeGame.exportState());
}

function setupSettings() {
    const chk = document.getElementById('setting-sound');
    if (chk) chk.addEventListener('change', () => {
        const s = Storage.get('settings') || {};
        s.sound = chk.checked;
        Storage.set('settings', s);
        if (AudioSynth) AudioSynth.enabled = chk.checked;
    });
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => { if (activeGame) activeGame.handleResize(); }, 100);
}, { passive: true });

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
        .then(regs => regs.forEach(r => r.unregister()))
        .catch(() => {});
}

window.addEventListener('DOMContentLoaded', init);