# Love Arcade

**Plataforma de minijuegos con economía de recompensas, tienda de wallpapers y sistema de rachas diarias.**

---

## ¿Qué es?

Love Arcade es un Game Hub web donde cada partida genera **Monedas** que se acumulan en un saldo persistente. Con ese saldo las usuarias pueden canjear wallpapers exclusivos en la tienda integrada, activar el buff de Bendición Lunar y participar en eventos especiales con descuentos y cashback.

Todo corre en el navegador. Sin backend, sin cuentas, sin instalación.

---

## Stack

| Capa | Tecnología |
|---|---|
| UI / Vistas | HTML5 · CSS3 (custom properties, Grid, transitions GPU) |
| Lógica de negocio | Vanilla JavaScript ES2020+ (módulos sin bundler) |
| Persistencia | `localStorage` con checksum SHA-256 (integridad de partida) |
| Encoding asíncrono | Web Worker (`sync-worker.js`) con `TextEncoder` / `TextDecoder` |
| Imágenes | Cloudinary CDN (transformaciones `f_auto`, `q_auto`, `c_fill`) |
| Routing | SPA custom (`spa-router.js`) con History API |

---

## Estructura

```
love_arcade/
├── index.html          — SPA unificada (única página HTML)
├── styles.css          — Sistema de diseño completo
├── js/
│   ├── app.js          — Motor principal: GameCenter API, store, economía
│   ├── shop-logic.js   — Módulo de Tienda (catálogo, compras, sync)
│   ├── spa-router.js   — Router SPA con History API
│   └── sync-worker.js  — Web Worker: Base64 + SHA-256
├── data/
│   └── shop.json       — Catálogo de wallpapers
└── games/              — Minijuegos independientes (HTML/JS)
```

---

## Características principales

- **Economía central** — `window.GameCenter` expone una API pública para que cualquier minijuego integrado deposite monedas mediante `completeLevel(gameId, levelId, coins)`.
- **Tienda con descuentos y cashback** — El objeto `ECONOMY` en `app.js` controla ofertas globales y porcentaje de devolución desde un único punto.
- **Bono Diario con racha** — Recompensa escalable (20 → 60 monedas) con verificación de tiempo de red en segundo plano para prevenir manipulación de reloj.
- **Bendición Lunar** — Buff de +90 monedas por reclamo durante 7 días.
- **Sincronización entre dispositivos** — Exporta / importa la partida completa como un código Base64 con checksum SHA-256.
- **5 temas visuales** — Violeta · Rosa Neón · Cyan Arcade · Dorado · Carmesí, aplicados sin parpadeo (Zero-Flicker Initiative).
- **Minijuegos** — 2048, Jungle Dash, Ollin Smash, Vortex, Word Hunt, Pixel Drop, Laberinto, Rompecabezas, Dodger (y más en desarrollo).

---

## Inicio rápido

```bash
# Cualquier servidor HTTP local sirve. Ejemplos:
npx serve .
python3 -m http.server 8080
```

Abre `http://localhost:8080` en el navegador. No requiere Node.js, npm ni compilación.

---

## Integrar un minijuego

```js
// Al completar un nivel o logro:
if (window.GameCenter) {
    window.GameCenter.completeLevel('mi-juego', 'nivel-1', 50);
}
```

Consulta `love-arcade-coin-system.md` para el contrato completo de integración.

---

## Documentación

| Documento | Contenido |
|---|---|
| `DOCUMENTACION.md` | Referencia técnica completa del proyecto (arquitectura, APIs, changelog) |
| `ECONOMIA.md` | Guía de configuración de ofertas, descuentos y cashback |
| `love-arcade-coin-system.md` | Manual de integración para desarrolladores de minijuegos |
| `love-arcade-minigame-dev-manual.md` | Guía de desarrollo de nuevos minijuegos |

---

## Versión

**v9.6** — CDN Offline Resilience · SVG Sprite · Smart Preload · Neon Flow Fallback