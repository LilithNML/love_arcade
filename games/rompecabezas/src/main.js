import { LevelManager } from './core/LevelManager.js';
import { UI } from './ui/UIController.js';
import { Storage } from './systems/Storage.js';
// Importaremos el Engine del juego en el siguiente paso, 
// por ahora dejamos el placeholder
// import { PuzzleEngine } from './core/PuzzleEngine.js';

const levelManager = new LevelManager();

/* --- Inicialización --- */
async function init() {
    console.log('Iniciando Rompecabezas v1.0...');
    
    // 1. Cargar configuración de niveles
    await levelManager.loadLevels();
    
    // 2. Setup Event Listeners
    setupNavigation();
    setupSettings();
    
    // 3. Mostrar menú principal
    UI.showScreen('menu');
}

/* --- Navegación --- */
function setupNavigation() {
    // Botón Jugar (Va al último nivel desbloqueado o al selector)
    document.getElementById('btn-play').addEventListener('click', () => {
        // Lógica simple: ir al selector de niveles por ahora
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
            const target = e.target.dataset.target; // data-target="screen-menu"
            UI.showScreen(target);
        });
    });
}

/* --- Lógica de Pantallas --- */
function refreshLevelsScreen() {
    const levels = levelManager.getAllLevelsWithStatus();
    UI.renderLevelsGrid(levels, (levelId) => {
        startGame(levelId);
    });
}

function startGame(levelId) {
    const levelConfig = levelManager.getLevelById(levelId);
    if (!levelConfig) return;

    console.log(`Iniciando nivel: ${levelId}`, levelConfig);
    UI.showScreen('game');
    
    // TODO: Aquí instanciaremos el PuzzleEngine
    // gameEngine = new PuzzleEngine(canvas, levelConfig, onVictory);
    // gameEngine.start();
}

/* --- Ajustes --- */
function setupSettings() {
    const chkSound = document.getElementById('setting-sound');
    const rngVol = document.getElementById('setting-volume');
    const btnReset = document.getElementById('btn-reset-progress');

    // Listeners cambios
    chkSound.addEventListener('change', () => {
        const s = Storage.get('settings');
        s.sound = chkSound.checked;
        Storage.set('settings', s);
    });

    // Reset Progreso (Debug/User request)
    btnReset.addEventListener('click', () => {
        if(confirm('¿Seguro que quieres borrar todo el progreso?')) {
            localStorage.removeItem('puz_rompecabezas_progress');
            alert('Progreso borrado.');
            location.reload();
        }
    });
}

function loadSettingsToUI() {
    const s = Storage.get('settings');
    document.getElementById('setting-sound').checked = s.sound;
    document.getElementById('setting-volume').value = s.volume;
}

// Arrancar
window.addEventListener('DOMContentLoaded', init);
