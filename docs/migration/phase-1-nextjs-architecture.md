# Fase 1 — Cimentación y Modularización (Next.js App Router)

## 1) Análisis de estructura actual

- `data/events.json`: define `activeEvents[]` con ventana temporal (`startDate/endDate`), configuración por tipo y metadatos UI.
- `data/shop.json`: catálogo plano de items, con pricing, tags y reglas opcionales (`requirements`) para desbloqueos.
- `js/spa-router.js`: SPA manual con toggles de vistas (`home/shop/events`), History API y lifecycle callbacks (`onEnter/onLeave`).
- `js/sync-worker.js`: worker de CPU para serialización, checksum SHA-256 y backup gzip sin bloquear UI.

## 2) Nueva arquitectura App Router

```txt
app/
  layout.tsx            # Layout global, fuentes, metadata
  page.tsx              # Landing SSR inicial
components/
  game-engine-bridge.tsx # Bridge React -> scripts de juegos legacy
lib/
  data/
    events.ts
    shop.ts
  services/
    data-service.ts      # Lectura SSR-safe de JSON
  workers/
    use-sync-worker.ts   # Inicialización lifecycle-safe del worker
public/
  games/**               # Assets y runtimes legacy movidos sin romper rutas
  workers/sync-worker.js # Worker servido como asset estático
```

## 3) Estrategia de navegación

- Reemplazar `spa-router.js` por rutas nativas:
  - `/` home
  - `/shop`
  - `/events`
  - `/games/[slug]`
- Usar `next/link` y layouts anidados para shared UI (navbar/hud).
- Estado efímero (scroll anchors, filtros) vía search params.

## 4) Estrategia de workers en React

- Los workers se instancian en hooks client-side (`useSyncWorker`) para evitar errores SSR.
- Cleanup explícito en `useEffect` para evitar leaks al navegar.
- Mensajería recomendada: wrapper con request/response por `id` + timeout.

## 5) Plan de migración de assets

- Mover cada `games/*` a `public/games/*` (ya aplicado en esta fase).
- Mantener estructura interna de carpetas para preservar `relative imports` de motores existentes.
- Referenciar desde Next con rutas absolutas (`/games/<engine>/...`).
