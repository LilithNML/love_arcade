import { LevelManager } from './core/LevelManager.js';
import { UI } from './ui/UIController.js';
import { Storage } from './systems/Storage.js';
import { PuzzleEngine } from './core/PuzzleEngine.js';
import { AudioSynth } from './systems/AudioSynth.js';
import { Economy } from './systems/Economy.js';

const levelManager = new LevelManager();
let activeGame = null; // Referencia al motor del juego actual

/* --- Inicialización --- */
async function init() {
    console.log('Iniciando Rompecabezas v1.0...');
    
    // 1. Cargar configuración de niveles desde JSON
    await levelManager.loadLevels();
    
    // 2. Configurar listeners de botones y navegación
    setupNavigation();
    setupSettings();
    
    // 3. Mostrar menú principal
    UI.showScreen('menu');
}

/* --- Navegación --- */
function setupNavigation() {
    // Botón Jugar (Va al selector de niveles por defecto)
    document.getElementById('btn-play').addEventListener('click', () => {
        refreshLevelsScreen();
        UI.showScreen('levels');
    });

    // Botón Niveles
    document.getElementById('btn-levels').addEventListener('click', () => {
        refreshLevelsScreen();
        UI.showScreen('levels');
    });

    // Botón Ajustes
    document.getElementById('btn-settings').addEventListener('click', () => {
        loadSettingsToUI();
        UI.showScreen('settings');
    });

    // Botones "Atrás" genéricos
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = e.target.dataset.target; // ej: data-target="screen-menu"
            // Si salimos del juego, destruimos la instancia para liberar memoria
            if (activeGame && target !== 'screen-game') {
                activeGame.destroy();
                activeGame = null;
            }
            UI.showScreen(target);
        });
    });

    // Botón Pausa en el juego
    document.getElementById('btn-pause').addEventListener('click', () => {
        document.getElementById('modal-pause').classList.remove('hidden');
    });

    // Botones del Modal de Pausa
    document.getElementById('btn-resume').addEventListener('click', () => {
        document.getElementById('modal-pause').classList.add('hidden');
    });

    document.getElementById('btn-quit-level').addEventListener('click', () => {
        document.getElementById('modal-pause').classList.add('hidden');
        if (activeGame) {
            activeGame.destroy();
            activeGame = null;
        }
        UI.showScreen('menu');
    });
}

/* --- Lógica de Pantallas y Selección de Nivel --- */
function refreshLevelsScreen() {
    // Obtiene niveles combinando config + progreso guardado
    const levels = levelManager.getAllLevelsWithStatus();
    
    UI.renderLevelsGrid(levels, (levelId) => {
        startGame(levelId);
    });
}

function startGame(levelId) {
    const levelConfig = levelManager.getLevelById(levelId);
    if (!levelConfig) return;

    // Limpiar juego anterior si existe (prevención)
    if (activeGame) {
        activeGame.destroy();
        activeGame = null;
    }

    // Mostrar pantalla de juego (canvas)
    UI.showScreen('game');
    
    // Pre-cargar la imagen antes de iniciar el motor
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Crucial para imágenes de placehold.co o externas
    img.src = levelConfig.image;
    
    img.onload = () => {
        const canvas = document.getElementById('puzzle-canvas');
        const startTime = Date.now();
        
        // Inicializar Motor del Puzzle
        activeGame = new PuzzleEngine(canvas, {
            image: img,
            pieces: levelConfig.pieces
        }, {
            // Callbacks del motor
            onSound: (type) => AudioSynth.play(type),
            onWin: () => handleVictory(levelConfig, startTime)
        });
    };

    img.onerror = () => {
        console.error("Error cargando la imagen del nivel");
        alert("Error al cargar la imagen. Intenta con otro nivel.");
        UI.showScreen('levels');
    };

    // Actualizar HUD inicial
    UI.updateHUD(levelConfig.index || 0, "00:00");
}

/* --- Lógica de Victoria y Recompensas --- */
function handleVictory(levelConfig, startTime) {
    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);
    
    // Formatear tiempo mm:ss para mostrar
    const minutes = Math.floor(durationSeconds / 60).toString().padStart(2, '0');
    const seconds = (durationSeconds % 60).toString().padStart(2, '0');
    const timeStr = `${minutes}:${seconds}`;

    // 1. Guardar progreso local (Storage)
    Storage.markCompleted(levelConfig.id, durationSeconds);
    
    // 2. Calcular y desbloquear siguiente nivel
    const nextLvlId = levelManager.getNextLevelId(levelConfig.id);
    if (nextLvlId) {
        Storage.unlockLevel(nextLvlId);
    }

    // 3. Pagar recompensa a Love Arcade (Integración Financiera)
    // Se envía el ID y las monedas definidas en levels.json
    Economy.payout(levelConfig.id, levelConfig.rewardCoins);

    // 4. Mostrar UI de Victoria
    UI.showVictoryModal(levelConfig.rewardCoins, timeStr, 
        // Callback: Siguiente Nivel
        () => { 
            if (nextLvlId) {
                startGame(nextLvlId);
            } else {
                alert('¡Juego Completado al 100%!'); 
                UI.showScreen('menu'); 
            }
        }, 
        // Callback: Volver al Menú
        () => {
            if (activeGame) activeGame.destroy();
            activeGame = null;
            UI.showScreen('menu');
        }
    );
}

/* --- Ajustes --- */
function setupSettings() {
    const chkSound = document.getElementById('setting-sound');
    const rngVol = document.getElementById('setting-volume');
    const btnReset = document.getElementById('btn-reset-progress');

    // Listener Sonido ON/OFF
    chkSound.addEventListener('change', () => {
        const s = Storage.get('settings');
        s.sound = chkSound.checked;
        Storage.set('settings', s);
    });

    // Listener Volumen
    rngVol.addEventListener('input', () => {
        const s = Storage.get('settings');
        s.volume = parseFloat(rngVol.value);
        Storage.set('settings', s);
    });

    // Reset Progreso (Debug/User request)
    btnReset.addEventListener('click', () => {
        if(confirm('¿Seguro que quieres borrar todo el progreso? Esta acción no se puede deshacer.')) {
            localStorage.removeItem('puz_rompecabezas_progress');
            alert('Progreso borrado. El juego se reiniciará.');
            location.reload();
        }
    });
}

function loadSettingsToUI() {
    const s = Storage.get('settings');
    // Actualizar checkboxes y sliders con lo guardado
    const chkSound = document.getElementById('setting-sound');
    const rngVol = document.getElementById('setting-volume');
    
    if (chkSound) chkSound.checked = s.sound;
    if (rngVol) rngVol.value = s.volume;
}

// Arrancar la aplicación cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', init);
