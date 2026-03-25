# 🎯 Sistema de Eventos LTE — Love Arcade
### Documentación técnica · v11.1

---

## Tabla de Contenidos

1. [Visión general](#1-visión-general)
2. [Arquitectura del sistema](#2-arquitectura-del-sistema)
3. [Ciclo de vida y carga de datos](#3-ciclo-de-vida-y-carga-de-datos)
4. [isEventActive() — API global](#4-iseventactive--api-global)
5. [Tipos de evento soportados](#5-tipos-de-evento-soportados)
6. [Panel de control — events.json](#6-panel-de-control--eventsjson)
7. [Integración con app.js](#7-integración-con-appjs)
8. [Sincronización y race condition](#8-sincronización-y-race-condition)
9. [Ciclo de vida de la vista](#9-ciclo-de-vida-de-la-vista)
10. [Añadir un nuevo tipo de evento](#10-añadir-un-nuevo-tipo-de-evento)
11. [Referencia de campos — events.json](#11-referencia-de-campos--eventsjson)
12. [Balance y economía de eventos](#12-balance-y-economía-de-eventos)
13. [Historial de cambios](#13-historial-de-cambios)

---

## 1. Visión general

El **Sistema de Eventos por Tiempo Limitado (LTE)** permite activar bonificaciones globales en Love Arcade editando únicamente `data/events.json`, sin tocar ningún archivo JavaScript. Cada evento define su tipo, fechas de inicio/fin en hora LOCAL del dispositivo, metadatos visuales y configuración de mecánica.

---

## 2. Arquitectura del sistema

```
data/events.json
        │ fetch inmediato al parsear el módulo
        ▼
event-logic.js
  ├── _loadEvents()         Carga, cacheo memoria + localStorage
  ├── isEventActive(id)     API síncrona sobre caché en memoria
  ├── _initHunt()           Inyecta objetos de cacería en el DOM
  ├── _spinGacha()          Giro con límite diario y balance corregido
  ├── _showGachaRoulette()  Modal slot machine (overlay fijo)
  ├── _renderEventsView()   UI de #view-events
  ├── setInterval 60 s      Countdown en vivo
  └── window.EventView      Ciclo de vida SPA

app.js — GameCenter
  ├── isEventActive stub    Lee localStorage si event-logic.js no está
  ├── completeLevel()       Aplica coin_invasion_v1
  ├── claimDaily()          Aplica streak_boost_v1
  ├── spendCoins()          Cobro del costo del Gachapón
  └── addCoins()            Entrega de recompensas (Cacería, Gachapón)
```

---

## 3. Ciclo de vida y carga de datos

`_loadEvents()` se invoca **al parsear el módulo** (no en DOMContentLoaded) para maximizar el tiempo disponible antes de la primera partida. Escribe el resultado en `localStorage['love_arcade_events_v1']` para que los juegos externos (`games/*.html`) también puedan leer el estado de los eventos.

---

## 4. isEventActive() — API global

```js
window.isEventActive(eventId) // → boolean
```

- Síncrona, sin Promise.
- `false` si el caché aún no cargó o el evento no está en `[startDate, endDate]`.
- Las fechas sin sufijo de zona horaria se interpretan como **hora LOCAL del dispositivo**.

---

## 5. Tipos de evento soportados

### 5.1 `coin_multiplier`

Multiplica las monedas de todos los minijuegos. Requiere `id: "coin_invasion_v1"` para activarse en `completeLevel()`.

### 5.2 `streak_boost`

Incrementa en +2 el contador de racha del bono diario. Requiere `id: "streak_boost_v1"`.

### 5.3 `interactive_hunt` — Cacería de Tesoros

Inyecta objetos flotantes (`.treasure-item`) en elementos del DOM. El jugador hace clic para recolectarlos y al completar todos recibe la recompensa.

**Campos de `config`:**

| Campo       | Tipo     | Descripción                                     | Default |
|-------------|----------|-------------------------------------------------|---------|
| `itemEmoji` | string   | Emoji del objeto                                | `"⭐"`  |
| `anchors`   | string[] | Selectores CSS de los contenedores de inyección | `[]`    |
| `total`     | number   | Número de objetos a encontrar                   | `5`     |
| `reward`    | number   | Monedas al completar                            | `500`   |

**[v11.1] Corrección de inyección:**

En versiones anteriores, los selectores ausentes en el DOM contabilizaban como items inyectados, resultando en menos items visibles que los configurados. En v11.1:

- Los selectores ausentes se **omiten sin penalización**.
- Se usa `HUNT_FALLBACK_ANCHORS` (lista de selectores estáticos garantizados) para completar siempre el número `total` de items.
- Items posicionados en **cuadrantes alternos** dentro de cada contenedor.
- Algunos items se inyectan en la **vista de Tienda** (requiere navegar para encontrarlos).

Orden de inyección:
1. Selectores en `config.anchors` de `events.json`
2. Fallbacks: `.game-card:nth-child(3/6/9)`, `#faq details:nth-child(2/5)`, `#view-shop .promo-toggle-wrap`, `#view-shop .shop-tabs`, `.player-hud .hud-streak`

### 5.4 `gacha_flash` — Gachapón Relámpago

Tirada de azar: el jugador gasta monedas y gana una recompensa aleatoria.

**Campos de `config`:**

| Campo       | Tipo   | Descripción                    | Default |
|-------------|--------|--------------------------------|---------|
| `cost`      | number | Costo por tirada               | `50`    |
| `minReward` | number | Recompensa mínima              | `10`    |
| `maxReward` | number | Recompensa máxima (jackpot)    | `1000`  |

**[v11.1] Novedades:**

- **Límite diario de 5 tiradas** por evento. Clave: `localStorage['la_gacha_daily_{eventId}']` con `{date, spins}`. Se resetea automáticamente al cambiar de día.
- **Anti-spam:** flag `_gachaAnimating` desactiva el botón durante la animación del modal.
- **Modal de ruleta tipo slot machine:** overlay fijo con números animados que aterrizan en el resultado. Cierre por botón / clic en fondo / tecla Escape.
- **Balance corregido:** VE ≈ 64 monedas/tirada (antes ≈ 278). Net +14/tirada vs costo 50. Ver §12.

### 5.5 `personal_milestone` — Hito Personal

Activa un multiplicador temporal al completar N partidas en un día.

**Campos de `config`:**

| Campo                  | Tipo   | Descripción                        | Default       |
|------------------------|--------|------------------------------------|---------------|
| `target`               | number | Partidas necesarias                | `5`           |
| `multiplier`           | number | Factor del multiplicador           | `2`           |
| `multiplierDurationMs` | number | Duración del multiplicador (ms)    | `3_600_000`   |

### 5.6 `daily_missions` — Misiones del Día

Panel de misiones con barra de progreso y botón de reclamación. Se reinicia a medianoche.

**Campos de `config.missions[]`:**

| Campo    | Tipo   | Descripción                                        |
|----------|--------|----------------------------------------------------|
| `id`     | string | ID único para idempotencia                         |
| `type`   | string | `"playtime"` (segundos) o `"games_played"` (count) |
| `label`  | string | Texto visible al jugador                           |
| `target` | number | Objetivo (segundos o partidas)                     |
| `reward` | number | Monedas al reclamar                                |

---

## 6. Panel de control — events.json

### Zona horaria en endDate (CRÍTICO)

Las fechas **NO deben incluir sufijo de zona horaria**. Sin sufijo, `new Date(dateStr)` interpreta la fecha como **hora LOCAL del dispositivo**.

```json
// ✅ CORRECTO — hora local del jugador
"startDate": "2026-03-24T00:00:00",
"endDate":   "2026-03-31T23:59:59"

// ❌ INCORRECTO — UTC fijo o con offset explícito
"endDate": "2026-03-31T23:59:59Z"
"endDate": "2026-03-31T23:59:59-06:00"
```

---

## 7. Integración con app.js

```js
// completeLevel() — multiplicador de monedas
if (window.isEventActive('coin_invasion_v1')) {
    finalAmount = Math.floor(rewardAmount * 1.5);
}

// claimDaily() — boost de racha
const streakBoost = window.isEventActive('streak_boost_v1') ? 2 : 1;

// Gachapón usa la API pública de GameCenter
window.GameCenter.spendCoins(cost, `Gachapón: ${eventId}`);
window.GameCenter.addCoins(reward, `Gachapón Relámpago: ${eventId}`);
```

---

## 8. Sincronización y race condition

El fetch se lanza al parsear el módulo. Si el usuario completa una partida antes de que el fetch resuelva, `isEventActive()` devuelve `false` conservadoramente (un JSON pequeño resuelve en milisegundos en la práctica).

Para juegos externos, el stub de `app.js` lee el caché de `localStorage`. El usuario debe haber visitado el hub al menos una vez para que el caché exista (TTL: 24 h).

---

## 9. Ciclo de vida de la vista

```js
window.EventView = { onEnter(), onLeave() }
```

`onEnter()` — skeleton en primera visita, carga datos, renderiza, inicia setInterval (60 s).  
`onLeave()` — cancela el setInterval con `clearInterval()`.

---

## 10. Añadir un nuevo tipo de evento

**Paso 1** — Añadir en `events.json` con campos `id`, `type`, `startDate`, `endDate`, `config`, `ui`.

**Paso 2** — Registrar en `EVENT_META` dentro de `event-logic.js`:

```js
mi_tipo: {
    color: '#a855f7', colorDim: 'rgba(168,85,247,0.14)',
    colorBorder: 'rgba(168,85,247,0.38)', colorGlow: 'rgba(168,85,247,0.18)',
    gradientBg: 'linear-gradient(150deg,#0c0014 0%,#160a28 60%,...)',
    artEmojis: ['✨','🌟','💫','✨'],
    getHeroValue: ev => 'Valor destacado',
    getShortDesc:  ev => ev.ui?.description || 'Descripción.'
}
```

**Paso 3** — Añadir `case 'mi_tipo': return _renderMiTipoCard(event, meta);` en `_renderEventCard()`.

**Paso 4** — Implementar `_renderMiTipoCard()` y, si aplica, el efecto en `app.js`.

---

## 11. Referencia de campos — events.json

| Campo           | Tipo     | Req. | Descripción |
|-----------------|----------|------|-------------|
| `id`            | string   | ✅   | Identificador único del evento. |
| `type`          | string   | ✅   | Tipo de evento (ver §5). |
| `startDate`     | ISO 8601 | ✅   | Sin sufijo de zona horaria. Hora LOCAL. |
| `endDate`       | ISO 8601 | ✅   | Sin sufijo de zona horaria. Hora LOCAL. |
| `config`        | object   | ⚠️   | Parámetros de mecánica. Estructura según `type`. |
| `ui.title`      | string   | —    | Nombre visible en la tarjeta. |
| `ui.subtitle`   | string   | —    | Texto secundario. |
| `ui.description`| string   | —    | Descripción larga en la tarjeta. |
| `ui.accentColor`| string   | —    | Color CSS del acento. |
| `ui.icon`       | string   | —    | Nombre del icono SVG (sin prefijo `icon-`). |

---

## 12. Balance y economía de eventos

### Gachapón Relámpago (config por defecto: cost 50, min 10, max 1000)

| Tier | Rango      | Prob.  | VE parcial |
|------|------------|--------|------------|
| 1    | [10, ~35]  | 55 %   | ~12 🪙     |
| 2    | [~35, ~90] | 30 %   | ~19 🪙     |
| 3    | [~90, ~250]| 12 %   | ~20 🪙     |
| 4    | [~250, ~500]| 2.5 % | ~9 🪙      |
| 5    | [~500, 1000]| 0.5 % | ~4 🪙      |
| **Total** |       |        | **~64 🪙** |

- Costo: 50 🪙 → **ganancia neta esperada ≈ +14 🪙/tirada**
- Límite 5 tiradas/día → **ganancia neta máxima esperada ≈ 70 🪙/día**
- Jackpot (≥ 500 🪙): **0.5 % de probabilidad**

Para ajustar el balance sin tocar el código, modificar `minReward` y `maxReward` en `events.json` — los tiers se recalculan proporcialmente. Para ajustes finos de probabilidad, editar `_rollGachaReward()` en `event-logic.js`.

### Cacería de Tesoros

- Recompensa típica: **500 🪙** al completar los 5 items.
- Una sola vez por período de evento.

### Hito Personal

- Buff ×2 durante 1 hora al completar 5 partidas en un día.

### Misiones del Día

- Recompensas típicas: 100–150 🪙 por misión. Recurrencia: diaria.

---

## 13. Historial de cambios

| Versión | Cambio |
|---------|--------|
| **v11.1** | [FIX CRÍTICO] Cacería: selectores ausentes ya no penalizan el contador de inyecciones. Se añade `HUNT_FALLBACK_ANCHORS` para garantizar siempre `total` items. [FIX] Cacería: posicionamiento por cuadrantes alternos, items en vista de Tienda. [FIX CRÍTICO] Gachapón: límite de 5 tiradas diarias con persistencia en `localStorage`. [FIX] Gachapón: `_gachaAnimating` previene spam durante la animación. [MEJORA] Gachapón: modal de ruleta tipo slot machine (overlay fijo, no interfiere con el layout de eventos). [BALANCE] Gachapón: probabilidades reequilibradas, VE ≈ 64 vs costo 50 (anterior VE ≈ 278). |
| **v11.0** | Motor completo: interactive_hunt, personal_milestone, gacha_flash, daily_missions. Countdown en vivo 60 s. Ciclo de vida SPA. |
| **v10.3** | Fechas naive local time (sin sufijo de zona horaria). `_formatTimeLeft()` muestra horas + minutos. |
| **v10.2** | Caché en localStorage para juegos externos. Rediseño visual de tarjetas LTE. |
| **v10.1** | Carga de events.json al parsear el módulo (fix race condition). |
| **v10.0** | Lanzamiento del sistema LTE. `coin_invasion_v1`, `streak_boost_v1`. |

---

*Documentación mantenida por el equipo de Love Arcade · v11.1*