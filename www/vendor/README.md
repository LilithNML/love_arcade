# Vendor local (obligatorio para build offline/APK)

Estos assets deben existir localmente para evitar dependencia de CDNs en runtime.

## Archivos requeridos

- `supabase.umd.js` → `@supabase/supabase-js@2` (UMD dist)
- `confetti.browser.min.js` → `canvas-confetti@1.9.2`

## The Image Laboratory

Dentro de `www/the-image-laboratory/vendor/`:

- `jszip.min.js` → `jszip@3.10.1`
- `cropper.min.js` y `cropper.min.css` → `cropperjs@1.6.1`
- `lucide.min.js` → `lucide@0.383.0` (UMD)
- `fonts/space-grotesk-v20-latin-400.woff2`
- `fonts/jetbrains-mono-v23-latin-400.woff2`

## Nota de fallback

Si falta un archivo:

- Love Arcade desactiva únicamente la feature afectada (ej. confetti o Sentinel cloud).
- The Image Laboratory desactiva recorte (`Cropper`) o ZIP (`JSZip`) y mantiene el resto funcional.

