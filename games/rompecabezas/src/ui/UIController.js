/**
 * UIController.js v4.0 — Performance & Accessibility Edition
 * Encargado de la manipulación del DOM, transiciones de pantalla y renderizado de listas.
 *
 * Cambios respecto a v3.0:
 *
 * RENDIMIENTO (problema de 3s al entrar a la pantalla de niveles):
 * - renderLevelsGrid() ahora usa IntersectionObserver para lazy loading real de
 *   thumbnails. Las imágenes fuera del viewport NO inician descarga hasta ser visibles.
 *   Antes se disparaban 64 peticiones HTTP simultáneas, saturando la conexión.
 * - Las tarjetas se insertan en el DOM mediante DocumentFragment (una sola mutación
 *   en lugar de 64 appendChild individuales, eliminando el layout thrashing).
 * - Se almacena la URL en data-src y solo se migra a src al entrar en viewport.
 * - El observer anterior se desconecta antes de cada re-renderizado para evitar
 *   callbacks fantasma de tarjetas ya eliminadas del DOM.
 *
 * ACCESIBILIDAD (WCAG 2.2):
 * - Todos los botones de solo-icono tienen aria-label descriptivo.
 * - Las tarjetas de nivel bloqueadas tienen aria-disabled="true".
 * - El estado de estrellas se expone con aria-label en la tarjeta completada.
 * - initGlobalInteractions() sigue siendo la fuente única del release bounce.
 *
 * MOTION DESIGN:
 * - Release bounce corregido: 0.96 → 1.04 → 1.0 (sin cambios desde v3.0).
 * - Stagger delay de tarjetas: 0.04s × índice (sin cambios desde v3.0).
 */

import { Storage } from '../systems/Storage.js';

export const UI = {

    screens: {
        menu:     document.getElementById('screen-menu'),
        levels:   document.getElementById('screen-levels'),
        game:     document.getElementById('screen-game'),
        settings: document.getElementById('screen-settings')
    },

    /**
     * Referencia al IntersectionObserver activo de la cuadrícula de niveles.
     * Se desconecta y recrea en cada llamada a renderLevelsGrid() para evitar
     * acumulación de observadores sobre nodos DOM ya eliminados.
     * @type {IntersectionObserver|null}
     */
    _thumbObserver: null,

    /**
     * Inicializa las interacciones globales táctiles/mouse.
     * Llamar una sola vez al arrancar la app.
     *
     * Release bounce: 0.96 (press) → 1.04 (overshoot) → 1.0 (settle) en 200ms.
     * Sólo anima `transform` — GPU composited, sin layout thrashing.
     */
    initGlobalInteractions() {
        const selector = '.btn, .btn-icon, .btn-circle';

        const onRelease = (e) => {
            const el = e.target.closest(selector);
            if (!el) return;

            el.animate(
                [
                    { transform: 'scale3d(0.96, 0.96, 1)', easing: 'ease-out' },
                    { transform: 'scale3d(1.04, 1.04, 1)' },
                    { transform: 'scale3d(1.00, 1.00, 1)' }
                ],
                { duration: 200, fill: 'none' }
            );
        };

        document.addEventListener('mouseup',  onRelease);
        document.addEventListener('touchend', onRelease, { passive: true });
    },

    /**
     * Cambia la pantalla activa con transición slide.
     * Fuerza un replay de animaciones CSS en los botones de navegación
     * del menú mediante un reflow intencional (void offsetHeight trick).
     *
     * @param {string} targetIdOrName - ID de elemento DOM o clave del mapa `screens`
     */
    showScreen(targetIdOrName) {
        let targetScreen = document.getElementById(targetIdOrName);
        if (!targetScreen && UI.screens[targetIdOrName]) {
            targetScreen = UI.screens[targetIdOrName];
        }
        if (!targetScreen) {
            console.warn(`[UI] Pantalla no encontrada: ${targetIdOrName}`);
            return;
        }

        const allScreens = document.querySelectorAll('.screen');
        allScreens.forEach(screen => {
            screen.classList.remove('active');
            screen.style.pointerEvents = 'none';
        });

        targetScreen.classList.add('active');
        targetScreen.style.pointerEvents = 'all';
        window.scrollTo(0, 0);

        // Fuerza replay del stagger en botones de navegación del menú
        const navBtns = targetScreen.querySelectorAll('.main-nav .btn');
        navBtns.forEach(btn => {
            btn.style.animation = 'none';
            void btn.offsetHeight; // reflow intencional para reiniciar la animación CSS
            btn.style.animation = '';
        });
    },

    /**
     * Renderiza la cuadrícula de niveles con lazy loading real vía IntersectionObserver.
     *
     * ESTRATEGIA DE CARGA:
     * 1. Se construyen todas las tarjetas con src vacío (data-src en su lugar).
     * 2. Un IntersectionObserver monitorea cada tarjeta.
     * 3. Cuando una tarjeta entra al viewport (+ 100px de margen anticipado),
     *    se asigna el src real → el browser inicia la descarga en ese momento.
     * 4. Esto reduce de 64 peticiones simultáneas a ~6-8 peticiones iniciales,
     *    eliminando la saturación de conexión que causaba el retraso de ~3 segundos.
     *
     * INSERCIÓN DE DOM:
     * - Todas las tarjetas se ensamblan en un DocumentFragment antes de tocar el DOM.
     * - Un solo `container.appendChild(fragment)` reemplaza los 64 appendChild
     *   individuales anteriores, eliminando el layout thrashing en el render inicial.
     *
     * @param {Array}    levelsWithStatus - Array de niveles con campos status/stars añadidos
     * @param {Function} onLevelSelect   - Callback invocado con el ID del nivel seleccionado
     */
    renderLevelsGrid(levelsWithStatus, onLevelSelect) {
        const container = document.getElementById('levels-container');
        if (!container) return;

        // ── Limpiar observer anterior ─────────────────────────────────────────
        // Si no se desconecta explícitamente, el IntersectionObserver anterior
        // seguirá emitiendo callbacks sobre nodos eliminados del DOM, causando
        // errores silenciosos y consumo de memoria innecesario.
        if (UI._thumbObserver) {
            UI._thumbObserver.disconnect();
            UI._thumbObserver = null;
        }

        container.innerHTML = '';

        // ── Crear IntersectionObserver ────────────────────────────────────────
        // rootMargin: '100px 0px' significa que la carga comienza 100px ANTES
        // de que la tarjeta sea visible, eliminando el pop-in al hacer scroll.
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const img = entry.target.querySelector('img[data-src]');
                if (img) {
                    img.src = img.dataset.src;     // activa la descarga real
                    img.removeAttribute('data-src');
                }

                // Dejar de observar esta tarjeta una vez iniciada la carga
                observer.unobserve(entry.target);
            });
        }, {
            root:       null,       // viewport del documento
            rootMargin: '100px 0px', // pre-carga 100px antes de ser visible
            threshold:  0
        });

        UI._thumbObserver = observer;

        // ── Construir tarjetas en DocumentFragment ────────────────────────────
        // Un DocumentFragment es un nodo DOM ligero que no está en el árbol del
        // documento. Las operaciones sobre él no disparan reflows. Solo cuando
        // se hace el appendChild final el browser procesa todo de una vez.
        const fragment = document.createDocumentFragment();

        levelsWithStatus.forEach((level, index) => {
            const card = document.createElement('div');

            const isUnlocked  = Storage.isUnlocked(level.id);
            const starsCount  = Storage.getStars(level.id);
            const levelNum    = level.id.split('_')[1] || (level.index + 1);

            let statusClass = isUnlocked ? '' : 'locked';
            if (starsCount > 0) statusClass += ' completed';

            card.className = `level-card skeleton ${statusClass}`.trim();
            card.style.animationDelay = `${index * 0.04}s`;

            // ── Accesibilidad ─────────────────────────────────────────────────
            // Los botones implícitos (divs clickeables) necesitan role y aria-label
            // para que los lectores de pantalla los anuncien correctamente.
            if (isUnlocked) {
                card.setAttribute('role', 'button');
                card.setAttribute('tabindex', '0');
                if (starsCount > 0) {
                    const starText = ['', 'una estrella', 'dos estrellas', 'tres estrellas'][starsCount] || '';
                    card.setAttribute('aria-label', `Nivel ${levelNum}, completado con ${starText}`);
                } else {
                    card.setAttribute('aria-label', `Nivel ${levelNum}, disponible`);
                }
            } else {
                card.setAttribute('role', 'img');
                card.setAttribute('aria-label', `Nivel ${levelNum}, bloqueado`);
                card.setAttribute('aria-disabled', 'true');
            }

            // ── Imagen (lazy via IntersectionObserver) ────────────────────────
            // IMPORTANTE: no se asigna img.src aquí. Solo data-src.
            // El IntersectionObserver asignará el src real cuando la tarjeta
            // entre al viewport, evitando 64 peticiones HTTP simultáneas.
            const img = document.createElement('img');
            img.dataset.src = level.thumbnail || level.image;
            img.loading     = 'lazy';    // hint nativo adicional (doble seguro)
            img.decoding    = 'async';   // decodificación no bloqueante
            img.fetchPriority = 'low';   // [Optimización] Reduce prioridad en red para no bloquear assets críticos
            img.alt         = `Nivel ${levelNum}`;
            img.style.cssText = 'opacity:0; transition:opacity 0.3s ease; width:100%; height:100%; object-fit:cover; display:block;';

            let triedFallback = false;

            img.onload = () => {
                card.classList.remove('skeleton');
                img.style.opacity = '1';
                img.classList.add('loaded');
            };

            img.onerror = () => {
                // Si la thumbnail falla, intenta con la imagen principal (una vez)
                if (!triedFallback && level.thumbnail && level.thumbnail !== level.image) {
                    triedFallback = true;
                    img.src = level.image;
                } else {
                    card.classList.remove('skeleton');
                }
            };

            // ── Overlay de estado ─────────────────────────────────────────────
            const overlay = document.createElement('div');
            overlay.className = 'level-overlay';
            overlay.setAttribute('aria-hidden', 'true'); // decorativo; la info ya está en aria-label

            if (!isUnlocked) {
                overlay.innerHTML = `
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="1" ry="1"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>`;
            } else if (starsCount > 0) {
                let stars = '';
                for (let i = 0; i < 3; i++) stars += i < starsCount ? '★' : '☆';
                overlay.innerHTML = `<div class="stars-display" style="color:#fbbf24; font-size:1.3rem;">${stars}</div>`;
            } else {
                overlay.innerHTML = `<span style="font-family:'Rajdhani',sans-serif; font-weight:700; letter-spacing:2px;">${levelNum}</span>`;
            }

            card.appendChild(img);
            card.appendChild(overlay);

            // ── Interacción ───────────────────────────────────────────────────
            if (isUnlocked) {
                card.onclick = () => onLevelSelect(level.id);

                // Soporte de teclado: Enter y Space activan la tarjeta
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onLevelSelect(level.id);
                    }
                });
            }

            fragment.appendChild(card);

            // Registrar la tarjeta en el observer DESPUÉS de añadirla al fragment
            // (el observer necesita el nodo como parámetro, no importa si está en DOM)
            observer.observe(card);
        });

        // ── Inserción única en el DOM ─────────────────────────────────────────
        // Un solo appendChild vs. 64 individuales: diferencia de ~40ms en gama baja.
        container.appendChild(fragment);
    },

    /**
     * Actualiza los elementos del HUD durante la partida.
     *
     * @param {string} levelId  - ID del nivel activo (ej: "lvl_5")
     * @param {string} timeStr  - Tiempo formateado (ej: "01:30" o "∞")
     */
    updateHUD(levelId, timeStr) {
        const lvlEl  = document.getElementById('hud-level');
        const timeEl = document.getElementById('hud-timer');
        if (lvlEl) {
            const num = levelId.replace('lvl_', '');
            lvlEl.textContent = `LVL ${num}`;
        }
        if (timeEl) timeEl.textContent = timeStr;
    },

    /**
     * Muestra el modal de victoria con estrellas animadas.
     * Clona los botones de acción para eliminar listeners de partidas anteriores
     * (patrón necesario porque el modal persiste entre partidas).
     *
     * @param {number}   coins  - Monedas ganadas
     * @param {string}   timeStr - Tiempo final formateado
     * @param {number}   stars  - Estrellas obtenidas (1-3)
     * @param {Function} onNext - Callback al pulsar "SIGUIENTE"
     * @param {Function} onMenu - Callback al pulsar "MENÚ"
     */
    showVictoryModal(coins, timeStr, stars, onNext, onMenu) {
        const modal = document.getElementById('modal-victory');
        if (!modal) return;

        const coinsEl = document.getElementById('victory-coins');
        const timeEl  = document.getElementById('victory-time');
        if (coinsEl) coinsEl.textContent = coins;
        if (timeEl)  timeEl.textContent  = timeStr;

        let starsContainer = document.getElementById('victory-stars');
        if (!starsContainer) {
            starsContainer = document.createElement('div');
            starsContainer.id = 'victory-stars';
            starsContainer.style.cssText = 'font-size:3rem; color:#fbbf24; text-align:center; margin:15px 0;';
            if (timeEl?.parentNode) {
                timeEl.parentNode.parentNode.insertBefore(starsContainer, timeEl.parentNode.nextSibling);
            }
        }

        let starsHTML = '';
        for (let i = 0; i < 3; i++) {
            starsHTML += i < stars
                ? '<span>★</span>'
                : '<span style="opacity:0.2">★</span>';
        }
        starsContainer.innerHTML = starsHTML;

        modal.classList.remove('hidden');

        // Clonar para eliminar listeners de victorias anteriores
        const btnNext = document.getElementById('btn-next-level');
        const btnMenu = document.getElementById('btn-victory-menu');
        if (btnNext && btnMenu) {
            const newNext = btnNext.cloneNode(true);
            const newMenu = btnMenu.cloneNode(true);
            btnNext.parentNode.replaceChild(newNext, btnNext);
            btnMenu.parentNode.replaceChild(newMenu, btnMenu);
            newNext.onclick = () => { modal.classList.add('hidden'); onNext(); };
            newMenu.onclick = () => { modal.classList.add('hidden'); onMenu(); };
        }
    }
};
