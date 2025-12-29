export const UI = {
    screens: {
        menu: document.getElementById('screen-menu'),
        levels: document.getElementById('screen-levels'),
        game: document.getElementById('screen-game'),
        settings: document.getElementById('screen-settings')
    },

    /**
     * Cambia la pantalla activa ocultando las demás
     * @param {string} screenName - 'menu', 'levels', 'game', 'settings'
     */
    showScreen: (screenName) => {
        Object.values(UI.screens).forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('active');
        });
        
        const target = UI.screens[screenName];
        if (target) {
            target.classList.remove('hidden');
            // Pequeño delay para permitir transición CSS si se desea
            setTimeout(() => target.classList.add('active'), 10);
        }
    },

    /**
     * Renderiza la cuadrícula de niveles basada en el progreso
     */
    renderLevelsGrid: (levelsWithStatus, onLevelSelect) => {
        const container = document.getElementById('levels-container');
        container.innerHTML = ''; // Limpiar

        levelsWithStatus.forEach(lvl => {
            const card = document.createElement('div');
            card.className = `level-card ${lvl.status}`;
            card.textContent = lvl.index + 1; // Mostrar número 1, 2, 3...
            
            if (lvl.status !== 'locked') {
                card.onclick = () => onLevelSelect(lvl.id);
            } else {
                // Opcional: Tooltip de bloqueado
                card.title = "Completa el nivel anterior para desbloquear";
            }

            container.appendChild(card);
        });
    },

    updateHUD: (levelIndex, timeStr) => {
        document.getElementById('hud-level').textContent = `Nivel ${levelIndex + 1}`;
        document.getElementById('hud-time').textContent = timeStr;
    },

    showVictoryModal: (coins, timeStr, onNext, onMenu) => {
        const modal = document.getElementById('modal-victory');
        document.getElementById('victory-coins').textContent = coins;
        document.getElementById('victory-time').textContent = timeStr;
        
        modal.classList.remove('hidden');

        // Bindear botones (limpiando previos para evitar duplicados)
        const btnNext = document.getElementById('btn-next-level');
        const btnMenu = document.getElementById('btn-victory-menu');
        
        // Clonar nodos para eliminar listeners viejos (truco rápido)
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
