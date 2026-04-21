# The Image Laboratory — Guía Técnica v2

## Bugs corregidos en v2

### Bug crítico: Crop Modal vacío (sin imagen visible)

**Causa raíz (múltiple):**

1. **`overflow: hidden` en `.crop-wrap`** — Cropper.js crea elementos con `position: absolute` que sobresalen del contenedor. El `overflow: hidden` los cortaba, haciendo la zona de recorte invisible.

2. **`height: 100%` sin altura de referencia** — `.crop-wrap` tenía `height: 100%` pero ninguno de sus ancestros tenía una altura fija. En flexbox sin `height` explícito en el ancestro, `height: 100%` puede resolver a `0px`. Cropper.js inicializaba con un contenedor de 0 altura.

3. **`opacity: 0` en CSS + carrera de eventos** — El selector `.crop-wrap img { opacity: 0 }` hacía invisible la imagen desde CSS. El JS intentaba revertirlo en `onload`, pero si la imagen era de Object URL que el navegador tenía en caché temporal, `onload` podía disparar ANTES de que el handler fuera asignado.

4. **Modal visible ANTES de que la imagen cargue** — Si el modal se muestra con el contenedor visible pero sin imagen real, Cropper.js calcula `containerWidth: 0, containerHeight: 0` y no renderiza nada.

**Solución implementada:**
```
1. Mostrar modal con clase CSS (transición, no display:none)
2. Mostrar spinner de carga
3. Asignar img.onload = () => { initCropper() } ANTES de asignar img.src
4. En onload: ocultar spinner, mostrar imagen, inicializar Cropper
   (En este momento el modal ES visible, tiene altura real, y la imagen tiene dimensiones conocidas)
5. .crop-stage: flex container con min-height:0, sin overflow:hidden
6. Cropper se inicializa sobre un contenedor con dimensiones reales → funciona correctamente
```

---

## Arquitectura

```
the-image-laboratory/
├── index.html                    # Entrada única, estructura HTML fija
├── css/main.css                  # Design tokens + todos los componentes
└── js/
    ├── app.js                    # Router, CropModal, Toast, Progress, Worker factory
    ├── utils/
    │   ├── naming.js             # normalizeName, generateHash8, shuffledRange, formatBytes
    │   ├── queue.js              # ProcessingQueue (concurrencia máx. 3)
    │   └── zip-builder.js        # ZipBuilder (wrapper JSZip)
    ├── workers/
    │   └── image-worker.js       # OffscreenCanvas, CROP_RESIZE | COMPRESS | RESIZE_ONLY
    └── modules/
        ├── store-manager.js      # Módulo I
        ├── puzzle-creator.js     # Módulo II
        ├── smart-compressor.js   # Módulo III
        └── filename-extractor.js # Módulo IV
```

## Flujo del Web Worker

```
Módulo                              Worker
  │                                   │
  ├─ file.arrayBuffer()               │
  ├─ slice(0) si se necesita copia    │
  ├─ postMessage({type, id, data},    │
  │    [arrayBuffer]) ──────────────► │
  │                                   ├─ createImageBitmap(blob)
  │                                   ├─ OffscreenCanvas.drawImage()
  │                                   ├─ canvas.convertToBlob({type:'image/webp', quality})
  │                                   ├─ bmp.close()  ← liberar BitMap
  │    ◄── postMessage({RESULT, blob}) ┤
  ├─ url = URL.createObjectURL(blob)  │
  ├─ ZIP.file(path, blob)             │
  └─ (al terminar todos) zip.download()
```

**Nota sobre transferencia:** El `arrayBuffer` se transfiere (no copia) al Worker. Después de la transferencia, el buffer original tiene `byteLength === 0`. Si se necesita el mismo buffer para dos operaciones (Puzzle Creator: asset + thumb), se hace `buf1 = await file.arrayBuffer(); buf2 = buf1.slice(0)` para tener dos buffers independientes.

## Cómo agregar un módulo

**1. Crear** `js/modules/mi-modulo.js`:
```js
import { showToast, initIcons } from '../app.js';

export function mount(parentEl) {
  parentEl.innerHTML = `<div class="mod-enter">...</div>`;
  initIcons(parentEl);
  // Bind eventos...
}
```

**2. Registrar** en `app.js`:
```js
const MODULES = {
  ...
  'mi-modulo': () => import('./modules/mi-modulo.js'),
};
```

**3. Botón nav** en `index.html`:
```html
<button class="nav-btn" data-module="mi-modulo" role="tab">
  <i data-lucide="ICONO" class="nav-icon"></i>
  <span class="nav-label"><span class="nav-num">V</span> Mi Módulo</span>
  <span class="nav-sub">Descripción</span>
</button>
```

## Compatibilidad requerida

| Feature           | Chrome | Firefox | Safari | Edge |
|-------------------|--------|---------|--------|------|
| OffscreenCanvas   | 69+    | 105+    | 17+    | 79+  |
| createImageBitmap | 55+    | 42+     | 15+    | 79+  |
| Web Workers       | ✅     | ✅      | ✅     | ✅   |
| File API          | ✅     | ✅      | ✅     | ✅   |

## Gestión de memoria

- **Object URLs de preview:** `<img onload="URL.revokeObjectURL(this.src)">` — se revoca tras cargar
- **Object URL del crop modal:** se revoca al cerrar el modal (con delay de 300ms para la animación CSS)
- **ArrayBuffer en worker:** se transfiere (sin copia) usando el tercer argumento de `postMessage`
- **ImageBitmap:** se cierra con `bmp.close()` después de dibujar en el canvas
- **Cola de 3 concurrentes:** máximo 3 imágenes en memoria de procesamiento simultáneamente
