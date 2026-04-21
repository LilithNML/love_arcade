/*
 * haptics.js — capa unificada de feedback táctil para Love Arcade.
 *
 * Prioridad:
 *  1) @capacitor/haptics vía plugin global (nativo)
 *  2) navigator.vibrate (web fallback)
 */
(function initLoveArcadeHaptics(global) {
    'use strict';

    function getCapacitor() {
        return global.Capacitor || null;
    }

    function isNative() {
        const cap = getCapacitor();
        try {
            return Boolean(cap?.isNativePlatform?.());
        } catch (_) {
            return false;
        }
    }

    function getHapticsPlugin() {
        const cap = getCapacitor();
        return cap?.Plugins?.Haptics || global.Haptics || null;
    }

    function vibrateFallback(pattern) {
        try {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                navigator.vibrate(pattern);
            }
        } catch (_) {
            // no-op
        }
    }

    async function selection() {
        const haptics = getHapticsPlugin();
        if (isNative() && haptics?.selectionChanged) {
            try {
                await haptics.selectionChanged();
                return;
            } catch (_) {}
        }
        vibrateFallback(10);
    }

    async function impact(style, fallbackPattern) {
        const haptics = getHapticsPlugin();
        if (isNative() && haptics?.impact) {
            try {
                const styles = haptics.ImpactStyle || { LIGHT: 'LIGHT', MEDIUM: 'MEDIUM', HEAVY: 'HEAVY' };
                const resolvedStyle = styles[style] || style;
                await haptics.impact({ style: resolvedStyle });
                return;
            } catch (_) {}
        }
        vibrateFallback(fallbackPattern);
    }

    async function notification(type, fallbackPattern) {
        const haptics = getHapticsPlugin();
        if (isNative() && haptics?.notification) {
            try {
                const types = haptics.NotificationType || {
                    SUCCESS: 'SUCCESS',
                    WARNING: 'WARNING',
                    ERROR: 'ERROR'
                };
                const resolvedType = types[type] || type;
                await haptics.notification({ type: resolvedType });
                return;
            } catch (_) {}
        }
        vibrateFallback(fallbackPattern);
    }

    global.LoveArcadeHaptics = {
        isNative,
        selection: () => selection(),
        impactLight: () => impact('LIGHT', 14),
        impactMedium: () => impact('MEDIUM', [20, 16, 20]),
        impactHeavy: () => impact('HEAVY', [30, 20, 35]),
        notifySuccess: () => notification('SUCCESS', [24, 18, 24]),
        notifyWarning: () => notification('WARNING', [16, 14, 16]),
        notifyError: () => notification('ERROR', [28, 20, 28, 20, 30]),
        custom: (pattern) => vibrateFallback(pattern)
    };
})(window);
