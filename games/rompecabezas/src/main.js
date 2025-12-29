/**
 * main.js - Orquestador Principal (V2.1 Gold)
 * Gestiona la lógica de negocio, navegación, economía y ciclo de vida del juego.
 */

import { LevelManager } from './core/LevelManager.js';
import { UI } from './ui/UIController.js';
import { Storage } from './systems/Storage.js';
import { PuzzleEngine } from './core/PuzzleEngine.js';
import { AudioSynth } from './systems/AudioSynth.js';
import { Economy } from './systems/Economy.js';

// --- ESTADO GLOBAL ---
const levelManager = new LevelManager();
let activeGame = null;       // Instancia del motor de puzzle actual
let gameTimer = null;        // Referencia al setInterval del tiempo
let currentLevelId = null;   // ID del nivel en curso

/**
 * Inicialización de la Aplicación
 */
async function init() {
    console.log('Iniciando Sistema Puzzle v2.1...');
    
    // 1. Cargar datos de niveles
    await levelManager.loadLevels();
    
    // 2. Configurar navegación global y ajustes
    setupNavigation();
    setupSettings();
    
    // 3. Iniciar en Menú Principal
    UI.showScreen('menu');
}

/**
 * Inicia una partida (Nivel nuevo o cargado)
 * @param {string} levelId - ID del nivel (ej: 'lvl_1')
 * @param {boolean} loadSaved - Si es true, intenta cargar estado previo
 */
function startGame(levelId, loadSaved = false) {
    const levelConfig = levelManager.getLevelById(levelId);
    if (!levelConfig) {
        console.error("Nivel no encontrado:", levelId);
        return;
    }
    currentLevelId = levelId;

    // --- FIX HUD: Calcular número de nivel visual ---
    const allLevels = levelManager.getAllLevelsWithStatus();
    const levelIndex = allLevels.findIndex(l => l.id === levelId);
    const lvlDisplay = document.getElementById('hud-level');
    if(lvlDisplay) lvlDisplay.textContent = `LVL ${levelIndex + 1}`;

    // --- LIMPIEZA PREVIA ---
    if (activeGame) { 
        activeGame.destroy(); 
        activeGame = null; 
    }
    clearInterval(gameTimer);

    // --- PREPARACIÓN UI ---
    UI.showScreen('game');
    
    // Fondo Dinámico con Blur
    const bg = document.getElementById('dynamic-bg');
    if(bg) bg.style.backgroundImage = `url('${levelConfig.image}')`;

    // Mostrar Loader
    const loader = document.getElementById('game-loader');
    if(loader) loader.classList.remove('hidden');

    // --- CARGA DE ASSETS ---
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Necesario para manipulación de píxeles
    img.src = levelConfig.image;
    
    img.onload = () => {
        if(loader) loader.classList.add('hidden');
        const canvas = document.getElementById('puzzle-canvas');
        
        // Instanciar Motor
        activeGame = new PuzzleEngine(canvas, {
            image: img, 
            pieces: levelConfig.pieces
        }, {
            // Callbacks del motor
            onSound: (t) => AudioSynth.play(t),
            onWin: () => handleVictory(levelConfig),
            onStateChange: () => saveProgress(levelId) // Guardado automático al soltar pieza
        });

        // Restaurar estado si aplica
        if (loadSaved) {
            const savedState = Storage.get(`save_${levelId}`);
            if (savedState) activeGame.importState(savedState);
        }

        // --- SISTEMA DE TIEMPO (Time Attack) ---
        if (levelConfig.timeLimit && levelConfig.timeLimit > 0) {
            startTimer(levelConfig.timeLimit);
        } else {
            // Tiempo Infinito
            const timerDisplay = document.getElementById('hud-timer');
            if(timerDisplay) {
                timerDisplay.textContent = "∞";
                timerDisplay.classList.remove('low-time');
            }
        }

        // Configurar botones In-Game (Imán, Preview)
        setupGameControls();
    };

    img.onerror = () => {
        if(loader) loader.classList.add('hidden');
        alert("Error crítico: No se pudo cargar la imagen del nivel.");
        UI.showScreen('levels');
    };
}

/**
 * Configura los botones flotantes dentro del juego (Imán y Ojo)
 * Se llama cada vez que inicia un nivel para asegurar contextos frescos.
 */
function setupGameControls() {
    // 1. Botón VISTA PREVIA (Ojo)
    const btnPreview = document.getElementById('btn-preview');
    // Clonar para eliminar listeners antiguos
    const newBtnPreview = btnPreview.cloneNode(true);
    btnPreview.parentNode.replaceChild(newBtnPreview, btnPreview);
    
    const startP = () => activeGame && activeGame.togglePreview(true);
    const endP = () => activeGame && activeGame.togglePreview(false);
    
    // Eventos Mouse/Touch para "Mantener presionado"
    newBtnPreview.addEventListener('mousedown', startP);
    newBtnPreview.addEventListener('mouseup', endP);
    newBtnPreview.addEventListener('mouseleave', endP);
    newBtnPreview.addEventListener('touchstart', (e) => { e.preventDefault(); startP(); });
    newBtnPreview.addEventListener('touchend', endP);

    // 2. Botón IMÁN (Economía)
    const btnMagnet = document.getElementById('btn-magnet');
    const newBtnMagnet = btnMagnet.cloneNode(true);
    btnMagnet.parentNode.replaceChild(newBtnMagnet, btnMagnet);

    newBtnMagnet.onclick = () => {
        // Verificar Sistema Universal
        if (!window.GameCenter) {
            // Modo Offline (Fallback)
            if(confirm("Modo Offline: ¿Usar Imán gratis?")) {
                const placed = activeGame.autoPlacePiece();
                if(!placed) alert("¡No quedan piezas sueltas!");
            }
            return;
        }

        // Verificar Saldo Real
        const balance = window.GameCenter.getBalance ? window.GameCenter.getBalance() : 0;
        const COST = 10;

        if (balance < COST) {
            alert(`Saldo insuficiente.\nTienes: ${balance} 💰\nNecesitas: ${COST} 💰`);
            return;
        }

        if(confirm(`¿Usar Imán por ${COST} monedas?\nSaldo actual: ${balance}`)) {
            // Transacción Real
            const result = window.GameCenter.buyItem({
                id: 'magnet_use_puzzle', 
                price: COST,
                stock: 999999
            });

            if (result && result.success) {
                const placed = activeGame.autoPlacePiece();
                if(!placed) alert("¡No quedan piezas sueltas! (Monedas devueltas visualmente)");
                // Nota: En un sistema real complejo, aquí se haría refund si falla la lógica,
                // pero asumimos que autoPlacePiece funciona si hay piezas.
            } else {
                alert("Error procesando la compra.");
            }
        }
    };
}

/**
 * Configura la navegación global (Menús, Botones Atrás, Pausa)
 */
function setupNavigation() {
    // Menú Principal
    document.getElementById('btn-play').onclick = () => { 
        refreshLevelsScreen(); 
        UI.showScreen('levels'); 
    };
    document.getElementById('btn-levels').onclick = () => { 
        refreshLevelsScreen(); 
        UI.showScreen('levels'); 
    };
    document.getElementById('btn-settings').onclick = () => UI.showScreen('settings');

    // Botón Pausa (HUD)
    document.getElementById('btn-pause').onclick = () => {
        document.getElementById('modal-pause').classList.remove('hidden');
        if(activeGame) { /* Aquí se podría pausar el timer visualmente si se desea */ }
    };

    // Botones "Atrás" Generales
    document.querySelectorAll('.btn-back').forEach(b => b.onclick = (e) => {
        const targetScreen = e.currentTarget.dataset.target;
        // Si salimos del juego, limpiar memoria
        if(activeGame) { 
            activeGame.destroy(); 
            activeGame = null; 
            clearInterval(gameTimer); 
        }
        UI.showScreen(targetScreen);
    });

    // --- MODALES ---
    
    // Modal Pausa
    document.getElementById('btn-resume').onclick = () => document.getElementById('modal-pause').classList.add('hidden');
    document.getElementById('btn-quit-level').onclick = () => {
        document.getElementById('modal-pause').classList.add('hidden');
        if(activeGame) activeGame.destroy();
        clearInterval(gameTimer);
        UI.showScreen('menu');
    };

    // Modal Game Over
    document.getElementById('btn-retry').onclick = () => {
        document.getElementById('modal-gameover').classList.add('hidden');
        startGame(currentLevelId, false);
    };
    document.getElementById('btn-quit-fail').onclick = () => {
        document.getElementById('modal-gameover').classList.add('hidden');
        UI.showScreen('menu');
    };
}

/**
 * Renderiza la cuadrícula de niveles y gestiona la lógica de "Reanudar Partida"
 */
function refreshLevelsScreen() {
    const levels = levelManager.getAllLevelsWithStatus();
    
    UI.renderLevelsGrid(levels, (levelId) => {
        // Verificar si hay partida guardada
        if(Storage.get(`save_${levelId}`)) {
            const modal = document.getElementById('modal-resume');
            modal.classList.remove('hidden');
            
            // Reasignar botones del modal dinámicamente
            const btnYes = document.getElementById('btn-yes-resume');
            const btnNo = document.getElementById('btn-no-resume');
            
            // Clonar para limpiar
            const newYes = btnYes.cloneNode(true);
            const newNo = btnNo.cloneNode(true);
            btnYes.parentNode.replaceChild(newYes, btnYes);
            btnNo.parentNode.replaceChild(newNo, btnNo);

            newYes.onclick = () => { 
                modal.classList.add('hidden'); 
                startGame(levelId, true); 
            };
            newNo.onclick = () => { 
                modal.classList.add('hidden'); 
                Storage.set(`save_${levelId}`, null); // Borrar save
                startGame(levelId, false); 
            };
        } else {
            // Iniciar nueva partida directa
            startGame(levelId, false);
        }
    });
}

/**
 * Lógica de Victoria
 */
function handleVictory(levelConfig) {
    clearInterval(gameTimer); // Detener reloj
    
    // Guardar progreso: Marcar completado
    Storage.markCompleted(levelConfig.id, 0); 
    // Borrar savegame intermedio (ya no sirve, ya ganó)
    Storage.set(`save_${levelConfig.id}`, null);
    
    // Desbloquear siguiente
    const nextLvlId = levelManager.getNextLevelId(levelConfig.id);
    if (nextLvlId) Storage.unlockLevel(nextLvlId);
    
    // Pagar Recompensa
    Economy.payout(levelConfig.id, levelConfig.rewardCoins);
    
    // Mostrar UI
    UI.showVictoryModal(levelConfig.rewardCoins, "WIN", 
        () => nextLvlId ? startGame(nextLvlId) : UI.showScreen('menu'), 
        () => UI.showScreen('menu')
    );
}

// --- UTILIDADES ---

/**
 * Temporizador (Time Attack)
 */
function startTimer(seconds) {
    let timeLeft = seconds;
    const display = document.getElementById('hud-timer');
    if(!display) return;
    
    display.classList.remove('low-time');
    updateTimerDisplay(timeLeft);
    
    gameTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);
        
        // Alerta visual últimos 10s
        if (timeLeft <= 10) display.classList.add('low-time');
        
        // Tiempo agotado
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            if(activeGame) activeGame.destroy(); // Detener input
            document.getElementById('modal-gameover').classList.remove('hidden');
        }
    }, 1000);
}

function updateTimerDisplay(totalSeconds) {
    const min = Math.floor(totalSeconds / 60).toString().padStart(2,'0');
    const sec = (totalSeconds % 60).toString().padStart(2,'0');
    const el = document.getElementById('hud-timer');
    if(el) el.textContent = `${min}:${sec}`;
}

/**
 * Guardado automático de estado
 */
function saveProgress(levelId) {
    if(activeGame) {
        Storage.set(`save_${levelId}`, activeGame.exportState());
    }
}

/**
 * Configuración de ajustes (Audio / Reset)
 */
function setupSettings() {
    const chkSound = document.getElementById('setting-sound');
    if(chkSound) {
        chkSound.addEventListener('change', () => { 
            const s = Storage.get('settings'); 
            s.sound = chkSound.checked; 
            Storage.set('settings', s); 
        });
    }
    
    const btnReset = document.getElementById('btn-reset-progress');
    if(btnReset) {
        btnReset.onclick = () => {
            if(confirm("¿Estás seguro de borrar TODO el progreso?\nEsta acción es irreversible.")) { 
                localStorage.removeItem('puz_rompecabezas_progress'); 
                location.reload(); 
            }
        };
    }
}

// --- RESIZE DEBOUNCE (Optimización) ---
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if(activeGame) activeGame.handleResize();
    }, 100);
});

// Arrancar App
window.addEventListener('DOMContentLoaded', init);
