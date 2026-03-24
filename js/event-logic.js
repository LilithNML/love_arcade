/**
 * event-logic.js — Love Arcade v10.3
 * ─────────────────────────────────────────────────────────────────────────────
 * Módulo de Eventos por Tiempo Limitado (LTE).
 *
 * CAMBIOS v10.3 (Timezone Fix + Countdown en vivo):
 *  - [FIX CRÍTICO] Cálculo de tiempo restante incorrecto por falta de zona
 *    horaria explícita en endDate. Los eventos expiraban horas antes de lo
 *    esperado porque "2026-03-23T23:59:59Z" se interpretaba como UTC en lugar
 *    de hora local. La corrección vive en events.json (usar offset explícito
 *    p.ej. "2026-03-23T23:59:59-06:00"); la lógica de comparación en
 *    isEventActive() y _formatTimeLeft() es correcta una vez que Date.parse()
 *    recibe una cadena con offset.
 *  - [FIX] _formatTimeLeft(): reescrita para mostrar horas Y minutos
 *    combinados cuando quedan menos de 24 h (p.ej. "5 h 42 min" en lugar de
 *    solo "5 h"), eliminando la ambigüedad que hacía parecer que quedaba menos
 *    tiempo del real.
 *  - [MEJORA] Countdown en vivo: onEnter() inicia un setInterval de 60 s que
 *    re-renderiza la vista de eventos. onLeave() lo cancela para no acumular
 *    timers al navegar entre vistas.
 *
 * CAMBIOS v10.2 (External Game Event Fix + Rediseño Visual):
 *  - [FIX CRÍTICO] isEventActive() para juegos externos: después de cargar
 *    events.json con éxito, los datos se persisten en localStorage bajo la
 *    clave 'love_arcade_events_v1'. El stub de app.js (que corre en juegos
 *    externos sin event-logic.js) ahora lee este caché en lugar de devolver
 *    siempre false. Los juegos externos aplican correctamente el multiplicador
 *    de Invasión de Monedas y cualquier otro efecto de evento futuro.
 *    TTL del caché: 24 horas.
 *  - [DISEÑO] Vista de eventos rediseñada: tarjetas tipo "banner de evento"
 *    con fondo degradado por tipo, elementos decorativos flotantes (emoji),
 *    valor del efecto en tipografía gigante, badge EN VIVO animado y
 *    descripción completa. Todo el texto en español.
 *  - [IDIOMA] Todos los literales de la UI están ahora en español.
 *
 * CAMBIOS v10.1 (Refactor LTE — Eliminación Gachapón):
 *  - Sistema de Gachapón eliminado completamente.
 *  - _loadEvents() se invoca de forma INMEDIATA al parsear el módulo.
 *
 * RESPONSABILIDADES:
 *  - Cargar y parsear data/events.json (fetch con caché en memoria).
 *  - Persistir el caché en localStorage para juegos externos (v10.2).
 *  - Exponer isEventActive(id) globalmente para app.js.
 *  - Renderizar la vista #view-events con tarjetas LTE de alto impacto visual.
 *  - Mantener el countdown de tiempo restante actualizado en vivo (v10.3).
 *
 * v10.3 — Timezone Fix + Countdown en vivo
 */

(function () {
    'use strict';

    /** Clave de caché localStorage — contrato compartido con el stub de app.js */
    const EVENTS_CACHE_KEY = 'love_arcade_events_v1';

    // ── Caché en memoria ──────────────────────────────────────────────────────
    let _eventsCache = null;
    let _loadPromise = null;

    // ── Countdown en vivo ─────────────────────────────────────────────────────
    /** ID del setInterval de refresco de la vista; null cuando la vista no está activa. */
    let _countdownInterval = null;
    /** Intervalo de refresco en ms (60 segundos). */
    const COUNTDOWN_INTERVAL_MS = 60_000;

    // ════════════════════════════════════════════════════════════════════════════
    // CARGA DE DATOS — INMEDIATA (fix race condition + fix juegos externos)
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Carga events.json. La primera llamada crea la Promise; las siguientes
     * reutilizan la misma instancia (sin peticiones duplicadas).
     *
     * [v10.2] Al resolver con éxito, persiste los datos en localStorage con
     * timestamp bajo EVENTS_CACHE_KEY. El stub de app.js lee este caché cuando
     * event-logic.js no está disponible en el contexto de un juego externo,
     * garantizando que completeLevel() aplique el multiplicador correctamente.
     *
     * @returns {Promise<object>}
     */
    function _loadEvents() {
        if (_eventsCache)  return Promise.resolve(_eventsCache);
        if (_loadPromise)  return _loadPromise;

        _loadPromise = fetch('data/events.json', { cache: 'no-store' })
            .then(r  => r.json())
            .then(data => {
                _eventsCache = data;

                // [v10.2 FIX] Persistir en localStorage para juegos externos.
                try {
                    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify({
                        data: data,
                        ts:   Date.now()
                    }));
                } catch (_) { /* localStorage lleno — ignorar */ }

                window.isEventActive = isEventActive;
                return data;
            })
            .catch(() => {
                _eventsCache = { activeEvents: [] };
                return _eventsCache;
            });

        return _loadPromise;
    }

    // Inicio INMEDIATO (fix race condition)
    _loadEvents().catch(() => {});

    // ════════════════════════════════════════════════════════════════════════════
    // isEventActive — API GLOBAL
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Comprueba si un evento está activo (existe y no ha expirado).
     * Función SÍNCRONA sobre el caché en memoria.
     *
     * Nota de zona horaria: la comparación se realiza entre dos timestamps UTC
     * puros (Date.now() y new Date(endDate).getTime()). El resultado es exacto
     * siempre que endDate incluya un offset de zona horaria explícito
     * (p.ej. "2026-03-23T23:59:59-06:00") en lugar del sufijo "Z" que
     * forzaría la interpretación UTC.
     *
     * @param {string} eventId
     * @returns {boolean}
     */
    function isEventActive(eventId) {
        if (!_eventsCache) return false;
        const ev = _eventsCache.activeEvents.find(e => e.id === eventId);
        if (!ev) return false;
        return Date.now() < new Date(ev.endDate).getTime();
    }

    window.isEventActive = isEventActive;

    // ════════════════════════════════════════════════════════════════════════════
    // HELPERS
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Devuelve una cadena legible con el tiempo restante hasta dateStr.
     *
     * [v10.3] Reescrita para mayor precisión:
     *  - Combina horas y minutos cuando quedan menos de 24 h
     *    (p.ej. "5 h 42 min" en lugar de solo "5 h").
     *  - Elimina el caso "Mañana" que ocultaba la cantidad exacta de horas.
     *  - Usa aritmética de módulo para extraer cada unidad de tiempo de forma
     *    independiente y sin acumulación de errores de redondeo.
     *
     * @param {string} dateStr  Fecha ISO 8601 con offset de zona horaria.
     * @returns {string}
     */
    function _formatTimeLeft(dateStr) {
        const diff = new Date(dateStr).getTime() - Date.now();
        if (diff <= 0) return 'Expirado';

        const days  = Math.floor(diff / 86_400_000);
        const hours = Math.floor((diff % 86_400_000) / 3_600_000);
        const mins  = Math.floor((diff % 3_600_000)  / 60_000);

        if (days >= 2)                    return `${days} días`;
        if (days === 1 && hours > 0)      return `1 d ${hours} h`;
        if (days === 1)                   return '1 día';
        if (hours > 0 && mins > 0)        return `${hours} h ${mins} min`;
        if (hours > 0)                    return `${hours} h`;
        return mins > 0 ? `${mins} min`  : 'Menos de 1 min';
    }

    function _icon(name, size = 18) {
        return `<svg class="icon" width="${size}" height="${size}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // MAPA DE TIPOS DE EVENTO
    // ════════════════════════════════════════════════════════════════════════════

    const EVENT_META = {
        coin_multiplier: {
            color:        '#00d4ff',
            colorDim:     'rgba(0, 212, 255, 0.14)',
            colorBorder:  'rgba(0, 212, 255, 0.38)',
            colorGlow:    'rgba(0, 212, 255, 0.18)',
            gradientBg:   'linear-gradient(150deg, #060f1e 0%, #091525 60%, rgba(0,212,255,0.05) 100%)',
            artEmojis:    ['🪙', '⚡', '💫', '🪙'],
            getHeroValue: (ev) => `×${ev.multiplier || 1.5}`,
            getShortDesc: () => 'Monedas multiplicadas en todos los juegos',
            icon:          'zap'
        },
        streak_boost: {
            color:        '#f59e0b',
            colorDim:     'rgba(245, 158, 11, 0.14)',
            colorBorder:  'rgba(245, 158, 11, 0.38)',
            colorGlow:    'rgba(245, 158, 11, 0.18)',
            gradientBg:   'linear-gradient(150deg, #150a00 0%, #1f1200 60%, rgba(245,158,11,0.05) 100%)',
            artEmojis:    ['🔥', '✨', '⭐', '🔥'],
            getHeroValue: () => '+2',
            getShortDesc: () => 'Racha diaria doble con cada reclamo',
            icon:          'flame'
        },
        default: {
            color:        'var(--accent, #9b59ff)',
            colorDim:     'var(--accent-soft)',
            colorBorder:  'var(--accent-border)',
            colorGlow:    'var(--accent-glow)',
            gradientBg:   'var(--solid-surface-float, #141620)',
            artEmojis:    ['✨', '🌟', '💥', '✨'],
            getHeroValue: (ev) => ev.subtitle || '!',
            getShortDesc: (ev) => ev.description || ev.subtitle || '',
            icon:          'sparkles'
        }
    };

    function _getMeta(type) {
        return EVENT_META[type] || EVENT_META.default;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // RENDERING — TARJETA DE EVENTO
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Renderiza una tarjeta de evento con diseño de banner visual de alta
     * intensidad: fondo degradado, arte decorativo, valor del efecto en
     * tipografía gigante, badge EN VIVO animado, nombre y descripción.
     *
     * [v10.3] El timer pill ahora muestra horas + minutos (p.ej. "5 h 42 min")
     * gracias al nuevo _formatTimeLeft().
     *
     * @param {object} event  Definición del evento desde events.json.
     * @returns {string}      HTML de la tarjeta.
     */
    function _renderEventCard(event) {
        const meta      = _getMeta(event.type);
        const isExpired = Date.now() >= new Date(event.endDate).getTime();
        const timeLeft  = _formatTimeLeft(event.endDate);
        const heroValue = meta.getHeroValue(event);
        const shortDesc = meta.getShortDesc(event);

        // Arte decorativo: cuatro emoji grandes posicionados en el fondo
        const artHTML = meta.artEmojis.map((emoji, i) =>
            `<span class="lte-art__deco lte-art__deco--${i + 1}" aria-hidden="true">${emoji}</span>`
        ).join('');

        const statusBadge = isExpired
            ? `<span class="lte-status-badge lte-status-badge--expired">EXPIRADO</span>`
            : `<span class="lte-status-badge lte-status-badge--live">
                   <span class="lte-live-dot" style="--dot-color:${meta.color};" aria-hidden="true"></span>
                   EN VIVO
               </span>`;

        const timerBadge = isExpired ? '' : `
            <span class="lte-timer-pill"
                  style="color:${meta.color}; border-color:${meta.colorBorder}; background:${meta.colorDim};">
                ${_icon('clock', 11)}&thinsp;${timeLeft}
            </span>`;

        return `
        <article class="lte-card${isExpired ? ' lte-card--expired' : ''}"
                 data-event-id="${event.id}"
                 data-event-type="${event.type}"
                 style="background:${meta.gradientBg}; --ev-color:${meta.color}; --ev-glow:${meta.colorGlow}; --ev-border:${meta.colorBorder};"
                 ${isExpired ? 'aria-disabled="true"' : ''}>

            <div class="lte-art" aria-hidden="true">${artHTML}</div>
            <div class="lte-card__accent-bar" style="background:linear-gradient(90deg,${meta.color} 0%,transparent 100%);"></div>

            <div class="lte-card__head">
                ${statusBadge}
                ${timerBadge}
            </div>

            <div class="lte-card__hero-wrap" aria-label="Efecto del evento: ${heroValue}">
                <span class="lte-hero-value" style="color:${meta.color};">${heroValue}</span>
            </div>

            <div class="lte-card__info">
                <h3 class="lte-card__name">${event.title}</h3>
                <p class="lte-card__desc">${shortDesc}</p>
            </div>

        </article>`;
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
                    ? 'Bonificaciones activas ahora mismo — se aplican de forma automática'
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
        const lteEvents   = allEvents.filter(e => e.type !== 'gacha');
        const activeCount = lteEvents.filter(e => Date.now() < new Date(e.endDate).getTime()).length;

        let html = `<div class="events-view-inner">`;
        html += _renderHero(activeCount);

        if (lteEvents.length > 0) {
            html += `<div class="lte-cards-list">`;
            html += lteEvents.map(_renderEventCard).join('');
            html += `</div>`;
            html += `
            <p class="lte-legend">
                ${_icon('info', 12)}
                <span>Los eventos se aplican automáticamente. No requieren activación manual.</span>
            </p>`;
        } else {
            html += `
            <div class="lte-empty">
                ${_icon('calendar', 42)}
                <p>No hay eventos activos en este momento.</p>
                <span>¡Vuelve pronto para ver nuevas bonificaciones!</span>
            </div>`;
        }

        html += `</div>`;
        container.innerHTML = html;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // CICLO DE VIDA SPA
    // ════════════════════════════════════════════════════════════════════════════

    let _rendered = false;

    /**
     * Llamado por spa-router.js al navegar a #view-events.
     *
     * [v10.3] Inicia un setInterval de 60 s que re-renderiza la vista para
     * mantener el countdown exacto sin necesidad de recargar la página.
     * El intervalo se limpia en onLeave() para evitar acumulación de timers.
     */
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

        // [v10.3] Countdown en vivo — cancelar cualquier intervalo previo antes
        // de crear uno nuevo (protección ante navegación rápida).
        _clearCountdown();
        _countdownInterval = setInterval(() => {
            if (_eventsCache) _renderEventsView(_eventsCache);
        }, COUNTDOWN_INTERVAL_MS);
    }

    /**
     * Llamado por spa-router.js al salir de la vista de eventos.
     *
     * [v10.3] Cancela el setInterval del countdown para no acumular timers
     * activos mientras la vista no es visible.
     */
    function onLeave() {
        _clearCountdown();
    }

    /** Cancela el intervalo de countdown si está activo. */
    function _clearCountdown() {
        if (_countdownInterval !== null) {
            clearInterval(_countdownInterval);
            _countdownInterval = null;
        }
    }

    window.EventView     = { onEnter, onLeave };
    window.isEventActive = isEventActive;

})();