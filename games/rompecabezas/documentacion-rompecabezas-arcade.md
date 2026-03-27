# Documentación Técnica — Rompecabezas Arcade

**Proyecto:** Rompecabezas Arcade (Neural Puzzle)
**Plataforma:** Love Arcade
**Versión del motor:** `PuzzleEngine v16.0` · `main.js v7.0` · `UIController v5.0` · `LevelManager v3.0` · `Storage v3.0`
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
- Activos visuales servidos desde **Cloudinary** con optimización automática de formato (WebP/AVIF).
- Carga progresiva de thumbnails con **IntersectionObserver**: las miniaturas se descargan únicamente cuando están a punto de entrar al área visible de la pantalla, eliminando sobrecarga de red al navegar una lista de 150 niveles.
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
    ├── main.js                 # Punto de entrada y orquestador (v7.0)
    ├── style.css               # Estilos globales — Flat 2.0, variables CSS, .sr-only
    ├── core/
    │   ├── PuzzleEngine.js     # Motor de renderizado y lógica de piezas (v16.0)
    │   └── LevelManager.js     # Generación algorítmica de niveles (v3.0)
    ├── ui/
    │   └── UIController.js     # Gestión de pantallas y DOM (v5.0)
    └── systems/
        ├── Storage.js          # Persistencia en localStorage (v3.0)
        ├── Economy.js          # Integración con GameCenter (monedas)
        └── AudioSynth.js       # Síntesis de efectos de sonido
```

---

## 3. Arquitectura y Flujo de la Aplicación

```
main.js
 ├── LevelManager   → [genera en memoria] 150 objetos de nivel + URLs Cloudinary
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
       ├─ await LevelManager.loadLevels()      // genera 150 niveles en memoria;
       │                                        // await garantiza que los datos estén
       │                                        // disponibles antes de los pasos siguientes
       ├─ Storage.validateUnlockedLevels()     // repara desbloqueados huérfanos
       ├─ UI.initGlobalInteractions()          // botones: release bounce
       ├─ setupNavigation()                    // bind de todos los botones de nav
       ├─ setupSettings()                      // ajustes de sonido
       ├─ setupDevTools()                      // registra window.dev
       └─ UI.showScreen('menu')               // muestra pantalla inicial
```

> **Nota de implementación:** `loadLevels()` es síncrono internamente, pero se declara `async` y se aguarda con `await` para garantizar que la validación de progreso y la configuración de dev tools no se ejecuten antes de que los niveles estén disponibles en memoria. Omitir el `await` en versiones anteriores causaba una race condition en la inicialización.

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

**Ruta:** `src/main.js` | **Versión:** v7.0

#### Variables de estado globales

| Variable         | Tipo           | Descripción                                                        |
|------------------|----------------|--------------------------------------------------------------------|
| `levelManager`   | `LevelManager` | Instancia global del gestor de niveles                             |
| `activeGame`     | `PuzzleEngine` | Instancia activa del motor (`null` si no hay partida en curso)     |
| `currentLevelId` | `string`       | ID del nivel en juego (ej: `"lvl_5"`)                             |
| `GameState`      | `object`       | Estado centralizado: `isPaused`, `isInGame`                        |

> **Eliminado en v7.0:** Las variables `startTime`, `timeLeft` y `timerId`, y las funciones `startTimer()` y `updateTimerDisplay()` han sido retiradas por completo junto con el sistema de temporizador.

---

#### `init()`

Punto de entrada de la aplicación. Ejecuta `await levelManager.loadLevels()` antes de cualquier otra operación para evitar race conditions. Ver [Sección 3](#3-arquitectura-y-flujo-de-la-aplicación).

---

#### `startGame(levelId, loadSaved)`

Carga la imagen del nivel desde Cloudinary con `crossOrigin: 'Anonymous'`, espera a que `img.decode()` complete y luego instancia `PuzzleEngine`.

**Manejo de errores de imagen (v7.0):** Si `img.decode()` lanza una excepción, el bloque `catch` restaura la opacidad del canvas (`puzzleCanvas.style.opacity = '1'`) y muestra un modal de error personalizado. Esto evita que la UI quede en un estado visual inconsistente (canvas invisible sin retroalimentación al usuario).

---

#### `handleVictory(levelConfig)`

Marca el nivel como completado (`Storage.markCompleted()`), desbloquea el siguiente nivel y llama a `Economy.payout()`.

> **Eliminado en v7.0:** El cálculo de estrellas basado en tiempo y todos los parámetros asociados (`time`, `stars`) han sido eliminados. La función ahora únicamente registra la finalización y muestra el modal de victoria.

---

#### Comportamiento del botón "Jugar" (v7.0)

Al pulsar **Jugar** desde el menú principal, la lógica en `setupNavigation()` busca automáticamente el primer nivel desbloqueado que aún no ha sido completado y redirige al jugador directamente a ese nivel. Si existe una partida guardada para ese nivel, se muestra el modal de reanudación. El botón **Niveles** sigue abriendo la cuadrícula de selección manual.

---

#### `setupGameControls()` — Feedback del imán (v7.0)

Cuando el jugador activa la herramienta Imán y no quedan piezas sueltas (o el rompecabezas ya está resuelto), se muestra un modal de aviso personalizado en lugar de no ejecutar ninguna acción. Esto evita que el jugador piense que la herramienta está rota.

---

#### `setupSettings()` (v7.0)

Gestiona el ajuste de sonido. El botón "Resetear Progreso" ha sido **eliminado** de esta pantalla, tanto del DOM en `index.html` como de su lógica asociada en esta función.

---

#### `togglePause()` (v7.0)

Al pausar durante una partida activa, se invoca `activeGame.cancelDrag()` antes de detener el motor. Esto garantiza que una pieza arrastrada en el momento de la pausa quede suelta correctamente en lugar de quedar "suspendida" en un estado de arrastre inválido.

---

### 5.2 `PuzzleEngine.js` — Motor de Juego

**Ruta:** `src/core/PuzzleEngine.js` | **Versión:** v16.0

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
| `destroy()`         | Detiene el loop, libera listeners y limpia referencias                         |

---

#### `handleResize()` — Comportamiento mejorado (v16.0)

En versiones anteriores, `handleResize()` llamaba a `shufflePieces(true)`, lo que redistribuía aleatoriamente todas las piezas sueltas al cambiar el tamaño de la ventana, perdiendo el progreso visual del jugador.

El comportamiento actual calcula la relación de escala entre el tamaño anterior y el nuevo (`scaleX`, `scaleY`) y reposiciona cada pieza suelta de forma proporcional, manteniendo su ubicación relativa dentro del tablero.

---

#### `cancelDrag()` — Restauración al pausar (v16.0)

Al iniciar un arrastre (`handleStart`), el motor guarda las coordenadas originales de la pieza (`originalX`, `originalY`). Si se invoca `cancelDrag()` (por pausa, por pérdida de foco o por cualquier interrupción), la pieza regresa automáticamente a esas coordenadas, evitando que quede en una posición ambigua o inalcanzable.

---

### 5.3 `LevelManager.js` — Gestor de Niveles

**Ruta:** `src/core/LevelManager.js` | **Versión:** v3.0

Genera **150 niveles** en memoria. Sin fetch de red. `async loadLevels()` es síncrono internamente; se declara `async` para ser compatible con el `await` en `init()`.

#### Constantes

| Constante         | Valor                                                | Descripción                              |
|-------------------|------------------------------------------------------|------------------------------------------|
| `TOTAL_LEVELS`    | `150`                                                | Única variable que controla el total     |
| `CLOUDINARY_BASE` | `https://res.cloudinary.com/dyspgn0sw/image/upload` | URL base del CDN                         |

#### Progresión algorítmica

| Campo         | Fórmula                                          | Ejemplo n=1  | Ejemplo n=150  |
|---------------|--------------------------------------------------|--------------|----------------|
| `id`          | `"lvl_${n}"`                                     | `"lvl_1"`    | `"lvl_150"`    |
| `publicId`    | `` `Nivel${String(n).padStart(2,'0')}` ``         | `"Nivel01"`  | `"Nivel150"`   |
| `pieces`      | `n ≤ 10 ? 16 : 25`                               | `16`         | `25`           |
| `rewardCoins` | `150 + (n × 2)`                                  | `152`        | `450`          |

> **Eliminado en v3.0:** La propiedad `timeLimit` ha sido retirada de la configuración de cada nivel. El sistema de temporizador ha sido eliminado por completo del juego.

---

#### `getAllLevelsWithStatus()`

Devuelve todos los niveles enriquecidos con el estado de progreso actual. Utiliza `Storage.isCompleted()` para determinar si un nivel ha sido superado. El campo `stars` ya no forma parte de la respuesta.

---

#### Thumbnail — Regla de dimensionado

Las tarjetas se muestran a 112px CSS mínimo. Con DPR 2× se necesitan 224px físicos. El valor `w_240` cubre ese requerimiento con un 7% de margen y reduce el peso por imagen aproximadamente un 64% respecto al valor anterior de `w_400`, acelerando la carga inicial de la pantalla de niveles.

Fórmula: `anchoCSSMinimo × DPRmax × 1.07` → `112 × 2 × 1.07 ≈ 240px`.

---

### 5.4 `UIController.js` — Controlador de Interfaz

**Ruta:** `src/ui/UIController.js` | **Versión:** v5.0

#### Lazy loading con IntersectionObserver (v5.0)

Las miniaturas de los 150 niveles se cargan de forma progresiva: el observer asigna `img.src` únicamente cuando una tarjeta está a menos de 100px de entrar al área visible de la pantalla (`rootMargin: '100px 0px'`). Esto elimina la sobrecarga de lanzar 150 peticiones HTTP simultáneas al abrir la pantalla de niveles y mantiene la fluidez al hacer scroll.

```js
// Asignación diferida — sin descarga inmediata:
img.dataset.src = url;

// Solo al acercarse al viewport:
observer.observe(card);  // IntersectionObserver asigna img.src cuando corresponde
```

**Gestión del ciclo de vida del observer:**

```js
// Al inicio de renderLevelsGrid():
if (UI._thumbObserver) {
    UI._thumbObserver.disconnect();  // evita callbacks fantasma de renders anteriores
    UI._thumbObserver = null;
}
```

---

#### Feedback visual para imágenes fallidas (v5.0)

Si una imagen de nivel no puede cargarse y no existe thumbnail de respaldo, la imagen rota se oculta y en su lugar se muestra un ícono de error centrado dentro de la tarjeta. La tarjeta conserva su estilo y dimensiones habituales para no romper el layout de la cuadrícula.

---

#### `renderLevelsGrid()` — Estandarización (v5.0)

La función utiliza exclusivamente las propiedades `level.status` y `level.completed` proporcionadas por `getAllLevelsWithStatus()`. Las llamadas directas a `Storage.isUnlocked()` y `Storage.getStars()` desde la vista han sido eliminadas para evitar redundancias y garantizar una única fuente de verdad.

Los niveles completados muestran un **ícono de verificación verde** (✓). El sistema de estrellas ha sido eliminado por completo de las tarjetas de nivel.

**Inserción en lote con DocumentFragment:** Las 150 tarjetas se construyen en un `DocumentFragment` (nodo fuera del árbol DOM) y se insertan con un único `container.appendChild(fragment)`, evitando un reflow de layout por cada tarjeta.

---

#### Modales personalizados (v5.0)

Todas las llamadas nativas a `window.alert()` y `window.confirm()` han sido eliminadas de `main.js` y reemplazadas por dos nuevos modales personalizados definidos en `index.html`: `modal-alert` y `modal-confirm`.

Los métodos correspondientes en UIController son `showAlert(message)` y `showConfirm(message, onConfirm)`, que mantienen la coherencia visual del juego en lugar de mostrar los cuadros de diálogo del sistema operativo.

---

#### `updateHUD()` (v5.0)

El parámetro de temporizador y su lógica de actualización han sido eliminados. La función gestiona únicamente el estado de las herramientas de juego disponibles.

---

#### `showVictoryModal()` (v5.0)

Los parámetros de tiempo y estrellas han sido eliminados. El modal de victoria muestra el nombre del nivel completado y las opciones de navegación (siguiente nivel o volver al menú), sin cálculos de puntuación basados en tiempo.

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

#### Cambios en v3.0

Los métodos `saveStars(levelId, stars)` y `getStars(levelId)` han sido **eliminados** y reemplazados por:

| Método nuevo                       | Descripción                                         |
|------------------------------------|-----------------------------------------------------|
| `markCompleted(levelId)`           | Registra un nivel como superado                     |
| `isCompleted(levelId)`             | Devuelve `true` si el nivel ha sido superado        |

El método `validateUnlockedLevels()` ha sido actualizado para depender de `isCompleted()` en lugar del sistema de estrellas anterior.

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

El audio puede silenciarse desde el menú de **Ajustes**, lo que desactiva la instancia global de `AudioSynth`. El contexto de audio se reanuda automáticamente en el primer toque del usuario, respetando la política de autoplay de iOS y Android.

---

## 6. Arquitectura de Activos — Cloudinary

### Cloud name y nomenclatura

- **Cloud name:** `dyspgn0sw`
- **Convención de nombres:** `NivelNN` con cero a la izquierda para n < 10 (ej: `Nivel01`, `Nivel09`, `Nivel10`).

> **CRÍTICO:** Usar `Nivel1` en lugar de `Nivel01` causará pantalla de carga infinita en los niveles 1–9.

### URLs generadas

```
Base:      https://res.cloudinary.com/dyspgn0sw/image/upload

Imagen:    .../f_auto,q_auto/v1/NivelNN
Thumbnail: .../c_thumb,w_240,g_center,f_auto,q_auto/v1/NivelNN
```

| Nivel | publicId    | Thumbnail                                                            |
|-------|-------------|----------------------------------------------------------------------|
| 1     | `Nivel01`   | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel01`               |
| 9     | `Nivel09`   | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel09`               |
| 10    | `Nivel10`   | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel10`               |
| 150   | `Nivel150`  | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel150`              |

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

| Estado       | Indicador visual en tarjeta | Almacenamiento         |
|--------------|-----------------------------|------------------------|
| Bloqueado    | Candado                     | No aplica              |
| Desbloqueado | Thumbnail de la imagen      | `Storage.unlocked[]`   |
| Completado   | Ícono de verificación verde (✓) | `Storage.markCompleted()` |

### Desbloqueo de niveles

Cada nivel completado desbloquea el siguiente de la secuencia. `Storage.validateUnlockedLevels()` se ejecuta al arrancar para reparar cualquier inconsistencia en los desbloqueados (por ejemplo, si el esquema de datos fue migrado desde una versión anterior con estrellas).

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

Ver detalles de tipos de sonido en [Sección 5.7](#57-audiosynthjs--síntesis-de-audio).

---

## 12. Características PWA

- `manifest.json`: nombre del juego, ícono, color de tema `#0f172a`, modo standalone.
- `service-worker.js`: en modo **purge activo**. Se auto-instala para desregistrarse y limpiar cualquier caché anterior. Todas las peticiones van directamente a la red.
- Viewport: `user-scalable=no`, `viewport-fit=cover`.

---

## 13. Herramientas de Desarrollo (Dev Tools)

`window.dev` está disponible en la consola del navegador tras el arranque de la aplicación. Se registra en `setupDevTools()`, que es llamado después de que `loadLevels()` completa, garantizando que los datos de nivel estén disponibles para los comandos.

| Comando              | Descripción                                                      |
|----------------------|------------------------------------------------------------------|
| `dev.unlockAll()`    | Desbloquea los 150 niveles en localStorage                       |
| `dev.addCoins(n)`    | Suma `n` monedas via `GameCenter`. Avisa si está en modo standalone |
| `dev.skipLevel()`    | Fuerza la victoria del nivel activo sin calcular estrellas       |

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

Todos los botones e iconos del HUD tienen un tamaño mínimo de **44×44px**. Las tarjetas de nivel tienen `min-height: 112px`.

---

## 15. Guía de Mantenimiento y Expansión

### Agregar niveles nuevos (dos pasos)

1. Subir la imagen a Cloudinary con el nombre `NivelNN` (cero a la izquierda si n < 100, ej: `Nivel65`; sin cero para n ≥ 100, ej: `Nivel150`).
2. En `LevelManager.js`: incrementar `const TOTAL_LEVELS = N;`

No se requiere ningún otro cambio. El sistema de progresión y las URLs de Cloudinary se generan automáticamente.

---

### Cambiar el tamaño de thumbnail

Modificar `buildThumbnailUrl()` en `LevelManager.js`. Aplicar la fórmula: `anchoCSSMinimo × DPRmax × 1.07`.

Con tarjetas de 112px y DPR 2×: `112 × 2 × 1.07 ≈ 240px`. El valor actual `w_240` es el mínimo recomendado para cubrir pantallas de alta densidad.

---

### Diagnóstico de errores comunes

| Síntoma                                           | Causa probable                                       | Solución                                                        |
|---------------------------------------------------|------------------------------------------------------|-----------------------------------------------------------------|
| Imagen de nivel no carga (pantalla infinita)      | `publicId` incorrecto o asset no subido a Cloudinary | Verificar que el nombre sea `Nivel${NN}` en el cloud `dyspgn0sw` |
| Error CORS al iniciar partida                     | Falta `crossOrigin = 'Anonymous'`                   | Ya corregido en `startGame()`; no revertir                      |
| Thumbnails no aparecen al abrir pantalla niveles  | Observer desconectado o `data-src` no asignado       | Verificar que `renderLevelsGrid()` se llame después de `loadLevels()` |
| Tarjeta de nivel no responde al teclado           | `tabindex` o `role` faltante en el elemento          | Verificar UIController v5.0 o superior                          |
| `dev.skipLevel()` no hace nada                   | No hay nivel activo en ese momento                   | Iniciar una partida antes de llamar al comando                   |
| El audio no suena en iOS al inicio               | Restricción de autoplay del sistema operativo        | Normal; el AudioContext se activa automáticamente en el primer toque |
| Modal de error no aparece al fallar imagen        | `puzzleCanvas.style.opacity` no se restaura          | Verificar bloque `catch` en `startGame()` — debe restaurar opacidad antes de mostrar modal |
| Pieza queda "flotando" al pausar                  | `cancelDrag()` no invocado antes de `togglePause()`  | Verificar que `togglePause()` en main.js llame a `activeGame.cancelDrag()` |