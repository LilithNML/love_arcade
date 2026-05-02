# COPY/PASTE — pasos exactos pendientes

## 1) Ejecuta este SQL en Supabase SQL Editor (una sola vez)

```sql
create table if not exists public.app_content_versions (
  id smallint primary key default 1 check (id = 1),
  shop_version bigint not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.app_content_versions (id, shop_version)
values (1, 1)
on conflict (id) do nothing;

create or replace function public.bump_shop_version()
returns bigint
language plpgsql
security definer
as $$
declare
  next_version bigint;
begin
  update public.app_content_versions
  set shop_version = shop_version + 1,
      updated_at = now()
  where id = 1
  returning shop_version into next_version;

  return next_version;
end;
$$;

alter table public.user_notification_state
  add column if not exists last_shop_version_sent bigint not null default 0;

create or replace function public.enqueue_local_shop_campaign(
  p_user_id uuid,
  p_shop_version bigint,
  p_scheduled_for timestamptz default now()
)
returns boolean
language plpgsql
security definer
as $$
begin
  perform pg_advisory_xact_lock(hashtext('local_shop:' || p_user_id::text || ':' || p_shop_version::text));

  if exists (
    select 1
    from public.push_campaigns c
    where c.target_filter_json->>'target' = 'user_id'
      and c.target_filter_json->>'user_id' = p_user_id::text
      and c.payload_json->>'type' = 'local_shop'
      and (c.payload_json->>'shop_version')::bigint = p_shop_version
      and c.status in ('pending', 'processing', 'sent', 'partial')
  ) then
    return false;
  end if;

  insert into public.push_campaigns (
    title, body, payload_json, target_filter_json, scheduled_for, status
  ) values (
    '🛍️ Novedades en la tienda',
    'Hay contenido nuevo en la tienda. Entra y descubre las novedades.',
    jsonb_build_object(
      'url', '/#view=shop',
      'tag', 'local-shop-' || p_user_id::text || '-v' || p_shop_version::text,
      'view', 'shop',
      'type', 'local_shop',
      'shop_version', p_shop_version
    ),
    jsonb_build_object('target', 'user_id', 'user_id', p_user_id::text),
    p_scheduled_for,
    'pending'
  );

  return true;
end;
$$;

alter table public.user_notification_state
  add column if not exists daily_can_claim boolean not null default false,
  add column if not exists daily_last_claim_at timestamptz,
  add column if not exists daily_timezone_offset_minutes integer not null default 0,
  add column if not exists daily_last_notified_on date,
  add column if not exists daily_notified_slots text[] not null default '{}';
```

## 2) Deploy de la Edge Function

```bash
supabase functions deploy push-dispatch
```

## 3) (Opcional) Define fallback de versión por variable de entorno

`SHOP_CONTENT_VERSION=1`

> Solo es fallback. Si existe `app_content_versions`, esa tabla manda.

## 4) Cada vez que publiques cambios en `shop.json`

Ejecuta:

```sql
select public.bump_shop_version();
```

Listo: en el siguiente cron de `push-dispatch` se enviarán avisos de tienda nueva.
