import { Storage }    from '../systems/Storage.js';
import { AudioSynth } from '../systems/AudioSynth.js';

export const UI = {

    screens: {
        menu:     document.getElementById('screen-menu'),
        levels:   document.getElementById('screen-levels'),
        game:     document.getElementById('screen-game'),
        settings: document.getElementById('screen-settings')
    },

    /**
     * Referencia al IntersectionObserver activo del grid de niveles.
     * Se almacena para poder desconectarlo antes de cada re-render,
     * evitando que callbacks de observadores huérfanos procesen imágenes
     * de renders anteriores y disparen cargas innecesarias.
     *
     * @type {IntersectionObserver|null}
     */
    _thumbObserver: null,

    initGlobalInteractions() {
        const selector = '.btn, .btn-icon, .btn-hud-action, .level-card';
        let lastTouchTs = 0;

        const onPress = (e) => {
            const el = e.target.closest(selector);
            if (!el) return;

            if (e.type === 'mousedown' && Date.now() - lastTouchTs < 500) return;
            if (e.type === 'touchstart') lastTouchTs = Date.now();

            AudioSynth.play('click');
        };

        const onRelease = (e) => {
            const el = e.target.closest(selector);
            if (!el) return;

            el.animate(
                [
                    { transform: 'translateY(4px)', easing: 'ease-out' },
                    { transform: 'translateY(-2px)' },
                    { transform: 'translateY(0)' }
                ],
                { duration: 200, fill: 'none' }
            );
        };

        if (window.PointerEvent) {
            document.addEventListener('pointerdown', onPress);
            document.addEventListener('pointerup', onRelease);
            return;
        }

        document.addEventListener('touchstart', onPress, { passive: true });
        document.addEventListener('mousedown', onPress);
        document.addEventListener('touchend', onRelease, { passive: true });
        document.addEventListener('mouseup', onRelease);
    },

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
    },

    /**
     * Renderiza la cuadrícula de selección de niveles con lazy loading
     * de thumbnails mediante IntersectionObserver.
     *
     * Gestión del observer:
     *   Antes de crear un nuevo observer se desconecta el anterior
     *   (almacenado en UI._thumbObserver). Esto evita que re-renders
     *   sucesivos acumulen observadores activos que continúen procesando
     *   imágenes ya fuera del árbol DOM, lo cual causaría cargas
     *   duplicadas y callbacks ejecutándose en nodos detachados.
     *
     * Con 150 niveles el DocumentFragment evita 150 reflows individuales;
     * el observer sólo dispara la asignación de src cuando la imagen
     * está a 200px de entrar al viewport.
     *
     * @param {Array}    levelsWithStatus  Resultado de LevelManager.getAllLevelsWithStatus()
     * @param {Function} onLevelSelect     Callback invocado con el id del nivel elegido
     */
    renderLevelsGrid(levelsWithStatus, onLevelSelect) {
        const container = document.getElementById('levels-container');
        if (!container) return;

        // Desconectar el observer del render anterior para evitar
        // callbacks huérfanos y cargas duplicadas de thumbnails.
        if (UI._thumbObserver) {
            UI._thumbObserver.disconnect();
            UI._thumbObserver = null;
        }

        container.innerHTML = '';

        const fragment = document.createDocumentFragment();

        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        delete img.dataset.src;
                    }
                    obs.unobserve(img);
                }
            });
        }, { rootMargin: '200px' });

        // Guardar referencia para poder desconectar en el próximo render.
        UI._thumbObserver = observer;

        levelsWithStatus.forEach((level) => {
            const card = document.createElement('div');

            const isUnlocked  = level.status !== 'locked';
            const isCompleted = level.status === 'completed';
            const levelNum    = level.id.split('_')[1] || (level.index + 1);

            let statusClass = level.status === 'locked' ? 'locked' : '';
            if (isCompleted) statusClass += ' completed';

            card.className = `level-card skeleton ${statusClass}`.trim();

            if (isUnlocked) {
                card.setAttribute('role', 'button');
                card.setAttribute('tabindex', '0');
                card.setAttribute('aria-label',
                    isCompleted
                        ? `Nivel ${levelNum}, completado`
                        : `Nivel ${levelNum}, disponible`
                );
            } else {
                card.setAttribute('role', 'img');
                card.setAttribute('aria-label', `Nivel ${levelNum}, bloqueado`);
                card.setAttribute('aria-disabled', 'true');
            }

            const img = document.createElement('img');
            img.dataset.src    = level.thumbnail || level.image;
            img.decoding       = 'async';
            img.alt            = `Nivel ${levelNum}`;
            img.referrerPolicy = 'no-referrer';

            let triedFallback = false;

            img.onload = () => {
                card.classList.remove('skeleton');
                img.classList.add('loaded');
            };

            img.onerror = () => {
                if (!triedFallback && level.thumbnail && level.thumbnail !== level.image) {
                    triedFallback = true;
                    img.src = level.image;
                } else {
                    img.style.display = 'none';
                    const errorIcon = document.createElement('div');
                    errorIcon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--danger);"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
                    errorIcon.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1;';
                    card.appendChild(errorIcon);
                }
            };

            observer.observe(img);

            const overlay = document.createElement('div');
            overlay.className = 'level-overlay';
            overlay.setAttribute('aria-hidden', 'true');

            if (!isUnlocked) {
                overlay.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>`;
            } else if (isCompleted) {
                overlay.innerHTML = `<div style="display:flex;gap:4px;color:var(--success);"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`;
            } else {
                overlay.innerHTML = `<span>${levelNum}</span>`;
            }

            card.appendChild(img);
            card.appendChild(overlay);

            if (isUnlocked) {
                card.onclick = () => onLevelSelect(level.id);
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onLevelSelect(level.id);
                    }
                });
            }

            fragment.appendChild(card);
        });

        container.appendChild(fragment);
    },

    updateHUD(levelId) {
        const lvlEl = document.getElementById('hud-level');
        if (lvlEl) {
            const num = levelId.replace('lvl_', '');
            lvlEl.textContent = `LVL ${num}`;
        }
    },

    showVictoryModal(coins, onNext, onMenu) {
        const modal = document.getElementById('modal-victory');
        if (!modal) return;

        const coinsEl = document.getElementById('victory-coins');
        if (coinsEl) coinsEl.textContent = coins;

        modal.classList.remove('hidden');

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
    },

    showAlert(title, message, onOk = null) {
        const modal = document.getElementById('modal-alert');
        if (!modal) return;

        document.getElementById('modal-alert-title').textContent   = title;
        document.getElementById('modal-alert-message').textContent = message;

        const btnOk = document.getElementById('btn-alert-ok');
        const newOk = btnOk.cloneNode(true);
        btnOk.parentNode.replaceChild(newOk, btnOk);

        modal.classList.remove('hidden');

        newOk.onclick = () => {
            modal.classList.add('hidden');
            if (onOk) onOk();
        };
    },

    showConfirm(title, message, onYes, onNo = null) {
        const modal = document.getElementById('modal-confirm');
        if (!modal) return;

        document.getElementById('modal-confirm-title').textContent   = title;
        document.getElementById('modal-confirm-message').textContent = message;

        const btnYes = document.getElementById('btn-confirm-yes');
        const btnNo  = document.getElementById('btn-confirm-no');
        const newYes = btnYes.cloneNode(true);
        const newNo  = btnNo.cloneNode(true);

        btnYes.parentNode.replaceChild(newYes, btnYes);
        btnNo.parentNode.replaceChild(newNo,  btnNo);

        modal.classList.remove('hidden');

        newYes.onclick = () => {
            modal.classList.add('hidden');
            if (onYes) onYes();
        };
        newNo.onclick = () => {
            modal.classList.add('hidden');
            if (onNo) onNo();
        };
    }
};
