# Push Notifications con Supabase para Love Arcade

Este documento explica **todo** lo necesario para operar notificaciones web en Love Arcade, incluyendo lo ya implementado en este repo y la configuración externa requerida en Supabase.

---

## 1) Qué se implementó en este repositorio

### Frontend / PWA
- `sw.js`:
  - Maneja eventos `push`.
  - Maneja `notificationclick` y abre/navega en la app.
  - Permite mostrar notificaciones locales mediante `postMessage`.
- `manifest.webmanifest`:
  - Config PWA mínima para Android.
- `index.html`:
  - Registra `manifest` y `theme-color`.
  - Añade card de configuración de notificaciones en la pestaña Sincronizar.
  - Añade formulario para campañas manuales (se guardan en Supabase).
- `js/push-notifications.js`:
  - Registra Service Worker.
  - Solicita permisos de notificación.
  - Se suscribe a Push con VAPID.
  - Guarda/actualiza suscripción en Supabase (`push_subscriptions`).
  - Implementa reglas predefinidas en cliente:
    - bono diario disponible
    - bendición lunar por vencer
    - novedades en tienda
    - evento urgente
  - Crea campañas manuales en tabla `push_campaigns`.
- `api/push-public-config.js`:
  - Expone `vapidPublicKey` pública al frontend.

### Importante
La parte de **envío push real en segundo plano** desde servidor requiere configurar Supabase Edge Functions (sección 4), porque ahí vive la llave privada VAPID.

---

## 2) Variables de entorno requeridas

### En Vercel (este proyecto)
```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BMxdhgSVCuO4Vad8c_Wj8a-nAC3AgUBqjDhGKJb6Fm1ZvJ1ZFvNd1VzeF1KZsl2kvJYMbC6hBjaK93dH9jeGFqg
```

> Si no la pones, `api/push-public-config` usa la llave pública que ya se dejó como fallback.

### En Supabase Edge Functions
Configura estos secrets:
```bash
LA_CLOUD_URL=https://TU_PROYECTO.supabase.co
LA_CLOUD_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY
VAPID_PUBLIC_KEY=BMxdhgSVCuO4Vad8c_Wj8a-nAC3AgUBqjDhGKJb6Fm1ZvJ1ZFvNd1VzeF1KZsl2kvJYMbC6hBjaK93dH9jeGFqg
VAPID_PRIVATE_KEY=TU_LLAVE_PRIVADA_VAPID
VAPID_SUBJECT=mailto:tu_correo@dominio.com
```

---

## 3) SQL completo para Supabase (copiar/pegar)

Ejecuta esto en **SQL Editor** de Supabase:

```sql
-- ==========================================================
-- 3.1 Tabla de suscripciones push
-- ==========================================================
create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  platform text default 'other',
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_uniq unique(endpoint)
);

create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);
create index if not exists idx_push_subscriptions_active on public.push_subscriptions(is_active);

create or replace function public.tg_push_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.last_seen_at = now();
  return new;
end;
$$;

drop trigger if exists trg_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trg_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row
execute function public.tg_push_subscriptions_updated_at();


-- ==========================================================
-- 3.2 Tabla de campañas manuales/programadas
-- ==========================================================
create table if not exists public.push_campaigns (
  id bigserial primary key,
  title text not null,
  body text not null,
  payload_json jsonb not null default '{}'::jsonb,
  target_filter_json jsonb not null default '{"target":"all"}'::jsonb,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  status text not null default 'pending', -- pending | processing | sent | error
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_campaigns_status_scheduled on public.push_campaigns(status, scheduled_for);

create or replace function public.tg_push_campaigns_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_push_campaigns_updated_at on public.push_campaigns;
create trigger trg_push_campaigns_updated_at
before update on public.push_campaigns
for each row
execute function public.tg_push_campaigns_updated_at();


-- ==========================================================
-- 3.3 Tabla de log de entregas
-- ==========================================================
create table if not exists public.push_delivery_log (
  id bigserial primary key,
  campaign_id bigint references public.push_campaigns(id) on delete cascade,
  subscription_id bigint references public.push_subscriptions(id) on delete cascade,
  status text not null, -- sent | failed | inactive
  provider_response text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_push_delivery_log_campaign on public.push_delivery_log(campaign_id);
create index if not exists idx_push_delivery_log_subscription on public.push_delivery_log(subscription_id);


-- ==========================================================
-- 3.4 RLS
-- ==========================================================
alter table public.push_subscriptions enable row level security;
alter table public.push_campaigns enable row level security;
alter table public.push_delivery_log enable row level security;

-- Suscripciones: cada usuario gestiona solo las suyas
create policy if not exists push_subscriptions_select_own
on public.push_subscriptions
for select
using (auth.uid() = user_id);

create policy if not exists push_subscriptions_insert_own
on public.push_subscriptions
for insert
with check (auth.uid() = user_id);

create policy if not exists push_subscriptions_update_own
on public.push_subscriptions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Campañas: sólo admins.
-- Requiere que en auth.users.user_metadata.role = 'admin'
create policy if not exists push_campaigns_select_admin
on public.push_campaigns
for select
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy if not exists push_campaigns_insert_admin
on public.push_campaigns
for insert
with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy if not exists push_campaigns_update_admin
on public.push_campaigns
for update
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Logs: sólo admins
create policy if not exists push_delivery_log_select_admin
on public.push_delivery_log
for select
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
```

---

## 4) Edge Function de Supabase para envío push real

> El frontend ya crea campañas manuales y guarda suscripciones. Para enviar push en background necesitas una función en Supabase que use `VAPID_PRIVATE_KEY`.

### 4.1 Crear función `push-dispatch`

```bash
supabase functions new push-dispatch
```

### 4.2 Código sugerido para `supabase/functions/push-dispatch/index.ts`

> Este bloque es base operativa. Usa `npm:web-push` en Deno.

```ts
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const LA_CLOUD_URL = Deno.env.get('LA_CLOUD_URL')!;
const LA_CLOUD_SERVICE_ROLE_KEY = Deno.env.get('LA_CLOUD_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (_req) => {
  const sb = createClient(LA_CLOUD_URL, LA_CLOUD_SERVICE_ROLE_KEY);

  const nowIso = new Date().toISOString();

  const { data: campaigns, error: campaignsErr } = await sb
    .from('push_campaigns')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', nowIso)
    .order('id', { ascending: true })
    .limit(5);

  if (campaignsErr) {
    return new Response(JSON.stringify({ ok: false, error: campaignsErr.message }), { status: 500 });
  }

  if (!campaigns?.length) {
    return new Response(JSON.stringify({ ok: true, message: 'No campaigns pending' }), { status: 200 });
  }

  for (const campaign of campaigns) {
    await sb.from('push_campaigns').update({ status: 'processing' }).eq('id', campaign.id);

    const target = campaign?.target_filter_json?.target || 'all';

    let subsQuery = sb
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, is_active')
      .eq('is_active', true);

    // Aquí puedes ampliar segmentación por target.
    // Ejemplo base: all => no filtro adicional.
    const { data: subscriptions, error: subsErr } = await subsQuery;
    if (subsErr) {
      await sb.from('push_campaigns').update({ status: 'error' }).eq('id', campaign.id);
      continue;
    }

    const payload = JSON.stringify({
      title: campaign.title,
      body: campaign.body,
      ...(campaign.payload_json || {})
    });

    for (const s of subscriptions || []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: {
              p256dh: s.p256dh,
              auth: s.auth
            }
          },
          payload
        );

        await sb.from('push_delivery_log').insert({
          campaign_id: campaign.id,
          subscription_id: s.id,
          status: 'sent',
          provider_response: 'ok'
        });
      } catch (err: any) {
        const statusCode = Number(err?.statusCode || 0);
        await sb.from('push_delivery_log').insert({
          campaign_id: campaign.id,
          subscription_id: s.id,
          status: 'failed',
          provider_response: String(err?.message || 'unknown error')
        });

        if (statusCode === 404 || statusCode === 410) {
          await sb.from('push_subscriptions').update({ is_active: false }).eq('id', s.id);
        }
      }
    }

    await sb.from('push_campaigns').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', campaign.id);
  }

  return new Response(JSON.stringify({ ok: true, processed: campaigns.length }), { status: 200 });
});
```

### 4.3 Deploy de function

```bash
supabase functions deploy push-dispatch
```

---

## 5) Programar envío automático (cron)

Puedes usar `pg_cron` o un scheduler externo.

### Opción A: scheduler externo (recomendada)
Llama cada minuto la URL HTTP de la function `push-dispatch`.

### Opción B: Supabase Cron + Edge Function
Configura un job que invoque la función cada minuto.

---

## 6) Cómo habilitar usuario administrador para campañas manuales

Debes guardar en `user_metadata` del usuario:

```json
{ "role": "admin" }
```

Puedes hacerlo desde panel de Supabase Auth (usuario por usuario), o con Admin API en backend seguro.

---

## 7) Compatibilidad Android (Opera)

El código incluye detección por feature:
- `serviceWorker in navigator`
- `Notification in window`
- `PushManager in window`

Si falta soporte, la UI muestra estado no soportado y no intenta registrar push.

### Flujo recomendado en Opera Android
1. Abrir Love Arcade vía HTTPS.
2. Ir a **Tienda → Sincronizar → Notificaciones del navegador**.
3. Presionar **Activar notificaciones**.
4. Aceptar permiso del navegador.
5. Iniciar sesión para persistir suscripción en Supabase.

---

## 8) Probar extremo a extremo

### Prueba local (ya implementada)
- Botón “Enviar prueba local”.
- Verifica permiso y service worker.

### Prueba push real
1. Tener suscripción activa en `push_subscriptions`.
2. Crear campaña desde UI (admin) o SQL:

```sql
insert into public.push_campaigns (
  title, body, payload_json, target_filter_json, scheduled_for, status
)
values (
  'Prueba global',
  'Esta es una notificación enviada por push-dispatch',
  '{"url":"/#view=events","view":"events"}'::jsonb,
  '{"target":"all"}'::jsonb,
  now(),
  'pending'
);
```

3. Ejecutar `push-dispatch` manualmente (HTTP call) o esperar scheduler.
4. Revisar `push_delivery_log`.

---

## 9) Notificaciones predefinidas activas hoy (cliente)

Implementadas en `js/push-notifications.js`:
- **Bono diario disponible**.
- **Bendición Lunar por vencer (<12h)**.
- **Evento urgente (<6h)**.
- **Cambios en `shop.json`**.

> Estas reglas son evaluadas cada minuto en cliente y muestran notificación local si hay permiso.

---

## 10) Seguridad y buenas prácticas

- Nunca exponer `VAPID_PRIVATE_KEY` en cliente.
- El envío push real debe vivir en Edge Function/backend.
- Desactivar suscripciones con respuesta 404/410 del proveedor.
- Limitar frecuencia de envíos (cooldowns por campaña/tipo).
- Registrar métricas en `push_delivery_log`.

---

## 11) Checklist final de producción

- [ ] Tabla `push_subscriptions` creada + RLS.
- [ ] Tabla `push_campaigns` creada + RLS admin.
- [ ] Tabla `push_delivery_log` creada + RLS admin.
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en Vercel.
- [ ] `VAPID_PRIVATE_KEY` en Supabase Secrets.
- [ ] Function `push-dispatch` desplegada.
- [ ] Scheduler cada minuto configurado.
- [ ] Usuario(s) admin con `user_metadata.role = 'admin'`.
- [ ] Prueba de notificación local OK.
- [ ] Prueba de envío push real OK.
