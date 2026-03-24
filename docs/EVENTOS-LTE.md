# 🎯 Sistema de Eventos LTE — Love Arcade
### Documentación técnica · v10.3

---

## Tabla de Contenidos

1. [Visión general](#1-visión-general)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Ciclo de vida y carga de datos](#3-ciclo-de-vida-y-carga-de-datos)
4. [isEventActive() — API global](#4-iseventactive--api-global)
5. [Tipos de evento soportados](#5-tipos-de-evento-soportados)
   - [coin_multiplier](#51-coin_multiplier)
   - [streak_boost](#52-streak_boost)
6. [Panel de control — events.json](#6-panel-de-control--eventsjson)
   - [Zona horaria en endDate (CRÍTICO)](#zona-horaria-en-enddate--crítico)
7. [Integración con app.js](#7-integración-con-appjs)
   - [completeLevel() — multiplicador de monedas](#71-completelevel--multiplicador-de-monedas)
   - [claimDaily() — boost de racha](#72-claimdaily--boost-de-racha)
   - [getStreakInfo() — previsualización en UI](#73-getstreakinfo--previsualización-en-ui)
8. [Sincronización y race condition](#8-sincronización-y-race-condition)
9. [Ciclo de vida de la vista](#9-ciclo-de-vida-de-la-vista)
10. [Añadir un nuevo tipo de evento](#10-añadir-un-nuevo-tipo-de-evento)
11. [Referencia de campos — events.json](#11-referencia-de-campos--eventsjson)
12. [Historial de cambios](#12-historial-de-cambios)

---

## 1. Visión general

El **Sistema de Eventos por Tiempo Limitado (LTE)** permite activar bonificaciones globales en Love Arcade editando únicamente el archivo `data/events.json`, sin tocar ningún archivo JavaScript.

Cada evento define:
- Su **tipo** (multiplicador de monedas, boost de racha…).
- Su **fecha de expiración** (con offset de zona horaria explícito).
- Sus **metadatos visuales** (icono, color de acento).

La lógica de negocio en `app.js` consulta el sistema de forma síncrona a través de `isEventActive(id)` para aplicar los efectos en el momento exacto en que ocurren (completar un nivel, reclamar el bono diario).

---

## 2. Arquitectura del sistema

```
data/events.json          ← Panel de control (sin tocar JS)
        │
        │ fetch (inmediato al cargar el módulo)
        ▼
event-logic.js            ← Módulo LTE
  ├── _loadEvents()       ← Carga, cacheo en memoria Y escritura en localStorage
  ├── isEventActive(id)   ← API síncrona (usa caché de memoria)
  ├── _formatTimeLeft()   ← Formato h + min exacto (v10.3)
  ├── _renderEventsView() ← UI de la vista #view-events
  ├── setInterval 60 s    ← Countdown en vivo (v10.3)
  └── window.EventView    ← Ciclo de vida SPA
        │
        │  ① window.isEventActive (global — implementación real)
        │  ② localStorage['love_arcade_events_v1'] (caché para juegos externos)
        ▼
app.js — GameCenter
  ├── isEventActive stub  ← Lee localStorage cuando event-logic.js no está
  ├── completeLevel()     ← Lee coin_invasion_v1
  └── claimDaily()        ← Lee streak_boost_v1

games/*.html              ← Juegos externos (sin event-logic.js)
  └── app.js stub         ← Lee el caché de localStorage ✅ (fix v10.2)
```

**Principio de separación:** `app.js` nunca lee `events.json` directamente. Solo llama a `isEventActive(id)` — ya sea la implementación real (hub) o el stub con caché (juegos externos).

---

## 3. Ciclo de vida y carga de datos

### Inicio inmediato (fix race condition — v10.1)

`event-logic.js` invoca `_loadEvents()` en el momento en que el módulo se **parsea**, no dentro de `DOMContentLoaded`. Esto maximiza el tiempo disponible para que el fetch resuelva antes de que el usuario complete su primera partida.

```
Script parseado
      │
      ├─ fetch('data/events.json') — INMEDIATO
      │         │
      │         └── Resuelve → _eventsCache = data
      │                        localStorage['love_arcade_events_v1'] = { data, ts }
      │                        window.isEventActive = implementación real
      │
DOMContentLoaded
      │
      └── Usuario juega → completeLevel() → isEventActive('coin_invasion_v1')
                                                    │
                                                    └── Usa _eventsCache ✅
```

### Caché en localStorage para juegos externos (v10.2)

Los juegos externos (`games/*.html`) cargan `app.js` pero no `event-logic.js`. Antes de v10.2, el stub de `isEventActive` en `app.js` siempre devolvía `false`, impidiendo que el multiplicador de monedas se aplicara en esos contextos.

A partir de v10.2, `event-logic.js` persiste los datos cargados en `localStorage['love_arcade_events_v1']` con un timestamp. El stub de `app.js` lee este caché si está disponible y no ha expirado (TTL: 24 horas):

```
Hub (index.html)                    Juego externo (games/word-hunt.html)
─────────────────                   ─────────────────────────────────────
event-logic.js carga                app.js carga
  → fetch('data/events.json')         → isEventActive stub definido
  → _eventsCache = data               → stub lee localStorage ✅
  → localStorage.setItem(…)           → multiplicador aplicado ✅
  → isEventActive = impl. real
```

El usuario debe haber visitado el hub **al menos una vez** antes de jugar para que el caché exista. En la primera visita al juego externo sin caché, el stub devuelve `false` de forma conservadora (sin multiplicador).

### Caché en memoria

`_eventsCache` es un objeto en memoria dentro de `event-logic.js`. Una vez cargado, `isEventActive()` es completamente síncrona y sin coste de red ni I/O.

### Stub de seguridad

`app.js` define el stub antes de que `event-logic.js` cargue. Garantiza que nunca se lanzará un `ReferenceError` aunque los módulos carguen en orden inesperado.

---

## 4. isEventActive() — API global

```js
/**
 * @param {string} eventId  ID del evento a comprobar.
 * @returns {boolean}       true si el evento existe, no ha expirado y el caché está listo.
 */
window.isEventActive(eventId)
```

**Reglas (implementación real — event-logic.js, contexto hub):**
- Devuelve `false` si el caché en memoria aún no ha cargado (modo conservador).
- Devuelve `false` si `endDate` ya pasó, aunque el evento exista en el JSON.
- Es síncrona — no devuelve una Promise.
- Disponible globalmente para cualquier minijuego integrado.

**Reglas (stub con caché — app.js, contexto juego externo):**
- Lee `localStorage['love_arcade_events_v1']` si existe y tiene menos de 24 horas.
- Misma lógica de expiración por `endDate`.
- Devuelve `false` si el caché no existe, está expirado o está malformado.

---

## 5. Tipos de evento soportados

### 5.1 `coin_multiplier`

Multiplica las monedas otorgadas por **todos** los minijuegos durante la vigencia del evento.

| Campo         | Descripción                                | Ejemplo     |
|---------------|--------------------------------------------|-------------|
| `type`        | Identificador del tipo                     | `"coin_multiplier"` |
| `multiplier`  | Factor de multiplicación (float)           | `1.5`       |
| `id`          | Debe ser `"coin_invasion_v1"` para activar | —           |

**Efecto en código:**
```js
// app.js — completeLevel()
if (window.isEventActive('coin_invasion_v1')) {
    finalAmount = Math.floor(rewardAmount * 1.5);
}
```

El multiplicador exacto se toma del campo `multiplier` del evento en `events.json`. Si se desea un factor diferente (ej: ×2), cambiar el `multiplier` en el JSON **y** actualizar el valor hardcodeado en `completeLevel()` en `app.js`.

> **Nota técnica:** actualmente el factor `1.5` está hardcodeado en `app.js`. Una mejora futura sería leer `_eventsCache` directamente desde `completeLevel()` para tomar el multiplier dinámicamente.

---

### 5.2 `streak_boost`

Incrementa en +2 (en lugar de +1) el contador de racha por cada reclamo del bono diario exitoso.

| Campo  | Descripción                                | Ejemplo     |
|--------|--------------------------------------------|-------------|
| `type` | Identificador del tipo                     | `"streak_boost"` |
| `id`   | Debe ser `"streak_boost_v1"` para activar  | —           |

**Efecto en código:**
```js
// app.js — claimDaily()
const streakBoost = window.isEventActive('streak_boost_v1') ? 2 : 1;
const newStreak   = diffDays === 1 ? streak + streakBoost : 1;
```

**Regla de reinicio:** si el usuario falta un día, la racha se reinicia a 1 **independientemente** de si el boost está activo o no. El boost solo afecta al incremento por día consecutivo, no al reinicio.

**Previsualización en UI:** `getStreakInfo()` también consulta `isEventActive('streak_boost_v1')` para que el HUD muestre el `nextReward` correcto cuando el boost está activo.

---

## 6. Panel de control — events.json

Ubicación: `data/events.json`

Este archivo es el **único punto de control** para activar, desactivar o modificar eventos. No requiere tocar ningún archivo JavaScript.

### Estructura base

```json
{
  "activeEvents": [
    {
      "id":          "coin_invasion_v1",
      "type":        "coin_multiplier",
      "multiplier":  1.5,
      "title":       "Invasión de Monedas",
      "subtitle":    "×1.5 en todos los juegos",
      "description": "Descripción corta (no se muestra en la UI actual).",
      "endDate":     "2026-06-30T23:59:59-06:00",
      "icon":        "zap",
      "accentColor": "#00d4ff"
    }
  ]
}
```

---

### Zona horaria en `endDate` — CRÍTICO

> ⚠️ **Este es el punto de error más común al configurar eventos.**

El campo `endDate` debe incluir siempre el **offset de zona horaria explícito** correspondiente a la hora local de referencia del evento.

#### ¿Por qué importa?

`Date.parse()` en JavaScript interpreta cadenas ISO 8601 terminadas en `Z` como UTC. Si el evento debe terminar a las 23:59 hora de México (UTC-6) pero `endDate` está definido como `"2026-03-23T23:59:59Z"`, el sistema lo cerrará a las **17:59 hora local** — 6 horas antes de lo esperado. El countdown también mostrará menos tiempo del real por la misma razón.

#### Regla de oro

```
❌  "2026-03-23T23:59:59Z"         → Expira a las 17:59 en México (UTC-6)
✅  "2026-03-23T23:59:59-06:00"    → Expira a las 23:59 en México (UTC-6)
```

#### Offsets de referencia

| Zona horaria                              | Offset   |
|-------------------------------------------|----------|
| México (CDMX, Guadalajara, Monterrey)     | `-06:00` |
| España (Península)                        | `+01:00` |
| UTC / GMT                                 | `+00:00` |
| EST — Nueva York                          | `-05:00` |
| PST — Los Ángeles                         | `-08:00` |

> **Nota:** México abolió el horario de verano en 2023 para la mayor parte del territorio. La zona horaria central (CDMX) es UTC-6 de forma permanente durante todo el año.

#### ¿Qué ocurre internamente?

La comparación en `isEventActive()` y `_formatTimeLeft()` opera sobre timestamps UTC puros (`getTime()`). El resultado es exacto siempre que `endDate` lleve offset explícito:

```js
// isEventActive — event-logic.js
return Date.now() < new Date(ev.endDate).getTime();

// Con "2026-03-23T23:59:59-06:00":
//   Date.now()                        → ms UTC actuales
//   new Date("…-06:00").getTime()     → ms UTC de las 23:59 en UTC-6
//   Resultado: expira exactamente a las 23:59 hora de México ✅
```

---

### Activar un evento

Agregar el objeto al array `activeEvents` con una `endDate` futura con offset explícito.

### Desactivar un evento

Dos opciones equivalentes:
1. **Eliminar** el objeto del array.
2. **Cambiar `endDate`** a una fecha pasada (ej: `"2020-01-01T00:00:00-06:00"`).

### Cambiar la duración

Modificar el campo `endDate` con el nuevo timestamp en formato ISO 8601 con offset explícito.

---

## 7. Integración con app.js

### 7.1 `completeLevel()` — multiplicador de monedas

```js
GameCenter.completeLevel(gameId, levelId, rewardAmount)
```

Flujo interno cuando `coin_invasion_v1` está activo:

```
rewardAmount (del juego)
        │
        ▼
isEventActive('coin_invasion_v1') === true
        │
        ▼
finalAmount = Math.floor(rewardAmount × 1.5)
        │
        ▼
store.coins += finalAmount
logTransaction('ingreso', finalAmount, '... [×1.5 Invasión de Monedas]')
```

El resultado de `completeLevel()` incluye `{ multiplied: boolean }` para que el juego pueda mostrar feedback visual si lo desea.

### 7.2 `claimDaily()` — boost de racha

```js
GameCenter.claimDaily()  // → { success, reward, streak, streakBoosted?, ... }
```

Flujo con `streak_boost_v1` activo:

```
Usuario reclama bono diario
        │
        ▼
diffDays === 1 (día consecutivo)
        │
        ▼
streakBoost = isEventActive('streak_boost_v1') ? 2 : 1
newStreak   = streak + streakBoost    // ej: 3 + 2 = 5
        │
        ▼
baseReward = min(dailyReward + (newStreak−1) × dailyStreakStep, dailyStreakCap)
           = min(20 + 4×5, 60) = min(40, 60) = 40 monedas
```

### 7.3 `getStreakInfo()` — previsualización en UI

```js
const info = GameCenter.getStreakInfo();
// {
//   streak:        number,   — racha actual
//   nextReward:    number,   — monedas que dará el próximo reclamo
//   canClaim:      boolean,  — si hoy se puede reclamar
//   streakBoosted: boolean   — si el boost está activo (v10.1)
// }
```

El campo `streakBoosted` permite a la UI mostrar un indicador visual cuando el boost está activo, sin necesidad de llamar a `isEventActive()` directamente desde el HTML.

---

## 8. Sincronización y race condition

### El problema original (pre-v10.1)

En v10.0, `_loadEvents()` se lanzaba dentro de `DOMContentLoaded`. Si un usuario completaba un nivel antes de que el fetch resolviera, `isEventActive()` devolvería `false` (stub) y el multiplicador no se aplicaría.

### Solución de race condition (v10.1)

`_loadEvents()` se invoca **inmediatamente al parsear el módulo**. El fetch se lanza en paralelo mientras el navegador termina de analizar el HTML.

### Problema en juegos externos (pre-v10.2)

Los juegos en `games/*.html` cargan `app.js` en su propio contexto de página pero no cargan `event-logic.js`. El stub de `isEventActive` en `app.js` devolvía siempre `false`, por lo que `completeLevel()` nunca aplicaba el multiplicador en esos contextos.

### Solución para juegos externos (v10.2)

`event-logic.js` escribe los datos de eventos en `localStorage` tras cada carga exitosa. El stub de `app.js` lee ese caché:

```
isEventActive stub (app.js — juego externo)
        │
        ├── localStorage['love_arcade_events_v1'] existe y < 24h?
        │         │ sí
        │         └── data.activeEvents.find(e.id === eventId)
        │                     │
        │                     └── Date.now() < new Date(e.endDate) → boolean
        │
        └── no → false (conservador)
```

### Caso sin conexión / primera visita

Si el fetch falla, `_eventsCache = { activeEvents: [] }` y el caché de localStorage no se actualiza. `isEventActive()` devuelve `false` para todos los eventos. El juego funciona con normalidad, sin multiplicadores.

---

## 9. Ciclo de vida de la vista

`event-logic.js` expone `window.EventView` para integrarse con el SPA router:

```js
window.EventView = {
    onEnter(),  // Llamado por spa-router.js al navegar a #view-events
    onLeave()   // Llamado al salir de la vista — cancela el countdown en vivo
}
```

### `onEnter()`

1. Si es la primera visita, muestra un skeleton de carga.
2. Llama a `_loadEvents()` (que devuelve el caché si ya está disponible).
3. Llama a `_renderEventsView()` con los datos.
4. **[v10.3]** Inicia un `setInterval` de 60 segundos que re-renderiza la vista automáticamente para mantener el countdown exacto sin recargar la página.

Las visitas subsiguientes **no** muestran skeleton porque `_rendered = true`; la vista se re-renderiza directamente con el caché disponible.

### `onLeave()`

**[v10.3]** Cancela el `setInterval` del countdown via `clearInterval()`. Esto evita que se acumulen timers activos mientras la vista no es visible y que el DOM se actualice en segundo plano innecesariamente.

---

## 10. Añadir un nuevo tipo de evento

### Paso 1 — Definir en `events.json`

```json
{
  "id":          "mi_evento_v1",
  "type":        "mi_tipo",
  "title":       "Nombre del evento",
  "subtitle":    "Descripción corta",
  "endDate":     "2026-09-01T23:59:59-06:00",
  "icon":        "sparkles",
  "accentColor": "#a855f7"
}
```

> Recuerda incluir el offset de zona horaria en `endDate`. Ver §6 — Zona horaria en endDate.

### Paso 2 — Registrar metadatos visuales en `event-logic.js`

```js
// EVENT_META en event-logic.js
const EVENT_META = {
    // ...existentes...
    mi_tipo: {
        icon:        'sparkles',
        color:       '#a855f7',
        colorSoft:   'rgba(168, 85, 247, 0.12)',
        colorBorder: 'rgba(168, 85, 247, 0.28)',
        gradStart:   '#a855f7',
        getEffect:   (ev) => 'Descripción del efecto'
    }
};
```

### Paso 3 — Implementar el efecto en `app.js`

```js
// Ejemplo: si el tipo aplica un descuento en la tienda
if (window.isEventActive('mi_evento_v1')) {
    // aplicar lógica aquí
}
```

### Paso 4 — Usar un ID descriptivo y versionado

Convención: `{slug_tipo}_{variante}_v{N}`. Ejemplos: `coin_invasion_v2`, `flash_sale_v1`.

---

## 11. Referencia de campos — events.json

| Campo         | Tipo     | Requerido | Descripción |
|---------------|----------|-----------|-------------|
| `id`          | string   | ✅        | Identificador único del evento. El código en `app.js` compara contra este valor. |
| `type`        | string   | ✅        | Tipo de evento: `coin_multiplier`, `streak_boost` (o custom). |
| `title`       | string   | ✅        | Nombre visible en la tarjeta de evento. |
| `subtitle`    | string   | —         | Texto secundario (no visible en la UI actual; reservado). |
| `description` | string   | —         | Descripción larga (no visible en la UI actual). |
| `endDate`     | ISO 8601 | ✅        | Fecha y hora de expiración **con offset de zona horaria explícito**. Ejemplo: `"2026-12-31T23:59:59-06:00"`. ⚠️ No usar `Z` si la hora de referencia es local. Ver §6. |
| `icon`        | string   | —         | Nombre del icono del sprite SVG (sin prefijo `icon-`). Default: `sparkles`. |
| `accentColor` | string   | —         | Color CSS del acento visual (hex, rgb, etc.). |
| `multiplier`  | number   | ⚠️        | Solo para `coin_multiplier`. Factor de multiplicación. Default implícito: `1.5`. |

> ⚠️ El campo `multiplier` es leído por la UI para mostrar el efecto, pero el valor aplicado en `app.js` actualmente está hardcodeado a `1.5`. Ver nota en §5.1.

---

## 12. Historial de cambios

| Versión | Cambio |
|---------|--------|
| **v10.3** | [FIX CRÍTICO] Eventos que expiraban antes de tiempo: la causa raíz era el uso del sufijo `Z` (UTC) en `endDate` sin offset de zona horaria. Para un servidor en UTC-6, esto provocaba que los eventos cerraran 6 horas antes de lo esperado y que el countdown mostrara menos tiempo del real. Corrección aplicada en `events.json` (offset `-06:00` explícito). Documentación de la convención de zona horaria añadida en §6. [FIX] `_formatTimeLeft()` reescrita: ahora muestra horas y minutos combinados cuando quedan menos de 24 h (p.ej. "5 h 42 min" en lugar de solo "5 h"), eliminando la ambigüedad visual de tiempo restante. Eliminado el caso "Mañana" que ocultaba la cantidad exacta de horas. [MEJORA] Countdown en vivo: `onEnter()` inicia un `setInterval` de 60 s que re-renderiza la vista de eventos. `onLeave()` lo cancela con `clearInterval()` para no acumular timers en navegación entre vistas. |
| **v10.2** | [FIX] Multiplicador de monedas en juegos externos: `event-logic.js` persiste los eventos en `localStorage['love_arcade_events_v1']` tras cada carga exitosa. El stub de `app.js` ahora lee ese caché en lugar de devolver siempre `false`. Los juegos en `games/*.html` aplican correctamente el multiplicador ×1.5 y el boost de racha. TTL del caché: 24 horas. Rediseño completo de la vista de eventos: tarjetas tipo "banner de evento" con fondo degradado por tipo, elementos decorativos flotantes, valor del efecto en tipografía gigante (×1.5 / +2), badge EN VIVO animado, descripción del efecto. Rejilla de 2 columnas en tablet (≥ 640px). Texto completo en español; "Hot Streak Weekend" renombrado a "Fin de Semana de Racha". |
| **v10.1** | Eliminación completa del Gachapón. Carga de `events.json` movida al parse del módulo (fix race condition). `getStreakInfo()` actualizado para reflejar el boost de racha. Nueva UI de tarjetas LTE. |
| **v10.0** | Lanzamiento del sistema LTE. Integración de `coin_invasion_v1` en `completeLevel()` y `streak_boost_v1` en `claimDaily()`. |

---

*Documentación mantenida por el equipo de Love Arcade · v10.3*