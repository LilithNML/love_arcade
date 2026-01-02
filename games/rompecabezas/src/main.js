/**
 * main.js
 * Punto de entrada principal del juego.
 * Orquesta la lógica entre el Motor (PuzzleEngine), UI, Almacenamiento y Economía.
 * Actualizado Fase 2: Lógica de Estrellas,  Recompensas Dinámicas y PWA.
 */

import { LevelManager } from './core/LevelManager.js';
import { UI } from './ui/UIController.js';
import { Storage } from './systems/Storage.js';
import { PuzzleEngine } from './core/PuzzleEngine.js';
import { AudioSynth } from './systems/AudioSynth.js'; 
import { Economy } from './systems/Economy.js';

// --- INSTANCIAS Y ESTADO GLOBAL ---
const levelManager = new LevelManager();
let activeGame = null;      // Instancia del motor del juego
let gameTimer = null;       // Referencia al setInterval del reloj
let currentLevelId = null;  // ID del nivel actual (ej: 'lvl_1')
let startTime = 0;          // Marca de tiempo para calcular duración y estrellas

/**
 * Inicialización de la aplicación (DOMContentLoaded)
 */
async function init() {
    console.log('[Main] Iniciando Rompecabezas Arcade...');
    
    // 1. Cargar configuración de niveles desde JSON
    await levelManager.loadLevels();
    
    // 2. Configurar interacción de UI
    setupNavigation();
    setupSettings();
    
    // 3. Mostrar menú principal
    UI.showScreen('menu');
}

/**
 * Inicia una partida de un nivel específico.
 * @param {string} levelId - ID del nivel.
 * @param {boolean} loadSaved - Si true, intenta cargar un estado previo.
 */
function startGame(levelId, loadSaved = false) {
    const levelConfig = levelManager.getLevelById(levelId);
    if (!levelConfig) {
        console.error("Nivel no encontrado:", levelId);
        return;
    }
    
    currentLevelId = levelId;

    // Actualizar HUD (Título del nivel)
    const allLevels = levelManager.getAllLevelsWithStatus();
    const levelIndex = allLevels.findIndex(l => l.id === levelId);
    const lvlDisplay = document.getElementById('hud-level');
    if(lvlDisplay) lvlDisplay.textContent = `LVL ${levelIndex + 1}`;

    // Limpieza de juego anterior
    if (activeGame) { 
        activeGame.destroy(); 
        activeGame = null; 
    }
    clearInterval(gameTimer);

    // Transición de pantalla
    UI.showScreen('game');
    
    // Fondo dinámico (Atmósfera)
    const bg = document.getElementById('dynamic-bg');
    if(bg) bg.style.backgroundImage = `url('${levelConfig.image}')`;

    // Mostrar Loader
    const loader = document.getElementById('game-loader');
    if(loader) loader.classList.remove('hidden');

    // Cargar Imagen del Puzzle
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Crucial para manipulación de píxeles
    img.src = levelConfig.image;
    
    img.onload = () => {
        if(loader) loader.classList.add('hidden');
        
        // RESET DE TIEMPO: Iniciar cronómetro para estrellas
        startTime = Date.now(); 

        const canvas = document.getElementById('puzzle-canvas');
        
        // Instanciar Motor Gráfico
        activeGame = new PuzzleEngine(canvas, {
            image: img, 
            pieces: levelConfig.pieces
        }, {
            // Callbacks del Motor
            onSound: (t) => AudioSynth.play(t),
            onWin: () => handleVictory(levelConfig), // Lógica de victoria corregida
            onStateChange: () => saveProgress(levelId)
        });

        // Cargar partida guardada (si aplica)
        if (loadSaved) {
            const savedState = Storage.get(`save_${levelId}`);
            if (savedState) activeGame.importState(savedState);
        }

        // Configurar Temporizador (Cuenta regresiva o Infinito)
        if (levelConfig.timeLimit && levelConfig.timeLimit > 0) {
            startTimer(levelConfig);
        } else {
            const timerDisplay = document.getElementById('hud-timer');
            if(timerDisplay) { 
                timerDisplay.textContent = "∞"; 
                timerDisplay.classList.remove('low-time'); 
            }
        }

        // Habilitar controles (Imán, Preview)
        setupGameControls();
    };

    img.onerror = () => {
        if(loader) loader.classList.add('hidden');
        alert("Error cargando la imagen. Revisa tu conexión.");
        UI.showScreen('levels');
    };
}

/**
 * Maneja la lógica al completar un rompecabezas.
 * Calcula estrellas y recompensa dinámica.
 */
function handleVictory(levelConfig) {
    clearInterval(gameTimer);
    
    // 1. CALCULAR ESTRELLAS (Basado en velocidad)
    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000;
    const pieces = levelConfig.pieces;

    // Heurística: 
    // - Rápido (< 5s por pieza) = 3 Estrellas
    // - Normal (< 10s por pieza) = 2 Estrellas
    // - Lento = 1 Estrella
    let stars = 1;
    if (durationSeconds <= pieces * 5) stars = 3;
    else if (durationSeconds <= pieces * 10) stars = 2;

    // 2. CALCULAR RECOMPENSA DINÁMICA
    // 1 Estrella = 50% | 2 Estrellas = 75% | 3 Estrellas = 100%
    let multiplier = 0.5;
    if (stars === 2) multiplier = 0.75;
    if (stars === 3) multiplier = 1.0;

    const actualReward = Math.ceil(levelConfig.rewardCoins * multiplier);

    // 3. GUARDAR PROGRESO (Storage v2)
    Storage.saveStars(levelConfig.id, stars);
    Storage.set(`save_${levelConfig.id}`, null); // Borrar autoguardado incompleto
    
    // Desbloquear siguiente nivel
    const nextLvlId = levelManager.getNextLevelId(levelConfig.id);
    if (nextLvlId) Storage.unlockLevel(nextLvlId);
    
    // 4. TRANSACCIÓN ECONÓMICA
    Economy.payout(levelConfig.id, actualReward);
    
    // 5. MOSTRAR UI (Modal)
    const timeStr = document.getElementById('hud-timer').textContent;
    
    // Pasamos 'actualReward' para que el usuario vea lo que realmente ganó
    UI.showVictoryModal(actualReward, timeStr, stars, 
        () => { // Callback: Siguiente Nivel
            if (nextLvlId) startGame(nextLvlId);
        },
        () => { // Callback: Volver al Menú
            if(activeGame) activeGame.destroy();
            UI.showScreen('menu');
        }
    );
}

/* --- CONFIGURACIÓN DE CONTROLES --- */

function setupGameControls() {
    // Botón Preview (Ojo)
    const btnPreview = document.getElementById('btn-preview');
    const newBtnPreview = btnPreview.cloneNode(true); // Limpiar listeners viejos
    btnPreview.parentNode.replaceChild(newBtnPreview, btnPreview);
    
    const startP = () => activeGame && activeGame.togglePreview(true);
    const endP = () => activeGame && activeGame.togglePreview(false);
    
    newBtnPreview.addEventListener('mousedown', startP);
    newBtnPreview.addEventListener('mouseup', endP);
    newBtnPreview.addEventListener('mouseleave', endP);
    newBtnPreview.addEventListener('touchstart', (e) => { e.preventDefault(); startP(); });
    newBtnPreview.addEventListener('touchend', endP);

    // Botón Imán (Power-up)
    const btnMagnet = document.getElementById('btn-magnet');
    const newBtnMagnet = btnMagnet.cloneNode(true);
    btnMagnet.parentNode.replaceChild(newBtnMagnet, btnMagnet);

    newBtnMagnet.onclick = () => {
        // Fallback si no hay sistema de economía global
        if (!window.GameCenter) {
            if(confirm("Modo Offline: ¿Usar Imán gratis?")) {
                const placed = activeGame.autoPlacePiece();
                if(!placed) alert("¡No hay piezas para colocar!");
            }
            return;
        }

        // Lógica de Compra
        const balance = window.GameCenter.getBalance ? window.GameCenter.getBalance() : 0;
        const COST = 10;
        
        if (balance < COST) { 
            alert(`Saldo insuficiente.\nCosto: ${COST}\nTienes: ${balance} 💰`); 
            return; 
        }

        if(confirm(`¿Usar Imán por ${COST} monedas?`)) {
            const result = window.GameCenter.buyItem({ id: 'magnet', price: COST });
            if (result && result.success) {
                const placed = activeGame.autoPlacePiece();
                if(!placed) alert("¡El rompecabezas ya está listo!");
            } else {
                alert("Error en la transacción.");
            }
        }
    };
}

function setupNavigation() {
    // Menú Principal
    document.getElementById('btn-play').onclick = () => { refreshLevelsScreen(); UI.showScreen('levels'); };
    document.getElementById('btn-levels').onclick = () => { refreshLevelsScreen(); UI.showScreen('levels'); };
    document.getElementById('btn-settings').onclick = () => UI.showScreen('settings');

    // Pausa
    document.getElementById('btn-pause').onclick = () => {
        document.getElementById('modal-pause').classList.remove('hidden');
    };

    // Botones Atrás
    document.querySelectorAll('.btn-back').forEach(b => b.onclick = (e) => {
        const target = e.currentTarget.dataset.target;
        if(activeGame) { 
            activeGame.destroy(); 
            activeGame = null; 
            clearInterval(gameTimer); 
        }
        UI.showScreen(target);
    });

    // Control de Modales (Pausa/GameOver)
    document.getElementById('btn-resume').onclick = () => document.getElementById('modal-pause').classList.add('hidden');
    
    document.getElementById('btn-quit-level').onclick = () => {
        document.getElementById('modal-pause').classList.add('hidden');
        if(activeGame) {
            saveProgress(currentLevelId); // Guardar antes de salir
            activeGame.destroy();
        }
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

/**
 * Refresca la pantalla de niveles verificando el estado de guardado.
 */
function refreshLevelsScreen() {
    const levels = levelManager.getAllLevelsWithStatus();
    
    UI.renderLevelsGrid(levels, (id) => {
        // Verificar si existe un autoguardado incompleto
        if(Storage.get(`save_${id}`)) {
            const modal = document.getElementById('modal-resume');
            modal.classList.remove('hidden');
            
            const btnYes = document.getElementById('btn-yes-resume');
            const btnNo = document.getElementById('btn-no-resume');
            
            // Clonar botones para limpieza de eventos
            const newYes = btnYes.cloneNode(true);
            const newNo = btnNo.cloneNode(true);
            btnYes.parentNode.replaceChild(newYes, btnYes);
            btnNo.parentNode.replaceChild(newNo, btnNo);

            newYes.onclick = () => { 
                modal.classList.add('hidden'); 
                startGame(id, true); // Cargar save
            };
            newNo.onclick = () => { 
                modal.classList.add('hidden'); 
                Storage.set(`save_${id}`, null); // Descartar save
                startGame(id, false); 
            };
        } else {
            startGame(id, false);
        }
    });
}

// Modificamos para recibir todo el objeto levelConfig, no solo los segundos
function startTimer(levelConfig) {
    let timeLeft = levelConfig.timeLimit;
    const display = document.getElementById('hud-timer');
    if(!display) return;
    
    // Calcular los tiempos de corte (Thresholds)
    // Nota: Usamos la misma lógica que en handleVictory
    const threeStarTime = levelConfig.pieces * 5;  // Ej: 20s
    const twoStarTime = levelConfig.pieces * 10;   // Ej: 40s
    const totalTime = levelConfig.timeLimit;       // Ej: 60s

    display.className = 'timer-display'; // Limpiar clases viejas
    updateTimerDisplay(timeLeft);
    
    // Función auxiliar para actualizar color
    const updateColor = () => {
        const elapsed = totalTime - timeLeft;
        
        display.classList.remove('timer-gold', 'timer-silver', 'timer-bronze', 'low-time');
        
        if (elapsed <= threeStarTime) {
            display.classList.add('timer-gold'); // 3 Estrellas posibles
        } else if (elapsed <= twoStarTime) {
            display.classList.add('timer-silver'); // 2 Estrellas posibles
        } else {
            display.classList.add('timer-bronze'); // 1 Estrella posible
        }
        
        // Prioridad visual: Si queda poco tiempo total, poner en rojo parpadeante
        if (timeLeft <= 10) {
            display.className = 'timer-display low-time'; 
        }
    };

    updateColor(); // Color inicial
    
    gameTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay(timeLeft);
        updateColor(); // Actualizar color cada segundo
        
        // Game Over
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

// Wrapper seguro para autoguardado
function saveProgress(lid) { 
    if(activeGame) Storage.set(`save_${lid}`, activeGame.exportState()); 
}

function setupSettings() {
    // Toggle Sonido
    const chk = document.getElementById('setting-sound');
    if(chk) chk.addEventListener('change', () => { 
        const s = Storage.get('settings') || {}; 
        s.sound = chk.checked; 
        Storage.set('settings', s); 
        if(AudioSynth) AudioSynth.enabled = chk.checked;
    });

    // Reset de Fábrica
    const btnReset = document.getElementById('btn-reset-progress');
    if(btnReset) {
        btnReset.onclick = () => {
            if(confirm("⚠ ¿ESTÁS SEGURO?\nEsto borrará todo el progreso y monedas permanentemente.")) { 
                localStorage.clear(); 
                location.reload(); 
            }
        };
    }
}

// Manejo optimizado de redimensionado (Debounce)
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => { 
        if(activeGame) activeGame.handleResize(); 
    }, 100);
});

// Registro de Service Worker para PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(() => console.log('Service Worker registrado correctamente'))
        .catch((err) => console.log('Fallo en SW:', err));
}

// Punto de entrada
window.addEventListener('DOMContentLoaded', init);
