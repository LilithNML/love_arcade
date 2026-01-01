/**
 * UIController.js
 * Encargado de la manipulación del DOM, transiciones de pantalla y renderizado de listas.
 * Actualizado para soportar Skeletons, Thumbnails y PWA.
 */

export const UI = {
    // Cache de referencias a las pantallas para acceso rápido
    screens: {
        menu: document.getElementById('screen-menu'),
        levels: document.getElementById('screen-levels'),
        game: document.getElementById('screen-game'),
        settings: document.getElementById('screen-settings')
    },

    /**
     * Cambia la pantalla activa con transición.
     * @param {string} targetIdOrName - ID del elemento (ej: 'screen-game') o alias ('game').
     */
    showScreen: (targetIdOrName) => {
        // 1. Resolver el elemento destino
        let targetScreen = document.getElementById(targetIdOrName);

        // Fallback: buscar en el mapa de alias si no es un ID directo
        if (!targetScreen && UI.screens[targetIdOrName]) {
            targetScreen = UI.screens[targetIdOrName];
        }

        if (!targetScreen) {
            console.warn(`[UI] Pantalla no encontrada: ${targetIdOrName}`);
            return;
        }

        // 2. Ocultar todas las pantallas activas
        const allScreens = document.querySelectorAll('.screen');
        allScreens.forEach(screen => {
            screen.classList.remove('active');
            screen.style.pointerEvents = 'none'; // Evitar clicks fantasma durante transición
        });
        
        // 3. Mostrar la pantalla objetivo
        targetScreen.classList.add('active');
        targetScreen.style.pointerEvents = 'all';

        // 4. Resetear scroll por usabilidad
        window.scrollTo(0, 0);
    },

    /**
     * Renderiza la cuadrícula de niveles con soporte para Thumbnails y Skeletons.
     * @param {Array} levelsWithStatus - Array de objetos de nivel con estado (locked/completed).
     * @param {Function} onLevelSelect - Callback al hacer click en un nivel.
     */
    renderLevelsGrid: (levelsWithStatus, onLevelSelect) => {
        const container = document.getElementById('levels-container');
        if (!container) return;
        
        container.innerHTML = ''; // Limpiar lista anterior

        levelsWithStatus.forEach(level => {
            // Crear tarjeta contenedora
            const card = document.createElement('div');
            
            // Determinar clases de estado
            let statusClass = '';
            if (level.status === 'locked') statusClass = 'locked';
            else if (level.status === 'completed') statusClass = 'completed';
            
            // Agregar clase 'skeleton' por defecto para el efecto de carga
            card.className = `level-card skeleton ${statusClass}`;

            // --- LÓGICA DE IMAGEN (THUMBNAIL) ---
            const img = new Image();
            // Priorizar thumbnail, usar imagen completa como fallback
            const imgSrc = level.thumbnail || level.image;
            
            img.src = imgSrc;
            img.loading = "lazy"; // Optimización nativa del navegador
            img.alt = `Nivel ${level.index + 1}`;
            
            // Clase inicial oculta para hacer fade-in
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.3s ease';

            // Evento: Carga exitosa
            img.onload = () => {
                card.classList.remove('skeleton'); // Quitar animación de carga
                img.style.opacity = '1';           // Mostrar imagen suavemente
                img.classList.add('loaded');
            };

            // Evento: Error (Fallback)
            img.onerror = () => {
                // Si falló el thumbnail, intentar cargar la imagen full
                if (level.thumbnail && img.src.includes(level.thumbnail)) {
                    // Evitar bucle infinito si la full también falla
                    img.src = level.image; 
                } else {
                    // Si todo falla, quitar skeleton para mostrar solo el número
                    card.classList.remove('skeleton');
                }
            };

            // --- OVERLAY (Información sobre la imagen) ---
            const overlay = document.createElement('div');
            // Estilos inline para asegurar posicionamiento sin depender 100% del CSS externo
            overlay.style.cssText = 'position:absolute; inset:0; z-index:2; display:flex; justify-content:center; align-items:center; text-shadow:0 2px 4px rgba(0,0,0,0.8); color:white; font-size:1.5rem; font-weight:bold; pointer-events:none;';

            if (level.status === 'locked') {
                // Icono de candado (SVG)
                overlay.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
            } else {
                // Número de nivel
                // Asumimos ID formato "lvl_1", extraemos el número
                const levelNum = level.id.split('_')[1] || (level.index + 1);
                overlay.textContent = levelNum;

                // Checkmark si está completado
                if (level.status === 'completed') {
                    const check = document.createElement('span');
                    check.innerHTML = '✓';
                    check.style.cssText = 'color:#10b981; margin-left:5px; font-size:1rem;';
                    overlay.appendChild(check);
                }
            }

            // Ensamblar tarjeta
            card.appendChild(img);
            card.appendChild(overlay);

            // Asignar evento click solo si no está bloqueado
            if (level.status !== 'locked') {
                card.onclick = () => onLevelSelect(level.id);
            }

            container.appendChild(card);
        });
    },

    /**
     * Actualiza la información del HUD durante el juego.
     */
    updateHUD: (levelId, timeStr) => {
        const lvlEl = document.getElementById('hud-level');
        const timeEl = document.getElementById('hud-timer');
        
        if (lvlEl) {
            // Intentar formatear "lvl_1" a "LVL 1"
            const num = levelId.replace('lvl_', '');
            lvlEl.textContent = `LVL ${num}`;
        }
        
        if (timeEl) timeEl.textContent = timeStr;
    },

    /**
     * Muestra el modal de victoria.
     * Nota: La lógica de los botones se maneja principalmente en main.js para asegurar contextos,
     * pero esta función configura la visualización básica.
     */
    showVictoryModal: (coins, statusText, onNext, onMenu) => {
        const modal = document.getElementById('modal-victory');
        if (!modal) return;

        // Actualizar textos
        const coinsEl = document.getElementById('victory-coins');
        const titleEl = modal.querySelector('h3'); // Título del modal
        
        if (coinsEl) coinsEl.textContent = coins;
        if (titleEl && statusText) titleEl.textContent = statusText;
        
        // Mostrar modal
        modal.classList.remove('hidden');

        // Nota: Los listeners de los botones (Siguiente/Menú) se asignan 
        // en main.js usando .cloneNode() para evitar duplicidad de eventos.
    }
};
