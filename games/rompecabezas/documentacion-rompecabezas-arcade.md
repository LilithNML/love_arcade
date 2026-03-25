# Documentación Técnica — Rompecabezas Arcade
**Proyecto:** Rompecabezas Arcade (Neural Puzzle)  
**Plataforma:** Love Arcade  
**Versión del motor:** `PuzzleEngine v15.0` · `main.js v6.0` · `UIController v4.0` · `LevelManager v2.2`  
**Última revisión:** Marzo 2026

---

## Índice

1. [Visión General](#1-visión-general)
2. [Estructura del Proyecto](#2-estructura-del-proyecto)
3. [Arquitectura y Flujo de la Aplicación](#3-arquitectura-y-flujo-de-la-aplicación)
4. [Módulos del Sistema](#4-módulos-del-sistema)
   - 4.1 [main.js — Orquestador](#41-mainjs--orquestador)
   - 4.2 [PuzzleEngine.js — Motor de Juego](#42-puzzleenginejs--motor-de-juego)
   - 4.3 [LevelManager.js — Gestor de Niveles](#43-levelmanagerjs--gestor-de-niveles)
   - 4.4 [UIController.js — Controlador de Interfaz](#44-uicontrollerjs--controlador-de-interfaz)
   - 4.5 [Storage.js — Almacenamiento](#45-storagejs--almacenamiento)
   - 4.6 [Economy.js — Sistema de Economía](#46-economyjs--sistema-de-economía)
   - 4.7 [AudioSynth.js — Síntesis de Audio](#47-audiosynthjs--síntesis-de-audio)
5. [Arquitectura de Activos — Cloudinary](#5-arquitectura-de-activos--cloudinary)
6. [Pantallas y Navegación](#6-pantallas-y-navegación)
7. [Sistema de Progresión del Jugador](#7-sistema-de-progresión-del-jugador)
8. [Motor Visual — PuzzleEngine en Detalle](#8-motor-visual--puzzleengine-en-detalle)
9. [Sistema Háptico](#9-sistema-háptico)
10. [Sistema de Audio Procedural](#10-sistema-de-audio-procedural)
11. [Características PWA](#11-características-pwa)
12. [Herramientas de Desarrollo (Dev Tools)](#12-herramientas-de-desarrollo-dev-tools)
13. [Accesibilidad (WCAG 2.2)](#13-accesibilidad-wcag-22)
14. [Guía de Mantenimiento y Expansión](#14-guía-de-mantenimiento-y-expansión)

---

## 1. Visión General

**Rompecabezas Arcade** es un juego de puzzles de arrastrar y soltar, construido con JavaScript vanilla y Canvas API, diseñado para correr como Progressive Web App (PWA) dentro del ecosistema **Love Arcade**. El jugador arrastra piezas de una imagen fragmentada hasta reconstruirla dentro de un tablero.

### Características principales

- **64 niveles** generados algorítmicamente desde una constante única (`TOTAL_LEVELS`). No se requiere editar JSON para agregar niveles.
- Activos visuales servidos desde **Cloudinary** con optimización automática de formato (WebP/AVIF).
- Carga de thumbnails con **IntersectionObserver** real: solo se descargan las imágenes visibles en pantalla, eliminando el retraso de ~3 segundos al entrar a la pantalla de niveles.
- Motor de renderizado en canvas con soporte para mouse y pantalla táctil.
- Sistema de recompensas en monedas integrado con **Love Arcade** via `window.GameCenter`.
- Efectos visuales avanzados: rejilla reactiva con parallax, pulsos radiales, destellos de encaje y partículas.
- Retroalimentación háptica por vibración (`navigator.vibrate`) para pickup, snap y victoria.
- Audio procedural sintetizado con la Web Audio API.
- Persistencia de progreso en `localStorage` con sistema de versionado de esquema.
- Accesibilidad WCAG 2.2: roles ARIA, navegación por teclado, etiquetas descriptivas.
- Objeto global `window.dev` con utilidades de depuración accesibles desde la consola del navegador.

---

## 2. Estructura del Proyecto

```
/
├── index.html                  # Shell HTML — preconnect Cloudinary, ARIA completo
├── manifest.json               # Manifiesto PWA
├── service-worker.js           # Service Worker (modo purge activo)
└── src/
    ├── main.js                 # Punto de entrada y orquestador (v6.0)
    ├── style.css               # Estilos globales — incluye .sr-only y contain optimizations
    ├── core/
    │   ├── PuzzleEngine.js     # Motor de renderizado y lógica de piezas (v15.0)
    │   └── LevelManager.js     # Generación algorítmica de niveles (v2.2)
    ├── ui/
    │   └── UIController.js     # Gestión de pantallas y DOM (v4.0)
    └── systems/
        ├── Storage.js          # Persistencia en localStorage (v2.0)
        ├── Economy.js          # Integración con GameCenter (monedas)
        └── AudioSynth.js       # Síntesis de efectos de sonido
```

---

## 3. Arquitectura y Flujo de la Aplicación

```
main.js
 ├── LevelManager   → [genera en memoria] 64 objetos de nivel + URLs Cloudinary
 ├── UI             → [manipula] DOM / pantallas / IntersectionObserver
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
       ├─ LevelManager.loadLevels()         // genera 64 niveles en memoria (síncrono)
       ├─ Storage.validateUnlockedLevels()  // repara desbloqueados huérfanos
       ├─ UI.initGlobalInteractions()       // botones: release bounce
       ├─ setupNavigation()                 // bind de todos los botones de nav
       ├─ setupSettings()                   // ajustes de sonido y reset
       ├─ setupDevTools()                   // registra window.dev
       └─ UI.showScreen('menu')             // muestra pantalla inicial
```

---

## 4. Módulos del Sistema

### 4.1 `main.js` — Orquestador

**Ruta:** `src/main.js` | **Versión:** v6.0

Variables de estado globales:

| Variable        | Tipo           | Descripción                                       |
|-----------------|----------------|---------------------------------------------------|
| `levelManager`  | `LevelManager` | Instancia global del gestor de niveles            |
| `activeGame`    | `PuzzleEngine` | Instancia activa del motor (null si no hay juego) |
| `currentLevelId`| `string`       | ID del nivel en juego (ej: `"lvl_5"`)            |
| `startTime`     | `number`       | Timestamp `Date.now()` al arrancar el nivel       |
| `GameState`     | `object`       | Estado centralizado: `isPaused`, `isInGame`, `timeLeft`, `timerId` |

**`startGame(levelId, loadSaved)`** — Carga imagen desde Cloudinary con `crossOrigin: 'Anonymous'`, espera `img.decode()`, instancia `PuzzleEngine`. Si `timeLimit === 0`, muestra `"∞"` en lugar de iniciar el contador.

**`handleVictory(levelConfig)`** — Calcula estrellas, guarda progreso, desbloquea siguiente nivel, llama a `Economy.payout()`.

**`setupDevTools()`** — Registra `window.dev`. Ver [Sección 12](#12-herramientas-de-desarrollo-dev-tools).

---

### 4.2 `PuzzleEngine.js` — Motor de Juego

**Ruta:** `src/core/PuzzleEngine.js` | **Versión:** v15.0

Motor canvas con cuatro buffers de dibujo: `canvas` (principal), `staticCanvas` (tablero + piezas encajadas), `sourceCanvas` (imagen escalada), `gridCanvas` (rejilla offscreen).

El loop `requestAnimationFrame` se **detiene automáticamente** cuando no hay nada que animar (sin drag, sin partículas, sin efectos activos), reduciendo el consumo de batería en reposo.

API pública: `exportState()`, `importState(state)`, `togglePreview(bool)`, `autoPlacePiece()`, `handleResize()`, `destroy()`.

---

### 4.3 `LevelManager.js` — Gestor de Niveles

**Ruta:** `src/core/LevelManager.js` | **Versión:** v2.2

Genera 64 niveles en memoria. Sin fetch de red. `async loadLevels()` es síncrono internamente.

#### Constantes

| Constante         | Valor                                                | Descripción                              |
|-------------------|------------------------------------------------------|------------------------------------------|
| `TOTAL_LEVELS`    | `64`                                                 | Única variable que controla el total     |
| `CLOUDINARY_BASE` | `https://res.cloudinary.com/dyspgn0sw/image/upload` | URL base del CDN                         |

#### Progresión algorítmica

| Campo         | Fórmula                                         | Ejemplo n=1   | Ejemplo n=64  |
|---------------|-------------------------------------------------|---------------|---------------|
| `id`          | `"lvl_${n}"`                                    | `"lvl_1"`     | `"lvl_64"`    |
| `publicId`    | `` `Nivel${String(n).padStart(2,'0')}` ``        | `"Nivel01"`   | `"Nivel64"`   |
| `pieces`      | `n ≤ 10 ? 16 : 25`                              | `16`          | `25`          |
| `rewardCoins` | `150 + (n × 2)`                                 | `152`         | `278`         |
| `timeLimit`   | `0` (constante)                                 | Sin límite ("∞" en HUD)                 |

#### Cambio v2.2 — Thumbnail w_400 → w_240

Las tarjetas se muestran a 112px CSS mínimo. Con DPR 2× se necesitan 224px físicos. `w_240` cubre ese requerimiento con 7% de margen y reduce el peso por imagen **~64%** respecto al anterior `w_400`, acelerando la carga inicial de la pantalla de niveles.

---

### 4.4 `UIController.js` — Controlador de Interfaz

**Ruta:** `src/ui/UIController.js` | **Versión:** v4.0

#### Lazy loading con IntersectionObserver (nuevo en v4.0)

**Problema resuelto:** En v3.0, `renderLevelsGrid()` asignaba `img.src` inmediatamente para las 64 tarjetas, disparando 64 peticiones HTTP simultáneas. En HTTP/1.1 (el límite es 6 conexiones por dominio), las primeras 6 imágenes bloqueaban el resto, causando un retraso visible de ~3 segundos antes de que las tarjetas aparecieran con contenido.

**Solución implementada:**

```js
// En lugar de img.src = url (descarga inmediata):
img.dataset.src = url;   // almacenado, sin descarga

// Solo al entrar al viewport:
observer.observe(card);  // IntersectionObserver asigna img.src cuando es visible
```

El observer usa `rootMargin: '100px 0px'`, lo que inicia la descarga 100px antes de que la tarjeta sea visible, eliminando el efecto pop-in al hacer scroll.

#### DocumentFragment para inserción en lote (nuevo en v4.0)

Las 64 tarjetas se construyen en un `DocumentFragment` (nodo fuera del árbol DOM) y se insertan con un único `container.appendChild(fragment)`. Esto reemplaza los 64 `appendChild` individuales anteriores, que forzaban un reflow del layout por cada tarjeta.

#### Gestión de ciclo de vida del observer

```js
// Al inicio de renderLevelsGrid():
if (UI._thumbObserver) {
    UI._thumbObserver.disconnect();  // evita callbacks fantasma de tarjetas eliminadas
    UI._thumbObserver = null;
}
```

#### Accesibilidad (nuevo en v4.0)

- Tarjetas desbloqueadas: `role="button"`, `tabindex="0"`, `aria-label` descriptivo.
- Tarjetas bloqueadas: `role="img"`, `aria-disabled="true"`.
- Navegación por teclado: Enter y Space activan la tarjeta seleccionada.
- Overlay de estado: `aria-hidden="true"` (la información ya está en `aria-label`).

---

### 4.5 `Storage.js` — Almacenamiento

**Ruta:** `src/systems/Storage.js` | **Versión:** v2.0

Capa sobre `localStorage` con versionado de esquema. Prefijo `puz_arcade_`.

| Clave              | Tipo     | Contenido                                        |
|--------------------|----------|--------------------------------------------------|
| `progress`         | `object` | `{ "lvl_1": 3, "lvl_2": 2, … }` (estrellas)   |
| `unlocked`         | `array`  | `["lvl_1", "lvl_2", …]` (IDs desbloqueados)   |
| `save_{levelId}`   | `array`  | Estado serializado de `PuzzleEngine.exportState()` |
| `settings`         | `object` | `{ sound: true/false }`                          |

---

### 4.6 `Economy.js` — Sistema de Economía

**Ruta:** `src/systems/Economy.js`

Implementa el contrato con `window.GameCenter.completeLevel('rompecabezas', levelId, rewardCoins)`. Si `GameCenter` no existe, registra un `console.warn` y la partida continúa.

---

### 4.7 `AudioSynth.js` — Síntesis de Audio

**Ruta:** `src/systems/AudioSynth.js`

Grafo: `Osciladores → GainNode (ADSR) → DynamicsCompressor (-24dB, 6:1) → MasterGain (0.7) → destination`.

| Tipo      | Descripción                                                    |
|-----------|----------------------------------------------------------------|
| `'click'` | Triangle 1200Hz + Sine 500Hz                                  |
| `'snap'`  | Square 220Hz (lowpass 1200Hz) + Triangle 900Hz                |
| `'win'`   | Acorde C-E-G (523/659/784Hz) escalonado + brillo 1568Hz       |

---

## 5. Arquitectura de Activos — Cloudinary

### Cloud Name y nomenclatura

- **Cloud name:** `dyspgn0sw`
- **Convención de nombres:** `NivelNN` con cero a la izquierda para n < 10 (ej: `Nivel01`, `Nivel09`, `Nivel10`).

> **CRÍTICO:** Usar `Nivel1` en lugar de `Nivel01` causará pantalla de carga infinita en los niveles 1–9.

### URLs generadas

```
Base:      https://res.cloudinary.com/dyspgn0sw/image/upload

Imagen:    .../f_auto,q_auto/v1/NivelNN
Thumbnail: .../c_thumb,w_240,g_center,f_auto,q_auto/v1/NivelNN
```

| Nivel | publicId   | Thumbnail (actual v2.2)                            |
|-------|------------|----------------------------------------------------|
| 1     | `Nivel01`  | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel01` |
| 9     | `Nivel09`  | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel09` |
| 64    | `Nivel64`  | `.../c_thumb,w_240,g_center,f_auto,q_auto/v1/Nivel64` |

### Preconnect (index.html)

```html
<link rel="preconnect" href="https://res.cloudinary.com" crossorigin>
<link rel="dns-prefetch" href="https://res.cloudinary.com">
```

Estas etiquetas establecen la conexión TCP + TLS con Cloudinary durante el parse del HTML, antes de que el JS solicite la primera imagen. En redes móviles esto ahorra 200–400ms del tiempo de carga percibido.

---

## 6. Pantallas y Navegación

| Pantalla         | ID                 | `aria-label`                |
|------------------|--------------------|-----------------------------|
| Menú             | `screen-menu`      | "Menú principal"            |
| Niveles          | `screen-levels`    | "Selección de misiones"     |
| Juego            | `screen-game`      | "Partida activa"            |
| Ajustes          | `screen-settings`  | "Ajustes del juego"         |

Transiciones: opacidad + `translate3d(16px → 0)` a 250ms.

### Modales

| ID                 | Título             | `aria-modal` | `aria-labelledby`        |
|--------------------|--------------------|--------------|--------------------------|
| `modal-resume`     | PARTIDA GUARDADA   | ✅           | `modal-resume-title`     |
| `modal-pause`      | PAUSA              | ✅           | `modal-pause-title`      |
| `modal-gameover`   | TIEMPO AGOTADO     | ✅           | `modal-gameover-title`   |
| `modal-victory`    | ¡MISIÓN CUMPLIDA!  | ✅           | `modal-victory-title`    |

---

## 7. Sistema de Progresión del Jugador

### Cálculo de estrellas

| Estrellas | Condición              | 16 piezas      | 25 piezas       |
|-----------|------------------------|----------------|-----------------|
| ⭐⭐⭐     | `duration ≤ pieces×5s` | ≤ 80 segundos  | ≤ 125 segundos  |
| ⭐⭐       | `duration ≤ pieces×10s`| ≤ 160 segundos | ≤ 250 segundos  |
| ⭐         | Cualquier otro caso    | > 160 segundos | > 250 segundos  |

---

## 8. Motor Visual — PuzzleEngine en Detalle

### Orden de render por frame

1. Rejilla offscreen con parallax
2. Micro-dots parpadeantes
3. Capa estática (tablero + piezas encajadas)
4. Vista previa (28% opacidad, si activa)
5. Piezas sueltas no seleccionadas
6. Ghost de snap (< 40% distancia al destino)
7. Pieza seleccionada (105% escala, stroke blanco 2px)
8. Partículas (ripples y confetti)
9. Snap flash (esmeralda, 150ms)
10. Edge pulses (2 anillos concéntricos, 700ms)

---

## 9. Sistema Háptico

| Evento         | Patrón                   | Sensación            |
|----------------|--------------------------|----------------------|
| Levantar pieza | `10`                     | Pulso suave          |
| Encajar pieza  | `[30, 20, 10]`           | Doble pulso          |
| Victoria       | `[100, 50, 80, 50, 200]` | Celebración intensa  |

---

## 10. Sistema de Audio Procedural

Sin archivos de audio externos. Todo sintetizado con Web Audio API. Se reanuda automáticamente en el primer toque (política de autoplay iOS/Android).

---

## 11. Características PWA

- `manifest.json`: nombre, ícono, color de tema `#0f172a`, modo standalone.
- `service-worker.js`: en modo purge activo. Se auto-instala para desregistrarse y limpiar cualquier caché anterior. Todas las peticiones van directamente a la red.
- Viewport: `user-scalable=no`, `viewport-fit=cover`.

---

## 12. Herramientas de Desarrollo (Dev Tools)

`window.dev` disponible en consola del navegador tras el arranque de la app.

| Comando              | Descripción                                                      |
|----------------------|------------------------------------------------------------------|
| `dev.unlockAll()`    | Desbloquea los 64 niveles en localStorage.                       |
| `dev.addCoins(n)`    | Suma `n` monedas via `GameCenter`. Avisa en modo standalone.     |
| `dev.skipLevel()`    | Fuerza victoria del nivel activo con 3 estrellas.                |

```js
// Ejemplos:
dev.unlockAll()       // → [Dev] ✅ 64 niveles desbloqueados.
dev.addCoins(1000)    // → [Dev] ✅ +1000 monedas añadidas via GameCenter.
dev.skipLevel()       // → [Dev] ✅ Saltando nivel lvl_5 con 3 estrellas.
```

---

## 13. Accesibilidad (WCAG 2.2)

### Atributos implementados

| Elemento                        | Atributo                  | Valor / propósito                                   |
|---------------------------------|---------------------------|-----------------------------------------------------|
| Capas decorativas (bg, grid…)   | `aria-hidden="true"`      | Oculta al lector de pantalla                        |
| Botones de solo-icono           | `aria-label`              | Descripción textual de la acción                    |
| Tarjetas de nivel desbloqueadas | `role="button"`, `tabindex="0"`, `aria-label` | Navegables por teclado |
| Tarjetas de nivel bloqueadas    | `role="img"`, `aria-disabled="true"` | Anunciadas como imagen bloqueada       |
| Modales                         | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` | Anunciados correctamente |
| HUD coins display               | `aria-live="polite"`      | Anuncia cambio de monedas sin interrumpir           |
| SVGs decorativos                | `aria-hidden="true"`      | Evita lectura de nombres de elemento SVG            |
| Texto solo para AT              | `.sr-only`                | Visible a lectores, invisible visualmente           |

### Foco visible (WCAG 2.4.11)

Todos los elementos interactivos tienen `:focus-visible` con `outline: 2px solid var(--accent)`.

### Tamaños táctiles (WCAG 2.5.5)

Todos los botones tienen `min-height: 48px` o `height: 48px`. Las tarjetas de nivel tienen `min-height: 112px`.

---

## 14. Guía de Mantenimiento y Expansión

### Agregar un nivel nuevo (dos pasos)

1. Subir imagen a Cloudinary: nombre `NivelNN` con cero a la izquierda si n < 10 (ej: `Nivel65`).
2. En `LevelManager.js`: `const TOTAL_LEVELS = 65;`

### Cambiar el tamaño de thumbnail

Modificar `buildThumbnailUrl()` en `LevelManager.js`. Regla: `anchoCSSMinimo × DPRmax × 1.07`.

Con tarjetas de 112px y DPR 2×: `112 × 2 × 1.07 ≈ 240px`. El valor actual `w_240` es el mínimo recomendado.

### Reactivar el límite de tiempo

```js
// LevelManager.js, dentro de loadLevels():
timeLimit: 350   // segundos; 0 = sin límite
```

### Diagnóstico de errores comunes

| Síntoma                                      | Causa probable                               | Solución                                             |
|----------------------------------------------|----------------------------------------------|------------------------------------------------------|
| Imagen de nivel no carga (pantalla infinita) | `publicId` incorrecto o asset no en Cloudinary | Verificar `Nivel${NN}` en cloud `dyspgn0sw`         |
| Error CORS en canvas                         | Falta `crossOrigin = 'Anonymous'`            | Ya corregido en `startGame()`; no revertir           |
| Thumbnails no aparecen (pantalla de niveles) | Observer desconectado o `data-src` no asignado | Verificar que `renderLevelsGrid` se llama correctamente |
| Tarjeta no responde al teclado              | `tabindex` o `role` faltante                  | Verificar UIController v4.0 o superior              |
| `dev.skipLevel()` no hace nada               | No hay nivel activo                          | Iniciar una partida antes de llamar al comando       |
| El audio no suena en iOS                     | Política de autoplay                         | Normal; el AudioContext se reanuda en el primer toque |