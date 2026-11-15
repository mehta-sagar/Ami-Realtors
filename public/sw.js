// App shell cache so the app opens without network. Data and map tiles always go to the network.
const V = 'ami-v20';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/i18n.js', 'js/areas.js', 'js/units.js', 'js/parse.js', 'js/store.js', 'js/geo.js', 'js/valuation.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'vendor/supabase.js', 'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-192.png', 'img/emblem.jpg', 'img/logo.jpg', 'img/card.jpg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network first so updates arrive at once; cache is the offline fallback
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(V).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
});

// 7:00 AM alert. The push has no payload: build the message from today's data.
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let body = 'આજના સમાચાર, ભાવ અને છાપાની જાહેરાતો જુઓ', n = 0, ads = 0;
    try {
      const today = new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10), y = new Date(Date.now() + 5.5 * 36e5 - 864e5).toISOString().slice(0, 10);
      const [news, leads] = await Promise.all([fetch('data/news.json', { cache: 'no-store' }).then((r) => r.json()), fetch('data/leads.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => [])]);
      const fresh = news.filter((x) => x.published_on >= y); n = fresh.length; ads = leads.filter((x) => x.date >= y).length;
      const top = (fresh[0] || news[0] || {}).title_gu;
      body = [n ? `${n} નવા સમાચાર` : null, ads ? `${ads} નવી જાહેરાત` : null].filter(Boolean).join(' · ') + (top ? '\n' + top : '');
    } catch { /* offline: generic text */ }
    await self.registration.showNotification('જય શ્રી કૃષ્ણ – Ami Realtors', { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'morning', data: { url: './' } });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => (cs[0] ? cs[0].focus() : self.clients.openWindow('./'))));
});
