// Ami Realtors Worker: serves the app (./public) and, every morning at 7:00 IST, sends the "today" alert
// as a Web Push to every phone that turned it on. The push carries no data; the phone's service worker
// opens it and builds the message from today's news and paper ads.
// Secrets (set in Cloudflare › Workers › ami-realtors › Settings › Variables): VAPID_PRIVATE_JWK, PUSH_KEY.
const SB_URL = 'https://qzcpydazbhcehjzuvhni.supabase.co';
const SB_KEY = 'sb_publishable_LBFkjCG99kfNQBPHuw_xxQ_bBdmIw-u';
const VAPID_PUBLIC = 'BNtoml6LfhC9dHDsMsYPALscCz34LQj_wHTCm_HtndA91y0i61XcjXFx9u56uszoGCijrPMtVQZt-CjZML52-kA';
const SUBJECT = 'mailto:alerts@amirealtors.app';

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));

async function vapidAuth(endpoint, jwk) {
  const aud = new URL(endpoint).origin;
  const head = enc({ typ: 'JWT', alg: 'ES256' });
  const body = enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT });
  const key = await crypto.subtle.importKey('jwk', { ...jwk, key_ops: ['sign'], ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${VAPID_PUBLIC}`;
}
async function rpc(fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!r.ok) throw new Error(`${fn}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function sendAll(env) {
  const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const subs = await rpc('list_push_subs', { key: env.PUSH_KEY });
  let ok = 0, gone = 0;
  for (const s of subs) {
    const res = await fetch(s.endpoint, { method: 'POST', headers: { Authorization: await vapidAuth(s.endpoint, jwk), TTL: '43200', Urgency: 'normal', 'Content-Length': '0' } });
    if (res.status === 404 || res.status === 410) { gone++; await rpc('delete_push_sub', { endpoint: s.endpoint, key: env.PUSH_KEY }); } else if (res.ok) ok++;
  }
  return { ok, gone, total: subs.length };
}
// Google Maps short links (maps.app.goo.gl) from WhatsApp: a web page cannot follow Google's redirect,
// so the Worker follows it (only to Google hosts) and returns the final address, which has the coordinates.
const GOOGLE = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google|(www\.|maps\.)?google\.[a-z.]+|consent\.google\.[a-z.]+)\//i;
async function resolveLink(raw) {
  const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' } });
  let url = raw.trim();
  if (!GOOGLE.test(url)) return json({ error: 'not a Google Maps link' }, 400);
  let body = '';
  for (let i = 0; i < 6; i++) {
    const r = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en' } });
    const loc = r.headers.get('location');
    if (loc) {
      const next = new URL(loc, url).toString();
      // consent pages carry the real address in ?continue=
      const cont = new URL(next).searchParams.get('continue');
      url = cont && GOOGLE.test(cont) ? cont : next;
      if (!GOOGLE.test(url)) break;
      continue;
    }
    if (r.ok) body = (await r.text()).slice(0, 200000);
    break;
  }
  // When the address has no numbers, the page usually does (og:image centre or APP_INITIALIZATION_STATE).
  let hint = '';
  const m = body.match(/center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/) || body.match(/\[\[\[[\d.]+,(-?\d+\.\d+),(-?\d+\.\d+)\]/);
  if (m) hint = m[0].startsWith('center') ? `${m[1]},${m[2]}` : `${m[2]},${m[1]}`;
  const om = body.match(/<meta (?:content="([^"]+)" (?:itemprop|property)="og:title"|property="og:title" content="([^"]+)")/) || [];
  const name = om[1] || om[2] || null;
  return json({ url, body: hint ? 'q=' + hint : '', name });
}

// ---------- In-app AI assistant (Gemini) ----------
// The phone sends the conversation + the facts on screen; the Worker checks the person is signed in to the app,
// then asks Gemini (with Google Search grounding) and streams the answer back. The API key never reaches the phone.
// Secret: GEMINI_API_KEY (free key from aistudio.google.com). Optional variable: GEMINI_MODEL.
async function ai(req, env) {
  const cors = { 'access-control-allow-origin': '*' };
  if (!env.GEMINI_API_KEY) return new Response(JSON.stringify({ error: 'no_key' }), { status: 501, headers: { 'content-type': 'application/json', ...cors } });
  const auth = req.headers.get('authorization') || '';
  const who = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: auth } });
  if (!who.ok) return new Response(JSON.stringify({ error: 'sign_in' }), { status: 401, headers: { 'content-type': 'application/json', ...cors } });
  const body = await req.json().catch(() => ({}));
  const msgs = (body.messages || []).slice(-16).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.text || '').slice(0, 12000) }] }));
  if (!msgs.length) return new Response('{}', { status: 400, headers: cors });
  const lang = body.lang === 'en' ? 'English' : 'Gujarati (ગુજરાતી), simple words a Surat broker uses';
  const system = `You are the assistant inside the Ami Realtors app, used by Dharmesh Mehta (a real-estate broker in Chowk Bazaar, Surat, Gujarat), his son Sagar and their staff. Answer in ${lang}. Be practical and specific to Surat and South Gujarat real estate: prices per sq ft / var / vigha, jantri, stamp duty 4.9% + 1% registration, SMC/SUDA, TP/FP, 7/12, NA, GujRERA, GIDC. Use Google Search for anything current and say where numbers come from. Never invent phone numbers, prices or rules; say when you are not sure. Keep answers short with bullet points, then offer one useful next step.\n\nFacts from the app about what is on screen:\n${String(body.context || '').slice(0, 8000)}`;
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: msgs, tools: [{ google_search: {} }], generationConfig: { temperature: 0.4, maxOutputTokens: 2048 } }),
  });
  if (!g.ok || !g.body) return new Response(JSON.stringify({ error: 'gemini', status: g.status, detail: (await g.text()).slice(0, 500) }), { status: 502, headers: { 'content-type': 'application/json', ...cors } });
  return new Response(g.body, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', ...cors } });
}
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    // manual test: /push-test?key=<PUSH_KEY>
    if (u.pathname === '/push-test') {
      if (!env.PUSH_KEY || u.searchParams.get('key') !== env.PUSH_KEY) return new Response('no', { status: 403 });
      return Response.json(await sendAll(env));
    }
    if (u.pathname === '/ai' && req.method === 'POST') return ai(req, env);
    if (u.pathname === '/resolve') return resolveLink(u.searchParams.get('u') || '');
    // WhatsApp needs an absolute image address to show the visiting card as the link preview
    if (u.pathname === '/card.html' || u.pathname === '/card') {
      let r = await env.ASSETS.fetch(new Request(u.origin + '/card.html'));
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) r = await env.ASSETS.fetch(new Request(new URL(r.headers.get('location'), u.origin)));
      const html = (await r.text()).replace('content="img/card.jpg"', `content="${u.origin}/img/card.jpg"`);
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_ev, env, ctx) { ctx.waitUntil(sendAll(env)); },
};
