# Wallpapers nativos (Android)

## Objetivo
Implementar doble almacenamiento:

1. **Cache privada** para wallpapers no comprados (invisible para usuario).
2. **Exportación pública automática** para wallpapers comprados (visible en galería).

## Flujo implementado

- La tienda (`shop-logic.js`) llama `NativeWallpaperStorage.preCacheUnowned()` al cargar el catálogo.
- Esa función invoca el plugin nativo `WallpaperStorage.cacheWallpaperPrivate(...)`.
- El plugin guarda bytes en `context.getCacheDir()/wallpapers/private_cache`.
- Al comprar un wallpaper, `initiatePurchase()` llama `NativeWallpaperStorage.savePurchasedToGallery(...)`.
- El plugin nativo escribe en `MediaStore.Images` bajo `Pictures/Love Arcade`.

## Notas de compilación

No requiere paquetes npm adicionales porque el plugin es local (Java) y usa APIs Android estándar.

Pasos recomendados para generar APK después del cambio:

1. `npm install`
2. `npx cap sync android`
3. Abrir Android Studio en `/workspace/love_arcade/android`
4. Build APK/AAB desde Android Studio.

## Permisos

- API 29+ (Android 10+): usa `MediaStore`, sin permiso de escritura legado.
- API <= 28: se declara `WRITE_EXTERNAL_STORAGE` con `maxSdkVersion="28"` para compatibilidad.
