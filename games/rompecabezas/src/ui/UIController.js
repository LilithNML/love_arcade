export const UI = {
    screens: {
        menu: document.getElementById('screen-menu'),
        levels: document.getElementById('screen-levels'),
        game: document.getElementById('screen-game'),
        settings: document.getElementById('screen-settings')
    },

    /**
     * Cambia la pantalla activa.
     * Arregla el bug de pantalla blanca eliminando dependencias de tiempo complejas.
     */
    showScreen: (screenName) => {
        // 1. Quitar clase 'active' de todas
        Object.values(UI.screens).forEach(el => {
            el.classList.remove('active');
            // NO usam 'hidden' manual, el CSS maneja opacidad/pointer-events
            // solo con la clase .active
        });
        
        // 2. Activar la objetivo
        const target = UI.screens[screenName];
        if (target) {
            target.classList.add('active');
        }
    },

    renderLevelsGrid: (levelsWithStatus, onLevelSelect) => {
        const container = document.getElementById('levels-container');
        container.innerHTML = '';

        levelsWithStatus.forEach(lvl => {
            const card = document.createElement('div');
            // Añade candado visual si está bloqueado
            const lockIcon = lvl.status === 'locked' ? '🔒' : (lvl.status === 'completed' ? '✓' : (lvl.index + 1));
            
            card.className = `level-card ${lvl.status}`;
            card.innerHTML = `<span>${lockIcon}</span>`;
            
            if (lvl.status !== 'locked') {
                card.onclick = () => onLevelSelect(lvl.id);
            }
            container.appendChild(card);
        });
    },

    updateHUD: (levelIndex, timeStr) => {
        document.getElementById('hud-level').textContent = `NIVEL ${levelIndex + 1}`;
        document.getElementById('hud-time').textContent = timeStr;
    },

    showVictoryModal: (coins, timeStr, onNext, onMenu) => {
        const modal = document.getElementById('modal-victory');
        document.getElementById('victory-coins').textContent = coins;
        document.getElementById('victory-time').textContent = timeStr;
        
        modal.classList.remove('hidden');

        // Clonar para limpiar eventos previos
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
