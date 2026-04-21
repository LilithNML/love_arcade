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

