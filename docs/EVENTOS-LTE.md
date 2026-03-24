# 🎯 Sistema de Eventos LTE — Love Arcade
### Documentación técnica · v10.2

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
- Su **fecha de expiración**.
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
  ├── _renderEventsView() ← UI de la vista #view-events
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
      │                        localStorage['love_arcade_events_v1'] = { data, ts }  ← v10.2
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
      "endDate":     "2026-06-30T00:00:00Z",
      "icon":        "zap",
      "accentColor": "#00d4ff"
    }
  ]
}
```

### Activar un evento

Agregar el objeto al array `activeEvents` con una `endDate` futura.

### Desactivar un evento

Dos opciones equivalentes:
1. **Eliminar** el objeto del array.
2. **Cambiar `endDate`** a una fecha pasada (ej: `"2020-01-01T00:00:00Z"`).

### Cambiar la duración

Modificar el campo `endDate` a la fecha deseada en formato ISO 8601 UTC.

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
    onLeave()   // Llamado al salir de la vista (sin recursos que liberar actualmente)
}
```

### `onEnter()`

1. Si es la primera visita, muestra un skeleton de carga.
2. Llama a `_loadEvents()` (que devuelve el caché si ya está disponible).
3. Llama a `_renderEventsView()` con los datos.

Las visitas subsiguientes **no** muestran skeleton porque `_rendered = true`; la vista se re-renderiza directamente con el caché disponible.

---

## 10. Añadir un nuevo tipo de evento

### Paso 1 — Definir en `events.json`

```json
{
  "id":          "mi_evento_v1",
  "type":        "mi_tipo",
  "title":       "Nombre del evento",
  "subtitle":    "Descripción corta",
  "endDate":     "2026-09-01T00:00:00Z",
  "icon":        "sparkles",
  "accentColor": "#a855f7"
}
```

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
| `endDate`     | ISO 8601 | ✅        | Fecha y hora de expiración en UTC. Ejemplo: `"2026-12-31T00:00:00Z"`. |
| `icon`        | string   | —         | Nombre del icono del sprite SVG (sin prefijo `icon-`). Default: `sparkles`. |
| `accentColor` | string   | —         | Color CSS del acento visual (hex, rgb, etc.). |
| `multiplier`  | number   | ⚠️        | Solo para `coin_multiplier`. Factor de multiplicación. Default implícito: `1.5`. |

> ⚠️ El campo `multiplier` es leído por la UI para mostrar el efecto, pero el valor aplicado en `app.js` actualmente está hardcodeado a `1.5`. Ver nota en §5.1.

---

## 12. Historial de cambios

| Versión | Cambio |
|---------|--------|
| **v10.2** | [FIX] Multiplicador de monedas en juegos externos: `event-logic.js` persiste los eventos en `localStorage['love_arcade_events_v1']` tras cada carga exitosa. El stub de `app.js` ahora lee ese caché en lugar de devolver siempre `false`. Los juegos en `games/*.html` aplican correctamente el multiplicador ×1.5 y el boost de racha. TTL del caché: 24 horas. Rediseño completo de la vista de eventos: tarjetas tipo "banner de evento" con fondo degradado por tipo, elementos decorativos flotantes, valor del efecto en tipografía gigante (×1.5 / +2), badge EN VIVO animado, descripción del efecto. Rejilla de 2 columnas en tablet (≥ 640px). Texto completo en español; "Hot Streak Weekend" renombrado a "Fin de Semana de Racha". |
| **v10.1** | Eliminación completa del Gachapón. Carga de `events.json` movida al parse del módulo (fix race condition). `getStreakInfo()` actualizado para reflejar el boost de racha. Nueva UI de tarjetas LTE. |
| **v10.0** | Lanzamiento del sistema LTE. Integración de `coin_invasion_v1` en `completeLevel()` y `streak_boost_v1` en `claimDaily()`. |

---

*Documentación mantenida por el equipo de Love Arcade · v10.2*