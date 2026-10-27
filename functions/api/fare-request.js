const BASE_ID = 'appzAcXAINx9KWMt1';
const TABLE_ID = 'tbl4g5H6HG4L1l6C2';
const LIMIT = 5;
const WINDOW_MS = 60_000;
const hits = new Map();

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const s = (v, max = 200) => String(v ?? '').trim().slice(0, max);

// Per-isolate limiter: best effort, Workers isolates do not share memory.
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > LIMIT;
}

export function onRequestGet({ env }) {
  return json(200, { v: 4, token: Boolean(env.AIRTABLE_TOKEN), li: Boolean(env.LI_CONVERSION_ID), webhook: Boolean(env.AIRTABLE_FORM_WEBHOOK) });
}

export async function onRequestPost(context) {
  try {
    return await handle(context);
  } catch (err) {
    console.error('fare-request crashed', err);
    return json(500, { ok: false, error: 'server_error', detail: String(err && err.name) });
  }
}

async function handle(context) {
  const { request, env } = context;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (rateLimited(ip)) return json(429, { ok: false, error: 'rate_limited' });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: 'invalid_json' });
  }

  const email = s(body.email, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { ok: false, error: 'invalid_email' });

  const route = s(body.route);
  const now = new Date().toISOString();
  const fields = {
    Email: email,
    Route: route,
    'Route Param': s(body.routeParam, 10),
    'UTM Source': s(body.utm_source),
    'UTM Campaign': s(body.utm_campaign),
    'UTM Content': s(body.utm_content),
    'Submitted At': now,
    Status: 'New',
    Page: s(body.page, 50) || 'proof',
  };

  const token = String(env.AIRTABLE_TOKEN || '').trim();
  if (!token) return json(500, { ok: false, error: 'missing_token' });

  const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  if (!res.ok) {
    console.error('Airtable API error', res.status, await res.text());
    return json(500, { ok: false, error: 'store_failed', upstream: res.status });
  }

  if (env.AIRTABLE_FORM_WEBHOOK) {
    context.waitUntil(
      fetch(env.AIRTABLE_FORM_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '', email, route, dates: '',
          utm_campaign: fields['UTM Campaign'], utm_content: fields['UTM Content'],
          page: 'proof', submitted_at: now,
        }),
      }).catch((err) => console.error('Notification webhook failed', err))
    );
  }

  return json(200, { ok: true, li: env.LI_CONVERSION_ID || '' });
}
