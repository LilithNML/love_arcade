import { NextResponse } from 'next/server';

const THREAD_IDS: Record<string, number> = { analytics: 2, achievement: 3, bug: 4 };
const TYPE_EMOJIS: Record<string, string> = { analytics: '📈', achievement: '🏆', bug: '🚨' };

const sanitize = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

function traceId() { return `rep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

function errorJson(status: number, code: string, message: string, details?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: { code, message, trace_id: traceId(), timestamp: new Date().toISOString(), ...(details ? { details } : {}) } }, { status });
}

export async function POST(req: Request) {
  const originHeader = req.headers.get('origin') || req.headers.get('referer') || '';
  const productionDomain = process.env.PRODUCTION_DOMAIN || '';

  const toHostname = (value: string) => {
    try { return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase(); } catch { return ''; }
  };
  const requestHost = toHostname(originHeader);
  const productionHost = toHostname(productionDomain);
  const isSameOrSubdomain = (h: string, d: string) => h === d || h.endsWith(`.${d}`);
  if (productionDomain && !(isSameOrSubdomain(requestHost, productionHost) || requestHost.endsWith('.vercel.app') || requestHost === 'localhost' || requestHost === '127.0.0.1')) {
    return errorJson(403, 'forbidden_origin', 'Forbidden', { origin: originHeader || '(empty)' });
  }

  const payload = await req.json().catch(() => ({}));
  const type = typeof payload.type === 'string' && payload.type in THREAD_IDS ? payload.type : 'analytics';
  const user = sanitize(payload.user ?? 'desconocido').slice(0, 50);
  const event = sanitize(payload.event ?? 'unknown').slice(0, 80);
  const data = typeof payload.data === 'object' && payload.data ? payload.data as Record<string, unknown> : {};
  const clientTs = Number(payload.client_event_ts);
  const hasClientTs = Number.isFinite(clientTs) && clientTs > 0;

  const entries = Object.entries(data).filter(([, v]) => v != null).map(([k, v]) => `  <code>${sanitize(k)}:</code> ${sanitize(String(v))}`).join('\n');
  const text = [
    `${TYPE_EMOJIS[type]} <b>${event.replace(/_/g, ' ').toUpperCase()}</b>`, '',
    `👤 <b>Usuario:</b> <code>${user}</code>`, `📌 <b>Tipo:</b> <i>${type}</i>`, '',
    entries ? `📋 <b>Datos:</b>\n${entries}` : '<i>Sin metadatos adicionales.</i>', '',
    hasClientTs ? `🕓 <b>Cliente (evento):</b> <code>${new Date(clientTs).toISOString()}</code>` : '🕓 <b>Cliente (evento):</b> <i>sin client_event_ts</i>',
    `🕐 <b>Servidor (envío):</b> <code>${new Date().toISOString()}</code>`,
    '<i>Love Arcade · Ghost Analytics v12.2</i>',
  ].join('\n');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return errorJson(500, 'server_misconfiguration', 'Server misconfiguration');

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort('timeout'), 1800);
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ chat_id: chatId, message_thread_id: THREAD_IDS[type], text, parse_mode: 'HTML' }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return errorJson(502, 'telegram_upstream_error', 'Upstream error', { upstream_status: response.status, upstream_body: body, event });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return errorJson(err?.name === 'AbortError' ? 504 : 502, err?.name === 'AbortError' ? 'telegram_timeout' : 'telegram_network_error', err?.name === 'AbortError' ? 'Telegram timeout' : 'Network error', { error_message: err?.message || String(err), event });
  } finally { clearTimeout(timeout); }
}
