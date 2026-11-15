// Location helpers: reading Google Maps links, and what is around a point (roads, highways, facilities)
// from OpenStreetMap. Results are cached on the phone so a place is looked up once.
import { km } from './areas.js';

// ---------- Google Maps links (WhatsApp shares) ----------
const SURAT_BOX = (lat, lng) => lat > 19.5 && lat < 24.8 && lng > 68 && lng < 75; // all of Gujarat
const num = '(-?\\d{1,3}\\.\\d+)';
// Order matters: the pin (!3d!4d) is the place itself; @lat,lng is only where the screen was centred.
const PATTERNS = [
  [new RegExp(`!3d${num}!4d${num}`), false, 'pin'],
  [new RegExp(`[?&](?:q|query|destination|daddr|ll|sll|center|viewpoint|loc)=(?:loc:)?${num}(?:,|%2C|\\s)+\\s*${num}`, 'i'), false, 'q'],
  [new RegExp(`/place/${num},(?:\\s|%20)*${num}`), false, 'place'],
  [new RegExp(`/search/${num},(?:\\+|\\s|%20)*${num}`), false, 'search'],
  [new RegExp(`@${num},${num}`), false, 'view'],
];
// Plain "21.1702, 72.8311" or "21°10'12.7"N 72°49'52.0"E" pasted as text.
const DMS = /(\d{1,2})°\s*(\d{1,2})['′]\s*([\d.]+)["″]?\s*([NS])[\s,]+(\d{1,3})°\s*(\d{1,2})['′]\s*([\d.]+)["″]?\s*([EW])/i;
export function coordsFromText(text) {
  if (!text) return null;
  let s = String(text);
  try { s = decodeURIComponent(s); } catch { /* keep raw */ }
  for (const [re, swap, how] of PATTERNS) {
    const m = s.match(re);
    if (m) { const a = +m[1], b = +m[2], lat = swap ? b : a, lng = swap ? a : b; if (SURAT_BOX(lat, lng)) return { lat, lng, how }; }
  }
  // directions data: !1d{lng}!2d{lat}, the last pair is the destination
  const dd = [...s.matchAll(new RegExp(`!1d${num}!2d${num}`, 'g'))].pop();
  if (dd && SURAT_BOX(+dd[2], +dd[1])) return { lat: +dd[2], lng: +dd[1], how: 'dir' };
  const d = s.match(DMS);
  if (d) {
    const lat = (+d[1] + d[2] / 60 + d[3] / 3600) * (/S/i.test(d[4]) ? -1 : 1), lng = (+d[5] + d[6] / 60 + d[7] / 3600) * (/W/i.test(d[8]) ? -1 : 1);
    if (SURAT_BOX(lat, lng)) return { lat, lng, how: 'dms' };
  }
  const plain = s.match(new RegExp(`(?:^|[^\\d.])${num}\\s*,\\s*${num}(?:[^\\d]|$)`));
  if (plain && SURAT_BOX(+plain[1], +plain[2])) return { lat: +plain[1], lng: +plain[2], how: 'text' };
  const pc = s.match(/\b([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3})\b/i);
  if (pc) { const r = decodePlus(pc[1].toUpperCase()); if (r && SURAT_BOX(r.lat, r.lng)) return { ...r, how: 'plus' }; }
  return null;
}
export const firstUrl = (text) => (String(text || '').match(/https?:\/\/[^\s<>"']+/) || [null])[0];
export const isMapsUrl = (u) => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|g\.co\/kgs|share\.google)/i.test(u || '');
// Short links (maps.app.goo.gl) hide the coordinates behind a redirect that a web page cannot follow,
// so our own Worker follows it and hands back the final address.
export async function resolveMapsLink(text) {
  const direct = coordsFromText(text); if (direct) return direct;
  const u = firstUrl(text); if (!u || !isMapsUrl(u)) return null;
  const r = await fetch('/resolve?u=' + encodeURIComponent(u));
  if (!r.ok) throw new Error('link');
  const j = await r.json();
  const c = coordsFromText(j.url) || coordsFromText(j.body);
  return c ? { ...c, name: j.name || null } : (j.name ? { name: j.name } : null);
}

// Open Location Code (plus code) decoder, full and short codes (short ones relative to Surat).
const PC = '23456789CFGHJMPQRVWX';
function decodePlus(code) {
  code = code.replace('+', '');
  if (code.length < 8) { // short code: recover with Surat as the reference
    const ref = encodePlus(21.17, 72.83).replace('+', '');
    code = ref.slice(0, 8 - code.length) + code;
  }
  let lat = -90, lng = -180, res = 20;
  for (let i = 0; i < Math.min(code.length, 10); i += 2) {
    lat += PC.indexOf(code[i]) * res; lng += PC.indexOf(code[i + 1]) * res;
    if (i < 8) res /= 20;
  }
  const r = res; // last resolution
  return { lat: lat + r / 2, lng: lng + r / 2 };
}
function encodePlus(lat, lng) {
  let la = lat + 90, ln = lng + 180, out = '', res = 20;
  for (let i = 0; i < 5; i++) { const a = Math.floor(la / res), b = Math.floor(ln / res); out += PC[a] + PC[b]; la -= a * res; ln -= b * res; res /= 20; }
  return out.slice(0, 8) + '+' + out.slice(8);
}

// ---------- OpenStreetMap: roads and facilities around a point ----------
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
async function overpass(q) {
  let last;
  for (const host of OVERPASS) {
    try {
      const r = await fetch(host, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (r.ok) return await r.json();
      last = new Error('overpass ' + r.status);
    } catch (e) { last = e; }
  }
  throw last || new Error('overpass');
}
// distance (km) from a point to a polyline
function distToLine(lat, lng, geom) {
  const kx = 111.32 * Math.cos(lat * Math.PI / 180), ky = 110.57;
  let best = Infinity;
  for (let i = 1; i < geom.length; i++) {
    const ax = (geom[i - 1].lon - lng) * kx, ay = (geom[i - 1].lat - lat) * ky, bx = (geom[i].lon - lng) * kx, by = (geom[i].lat - lat) * ky;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let tt = L ? -(ax * dx + ay * dy) / L : 0; tt = Math.max(0, Math.min(1, tt));
    const px = ax + tt * dx, py = ay + tt * dy; best = Math.min(best, Math.hypot(px, py));
  }
  return best;
}
const CLASS_RANK = { motorway: 6, trunk: 5, primary: 4, secondary: 3, tertiary: 2, unclassified: 1, residential: 1, living_street: 0, service: 0, track: -1 };
// Typical width by OSM road class when the map has no width tag (Indian practice, metres).
const CLASS_WIDTH = { motorway: 45, trunk: 30, primary: 24, secondary: 18, tertiary: 12, unclassified: 9, residential: 9, living_street: 6, service: 6, track: 4 };
export async function roadsAround(lat, lng, cache) {
  const key = `osm.roads.${lat.toFixed(4)},${lng.toFixed(4)}`;
  const c = cache.get(key, null); if (c) return c;
  const q = `[out:json][timeout:25];(way(around:6000,${lat},${lng})["highway"~"^(motorway|trunk)$"];way(around:2500,${lat},${lng})["highway"="primary"];way(around:150,${lat},${lng})["highway"~"^(secondary|tertiary|unclassified|residential|living_street|service|track)$"];node(around:3000,${lat},${lng})["railway"="station"];node(around:3000,${lat},${lng})["station"="subway"];);out tags geom;`;
  const j = await overpass(q);
  const ways = (j.elements || []).filter((e) => e.type === 'way' && e.geometry).map((w) => ({ cls: w.tags.highway, ref: w.tags.ref || '', name: w.tags['name:en'] || w.tags.name || '', width: parseFloat(w.tags.width) || null, lanes: +w.tags.lanes || null, d: distToLine(lat, lng, w.geometry) }));
  const hw = ways.filter((w) => w.cls === 'motorway' || w.cls === 'trunk').sort((a, b) => a.d - b.d)[0] || null;
  const sh = ways.filter((w) => w.cls === 'primary').sort((a, b) => a.d - b.d)[0] || null;
  // the road the plot actually opens onto: nearest within ~60 m, preferring bigger roads when equally close
  const front = ways.filter((w) => w.d <= 0.06).sort((a, b) => (a.d - b.d) || ((CLASS_RANK[b.cls] || 0) - (CLASS_RANK[a.cls] || 0)))[0]
    || ways.filter((w) => w.d <= 0.15).sort((a, b) => a.d - b.d)[0] || null;
  const width = front ? front.width || (front.lanes ? front.lanes * 3.5 + 3 : CLASS_WIDTH[front.cls] || 9) : null;
  const stations = (j.elements || []).filter((e) => e.type === 'node' && e.tags && (e.tags.railway === 'station' || e.tags.station === 'subway')).map((n) => ({ name: n.tags['name:en'] || n.tags.name || '', metro: n.tags.station === 'subway' || /metro/i.test(n.tags.network || ''), d: km(lat, lng, n.lat, n.lon) })).sort((a, b) => a.d - b.d);
  const out = {
    at: Date.now(),
    highway: hw && { ref: hw.ref || hw.name, cls: hw.cls, d: +hw.d.toFixed(2) },
    state: sh && { ref: sh.ref || sh.name, d: +sh.d.toFixed(2) },
    front: front && { cls: front.cls, name: front.name || front.ref, d: Math.round(front.d * 1000), width: Math.round(width), tagged: !!(front.width || front.lanes) },
    rail: stations.find((x) => !x.metro) || null, metro: stations.find((x) => x.metro) || null,
  };
  try { cache.set(key, out); } catch { /* full */ }
  return out;
}
const AMENITY = {
  school: '["amenity"~"^(school|college|university)$"]', hospital: '["amenity"~"^(hospital|clinic)$"]', market: '["shop"~"^(supermarket|mall|department_store)$"]',
  bank: '["amenity"~"^(bank|atm)$"]', bus: '["highway"="bus_stop"]', worship: '["amenity"="place_of_worship"]', park: '["leisure"~"^(park|garden)$"]', fuel: '["amenity"="fuel"]',
};
export async function facilitiesAround(lat, lng, cache, radius = 2000) {
  const key = `osm.fac.${lat.toFixed(4)},${lng.toFixed(4)}.${radius}`;
  const c = cache.get(key, null); if (c) return c;
  const q = '[out:json][timeout:25];(' + Object.values(AMENITY).map((f) => `node(around:${radius},${lat},${lng})${f};way(around:${radius},${lat},${lng})${f};`).join('') + ');out center tags 400;';
  const j = await overpass(q);
  const out = {};
  for (const e of j.elements || []) {
    const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon; if (la == null) continue;
    const tg = e.tags || {};
    const kind = /school|college|university/.test(tg.amenity) ? 'school' : /hospital|clinic/.test(tg.amenity) ? 'hospital' : tg.shop ? 'market' : /bank|atm/.test(tg.amenity) ? 'bank'
      : tg.highway === 'bus_stop' ? 'bus' : tg.amenity === 'place_of_worship' ? 'worship' : tg.leisure ? 'park' : tg.amenity === 'fuel' ? 'fuel' : null;
    if (!kind) continue;
    (out[kind] ||= []).push({ name: tg['name:en'] || tg.name || tg['name:gu'] || '', gu: tg['name:gu'] || '', d: +km(lat, lng, la, lo).toFixed(2), lat: la, lng: lo });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.d - b.d);
  try { cache.set(key, out); } catch { /* full */ }
  return out;
}
