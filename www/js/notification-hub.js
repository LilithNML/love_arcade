(function () {
    'use strict';

    const MANAGED_IDS = [9101, 9102, 9103, 9104, 9105, 9106, 9107, 9108, 9109, 9110, 9111, 9112];
    const CHANNELS = {
        retention: 'retention-reminders',
        events: 'live-events',
        economy: 'economy-alerts'
    };

    const RANDOM_MESSAGES = [
        { title: '💖 Love Arcade te extraña', body: 'Vuelve por una partida rápida y suma monedas hoy.' },
        { title: '🎯 Reto aleatorio desbloqueado', body: 'Entra ahora y prueba suerte en tus minijuegos favoritos.' },
        { title: '🛍️ Date una vuelta por la tienda', body: 'Quizá hay un wallpaper perfecto para canjear hoy.' },
        { title: '⚡ Mini sesión, gran progreso', body: 'Solo 5 minutos pueden mantener tu progreso encendido.' },
        { title: '🔥 Mantén la racha viva', body: 'No dejes que tu streak se enfríe. Regresa y reclama.' }
    ];

    const LOCAL_NOTIF = () => window.Capacitor?.Plugins?.LocalNotifications || null;
    const PUSH_NOTIF = () => window.Capacitor?.Plugins?.PushNotifications || null;

    function isNative() {
        try {
            return Boolean(window.Capacitor?.isNativePlatform?.());
        } catch (_) {
            return false;
        }
    }
    function pickRandomHour(minHour, maxHour) {
        const min = Math.max(0, minHour | 0);
        const max = Math.min(23, maxHour | 0);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function buildDateAt(hour, minute, offsetDays) {
        const d = new Date();
        d.setDate(d.getDate() + (offsetDays || 0));
        d.setHours(hour, minute || 0, 0, 0);
        return d;
    }

    function getNextDailyReadyTime() {
        const lastClaim = Number(window.GameCenter?.getStateSnapshot?.().daily?.lastClaim || 0);
        if (!lastClaim) {
            return new Date(Date.now() + 60 * 60 * 1000);
        }
        const last = new Date(lastClaim);
        const next = new Date(last.getTime());
        next.setDate(next.getDate() + 1);
        next.setHours(10, 0, 0, 0);
        return next;
    }

    function getActiveEventInfo() {
        try {
            const raw = localStorage.getItem('love_arcade_events_v1');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const events = parsed?.data?.events;
            if (!Array.isArray(events)) return null;

            const now = Date.now();
            const current = events.find(ev => {
                const start = ev?.startDate ? new Date(ev.startDate).getTime() : NaN;
                const end = ev?.endDate ? new Date(ev.endDate).getTime() : NaN;
                if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
                return now >= start && now <= end;
            });
            if (!current) return null;
            return {
                title: current.ui?.title || current.id || 'Evento especial',
                endDate: current.endDate ? new Date(current.endDate) : null,
            };
        } catch (_) {
            return null;
        }
    }

    async function ensureChannels(localNotifications) {
        try {
            await localNotifications.createChannel({
                id: CHANNELS.retention,
                name: 'Recordatorios de regreso',
                description: 'Mensajes aleatorios para retención y reenganche.',
                importance: 3,
                visibility: 1
            });
            await localNotifications.createChannel({
                id: CHANNELS.events,
                name: 'Eventos limitados',
                description: 'Avisos de eventos con tiempo limitado y novedades.',
                importance: 4,
                visibility: 1
            });
            await localNotifications.createChannel({
                id: CHANNELS.economy,
                name: 'Economía y recompensas',
                description: 'Avisos de bono diario, racha y recompensas.',
                importance: 4,
                visibility: 1
            });
        } catch (_) {
            // Algunos dispositivos no soportan canales custom o ya existen.
        }
    }

    async function buildLocalSchedule() {
        const canClaimNow = Boolean(window.GameCenter?.canClaimDaily?.());
        const activeEvent = getActiveEventInfo();
        const now = Date.now();

        const notifications = [];

        if (canClaimNow) {
            const reminderAt = new Date(now + 90 * 60 * 1000);
            notifications.push({
                id: 9101,
                title: '🌟 Tu bono diario está listo',
                body: 'Reclámalo ahora para no perder tu racha.',
                schedule: { at: reminderAt, allowWhileIdle: true },
                channelId: CHANNELS.economy
            });
        } else {
            notifications.push({
                id: 9101,
                title: '⏰ Recompensa diaria disponible',
                body: 'Ya puedes reclamar tu bono diario en Love Arcade.',
                schedule: { at: getNextDailyReadyTime(), allowWhileIdle: true },
                channelId: CHANNELS.economy
            });
        }

        for (let i = 0; i < 2; i += 1) {
            const msg = RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)];
            const at = buildDateAt(pickRandomHour(12, 21), i === 0 ? 10 : 40, i === 0 ? 0 : 1);
            notifications.push({
                id: 9102 + i,
                title: msg.title,
                body: msg.body,
                schedule: { at, allowWhileIdle: true },
                channelId: CHANNELS.retention
            });
        }

        notifications.push({
            id: 9104,
            title: '🛒 Novedades en la tienda',
            body: 'Revisa los ítems disponibles y aprovecha tus monedas.',
            schedule: { at: buildDateAt(18, 30, 0), allowWhileIdle: true },
            channelId: CHANNELS.retention
        });

        if (activeEvent && activeEvent.endDate) {
            const warnAt = new Date(activeEvent.endDate.getTime() - 6 * 60 * 60 * 1000);
            if (warnAt.getTime() > now) {
                notifications.push({
                    id: 9105,
                    title: '⌛ Evento por terminar',
                    body: `${activeEvent.title} termina pronto. ¡No te lo pierdas!`,
                    schedule: { at: warnAt, allowWhileIdle: true },
                    channelId: CHANNELS.events
                });
            }
        }

        notifications.push({
            id: 9106,
            title: '🎁 Consejo de retención',
            body: 'Completa una misión hoy para aumentar tu progreso semanal.',
            schedule: { at: buildDateAt(20, 15, 1), allowWhileIdle: true },
            channelId: CHANNELS.economy
        });

        return notifications.filter(item => item.schedule?.at instanceof Date && item.schedule.at.getTime() > now + 45_000);
    }

    async function setupLocalNotifications() {
        if (!isNative()) return;
        const localNotifications = LOCAL_NOTIF();
        if (!localNotifications) return;

        try {
            const perm = await localNotifications.checkPermissions();
            if (perm.display !== 'granted') {
                const req = await localNotifications.requestPermissions();
                if (req.display !== 'granted') {
                    console.warn('[Notifications] Permiso local denegado por usuario.');
                    return;
                }
            }

            await ensureChannels(localNotifications);
            await localNotifications.cancel({ notifications: MANAGED_IDS.map(id => ({ id })) });
            const scheduled = await buildLocalSchedule();
            if (scheduled.length) {
                await localNotifications.schedule({ notifications: scheduled });
            }
            localStorage.setItem('love_arcade_local_notif_last_sync', new Date().toISOString());
        } catch (err) {
            console.warn('[Notifications] Error al configurar notificaciones locales:', err);
        }
    }

    async function setupPushNotifications() {
        if (!isNative()) return;
        const push = PUSH_NOTIF();
        if (!push) {
            console.info('[Push] Plugin no disponible. Ejecuta: npm i @capacitor/push-notifications y npx cap sync');
            return;
        }

        try {
            const perm = await push.checkPermissions();
            if (perm.receive !== 'granted') {
                const req = await push.requestPermissions();
                if (req.receive !== 'granted') {
                    console.warn('[Push] Permiso de push no otorgado.');
                    return;
                }
            }

            push.addListener('registration', token => {
                localStorage.setItem('love_arcade_push_token', token?.value || '');
                console.info('[Push] Token FCM listo:', token?.value ? 'OK' : 'vacío');
            });

            push.addListener('registrationError', error => {
                console.warn('[Push] Error de registro:', error);
            });

            push.addListener('pushNotificationReceived', notification => {
                console.info('[Push] Mensaje recibido en foreground:', notification?.title || 'sin título');
            });

            push.addListener('pushNotificationActionPerformed', action => {
                console.info('[Push] Acción de usuario:', action?.actionId || 'tap');
            });

            await push.register();
        } catch (err) {
            console.warn('[Push] No se pudo inicializar FCM. Revisa google-services.json y Firebase:', err);
        }
    }

    async function bootstrapNotifications() {
        if (!isNative()) return;

        const today = new Date().toISOString().slice(0, 10);
        const lastSyncDay = localStorage.getItem('love_arcade_notif_schedule_day') || '';
        if (lastSyncDay !== today) {
            await setupLocalNotifications();
            localStorage.setItem('love_arcade_notif_schedule_day', today);
        }

        await setupPushNotifications();
    }

    function patchDailyClaimRefresh() {
        const gameCenter = window.GameCenter;
        if (!gameCenter || typeof gameCenter.claimDaily !== 'function') return;
        if (gameCenter.__notifPatched) return;

        const original = gameCenter.claimDaily;
        gameCenter.claimDaily = function patchedClaimDaily() {
            const result = original.apply(gameCenter, arguments);
            Promise.resolve().then(() => setupLocalNotifications());
            return result;
        };
        gameCenter.__notifPatched = true;
    }

    window.LoveArcadeNotifications = {
        refreshLocalSchedule: setupLocalNotifications,
        refreshPushRegistration: setupPushNotifications,
        bootstrap: bootstrapNotifications
    };

    document.addEventListener('DOMContentLoaded', async () => {
        patchDailyClaimRefresh();
        await bootstrapNotifications();

        const appPlugin = window.Capacitor?.Plugins?.App;
        if (appPlugin?.addListener) {
            appPlugin.addListener('appStateChange', state => {
                if (state?.isActive) {
                    patchDailyClaimRefresh();
                    setupLocalNotifications().catch(() => {});
                }
            });
        }
    });
})();
