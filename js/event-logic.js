/**
 * event-logic.js — Love Arcade v11.1
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de Eventos por Tiempo Limitado (LTE) e interactivos.
 *
 * CAMBIOS v11.1 (Event Engine Hardening):
 *  - [FIX CRÍTICO] Cacería de Tesoros: corregido el bug donde los anclajes
 *    ausentes contabilizaban hacia el total de objetos inyectados, resultando
 *    en solo 2 de 5 items visibles. Ahora los anclajes faltantes se omiten
 *    sin penalización en el contador. Se añade una capa de selectores de
 *    respaldo (HUNT_FALLBACK_ANCHORS) para garantizar siempre 5 inyecciones.
 *  - [FIX] Cacería de Tesoros: los objetos se distribuyen en secciones
 *    variadas de la plataforma (vista de Tienda incluida, que el usuario
 *    debe visitar para encontrarlos) usando posicionamiento por cuadrantes
 *    alternos, evitando agrupaciones predecibles.
 *  - [FIX CRÍTICO] Gachapón Relámpago: añadido límite de 5 tiradas diarias
 *    por evento (clave localStorage la_gacha_daily_{eventId}). El botón se
 *    bloquea cuando se alcanza el límite y la tarjeta indica cuántas tiradas
 *    quedan disponibles en el día.
 *  - [FIX] Gachapón Relámpago: eliminado el farmeo por spam de botón. El
 *    botón se desactiva durante la animación de ruleta y solo se reactiva
 *    al cerrar el modal.
 *  - [MEJORA] Gachapón Relámpago: nuevo modal de ruleta tipo tragamonedas.
 *    Al girar se abre un overlay con números animados que aterrizan en el
 *    resultado real. No interfiere con el layout de la sección de eventos.
 *  - [BALANCE] Gachapón Relámpago: probabilidades reequilibradas.
 *    Anterior: VE ≈ 278 monedas con costo 50 (farmeo masivo).
 *    Nueva:    VE ≈ 65 monedas con costo 50 (net +15/tirada, razonable).
 *    Con límite 5 tiradas/día: ganancia neta esperada máxima ≈ 75 /día.
 *
 * CAMBIOS v11.0 (Meta-Gameplay & Event Engine):
 *  - Motor completo: interactive_hunt, personal_milestone,
 *    gacha_flash, daily_missions.
 *  - Countdown en vivo 60 s. Ciclo de vida SPA (onEnter / onLeave).
 *
 * v11.1 — Event Engine Hardening
 */

(function () {
    'use strict';

    const EVENTS_CACHE_KEY  = 'love_arcade_events_v1';
    const HUNT_PROGRESS_KEY = 'la_hunt_progress';
    const MILESTONE_KEY     = 'la_milestone_progress';
    const GACHA_DAILY_KEY   = 'la_gacha_daily';
    const GACHA_DAILY_MAX   = 5;

    /**
     * Selectores de respaldo para la Cacería de Tesoros.
     * Todos existen en index.html de forma estática; querySelector los
     * encuentra en cualquier momento sin importar la vista activa.
     * Orden: de más accesible a más escondido/sorpresivo.
     */
    const HUNT_FALLBACK_ANCHORS = [
        '#games .game-card:nth-child(3)',
        '#games .game-card:nth-child(6)',
        '#games .game-card:nth-child(9)',
        '#faq details:nth-child(2)',
        '#faq details:nth-child(5)',
        '#view-shop .promo-toggle-wrap',
        '#view-shop .shop-tabs',
        '.player-hud .hud-streak',
    ];

    /**
     * Cuadrantes de posicionamiento para items de cacería.
     * Cada item usa un cuadrante distinto dentro del contenedor para
     * evitar que aparezcan siempre en la misma zona relativa.
     */
    const HUNT_QUADRANTS = [
        { top: [8,  26], left: [65, 88] },
        { top: [68, 86], left: [6,  28] },
        { top: [6,  22], left: [6,  28] },
        { top: [66, 85], left: [65, 88] },
        { top: [38, 56], left: [72, 90] },
    ];

    let _eventsCache = null;
    let _loadPromise = null;
    let _countdownInterval    = null;
    const COUNTDOWN_INTERVAL_MS = 60_000;

    /** Bloquea el botón del gacha mientras el modal de ruleta está abierto. */
    let _gachaAnimating = false;

    // ════════════════════════════════════════════════════════════════════════════
    // UTILIDADES DE TIEMPO
    // ════════════════════════════════════════════════════════════════════════════

    function _isEventLive(event) {
        const now   = Date.now();
        const start = event.startDate ? new Date(event.startDate).getTime() : 0;
        const end   = event.endDate   ? new Date(event.endDate).getTime()   : Infinity;
        return now >= start && now < end;
    }

    function _formatTimeLeft(dateStr) {
        const diff = new Date(dateStr).getTime() - Date.now();
        if (diff <= 0) return 'Expirado';
        const days  = Math.floor(diff / 86_400_000);
        const hours = Math.floor((diff % 86_400_000) / 3_600_000);
        const mins  = Math.floor((diff % 3_600_000)  / 60_000);
        if (days >= 2)               return `${days} días`;
        if (days === 1 && hours > 0) return `1 d ${hours} h`;
        if (days === 1)              return '1 día';
        if (hours > 0 && mins > 0)   return `${hours} h ${mins} min`;
        if (hours > 0)               return `${hours} h`;
        return mins > 0 ? `${mins} min` : 'Menos de 1 min';
    }

    function _icon(name, size = 18) {
        return `<svg class="icon" width="${size}" height="${size}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // CARGA DE DATOS
    // ════════════════════════════════════════════════════════════════════════════

    function _loadEvents() {
        if (_eventsCache) return Promise.resolve(_eventsCache);
        if (_loadPromise) return _loadPromise;

        _loadPromise = fetch('data/events.json', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                _eventsCache = data;
                try {
                    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
                } catch (_) {}
                window.isEventActive = isEventActive;
                _initHunt(data);
                _initMilestoneListener(data);
                return data;
            })
            .catch(() => {
                _eventsCache = { activeEvents: [] };
                return _eventsCache;
            });

        return _loadPromise;
    }

    _loadEvents().catch(() => {});

    // ════════════════════════════════════════════════════════════════════════════
    // isEventActive — API GLOBAL
    // ════════════════════════════════════════════════════════════════════════════

    function isEventActive(eventId) {
        if (!_eventsCache) return false;
        const ev = _eventsCache.activeEvents.find(e => e.id === eventId);
        if (!ev) return false;
        return _isEventLive(ev);
    }

    window.isEventActive = isEventActive;

    // ════════════════════════════════════════════════════════════════════════════
    // MECÁNICA: CACERÍA DE TESOROS (interactive_hunt)
    // ════════════════════════════════════════════════════════════════════════════

    function _readHuntCount() {
        try {
            const raw = localStorage.getItem(HUNT_PROGRESS_KEY + '_count');
            return raw ? parseInt(raw, 10) : 0;
        } catch (_) { return 0; }
    }

    function _writeHuntCount(count) {
        try { localStorage.setItem(HUNT_PROGRESS_KEY + '_count', String(count)); } catch (_) {}
    }

    function _readHuntIds() {
        try {
            const raw = localStorage.getItem(HUNT_PROGRESS_KEY + '_ids');
            if (!raw) return [];
            return JSON.parse(raw);
        } catch (_) { return []; }
    }

    function _writeHuntIds(ids) {
        try { localStorage.setItem(HUNT_PROGRESS_KEY + '_ids', JSON.stringify(ids)); } catch (_) {}
    }

    /**
     * Resuelve un selector a un elemento del DOM no usado todavía.
     * Soporta múltiples coincidencias y elige una al azar.
     * @returns {Element|null}
     */
    function _resolveAnchor(selector, usedEls) {
        try {
            const candidates = Array.from(document.querySelectorAll(selector))
                .filter(el => !usedEls.has(el));
            if (!candidates.length) return null;
            return candidates[Math.floor(Math.random() * candidates.length)];
        } catch (_) { return null; }
    }

    /**
     * Inyecta físicamente un objeto de cacería en el DOM.
     */
    function _injectHuntItem(anchor, itemId, emoji, quadIdx, huntEvent, total, reward) {
        const q      = HUNT_QUADRANTS[quadIdx % HUNT_QUADRANTS.length];
        const topPct  = q.top[0]  + Math.random() * (q.top[1]  - q.top[0]);
        const leftPct = q.left[0] + Math.random() * (q.left[1] - q.left[0]);

        const item = document.createElement('button');
        item.className       = 'treasure-item';
        item.dataset.itemId  = itemId;
        item.dataset.eventId = huntEvent.id;
        item.setAttribute('aria-label', 'Objeto de cacería — ¡haz clic para recolectarlo!');
        item.textContent     = emoji;

        item.style.setProperty('--hunt-top',  `${topPct}%`);
        item.style.setProperty('--hunt-left', `${leftPct}%`);

        if (getComputedStyle(anchor).position === 'static') {
            anchor.style.position = 'relative';
        }

        item.addEventListener('click', () =>
            _onTreasureCollect(item, huntEvent, total, reward)
        );
        anchor.appendChild(item);
    }

    /**
     * Inicializa la Cacería de Tesoros.
     *
     * [v11.1 FIX] Los anclajes ausentes ya NO contabilizan hacia el total.
     * El loop continúa hasta inyectar exactamente `total` items, usando
     * primero los selectores del JSON y luego HUNT_FALLBACK_ANCHORS.
     */
    function _initHunt(eventsData) {
        const huntEvent = (eventsData.activeEvents || []).find(
            e => e.type === 'interactive_hunt' && _isEventLive(e)
        );
        if (!huntEvent) return;

        const cfg    = huntEvent.config || {};
        const total  = cfg.total    || 5;
        const emoji  = cfg.itemEmoji || '⭐';
        const reward = cfg.reward  || 500;

        const foundIds = _readHuntIds();
        if (foundIds.length >= total) return;

        const configuredAnchors = cfg.anchors || [];
        const allAnchors = [...configuredAnchors, ...HUNT_FALLBACK_ANCHORS];

        const usedEls = new Set();
        let injected  = 0;

        for (const selector of allAnchors) {
            if (injected >= total) break;

            const itemId = `hunt-${huntEvent.id}-${injected}`;

            if (foundIds.includes(itemId)) {
                injected++;
                continue;
            }

            // [v11.1 FIX] Solo avanzar el contador si el anclaje existe.
            const anchor = _resolveAnchor(selector, usedEls);
            if (!anchor) continue;

            usedEls.add(anchor);
            _injectHuntItem(anchor, itemId, emoji, injected, huntEvent, total, reward);
            injected++;
        }
    }

    function _onTreasureCollect(itemEl, huntEvent, total, reward) {
        const itemId   = itemEl.dataset.itemId;
        const foundIds = _readHuntIds();
        if (foundIds.includes(itemId)) return;

        foundIds.push(itemId);
        _writeHuntIds(foundIds);
        _writeHuntCount(foundIds.length);

        itemEl.classList.add('treasure-item--collected');
        setTimeout(() => itemEl.remove(), 600);

        const remaining = total - foundIds.length;
        if (remaining > 0) {
            _showToast(`⭐ +1 estrella · Faltan ${remaining}`, '#7c3aed');
        } else {
            _showToast(`🎉 ¡Cacería completa! +${reward} monedas`, '#7c3aed');
            if (window.GameCenter) {
                window.GameCenter.addCoins(reward, `Cacería completada: ${huntEvent.id}`);
            }
            if (_eventsCache) _renderEventsView(_eventsCache);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // MECÁNICA: HITOS PERSONALES (personal_milestone)
    // ════════════════════════════════════════════════════════════════════════════

    function _readMilestoneProgress(eventId) {
        try {
            const raw = localStorage.getItem(`${MILESTONE_KEY}_${eventId}`);
            if (!raw) return 0;
            const { count, date } = JSON.parse(raw);
            const today = new Date().toISOString().slice(0, 10);
            return date === today ? (count || 0) : 0;
        } catch (_) { return 0; }
    }

    function _writeMilestoneProgress(eventId, count) {
        try {
            const today = new Date().toISOString().slice(0, 10);
            localStorage.setItem(`${MILESTONE_KEY}_${eventId}`, JSON.stringify({ count, date: today }));
        } catch (_) {}
    }

    function _initMilestoneListener(eventsData) {
        const milestoneEvents = (eventsData.activeEvents || []).filter(
            e => e.type === 'personal_milestone' && _isEventLive(e)
        );
        if (!milestoneEvents.length) return;

        document.addEventListener('la:levelcomplete', () => {
            milestoneEvents.forEach(ev => {
                if (!_isEventLive(ev)) return;
                const cfg    = ev.config || {};
                const target = cfg.target || 5;
                let progress = _readMilestoneProgress(ev.id);
                if (progress >= target) return;

                progress++;
                _writeMilestoneProgress(ev.id, progress);

                if (progress >= target) {
                    const mult     = cfg.multiplier          || 2;
                    const duration = cfg.multiplierDurationMs || 3_600_000;
                    if (window.GameCenter) {
                        window.GameCenter.activateBonusMultiplier(mult, duration, `Hito: ${ev.ui?.title || ev.id}`);
                    }
                    _showToast(`🏆 ¡Hito completado! ×${mult} por ${Math.round(duration / 60000)} min`, '#f59e0b');
                }
                if (_eventsCache) _renderEventsView(_eventsCache);
            });
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // MECÁNICA: GACHAPÓN RELÁMPAGO (gacha_flash)
    // ════════════════════════════════════════════════════════════════════════════

    function _readGachaDailySpins(eventId) {
        try {
            const raw = localStorage.getItem(`${GACHA_DAILY_KEY}_${eventId}`);
            if (!raw) return 0;
            const { date, spins } = JSON.parse(raw);
            const today = new Date().toISOString().slice(0, 10);
            return date === today ? (spins || 0) : 0;
        } catch (_) { return 0; }
    }

    function _writeGachaDailySpins(eventId, spins) {
        try {
            const today = new Date().toISOString().slice(0, 10);
            localStorage.setItem(
                `${GACHA_DAILY_KEY}_${eventId}`,
                JSON.stringify({ date: today, spins })
            );
        } catch (_) {}
    }

    /**
     * Calcula la recompensa del gacha con distribución reequilibrada.
     *
     * [v11.1 BALANCE]
     *  55 % → [min, ~35]    VE parcial ≈ 12
     *  30 % → [~35, ~90]    VE parcial ≈ 19
     *  12 % → [~90, ~250]   VE parcial ≈ 20
     *  2.5% → [~250, ~500]  VE parcial ≈ 9
     *  0.5% → [~500, max]   VE parcial ≈ 4
     *  VE total ≈ 64 monedas  |  Costo: 50  |  Net ≈ +14 / tirada
     *  5 tiradas/día → net esperado máx ≈ 70 monedas/día
     */
    function _rollGachaReward(min, max) {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        const rand = buf[0] / 0xFFFFFFFF;

        // Anclas de tier expresadas como porcentaje del max
        const t1 = Math.max(min + 1, Math.min(35,  max * 0.035));
        const t2 = Math.max(t1  + 1, Math.min(90,  max * 0.09));
        const t3 = Math.max(t2  + 1, Math.min(250, max * 0.25));
        const t4 = Math.max(t3  + 1, Math.min(500, max * 0.50));

        let reward;
        if (rand < 0.55) {
            reward = min + Math.floor(rand / 0.55 * (t1 - min));
        } else if (rand < 0.85) {
            reward = t1 + Math.floor((rand - 0.55) / 0.30 * (t2 - t1));
        } else if (rand < 0.97) {
            reward = t2 + Math.floor((rand - 0.85) / 0.12 * (t3 - t2));
        } else if (rand < 0.995) {
            reward = t3 + Math.floor((rand - 0.97) / 0.025 * (t4 - t3));
        } else {
            reward = t4 + Math.floor((rand - 0.995) / 0.005 * (max - t4));
        }

        return Math.max(min, Math.min(max, Math.floor(reward)));
    }

    /**
     * Ejecuta un giro del Gachapón Relámpago.
     * [v11.1] Incluye verificación de límite diario.
     */
    function _spinGacha(gachaEvent) {
        if (!window.GameCenter) return { success: false, message: 'GameCenter no disponible' };

        const cfg  = gachaEvent.config || {};
        const cost = cfg.cost      || 50;
        const min  = cfg.minReward || 10;
        const max  = cfg.maxReward || 1000;

        const usedToday = _readGachaDailySpins(gachaEvent.id);
        if (usedToday >= GACHA_DAILY_MAX) {
            return {
                success: false,
                message: `Límite diario alcanzado (${GACHA_DAILY_MAX}/${GACHA_DAILY_MAX}). Vuelve mañana.`,
                spinsLeft: 0
            };
        }

        if (window.GameCenter.getBalance() < cost) {
            return { success: false, message: `Necesitas ${cost} monedas para girar.` };
        }

        const spendResult = window.GameCenter.spendCoins?.(cost, `Gachapón: ${gachaEvent.id}`);
        if (!spendResult?.success) {
            return { success: false, message: 'Saldo insuficiente.' };
        }

        const reward    = _rollGachaReward(min, max);
        const newTotal  = usedToday + 1;
        _writeGachaDailySpins(gachaEvent.id, newTotal);
        const spinsLeft = GACHA_DAILY_MAX - newTotal;

        window.GameCenter.addCoins(reward, `Gachapón Relámpago: ${gachaEvent.id}`);

        return { success: true, reward, message: `¡Ganaste ${reward} monedas!`, spinsLeft };
    }

    // ════════════════════════════════════════════════════════════════════════════
    // GACHAPÓN — MODAL DE RULETA (slot machine)
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Abre el modal de ruleta tipo tragamonedas.
     * Números falsos se deslizan y aterrizan en el resultado real.
     * El modal es un overlay fijo; no modifica el layout de la vista de eventos.
     *
     * @param {number}   reward       Monedas ganadas.
     * @param {string}   accentColor  Color de acento del evento.
     * @param {Function} onClose      Callback al cerrar (re-renderiza la vista).
     */
    function _showGachaRoulette(reward, accentColor, onClose) {
        if (document.getElementById('la-gacha-overlay')) return;

        const ITEM_H   = 64;
        const NUM_FAKE = 22;

        const fakeNums = Array.from({ length: NUM_FAKE }, () =>
            Math.floor(10 + Math.random() * 990)
        );
        const allNums  = [...fakeNums, reward];

        let rewardLabel = '🎰 Resultado';
        let rewardClass = 'gacha-result--normal';
        if (reward >= 500)      { rewardLabel = '🎉 ¡JACKPOT!';   rewardClass = 'gacha-result--jackpot'; }
        else if (reward >= 200) { rewardLabel = '✨ ¡Excelente!'; rewardClass = 'gacha-result--great'; }
        else if (reward >= 80)  { rewardLabel = '⭐ ¡Bien!';      rewardClass = 'gacha-result--good'; }

        const overlay = document.createElement('div');
        overlay.id        = 'la-gacha-overlay';
        overlay.className = 'gacha-roulette-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Resultado del Gachapón');

        overlay.innerHTML = `
        <div class="gacha-roulette-modal" style="--gacha-color:${accentColor};">
            <div class="gacha-roulette-header">
                <span class="gacha-roulette-icon" aria-hidden="true">🎰</span>
                <h3 class="gacha-roulette-title">Portal Estelar</h3>
            </div>

            <div class="gacha-slot-wrap" aria-hidden="true">
                <div class="gacha-slot-window">
                    <div class="gacha-slot-strip" id="la-slot-strip">
                        ${allNums.map(n => `<div class="gacha-slot-item">${n}</div>`).join('')}
                    </div>
                </div>
                <div class="gacha-slot-sheen gacha-slot-sheen--top"></div>
                <div class="gacha-slot-sheen gacha-slot-sheen--bottom"></div>
                <div class="gacha-slot-center-line"></div>
            </div>

            <div class="gacha-roulette-result ${rewardClass}" id="la-gacha-result" aria-live="polite">
                <span class="gacha-result-coins">+${reward} 🪙</span>
                <span class="gacha-result-label">${rewardLabel}</span>
            </div>

            <button class="gacha-roulette-close hidden" id="la-gacha-close">¡Genial! ✨</button>
        </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('gacha-roulette-overlay--visible'));

        const strip   = document.getElementById('la-slot-strip');
        const targetY = (allNums.length - 1) * ITEM_H;

        // Doble rAF garantiza que el browser calculó el tamaño antes de animar
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                strip.style.transition = `transform 2.4s cubic-bezier(0.22, 0.68, 0, 1.05)`;
                strip.style.transform  = `translateY(-${targetY}px)`;
            });
        });

        const resultEl = document.getElementById('la-gacha-result');
        const closeBtn = document.getElementById('la-gacha-close');

        strip.addEventListener('transitionend', () => {
            // Micro-rebote en el último número
            strip.style.transition = 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)';
            strip.style.transform  = `translateY(-${targetY - 6}px)`;
            setTimeout(() => {
                strip.style.transition = 'transform 0.12s ease-in';
                strip.style.transform  = `translateY(-${targetY}px)`;
                setTimeout(() => {
                    resultEl.classList.add('gacha-result--revealed');
                    closeBtn.classList.remove('hidden');
                }, 150);
            }, 180);
        }, { once: true });

        function _closeModal() {
            overlay.classList.remove('gacha-roulette-overlay--visible');
            overlay.classList.add('gacha-roulette-overlay--closing');
            setTimeout(() => {
                overlay.remove();
                if (typeof onClose === 'function') onClose();
            }, 320);
        }

        closeBtn.addEventListener('click', _closeModal);
        overlay.addEventListener('click', e => {
            if (e.target === overlay && !closeBtn.classList.contains('hidden')) _closeModal();
        });

        const _onKeyDown = e => {
            if (e.key === 'Escape' && !closeBtn.classList.contains('hidden')) {
                _closeModal();
                document.removeEventListener('keydown', _onKeyDown);
            }
        };
        document.addEventListener('keydown', _onKeyDown);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // TOAST — Notificaciones flotantes ligeras
    // ════════════════════════════════════════════════════════════════════════════

    function _showToast(message, color = 'var(--accent)') {
        const toast = document.createElement('div');
        toast.className = 'la-event-toast';
        toast.style.setProperty('--toast-color', color);
        toast.textContent = message;
        document.body.appendChild(toast);
        toast.getBoundingClientRect();
        toast.classList.add('la-event-toast--visible');
        setTimeout(() => {
            toast.classList.remove('la-event-toast--visible');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // MAPA DE TIPOS DE EVENTO — metadatos visuales
    // ════════════════════════════════════════════════════════════════════════════

    const EVENT_META = {
        coin_multiplier: {
            color: '#00d4ff', colorDim: 'rgba(0,212,255,0.14)', colorBorder: 'rgba(0,212,255,0.38)',
            colorGlow: 'rgba(0,212,255,0.18)',
            gradientBg: 'linear-gradient(150deg,#060f1e 0%,#091525 60%,rgba(0,212,255,0.05) 100%)',
            artEmojis: ['🪙','⚡','💫','🪙'],
            getHeroValue: ev => `×${ev.multiplier || 1.5}`,
            getShortDesc:  ev => ev.description || 'Multiplicador de monedas activo en todos los minijuegos.'
        },
        streak_boost: {
            color: '#f59e0b', colorDim: 'rgba(245,158,11,0.14)', colorBorder: 'rgba(245,158,11,0.38)',
            colorGlow: 'rgba(245,158,11,0.18)',
            gradientBg: 'linear-gradient(150deg,#0f0a00 0%,#1a1200 60%,rgba(245,158,11,0.05) 100%)',
            artEmojis: ['🔥','⚡','🔥','✨'],
            getHeroValue: () => '+2',
            getShortDesc:  ev => ev.description || 'Cada bono diario suma +2 a tu racha.'
        },
        interactive_hunt: {
            color: '#7c3aed', colorDim: 'rgba(124,58,237,0.14)', colorBorder: 'rgba(124,58,237,0.38)',
            colorGlow: 'rgba(124,58,237,0.18)',
            gradientBg: 'linear-gradient(150deg,#0a0614 0%,#120a24 60%,rgba(124,58,237,0.06) 100%)',
            artEmojis: ['⭐','🔍','✨','⭐'],
            getHeroValue: ev => `${ev.config?.total || 5}/5`,
            getShortDesc:  ev => ev.ui?.description || 'Encuentra objetos escondidos en la plataforma.'
        },
        personal_milestone: {
            color: '#f59e0b', colorDim: 'rgba(245,158,11,0.14)', colorBorder: 'rgba(245,158,11,0.38)',
            colorGlow: 'rgba(245,158,11,0.18)',
            gradientBg: 'linear-gradient(150deg,#0f0a00 0%,#1a1200 60%,rgba(245,158,11,0.05) 100%)',
            artEmojis: ['🏆','⚡','🎮','🏆'],
            getHeroValue: ev => `×${ev.config?.multiplier || 2}`,
            getShortDesc:  ev => ev.ui?.description || 'Completa partidas para activar un multiplicador de monedas.'
        },
        gacha_flash: {
            color: '#ec4899', colorDim: 'rgba(236,72,153,0.14)', colorBorder: 'rgba(236,72,153,0.38)',
            colorGlow: 'rgba(236,72,153,0.18)',
            gradientBg: 'linear-gradient(150deg,#140009 0%,#200010 60%,rgba(236,72,153,0.06) 100%)',
            artEmojis: ['🎰','✨','💎','🎰'],
            getHeroValue: ev => `${ev.config?.cost || 50}🪙`,
            getShortDesc:  ev => ev.ui?.description || 'Gachapón de tiempo limitado. ¡Gana hasta 1000 monedas!'
        },
        daily_missions: {
            color: '#10b981', colorDim: 'rgba(16,185,129,0.14)', colorBorder: 'rgba(16,185,129,0.38)',
            colorGlow: 'rgba(16,185,129,0.18)',
            gradientBg: 'linear-gradient(150deg,#000f09 0%,#001a10 60%,rgba(16,185,129,0.05) 100%)',
            artEmojis: ['📋','✅','🎯','📋'],
            getHeroValue: () => '×2',
            getShortDesc:  ev => ev.ui?.description || 'Completa objetivos diarios para ganar recompensas.'
        }
    };

    function _getMeta(type) {
        return EVENT_META[type] || EVENT_META.coin_multiplier;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // RENDERING — TARJETAS POR TIPO
    // ════════════════════════════════════════════════════════════════════════════

    function _renderHuntCard(event, meta) {
        const cfg        = event.config || {};
        const total      = cfg.total || 5;
        const foundCount = _readHuntIds().length;
        const isComplete = foundCount >= total;
        const timeLeft   = _formatTimeLeft(event.endDate);
        const color      = meta.color;

        return `
        <article class="lte-card lte-card--interactive"
                 data-event-id="${event.id}" data-event-type="${event.type}"
                 style="background:${meta.gradientBg}; --ev-color:${color}; --ev-glow:${meta.colorGlow}; --ev-border:${meta.colorBorder};">
            <div class="lte-art" aria-hidden="true">
                ${meta.artEmojis.map((e,i) => `<span class="lte-art__deco lte-art__deco--${i+1}">${e}</span>`).join('')}
            </div>
            <div class="lte-card__accent-bar" style="background:linear-gradient(90deg,${color} 0%,transparent 100%);"></div>
            <div class="lte-card__head">
                ${isComplete
                    ? `<span class="lte-status-badge" style="background:rgba(16,185,129,0.2);color:#10b981;border-color:rgba(16,185,129,0.4);">COMPLETADA ✓</span>`
                    : `<span class="lte-status-badge lte-status-badge--live">
                           <span class="lte-live-dot" style="--dot-color:${color};"></span>EN VIVO
                       </span>`}
                <span class="lte-timer-pill" style="color:${color};border-color:${meta.colorBorder};background:${meta.colorDim};">
                    ${_icon('clock', 11)}&thinsp;${timeLeft}
                </span>
            </div>
            <div class="lte-card__hero-wrap">
                <span class="lte-hero-value" style="color:${color};">${foundCount}/${total}</span>
            </div>
            <div class="lte-card__info">
                <h3 class="lte-card__name">${event.ui?.title || 'Cacería de Tesoros'}</h3>
                <p class="lte-card__desc">${event.ui?.description || ''}</p>
            </div>
            <div class="lte-progress-wrap">
                <div class="lte-progress-bar" role="progressbar"
                     aria-valuenow="${foundCount}" aria-valuemax="${total}"
                     style="--progress:${Math.round(foundCount / total * 100)}%;--bar-color:${color};">
                    <div class="lte-progress-bar__fill"></div>
                </div>
                <span class="lte-progress-label" style="color:${color};">
                    ${foundCount}/${total} estrellas • Premio: ${cfg.reward || 500} monedas
                </span>
            </div>
        </article>`;
    }

    function _renderMilestoneCard(event, meta) {
        const cfg      = event.config || {};
        const target   = cfg.target  || 5;
        const mult     = cfg.multiplier || 2;
        const durMin   = Math.round((cfg.multiplierDurationMs || 3_600_000) / 60_000);
        const progress = _readMilestoneProgress(event.id);
        const isDone   = progress >= target;
        const timeLeft = _formatTimeLeft(event.endDate);
        const color    = meta.color;

        const bonusStatus = window.GameCenter?.getBonusMultiplierStatus?.() || { active: false };
        const bonusLabel  = bonusStatus.active && bonusStatus.multiplier === mult
            ? `✓ ×${mult} ACTIVO · ${Math.ceil(bonusStatus.remainingMs / 60_000)} min restantes`
            : null;

        return `
        <article class="lte-card lte-card--interactive"
                 data-event-id="${event.id}" data-event-type="${event.type}"
                 style="background:${meta.gradientBg}; --ev-color:${color}; --ev-glow:${meta.colorGlow}; --ev-border:${meta.colorBorder};">
            <div class="lte-art" aria-hidden="true">
                ${meta.artEmojis.map((e,i) => `<span class="lte-art__deco lte-art__deco--${i+1}">${e}</span>`).join('')}
            </div>
            <div class="lte-card__accent-bar" style="background:linear-gradient(90deg,${color} 0%,transparent 100%);"></div>
            <div class="lte-card__head">
                ${isDone
                    ? `<span class="lte-status-badge" style="background:rgba(16,185,129,0.2);color:#10b981;border-color:rgba(16,185,129,0.4);">
                           ${bonusLabel ? `×${mult} ACTIVO ⚡` : 'COMPLETADO ✓'}
                       </span>`
                    : `<span class="lte-status-badge lte-status-badge--live">
                           <span class="lte-live-dot" style="--dot-color:${color};"></span>EN VIVO
                       </span>`}
                <span class="lte-timer-pill" style="color:${color};border-color:${meta.colorBorder};background:${meta.colorDim};">
                    ${_icon('clock', 11)}&thinsp;${timeLeft}
                </span>
            </div>
            <div class="lte-card__hero-wrap">
                <span class="lte-hero-value" style="color:${color};">×${mult}</span>
            </div>
            <div class="lte-card__info">
                <h3 class="lte-card__name">${event.ui?.title || 'Hito Personal'}</h3>
                <p class="lte-card__desc">${event.ui?.description || ''}</p>
            </div>
            ${bonusLabel ? `
            <div class="lte-bonus-active-pill" style="color:${color};border-color:${meta.colorBorder};background:${meta.colorDim};">
                ${_icon('zap', 11)}&thinsp;${bonusLabel}
            </div>` : ''}
            <div class="lte-progress-wrap">
                <div class="lte-progress-bar" role="progressbar"
                     aria-valuenow="${progress}" aria-valuemax="${target}"
                     style="--progress:${Math.min(100, Math.round(progress / target * 100))}%;--bar-color:${color};">
                    <div class="lte-progress-bar__fill"></div>
                </div>
                <span class="lte-progress-label" style="color:${color};">
                    ${progress}/${target} partidas · buff de ${durMin} min al completar
                </span>
            </div>
        </article>`;
    }

    /**
     * Renderiza la tarjeta del Gachapón Relámpago.
     * [v11.1] Muestra tiradas restantes del día y bloquea al agotar el límite.
     */
    function _renderGachaCard(event, meta) {
        const cfg      = event.config || {};
        const cost     = cfg.cost      || 50;
        const maxRew   = cfg.maxReward || 1000;
        const timeLeft = _formatTimeLeft(event.endDate);
        const color    = meta.color;
        const balance  = window.GameCenter?.getBalance?.() || 0;

        const usedToday      = _readGachaDailySpins(event.id);
        const spinsLeft      = Math.max(0, GACHA_DAILY_MAX - usedToday);
        const dailyExhausted = spinsLeft === 0;
        const canSpin        = !dailyExhausted && balance >= cost;

        const btnLabel = dailyExhausted
            ? `⏳ Límite diario (${GACHA_DAILY_MAX}/${GACHA_DAILY_MAX})`
            : balance < cost
                ? `Necesitas ${cost} monedas`
                : `${_icon('star', 14)}&thinsp;Girar · ${cost} monedas`;

        const spinsHint = dailyExhausted
            ? `<span class="lte-gacha-spins lte-gacha-spins--empty">Vuelve mañana para más tiradas</span>`
            : `<span class="lte-gacha-spins" style="color:${meta.colorBorder};">
                   🎰 ${spinsLeft} de ${GACHA_DAILY_MAX} tiradas disponibles hoy
               </span>`;

        return `
        <article class="lte-card lte-card--interactive"
                 data-event-id="${event.id}" data-event-type="${event.type}"
                 style="background:${meta.gradientBg}; --ev-color:${color}; --ev-glow:${meta.colorGlow}; --ev-border:${meta.colorBorder};">
            <div class="lte-art" aria-hidden="true">
                ${meta.artEmojis.map((e,i) => `<span class="lte-art__deco lte-art__deco--${i+1}">${e}</span>`).join('')}
            </div>
            <div class="lte-card__accent-bar" style="background:linear-gradient(90deg,${color} 0%,transparent 100%);"></div>
            <div class="lte-card__head">
                <span class="lte-status-badge lte-status-badge--live">
                    <span class="lte-live-dot" style="--dot-color:${color};"></span>EN VIVO
                </span>
                <span class="lte-timer-pill" style="color:${color};border-color:${meta.colorBorder};background:${meta.colorDim};">
                    ${_icon('clock', 11)}&thinsp;${timeLeft}
                </span>
            </div>
            <div class="lte-card__hero-wrap">
                <span class="lte-hero-value" style="color:${color};">×???</span>
            </div>
            <div class="lte-card__info">
                <h3 class="lte-card__name">${event.ui?.title || 'Gachapón Relámpago'}</h3>
                <p class="lte-card__desc">${event.ui?.description || ''}</p>
            </div>
            <div class="lte-gacha-action">
                <button class="lte-gacha-btn${canSpin ? '' : ' lte-gacha-btn--disabled'}"
                        data-gacha-event-id="${event.id}"
                        ${canSpin ? '' : 'disabled aria-disabled="true"'}>
                    ${btnLabel}
                </button>
                ${spinsHint}
                <span class="lte-gacha-range" style="color:${meta.colorBorder};">
                    Gana de ${cfg.minReward || 10} a ${maxRew} monedas
                </span>
            </div>
        </article>`;
    }

    function _renderDailyMissionsCard(event, meta) {
        const missions = event.config?.missions || [];
        const timeLeft = _formatTimeLeft(event.endDate);
        const color    = meta.color;

        if (!window.GameCenter) return '';

        const stats = window.GameCenter.getMissionStats();

        const missionItems = missions.map(m => {
            const isClaimed = stats.claimed.includes(m.id);
            let current = 0;
            if (m.type === 'playtime')     current = stats.playtime;
            if (m.type === 'games_played') current = stats.games_played;

            const pct    = Math.min(100, Math.round(current / m.target * 100));
            const isDone = current >= m.target;

            let currentLabel = current;
            let targetLabel  = m.target;
            if (m.type === 'playtime') {
                currentLabel = `${Math.floor(current / 60)} min`;
                targetLabel  = `${Math.floor(m.target / 60)} min`;
            }

            return `
            <div class="lte-mission-item${isClaimed ? ' lte-mission-item--claimed' : ''}">
                <div class="lte-mission-header">
                    <span class="lte-mission-label">${m.label}</span>
                    <span class="lte-mission-reward" style="color:${color};">+${m.reward} 🪙</span>
                </div>
                <div class="lte-progress-bar lte-progress-bar--sm" role="progressbar"
                     aria-valuenow="${current}" aria-valuemax="${m.target}"
                     style="--progress:${pct}%;--bar-color:${color};">
                    <div class="lte-progress-bar__fill"></div>
                </div>
                <div class="lte-mission-footer">
                    <span class="lte-progress-label" style="color:${color};">
                        ${isClaimed ? '✓ Reclamada' : `${currentLabel} / ${targetLabel}`}
                    </span>
                    ${isDone && !isClaimed
                        ? `<button class="lte-claim-btn" style="--claim-color:${color};"
                                   data-mission-id="${m.id}" data-mission-reward="${m.reward}">
                               Reclamar
                           </button>`
                        : ''}
                </div>
            </div>`;
        }).join('');

        return `
        <article class="lte-card lte-card--interactive lte-card--missions"
                 data-event-id="${event.id}" data-event-type="${event.type}"
                 style="background:${meta.gradientBg}; --ev-color:${color}; --ev-glow:${meta.colorGlow}; --ev-border:${meta.colorBorder};">
            <div class="lte-art" aria-hidden="true">
                ${meta.artEmojis.map((e,i) => `<span class="lte-art__deco lte-art__deco--${i+1}">${e}</span>`).join('')}
            </div>
            <div class="lte-card__accent-bar" style="background:linear-gradient(90deg,${color} 0%,transparent 100%);"></div>
            <div class="lte-card__head">
                <span class="lte-status-badge lte-status-badge--live">
                    <span class="lte-live-dot" style="--dot-color:${color};"></span>EN VIVO
                </span>
                <span class="lte-timer-pill" style="color:${color};border-color:${meta.colorBorder};background:${meta.colorDim};">
                    ${_icon('clock', 11)}&thinsp;Se reinicia a medianoche
                </span>
            </div>
            <div class="lte-card__info" style="margin-bottom:12px;">
                <h3 class="lte-card__name">${event.ui?.title || 'Misiones del Día'}</h3>
                <p class="lte-card__desc">${event.ui?.description || ''}</p>
            </div>
            <div class="lte-missions-list">${missionItems}</div>
        </article>`;
    }

    function _renderGenericCard(event) {
        const meta      = _getMeta(event.type);
        const isExpired = !_isEventLive(event);
        const timeLeft  = _formatTimeLeft(event.endDate);
        const heroValue = meta.getHeroValue(event);
        const shortDesc = meta.getShortDesc(event);
        const color     = meta.color;

        const artHTML = meta.artEmojis.map((emoji, i) =>
            `<span class="lte-art__deco lte-art__deco--${i+1}" aria-hidden="true">${emoji}</span>`
        ).join('');

        const statusBadge = isExpired
            ? `<span class="lte-status-badge lte-status-badge--expired">EXPIRADO</span>`
            : `<span class="lte-status-badge lte-status-badge--live">
                   <span class="lte-live-dot" style="--dot-color:${color};"></span>EN VIVO
               </span>`;

        const timerBadge = isExpired ? '' : `
            <span class="lte-timer-pill"
                  style="color:${color}; border-color:${meta.colorBorder}; background:${meta.colorDim};">
                ${_icon('clock', 11)}&thinsp;${timeLeft}
            </span>`;

        return `
        <article class="lte-card${isExpired ? ' lte-card--expired' : ''}"
                 data-event-id="${event.id}" data-event-type="${event.type}"
                 style="background:${meta.gradientBg}; --ev-color:${color}; --ev-glow:${meta.colorGlow}; --ev-border:${meta.colorBorder};"
                 ${isExpired ? 'aria-disabled="true"' : ''}>
            <div class="lte-art" aria-hidden="true">${artHTML}</div>
            <div class="lte-card__accent-bar" style="background:linear-gradient(90deg,${color} 0%,transparent 100%);"></div>
            <div class="lte-card__head">${statusBadge}${timerBadge}</div>
            <div class="lte-card__hero-wrap" aria-label="Efecto del evento: ${heroValue}">
                <span class="lte-hero-value" style="color:${color};">${heroValue}</span>
            </div>
            <div class="lte-card__info">
                <h3 class="lte-card__name">${event.title || event.ui?.title || ''}</h3>
                <p class="lte-card__desc">${shortDesc}</p>
            </div>
        </article>`;
    }

    function _renderEventCard(event) {
        if (!_isEventLive(event)) return '';
        const meta = _getMeta(event.type);
        switch (event.type) {
            case 'interactive_hunt':   return _renderHuntCard(event, meta);
            case 'personal_milestone': return _renderMilestoneCard(event, meta);
            case 'gacha_flash':        return _renderGachaCard(event, meta);
            case 'daily_missions':     return _renderDailyMissionsCard(event, meta);
            default:                   return _renderGenericCard(event);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // RENDERING — HERO HEADER
    // ════════════════════════════════════════════════════════════════════════════

    function _renderHero(activeCount) {
        const plural = activeCount !== 1;
        return `
        <div class="lte-hero">
            <div class="lte-hero__eyebrow${activeCount === 0 ? ' lte-hero__eyebrow--empty' : ''}">
                ${activeCount > 0
                    ? `${_icon('zap', 12)}&thinsp;${activeCount} EVENTO${plural ? 'S' : ''} ACTIVO${plural ? 'S' : ''}`
                    : `${_icon('clock', 12)}&thinsp;SIN EVENTOS ACTIVOS`}
            </div>
            <h2 class="lte-hero__title">Eventos</h2>
            <p class="lte-hero__sub">
                ${activeCount > 0
                    ? 'Bonificaciones y desafíos activos — ¡participa antes de que expiren!'
                    : 'Pronto habrá nuevas bonificaciones. ¡Vuelve a revisar pronto!'}
            </p>
        </div>`;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // RENDERING — VISTA COMPLETA
    // ════════════════════════════════════════════════════════════════════════════

    function _renderEventsView(eventsData) {
        const container = document.getElementById('view-events');
        if (!container) return;

        const allEvents   = eventsData.activeEvents || [];
        const liveEvents  = allEvents.filter(e => _isEventLive(e));
        const activeCount = liveEvents.length;

        let html = `<div class="events-view-inner">`;
        html += _renderHero(activeCount);

        if (liveEvents.length > 0) {
            html += `<div class="lte-cards-list">`;
            html += liveEvents.map(_renderEventCard).filter(Boolean).join('');
            html += `</div>`;
            html += `
            <p class="lte-legend">
                ${_icon('info', 12)}
                <span>Los eventos se aplican automáticamente. Las misiones y la cacería requieren interacción.</span>
            </p>`;
        } else {
            html += `
            <div class="lte-empty">
                ${_icon('calendar', 42)}
                <p>No hay eventos activos en este momento.</p>
                <span>¡Vuelve pronto para ver nuevas bonificaciones y desafíos!</span>
            </div>`;
        }

        html += `</div>`;
        container.innerHTML = html;
        _bindViewListeners(container, eventsData);
    }

    /**
     * Registra los event listeners de la vista de eventos.
     *
     * [v11.1] El flag _gachaAnimating previene spam de tiradas durante la
     * animación. El botón se re-habilita solo al cerrar el modal de ruleta.
     */
    function _bindViewListeners(container, eventsData) {
        container.querySelectorAll('.lte-gacha-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                if (_gachaAnimating) return;

                const eventId = btn.dataset.gachaEventId;
                const gachaEv = (eventsData.activeEvents || []).find(e => e.id === eventId);
                if (!gachaEv) return;

                const result = _spinGacha(gachaEv);

                if (!result.success) {
                    _showToast(`⚠️ ${result.message}`, '#94a3b8');
                    setTimeout(() => _renderEventsView(_eventsCache), 100);
                    return;
                }

                _gachaAnimating = true;
                btn.disabled = true;
                btn.classList.add('lte-gacha-btn--disabled');

                const color = _getMeta(gachaEv.type).color;

                _showGachaRoulette(result.reward, color, () => {
                    _gachaAnimating = false;
                    if (_eventsCache) _renderEventsView(_eventsCache);
                });
            });
        });

        container.querySelectorAll('.lte-claim-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const missionId = btn.dataset.missionId;
                const reward    = parseInt(btn.dataset.missionReward, 10);
                if (!window.GameCenter) return;

                const result = window.GameCenter.claimMissionReward(missionId, reward);
                if (result.success) {
                    _showToast(`✅ +${reward} monedas reclamadas`, '#10b981');
                    setTimeout(() => _renderEventsView(_eventsCache), 100);
                }
            });
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // CICLO DE VIDA SPA
    // ════════════════════════════════════════════════════════════════════════════

    let _rendered = false;

    async function onEnter() {
        const container = document.getElementById('view-events');

        if (!_rendered && container) {
            container.innerHTML = `
            <div class="events-view-inner">
                <div class="lte-skeleton lte-skeleton--hero"></div>
                <div class="lte-skeleton lte-skeleton--card"></div>
                <div class="lte-skeleton lte-skeleton--card lte-skeleton--card-2"></div>
            </div>`;
        }

        try {
            const eventsData = await _loadEvents();
            _renderEventsView(eventsData);
            _rendered = true;
        } catch (err) {
            console.warn('[EventLogic] Error al cargar eventos:', err);
        }

        _clearCountdown();
        _countdownInterval = setInterval(() => {
            if (_eventsCache) _renderEventsView(_eventsCache);
        }, COUNTDOWN_INTERVAL_MS);
    }

    function onLeave() {
        _clearCountdown();
    }

    function _clearCountdown() {
        if (_countdownInterval !== null) {
            clearInterval(_countdownInterval);
            _countdownInterval = null;
        }
    }

    window.EventView     = { onEnter, onLeave };
    window.isEventActive = isEventActive;

})();