/**
 * main.js
 * Punto de entrada principal del juego.
 * Orquesta la lógica entre el Motor (PuzzleEngine), UI, Almacenamiento y Economía.
 * Actualizado para Fase 2: Sistema de Estrellas, PWA y Storage Seguro.
 */

import { LevelManager } from './core/LevelManager.js';
import { UI } from './ui/UIController.js';
import { Storage } from './systems/Storage.js';
import { PuzzleEngine } from './core/PuzzleEngine.js';
import { AudioSynth } from './systems/AudioSynth.js'; // Usando sintetizador (sin mp3)
import { Economy } from './systems/Economy.js';

// Instancias y Variables Globales
const levelManager = new LevelManager();
let activeGame = null;      // Instancia del motor actual
let gameTimer = null;       // Intervalo del temporizador (cuenta regresiva)
let currentLevelId = null;  // ID del nivel en juego
let startTime = 0;          // Para medir duración y calcular estrellas

/**
 * Inicialización de la aplicación
 */
async function init() {
    console.log('[Main] Iniciando Rompecabezas Arcade...');
    
    // Cargar configuración de niveles (JSON)
    await levelManager.loadLevels();
    
    // Configurar listeners de botones
    setupNavigation();
    setupSettings();
    
    // Mostrar menú principal
    UI.showScreen('menu');
}

/**
 * Inicia un nivel específico.
 * @param {string} levelId - ID del nivel (ej: 'lvl_1')
 * @param {boolean} loadSaved - Si true, carga el progreso guardado
 */
function startGame(levelId, loadSaved = false) {
    const levelConfig = levelManager.getLevelById(levelId);
    if (!levelConfig) return;
    
    currentLevelId = levelId;

    // Actualizar HUD (Nivel Actual)
    const allLevels = levelManager.getAllLevelsWithStatus();
    const levelIndex = allLevels.findIndex(l => l.id === levelId);
    const lvlDisplay = document.getElementById('hud-level');
    if(lvlDisplay) lvlDisplay.textContent = `LVL ${levelIndex + 1}`;

    // Limpiar juego anterior si existe
    if (activeGame) { 
        activeGame.destroy(); 
        activeGame = null; 
    }
    clearInterval(gameTimer);

    // Cambiar pantalla
    UI.showScreen('game');
    
    // Fondo dinámico (Efecto visual)
    const bg = document.getElementById('dynamic-bg');
    if(bg) bg.style.backgroundImage = `url('${levelConfig.image}')`;

    // Loader
    const loader = document.getElementById('game-loader');
    if(loader) loader.classList.remove('hidden');

    // Cargar Imagen del Puzzle
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Necesario para evitar tainted canvas
    img.src = levelConfig.image;
    
    img.onload = () => {
        if(loader) loader.classList.add('hidden');
        
        // Registrar tiempo de inicio para el cálculo de estrellas
        startTime = Date.now(); 

        const canvas = document.getElementById('puzzle-canvas');
        
        // Instanciar Motor
        activeGame = new PuzzleEngine(canvas, {
            image: img, 
            pieces: levelConfig.pieces
        }, {
            // Callbacks del motor
            onSound: (t) => AudioSynth.play(t),
            onWin: () => handleVictory(levelConfig), // <--- Llama a la nueva lógica de victoria
            onStateChange: () => saveProgress(levelId)
        });

        // Cargar estado guardado si se solicitó
        if (loadSaved) {
            const savedState = Storage.get(`save_${levelId}`);
            if (savedState) activeGame.importState(savedState);
        }

        // Configurar Temporizador (Si el nivel tiene límite)
        if (levelConfig.timeLimit && levelConfig.timeLimit > 0) {
            startTimer(levelConfig.timeLimit);
        } else {
            // Modo infinito (mostrar ∞)
            const timerDisplay = document.getElementById('hud-timer');
            if(timerDisplay) { 
                timerDisplay.textContent = "∞"; 
                timerDisplay.classList.remove('low-time'); 
            }
        }

        setupGameControls();
    };

    img.onerror = () => {
        if(loader) loader.classList.add('hidden');
        alert("Error cargando la imagen del nivel. Verifica tu conexión.");
        UI.showScreen('levels');
    };
}

/**
 * Maneja la lógica de victoria, cálculo de estrellas y recompensas.
 */
function handleVictory(levelConfig) {
    clearInterval(gameTimer);
    
    // 1. Calcular Estrellas (Heurística de Tiempo)
    const endTime = Date.now();
    const durationSeconds = (endTime - startTime) / 1000; // Segundos reales
    const pieces = levelConfig.pieces;

    // Regla: 
    // 3 Estrellas: < 5 segundos por pieza promedio
    // 2 Estrellas: < 10 segundos por pieza promedio
    // 1 Estrella: Completar
    let stars = 1;
    if (durationSeconds <= pieces * 5) stars = 3;
    else if (durationSeconds <= pieces * 10) stars = 2;

    // 2. Guardar Progreso (Storage Seguro v2)
    // Guarda el récord de estrellas si es mejor que el anterior
    Storage.saveStars(levelConfig.id, stars);
    
    // Limpiar el autoguardado de "progreso a medias"
    Storage.set(`save_${levelConfig.id}`, null);
    
    // Desbloquear siguiente nivel
    const nextLvlId = levelManager.getNextLevelId(levelConfig.id);
    if (nextLvlId) Storage.unlockLevel(nextLvlId);
    
    // 3. Pagar Monedas
    Economy.payout(levelConfig.id, levelConfig.rewardCoins);
    
    // 4. Mostrar Modal de Victoria
    // Pasamos 'stars' para que UIController lo dibuje
    const timeStr = document.getElementById('hud-timer').textContent;
    
    UI.showVictoryModal(levelConfig.rewardCoins, timeStr, stars, 
        () => { // Callback: Siguiente Nivel
            if (nextLvlId) startGame(nextLvlId);
        },
        () => { // Callback: Ir al Menú
            if(activeGame) activeGame.destroy();
            UI.showScreen('menu');
        }
    );
}

/* --- CONTROLES Y UTILIDADES --- */

function setupGameControls() {
    // Botón Ojo (Preview)
    const btnPreview = document.getElementById('btn-preview');
    // Clonar para limpiar eventos viejos
    const newBtnPreview = btnPreview.cloneNode(true);
    btnPreview.parentNode.replaceChild(newBtnPreview, btnPreview);
    
    const startP = () => activeGame && activeGame.togglePreview(true);
    const endP = () => activeGame && activeGame.togglePreview(false);
    
    // Soporte ratón y táctil
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
        // Modo Offline / Sin Economy Wrapper
        if (!window.GameCenter) {
            if(confirm("Modo Pruebas: ¿Usar Imán gratis?")) {
                const placed = activeGame.autoPlacePiece();
                if(!placed) alert("¡No quedan piezas sueltas!");
            }
            return;
        }

        // Modo Producción con Economía
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
                if(!placed) alert("¡El rompecabezas ya está resuelto!");
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

    // Botón Pausa (In-Game)
    document.getElementById('btn-pause').onclick = () => {
        document.getElementById('modal-pause').classList.remove('hidden');
    };

    // Botones "Atrás" genéricos
    document.querySelectorAll('.btn-back').forEach(b => b.onclick = (e) => {
        const t = e.currentTarget.dataset.target;
        if(activeGame) { 
            activeGame.destroy(); 
            activeGame = null; 
            clearInterval(gameTimer); 
        }
        UI.showScreen(t);
    });

    // Modal Pausa: Reanudar
    document.getElementById('btn-resume').onclick = () => document.getElementById('modal-pause').classList.add('hidden');
    
    // Modal Pausa: Abandonar
    document.getElementById('btn-quit-level').onclick = () => {
        document.getElementById('modal-pause').classList.add('hidden');
        if(activeGame) activeGame.destroy();
        clearInterval(gameTimer);
        // Guardar estado actual antes de salir
        if(currentLevelId) saveProgress(currentLevelId);
        UI.showScreen('menu');
    };

    // Modal Game Over: Reintentar / Salir
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
 * Refresca la pantalla de selección de niveles.
 * Verifica si hay partidas guardadas para ofrecer "Continuar".
 */
function refreshLevelsScreen() {
    // Obtener niveles con su estado actualizado (Locked/Completed/Stars)
    // El LevelManager internamente debe consultar Storage.js
    const levels = levelManager.getAllLevelsWithStatus();
    
    UI.renderLevelsGrid(levels, (id) => {
        // Al hacer click en un nivel:
        if(Storage.get(`save_${id}`)) {
            // Si hay autoguardado, preguntar
            const modal = document.getElementById('modal-resume');
            modal.classList.remove('hidden');
            
            const btnYes = document.getElementById('btn-yes-resume');
            const btnNo = document.getElementById('btn-no-resume');
            
            // Clonar para limpiar eventos
            const newYes = btnYes.cloneNode(true);
            const newNo = btnNo.cloneNode(true);
            btnYes.parentNode.replaceChild(newYes, btnYes);
            btnNo.parentNode.replaceChild(newNo, btnNo);

            newYes.onclick = () => { modal.classList.add('hidden'); startGame(id, true); };
            newNo.onclick = () => { 
                modal.classList.add('hidden'); 
                Storage.set(`save_${id}`, null); // Borrar save
                startGame(id, false); 
            };
        } else {
            // Juego nuevo
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
        
        // Alerta visual de tiempo bajo
        if (timeLeft <= 10) display.classList.add('low-time');
        
        // Game Over
        if (timeLeft <= 0) {
            clearInterval(gameTimer);
            if(activeGame) activeGame.destroy();
            document.getElementById('modal-gameover').classList.remove('hidden');
        }
    }, 1000);
}

function updateTimerDisplay(s) {
    // Formato MM:SS
    const m = Math.floor(s/60).toString().padStart(2,'0');
    const sc = (s%60).toString().padStart(2,'0');
    const el = document.getElementById('hud-timer');
    if(el) el.textContent = `${m}:${sc}`;
}

// Autoguardado silencioso
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
        // Aquí podrías notificar al AudioSynth
        if(AudioSynth) AudioSynth.enabled = chk.checked;
    });

    // Reset Total (Hard Reset)
    const btnReset = document.getElementById('btn-reset-progress');
    if(btnReset) {
        btnReset.onclick = () => {
            if(confirm("⚠ ¿ESTÁS SEGURO?\nEsto borrará todas tus monedas, estrellas y progreso.")) { 
                // Borrar todo lo relacionado al prefijo del juego
                // (O usar localStorage.clear() si es la única app en el dominio)
                localStorage.clear(); 
                location.reload(); 
            }
        };
    }
}

// Manejo de Redimensionado de Ventana
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    // Debounce para no saturar el navegador
    resizeTimeout = setTimeout(() => { 
        if(activeGame) activeGame.handleResize(); 
    }, 100);
});

// Registrar Service Worker para PWA (Offline Mode)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(() => console.log('Service Worker registrado correctamente'))
        .catch((err) => console.log('Fallo en SW:', err));
}

// Arrancar App
window.addEventListener('DOMContentLoaded', init);
