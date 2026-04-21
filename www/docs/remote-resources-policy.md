# Política de recursos remotos (runtime)

## Objetivo

Evitar dependencia de CDNs en ejecución y limitar conexiones remotas a endpoints de negocio.

## Permitidos

- `res.cloudinary.com` (assets de wallpapers/covers)
- `timeapi.io` y `api.timeapi.io` (validación horaria anti-trampa)
- `*.supabase.co` (auth/sync cuando Sentinel está activo)
- `api.telegram.org` (si se usa el pipeline de reportes en `www/api/report.js`)

## Prohibidos (nuevos CDNs en runtime)

- `cdn.jsdelivr.net`
- `unpkg.com`
- `cdnjs.cloudflare.com`
- `fonts.googleapis.com`
- `fonts.gstatic.com`

## Implementación

- Script de política: `www/js/remote-resource-policy.js`
- Bloquea inyección dinámica de `<script src="...">` y `<link rel="stylesheet" href="...">`
  cuando el host esté en la lista de CDNs bloqueados o fuera de permitidos.
- Marca nodos bloqueados con `data-disabled-by-policy="true"` y registra warning en consola.

## Regla de mantenimiento

1. No agregar nuevos `<script>` o `<link>` remotos en `index.html` ni en módulos.
2. Toda dependencia de frontend debe vivir en `www/vendor/` (o subcarpetas vendor de cada módulo).
3. Cualquier excepción remota debe documentarse aquí antes de merge.

## Caché offline global de Cloudinary (APK/WebView)

Se añadió un Service Worker (`www/cloudinary-cache-sw.js`) para todos los assets de `res.cloudinary.com`.

### Estrategia deduplicada

- **Primera vez:** descarga y guarda en Cache Storage (`love-arcade-cloudinary-assets-v1`).
- **Siguientes veces:** responde desde caché local inmediatamente (offline-first).
- **Revalidación en segundo plano:** usa `If-None-Match` (ETag) y `If-Modified-Since` (Last-Modified).
  - Si el servidor responde **304 Not Modified**, se conserva el archivo local (sin re-descargar bytes).
  - Si responde **200 OK**, actualiza la caché con la nueva versión.

### Cobertura

El inicializador `www/js/cloudinary-cache.js` registra el SW y hace *warmup* de URLs Cloudinary detectadas en:

1. `data/shop.json` (catálogo completo).
2. Estilos inline en `index.html` (covers de juegos).

Con esto, el requisito de "si ya existe no descargar otra vez" queda cubierto con validación HTTP estándar.
