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

  try {
    const res = await fetch(env.AIRTABLE_FORM_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('Airtable webhook error', res.status, await res.text());
    }
  } catch (err) {
    console.error('Airtable webhook fetch failed', err);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
