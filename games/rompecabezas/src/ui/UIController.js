/**
 * UIController.js
 * Encargado de la manipulación del DOM, transiciones de pantalla y renderizado de listas.
 * Actualizado Fase 2: Sistema de Estrellas, Skeletons, Thumbnails y PWA.
 */

import { Storage } from '../systems/Storage.js';

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
     * Renderiza la cuadrícula de niveles con soporte para Estrellas, Thumbnails y Skeletons.
     * @param {Array} levelsWithStatus - Array de objetos de nivel.
     * @param {Function} onLevelSelect - Callback al hacer click en un nivel.
     */
    renderLevelsGrid: (levelsWithStatus, onLevelSelect) => {
        const container = document.getElementById('levels-container');
        if (!container) return;
        
        container.innerHTML = ''; // Limpiar lista anterior

        levelsWithStatus.forEach(level => {
            // Crear tarjeta contenedora
            const card = document.createElement('div');
            
            // Verificar estado real usando el nuevo Storage system
            const isUnlocked = Storage.isUnlocked(level.id);
            const starsCount = Storage.getStars(level.id); // 0 a 3
            
            // Clases CSS base
            let statusClass = isUnlocked ? '' : 'locked';
            if (starsCount > 0) statusClass += ' completed';
            
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
                if (level.thumbnail && img.src.includes('thumb')) {
                    img.src = level.image; 
                } else {
                    card.classList.remove('skeleton');
                }
            };

            // --- OVERLAY (Estrellas e Info) ---
            const overlay = document.createElement('div');
            overlay.className = 'level-overlay'; // Clase CSS definida en style.css
            
            if (!isUnlocked) {
                // ICONO CANDADO (Locked)
                overlay.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
            } else {
                if (starsCount > 0) {
                    // NIVEL COMPLETADO (Mostrar Estrellas)
                    let starsHTML = '';
                    for(let i = 0; i < 3; i++) {
                        // Estrella llena (★) o vacía (☆)
                        starsHTML += i < starsCount ? '★' : '☆';
                    }
                    // Contenedor de estrellas
                    overlay.innerHTML = `<div class="stars-display" style="color:#fbbf24; text-shadow:0 2px 4px rgba(0,0,0,0.9); font-size:1.4rem;">${starsHTML}</div>`;
                } else {
                    // NIVEL NUEVO (Mostrar Número)
                    const levelNum = level.id.split('_')[1] || (level.index + 1);
                    overlay.textContent = levelNum;
                }
            }

            // Ensamblar tarjeta
            card.appendChild(img);
            card.appendChild(overlay);

            // Asignar evento click solo si está desbloqueado
            if (isUnlocked) {
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
            const num = levelId.replace('lvl_', '');
            lvlEl.textContent = `LVL ${num}`;
        }
        
        if (timeEl) timeEl.textContent = timeStr;
    },

    /**
     * Muestra el modal de victoria con animación de estrellas.
     * @param {number} coins - Monedas ganadas.
     * @param {string} timeStr - Tiempo final.
     * @param {number} stars - Cantidad de estrellas (1-3).
     * @param {Function} onNext - Callback botón siguiente.
     * @param {Function} onMenu - Callback botón menú.
     */
    showVictoryModal: (coins, timeStr, stars, onNext, onMenu) => {
        const modal = document.getElementById('modal-victory');
        if (!modal) return;

        // Actualizar textos básicos
        const coinsEl = document.getElementById('victory-coins');
        const timeEl = document.getElementById('victory-time');
        
        if (coinsEl) coinsEl.textContent = coins;
        if (timeEl) timeEl.textContent = timeStr;
        
        // --- RENDERIZAR ESTRELLAS EN MODAL ---
        // Buscamos o creamos el contenedor de estrellas
        let starsContainer = document.getElementById('victory-stars');
        if (!starsContainer) {
            // Inyectarlo dinámicamente si no existe en el HTML base
            starsContainer = document.createElement('div');
            starsContainer.id = 'victory-stars';
            starsContainer.style.cssText = 'font-size: 3rem; color: #fbbf24; text-align: center; margin: 15px 0; text-shadow: 0 4px 10px rgba(251, 191, 36, 0.5);';
            
            // Insertar después del tiempo
            if (timeEl && timeEl.parentNode) {
                timeEl.parentNode.parentNode.insertBefore(starsContainer, timeEl.parentNode.nextSibling);
            }
        }

        // Generar HTML de estrellas con opacidad para las no ganadas
        let starsHTML = '';
        for(let i = 0; i < 3; i++) {
            if (i < stars) {
                starsHTML += '<span>★</span>'; // Ganada
            } else {
                starsHTML += '<span style="opacity:0.2">★</span>'; // No ganada
            }
        }
        starsContainer.innerHTML = starsHTML;

        // Mostrar modal
        modal.classList.remove('hidden');

        // Clonación de botones para limpiar listeners anteriores (Best Practice)
        const btnNext = document.getElementById('btn-next-level');
        const btnMenu = document.getElementById('btn-victory-menu');
        
        if (btnNext && btnMenu) {
            const newBtnNext = btnNext.cloneNode(true);
            const newBtnMenu = btnMenu.cloneNode(true);
            
            btnNext.parentNode.replaceChild(newBtnNext, btnNext);
            btnMenu.parentNode.replaceChild(newBtnMenu, btnMenu);

            newBtnNext.onclick = () => { modal.classList.add('hidden'); onNext(); };
            newBtnMenu.onclick = () => { modal.classList.add('hidden'); onMenu(); };
        }
    }
};
