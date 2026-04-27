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
  - Añade card de configuración de notificaciones en la pestaña Sincronizar con UX orientada a usuario final.
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
  - Evalúa reglas predefinidas y gestiona preferencias locales del usuario.
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

-- Campañas y logs: se gestionan desde dashboard/servicio.
-- En cliente no se requieren permisos RLS para estas tablas.
-- (Service Role en funciones backend ignora RLS.)
```

---

## 4) Edge Function de Supabase para envío push real

> El frontend solo gestiona suscripciones/permisos. Las campañas manuales deben crearse en Supabase Dashboard → Table editor → `push_campaigns`.

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

## 6) Compatibilidad Android (Opera)

El código incluye detección por feature:
- `serviceWorker in navigator`
- `Notification in window`
- `PushManager in window`

Si falta soporte, la UI muestra estado no soportado y no intenta registrar push.

### Flujo recomendado en Opera Android
1. Abrir Love Arcade vía HTTPS.
2. Ir a **Tienda → Sincronizar → Notificaciones del navegador**.
3. Presionar **Activar recordatorios**.
4. Aceptar permiso del navegador.
5. Iniciar sesión para persistir suscripción en Supabase.

---

## 7) Probar extremo a extremo

### Prueba local (ya implementada)
- Botón “Probar aviso”.
- Verifica permiso y service worker.

### Crear campañas manuales desde Supabase Dashboard (paso a paso)

Ruta: **Supabase Dashboard → Table editor → `push_campaigns` → Insert row**.

> Este flujo reemplaza por completo cualquier creación de campañas desde la web de Love Arcade.

#### Campos obligatorios en el formulario de Dashboard

| Campo | Tipo | ¿Qué poner? | Ejemplo |
|---|---|---|---|
| `id` | `int8` | Déjalo vacío si tu tabla usa identidad/autoincrement. Si tu tabla no autogenera `id`, coloca el siguiente consecutivo disponible. | `123` |
| `title` | `text` | Título corto visible en la notificación. | `Evento relámpago activo` |
| `body` | `text` | Mensaje principal (ideal: 60–140 caracteres). | `Completa tus misiones hoy para ganar recompensas extra.` |
| `payload_json` | `jsonb` | JSON con metadatos de navegación/visualización. | `{\"url\":\"/#view=events\",\"view\":\"events\",\"tag\":\"manual-campaign\"}` |
| `target_filter_json` | `jsonb` | Segmentación de audiencia para el dispatcher. Si no segmentas, usa `{\"target\":\"all\"}`. | `{\"target\":\"all\"}` |
| `scheduled_for` | `timestamptz` | Fecha/hora de envío en UTC o con zona explícita. | `2026-04-28T18:30:00Z` |
| `status` | `text` | Estado inicial recomendado: `pending`. | `pending` |
| `created_at` | `timestamptz` | Timestamp de creación. Si no hay default DB, pon hora actual. | `2026-04-27T19:00:00Z` |
| `updated_at` | `timestamptz` | Timestamp de última actualización (igual a `created_at` al crear). | `2026-04-27T19:00:00Z` |

#### Campos opcionales

| Campo | Tipo | Uso recomendado |
|---|---|---|
| `sent_at` | `timestamptz` | Déjalo `NULL` al crear. El dispatcher lo completará al finalizar el envío. |
| `created_by` | `uuid` | Opcional para auditoría manual (UUID del operador). Puede ir `NULL`. |

#### Plantilla JSON recomendada para `payload_json`

```json
{
  "title": "Evento relámpago activo",
  "body": "Completa tus misiones hoy para ganar recompensas extra.",
  "url": "/#view=events",
  "view": "events",
  "tag": "manual-campaign"
}
```

#### Plantilla JSON recomendada para `target_filter_json`

```json
{
  "target": "all"
}
```

#### Checklist rápido antes de guardar la fila

1. `status = "pending"`.
2. `scheduled_for` con fecha futura correcta.
3. JSON válido (sin comas finales) en `payload_json` y `target_filter_json`.
4. `sent_at` en `NULL`.
5. Guardar y confirmar que la fila aparece en `push_campaigns`.

### Prueba push real
1. Tener suscripción activa en `push_subscriptions`.
2. Crear campaña desde Supabase Dashboard (Table editor) o por SQL:

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

## 8) Notificaciones predefinidas activas hoy (cliente)

Implementadas en `js/push-notifications.js`:
- **Bono diario disponible**.
- **Bendición Lunar por vencer (<12h)**.
- **Evento urgente (<6h)**.
- **Cambios en `shop.json`**.

> Estas reglas son evaluadas cada minuto en cliente y muestran notificación local si hay permiso.

---

## 9) Seguridad y buenas prácticas

- Nunca exponer `VAPID_PRIVATE_KEY` en cliente.
- El envío push real debe vivir en Edge Function/backend.
- Desactivar suscripciones con respuesta 404/410 del proveedor.
- Limitar frecuencia de envíos (cooldowns por campaña/tipo).
- Registrar métricas en `push_delivery_log`.

---

## 10) Checklist final de producción

- [ ] Tabla `push_subscriptions` creada + RLS.
- [ ] Tabla `push_campaigns` creada.
- [ ] Tabla `push_delivery_log` creada.
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en Vercel.
- [ ] `VAPID_PRIVATE_KEY` en Supabase Secrets.
- [ ] Function `push-dispatch` desplegada.
- [ ] Scheduler cada minuto configurado.
- [ ] Flujo operativo definido: campañas manuales solo desde Supabase Dashboard.
- [ ] Prueba de notificación local OK.
- [ ] Prueba de envío push real OK.
