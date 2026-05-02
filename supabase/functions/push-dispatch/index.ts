// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const LA_CLOUD_URL = Deno.env.get('LA_CLOUD_URL');
const LA_CLOUD_SERVICE_ROLE_KEY = Deno.env.get('LA_CLOUD_SERVICE_ROLE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';
const EDGE_SHARED_SECRET = Deno.env.get('EDGE_SHARED_SECRET') || '';

if (!LA_CLOUD_URL || !LA_CLOUD_SERVICE_ROLE_KEY) {
  throw new Error('Missing LA_CLOUD_URL or LA_CLOUD_SERVICE_ROLE_KEY env vars');
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY env vars');
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function unauthorized(): Response {
  return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
}

function isAuthValid(req: Request): boolean {
  if (!EDGE_SHARED_SECRET) return true;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token.length > 0 && token === EDGE_SHARED_SECRET;
}

Deno.serve(async (req) => {
  if (!isAuthValid(req)) {
    return unauthorized();
  }

  const sb = createClient(LA_CLOUD_URL, LA_CLOUD_SERVICE_ROLE_KEY);

  const { data: requeued, error: requeueErr } = await sb.rpc('requeue_stuck_push_campaigns', {
    max_age: '10 minutes'
  });

  if (requeueErr) {
    return jsonResponse({ ok: false, error: `requeue_stuck_push_campaigns: ${requeueErr.message}` }, 500);
  }

  const { data: campaigns, error: claimErr } = await sb.rpc('claim_push_campaigns', { batch_size: 5 });

  if (claimErr) {
    return jsonResponse({ ok: false, error: `claim_push_campaigns: ${claimErr.message}` }, 500);
  }

  if (!campaigns?.length) {
    return jsonResponse({ ok: true, requeued, processed: 0, message: 'No campaigns pending' }, 200);
  }

  for (const campaign of campaigns) {
    const target = campaign?.target_filter_json?.target || 'all';

    let subsQuery = sb
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, is_active')
      .eq('is_active', true);

    // Future: apply segmentation based on target_filter_json.
    if (target !== 'all') {
      // Placeholder to keep behavior explicit.
      subsQuery = subsQuery;
    }

    const { data: subscriptions, error: subsErr } = await subsQuery;
    if (subsErr) {
      await sb
        .from('push_campaigns')
        .update({
          status: 'error',
          processed_at: new Date().toISOString(),
          last_error: subsErr.message
        })
        .eq('id', campaign.id);
      continue;
    }

    const payload = JSON.stringify({
      title: campaign.title,
      body: campaign.body,
      ...(campaign.payload_json || {})
    });

    let sentCount = 0;
    let failedCount = 0;
    let inactiveCount = 0;
    const errors: string[] = [];

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

        sentCount += 1;
        await sb.from('push_delivery_log').insert({
          campaign_id: campaign.id,
          subscription_id: s.id,
          status: 'sent',
          provider_response: 'ok'
        });
      } catch (err: any) {
        failedCount += 1;
        const providerMessage = String(err?.body || err?.message || 'unknown error');
        const statusCode = Number(err?.statusCode || 0);
        errors.push(`subscription:${s.id} status:${statusCode} msg:${providerMessage}`);

        await sb.from('push_delivery_log').insert({
          campaign_id: campaign.id,
          subscription_id: s.id,
          status: 'failed',
          provider_response: providerMessage
        });

        if (statusCode === 404 || statusCode === 410) {
          inactiveCount += 1;
          await sb.from('push_subscriptions').update({ is_active: false }).eq('id', s.id);
        }
      }
    }

    let campaignStatus: 'sent' | 'partial' | 'error' = 'sent';
    if (sentCount === 0 && failedCount > 0) campaignStatus = 'error';
    else if (sentCount > 0 && failedCount > 0) campaignStatus = 'partial';

    const lastError = errors.length ? errors.slice(0, 5).join(' | ').slice(0, 4000) : null;

    await sb
      .from('push_campaigns')
      .update({
        status: campaignStatus,
        sent_at: sentCount > 0 ? new Date().toISOString() : null,
        processed_at: new Date().toISOString(),
        processing_started_at: null,
        sent_count: sentCount,
        failed_count: failedCount,
        inactive_count: inactiveCount,
        last_error: lastError
      })
      .eq('id', campaign.id);
  }

  return jsonResponse({ ok: true, requeued, processed: campaigns.length }, 200);
});
