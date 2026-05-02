# Implementación: notificaciones “locales” en segundo plano con Supabase

Fecha: 2026-05-02

## Objetivo
Resolver que los avisos de:
- bono diario,
- bendición lunar por expirar,
- novedades de tienda,
- eventos por terminar,

sigan llegando incluso con pestaña/navegador cerrados.

## Qué se cambió en el código

### 1) Cliente (`js/push-notifications.js`)
Se agregó sincronización periódica de estado local hacia Supabase (`user_notification_state`):
- preferencias de usuario (daily/moon/shop/events),
- siguiente horario de bono diario,
- expiración de bendición lunar,
- hash de catálogo de tienda,
- ids de eventos activos y fin del evento más próximo.

También:
- sincroniza al activar/desactivar push,
- sincroniza al cambiar toggles,
- sincroniza cada 5 minutos con sesión activa.

### 2) Tienda (`js/shop-logic.js`)
Al cargar `shop.json`, ahora se guarda un hash en `localStorage`:
- `love_arcade_shop_catalog_hash_v1`

Este hash sirve para detectar novedades de catálogo y disparar aviso backend.

### 3) Backend Push (`supabase/functions/push-dispatch/index.ts`)
Antes de despachar campañas pendientes:
- consulta `user_notification_state`,
- evalúa reglas “locales” del usuario,
- encola campañas en `push_campaigns` dirigidas por `user_id`,
- marca timestamps/hashes enviados para deduplicar.

Además, se agregó soporte de segmentación `target_filter_json.target = 'user_id'`.

### 4) SQL nueva migración
Archivo agregado:
- `supabase/migrations/20260502_local_notification_state.sql`

Crea `public.user_notification_state` + RLS + trigger de `updated_at`.

---

## Pasos para el desarrollador (copy/paste)

## A. Ejecutar migración SQL en Supabase
Si no usas CLI, copia y pega completo en SQL Editor:

```sql
-- Estado de recordatorios locales sincronizado por cliente y consumido por push-dispatch
create table if not exists public.user_notification_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_enabled boolean not null default true,
  moon_enabled boolean not null default true,
  shop_enabled boolean not null default true,
  events_enabled boolean not null default true,
  next_daily_claim_at timestamptz,
  moon_blessing_expires_at timestamptz,
  shop_catalog_hash text,
  active_event_ids text[] not null default '{}',
  next_event_end_at timestamptz,
  last_shop_catalog_hash_sent text,
  last_event_ids_sent text[] not null default '{}',
  last_daily_sent_at timestamptz,
  last_moon_sent_at timestamptz,
  last_shop_sent_at timestamptz,
  last_event_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.tg_user_notification_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_notification_state_updated_at on public.user_notification_state;
create trigger trg_user_notification_state_updated_at
before update on public.user_notification_state
for each row
execute function public.tg_user_notification_state_updated_at();

alter table public.user_notification_state enable row level security;

create policy if not exists user_notification_state_select_own
on public.user_notification_state
for select
using (auth.uid() = user_id);

create policy if not exists user_notification_state_insert_own
on public.user_notification_state
for insert
with check (auth.uid() = user_id);

create policy if not exists user_notification_state_update_own
on public.user_notification_state
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## B. Deploy de Edge Function
Asegúrate de desplegar `push-dispatch` actualizado.

```bash
supabase functions deploy push-dispatch
```

## C. Cron/Programación de ejecución
Debes ejecutar la función de forma periódica (cada 5 minutos recomendado).

Ejemplo `curl` (si usas secreto compartido):

```bash
curl -X POST "https://<project-ref>.functions.supabase.co/push-dispatch" \
  -H "Authorization: Bearer <EDGE_SHARED_SECRET>"
```

## D. Variables requeridas en la función
- `LA_CLOUD_URL`
- `LA_CLOUD_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `EDGE_SHARED_SECRET` (opcional pero recomendado)

---

## Notas operativas
- Estas notificaciones ya no dependen de que la app esté abierta en primer plano para dispararse.
- Dependen de que exista sesión y sincronización previa del estado del usuario.
- Primera notificación de cada regla puede tardar hasta el siguiente ciclo de cron.
