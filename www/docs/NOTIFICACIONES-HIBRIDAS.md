# Notificaciones híbridas (Local + Push FCM)

## Qué quedó implementado

- **Notificaciones locales programadas** para retención, bono diario, tienda y aviso de evento por terminar.
- **Registro de push remoto (FCM)** usando `@capacitor/push-notifications` cuando el plugin está disponible.
- **Degradación segura**: si no existe `google-services.json` o no está instalado el plugin push, la app sigue funcionando con notificaciones locales.

## Archivos clave

- `www/js/notification-hub.js` — motor completo de notificaciones.
- `android/app/src/main/AndroidManifest.xml` — permisos Android (`POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`).
- `package.json` — dependencias de Capacitor para local/push notifications.
- `www/index.html` — carga del script `notification-hub.js`.

## Flujo local (sin backend)

1. Al iniciar la app en nativo, solicita permiso de notificaciones.
2. Crea canales Android:
   - `retention-reminders`
   - `live-events`
   - `economy-alerts`
3. Reprograma agenda diaria local:
   - Bono diario listo / por reclamar.
   - 2 mensajes aleatorios de reenganche.
   - Recordatorio de tienda.
   - Aviso de evento limitado por terminar (si hay evento activo en caché).
4. Si el usuario reclama el bono diario, se refresca la agenda para evitar mensajes desactualizados.

## Flujo push (FCM)

1. Solicita permisos push.
2. Registra el dispositivo en FCM.
3. Guarda token en `localStorage` (`love_arcade_push_token`) para futura sincronización con backend.
4. Escucha eventos de recepción y acción de notificación.

> Nota: sin backend de envío, el token se registra pero no habrá campañas push remotas aún.

## Pasos obligatorios para compilar APK con push real

### 1) Instalar dependencias en la raíz del proyecto

```bash
cd /workspace/love_arcade
npm install
```

Si tu red corporativa bloquea paquetes, habilita acceso al registry npm y reintenta.

### 2) Sincronizar plugins con Android

```bash
npx cap sync android
```

Esto actualiza:
- `android/capacitor.settings.gradle`
- `android/app/capacitor.build.gradle`

### 3) Crear Firebase y descargar `google-services.json`

- Archivo requerido: `google-services.json`
- Ruta exacta: `android/app/google-services.json`

Sin este archivo, **push remoto FCM no funcionará** (local notifications sí).

### 4) Verificar en Android 13+

- El usuario debe aceptar permiso `POST_NOTIFICATIONS`.
- Probar con app cerrada para validar entrega de notificaciones locales.

## Ideas de notificaciones extra para retención

- Recordatorio “misión diaria incompleta” al final de la tarde.
- “Últimas horas” para boosts activos (ej. Bendición Lunar cerca de expirar).
- “Meta semanal cerca” (si jugó X días de 7).
- Mensaje de regreso tras 48h/72h de inactividad con CTA corto.
- Segmentación por perfil: jugador casual (1 push/día) vs. frecuente (event-driven).

## Recomendación operativa

Primero lanzar en producción **local notifications + agenda inteligente** (ya funcional), y luego habilitar campañas push FCM cuando el backend de envíos esté listo.
