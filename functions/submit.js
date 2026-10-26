export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const payload = {
    name:         String(body.name         || '').trim(),
    email:        String(body.email        || '').trim(),
    route:        String(body.route        || '').trim(),
    dates:        String(body.dates        || '').trim(),
    utm_campaign: String(body.utm_campaign || '').trim(),
    utm_content:  String(body.utm_content  || '').trim(),
    page:         'proof',
    submitted_at: new Date().toISOString(),
  };

  const fail = (stage, status) => {
    console.error('Airtable webhook failed', stage, status);
    return new Response(JSON.stringify({ ok: false, stage, status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  if (!env.AIRTABLE_FORM_WEBHOOK) return fail('missing_env', 0);

  try {
    const res = await fetch(env.AIRTABLE_FORM_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return fail('airtable_rejected', res.status);
  } catch (err) {
    return fail('fetch_error', 0);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
