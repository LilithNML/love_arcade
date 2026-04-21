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
