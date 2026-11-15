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
  // Directions share ("geocode=FYo6QwEd…;FSs9QwEd…&daddr=Place"): the last block is the destination, as
  // two little-endian int32 numbers (micro-degrees). saddr is only where the sender was standing.
  const gc = s.match(/[?&]geocode=([^&]+)/);
  if (gc) {
    try {
      const last = gc[1].split(';').filter(Boolean).pop().replace(/-/g, '+').replace(/_/g, '/');
      const b = Uint8Array.from(atob(last), (c) => c.charCodeAt(0)), dv = new DataView(b.buffer);
      if (b[0] === 0x15 && b[5] === 0x1d) { const lat = dv.getInt32(1, true) / 1e6, lng = dv.getInt32(6, true) / 1e6; if (SURAT_BOX(lat, lng)) return { lat, lng, how: 'dest' }; }
    } catch { /* not that format */ }
  }
  s = s.replace(/[?&]saddr=[^&]*/g, '');
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
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://z.overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
// Ask two public Overpass servers at once and take whichever answers first (they are often busy).
async function overpass(q) {
  const ctrls = OVERPASS.map(() => new AbortController());
  const timer = setTimeout(() => ctrls.forEach((c) => c.abort()), 45000);
  try {
    return await Promise.any(OVERPASS.map(async (host, i) => {
      const r = await fetch(host, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctrls[i].signal });
      if (!r.ok) throw new Error('overpass ' + r.status);
      const j = await r.json();
      ctrls.forEach((c, k) => { if (k !== i) c.abort(); });
      return j;
    }));
  } catch (e) { throw new Error('overpass'); } finally { clearTimeout(timer); }
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

// ---------- all national & state highways around Surat, fetched once in the background and kept on the phone ----------
// Then "how far is the highway" is answered instantly everywhere, without asking the map server each time.
let HW = null;
export async function loadHighways(cache) {
  const c = cache.get('osm.hw.v1', null);
  if (c && Date.now() - c.at < 30 * 864e5) { HW = c.ways; return HW; }
  const j = await overpass('[out:json][timeout:150];way(20.75,72.45,21.75,73.45)["highway"~"^(motorway|trunk|primary)$"];out tags geom;');
  const ways = [];
  for (const w of j.elements || []) {
    if (!w.geometry || w.geometry.length < 2 || !/^(motorway|trunk|primary)$/.test((w.tags || {}).highway || '')) continue;
    const g = []; let last = null;
    for (const p of w.geometry) if (!last || Math.hypot((p.lat - last.lat) * 110, (p.lon - last.lon) * 104) > 0.15) { g.push([+p.lat.toFixed(4), +p.lon.toFixed(4)]); last = p; }
    const e = w.geometry[w.geometry.length - 1]; g.push([+e.lat.toFixed(4), +e.lon.toFixed(4)]);
    ways.push({ c: w.tags.highway === 'primary' ? 'p' : 't', r: String(w.tags.ref || '').split(';')[0].toUpperCase(), n: w.tags['name:en'] || w.tags.name || '', g });
  }
  HW = ways;
  try { cache.set('osm.hw.v1', { at: Date.now(), ways }); } catch { /* storage full: keep in memory */ }
  return HW;
}
function hwNear(lat, lng) {
  if (!HW) return null;
  let t = null, p = null;
  for (const w of HW) {
    if (Math.abs(w.g[0][0] - lat) > 0.6 || Math.abs(w.g[0][1] - lng) > 0.6) { /* quick reject on far ways */ const m = w.g[w.g.length >> 1]; if (Math.abs(m[0] - lat) > 0.6 || Math.abs(m[1] - lng) > 0.6) continue; }
    const d = distToLine(lat, lng, w.g.map(([a, b]) => ({ lat: a, lon: b })));
    if (w.c === 't') { if (!t || d < t.d) t = { ref: w.r || w.n, cls: 'trunk', d }; } else if (!p || d < p.d) p = { ref: w.r || w.n, d };
  }
  return { highway: t && t.d <= 25 ? { ...t, d: +t.d.toFixed(2) } : null, state: p && p.d <= 25 ? { ...p, d: +p.d.toFixed(2) } : null };
}
// Bearing (degrees, 0-180) of the segment of a line nearest to the point.
function nearBearing(lat, lng, geom) {
  const kx = 111.32 * Math.cos(lat * Math.PI / 180), ky = 110.57;
  let best = Infinity, brg = 0;
  for (let i = 1; i < geom.length; i++) {
    const ax = (geom[i - 1].lon - lng) * kx, ay = (geom[i - 1].lat - lat) * ky, bx = (geom[i].lon - lng) * kx, by = (geom[i].lat - lat) * ky;
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let tt = L ? -(ax * dx + ay * dy) / L : 0; tt = Math.max(0, Math.min(1, tt));
    const d = Math.hypot(ax + tt * dx, ay + tt * dy);
    if (d < best) { best = d; brg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 180; }
  }
  return brg;
}
// Everything the map knows about one spot, in one request: roads (front road, width, corner), highways,
// stations, canals, land use and which municipal/village boundary it falls in.
export async function roadsAround(lat, lng, cache) {
  const key = `osm.spot2.${lat.toFixed(4)},${lng.toFixed(4)}`;
  const c = cache.get(key, null); if (c) return c;
  const P = `${lat},${lng}`;
  const q = `[out:json][timeout:25];
is_in(${P})->.a;area.a["boundary"="administrative"];out tags;
(${HW ? '' : `way(around:6000,${P})["highway"~"^(motorway|trunk)$"];way(around:2500,${P})["highway"="primary"];`}way(around:150,${P})["highway"~"^(secondary|tertiary|unclassified|residential|living_street|service|track)$"];node(around:3000,${P})["railway"="station"];node(around:3000,${P})["station"="subway"];way(around:1000,${P})["waterway"~"^(canal|ditch)$"];);out tags geom;
way(around:40,${P})["landuse"];out tags;
way(around:30,${P})["building"];out tags 3;`;
  const j = await overpass(q);
  const els = j.elements || [];
  const ways = els.filter((e) => e.type === 'way' && e.geometry && e.tags && e.tags.highway).map((w) => ({ id: w.id, cls: w.tags.highway, ref: w.tags.ref || '', name: w.tags['name:en'] || w.tags.name || '', width: parseFloat(w.tags.width) || null, lanes: +w.tags.lanes || null, d: distToLine(lat, lng, w.geometry), brg: nearBearing(lat, lng, w.geometry) }));
  let hw = ways.filter((w) => w.cls === 'motorway' || w.cls === 'trunk').sort((a, b) => a.d - b.d)[0] || null;
  let sh = ways.filter((w) => w.cls === 'primary').sort((a, b) => a.d - b.d)[0] || null;
  const hn = hwNear(lat, lng);
  if (hn) { if (hn.highway && (!hw || hn.highway.d < hw.d)) hw = hn.highway; if (hn.state && (!sh || hn.state.d < sh.d)) sh = hn.state; }
  // the road the plot actually opens onto: nearest within ~60 m, preferring bigger roads when equally close
  const front = ways.filter((w) => w.d <= 0.06).sort((a, b) => (a.d - b.d) || ((CLASS_RANK[b.cls] || 0) - (CLASS_RANK[a.cls] || 0)))[0]
    || ways.filter((w) => w.d <= 0.15).sort((a, b) => a.d - b.d)[0] || null;
  const widthOf = (w) => w.width || (w.lanes ? w.lanes * 3.5 + 3 : CLASS_WIDTH[w.cls] || 9);
  // Corner: two real roads within ~35 m of the spot that cross at a clear angle.
  const close = ways.filter((w) => w.d <= 0.035 && w.cls !== 'track');
  let corner = null;
  for (let i = 0; i < close.length && !corner; i++) for (let k = i + 1; k < close.length; k++) {
    const diff = Math.abs(close[i].brg - close[k].brg), ang = Math.min(diff, 180 - diff);
    if (ang >= 45 && (close[i].name !== close[k].name || !close[i].name)) { corner = { a: close[i].name || close[i].cls, b: close[k].name || close[k].cls, w2: Math.round(widthOf(close[k])) }; break; }
  }
  const stations = els.filter((e) => e.type === 'node' && e.tags && (e.tags.railway === 'station' || e.tags.station === 'subway')).map((n) => ({ name: n.tags['name:en'] || n.tags.name || '', metro: n.tags.station === 'subway' || /metro/i.test(n.tags.network || ''), d: km(lat, lng, n.lat, n.lon) })).sort((a, b) => a.d - b.d);
  const canal = els.filter((e) => e.type === 'way' && e.geometry && e.tags && e.tags.waterway).map((w) => ({ name: w.tags.name || '', d: distToLine(lat, lng, w.geometry) })).sort((a, b) => a.d - b.d)[0] || null;
  const landuse = (els.find((e) => e.type === 'way' && e.tags && e.tags.landuse && !e.geometry) || {}).tags?.landuse || null;
  const built = els.some((e) => e.type === 'way' && e.tags && e.tags.building && !e.geometry);
  const bounds = els.filter((e) => e.type === 'area' && e.tags).map((a) => ({ name: a.tags['name:en'] || a.tags.name || '', level: +a.tags.admin_level || 0 }));
  const muni = bounds.find((b) => /surat/i.test(b.name) && b.level >= 7 && b.level <= 8) || null;
  const village = bounds.filter((b) => b.level >= 9).sort((a, b) => b.level - a.level)[0] || null;
  const out = {
    at: Date.now(),
    highway: hw && { ref: hw.ref || hw.name, cls: hw.cls, d: +hw.d.toFixed(2) },
    state: sh && { ref: sh.ref || sh.name, d: +sh.d.toFixed(2) },
    front: front && { cls: front.cls, name: front.name || front.ref, d: Math.round(front.d * 1000), width: Math.round(widthOf(front)), tagged: !!(front.width || front.lanes) },
    corner, roadsNear: close.length,
    rail: stations.find((x) => !x.metro) || null, metro: stations.find((x) => x.metro) || null,
    canal: canal && { name: canal.name, d: +canal.d.toFixed(2) }, landuse, built,
    muni: muni && muni.name, village: village && village.name, bounds: bounds.map((b) => `${b.name}:${b.level}`),
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

// ---------- fast first answer (about 1 second): road + city/village from Nominatim, highways from the phone's copy ----------
// The full map read (corner, canal, land use, metro) comes from Overpass, which is often slow; this shows something at once.
export async function quickFacts(lat, lng, cache) {
  const key = `osm.quick.${lat.toFixed(4)},${lng.toFixed(4)}`;
  const c = cache.get(key, null); if (c) return c;
  const ctrl = new AbortController(), tm = setTimeout(() => ctrl.abort(), 12000);
  let r = {};
  try { r = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'en' }, signal: ctrl.signal })).json(); } finally { clearTimeout(tm); }
  const ad = r.address || {};
  const cls = r.category === 'highway' ? r.type : null;
  const hn = hwNear(lat, lng) || {};
  const city = ad.city || ad.town || '';
  const out = {
    quick: true, at: Date.now(),
    label: [ad.road, ad.neighbourhood || ad.suburb || ad.village || ad.town].filter(Boolean).join(', ') || r.name || null,
    front: cls ? { cls, name: r.name || ad.road || '', d: 0, width: CLASS_WIDTH[cls] || 9, tagged: false } : ad.road ? { cls: 'residential', name: ad.road, d: 0, width: 9, tagged: false, guess: true } : null,
    highway: hn.highway || null, state: hn.state || null,
    muni: /surat/i.test(city) && !ad.village ? 'Surat' : null, village: ad.village || ad.hamlet || null,
    address: ad,
  };
  try { cache.set(key, out); } catch { /* full */ }
  return out;
}
