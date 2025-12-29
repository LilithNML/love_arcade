export const UI = {
    // Referencias internas (opcionales, pero útiles para lógica específica)
    screens: {
        menu: document.getElementById('screen-menu'),
        levels: document.getElementById('screen-levels'),
        game: document.getElementById('screen-game'),
        settings: document.getElementById('screen-settings')
    },

    /**
     * Cambia la pantalla activa.
     * CORRECCIÓN: Ahora acepta IDs completos (ej: 'screen-menu') o nombres cortos ('menu').
     */
    showScreen: (targetIdOrName) => {
        // 1. Identificar el elemento destino
        let targetScreen = document.getElementById(targetIdOrName);

        // Si no se encuentra por ID, intentar buscar en nuestro objeto de mapeo
        if (!targetScreen && UI.screens[targetIdOrName]) {
            targetScreen = UI.screens[targetIdOrName];
        }

        if (!targetScreen) {
            console.error(`[UI] Error: No se encontró la pantalla destino: ${targetIdOrName}`);
            return;
        }

        // 2. Gestión de Clases: Ocultar todas las pantallas
        const allScreens = document.querySelectorAll('.screen');
        allScreens.forEach(screen => {
            screen.classList.remove('active');
            // Aseguramos que el estilo CSS las oculte
            screen.style.pointerEvents = 'none'; 
        });
        
        // 3. Activar la pantalla objetivo
        targetScreen.classList.add('active');
        targetScreen.style.pointerEvents = 'all'; // Reactivar interacción

        // 4. Scroll al tope (por si acaso quedó scrolleado abajo)
        window.scrollTo(0, 0);
    },

    renderLevelsGrid: (levelsWithStatus, onLevelSelect) => {
        const container = document.getElementById('levels-container');
        if (!container) return;
        
        container.innerHTML = '';

        levelsWithStatus.forEach(lvl => {
            const card = document.createElement('div');
            // Lógica visual del candado o número
            let content = lvl.index + 1;
            if (lvl.status === 'locked') content = '🔒';
            if (lvl.status === 'completed') content = '✓';
            
            card.className = `level-card ${lvl.status}`;
            card.innerHTML = `<span>${content}</span>`;
            
            if (lvl.status !== 'locked') {
                card.onclick = () => onLevelSelect(lvl.id);
            }
            container.appendChild(card);
        });
    },

    updateHUD: (levelIndex, timeStr) => {
        const lvlEl = document.getElementById('hud-level');
        const timeEl = document.getElementById('hud-time');
        if (lvlEl) lvlEl.textContent = `NIVEL ${levelIndex + 1}`;
        if (timeEl) timeEl.textContent = timeStr;
    },

    showVictoryModal: (coins, timeStr, onNext, onMenu) => {
        const modal = document.getElementById('modal-victory');
        if (!modal) return;

        document.getElementById('victory-coins').textContent = coins;
        document.getElementById('victory-time').textContent = timeStr;
        
        modal.classList.remove('hidden');

        // Clonación de botones para limpiar eventos anteriores
        const btnNext = document.getElementById('btn-next-level');
        const btnMenu = document.getElementById('btn-victory-menu');
        
        const newBtnNext = btnNext.cloneNode(true);
        const newBtnMenu = btnMenu.cloneNode(true);
        
        btnNext.parentNode.replaceChild(newBtnNext, btnNext);
        btnMenu.parentNode.replaceChild(newBtnMenu, btnMenu);

        newBtnNext.onclick = () => {
            modal.classList.add('hidden');
            onNext();
        };
        newBtnMenu.onclick = () => {
            modal.classList.add('hidden');
            onMenu();
        };
    }
};
