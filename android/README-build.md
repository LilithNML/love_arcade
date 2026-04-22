# Android build environment

Este proyecto **no** fija la JDK con rutas absolutas en `android/gradle.properties`.

## Política

- La JDK debe inyectarse mediante la variable de entorno `JAVA_HOME` (por ejemplo en IDX o CI).
- No se debe usar `org.gradle.java.home=/ruta/absoluta/...` porque rompe portabilidad entre máquinas.

## Ejemplos

### Linux/macOS

```bash
export JAVA_HOME="/path/to/jdk-17"
cd android
./gradlew assembleDebug
```

### Windows (PowerShell)

```powershell
$env:JAVA_HOME = "C:\\path\\to\\jdk-17"
cd android
.\\gradlew.bat assembleDebug
```

## Verificación rápida

Antes de sincronizar o hacer commit, comprobar que la propiedad no reapareció:

```bash
rg -n "org\\.gradle\\.java\\.home" android/gradle.properties
```

Si el comando no devuelve resultados, está correcto.

## Build Android en un solo paso (release firmado)

Desde la raíz del repo:

```bash
npm run build:apk:release
```

Este flujo:

1. Usa `www/` tal como está (sin bundle/transpile adicional).
2. Ejecuta `npx cap sync android`.
3. Genera `assembleRelease` con Gradle.

### Configuración de firma release

Debes definir la firma en **uno** de estos formatos:

- `android/keystore.properties` (recomendado en local, no se versiona).
- Variables de entorno (recomendado en CI).

Plantilla disponible: `android/keystore.properties.example`.

Variables soportadas:

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
