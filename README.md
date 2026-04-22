# Love Arcade · Flujo único para IDX (Android)

Este repositorio usa Capacitor para empaquetar la app web en Android.

## Requisitos mínimos

- Node.js y npm
- JDK (recomendado 17)
- Android SDK (con `platform-tools` y build tools instaladas)

> Puedes validar el entorno con `npm run doctor`.

## Flujo estándar (sin comandos ad-hoc)

1. **Instalar dependencias**

   ```bash
   npm install
   ```

2. **Sincronizar proyecto Capacitor Android**

   ```bash
   npm run sync:android
   ```

3. **Generar APK debug**

   ```bash
   npm run build:apk:debug
   ```

## Scripts disponibles

- `npm run sync:android` → ejecuta `npx cap sync android`
- `npm run build:apk:debug` → ejecuta `cd android && ./gradlew assembleDebug`
- `npm run doctor` → ejecuta `npx cap doctor`

## Configuración backend para Android (obligatoria)

La app Android utiliza rutas relativas `/api/*` para:

- `GET /api/client-config` (credenciales públicas de Supabase)
- `POST /api/telemetry` y `POST /api/report` (proxy Telegram/Ghost Analytics)

En entorno nativo, estas rutas deben resolverse contra un dominio real.
Por defecto, el frontend bootstrapea:

- `window.__LOVE_ARCADE_API_BASE_URL__` desde `localStorage['love_arcade_api_base_url']`
- fallback: `https://love-arcade.vercel.app`

Si necesitas otro backend, define la base URL antes de publicar el APK:

```js
localStorage.setItem('love_arcade_api_base_url', 'https://TU-DOMINIO');
```

Además, en tu deployment backend deben existir estas variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
