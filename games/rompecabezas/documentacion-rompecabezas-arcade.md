# Documentación Técnica — Rompecabezas Arcade

**Proyecto:** Rompecabezas Arcade (Neural Puzzle)
**Plataforma:** Love Arcade
**Versión del motor:** `PuzzleEngine v17.0` · `main.js v8.0` · `UIController v6.0` · `LevelManager v4.0` · `Storage v3.0`
**Última revisión:** Marzo 2026

---

## Índice

1. [Visión General](#1-visión-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Arquitectura y Flujo de la Aplicación](#3-arquitectura-y-flujo-de-la-aplicación)
4. [Sistema de Diseño Visual](#4-sistema-de-diseño-visual)
   - 4.1 [Paleta de Colores — Flat 2.0](#41-paleta-de-colores--flat-20)
   - 4.2 [Tipografía](#42-tipografía)
   - 4.3 [Componentes y Botones](#43-componentes-y-botones)
   - 4.4 [Iconografía y Animaciones](#44-iconografía-y-animaciones)
   - 4.5 [Micro-interacciones del Motor de Piezas](#45-micro-interacciones-del-motor-de-piezas)
5. [Módulos del Sistema](#5-módulos-del-sistema)
   - 5.1 [main.js — Orquestador](#51-mainjs--orquestador)
   - 5.2 [PuzzleEngine.js — Motor de Juego](#52-puzzleenginejs--motor-de-juego)
   - 5.3 [LevelManager.js — Gestor de Niveles](#53-levelmanagerjs--gestor-de-niveles)
   - 5.4 [UIController.js — Controlador de Interfaz](#54-uicontrollerjs--controlador-de-interfaz)
   - 5.5 [Storage.js — Almacenamiento](#55-storagejs--almacenamiento)
   - 5.6 [Economy.js — Sistema de Economía](#56-economyjs--sistema-de-economía)
   - 5.7 [AudioSynth.js — Síntesis de Audio](#57-audiosynthjs--síntesis-de-audio)
6. [Arquitectura de Activos — Cloudinary](#6-arquitectura-de-activos--cloudinary)
7. [Pantallas y Navegación](#7-pantallas-y-navegación)
8. [Sistema de Progresión del Jugador](#8-sistema-de-progresión-del-jugador)
9. [Motor Visual — PuzzleEngine en Detalle](#9-motor-visual--puzzleengine-en-detalle)
10. [Sistema Háptico](#10-sistema-háptico)
11. [Sistema de Audio Procedural](#11-sistema-de-audio-procedural)
12. [Características PWA](#12-características-pwa)
13. [Herramientas de Desarrollo (Dev Tools)](#13-herramientas-de-desarrollo-dev-tools)
14. [Accesibilidad (WCAG 2.2)](#14-accesibilidad-wcag-22)
15. [Guía de Mantenimiento y Expansión](#15-guía-de-mantenimiento-y-expansión)

---

## 1. Visión General

**Rompecabezas Arcade** es un juego de puzzles de arrastrar y soltar, construido con JavaScript vanilla y Canvas API, diseñado para correr como Progressive Web App (PWA) dentro del ecosistema **Love Arcade**. El jugador arrastra piezas de una imagen fragmentada hasta reconstruirla dentro de un tablero.

### Características principales

- **150 niveles** generados algorítmicamente desde una constante única (`TOTAL_LEVELS`). No se requiere editar JSON para agregar niveles.
- Activos visuales de **1600×1600 px** servidos desde **Cloudinary** con optimización automática de formato (WebP/AVIF) y resolución adaptada al dispositivo (700–1600px).
- Carga progresiva de thumbnails con **IntersectionObserver**: las miniaturas se descargan únicamente cuando están a punto de entrar al área visible de la pantalla, eliminando sobrecarga de red al navegar una lista de 150 niveles. El observer se desconecta y recrea en cada render para evitar callbacks huérfanos.
- Decodificación de imagen fuera del hilo principal con **`createImageBitmap`**: la textura 1600×1600 se transfiere al motor sin bloquear la UI. Liberación determinista con `ImageBitmap.close()` al destruir el motor.
- Gestión estricta de VRAM: en `destroy()` todos los buffers offscreen se invalidan con `width/height = 0`, liberando la memoria de GPU de forma síncrona antes de que actúe el GC.
- Calidad de imagen premium: `imageSmoothingQuality = 'high'` (interpolación bicúbica) en todos los contextos canvas, reaplicada tras cada cambio de dimensión.
- Diseño **Flat 2.0** de alta fidelidad: paleta de colores sólidos con contraste elevado, tipografía premium (Outfit + JetBrains Mono) y micro-interacciones táctiles satisfactorias.
- Motor de renderizado en canvas con soporte completo para mouse y pantalla táctil.
- Sistema de recompensas en monedas integrado con **Love Arcade** via `window.GameCenter`.
- Efectos visuales optimizados: pulsos radiales, destellos de encaje y partículas, usando exclusivamente `transform` y `opacity` para garantizar 60 fps en dispositivos de gama baja.
- Retroalimentación háptica por vibración (`navigator.vibrate`) para pickup, snap y victoria.
- Audio procedural sintetizado con la Web Audio API, sin archivos externos.
- Persistencia de progreso en `localStorage` con sistema de versionado de esquema.
- Accesibilidad WCAG 2.2: roles ARIA, navegación por teclado, áreas táctiles mínimas de 44×44px.
- Objeto global `window.dev` con utilidades de depuración accesibles desde la consola del navegador.

---

## 2. Estructura del Proyecto

```
/
├── index.html                  # Shell HTML — preconnect Cloudinary, ARIA completo,
│                               # modales personalizados (modal-alert, modal-confirm)
├── manifest.json               # Manifiesto PWA
├── service-worker.js           # Service Worker (modo purge activo)
└── src/
    ├── main.js                 # Punto de entrada y orquestador (v8.0)
    ├── style.css               # Estilos globales — Flat 2.0, variables CSS, .sr-only
    ├── core/
    │   ├── PuzzleEngine.js     # Motor de renderizado y lógica de piezas (v17.0)
    │   └── LevelManager.js     # Generación algorítmica de niveles (v4.0)
    ├── ui/
    │   └── UIController.js     # Gestión de pantallas y DOM (v6.0)
    └── systems/
        ├── Storage.js          # Persistencia en localStorage (v3.0)
        ├── Economy.js          # Integración con GameCenter (monedas)
        └── AudioSynth.js       # Síntesis de efectos de sonido
```

---

## 3. Arquitectura y Flujo de la Aplicación

```
main.js
 ├── LevelManager   → [genera en memoria] 150 objetos de nivel + URLs Cloudinary dinámicas
 ├── UI             → [manipula] DOM / pantallas / IntersectionObserver (lazy thumbnails)
 ├── Storage        → [lee/escribe] localStorage
 ├── PuzzleEngine   → [renderiza] <canvas>
 │     └── callbacks: onSound, onWin, onSnap, onStateChange
 ├── AudioSynth     → [genera] Web Audio API
 └── Economy        → [notifica] window.GameCenter
```

### Secuencia de arranque

```
DOMContentLoaded
  └─ init()
       ├─ await LevelManager.loadLevels()      // genera 150 niveles en memoria
       ├─ Storage.validateUnlockedLevels()     // repara desbloqueados huérfanos
       ├─ UI.initGlobalInteractions()          // botones: release bounce
       ├─ setupNavigation()                    // bind de todos los botones de nav
       ├─ setupSettings()                      // ajustes de sonido
       ├─ setupDevTools()                      // registra window.dev
       └─ UI.showScreen('menu')               // muestra pantalla inicial
```

### Flujo de carga de imagen (v8.0)

```
startGame(levelId)
  ├─ new Image() + img.decode()               // decodificación DOM (hilo principal)
  ├─ createImageBitmap(img)                   // transfiere textura al worker de GPU
  │   └─ fallback a HTMLImageElement si no disponible
  ├─ new PuzzleEngine(canvas, { image: imageBitmap })
  │   └─ resizeCanvas() → sourceCtx.drawImage(imageBitmap)  // escala al tablero
  └─ al destruir: imageBitmap.close()         // liberación determinista de VRAM
```

---

## 4. Sistema de Diseño Visual

El juego utiliza un sistema de diseño **Flat 2.0 / Minimalista Premium**, adoptado a partir de esta versión para reemplazar íntegramente el estilo anterior basado en glassmorphism (desenfoques y gradientes complejos). La motivación principal es rendimiento: los efectos `backdrop-filter` y `blur` tienen un costo de composición elevado en dispositivos móviles de gama baja; los colores sólidos planos no tienen ese costo y permiten mantener 60 fps constantes.

Todos los valores del diseño se definen como variables CSS en `src/style.css` para facilitar el mantenimiento y la coherencia entre componentes.

---

### 4.1 Paleta de Colores — Flat 2.0

#### Fondos

| Variable       | Valor     | Uso                                        |
|----------------|-----------|--------------------------------------------|
| `--bg-dark`    | `#0B0F19` | Fondo principal — azul pizarra muy oscuro  |
| `--bg-panel`   | `#151C2C` | Paneles y barras de navegación             |
| `--bg-card`    | `#1E293B` | Tarjetas de nivel y elementos elevados     |

#### Acentos y estados

| Variable        | Valor     | Uso                                        |
|-----------------|-----------|--------------------------------------------|
| `--primary`     | `#6366F1` | Índigo — acción principal                  |
| `--primary-dark`| `#4F46E5` | Sombra plana del botón primario            |
| `--accent`      | `#38BDF8` | Azul claro — detalles y bordes activos     |
| `--success`     | `#10B981` | Esmeralda — victoria y aciertos            |
| `--warning`     | `#F59E0B` | Ámbar — monedas                            |
| `--danger`      | `#F43F5E` | Rosa/Rojo — errores y acción de salir      |

#### Texto

| Variable       | Valor     | Uso                                        |
|----------------|-----------|--------------------------------------------|
| `--text-main`  | `#F8FAFC` | Blanco pizarra — alta legibilidad          |
| `--text-muted` | `#94A3B8` | Gris pizarra — información secundaria      |

---

### 4.2 Tipografía

| Rol                              | Fuente          | Pesos        | Justificación                                              |
|----------------------------------|-----------------|--------------|-------------------------------------------------------------|
| Títulos y UI general             | **Outfit**      | 400, 600, 800 | Geométrica moderna; transmite calidad "Premium Indie"      |
| Datos numéricos y HUD (monedas, stats) | **JetBrains Mono** | 500, 700 | Tabulación uniforme de dígitos; aspecto técnico/arcade |

---

### 4.3 Componentes y Botones

**Botones — Flat 2.0:**
Los botones usan una sombra sólida (`box-shadow: 0 4px 0 var(--color-dark)`) que simula profundidad sin el costo de renderizado de las sombras difuminadas (`blur`). Al presionarse, el botón se desplaza hacia abajo (`transform: translateY(4px)`) y la sombra desaparece, creando un efecto de presión físicamente satisfactorio.

**Áreas táctiles (hitboxes):**
Todos los botones, incluidos los iconos del HUD, garantizan un tamaño mínimo de **44×44px**, cumpliendo el estándar de accesibilidad móvil (WCAG 2.5.5 AAA).

---

### 4.4 Iconografía y Animaciones

**Iconografía:** Los iconos complejos anteriores han sido reemplazados por SVG minimalistas con trazos gruesos (`stroke-width: 2.5`), optimizados para legibilidad a pequeñas dimensiones.

**Animaciones:** Todas las transiciones de pantalla, aparición de modales y efectos de botón utilizan **exclusivamente** las propiedades `transform` y `opacity`. Estas propiedades son gestionadas por el compositor del navegador (GPU) sin requerir recálculo de layout ni repintado, lo que garantiza 60 fps incluso en dispositivos de gama baja.

---

### 4.5 Micro-interacciones del Motor de Piezas

Implementadas en `PuzzleEngine.js`. Reemplazan los efectos `glow` anteriores (costosos en GPU) por alternativas de bajo costo igualmente expresivas.

| Evento       | Efecto visual                                                                                     |
|--------------|---------------------------------------------------------------------------------------------------|
| **Selección**| La pieza escala a 1.05× y adquiere un borde sólido blanco de 3px (sin glow ni sombra difuminada). |
| **Encaje**   | Se dispara un pulso radial (`edgePulse`) que se expande desde la pieza hasta los bordes de la pantalla, más un destello perimetral sobre la pieza encajada. |

---

## 5. Módulos del Sistema

### 5.1 `main.js` — Orquestador

**Ruta:** `src/main.js` | **Versión:** v8.0

#### Variables de estado globales

| Variable         | Tipo           | Descripción                                                        |
|------------------|----------------|--------------------------------------------------------------------|
| `levelManager`   | `LevelManager` | Instancia global del gestor de niveles                             |
| `activeGame`     | `PuzzleEngine` | Instancia activa del motor (`null` si no hay partida en curso)     |
| `currentLevelId` | `string`       | ID del nivel en juego (ej: `"lvl_5"`)                             |
| `GameState`      | `object`       | Estado centralizado: `isPaused`, `isInGame`                        |

---

#### `startGame(levelId, loadSaved)` — Carga con ImageBitmap (v8.0)

La función sigue tres pasos para cargar la imagen de 1600×1600 sin bloquear la UI:

1. `img.decode()` — espera la decodificación en el hilo principal.
2. `createImageBitmap(img)` — transfiere la imagen a un `ImageBitmap`. Este proceso ocurre fuera del hilo principal en los navegadores modernos (Chrome 50+, Firefox 42+, Safari 15+), evitando que el parseado de la textura bloquee la interfaz al instanciar `PuzzleEngine`.
3. El `ImageBitmap` se pasa como `config.image`. `PuzzleEngine.destroy()` llama a `bitmap.close()` para liberación determinista.

**Fallback:** si `createImageBitmap` no está disponible, se usa el `HTMLImageElement` directamente con un `console.warn`. El juego continúa sin degradación funcional.

---

#### `handleVictory(levelConfig)`

Marca el nivel como completado (`Storage.markCompleted()`), desbloquea el siguiente nivel y llama a `Economy.payout()`.

---

#### Comportamiento del botón "Jugar" (v7.0+)

Al pulsar **Jugar** desde el menú principal, la lógica en `setupNavigation()` busca automáticamente el primer nivel desbloqueado que aún no ha sido completado y redirige al jugador directamente a ese nivel. Si existe una partida guardada para ese nivel, se muestra el modal de reanudación.

---

#### `setupSettings()`

Gestiona el ajuste de sonido. El botón "Resetear Progreso" ha sido **eliminado** de esta pantalla.

---

#### `togglePause()`

Al pausar durante una partida activa, se invoca `activeGame.cancelDrag()` antes de detener el motor. Esto garantiza que una pieza arrastrada en el momento de la pausa quede suelta correctamente.

---

### 5.2 `PuzzleEngine.js` — Motor de Juego

**Ruta:** `src/core/PuzzleEngine.js` | **Versión:** v17.0

Motor canvas con cuatro buffers de dibujo: `canvas` (principal), `staticCanvas` (tablero + piezas encajadas), `sourceCanvas` (imagen escalada), `gridCanvas` (rejilla offscreen).

El loop `requestAnimationFrame` se **detiene automáticamente** cuando no hay nada que animar (sin arrastre activo, sin partículas, sin efectos), reduciendo el consumo de batería en reposo.

#### API pública

| Método              | Descripción                                                                    |
|---------------------|--------------------------------------------------------------------------------|
| `exportState()`     | Serializa el estado actual del puzzle para persistencia en Storage             |
| `importState(state)`| Restaura un estado serializado previamente                                     |
| `togglePreview(bool)`| Activa/desactiva la vista previa semitransparente de la imagen completa       |
| `autoPlacePiece()`  | Coloca automáticamente la siguiente pieza suelta en su posición correcta (imán)|
| `handleResize()`    | Reposiciona las piezas proporcionalmente al nuevo tamaño del canvas            |
| `cancelDrag()`      | Cancela el arrastre activo y restaura la pieza a su posición original          |
| `destroy()`         | Detiene el loop, libera listeners, buffers GPU e ImageBitmap                   |

---

#### Calidad de imagen High DPI (v17.0)

**Problema:** Al escalar una imagen de 1600×1600 al tamaño del tablero (~300–700px según dispositivo), el navegador usa por defecto `imageSmoothingQuality = 'low'` (interpolación bilineal) tras cada reset de contexto. Esto produce un escalado visualmente degradado.

**Solución:** La función privada `_applySmoothing(ctx)` aplica `imageSmoothingEnabled = true` e `imageSmoothingQuality = 'high'` (interpolación bicúbica) a cada contexto 2D. Se llama:
- Al crear cada contexto (`constructor`).
- Tras cada cambio de dimensión (`resizeCanvas`, `buildGridCanvas`) porque `canvas.width = N` resetea el contexto completo a sus valores por defecto.

No se llama dentro del bucle de render (dentro de `save/restore`) porque el suavizado forma parte del stack del contexto y se preserva automáticamente.

---

#### Gestión de VRAM y memoria (v17.0)

**Problema:** Los cuatro buffers de canvas a DPR 2× para imágenes 1600×1600 representan hasta 50 MB de VRAM (4 buffers × 1600 × 1600 × 4 bytes × 4 DPR²). Sin liberación explícita, el GC de JavaScript puede tardar segundos en reclamar esa memoria, causando picos de uso y OOM en dispositivos con ≤2 GB de RAM al cambiar de nivel.

**Solución en `destroy()` (v17.0):**

```js
// Liberar VRAM de todos los buffers offscreen
this.sourceCanvas.width  = 0;
this.sourceCanvas.height = 0;
this.staticCanvas.width  = 0;
this.staticCanvas.height = 0;
this.gridCanvas.width    = 0;
this.gridCanvas.height   = 0;

// Liberar ImageBitmap de forma determinista
if (this.img && typeof this.img.close === 'function') {
    this.img.close();
}
```

Asignar `width = 0` / `height = 0` a un `HTMLCanvasElement` invalida su textura de GPU de forma **síncrona**, antes de que el GC actúe. `ImageBitmap.close()` libera la memoria del worker de decodificación inmediatamente.

---

#### DPR y resolución de canvas

El Device Pixel Ratio se limita a `Math.min(devicePixelRatio, 2)` para todos los buffers. La diferencia visual entre DPR 2× y 3× en un canvas de juego es imperceptible, pero el coste de VRAM escala al cuadrado: DPR 3× ocupa 2.25× más memoria que DPR 2×.

---

#### `handleResize()` — Comportamiento (v16.0+)

Calcula la relación de escala entre el tamaño anterior y el nuevo (`scaleX`, `scaleY`) y reposiciona cada pieza suelta de forma proporcional, manteniendo su ubicación relativa en el tablero sin redistribución aleatoria.

---

### 5.3 `LevelManager.js` — Gestor de Niveles

**Ruta:** `src/core/LevelManager.js` | **Versión:** v4.0

#### URLs dinámicas según capacidad del dispositivo (v4.0)

Con imágenes nativas de 1600×1600px, solicitar la resolución completa en dispositivos de gama baja satura la VRAM de los buffers de canvas. `LevelManager` calcula una sola vez al cargar el módulo (no por nivel) las dimensiones óptimas para el dispositivo actual.

**Para la imagen completa (`buildImageUrl`):**

| `_maxDim` (píxeles físicos)    | Ancho solicitado | Dispositivos representativos          |
|-------------------------------|-----------------|---------------------------------------|
| ≥ 2560                        | 1600px (nativo) | iPad Pro 12.9" Retina, Galaxy S23 Ultra |
| ≥ 1440                        | 1200px          | Pixel 7, iPhone 14 Pro (DPR 3×)      |
| ≥ 960                         | 900px           | iPhone SE 2×, Galaxy A52             |
| < 960                         | 700px           | Gama baja, DPR 1×, pantallas < 480px |

Cuando `_fullW === 1600` la transformación `w_` se omite para que Cloudinary sirva el asset original sin reescalado en servidor.

**Para thumbnails (`buildThumbnailUrl`):**

```
anchoCSSMinimo (100px) × min(DPR, 2) × 1.07 → redondeado al múltiplo de 80 más cercano
```

| DPR  | Raw   | Snapped | URL resultante |
|------|-------|---------|----------------|
| 1×   | 107px | 160px   | `w_160`        |
| 2×   | 214px | 240px   | `w_240`        |
| 3×   | 214px | 240px   | `w_240` (DPR cap en 2×) |

El redondeo a múltiplos de 80 maximiza los aciertos de caché en el CDN: dispositivos similares comparten la misma URL en lugar de generar variantes por cada DPR fractional.

#### Escalabilidad a 150 niveles

`TOTAL_LEVELS = 150`. La función `loadLevels()` genera los 150 objetos en memoria en O(n) sin I/O de red. Los assets se descargan sólo bajo demanda (thumbnails: IntersectionObserver; imagen completa: `startGame`). El tiempo de carga inicial es independiente del número de niveles.

#### Nomenclatura de `publicId`

`String(n).padStart(2, '0')` genera correctamente:
- `Nivel01`…`Nivel09` (n < 10)
- `Nivel10`…`Nivel99` (10 ≤ n < 100)
- `Nivel100`…`Nivel150` (n ≥ 100, `padStart(2,'0')` no añade cero)

---

### 5.4 `UIController.js` — Controlador de Interfaz

**Ruta:** `src/ui/UIController.js` | **Versión:** v6.0

#### Gestión del IntersectionObserver (v6.0)

**Problema:** En versiones anteriores, cada llamada a `renderLevelsGrid()` creaba un nuevo `IntersectionObserver` sin desconectar el anterior. Con 150 niveles y navegaciones frecuentes entre el menú y la pantalla de niveles, los observadores se acumulaban en memoria y continuaban procesando imágenes de nodos DOM ya eliminados, causando cargas duplicadas y callbacks en nodos detachados.

**Solución:** Se añade la propiedad `UI._thumbObserver` que almacena el observer activo. Al inicio de cada `renderLevelsGrid()`:

```js
if (UI._thumbObserver) {
    UI._thumbObserver.disconnect();
    UI._thumbObserver = null;
}
// ... crear nuevo observer ...
UI._thumbObserver = observer;
```

#### Lazy loading (IntersectionObserver)

El observer usa `rootMargin: '200px'` para comenzar a cargar thumbnails 200px antes de que entren al viewport. Cuando una imagen intersecta:
1. Se asigna `img.src = img.dataset.src`.
2. Se elimina `img.dataset.src` para evitar reasignaciones.
3. La imagen se desvincula del observer (`obs.unobserve`).

#### Inserción en lote con DocumentFragment

Las 150 tarjetas se construyen en un `DocumentFragment` y se insertan con un único `container.appendChild(fragment)`, evitando 150 reflows de layout individuales.

---

### 5.5 `Storage.js` — Almacenamiento

**Ruta:** `src/systems/Storage.js` | **Versión:** v3.0

Capa sobre `localStorage` con versionado de esquema. Prefijo de claves: `puz_arcade_`.

| Clave              | Tipo     | Contenido                                                       |
|--------------------|----------|-----------------------------------------------------------------|
| `progress`         | `object` | `{ "lvl_1": true, "lvl_2": true, … }` (niveles completados)  |
| `unlocked`         | `array`  | `["lvl_1", "lvl_2", …]` (IDs desbloqueados)                  |
| `save_{levelId}`   | `array`  | Estado serializado de `PuzzleEngine.exportState()`             |
| `settings`         | `object` | `{ sound: true/false }`                                        |

| Método                             | Descripción                                         |
|------------------------------------|-----------------------------------------------------|
| `markCompleted(levelId)`           | Registra un nivel como superado                     |
| `isCompleted(levelId)`             | Devuelve `true` si el nivel ha sido superado        |

---

### 5.6 `Economy.js` — Sistema de Economía

**Ruta:** `src/systems/Economy.js`

Implementa el contrato con `window.GameCenter.completeLevel('rompecabezas', levelId, rewardCoins)`. Si `GameCenter` no está disponible en el entorno (por ejemplo, en desarrollo local), registra un `console.warn` y la partida continúa sin interrupciones.

---

### 5.7 `AudioSynth.js` — Síntesis de Audio

**Ruta:** `src/systems/AudioSynth.js`

Grafo de audio: `Osciladores → GainNode (ADSR) → DynamicsCompressor (-24dB, 6:1) → MasterGain (0.7) → destination`.

| Tipo      | Descripción                                              | Cuándo se reproduce                                   |
|-----------|----------------------------------------------------------|-------------------------------------------------------|
| `'click'` | Triangle 1200Hz + Sine 500Hz                            | Al seleccionar una pieza o pulsar botones de la UI    |
| `'snap'`  | Square 220Hz (lowpass 1200Hz) + Triangle 900Hz          | Al encajar una pieza en su posición correcta          |
| `'win'`   | Acorde C-E-G (523/659/784Hz) escalonado + brillo 1568Hz | Al completar el rompecabezas                          |

---

## 6. Arquitectura de Activos — Cloudinary

### Cloud name y nomenclatura

- **Cloud name:** `dyspgn0sw`
- **Convención de nombres:** `NivelNN` con cero a la izquierda para n < 10 (ej: `Nivel01`, `Nivel09`, `Nivel10`).
- **Resolución nativa:** 1600×1600 px.

> **CRÍTICO:** Usar `Nivel1` en lugar de `Nivel01` causará pantalla de carga infinita en los niveles 1–9.

### URLs generadas (v4.0 — dinámicas por dispositivo)

```
Base:      https://res.cloudinary.com/dyspgn0sw/image/upload

Imagen (alta gama, _fullW=1600):
           .../f_auto,q_auto/v1/NivelNN

Imagen (gama media, _fullW=1200):
           .../f_auto,q_auto,w_1200/v1/NivelNN

Imagen (gama baja, _fullW=700):
           .../f_auto,q_auto,w_700/v1/NivelNN

Thumbnail (DPR 1×):
           .../c_thumb,w_160,g_center,f_auto,q_auto/v1/NivelNN

Thumbnail (DPR 2×+):
           .../c_thumb,w_240,g_center,f_auto,q_auto/v1/NivelNN
```

### Tabla de ejemplos

| Nivel | publicId    | Imagen (alta gama)                                        | Thumbnail (DPR 2×)                                              |
|-------|-------------|-----------------------------------------------------------|-----------------------------------------------------------------|
| 1     | `Nivel01`   | `.../f_auto,q_auto/v1/Nivel01`                            | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel01`           |
| 9     | `Nivel09`   | `.../f_auto,q_auto/v1/Nivel09`                            | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel09`           |
| 10    | `Nivel10`   | `.../f_auto,q_auto/v1/Nivel10`                            | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel10`           |
| 100   | `Nivel100`  | `.../f_auto,q_auto/v1/Nivel100`                           | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel100`          |
| 150   | `Nivel150`  | `.../f_auto,q_auto/v1/Nivel150`                           | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel150`          |

### Preconnect (`index.html`)

```html
<link rel="preconnect" href="https://res.cloudinary.com" crossorigin>
<link rel="dns-prefetch" href="https://res.cloudinary.com">
```

Estas etiquetas establecen la conexión TCP + TLS con Cloudinary durante el parseo del HTML, antes de que el JS solicite la primera imagen. En redes móviles esto ahorra entre 200–400ms del tiempo de carga percibido.

---

## 7. Pantallas y Navegación

| Pantalla  | ID                | `aria-label`               |
|-----------|-------------------|----------------------------|
| Menú      | `screen-menu`     | "Menú principal"           |
| Niveles   | `screen-levels`   | "Selección de misiones"    |
| Juego     | `screen-game`     | "Partida activa"           |
| Ajustes   | `screen-settings` | "Ajustes del juego"        |

Transiciones: opacidad + `translate3d(16px → 0)` a 250ms, usando exclusivamente `transform` y `opacity`.

### Modales

| ID               | Título             | `aria-modal` | `aria-labelledby`    |
|------------------|--------------------|:------------:|----------------------|
| `modal-resume`   | PARTIDA GUARDADA   | ✅           | `modal-resume-title` |
| `modal-pause`    | PAUSA              | ✅           | `modal-pause-title`  |
| `modal-victory`  | ¡MISIÓN CUMPLIDA!  | ✅           | `modal-victory-title`|
| `modal-alert`    | Aviso genérico     | ✅           | `modal-alert-title`  |
| `modal-confirm`  | Confirmación       | ✅           | `modal-confirm-title`|

> **Eliminado:** El modal `modal-gameover` (TIEMPO AGOTADO) ha sido retirado junto con el sistema de temporizador.

---

## 8. Sistema de Progresión del Jugador

### Modelo de progresión

El progreso del jugador se basa en el estado **completado / no completado** de cada nivel. No existe sistema de puntuación basada en tiempo ni calificación por estrellas.

| Estado       | Indicador visual en tarjeta         | Almacenamiento             |
|--------------|-------------------------------------|----------------------------|
| Bloqueado    | Candado                             | No aplica                  |
| Desbloqueado | Thumbnail de la imagen              | `Storage.unlocked[]`       |
| Completado   | Ícono de verificación verde (✓)    | `Storage.markCompleted()`  |

### Desbloqueo de niveles

Cada nivel completado desbloquea el siguiente de la secuencia. `Storage.validateUnlockedLevels()` se ejecuta al arrancar para reparar cualquier inconsistencia en los desbloqueados.

---

## 9. Motor Visual — PuzzleEngine en Detalle

### Orden de render por frame

1. Rejilla offscreen con parallax
2. Micro-dots parpadeantes
3. Capa estática (tablero + piezas encajadas)
4. Vista previa (28% opacidad, si está activa)
5. Piezas sueltas no seleccionadas
6. Ghost de snap (< 40% de distancia al destino)
7. Pieza seleccionada (escala 105%, borde sólido blanco 3px)
8. Partículas (ripples y confetti)
9. Snap flash (color `--success`, 150ms)
10. Edge pulses (2 anillos concéntricos, 700ms)

---

## 10. Sistema Háptico

| Evento         | Patrón                    | Sensación percibida  |
|----------------|---------------------------|----------------------|
| Levantar pieza | `10`                      | Pulso suave          |
| Encajar pieza  | `[30, 20, 10]`            | Doble pulso          |
| Victoria       | `[100, 50, 80, 50, 200]`  | Celebración intensa  |

Implementado mediante `navigator.vibrate()`. En dispositivos o navegadores que no soporten la API, la llamada falla silenciosamente sin afectar el flujo del juego.

---

## 11. Sistema de Audio Procedural

Sin archivos de audio externos. Todo el audio se sintetiza en tiempo real mediante la **Web Audio API** a través de la clase `AudioSynth`. El `AudioContext` se reanuda automáticamente en el primer toque del usuario, respetando las restricciones de autoplay de iOS y Android.

---

## 12. Características PWA

- `manifest.json`: nombre del juego, ícono, color de tema `#0f172a`, modo standalone.
- `service-worker.js`: en modo **purge activo**. Se auto-instala para desregistrarse y limpiar cualquier caché anterior. Todas las peticiones van directamente a la red.
- Viewport: `user-scalable=no`, `viewport-fit=cover`.

---

## 13. Herramientas de Desarrollo (Dev Tools)

`window.dev` está disponible en la consola del navegador tras el arranque de la aplicación.

| Comando              | Descripción                                                      |
|----------------------|------------------------------------------------------------------|
| `dev.unlockAll()`    | Desbloquea los 150 niveles en localStorage                       |
| `dev.addCoins(n)`    | Suma `n` monedas via `GameCenter`. Avisa si está en modo standalone |
| `dev.skipLevel()`    | Fuerza la victoria del nivel activo                              |

```js
// Ejemplos:
dev.unlockAll()       // → [Dev] ✅ 150 niveles desbloqueados.
dev.addCoins(1000)    // → [Dev] ✅ +1000 monedas añadidas via GameCenter.
dev.skipLevel()       // → [Dev] ✅ Saltando nivel lvl_5.
```

---

## 14. Accesibilidad (WCAG 2.2)

### Atributos implementados

| Elemento                         | Atributo                                                  | Propósito                                        |
|----------------------------------|-----------------------------------------------------------|--------------------------------------------------|
| Capas decorativas (bg, grid…)    | `aria-hidden="true"`                                      | Ocultas a lectores de pantalla                   |
| Botones de solo-icono            | `aria-label`                                              | Descripción textual de la acción                 |
| Tarjetas de nivel desbloqueadas  | `role="button"`, `tabindex="0"`, `aria-label`             | Navegables por teclado                           |
| Tarjetas de nivel bloqueadas     | `role="img"`, `aria-disabled="true"`                      | Anunciadas como imagen bloqueada                 |
| Modales                          | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`   | Anunciados correctamente por AT                  |
| SVGs decorativos                 | `aria-hidden="true"`                                      | Evita lectura del nombre del elemento SVG        |
| Texto solo para AT               | `.sr-only`                                                | Visible a lectores, invisible visualmente        |

### Foco visible (WCAG 2.4.11)

Todos los elementos interactivos tienen `:focus-visible` con `outline: 2px solid var(--accent)`.

### Tamaños táctiles (WCAG 2.5.5)

Todos los botones e iconos del HUD tienen un tamaño mínimo de **44×44px**. Las tarjetas de nivel tienen `min-height: 100px`.

---

## 15. Guía de Mantenimiento y Expansión

### Agregar niveles nuevos (dos pasos)

1. Subir la imagen 1600×1600 a Cloudinary con el nombre `NivelNN`:
   - n < 10: `Nivel01`…`Nivel09`
   - 10 ≤ n < 100: `Nivel10`…`Nivel99`
   - n ≥ 100: `Nivel100`…`Nivel150` (sin cero adicional)
2. En `LevelManager.js`: incrementar `const TOTAL_LEVELS = N;`

No se requiere ningún otro cambio. El sistema de URLs, progresión y escalado de imágenes se genera automáticamente.

---

### Cambiar el tamaño de thumbnail

Modificar la función `getThumbnailWidth()` en `LevelManager.js`. La fórmula base es:

```
anchoCSSMinimo × min(DPR, 2) × 1.07 → redondeado al múltiplo de 80 más cercano
```

Con tarjetas de 100px y DPR 2×: `100 × 2 × 1.07 ≈ 214` → snapped a `240px`. El valor resultante se limita entre 160 y 320px.

---

### Cambiar los breakpoints de imagen por dispositivo

Modificar la función `getFullImageWidth()` en `LevelManager.js`. La variable `_maxDim` representa la dimensión máxima de la pantalla en píxeles físicos. Ajustar los umbrales y los anchos de retorno según los dispositivos objetivo.

---

### Diagnóstico de errores comunes

| Síntoma                                           | Causa probable                                       | Solución                                                        |
|---------------------------------------------------|------------------------------------------------------|-----------------------------------------------------------------|
| Imagen de nivel no carga (pantalla infinita)      | `publicId` incorrecto o asset no subido a Cloudinary | Verificar que el nombre sea `Nivel${NN}` en el cloud `dyspgn0sw` |
| Error CORS al iniciar partida                     | Falta `crossOrigin = 'Anonymous'`                   | Ya corregido en `startGame()`; no revertir                      |
| Thumbnails no aparecen al abrir pantalla niveles  | Observer desconectado o `data-src` no asignado       | Verificar que `renderLevelsGrid()` se llame después de `loadLevels()` |
| Tarjeta de nivel no responde al teclado           | `tabindex` o `role` faltante en el elemento          | Verificar UIController v6.0 o superior                          |
| `dev.skipLevel()` no hace nada                   | No hay nivel activo en ese momento                   | Iniciar una partida antes de llamar al comando                   |
| El audio no suena en iOS al inicio               | Restricción de autoplay del sistema operativo        | Normal; el AudioContext se activa automáticamente en el primer toque |
| Imagen borrosa al escalar en canvas              | `imageSmoothingQuality` reseteado por cambio de dim. | Verificar que `_applySmoothing()` se llame tras cambios de `width`/`height` |
| Alto consumo de RAM al cambiar niveles           | Buffers offscreen no liberados en `destroy()`        | Verificar que `destroy()` asigne `width=0`/`height=0` y llame a `bitmap.close()` |
| Thumbnails cargados dos veces en la grid         | Observer huérfano del render anterior                | Verificar que `UI._thumbObserver.disconnect()` se llame al inicio de `renderLevelsGrid()` |
| Pieza queda "flotando" al pausar                  | `cancelDrag()` no invocado antes de `togglePause()`  | Verificar que `togglePause()` en main.js llame a `activeGame.cancelDrag()` |