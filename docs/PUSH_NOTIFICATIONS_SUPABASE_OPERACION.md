# Push Notifications Supabase-first (implementación completa)

Fecha: 2026-04-27

Este documento describe **todo lo que se ajustó en el repositorio** para resolver los problemas detectados y deja un procedimiento de copy/paste para terminar la configuración en Supabase.

---

## 1) Qué se corrigió en el código

### Frontend (`js/push-notifications.js`)

Se eliminó la lógica de “notificaciones locales predefinidas” basada en `setInterval` en cliente, porque no puede funcionar con pestaña/navegador cerrados.

Ahora el frontend queda con responsabilidades claras:

1. Registrar Service Worker.
2. Solicitar permiso al usuario.
3. Crear/actualizar suscripción push (`push_subscriptions`).
4. Enviar notificación de prueba local solo para validar UX.
5. Mostrar que los envíos automáticos se gestionan desde Supabase.

> Resultado: desaparece la falsa expectativa de que el cliente enviará recordatorios cuando la app esté cerrada.

### Backend Supabase (código agregado en repo)

Se añadieron archivos listos para usar con Supabase CLI:

- `supabase/migrations/20260427_push_dispatch_hardening.sql`
- `supabase/functions/push-dispatch/index.ts`

Incluyen:

- Claim atómico de campañas (`FOR UPDATE SKIP LOCKED`) para evitar doble procesamiento concurrente.
- Requeue automático de campañas atascadas en `processing`.
- Métricas por campaña (`sent_count`, `failed_count`, `inactive_count`, `last_error`).
- Estado final correcto: `sent`, `partial` o `error` (no marcar `sent` si todo falló).
- Opción de auth por `EDGE_SHARED_SECRET` para invocaciones del scheduler.

---

## 2) Pasos que debe ejecutar el developer en Supabase (copy/paste)

> Estos pasos no los puedo ejecutar desde aquí porque requieren acceso a tu proyecto Supabase.

## 2.1 Aplicar migración SQL

Opción A (recomendada con CLI):

```bash
supabase db push
```

Opción B (Dashboard SQL Editor):

Copia y pega el contenido completo de:

- `supabase/migrations/20260427_push_dispatch_hardening.sql`

---

## 2.2 Desplegar Edge Function

```bash
supabase functions deploy push-dispatch
```

---

## 2.3 Configurar secrets/env vars de la function

```bash
supabase secrets set \
  LA_CLOUD_URL="https://<PROJECT_REF>.supabase.co" \
  LA_CLOUD_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>" \
  VAPID_PUBLIC_KEY="<VAPID_PUBLIC_KEY>" \
  VAPID_PRIVATE_KEY="<VAPID_PRIVATE_KEY>" \
  VAPID_SUBJECT="mailto:admin@tu-dominio.com" \
  EDGE_SHARED_SECRET="<TOKEN_LARGO_ALEATORIO>"
```

> Como ya confirmaste que VAPID está correcto, este paso es solo para asegurar que la function tenga todas las variables.

---

## 2.4 Programar ejecución automática (cada minuto)

Puedes usar tu scheduler preferido. Ejemplo con un cron externo:

```bash
curl -i -X POST \
  "https://<PROJECT_REF>.functions.supabase.co/push-dispatch" \
  -H "Authorization: Bearer <EDGE_SHARED_SECRET>"
```

Frecuencia recomendada: `* * * * *` (cada minuto).

---

## 2.5 Verificar flujo E2E

### A) Suscripción activa

```sql
select id, user_id, endpoint, is_active, updated_at
from public.push_subscriptions
order by updated_at desc
limit 20;
```

### B) Crear campaña manual (Developer friendly desde Table Editor o SQL)

```sql
insert into public.push_campaigns (
  title,
  body,
  payload_json,
  target_filter_json,
  scheduled_for,
  status
)
values (
  'Contenido nuevo',
  'Nuevo wallpaper disponible',
  '{"tag":"manual-campaign","url":"/#view=events","view":"events"}'::jsonb,
  '{"target":"all"}'::jsonb,
  now() - interval '1 minute',
  'pending'
);
```

### C) Revisar resultado del dispatcher

```sql
select
  id,
  status,
  sent_at,
  processed_at,
  sent_count,
  failed_count,
  inactive_count,
  last_error,
  scheduled_for
from public.push_campaigns
order by id desc
limit 20;
```

```sql
select
  id,
  campaign_id,
  subscription_id,
  status,
  provider_response,
  sent_at
from public.push_delivery_log
order by id desc
limit 50;
```

---

## 3) Contrato operativo recomendado (seguridad + DX)

1. **Creación de campañas**: solo en Supabase (`push_campaigns`).
2. **Frontend**: no crea campañas, solo gestiona suscripción y UX de permisos.
3. **Despacho**: único punto de salida `push-dispatch` (backend Supabase).
4. **Automatización**: scheduler invoca la function cada minuto.
5. **Monitoreo**: dashboard SQL sobre `push_campaigns` + `push_delivery_log`.

---

## 4) Checklist final

- [ ] Migración aplicada (`claim_push_campaigns`, `requeue_stuck_push_campaigns`, columnas nuevas).
- [ ] Function desplegada (`push-dispatch`).
- [ ] Secrets configurados en Supabase.
- [ ] Scheduler ejecutando cada minuto.
- [ ] Campaña de prueba con `status='pending'` y `scheduled_for <= now()`.
- [ ] `push_delivery_log` con registros `sent`/`failed`.
- [ ] Confirmación en dispositivo real con app cerrada para notificación remota.

---

## 5) Notas de arquitectura

- Las notificaciones “regladas” (daily/moon/shop/events) deben producirse en backend (p. ej. creando campañas automáticamente con otra function programada) si se espera funcionamiento con la app cerrada.
- El estado `partial` evita perder visibilidad cuando parte de las suscripciones falla.
- El requeue de `processing` previene bloqueos por caídas transitorias del worker.

