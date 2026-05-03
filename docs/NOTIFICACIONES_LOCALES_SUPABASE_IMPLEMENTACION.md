# Notificaciones de Love Arcade (Producción)

Última actualización: 2026-05-03

## Objetivo
Este documento centraliza la arquitectura y operación de notificaciones de Love Arcade en producción:
- campañas remotas,
- recordatorios locales procesados en backend (bono diario, tienda, eventos, bendición lunar),
- deduplicación robusta,
- versionado de contenido de tienda.

---

## Arquitectura

### Cliente (Web App)
Archivos clave:
- `js/push-notifications.js`
- `js/shop-logic.js`

Responsabilidades:
1. Registrar Service Worker y suscripción Push Web.
2. Guardar suscripción en `push_subscriptions`.
3. Sincronizar estado de recordatorios en `user_notification_state`:
   - preferencias por tipo,
   - estado daily (`daily_can_claim`, `daily_last_claim_at`),
   - offset de zona horaria,
   - estado lunar/eventos,
   - hash local de catálogo para trazabilidad.

### Service Worker
Archivo:
- `sw.js`

Responsabilidades:
- Mostrar notificaciones entrantes (`push`).
- Resolver deep-link de apertura (`notificationclick`).

### Backend (Supabase Edge Function)
Archivo:
- `supabase/functions/push-dispatch/index.ts`

Responsabilidades:
1. Evaluar reglas de recordatorios por usuario.
2. Encolar campañas en `push_campaigns`.
3. Despachar campañas pendientes a `push_subscriptions` activas.
4. Registrar entrega en `push_delivery_log`.
5. Marcar suscripciones inválidas (`404/410`) como inactivas.

---

## Esquema SQL requerido (migraciones)

Aplicar estas migraciones (en orden):
1. `supabase/migrations/20260502_local_notification_state.sql`
2. `supabase/migrations/20260502_shop_content_version.sql`
3. `supabase/migrations/20260502_shop_notification_dedupe.sql`
4. `supabase/migrations/20260502_daily_reminder_slots.sql`

Tablas/funciones clave:
- `user_notification_state`
- `app_content_versions`
- `bump_shop_version()`
- `enqueue_local_shop_campaign(...)`

---

## Reglas de negocio en producción

### 1) Novedades de tienda
- Se detectan por versión global `app_content_versions.shop_version`.
- Al publicar cambios de `shop.json`, incrementar versión:

```sql
select public.bump_shop_version();
```

- Dedupe robusta por `user_id + shop_version` mediante `enqueue_local_shop_campaign(...)`.

### 2) Bono diario
- Se evalúa por hora local del usuario (offset sincronizado desde cliente).
- Ventanas:
  - mañana: 08:00–11:59
  - día: 13:00–16:59
  - noche: 19:00–22:59
- Máximo 3 notificaciones por día (1 por ventana).
- Si el usuario reclama, `daily_can_claim=false` y se detienen envíos pendientes de ese día.

### 3) Bendición lunar y eventos
- Se evalúan por proximidad de expiración/fin según estado sincronizado.

---

## Variables de entorno (Edge Function)

Obligatorias:
- `LA_CLOUD_URL`
- `LA_CLOUD_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Recomendadas:
- `EDGE_SHARED_SECRET`

Opcional (fallback):
- `SHOP_CONTENT_VERSION`

---

## Operación

### Deploy
```bash
supabase functions deploy push-dispatch
```

### Cron
- Ejecutar `push-dispatch` de forma periódica.
- Frecuencia vigente: **cada 1 minuto** (válida con dedupe actual).

### Health check sugerido
Verificar periódicamente:
- `push_campaigns` (`status`, `last_error`)
- `push_delivery_log` (`status`)
- `push_subscriptions` (`is_active`)
- `user_notification_state` (coherencia de flags y timestamps)

---

## Criterios de aceptación

1. Campañas remotas llegan con navegador cerrado.
2. Novedades de tienda envían solo 1 aviso por versión/usuario.
3. Bono diario envía hasta 3 recordatorios por día en sus ventanas.
4. Si se reclama daily tras la primera alerta, no se envían las restantes de ese día.
5. Sin duplicados por ejecución frecuente del cron.
