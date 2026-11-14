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
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    // manual test: /push-test?key=<PUSH_KEY>
    if (u.pathname === '/push-test') {
      if (!env.PUSH_KEY || u.searchParams.get('key') !== env.PUSH_KEY) return new Response('no', { status: 403 });
      return Response.json(await sendAll(env));
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_ev, env, ctx) { ctx.waitUntil(sendAll(env)); },
};
