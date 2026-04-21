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
