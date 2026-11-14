import { t, getLang, setLang, money, moneyShort, fmtDate } from './i18n.js';
import { AREAS, SURAT, areaById, areaName, km, searchAreas, findAreaInText } from './areas.js';
import { UNITS, unitsFor, inBounds, PTYPES, sqftPer, toSqft, rateToSqft, rateFromSqft, defaultUnit, summarize, emi, DEFAULT_VIGHA_SQFT } from './units.js';
import { parseEntry } from './parse.js';
import { store, cloud, cfg, lock, DEFAULT_SB_URL } from './store.js';

const S = {
  tab: 'today', newsCat: 'all', inqFilter: 'all', mapType: 'flat', mapSel: null, map: null,
  price: { area: 'piplod', ptype: 'flat', unit: null, furnished: false, stat: 'range', grade: 'all' },
  data: { properties: [], inquiries: [], deals: [], price_points: [], news: [], market: [], customers: [], activities: [], tasks: [], brokers: [], area_notes: [] },
  insights: [], tags: {}, crmView: 'list', crmQ: '',
};
const vigha = () => Number(cfg.get('vigha', DEFAULT_VIGHA_SQFT)) || DEFAULT_VIGHA_SQFT;
const $ = (s) => document.querySelector(s);

// ---------- small DOM helpers ----------
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false || k === 'value') continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(9)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  if (attrs && attrs.value != null) e.value = attrs.value;
  return e;
}
const SVG = {
  today: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
  map: '<path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.800 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  prices: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  inquiries: '<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  customers: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20a6.500 6.500 0 0 1 13 0M16 4.500a3.500 3.500 0 0 1 0 7M18 14.500a6 6 0 0 1 3.500 5.500"/>',
  more: '<circle cx="5" cy="12" r="1.600"/><circle cx="12" cy="12" r="1.600"/><circle cx="19" cy="12" r="1.600"/>',
  properties: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M4.900 19.100L7 17M17 7l2.100-2.100"/>',
  loc: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
  search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>',
  chev: '<polyline points="9,5 16,12 9,19"/>', down: '<polyline points="6,9 12,15 18,9"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const icon = (name, size = 24) => h('span', { class: 'ic', 'aria-hidden': 'true', html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SVG[name]}</svg>` });
const MARK = '<path stroke-linejoin="round" d="M78.6 24.3 A40 40 0 1 0 70 83.4 L70 49.2"/><path d="M26 56 L52 34 L78 56"/><path d="M34 49.2 V87.5"/><path d="M34 67 H70"/>';
const mark = (size, sw = 6) => h('span', { class: 'mark', role: 'img', 'aria-label': 'Ami Realtors', html: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" stroke="#E3B341" stroke-width="${sw}">${MARK}</svg>` });

function toast(msg, bad) {
  const el = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, msg);
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}
const fail = (e) => { console.error(e); toast(t('error') + ': ' + (e.message || e), true); };

function openSheet(title, build) {
  const body = h('div', { class: 'sheet-body' });
  const wrap = h('div', { class: 'sheet-wrap', onclick: (e) => { if (e.target === wrap) close(); } },
    h('div', { class: 'sheet', role: 'dialog', 'aria-label': title },
      h('div', { class: 'sheet-hd' }, h('h2', {}, title), h('button', { class: 'iconbtn', 'aria-label': t('close'), onclick: () => close() }, icon('x'))),
      body));
  function close() { wrap.remove(); }
  const api = { close, body, redraw: () => { body.replaceChildren(...[].concat(build(api)).flat(9).filter(Boolean)); } };
  api.redraw();
  document.body.append(wrap);
  return api;
}

const field = (label, input) => h('label', { class: 'field' }, h('span', {}, label), input);
const inp = (o, key, attrs = {}) => h('input', { class: 'input', value: o[key] ?? '', oninput: (e) => { o[key] = e.target.value; }, ...attrs });
const numInp = (o, key, attrs = {}) => inp(o, key, { inputmode: 'decimal', ...attrs });
const chips = (opts, cur, onPick, cls = '') => h('div', { class: 'chips ' + cls }, opts.map(([v, label]) => h('button', { type: 'button', class: 'chip' + (v === cur ? ' on' : ''), 'aria-pressed': String(v === cur), onclick: () => onPick(v) }, label)));
const seg = (opts, cur, onPick) => h('div', { class: 'seg', style: `grid-template-columns: repeat(${opts.length}, minmax(0, 1fr))` }, opts.map(([v, label]) => h('button', { type: 'button', class: v === cur ? 'on' : '', 'aria-pressed': String(v === cur), onclick: () => onPick(v) }, label)));
const N = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
const unitLabel = (u) => t('u_' + u);

function pickArea(onPick) {
  let q = '';
  const sh = openSheet(t('area'), () => {
    const list = h('div', { class: 'list' });
    const draw = () => list.replaceChildren(...searchAreas(q).map((a) => h('button', { class: 'row', onclick: () => { sh.close(); onPick(a); } },
      h('span', {}, areaName(a, getLang())), h('span', { class: 'muted' }, a.en === areaName(a, getLang()) ? a.district : a.en))));
    const box = h('input', { class: 'input', placeholder: t('search_area'), autocapitalize: 'none', autocomplete: 'off', oninput: (e) => { q = e.target.value; draw(); } });
    draw();
    setTimeout(() => box.focus(), 50);
    return [box, list];
  });
}
const areaBtn = (o, key, redraw) => h('button', { type: 'button', class: 'input pick', onclick: () => pickArea((a) => { o[key] = a.id; redraw(); }) },
  h('span', { class: o[key] ? '' : 'muted' }, o[key] ? areaName(areaById(o[key]), getLang()) : t('area')), icon('down', 18));

// ---------- data ----------
async function load() {
  for (const table of Object.keys(S.data)) {
    try { S.data[table] = await store.list(table); } catch (e) { S.data[table] = []; if (cloud.ready) fail(e); }
  }
  // Public data written by the daily agent ships with the site as plain files.
  const pub = async (f) => { try { const r = await fetch('data/' + f + '.json', { cache: 'no-store' }); return r.ok ? await r.json() : []; } catch { return []; } };
  const [news, market, prices, insights, tags, leads, pprices] = await Promise.all([pub('news'), pub('market'), pub('prices'), pub('insights'), pub('tags'), pub('leads'), pub('project_prices')]);
  S.leads = Array.isArray(leads) ? leads : []; S.projPrices = pprices && !Array.isArray(pprices) ? pprices : {};
  loadProjects().then(() => { if (S.tab === 'prices' || S.tab === 'properties') render(); });
  addMyAreas(); S.villagesLoaded = false; loadVillages(); loadRiver();
  S.insights = Array.isArray(insights) ? insights : []; S.tags = tags && !Array.isArray(tags) ? tags : {};
  if (news.length) S.data.news = news.sort((a, b) => String(b.published_on).localeCompare(String(a.published_on)));
  if (market.length) S.data.market = market.sort((a, b) => String(b.day).localeCompare(String(a.day)));
  S.fits = null;
  S.data.price_points = S.data.price_points.filter((p) => !p.pub).concat(prices.map((p, i) => ({ ...p, id: p.id || 'pub-' + i, pub: true })));
  await ensureCustomers();
}
async function saveRec(table, rec) { const row = await store.save(table, rec); const a = S.data[table], i = a.findIndex((r) => r.id === row.id); if (i >= 0) a[i] = row; else a.push(row); return row; }
async function delRec(table, id) { await store.remove(table, id); S.data[table] = S.data[table].filter((r) => r.id !== id); }

const rate = (v, unit) => (v == null ? '—' : money(rateFromSqft(v, unit, vigha())));
const pct = (a, b) => (a && b ? (a >= b ? '+' : '') + Math.round(((a - b) / b) * 100) + '%' : null);

// ---------- Map ----------
function viewMap() {
  return [
    h('div', { id: 'map' }),
    h('div', { class: 'map-top' },
      h('label', { class: 'searchbox' }, icon('search', 20),
        h('input', { id: 'mapq', placeholder: t('search_area'), 'aria-label': 'Search area', autocapitalize: 'none', autocomplete: 'off', enterkeyhint: 'search', oninput: mapSuggest, onkeydown: (e) => { if (e.key === 'Enter') mapSearch(e.target.value); } })),
      h('div', { id: 'mapsug', class: 'sug' }),
      h('button', { class: 'locbtn', 'aria-label': t('my_location'), onclick: myLocation }, icon('loc', 20), h('span', {}, t('my_location'))),
      chips([['flat', `${t('flat')} · ${t('u_sqft')}`], ['plot', `${t('plot')} · ${t('u_var')}`], ['land', `${t('land')} · ${t('u_vigha')}`], ['industrial', `${t('industrial')} · ${t('u_sqft')}`]], S.mapType, (v) => { S.mapType = v; render(); }, 'onmap scroll')),
    h('div', { id: 'mapcard' }),
  ];
}
function initMap() {
  const L = window.L;
  const sel = S.mapSel && areaById(S.mapSel);
  S.map = L.map('map', { zoomControl: false, attributionControl: true }).setView(sel ? [sel.lat, sel.lng] : [SURAT.lat, SURAT.lng], sel ? 13 : 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(S.map);
  S.layer = L.layerGroup().addTo(S.map);
  S.map.on('moveend', drawPins);
  S.map.on('click', (e) => showSpot(e.latlng.lat, e.latlng.lng));
  S.border = null; S.spot = null;
  if (S.spotAt) setTimeout(() => showSpot(S.spotAt.lat, S.spotAt.lng, S.spotAt.label), 0);
  drawPins();
  drawMapCard();
  if (sel) drawBorder(sel);
}
// Area outline. Uses the OpenStreetMap boundary when one exists, otherwise a dashed approximate circle.
async function drawBorder(a) {
  const L = window.L;
  if (S.border) { S.border.remove(); S.border = null; }
  if (!a || !S.map) return;
  const key = 'border.' + a.id;
  let g = cfg.get(key, undefined);
  if (g === undefined) {
    try {
      const q = `${a.en.replace(/\s*\(.*\)/, '')}, ${a.district}, Gujarat`;
      const r = await (await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&polygon_geojson=1&polygon_threshold=0.0005&countrycodes=in&q=' + encodeURIComponent(q), { headers: { 'Accept-Language': 'en' } })).json();
      const gj = r[0] && r[0].geojson;
      g = gj && /Polygon/.test(gj.type) && km(a.lat, a.lng, Number(r[0].lat), Number(r[0].lon)) < 8 ? gj : null;
      try { cfg.set(key, g); } catch { /* storage full: just refetch next time */ }
    } catch { g = null; }
  }
  if (S.mapSel !== a.id || !S.map) return;
  if (S.border) S.border.remove();
  const style = { color: '#0E3B2E', weight: 2.5, fillColor: '#E3B341', fillOpacity: 0.12, interactive: false };
  S.border = g ? L.geoJSON(g, { style }).addTo(S.map) : L.circle([a.lat, a.lng], { radius: 900, dashArray: '6 6', ...style }).addTo(S.map);
}
// ---------- nearby estimate (k nearest areas with prices) ----------
// For a place or street with no quotes of its own, the price is the inverse-distance weighted average
// of the nearest areas that do have quotes. Only areas within 15 km count, and the card names them.
// ---------- model price (for any spot without its own quotes) ----------
// Plain "average of neighbours" copied city prices into far villages. The model instead combines:
//  1. City trend: prices fall with distance from the old city (Chowk). Fitted on every area with real quotes,
//     as ln(price) = a + b * km, so a village 15 km out is priced like a place 15 km out, not like Vesu.
//  2. Local adjustment: how much the closest real areas sit above or below that trend. It counts fully within
//     about 2 km and fades to nothing by ~6 km, so far areas cannot pull a village up.
//  3. Jantri anchor: where the spot has a jantri rate, market = jantri x the usual markup seen in nearby areas
//     that have both. If jantri is low, the model price is low too.
// It returns the value, a low-high band and a confidence, and says how it was built.
const MODEL_LOCAL_KM = 6, MODEL_SHRINK = 1 / 9;
// The Tapi splits Surat: Adajan and Nanpura are 1 km apart but different markets. The river line comes from
// OpenStreetMap once and is cached; two points are on opposite banks when the line between them crosses it an odd number of times.
const RIVER_KEY = 'river.tapi.v1';
async function loadRiver() {
  const c = cfg.get(RIVER_KEY, null);
  if (c) { S.river = c; return; }
  // Bundled copy first (works offline), then OpenStreetMap for the full river.
  try { const r = await fetch('data/tapi.json'); if (r.ok) { const j = await r.json(); if (j.segments && j.segments.length) { S.river = j.segments; S.fits = null; if (S.map) { drawPins(); drawMapCard(); } return; } } } catch { /* fall through */ }
  const q = '[out:json][timeout:40];way["waterway"="river"]["name"~"Tapi|Tapti|તાપી",i](20.95,72.55,21.45,73.20);out geom;';
  for (const host of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    try {
      const r = await fetch(host, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!r.ok) continue;
      const j = await r.json();
      const segs = [];
      for (const w of j.elements || []) for (let i = 1; i < (w.geometry || []).length; i++) segs.push([w.geometry[i - 1].lat, w.geometry[i - 1].lon, w.geometry[i].lat, w.geometry[i].lon].map((x) => +x.toFixed(5)));
      if (segs.length) { S.river = segs; try { cfg.set(RIVER_KEY, segs); } catch { /* full */ } S.fits = null; if (S.map) { drawPins(); drawMapCard(); } }
      return;
    } catch { /* next server */ }
  }
}
function crossesRiver(aLat, aLng, bLat, bLng) {
  if (!S.river) return false;
  const ccw = (ax, ay, bx, by, cx, cy) => (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
  let n = 0;
  for (const [y1, x1, y2, x2] of S.river) {
    if (Math.max(x1, x2) < Math.min(aLng, bLng) || Math.min(x1, x2) > Math.max(aLng, bLng) || Math.max(y1, y2) < Math.min(aLat, bLat) || Math.min(y1, y2) > Math.max(aLat, bLat)) continue;
    if (ccw(aLng, aLat, x1, y1, x2, y2) !== ccw(bLng, bLat, x1, y1, x2, y2) && ccw(aLng, aLat, bLng, bLat, x1, y1) !== ccw(aLng, aLat, bLng, bLat, x2, y2)) n++;
  }
  return n % 2 === 1;
}
const sameBank = (lat, lng, a) => !crossesRiver(lat, lng, a.lat, a.lng);
const coreKm = (lat, lng) => km(SURAT.lat, SURAT.lng, lat, lng);
function trendFit(ptype) {
  S.fits ||= {};
  if (S.fits[ptype]) return S.fits[ptype];
  const pts = AREAS.filter((a) => !a.ind).map((a) => ({ a, d: coreKm(a.lat, a.lng), v: stats(a.id, ptype, 'market', null).median })).filter((x) => x.v != null && x.d <= 60);
  let fit = null;
  if (pts.length >= 5) {
    const n = pts.length, mx = pts.reduce((s, x) => s + x.d, 0) / n, my = pts.reduce((s, x) => s + Math.log(x.v), 0) / n;
    let sxy = 0, sxx = 0; for (const x of pts) { sxy += (x.d - mx) * (Math.log(x.v) - my); sxx += (x.d - mx) ** 2; }
    let b = sxx ? sxy / sxx : 0; b = Math.min(0, Math.max(-0.08, b)); // never rising with distance, never steeper than -8% per km
    const a0 = my - b * mx;
    fit = { a: a0, b, pts: pts.map((x) => ({ ...x, r: Math.log(x.v) - (a0 + b * x.d) })) };
  }
  // markup = market / jantri, from areas having both
  const mk = AREAS.filter((a) => !a.ind).map((a) => { const m = stats(a.id, ptype, 'market', null).median, j = stats(a.id, ptype, 'jantri').median; return m && j ? { a, m: m / j } : null; }).filter(Boolean);
  return (S.fits[ptype] = { fit, mk });
}
function jantriAt(lat, lng, ptype) {
  const c = AREAS.filter((a) => !a.ind && sameBank(lat, lng, a)).map((a) => ({ a, d: km(lat, lng, a.lat, a.lng) })).filter((x) => x.d <= 2.5).sort((x, y) => x.d - y.d);
  for (const x of c) { const j = stats(x.a.id, ptype, 'jantri').median; if (j != null) return { j, a: x.a, d: x.d }; }
  return null;
}
function knn(lat, lng, ptype, skipId) {
  if (ptype === 'industrial') {
    // industrial: only other estates / industrial quotes within 12 km
    const near = AREAS.filter((a) => a.id !== skipId).map((a) => ({ a, d: km(lat, lng, a.lat, a.lng) })).filter((x) => x.d <= 12 && sameBank(lat, lng, x.a)).sort((x, y) => x.d - y.d)
      .map((x) => ({ ...x, v: stats(x.a.id, 'industrial', 'market', null).median ?? stats(x.a.id, 'industrial', 'gidc').median })).filter((x) => x.v != null).slice(0, 3);
    if (!near.length) return null;
    let w = 0, s = 0; for (const x of near) { const wi = 1 / Math.max(0.5, x.d) ** 2; w += wi; s += wi * x.v; }
    return { value: s / w, near, conf: near[0].d < 3 ? 'mid' : 'low', lo: (s / w) * 0.7, hi: (s / w) * 1.3, parts: [] };
  }
  const { fit, mk } = trendFit(ptype), d0 = coreKm(lat, lng);
  const near = fit ? fit.pts.filter((x) => x.a.id !== skipId).map((x) => ({ ...x, dd: km(lat, lng, x.a.lat, x.a.lng) })).filter((x) => x.dd <= MODEL_LOCAL_KM && sameBank(lat, lng, x.a)).sort((x, y) => x.dd - y.dd).slice(0, 4) : [];
  const parts = []; let logv = null, conf = 'low';
  if (fit) {
    let w = 0, s = 0; for (const x of near) { const wi = 1 / Math.max(0.5, x.dd) ** 2; w += wi; s += wi * x.r; }
    const adj = s / (w + MODEL_SHRINK), trend = fit.a + fit.b * d0;
    logv = trend + adj;
    parts.push(['trend', Math.exp(trend), d0]); if (near.length) parts.push(['local', Math.round((Math.exp(adj) - 1) * 100)]);
    if (near.length && near[0].dd <= 2.5) conf = 'mid';
  }
  const ja = jantriAt(lat, lng, ptype);
  if (ja && mk.length) {
    const loc = mk.filter((x) => sameBank(lat, lng, x.a)).map((x) => ({ ...x, d: km(lat, lng, x.a.lat, x.a.lng) })).sort((x, y) => x.d - y.d).slice(0, 5).map((x) => x.m).sort((x, y) => x - y);
    const markup = loc[Math.floor(loc.length / 2)], jv = ja.j * markup;
    parts.push(['jantri', ja.j, markup]);
    logv = logv == null ? Math.log(jv) : (logv + 2 * Math.log(jv)) / 3; // jantri is local and official, so it counts double
    conf = 'mid';
  }
  if (logv == null && ptype !== 'flat') {
    // Too few quotes for this type: use the flat model times the type-to-flat ratio seen in areas that have both.
    const r = AREAS.map((a) => { const x = stats(a.id, ptype, 'market', null).median, f = stats(a.id, 'flat', 'market', null).median; return x && f ? x / f : null; }).filter(Boolean).sort((x, y) => x - y);
    const fl = r.length >= 2 ? knn(lat, lng, 'flat', skipId) : null;
    if (fl) { const k = r[Math.floor(r.length / 2)]; return { ...fl, value: fl.value * k, lo: fl.lo * k * 0.85, hi: fl.hi * k * 1.15, conf: 'low', parts: [...fl.parts, ['ratio', k, r.length]] }; }
  }
  if (logv == null && ja) return { value: ja.j, lo: ja.j, hi: null, conf: 'floor', parts: [['floor', ja.a]], near: [] };
  if (logv == null) return null;
  const v = Math.exp(logv), band = conf === 'mid' ? 0.2 : 0.35;
  return { value: v, lo: v * (1 - band), hi: v * (1 + band), conf, parts, near: near.map((x) => ({ a: x.a, d: x.dd, v: x.v })), far: d0 > 12 };
}
const KNN_K = 4;
// Which industrial estate (if any) a point falls inside.
const estateAt = (lat, lng) => AREAS.filter((a) => a.ind && km(lat, lng, a.lat, a.lng) <= a.ind && sameBank(lat, lng, a)).sort((x, y) => km(lat, lng, x.lat, x.lng) - km(lat, lng, y.lat, y.lng))[0] || null;
const OWN_KM = 1.2;
// Best available price for one property type at a point: the estate's own price, the area's own price, or the nearby estimate.
function priceAt(lat, lng, ptype, hint) {
  const est = estateAt(lat, lng);
  if (est) {
    if (ptype !== 'industrial') return null;
    const m = stats(est.id, 'industrial', 'market', null).median, g = stats(est.id, 'industrial', 'gidc').median;
    return m != null ? { value: m, own: est } : g != null ? { value: g, own: est, gidc: true } : null;
  }
  const a = hint && !hint.ind ? { x: hint, d: 0 } : AREAS.filter((x) => !x.ind && sameBank(lat, lng, x)).map((x) => ({ x, d: km(lat, lng, x.lat, x.lng) })).sort((p, q) => p.d - q.d)[0];
  if (a && a.d <= OWN_KM) { const m = stats(a.x.id, ptype, 'market', null).median; if (m != null) return { value: m, own: a.x }; }
  const k = knn(lat, lng, ptype);
  return k || null;
}
const knnLine = (e, unit) => {
  const out = [];
  for (const p of e.parts || []) {
    if (p[0] === 'trend') out.push(`${t('m_trend')} ${Math.round(p[2])} km: ${rate(p[1], unit)}`);
    if (p[0] === 'local') out.push(`${t('m_local')} ${p[1] >= 0 ? '+' : ''}${p[1]}%`);
    if (p[0] === 'ratio') out.push(`${t('m_ratio')} × ${p[1].toFixed(2)} (${p[2]})`);
    if (p[0] === 'jantri') out.push(`${t('jantri')} ${rate(p[1], unit)} × ${p[2].toFixed(1)}`);
  }
  if (e.near && e.near.length) out.push(e.near.map((x) => `${areaName(x.a, getLang())} ${x.d.toFixed(1)} km`).join(', '));
  if (e.conf === 'floor') return `${t('conf_floor')} (${areaName(e.parts[0][1], getLang())})`;
  return `${t('conf_' + (e.conf || 'low'))} · ₹ ${Math.round(rateFromSqft(e.lo, unit, vigha())).toLocaleString('en-IN')}–${Math.round(rateFromSqft(e.hi, unit, vigha())).toLocaleString('en-IN')} · ` + out.join(' · ');
};

// ---------- all named places (OpenStreetMap), fetched once and cached on the phone ----------
const PLACES_KEY = 'places.v1';
async function loadPlaces() {
  const c = cfg.get(PLACES_KEY, null);
  if (c && Date.now() - c.at < 30 * 864e5) { S.places = c.rows; return; }
  const q = '[out:json][timeout:60];area["ISO3166-2"~"^IN-(GJ|DH|DN|DD)$"]->.g;node(area.g)(around:200000,21.1702,72.8311)[place~"^(city|town|village|suburb|neighbourhood|quarter|hamlet)$"][name];out body;';
  for (const host of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    try {
      const r = await fetch(host, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      if (!r.ok) continue;
      const j = await r.json();
      const known = new Set(AREAS.flatMap((a) => a.keys));
      S.places = j.elements.map((e) => ({ en: e.tags['name:en'] || e.tags.name, gu: e.tags['name:gu'] || (/[઀-૿]/.test(e.tags.name) ? e.tags.name : ''), lat: e.lat, lng: e.lon, type: e.tags.place }))
        .filter((p) => !known.has((p.en || '').toLowerCase()));
      try { cfg.set(PLACES_KEY, { at: Date.now(), rows: S.places }); } catch { /* storage full: keep in memory only */ }
      if (S.map) drawPins();
      return;
    } catch { /* try the next server */ }
  }
}
const placeName = (p) => (getLang() === 'en' ? p.en : p.gu || p.en);
function searchPlaces(q) {
  q = q.trim().toLowerCase(); if (q.length < 2) return [];
  return (S.places || []).filter((p) => (p.en || '').toLowerCase().includes(q) || (p.gu && p.gu.includes(q)))
    .sort((a, b) => ((b.en || '').toLowerCase().startsWith(q) - (a.en || '').toLowerCase().startsWith(q)) || km(SURAT.lat, SURAT.lng, a.lat, a.lng) - km(SURAT.lat, SURAT.lng, b.lat, b.lng));
}

function drawPins() {
  const L = window.L, b = S.map.getBounds().pad(0.15), c = S.map.getCenter(), unit = defaultUnit(S.mapType), z = S.map.getZoom();
  S.layer.clearLayers();
  const placed = [];
  const free = (lat, lng, w) => { const p = S.map.latLngToContainerPoint([lat, lng]); if (placed.some((q) => Math.abs(q.x - p.x) < w && Math.abs(q.y - p.y) < 46)) return false; placed.push(p); return true; };
  AREAS.filter((a) => b.contains([a.lat, a.lng])).map((a) => ({ a, s: stats(a.id, S.mapType, 'market', null) }))
    .sort((x, y) => (y.a.id === S.mapSel) - (x.a.id === S.mapSel) || (y.s.median != null) - (x.s.median != null) || km(c.lat, c.lng, x.a.lat, x.a.lng) - km(c.lat, c.lng, y.a.lat, y.a.lng))
    .filter(({ a }) => free(a.lat, a.lng, 92)).slice(0, 40).forEach(({ a, s }) => {
      let est = null, val;
      if (a.ind) {
        const iu = S.mapType === 'industrial' ? unit : 'sqm', pa = priceAt(a.lat, a.lng, 'industrial');
        val = pa ? rate(pa.value, iu) + (iu !== unit ? '/' + unitLabel(iu) : '') : '—';
      } else {
        est = s.median == null ? knn(a.lat, a.lng, S.mapType, a.id) : null;
        val = s.median != null ? rate(s.median, unit) : est ? (est.conf === 'floor' ? '≥ ' : '≈ ') + rate(est.value, unit) : '—';
      }
      const html = `<div class="pin${a.id === S.mapSel ? ' sel' : ''}${est ? ' est' : ''}${a.ind ? ' ind' : ''}"><span>${a.ind ? '🏭 ' : ''}${areaName(a, getLang())}</span><b>${val}</b></div>`;
      L.marker([a.lat, a.lng], { icon: L.divIcon({ className: 'pinwrap', html, iconSize: null }), keyboard: true, title: a.en })
        .on('click', () => { S.mapSel = a.id; S.spotNote = null; S.spotAt = null; drawPins(); drawMapCard(); drawBorder(a); }).addTo(S.layer);
    });
  // Smaller pins for every other named place once zoomed in; their price is the nearby estimate.
  if (z >= 12 && S.places) {
    S.places.filter((p) => b.contains([p.lat, p.lng])).sort((x, y) => km(c.lat, c.lng, x.lat, x.lng) - km(c.lat, c.lng, y.lat, y.lng)).slice(0, 300)
      .filter((p) => free(p.lat, p.lng, 84)).slice(0, 30).forEach((p) => {
        const est = knn(p.lat, p.lng, S.mapType);
        const html = `<div class="pin est small"><span>${placeName(p)}</span><b>${est ? '≈ ' + rate(est.value, unit) : '—'}</b></div>`;
        L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'pinwrap', html, iconSize: null }), title: p.en }).on('click', () => showSpot(p.lat, p.lng, placeName(p))).addTo(S.layer);
      });
  }
}
// Live location: Dad stands somewhere, taps once, and gets every property type's price for that exact spot.
function myLocation() {
  if (!navigator.geolocation) return toast(t('loc_denied'), true);
  toast(t('locating'));
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude: lat, longitude: lng } = pos.coords;
    S.spotAll = true; if (S.map) S.map.flyTo([lat, lng], 16, { duration: 0.6 });
    showSpot(lat, lng, null, true);
  }, () => toast(t('loc_denied'), true), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
}
// A spot is any point on the map: a tapped street, a searched landmark or a small place pin.
async function showSpot(lat, lng, label, all) {
  S.spotAll = !!all;
  const L = window.L;
  S.mapSel = null; S.spotAt = { lat, lng, label: label || '…' };
  if (S.border) { S.border.remove(); S.border = null; }
  if (S.spot) S.spot.remove();
  S.spot = L.marker([lat, lng], { icon: L.divIcon({ className: 'pinwrap', html: '<div class="spot">●</div>', iconSize: null }), interactive: false }).addTo(S.map);
  drawPins(); drawMapCard();
  if (!label) {
    try {
      const r = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'en' } })).json();
      const ad = r.address || {};
      S.spotAt.label = [ad.road, ad.neighbourhood || ad.suburb || ad.village || ad.town].filter(Boolean).join(', ') || r.name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      // The area named in the address (e.g. "Adajan") wins over whichever area centre happens to be closest.
      const hit = findAreaInText([ad.neighbourhood, ad.quarter, ad.suburb, ad.city_district, ad.village, ad.town, r.display_name].filter(Boolean).join(' , '));
      if (S.spotAt) S.spotAt.area = hit && km(lat, lng, hit.lat, hit.lng) < 6 && sameBank(lat, lng, hit) ? hit.id : null;
    } catch { S.spotAt.label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
    if (S.spotAt && S.spotAt.lat === lat) drawMapCard();
  }
}
function drawMapCard() {
  const el = $('#mapcard'); if (!el) return;
  const unit = defaultUnit(S.mapType);
  if (S.spotAt) {
    const sp = S.spotAt, estate = estateAt(sp.lat, sp.lng), hint = sp.area && areaById(sp.area);
    const near = estate ? { a: estate, d: 0 } : hint ? { a: hint, d: 0 } : AREAS.filter((a) => !a.ind && sameBank(sp.lat, sp.lng, a)).map((a) => ({ a, d: km(sp.lat, sp.lng, a.lat, a.lng) })).sort((x, y) => x.d - y.d)[0];
    const pType = estate ? 'industrial' : S.mapType, pu = defaultUnit(pType), pa = priceAt(sp.lat, sp.lng, pType, hint);
    const projNear = S.projects && near ? AREAS.filter((a) => a.id === near.a.id || (km(sp.lat, sp.lng, a.lat, a.lng) <= 2.5 && sameBank(sp.lat, sp.lng, a))).map((a) => a.id) : [];
    const nProj = S.projects ? S.projects.filter((p) => projNear.includes(p.area_id)).length : 0;
    const srcLine = (x, u) => x.own ? `${t('own_short')}: ${areaName(x.own, getLang())}${x.gidc ? ' · ' + t('gidc') : ''}` : `${t('based_on')}: ${knnLine(x, u)}`;
    const allRows = S.spotAll && h('div', { class: 'list tight' }, h('div', { class: 'xs gold b' }, t('here_all')),
      PTYPES.map((pt) => { const x = priceAt(sp.lat, sp.lng, pt, hint), u = defaultUnit(pt); return h('div', { class: 'between small' }, h('span', {}, `${t(pt)} · ${unitLabel(u)}`), h('span', { class: 'b' }, x ? (x.own ? '' : x.conf === 'floor' ? '≥ ' : '≈ ') + rate(x.value, u) : '—')); }));
    return el.replaceChildren(h('div', { class: 'card float' },
      h('div', { class: 'between' }, h('div', { class: 'title' }, sp.label), h('div', { class: 'muted small' }, `${t(pType)} · ${t('per')} ${unitLabel(pu)}`)),
      estate && h('div', { class: 'xs goldtext b' }, `🏭 ${t('inside')}: ${areaName(estate, getLang())} — ${t('ind_only')}`),
      h('div', { class: 'between' }, h('span', { class: 'gold xs b' }, pa && pa.own ? t('market_rate') : t('nearby_estimate')), h('span', { class: 'title big' }, pa ? (pa.own ? '' : pa.conf === 'floor' ? '≥ ' : '≈ ') + rate(pa.value, pu) : t('no_price'))),
      pa ? h('div', { class: 'xs muted' }, srcLine(pa, pu)) : h('div', { class: 'xs muted' }, t('no_nearby')),
      allRows,
      h('div', { class: 'grid2' }, gmapsBtn(sp.lat, sp.lng), h('button', { class: 'btn', onclick: () => savePlace(sp) }, '＋ ', t('save_place'))),
      nProj ? h('button', { class: 'btn', onclick: () => { S.propView = 'projects'; S.projQ = { year: 'all', type: 'all', q: '', areas: projNear, n: 40 }; go('properties'); } }, `🏗 ${t('proj_near')}: ${nProj}`) : null,
      near && near.d <= 8 && h('button', { class: 'btn gold', onclick: () => { S.spotAt = null; S.price.area = near.a.id; S.price.ptype = S.mapType; S.price.unit = null; S.price.grade = 'all'; S.tab = 'prices'; render(); } }, `${t('full_detail')}: ${areaName(near.a, getLang())}`)));
  }
  const a = S.mapSel && areaById(S.mapSel);
  if (!a) return el.replaceChildren();
  const j = stats(a.id, S.mapType, 'jantri'), d = stats(a.id, S.mapType, 'dastavej'), mk = stats(a.id, S.mapType, 'market', null);
  const est = mk.median == null ? knn(a.lat, a.lng, S.mapType, a.id) : null;
  el.replaceChildren(h('div', { class: 'card float' },
    h('div', { class: 'between' }, h('div', { class: 'title big' }, areaName(a, getLang())), h('div', { class: 'muted small' }, `${t(S.mapType)} · ${t('per')} ${unitLabel(unit)}`)),
    S.spotNote && h('div', { class: 'small goldtext b' }, S.spotNote),
    h('div', { class: 'grid3' },
      h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t('jantri')), h('div', { class: 'b' }, rate(j.median, unit))),
      h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t('dastavej')), h('div', { class: 'b' }, rate(d.median, unit))),
      h('div', { class: 'tile dark' }, h('div', { class: 'gold xs' }, est ? t('nearby_estimate') : t('market_rate')), h('div', { class: 'b' }, est ? '≈ ' + rate(est.value, unit) : rate(mk.median, unit)))),
    est && h('div', { class: 'xs muted' }, t('based_on'), ': ', knnLine(est, unit)),
    gmapsBtn(null, null, `${a.en.replace(/\s*\(.*\)/, '')}, ${a.district}, Gujarat`),
    S.projects && S.projects.some((p) => p.area_id === a.id) && h('button', { class: 'btn', onclick: () => { S.propView = 'projects'; S.projQ = { year: 'all', type: 'all', q: '', area: a.id, n: 40 }; go('properties'); } }, `🏗 ${t('proj_near')}: ${S.projects.filter((p) => p.area_id === a.id).length}`),
    h('button', { class: 'btn gold', onclick: () => { S.price.area = a.id; S.price.ptype = S.mapType; S.price.unit = null; S.price.grade = 'all'; S.tab = 'prices'; render(); } }, t('full_detail'))));
}
function mapSuggest(e) {
  const q = e.target.value.trim(), box = $('#mapsug');
  if (!q) return box.replaceChildren();
  const areas = searchAreas(q).slice(0, 5), places = searchPlaces(q).slice(0, 6 - Math.min(5, areas.length) + 2);
  box.replaceChildren(
    ...areas.map((a) => h('button', { class: 'row', onclick: () => goArea(a) }, h('span', {}, areaName(a, getLang())), h('span', { class: 'muted' }, `${a.en} · ${Math.round(km(SURAT.lat, SURAT.lng, a.lat, a.lng))} km`))),
    ...places.map((p) => h('button', { class: 'row', onclick: () => goPlace(p) }, h('span', {}, placeName(p)), h('span', { class: 'muted' }, `${p.en} · ${Math.round(km(SURAT.lat, SURAT.lng, p.lat, p.lng))} km`))));
}
function goArea(a) {
  S.mapSel = a.id; S.spotNote = null; S.spotAt = null; if (S.spot) { S.spot.remove(); S.spot = null; }
  $('#mapsug').replaceChildren(); $('#mapq').value = a.en; $('#mapq').blur();
  S.map.flyTo([a.lat, a.lng], 14, { duration: 0.6 }); drawMapCard(); drawBorder(a);
}
function goPlace(p) {
  $('#mapsug').replaceChildren(); $('#mapq').value = p.en; $('#mapq').blur();
  S.map.flyTo([p.lat, p.lng], 14, { duration: 0.6 }); showSpot(p.lat, p.lng, placeName(p));
}
async function mapSearch(q) {
  q = q.trim(); if (!q) return;
  const local = searchAreas(q);
  if (local.length) return goArea(local[0]);
  const pl = searchPlaces(q);
  if (pl.length) return goPlace(pl[0]);
  toast(t('not_found_local'));
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&viewbox=70.8,23.1,74.9,19.2&bounded=1&q=' + encodeURIComponent(q);
    const r = await (await fetch(url, { headers: { 'Accept-Language': 'en' } })).json();
    const p = r[0] && { lat: Number(r[0].lat), lng: Number(r[0].lon) };
    if (!p || km(SURAT.lat, SURAT.lng, p.lat, p.lng) > 200) return toast(t('not_found'), true);
    $('#mapsug').replaceChildren(); $('#mapq').blur();
    S.map.flyTo([p.lat, p.lng], 15, { duration: 0.6 }); showSpot(p.lat, p.lng, q);
  } catch { toast(t('not_found'), true); }
}

// ---------- Prices ----------
function pricePointForm(init) {
  const f = { kind: 'market', source: 'own', furnished: '', value: '', note: '', source_url: '', observed_on: new Date().toISOString().slice(0, 10), ...init };
  f.unit ||= defaultUnit(f.ptype);
  const sh = openSheet(t('add_price'), (api) => [
    areaBtn(f, 'area_id', api.redraw),
    chips(PTYPES.map((p) => [p, t(p)]), f.ptype, (v) => { f.ptype = v; f.unit = defaultUnit(v); api.redraw(); }, 'wrap'),
    seg([['market', t('market_rate')], ['dastavej', t('dastavej')], ['jantri', t('jantri')]], f.kind, (v) => { f.kind = v; if (v === 'jantri') f.source = 'garvi'; api.redraw(); }),
    h('div', { class: 'grid2' }, field(`${t('prices')} ₹ / ${unitLabel(f.unit)}`, numInp(f, 'value')),
      field(t('per'), h('select', { class: 'input', value: f.unit, onchange: (e) => { f.unit = e.target.value; api.redraw(); } }, UNITS.map((u) => h('option', { value: u }, unitLabel(u)))))),
    f.kind === 'market' && seg([['', t('any')], ['no', t('unfurnished')], ['yes', t('furnished')]], f.furnished, (v) => { f.furnished = v; api.redraw(); }),
    f.kind === 'market' && seg([['', t('g_none')], ...GRADES.map((g) => [g, t('g_' + g)])], f.grade || '', (v) => { f.grade = v; api.redraw(); }),
    h('div', { class: 'grid2' }, field(t('source'), h('select', { class: 'input', value: f.source, onchange: (e) => { f.source = e.target.value; } }, ['own', 'whatsapp', 'listing', 'news', 'garvi', 'other'].map((s) => h('option', { value: s }, t('src_' + s))))),
      field(t('date'), inp(f, 'observed_on', { type: 'date' }))),
    h('button', { type: 'button', class: 'input pick', onclick: () => brokersSheet((b) => { f.broker_id = b.id; api.redraw(); }) }, h('span', { class: f.broker_id ? '' : 'muted' }, f.broker_id && brokerOf(f.broker_id) ? `${t('quoted_by')}: ${brokerOf(f.broker_id).name}` : t('quoted_by_pick')), icon('down', 18)),
    field(t('notes'), inp(f, 'note')), field(t('link'), inp(f, 'source_url', { inputmode: 'url', autocapitalize: 'none' })),
    h('button', { class: 'btn gold', onclick: async () => {
      const v = N(f.value); if (!v || !f.area_id) return toast(t('area') + ' + ' + t('prices'), true);
      try {
        await saveRec('price_points', { area_id: f.area_id, ptype: f.ptype, kind: f.kind, price_sqft: rateToSqft(v, f.unit, vigha()), furnished: f.furnished === 'yes' ? true : f.furnished === 'no' ? false : null, grade: f.kind === 'market' && f.grade ? f.grade : null, source: f.source, broker_id: f.broker_id || null, note: f.note || null, source_url: f.source_url || null, observed_on: f.observed_on });
        S.price.area = f.area_id; S.price.ptype = f.ptype; sh.close(); toast(t('saved')); render();
      } catch (e) { fail(e); }
    } }, t('save')),
  ]);
}
function pasteMessage(areaId, ptype) {
  const f = { text: '' };
  const sh = openSheet(t('paste_msg'), () => [
    h('textarea', { class: 'input area', rows: 6, placeholder: 'Piplod 3BHK flat 1450 sq ft 85 lakh…', oninput: (e) => { f.text = e.target.value; } }),
    h('button', { class: 'btn gold', onclick: () => {
      const p = parseEntry(f.text), init = { area_id: p.area_id || areaId, ptype: p.ptype || ptype, source: 'whatsapp', note: f.text.slice(0, 120) };
      if (p.rate) { init.value = p.rate; init.unit = p.rate_unit || defaultUnit(init.ptype); }
      else if (p.price && p.size) { init.unit = p.size_unit; init.value = Math.round(p.price / p.size); }
      if (p.furnished != null) init.furnished = p.furnished ? 'yes' : 'no';
      sh.close(); pricePointForm(init);
    } }, t('fill_form')),
  ]);
}

// ---------- 7:00 AM phone alert (Web Push; iPhone needs the app added to the Home Screen) ----------
const VAPID_PUBLIC = 'BNtoml6LfhC9dHDsMsYPALscCz34LQj_wHTCm_HtndA91y0i61XcjXFx9u56uszoGCijrPMtVQZt-CjZML52-kA';
const pushOn = () => cfg.get('push.on', false);
async function enablePush() {
  try {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return toast(standalone ? t('push_unsupported') : t('push_homescreen'), true);
    if ((await Notification.requestPermission()) !== 'granted') return toast(t('push_denied'), true);
    const reg = await navigator.serviceWorker.ready;
    const key = Uint8Array.from(atob(VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (VAPID_PUBLIC.length % 4)) % 4)), (c) => c.charCodeAt(0));
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const r = await fetch((cfg.get('sbUrl') || DEFAULT_SB_URL) + '/rest/v1/rpc/save_push_sub', { method: 'POST', headers: { apikey: SB_PUBLIC_KEY, Authorization: 'Bearer ' + SB_PUBLIC_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON() }) });
    if (!r.ok) throw new Error(await r.text());
    cfg.set('push.on', true); toast(t('push_on'));
  } catch (e) { fail(e); }
}

// ---------- Google Maps and dropping a pin ----------
const gmaps = (lat, lng, q) => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(lat != null ? `${(+lat).toFixed(6)},${(+lng).toFixed(6)}` : q);
const gmapsBtn = (lat, lng, q, cls = 'btn') => h('a', { class: cls, href: gmaps(lat, lng, q), target: '_blank', rel: 'noopener' }, '🗺 ', t('google_maps'));
// A sheet with a map: tap to drop the pin, drag to fine-tune, then save.
function pinPicker(title, at, onSave) {
  const L = window.L; let m = null, pos = at.exact ? { lat: at.lat, lng: at.lng } : null;
  const sh = openSheet(title, () => [
    h('div', { class: 'xs muted' }, t('pin_help')),
    h('div', { id: 'pinmap', style: 'height:360px;flex:none;border-radius:16px;overflow:hidden' }),
    h('button', { class: 'btn gold', onclick: () => { if (!pos) return toast(t('pin_help'), true); onSave(pos); sh.close(); } }, t('save'))]);
  setTimeout(() => {
    const map = L.map('pinmap').setView([at.lat, at.lng], at.exact ? 17 : 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    const put = (ll) => { pos = { lat: ll.lat, lng: ll.lng }; if (m) m.setLatLng(ll); else { m = L.marker(ll, { draggable: true }).addTo(map); m.on('dragend', () => { const q = m.getLatLng(); pos = { lat: q.lat, lng: q.lng }; }); } };
    if (pos) put(pos);
    map.on('click', (e) => put(e.latlng));
  }, 50);
}
const PROJPIN_KEY = 'projpins';
const projPin = (p) => cfg.get(PROJPIN_KEY, {})[p.rera] || null;
// Where to draw a project: Dad's own pin if he set one, otherwise spread around its area's centre (approximate).
function projPos(p, i) {
  const own = projPin(p); if (own) return { ...own, exact: true };
  const a = areaById(p.area_id); if (!a) return null;
  const ang = i * 2.39996, r = 0.0018 * Math.sqrt(i + 1);
  return { lat: a.lat + r * Math.cos(ang), lng: a.lng + r * Math.sin(ang) * 1.07, exact: false };
}

// ---------- Dad's own places (an estate or society the map doesn't know, e.g. a new industrial park) ----------
const MYAREAS_KEY = 'myareas';
function addMyAreas() {
  for (const m of cfg.get(MYAREAS_KEY, [])) if (!areaById(m.id)) AREAS.push({ ...m, keys: [m.en.toLowerCase()], own: true });
}
function savePlace(sp) {
  const f = { name: sp.label && !/^\d/.test(sp.label) ? sp.label.split(',')[0] : '', ind: !!estateAt(sp.lat, sp.lng) };
  const sh = openSheet(t('save_place'), (api) => [
    field(t('name'), inp(f, 'name', { placeholder: 'Hasmukh Industrial Estate' })),
    seg([[false, t('residential_area')], [true, t('ind_estate')]], f.ind, (v) => { f.ind = v; api.redraw(); }),
    h('button', { class: 'btn gold', onclick: () => {
      const name = f.name.trim(); if (!name) return;
      const a = { id: 'my-' + Date.now(), en: name, gu: name, district: 'Surat', lat: +sp.lat.toFixed(5), lng: +sp.lng.toFixed(5), ind: f.ind ? 0.8 : 0 };
      cfg.set(MYAREAS_KEY, [...cfg.get(MYAREAS_KEY, []), a]); addMyAreas(); S.fits = null; sh.close();
      S.spotAt = null; S.mapSel = a.id; render(); toast(t('saved'));
    } }, t('save'))]);
}

// ---------- WhatsApp group: paste a whole chat, pull out every price, property and phone ----------
function splitChat(text) {
  const re = /^\u200e?\[?(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4}),?\s+\d{1,2}[:.]\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?([^:]{1,40}?):\s(.*)$/i;
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(re);
    if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; out.push({ date: `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, who: m[4].replace(/^\u200e/, '').trim(), text: m[5] }); }
    else if (out.length && line.trim()) out[out.length - 1].text += '\n' + line;
    else if (!out.length && line.trim()) out.push({ date: null, who: '', text: line });
  }
  if (out.length <= 1 && !re.test(String(text).split(/\n/)[0] || '')) return String(text).split(/\n\s*\n/).map((t2) => ({ date: null, who: '', text: t2.trim() })).filter((x) => x.text);
  return out.filter((x) => !/<media omitted>|deleted this message|message was deleted|joined using|added|left$/i.test(x.text));
}
function bulkItems(text) {
  const today = new Date().toISOString().slice(0, 10);
  return splitChat(text).map((m, i) => {
    const p = parseEntry(m.text), ptype = p.ptype || 'flat';
    let sqft = null;
    if (p.rate) sqft = rateToSqft(p.rate, p.rate_unit || defaultUnit(ptype), vigha());
    else if (p.price && p.size) sqft = p.price / toSqft(p.size, p.size_unit || defaultUnit(ptype), vigha());
    const quote = p.area_id && sqft && inBounds({ ptype, price_sqft: sqft }) ? { area_id: p.area_id, ptype, price_sqft: sqft } : null;
    const date = m.date && !isNaN(new Date(m.date)) && m.date <= today ? m.date : today;
    return { i, ...m, date, p, quote, lead: !!p.phone || (!!p.area_id && !!(p.price || p.rate)), on: !!(quote || p.phone) };
  }).filter((x) => x.quote || x.lead);
}
function bulkPaste() {
  const f = { text: '', items: null };
  const sh = openSheet(t('bulk_paste'), (api) => {
    if (!f.items) return [
      h('div', { class: 'small muted' }, t('bulk_help')),
      h('textarea', { class: 'input area', rows: 10, placeholder: '[12/11/26, 10:42:15] Ramesh Broker: Vesu 3BHK 1650 sqft 1.25 cr 98250xxxxx', oninput: (e) => { f.text = e.target.value; } }),
      h('button', { class: 'btn gold', onclick: () => { f.items = bulkItems(f.text); api.redraw(); } }, t('bulk_read'))];
    const nq = f.items.filter((x) => x.on && x.quote).length, nl = f.items.filter((x) => x.on && !x.quote && x.p.phone).length;
    return [
      h('div', { class: 'small b' }, `${f.items.length} ${t('bulk_found')} · ${nq} ${t('bulk_prices')} · ${nl} ${t('bulk_leads')}`),
      f.items.length ? f.items.map((x) => h('label', { class: 'pt row' + (x.on ? '' : ' out') },
        h('input', { type: 'checkbox', checked: x.on, onchange: (e) => { x.on = e.target.checked; api.redraw(); } }),
        h('div', { class: 'grow' },
          h('div', { class: 'small b' }, [x.quote ? `${areaName(areaById(x.quote.area_id), getLang())} · ${t(x.quote.ptype)} · ${rate(x.quote.price_sqft, defaultUnit(x.quote.ptype))}/${unitLabel(defaultUnit(x.quote.ptype))}` : t('bulk_lead_only'), x.p.phone && '📞 ' + x.p.phone].filter(Boolean).join(' · ')),
          h('div', { class: 'xs muted' }, [x.who, x.date].filter(Boolean).join(' · ')),
          h('div', { class: 'xs' }, x.text.slice(0, 160))))) : h('div', { class: 'muted' }, t('bulk_none')),
      h('div', { class: 'grid2' },
        h('button', { class: 'btn', onclick: () => { f.items = null; api.redraw(); } }, t('back')),
        h('button', { class: 'btn gold', onclick: async () => {
          let q = 0, l = 0;
          const leads = cfg.get(LEADS_KEY, []);
          for (const x of f.items.filter((y) => y.on)) {
            const br = S.data.brokers.find((b) => (x.p.phone && tel(b.phone) === tel(x.p.phone)) || (x.who && b.name && b.name.toLowerCase() === x.who.toLowerCase()));
            if (x.quote) { try { await saveRec('price_points', { ...x.quote, kind: 'market', furnished: x.p.furnished ?? null, source: 'whatsapp', broker_id: br ? br.id : null, note: `${x.who ? x.who + ': ' : ''}${x.text.slice(0, 140)}`, observed_on: x.date }); q++; } catch (e) { fail(e); } }
            if (x.p.phone && !leads.some((o) => o.phone === x.p.phone && o.text === x.text)) { leads.unshift({ id: 'w' + Date.now() + x.i, date: x.date, text: x.text.slice(0, 300), phone: x.p.phone, area_id: x.p.area_id, ptype: x.p.ptype, name: x.p.name, source: 'WhatsApp' + (x.who ? ': ' + x.who : '') }); l++; }
          }
          cfg.set(LEADS_KEY, leads.slice(0, 1000)); S.fits = null; sh.close(); toast(`${q} ${t('bulk_prices')} · ${l} ${t('bulk_leads')} ✓`); render();
        } }, t('save')))];
  });
}

// ---------- Inquiries ----------
function matches(q) {
  return S.data.properties.filter((p) => (!q.area_id || !p.area_id || p.area_id === q.area_id) && (!q.ptype || !p.ptype || p.ptype === q.ptype)
    && ((q.deal === 'rent') === (p.deal === 'rent')) && (!q.budget || !p.price || Number(p.price) <= Number(q.budget) * 1.1) && (q.area_id || q.ptype || q.budget));
}
const tel = (p) => String(p || '').replace(/\D/g, '').slice(-10);
function ics(i) {
  const d = new Date(i.followup_at), z = (x) => x.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ami Realtors//EN', 'BEGIN:VEVENT', 'UID:' + (i.id || Date.now()) + '@ami', 'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(d), 'DTEND:' + z(new Date(+d + 9e5)),
    'SUMMARY:Call ' + (i.name || '') + ' ' + (i.phone || ''), 'BEGIN:VALARM', 'TRIGGER:-PT5M', 'ACTION:DISPLAY', 'DESCRIPTION:Follow-up', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([body], { type: 'text/calendar' })), download: 'follow-up.ics' }); a.click();
}
const toLocalInput = (iso) => { const d = new Date(iso); return new Date(+d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };

function voiceBox(title, onText) {
  const f = { text: '' };
  const sh = openSheet(title, () => [
    h('p', { class: 'small muted' }, t('speak_hint')),
    h('textarea', { class: 'input area', rows: 5, lang: 'gu', autofocus: true, oninput: (e) => { f.text = e.target.value; } }),
    h('button', { class: 'btn gold', onclick: () => { sh.close(); onText(f.text); } }, t('fill_form')),
  ]);
}

// ---------- Properties ----------
function propTitle(p, lang = getLang()) {
  const tr = (k) => (lang === getLang() ? t(k) : EN[k] || k);
  return [p.bhk && p.bhk + ' BHK', p.ptype && tr(p.ptype), p.size && `${Number(p.size).toLocaleString('en-IN')} ${lang === getLang() ? unitLabel(p.size_unit || 'sqft') : EN['u_' + (p.size_unit || 'sqft')]}`].filter(Boolean).join(' · ') || '—';
}
const EN = { flat: 'Flat', bungalow: 'Bungalow', shop: 'Shop', office: 'Office', plot: 'Plot', land: 'Land', industrial: 'Industrial', u_sqft: 'sq ft', u_sqm: 'sq m', u_var: 'sq yd', u_vigha: 'vigha', u_acre: 'acre', u_hectare: 'hectare' };
function propCard(p) {
  const a = areaById(p.area_id), ph = tel(p.owner_phone);
  const img = h('div', { class: 'thumb' });
  if (p.photos?.[0]) store.fileUrl(p.photos[0]).then((u) => { if (u) img.style.backgroundImage = `url(${u})`; });
  return h('article', { class: 'card' },
    h('div', { class: 'prow' }, p.photos?.[0] ? img : null, h('div', { class: 'grow' },
      h('div', { class: 'tag' }, [t(p.deal || 'sale'), a ? areaName(a, getLang()) : p.area_text].filter(Boolean).join(' · ')),
      h('div', { class: 'title' }, propTitle(p)),
      h('div', { class: 'b' }, p.price ? moneyShort(p.price) : '—', p.price && p.size ? h('span', { class: 'muted small' }, ` · ${money(p.price / p.size)} / ${unitLabel(p.size_unit || 'sqft')}`) : null),
      (p.brokers || []).length ? h('div', { class: 'xs goldtext b' }, t('other_brokers') + ': ' + p.brokers.map((x) => (brokerOf(x.broker_id) || {}).name).filter(Boolean).join(', ')) : null,
      h('div', { class: 'small muted' }, [p.owner_name, p.furnished === true ? t('furnished') : p.furnished === false ? t('unfurnished') : null, p.floor && `${t('floor')} ${p.floor}`, p.facing].filter(Boolean).join(' · ')))),
    h('div', { class: 'grid3' },
      ph ? h('a', { class: 'btn green', href: 'tel:+91' + ph }, t('call')) : h('span', {}),
      a ? gmapsBtn(null, null, [p.address, a.en.replace(/\s*\(.*\)/, ''), a.district, 'Gujarat'].filter(Boolean).join(', ')) : h('button', { class: 'btn', onclick: () => shareCard(p).catch(fail) }, t('share_card')),
      h('button', { class: 'btn', onclick: () => propertyForm(p) }, t('edit'))));
}
function viewProps() {
  const list = S.data.properties.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const segBar = seg([['mine', t('my_props')], ['projects', t('projects')], ['leads', t('leads')]], S.propView || 'mine', (v) => { S.propView = v; render(); });
  if (S.propView === 'projects') return [h('header', { class: 'hdr' }, h('h1', { class: 'grow' }, t('properties'))), segBar, ...viewProjects()];
  if (S.propView === 'leads') return [h('header', { class: 'hdr' }, h('h1', { class: 'grow' }, t('properties'))), segBar, ...viewLeads()];
  return [
    h('header', { class: 'hdr' }, h('h1', { class: 'grow' }, t('properties')), h('span', { class: 'muted small' }, list.length || '')),
    segBar,
    h('div', { class: 'grid2' },
      h('button', { class: 'btn green tall', onclick: () => voiceBox(t('speak_add'), (text) => { const p = parseEntry(text); propertyForm(fromParse(p, text)); }) }, icon('mic', 20), t('speak_add')),
      h('button', { class: 'btn gold tall', onclick: () => propertyForm({}) }, icon('plus', 20), t('new_property'))),
    list.length ? list.map(propCard) : h('div', { class: 'empty' }, t('no_prop')),
  ];
}
function fromParse(p, text) {
  const o = { area_id: p.area_id, ptype: p.ptype, deal: p.deal === 'rent' ? 'rent' : 'sale', bhk: p.bhk, size: p.size, size_unit: p.size_unit, price: p.price, owner_name: p.name, owner_phone: p.phone, notes: text };
  if (p.furnished != null) o.furnished = p.furnished;
  if (!o.price && p.rate && p.size) o.price = Math.round(rateToSqft(p.rate, p.rate_unit || p.size_unit, vigha()) * toSqft(p.size, p.size_unit, vigha()));
  return o;
}
async function shrink(file) {
  if (!file.type.startsWith('image/')) return file;
  const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = h('canvas', { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
}
function propertyForm(init) {
  const f = { deal: 'sale', size_unit: defaultUnit(init.ptype), photos: [], docs: [], ...init };
  for (const k of Object.keys(f)) if (f[k] == null) delete f[k];
  f.photos = [...(f.photos || [])]; f.docs = [...(f.docs || [])]; f.size_unit ||= 'sqft';
  const fileRow = (key, accept, label) => {
    const pick = h('input', { type: 'file', accept, multiple: true, hidden: true, onchange: async (e) => {
      try { for (const file of e.target.files) { if (file.size > 12e6) { toast('> 12 MB', true); continue; } f[key].push(await store.putFile(await shrink(file), file.name)); } sh.redraw(); } catch (err) { fail(err); }
    } });
    return h('div', { class: 'files' }, pick, h('button', { type: 'button', class: 'btn dashed', onclick: () => pick.click() }, '+ ', label),
      f[key].map((ref, ix) => {
        const el = h('button', { type: 'button', class: 'thumb sm', 'aria-label': t('del'), onclick: async () => { if (confirm(t('confirm_del'))) { await store.removeFile(ref).catch(() => {}); f[key].splice(ix, 1); sh.redraw(); } } }, key === 'docs' ? 'DOC' : '');
        if (key === 'photos') store.fileUrl(ref).then((u) => { if (u) el.style.backgroundImage = `url(${u})`; });
        return el;
      }));
  };
  const sh = openSheet(f.id ? t('edit') : t('new_property'), (api) => [
    h('div', { class: 'muted small' }, t('nothing_required')),
    chips(PTYPES.map((p) => [p, t(p)]), f.ptype, (v) => { f.ptype = v; if (!f.size) f.size_unit = defaultUnit(v); api.redraw(); }, 'wrap'),
    seg([['sale', t('sale')], ['rent', t('rent')]], f.deal, (v) => { f.deal = v; api.redraw(); }),
    areaBtn(f, 'area_id', api.redraw),
    h('div', { class: 'grid2' }, field(t('price'), numInp(f, 'price')),
      field(t('size'), h('div', { class: 'join' }, numInp(f, 'size'), h('select', { class: 'input', 'aria-label': t('per'), value: f.size_unit, onchange: (e) => { f.size_unit = e.target.value; } }, UNITS.map((u) => h('option', { value: u }, unitLabel(u))))))),
    h('div', { class: 'grid2' }, field(t('owner_name'), inp(f, 'owner_name')), field(t('owner_phone'), inp(f, 'owner_phone', { inputmode: 'tel' }))),
    h('div', { class: 'grid3' }, field(t('bhk'), numInp(f, 'bhk')), field(t('floor'), inp(f, 'floor')), field(t('facing'), inp(f, 'facing'))),
    seg([['', t('any')], ['no', t('unfurnished')], ['yes', t('furnished')]], f.furnished === true ? 'yes' : f.furnished === false ? 'no' : '', (v) => { f.furnished = v === 'yes' ? true : v === 'no' ? false : undefined; api.redraw(); }),
    brokerRows(f, api.redraw),
    fileRow('photos', 'image/*', t('photos')), fileRow('docs', 'image/*,application/pdf', t('docs')),
    field(t('notes'), h('textarea', { class: 'input area', rows: 2, value: f.notes || '', oninput: (e) => { f.notes = e.target.value; } })),
    h('button', { class: 'btn gold', onclick: async () => {
      try {
        await saveRec('properties', { id: f.id, created_at: f.created_at, ptype: f.ptype || null, deal: f.deal, area_id: f.area_id || null, price: N(f.price), size: N(f.size), size_unit: f.size_unit, bhk: N(f.bhk), floor: f.floor || null, facing: f.facing || null, furnished: f.furnished ?? null, owner_name: f.owner_name || null, owner_phone: tel(f.owner_phone) || null, notes: f.notes || null, photos: f.photos, docs: f.docs, brokers: cleanBrokers(f.brokers) });
        sh.close(); toast(t('saved')); render();
      } catch (e) { fail(e); }
    } }, t('save')),
    f.id && h('button', { class: 'btn danger', onclick: async () => { if (confirm(t('confirm_del'))) { await delRec('properties', f.id).catch(fail); sh.close(); render(); } } }, t('del')),
  ]);
}

// WhatsApp card, always in English.
async function shareCard(p) {
  const W = 1080, H = 1350, c = h('canvas', { width: W, height: H }), x = c.getContext('2d'), a = areaById(p.area_id);
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#DCE4D8'; x.fillRect(0, 0, W, 640);
  const blob = p.photos?.[0] && await store.fileBlob(p.photos[0]).catch(() => null);
  if (blob) { const b = await createImageBitmap(blob), k = Math.max(W / b.width, 640 / b.height), w = b.width * k, hh = b.height * k; x.save(); x.beginPath(); x.rect(0, 0, W, 640); x.clip(); x.drawImage(b, (W - w) / 2, (640 - hh) / 2, w, hh); x.restore(); }
  const font = (w, s) => { x.font = `${w} ${s}px -apple-system, "Helvetica Neue", Arial, sans-serif`; };
  x.textBaseline = 'alphabetic';
  x.fillStyle = '#7A5A12'; font(700, 34); x.fillText(`FOR ${p.deal === 'rent' ? 'RENT' : 'SALE'}${a ? ' · ' + a.en.toUpperCase() + ', ' + a.district.toUpperCase() : ''}`, 64, 730);
  x.fillStyle = '#0E3B2E'; font(700, 68); x.fillText(propTitle(p, 'en-card'), 64, 820, W - 128);
  const cells = [['Price', p.price ? 'Rs ' + (p.price >= 1e7 ? +(p.price / 1e7).toFixed(2) + ' Cr' : p.price >= 1e5 ? +(p.price / 1e5).toFixed(2) + ' L' : Number(p.price).toLocaleString('en-IN')) : 'On request'], ['Floor', p.floor || '-'], ['Furnishing', p.furnished === true ? 'Furnished' : p.furnished === false ? 'Unfurnished' : '-']];
  cells.forEach(([k, v], i) => { const cx = 64 + i * 324; x.fillStyle = '#F6F4EE'; x.beginPath(); x.roundRect(cx, 880, 304, 150, 24); x.fill(); x.fillStyle = '#4A5650'; font(400, 30); x.fillText(k, cx + 24, 932); x.fillStyle = '#14201B'; font(700, 42); x.fillText(v, cx + 24, 992, 256); });
  x.fillStyle = '#0E3B2E'; x.fillRect(0, 1130, W, 220);
  x.save(); x.translate(64, 1160); x.scale(1.6, 1.6); x.strokeStyle = '#E3B341'; x.lineWidth = 6; x.lineJoin = 'round';
  ['M78.6 24.3 A40 40 0 1 0 70 83.4 L70 49.2', 'M26 56 L52 34 L78 56', 'M34 49.2 V87.5', 'M34 67 H70'].forEach((d) => x.stroke(new Path2D(d))); x.restore();
  x.fillStyle = '#E3B341'; font(700, 60); x.fillText('AMI', 250, 1235); x.fillStyle = '#FFFFFF'; font(600, 28); x.fillText('R E A L T O R S', 250, 1280);
  x.textAlign = 'right'; font(700, 38); x.fillText(cfg.get('bizPhone', '') || '', W - 64, 1228); font(400, 32); x.fillText('Chowk Bazaar, Surat', W - 64, 1278); x.textAlign = 'left';
  const out = await new Promise((r) => c.toBlob(r, 'image/png')), file = new File([out], 'ami-realtors-property.png', { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] }).catch(() => {});
  else h('a', { href: URL.createObjectURL(out), download: file.name }).click();
}

// ---------- Tools and settings ----------
const result = (label, val, strong) => h('div', { class: 'between' + (strong ? ' b' : '') }, h('span', {}, label), h('span', {}, val));
function emiCalc() {
  const f = { p: '', r: S.data.market[0]?.home_loan_rate || '', y: 20 };
  const out = h('div', { class: 'card inset' });
  const calc = () => { const e = emi(N(f.p) || 0, N(f.r) || 0, N(f.y) || 0); out.replaceChildren(result(t('monthly_emi'), money(e.emi), true), result(t('total_interest'), money(e.interest)), result(t('total_pay'), money(e.total))); };
  openSheet(t('emi_calc'), () => [field(t('loan_amount'), numInp(f, 'p')), h('div', { class: 'grid2' }, field(t('rate_pct'), numInp(f, 'r')), field(t('years'), numInp(f, 'y'))), out]).body.addEventListener('input', calc);
  calc();
}
function stampCalc() {
  const f = { v: '', j: '', s: 4.9, r: 1, w: false };
  const out = h('div', { class: 'card inset' });
  const calc = () => { const base = Math.max(N(f.v) || 0, N(f.j) || 0), sd = (base * (N(f.s) || 0)) / 100, rg = f.w ? 0 : (base * (N(f.r) || 0)) / 100;
    out.replaceChildren(result(t('taxable'), money(base)), result(t('stamp_duty'), money(sd)), result(t('reg_fee'), money(rg)), result(t('total'), money(sd + rg), true)); };
  openSheet(t('stamp_calc'), () => [h('div', { class: 'grid2' }, field(t('deal_value'), numInp(f, 'v')), field(t('jantri_value'), numInp(f, 'j'))), h('div', { class: 'grid2' }, field(t('stamp_pct'), numInp(f, 's')), field(t('reg_pct'), numInp(f, 'r'))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', onchange: (e) => { f.w = e.target.checked; calc(); } }), t('women_only')), out, h('p', { class: 'xs muted' }, t('stamp_note'))]).body.addEventListener('input', calc);
  calc();
}
function commission() {
  const sh = openSheet(t('commission'), (api) => {
    const d = S.data.deals.slice().sort((a, b) => String(b.deal_date).localeCompare(String(a.deal_date)));
    const due = d.reduce((s, r) => s + (Number(r.brokerage_due) || 0) * (1 - otherShare(r) / 100), 0), got = d.reduce((s, r) => s + (Number(r.brokerage_received) || 0), 0);
    return [h('div', { class: 'grid3' }, [['brokerage_due', due], ['brokerage_recv', got], ['pending', due - got]].map(([k, v]) => h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t(k).replace(' ₹', '')), h('div', { class: 'b' }, moneyShort(v))))),
      h('button', { class: 'btn gold', onclick: () => dealForm({}, api.redraw) }, icon('plus', 18), t('add_deal')),
      d.length ? d.map((r) => h('button', { class: 'card rowcard', onclick: () => dealForm(r, api.redraw) }, h('div', { class: 'between' }, h('span', { class: 'b' }, r.title || '—'), h('span', { class: 'muted small' }, r.deal_date ? fmtDate(r.deal_date, { day: 'numeric', month: 'short', year: 'numeric' }) : '')),
        h('div', { class: 'between small' }, h('span', { class: 'muted' }, r.client || ''), h('span', {}, `${moneyShort(Number(r.brokerage_received) || 0)} / ${moneyShort(Number(r.brokerage_due) || 0)}`)))) : h('div', { class: 'empty' }, t('no_deals'))];
  });
}
function dealForm(init, after) {
  const f = { deal_date: new Date().toISOString().slice(0, 10), ...init };
  f.brokers = (f.brokers || []).map((x) => ({ ...x }));
  const sh = openSheet(t('deal_title'), (api) => [field(t('deal_title'), inp(f, 'title')), h('div', { class: 'grid2' }, field(t('client'), inp(f, 'client')), field(t('date'), inp(f, 'deal_date', { type: 'date' }))),
    field(t('deal_value'), numInp(f, 'deal_value')), h('div', { class: 'grid2' }, field(t('brokerage_due'), numInp(f, 'brokerage_due')), field(t('brokerage_recv'), numInp(f, 'brokerage_received'))),
    brokerRows(f, api.redraw),
    h('button', { class: 'btn gold', onclick: async () => { try { await saveRec('deals', { id: f.id, created_at: f.created_at, title: f.title || null, client: f.client || null, deal_date: f.deal_date || null, deal_value: N(f.deal_value), brokerage_due: N(f.brokerage_due), brokerage_received: N(f.brokerage_received), brokers: cleanBrokers(f.brokers) }); sh.close(); after(); } catch (e) { fail(e); } } }, t('save')),
    f.id && h('button', { class: 'btn danger', onclick: async () => { if (confirm(t('confirm_del'))) { await delRec('deals', f.id).catch(fail); sh.close(); after(); } } }, t('del'))]);
}
function settings() {
  const f = { vigha: vigha(), bizPhone: cfg.get('bizPhone', ''), sbUrl: cfg.get('sbUrl', DEFAULT_SB_URL), sbKey: cfg.get('sbKey', ''), email: cloud.email, password: '', pin: '' };
  const sh = openSheet(t('settings'), (api) => {
    const auth = async (create) => { try { cfg.set('sbUrl', f.sbUrl.trim()); cfg.set('sbKey', f.sbKey.trim()); await cloud.init(); await cloud.signIn(f.email.trim(), f.password, create); await load(); api.redraw(); render(); toast(t('cloud_on')); } catch (e) { fail(e); } };
    return [
      h('h3', {}, t('language')), seg([['gu', 'ગુજરાતી'], ['en', 'English']], getLang(), (v) => { setLang(v); sh.close(); render(); settings(); }),
      field(t('vigha_size'), numInp(f, 'vigha', { onchange: () => { cfg.set('vigha', N(f.vigha) || DEFAULT_VIGHA_SQFT); render(); } })),
      field(t('biz_phone'), inp(f, 'bizPhone', { inputmode: 'tel', onchange: () => cfg.set('bizPhone', f.bizPhone) })),
      h('h3', {}, t('new_premium_title')), h('div', { class: 'xs muted' }, t('new_premium_help')),
      h('div', { class: 'grid2' },
        field(t('prem_in'), h('input', { class: 'input', inputmode: 'decimal', value: premIn(), onchange: (e) => { cfg.set('np.premIn', N(e.target.value) ?? 20); render(); } })),
        field(t('prem_out'), h('input', { class: 'input', inputmode: 'decimal', value: premOut(), onchange: (e) => { cfg.set('np.premOut', N(e.target.value) ?? 6); render(); } }))),
      h('h3', {}, t('push_title')), h('div', { class: 'xs muted' }, t('push_help')),
      h('button', { class: 'btn ' + (pushOn() ? '' : 'gold'), onclick: async () => { await enablePush(); api.redraw(); } }, pushOn() ? '✓ ' + t('push_on') : t('push_enable')),
      h('h3', {}, t('lock')),
      lock.hasPin ? [h('button', { class: 'btn', onclick: () => { lock.clear(); api.redraw(); } }, t('remove_pin')),
        lock.hasFace ? h('div', { class: 'small goldtext b' }, t('faceid_on')) : (window.PublicKeyCredential && h('button', { class: 'btn green', onclick: async () => { try { await lock.enableFace(); api.redraw(); } catch (e) { fail(e); } } }, t('enable_faceid')))]
        : h('div', { class: 'join' }, inp(f, 'pin', { type: 'password', inputmode: 'numeric', maxlength: 4, placeholder: t('pin_4'), autocomplete: 'off' }), h('button', { class: 'btn green', onclick: async () => { if (!/^\d{4}$/.test(f.pin)) return toast(t('pin_4'), true); await lock.setPin(f.pin); f.pin = ''; api.redraw(); } }, t('set_pin'))),
      h('h3', {}, t('cloud')), h('div', { class: 'small ' + (cloud.ready ? 'goldtext b' : 'muted') }, cloud.ready ? `${t('cloud_on')} · ${cloud.email}` : t('cloud_off')),
      cloud.ready ? [h('button', { class: 'btn green', onclick: async () => { try { const n = await store.uploadLocal(); await load(); render(); toast(`${t('done')} (${n})`); } catch (e) { fail(e); } } }, t('upload_local')),
        h('button', { class: 'btn', onclick: async () => { await cloud.signOut(); await load(); api.redraw(); render(); } }, t('sign_out'))]
        : [field(t('sb_url'), inp(f, 'sbUrl', { autocapitalize: 'none' })), field(t('sb_key'), inp(f, 'sbKey', { autocapitalize: 'none', autocomplete: 'off' })),
          h('div', { class: 'grid2' }, field(t('email'), inp(f, 'email', { type: 'email', autocapitalize: 'none' })), field(t('password'), inp(f, 'password', { type: 'password' }))),
          h('div', { class: 'grid2' }, h('button', { class: 'btn green', onclick: () => auth(false) }, t('sign_in')), h('button', { class: 'btn', onclick: () => auth(true) }, t('sign_up')))],
    ];
  });
}

// ---------- shell ----------
function render() {
  if (S.map && S.tab !== 'map') { S.map.remove(); S.map = null; }
  if (S.pmap) { S.pmap.remove(); S.pmap = null; }
  const view = { today: viewToday, map: viewMap, prices: viewPrices, customers: viewCustomers, properties: viewProps, more: viewMore }[S.tab]();
  $('#app').replaceChildren(h('main', { class: 'screen ' + S.tab }, view), tabbar());
  if (S.tab === 'map') initMap();
  if (S.tab === 'properties' && S.propView === 'projects' && S.projQ && S.projQ.mapOn && S.projects && S.projects.length) initProjMap();
}
function tabbar() {
  const cur = S.tab === 'prices' ? 'map' : S.tab;
  return h('nav', { class: 'tabbar', 'aria-label': 'Tabs' }, ['today', 'map', 'customers', 'properties', 'more'].map((k) =>
    h('button', { class: k === cur ? 'on' : '', 'aria-current': k === cur ? 'page' : null, onclick: () => { S.tab = k; render(); } }, icon(k), h('span', {}, t(k)))));
}
const go = (tab) => { S.tab = tab; render(); };

// ---------- customers (CRM) ----------
const ST = ['new', 'visit', 'nego', 'token', 'dastavej', 'closed', 'lost'];
const custOf = (id) => S.data.customers.find((c) => c.id === id);
const custLabel = (c) => (c && (c.name || (c.phone ? '+91 ' + c.phone : ''))) || '—';
const inqName = (i) => (custOf(i.customer_id) ? custLabel(custOf(i.customer_id)) : i.name || (i.phone ? '+91 ' + i.phone : '—'));
const inqLine = (i) => [areaById(i.area_id) && areaName(areaById(i.area_id), getLang()), i.ptype && t(i.ptype), i.deal && t(i.deal), i.budget && moneyShort(i.budget)].filter(Boolean).join(' · ');
const when = (iso) => new Date(iso).toLocaleString(getLang() === 'en' ? 'en-IN' : 'gu-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

async function upsertCustomer(name, phone) {
  const ph = tel(phone);
  let c = ph ? S.data.customers.find((x) => x.phone === ph) : null;
  if (c) { if (name && !c.name) c = await saveRec('customers', { ...c, name }); return c; }
  return saveRec('customers', { name: name || null, phone: ph || null });
}
// Older inquiries were saved without a customer: link them once.
async function ensureCustomers() {
  for (const i of S.data.inquiries.filter((x) => !x.customer_id)) {
    try { const c = await upsertCustomer(i.name, i.phone); await saveRec('inquiries', { ...i, customer_id: c.id }); } catch (e) { console.warn(e); return; }
  }
}
function dueItems() {
  const end = new Date(); end.setHours(23, 59, 59);
  const fu = S.data.inquiries.filter((i) => !['closed', 'lost'].includes(i.status) && i.followup_at && new Date(i.followup_at) <= end)
    .map((i) => ({ at: i.followup_at, title: `${t('followup')}: ${inqName(i)}`, sub: inqLine(i), inq: i }));
  const tk = S.data.tasks.filter((x) => !x.done && (!x.due_at || new Date(x.due_at) <= end)).map((x) => ({ at: x.due_at, title: x.title, sub: custOf(x.customer_id) ? custLabel(custOf(x.customer_id)) : '', task: x }));
  return [...fu, ...tk].sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
}
function dueRow(d, after) {
  return h('div', { class: 'duerow' },
    h('button', { class: 'tick', 'aria-label': t('done'), onclick: async () => {
      try { if (d.task) await saveRec('tasks', { ...d.task, done: true }); else await saveRec('inquiries', { ...d.inq, followup_at: null }); after(); } catch (e) { fail(e); }
    } }),
    h('button', { class: 'grow duetext', onclick: () => { const c = custOf(d.task ? d.task.customer_id : d.inq.customer_id); if (c) customerSheet(c); } },
      h('div', { class: 'b' }, d.title), h('div', { class: 'xs muted' }, [d.sub, d.at && when(d.at)].filter(Boolean).join(' · '))));
}
function taskForm(init, after) {
  const f = { title: '', due_at: '', ...init };
  if (f.due_at) f.due_at = toLocalInput(f.due_at);
  const sh = openSheet(t('task'), () => [field(t('task'), inp(f, 'title')), field(t('due'), inp(f, 'due_at', { type: 'datetime-local' })),
    h('button', { class: 'btn gold', onclick: async () => { if (!f.title.trim()) return toast(t('task'), true); try { await saveRec('tasks', { id: f.id, created_at: f.created_at, title: f.title.trim(), customer_id: f.customer_id || null, done: false, due_at: f.due_at ? new Date(f.due_at).toISOString() : null }); sh.close(); after(); } catch (e) { fail(e); } } }, t('save'))]);
}

// ---------- Today ----------
function viewToday() {
  const now = new Date(), m = S.data.market[0], due = dueItems();
  const cats = ['all', 'govt', 'smc', 'realestate', 'infra', 'rules', 'market'];
  const news = S.data.news.filter((n) => S.newsCat === 'all' || n.category === S.newsCat);
  const en = getLang() === 'en';
  return [
    h('header', { class: 'hdr' }, h('div', { class: 'logo' }, mark(30, 8)),
      h('div', { class: 'grow' }, h('h1', {}, t('greeting')), h('div', { class: 'muted small' }, fmtDate(now))),
      h('button', { class: 'iconbtn', 'aria-label': t('settings'), onclick: settings }, icon('gear'))),
    m && h('div', { class: 'grid4' }, [['gold', m.gold_10g, moneyShort], ['silver', m.silver_kg, moneyShort], ['sensex', m.sensex, (x) => Number(x).toLocaleString('en-IN')], ['home_loan', m.home_loan_rate, (x) => x + '%']]
      .map(([k, v, f]) => h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t(k)), h('div', { class: 'b' }, v == null ? '—' : f(v))))),
    !pushOn() && h('button', { class: 'btn gold', onclick: async () => { await enablePush(); render(); } }, '🔔 ', t('push_enable')),
    h('section', { class: 'card' },
      h('div', { class: 'between' }, h('h2', {}, t('todo_today')), h('button', { class: 'linkbtn', onclick: () => taskForm({}, render) }, '+ ', t('task'))),
      due.length ? due.map((d) => dueRow(d, render)) : h('div', { class: 'muted small' }, t('no_followups'))),
    h('div', { class: 'rowhd' }, h('h2', {}, t('news'))),
    chips(cats.map((c) => [c, c === 'all' ? t('all') : t('cat_' + c)]), S.newsCat, (c) => { S.newsCat = c; render(); }, 'scroll'),
    news.length ? news.map((n) => h('article', { class: 'card' },
      h('div', { class: 'tag' }, t('cat_' + n.category), ' · ', fmtDate(n.published_on, { day: 'numeric', month: 'short' })),
      h('div', { class: 'title' }, (en ? n.title_en || n.title_gu : n.title_gu || n.title_en) || ''),
      (en ? n.summary_en || n.summary_gu : n.summary_gu || n.summary_en) && h('div', { class: 'small' }, en ? n.summary_en || n.summary_gu : n.summary_gu || n.summary_en),
      h('div', { class: 'between small muted' }, h('span', {}, n.source || ''), h('span', {}, n.url && h('a', { href: n.url, target: '_blank', rel: 'noopener' }, t('read_full')), ' ', reportBtn('news', `${n.published_on} · ${n.title_en || n.title_gu} · ${n.url || ''}`)))))
      : h('div', { class: 'empty' }, t('no_news')),
  ];
}

function viewCustomers() {
  const q = { v: '' };
  const start = (text) => { const p = parseEntry(text || ''); inquiryForm({ phone: p.phone || tel(text), name: p.name, area_id: p.area_id, ptype: p.ptype, deal: p.deal === 'rent' ? 'rent' : 'buy', budget: p.price, notes: (text || '').replace(/[\d\s+()-]/g, '').length > 3 ? text : '' }, render); };
  const body = h('div', { class: 'stack' });
  const drawList = () => {
    const s = (S.crmQ || '').trim().toLowerCase();
    const rows = S.data.customers.filter((c) => !s || (c.name || '').toLowerCase().includes(s) || (c.phone || '').includes(s)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    body.replaceChildren(...(rows.length ? rows.map((c) => {
      const open = S.data.inquiries.filter((i) => i.customer_id === c.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      return h('button', { class: 'card rowcard white', onclick: () => customerSheet(c) },
        h('div', { class: 'between' }, h('span', { class: 'title' }, custLabel(c)), open && h('span', { class: 'badge st-' + (open.status || 'new') }, t('st_' + (open.status || 'new')))),
        h('div', { class: 'small muted' }, [c.name && c.phone && '+91 ' + c.phone, open && inqLine(open)].filter(Boolean).join(' · ')));
    }) : [h('div', { class: 'empty' }, t('no_inq'))]));
  };
  const board = () => h('div', { class: 'board' }, ST.map((s) => {
    const items = S.data.inquiries.filter((i) => (i.status || 'new') === s).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return h('section', { class: 'kcol' }, h('div', { class: 'between' }, h('span', { class: 'b' }, t('st_' + s)), h('span', { class: 'muted small' }, items.length)),
      items.map((i) => h('div', { class: 'card kcard' },
        h('button', { class: 'duetext', onclick: () => { const c = custOf(i.customer_id); if (c) customerSheet(c); } }, h('div', { class: 'b' }, inqName(i)), h('div', { class: 'xs muted' }, inqLine(i))),
        h('select', { class: 'badge st-' + s, 'aria-label': t('status'), value: s, onchange: async (e) => { await saveRec('inquiries', { ...i, status: e.target.value }).catch(fail); render(); } }, ST.map((x) => h('option', { value: x }, t('st_' + x)))))));
  }));
  if (S.crmView !== 'pipeline') drawList();
  return [
    h('header', { class: 'hdr' }, h('h1', { class: 'grow' }, t('customers')), h('span', { class: 'muted small' }, S.data.customers.length || '')),
    h('section', { class: 'hero col' }, h('label', { class: 'gold small', for: 'pasteNum' }, t('paste_hint')),
      h('div', { class: 'pasterow' },
        h('input', { id: 'pasteNum', class: 'input', inputmode: 'tel', placeholder: '+91', oninput: (e) => { q.v = e.target.value; } }),
        h('button', { class: 'btn gold', onclick: async () => { try { const s = await navigator.clipboard.readText(); $('#pasteNum').value = q.v = s.trim(); } catch { $('#pasteNum').focus(); } } }, t('paste')),
        h('button', { class: 'btn mid', onclick: () => start(q.v) }, t('add'))),
      h('button', { class: 'linkbtn goldlink', onclick: () => voiceBox(t('speak_add'), (text) => start(text)) }, icon('mic', 18), ' ', t('speak_add'))),
    seg([['list', t('list')], ['pipeline', t('pipeline')]], S.crmView || 'list', (v) => { S.crmView = v; render(); }),
    S.crmView === 'pipeline' ? board() : [h('input', { class: 'input', placeholder: t('search_customer'), value: S.crmQ || '', oninput: (e) => { S.crmQ = e.target.value; drawList(); } }), body],
  ];
}
function inqCard(i, after) {
  const m = matches(i);
  return h('article', { class: 'card inset' },
    h('div', { class: 'between top' }, h('div', { class: 'small b' }, inqLine(i) || '—'),
      h('select', { class: 'badge st-' + (i.status || 'new'), 'aria-label': t('status'), value: i.status || 'new', onchange: async (e) => { await saveRec('inquiries', { ...i, status: e.target.value }).catch(fail); after(); } }, ST.map((s) => h('option', { value: s }, t('st_' + s))))),
    m.length ? h('button', { class: 'linkbtn', onclick: () => openSheet(`${m.length} ${t('matches')}`, () => m.map(propCard)) }, `${m.length} ${t('matches')}`) : null,
    i.followup_at && h('div', { class: 'small goldtext b' }, `${t('followup')}: ${when(i.followup_at)}`),
    i.notes && h('div', { class: 'small' }, i.notes),
    h('button', { class: 'linkbtn', onclick: () => inquiryForm(i, after) }, t('edit')));
}
function customerSheet(c) {
  const note = { v: '' };
  const sh = openSheet(custLabel(c), (api) => {
    c = custOf(c.id) || c;
    const ph = tel(c.phone), redo = () => { api.redraw(); render(); };
    const inqs = S.data.inquiries.filter((i) => i.customer_id === c.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const acts = S.data.activities.filter((a) => a.customer_id === c.id).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const tasks = S.data.tasks.filter((x) => x.customer_id === c.id && !x.done);
    const log = async (type, text) => { try { await saveRec('activities', { customer_id: c.id, type, text: text || null, at: new Date().toISOString() }); await saveRec('customers', { ...c }); api.redraw(); } catch (e) { fail(e); } };
    return [
      c.notes && h('div', { class: 'small' }, c.notes),
      h('div', { class: 'grid3' },
        ph ? h('a', { class: 'btn green', href: 'tel:+91' + ph, onclick: () => { log('call'); } }, t('call')) : h('span', {}),
        ph ? h('button', { class: 'btn', onclick: () => waTemplates(c, log) }, t('whatsapp')) : h('span', {}),
        h('button', { class: 'btn', onclick: () => customerForm(c, (gone) => { if (gone) { sh.close(); render(); } else redo(); }) }, t('edit'))),
      h('div', { class: 'between' }, h('h3', {}, t('inquiries')), h('button', { class: 'linkbtn', onclick: () => inquiryForm({ customer_id: c.id, name: c.name, phone: c.phone }, redo) }, '+ ', t('add'))),
      inqs.map((i) => inqCard(i, redo)),
      h('div', { class: 'between' }, h('h3', {}, t('tasks')), h('button', { class: 'linkbtn', onclick: () => taskForm({ customer_id: c.id }, redo) }, '+ ', t('task'))),
      tasks.map((x) => dueRow({ at: x.due_at, title: x.title, sub: '', task: x }, redo)),
      h('h3', {}, t('history')),
      h('div', { class: 'join' }, h('input', { class: 'input', placeholder: t('notes'), oninput: (e) => { note.v = e.target.value; } }),
        h('button', { class: 'btn', onclick: () => { if (note.v.trim()) { const v = note.v; note.v = ''; log('note', v); } } }, t('add')),
        h('button', { class: 'btn', onclick: () => { const v = note.v; note.v = ''; log('visit', v); } }, t('st_visit'))),
      acts.length ? h('div', { class: 'list tight' }, acts.map((a) => h('div', { class: 'pt' }, h('div', { class: 'between small' }, h('span', { class: 'b' }, t('act_' + a.type)), h('span', { class: 'muted' }, when(a.at))), a.text && h('div', { class: 'small' }, a.text)))) : h('div', { class: 'muted small' }, '—'),
    ];
  });
}
function customerForm(init, after) {
  const f = { ...init };
  const sh = openSheet(t('customers'), () => [
    h('div', { class: 'grid2' }, field(t('name'), inp(f, 'name')), field(t('phone'), inp(f, 'phone', { inputmode: 'tel' }))),
    field(t('alt_phone'), inp(f, 'alt_phone', { inputmode: 'tel' })),
    field(t('notes'), h('textarea', { class: 'input area', rows: 3, value: f.notes || '', oninput: (e) => { f.notes = e.target.value; } })),
    h('button', { class: 'btn gold', onclick: async () => { try { await saveRec('customers', { id: f.id, created_at: f.created_at, name: f.name || null, phone: tel(f.phone) || null, alt_phone: tel(f.alt_phone) || null, notes: f.notes || null }); sh.close(); after(false); } catch (e) { fail(e); } } }, t('save')),
    f.id && h('button', { class: 'btn danger', onclick: async () => { if (!confirm(t('confirm_del'))) return; try { for (const i of S.data.inquiries.filter((x) => x.customer_id === f.id)) await delRec('inquiries', i.id); await delRec('customers', f.id); sh.close(); after(true); } catch (e) { fail(e); } } }, t('del')),
  ]);
}
function inquiryForm(init, after) {
  const f = { status: 'new', deal: 'buy', ...init };
  for (const k of Object.keys(f)) if (f[k] == null) delete f[k];
  const had = f.followup_at;
  if (f.followup_at) f.followup_at = toLocalInput(f.followup_at);
  const isNew = !f.id, known = custOf(f.customer_id);
  const sh = openSheet(t('inquiries'), (api) => [
    known ? h('div', { class: 'small b' }, custLabel(known)) : h('div', { class: 'grid2' }, field(t('name'), inp(f, 'name')), field(t('phone'), inp(f, 'phone', { inputmode: 'tel' }))),
    areaBtn(f, 'area_id', api.redraw),
    chips(PTYPES.map((p) => [p, t(p)]), f.ptype, (v) => { f.ptype = f.ptype === v ? undefined : v; api.redraw(); }, 'wrap'),
    seg([['buy', t('buy')], ['rent', t('rent')]], f.deal, (v) => { f.deal = v; api.redraw(); }),
    h('div', { class: 'grid2' }, field(t('budget'), numInp(f, 'budget')), field(t('followup'), inp(f, 'followup_at', { type: 'datetime-local' }))),
    field(t('notes'), h('textarea', { class: 'input area', rows: 2, value: f.notes || '', oninput: (e) => { f.notes = e.target.value; } })),
    h('button', { class: 'btn gold', onclick: async () => {
      try {
        const c = known || await upsertCustomer(f.name, f.phone);
        const row = await saveRec('inquiries', { id: f.id, created_at: f.created_at, customer_id: c.id, name: c.name || f.name || null, phone: c.phone || tel(f.phone) || null, area_id: f.area_id || null, ptype: f.ptype || null, deal: f.deal, budget: N(f.budget), notes: f.notes || null, status: f.status, followup_at: f.followup_at ? new Date(f.followup_at).toISOString() : null });
        if (isNew) await saveRec('activities', { customer_id: c.id, type: 'inquiry', text: inqLine(row) || null, at: new Date().toISOString() });
        sh.close(); toast(t('saved')); (after || render)();
        if (row.followup_at && row.followup_at !== had && confirm(t('add_cal') + '?')) ics(row);
      } catch (e) { fail(e); }
    } }, t('save')),
    f.id && h('button', { class: 'btn danger', onclick: async () => { if (confirm(t('confirm_del'))) { await delRec('inquiries', f.id).catch(fail); sh.close(); (after || render)(); } } }, t('del')),
  ]);
}
// Ready WhatsApp messages. {name} is replaced with the customer's name.
function waTemplates(c, log) {
  const en = getLang() === 'en', nm = c.name || '';
  const built = en ? [
    ['Introduction', 'Namaste {name}, this is Ami Realtors, Chowk Bazaar, Surat. Thank you for your inquiry. Please tell me your preferred area and budget and I will share suitable options.'],
    ['Property details', 'Namaste {name}, as discussed I am sending the property details. Please have a look and tell me a convenient time for a site visit.'],
    ['Visit confirmation', 'Namaste {name}, confirming our site visit. Please share a time that suits you. - Ami Realtors'],
    ['Follow-up', 'Namaste {name}, did you get a chance to think about the property we discussed? Happy to answer any question. - Ami Realtors'],
    ['Festival greeting', 'Namaste {name}, warm festival wishes to you and your family from Ami Realtors.'],
  ] : [
    ['ઓળખાણ', 'નમસ્તે {name}, અમી રિયલ્ટર્સ, ચોક બજાર, સુરતથી. તમારી ઇન્ક્વાયરી બદલ આભાર. તમને કયો વિસ્તાર અને કેટલું બજેટ અનુકૂળ છે તે જણાવશો તો યોગ્ય મિલકત બતાવીશ.'],
    ['મિલકતની વિગત', 'નમસ્તે {name}, આપણી વાત મુજબ મિલકતની વિગત મોકલું છું. જોઈને સાઇટ વિઝિટ માટે અનુકૂળ સમય જણાવશો.'],
    ['વિઝિટ કન્ફર્મ', 'નમસ્તે {name}, આપણી સાઇટ વિઝિટ કન્ફર્મ કરવા માટે મેસેજ કરું છું. તમને અનુકૂળ સમય જણાવશો. - અમી રિયલ્ટર્સ'],
    ['ફોલો-અપ', 'નમસ્તે {name}, આપણે જોયેલી મિલકત વિશે વિચાર્યું? કોઈ પ્રશ્ન હોય તો જણાવશો. - અમી રિયલ્ટર્સ'],
    ['તહેવારની શુભેચ્છા', 'નમસ્તે {name}, અમી રિયલ્ટર્સ તરફથી તમને અને તમારા પરિવારને તહેવારની હાર્દિક શુભેચ્છા.'],
  ];
  const f = { v: '' };
  const sh = openSheet(t('templates'), (api) => {
    const mine = cfg.get('templates', []);
    const row = (title, text, ix) => h('div', { class: 'card inset' }, h('div', { class: 'between' }, h('span', { class: 'b' }, title), ix != null && h('button', { class: 'linkbtn xs', onclick: () => { mine.splice(ix, 1); cfg.set('templates', mine); api.redraw(); } }, t('del'))),
      h('div', { class: 'small' }, text.replace('{name}', nm).replace('  ', ' ')),
      c.phone ? h('a', { class: 'btn green', target: '_blank', rel: 'noopener', href: 'https://wa.me/91' + tel(c.phone) + '?text=' + encodeURIComponent(text.replace('{name}', nm).replace('  ', ' ')), onclick: () => { if (log) log('whatsapp', title); } }, t('whatsapp')) : null);
    return [...built.map(([a, b]) => row(a, b)), ...mine.map((x, ix) => row(t('my_template'), x, ix)),
      h('textarea', { class: 'input area', rows: 3, placeholder: t('new_template'), oninput: (e) => { f.v = e.target.value; } }),
      h('button', { class: 'btn', onclick: () => { if (f.v.trim()) { mine.push(f.v.trim()); cfg.set('templates', mine); f.v = ''; api.redraw(); } } }, t('save'))];
  });
}

// ---------- brokers ----------
const brokerOf = (id) => S.data.brokers.find((b) => b.id === id);
function brokerForm(init, after) {
  const f = { ...init };
  const sh = openSheet(t('brokers'), () => [
    h('div', { class: 'grid2' }, field(t('name'), inp(f, 'name')), field(t('phone'), inp(f, 'phone', { inputmode: 'tel' }))),
    field(t('firm'), inp(f, 'firm')), field(t('notes'), inp(f, 'notes')),
    h('button', { class: 'btn gold', onclick: async () => { if (!(f.name || '').trim()) return toast(t('name'), true); try { const row = await saveRec('brokers', { id: f.id, created_at: f.created_at, name: f.name.trim(), phone: tel(f.phone) || null, firm: f.firm || null, notes: f.notes || null }); sh.close(); after(row); } catch (e) { fail(e); } } }, t('save')),
    f.id && h('button', { class: 'btn danger', onclick: async () => { if (confirm(t('confirm_del'))) { await delRec('brokers', f.id).catch(fail); sh.close(); after(null); } } }, t('del')),
  ]);
}
function brokersSheet(onPick) {
  const sh = openSheet(t('brokers'), (api) => [
    h('button', { class: 'btn gold', onclick: () => brokerForm({}, (b) => { if (onPick && b) { sh.close(); onPick(b); } else api.redraw(); }) }, icon('plus', 18), t('add')),
    S.data.brokers.length ? S.data.brokers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((b) => h('div', { class: 'card inset' },
      h('div', { class: 'between' }, h('button', { class: 'duetext grow', onclick: () => { if (onPick) { sh.close(); onPick(b); } else brokerForm(b, api.redraw); } }, h('div', { class: 'b' }, b.name), h('div', { class: 'xs muted' }, [b.firm, b.phone && '+91 ' + b.phone].filter(Boolean).join(' · '))),
        b.phone && h('a', { class: 'btn green', href: 'tel:+91' + b.phone }, t('call'))))) : h('div', { class: 'empty' }, '—'),
  ]);
}
// Brokers attached to a property or deal, each with a share of the brokerage in percent.
function brokerRows(f, redraw) {
  f.brokers = f.brokers || [];
  return h('div', { class: 'card inset' },
    h('div', { class: 'between' }, h('span', { class: 'b' }, t('other_brokers')), h('button', { type: 'button', class: 'linkbtn', onclick: () => brokersSheet((b) => { if (!f.brokers.some((x) => x.broker_id === b.id)) f.brokers.push({ broker_id: b.id, share: '' }); redraw(); }) }, '+ ', t('add'))),
    f.brokers.map((x, ix) => h('div', { class: 'join' }, h('div', { class: 'input pick' }, brokerOf(x.broker_id) ? brokerOf(x.broker_id).name : '—'),
      h('input', { class: 'input share', inputmode: 'decimal', placeholder: t('share_pct'), 'aria-label': t('share_pct'), value: x.share ?? '', oninput: (e) => { x.share = e.target.value; } }),
      h('button', { type: 'button', class: 'iconbtn', 'aria-label': t('del'), onclick: () => { f.brokers.splice(ix, 1); redraw(); } }, icon('x', 18)))));
}
const cleanBrokers = (list) => (list || []).map((x) => ({ broker_id: x.broker_id, share: N(x.share) }));
const otherShare = (r) => Math.min(100, (r.brokers || []).reduce((s, x) => s + (Number(x.share) || 0), 0));

// ---------- Prices ----------
const FRESH_DAYS = 183;
const GRADES = ['premium', 'standard', 'basic'];
function stats(areaId, ptype, kind, furnished, grade) {
  const cut = new Date(Date.now() - FRESH_DAYS * 864e5).toISOString().slice(0, 10);
  const every = S.data.price_points.filter((p) => p.area_id === areaId && p.ptype === ptype && p.kind === kind);
  let all = every.filter(inBounds);
  if (kind === 'market' && furnished != null) all = all.filter((p) => (furnished ? p.furnished === true : p.furnished !== true));
  if (grade && grade !== 'all') all = all.filter((p) => p.grade === grade);
  if (kind === 'jantri') {
    // Jantri differs by survey / TP-FP number inside one area, so show its range too. Official rates stay valid until revised.
    const sm = summarize(all);
    return { ...sm, points: all, old: [], lo: -Infinity, hi: Infinity };
  }
  const pts = all.filter((p) => String(p.observed_on) >= cut);
  return { ...summarize(pts), points: pts, old: all.filter((p) => String(p.observed_on) < cut), bad: every.filter((p) => !inBounds(p)) };
}
function viewPrices() {
  const P = S.price, a = areaById(P.area) || AREAS[0], unit = unitsFor(P.ptype).includes(P.unit) ? P.unit : defaultUnit(P.ptype), rd = () => render();
  const j = stats(a.id, P.ptype, 'jantri'), d = stats(a.id, P.ptype, 'dastavej'), mk = stats(a.id, P.ptype, 'market', P.furnished, P.grade), gd = stats(a.id, P.ptype, 'gidc');
  const estP = mk.median == null ? knn(a.lat, a.lng, P.ptype, a.id) : null;
  const quotes = [...mk.points, ...d.points, ...j.points, ...gd.points].sort((x, y) => String(y.observed_on).localeCompare(String(x.observed_on)));
  const last = quotes.map((p) => p.observed_on).sort().pop();
  const bare = (v) => rate(v, unit).replace('₹ ', '');
  const head = { range: mk.used > 1 && mk.min !== mk.max ? `₹ ${bare(mk.min)} – ${bare(mk.max)}` : rate(mk.median, unit), median: rate(mk.median, unit), mean: rate(mk.mean, unit), low: rate(mk.min, unit), high: rate(mk.max, unit) }[P.stat];
  const line = (label, sub, val, strong) => h('div', { class: 'rate' + (strong ? ' strong' : '') }, h('div', {}, h('div', { class: 'b' }, label), sub && h('div', { class: 'xs ' + (strong ? 'goldtext b' : 'muted') }, sub)), h('div', { class: 'num' }, val));
  const quote = (p, old) => {
    const out = p.kind === 'market' && !old && (p.price_sqft < mk.lo || p.price_sqft > mk.hi);
    return h('div', { class: 'pt' + (out || old ? ' out' : '') },
      h('div', { class: 'between small' }, h('span', { class: 'b' }, rate(p.price_sqft, unit), p.kind !== 'market' ? ` · ${t(p.kind)}` : '', out ? ` (${t('outlier')})` : '', old === 'bad' ? ` (${t('check_quote')})` : old ? ` (${t('old_quote')})` : ''),
        h('span', {}, p.grade && h('span', { class: 'gbadge g-' + p.grade }, t('g_' + p.grade)), ' ', h('span', { class: 'muted' }, fmtDate(p.observed_on, { day: 'numeric', month: 'short', year: '2-digit' })))),
      h('div', { class: 'between xs muted' }, h('span', {}, t('src_' + (p.source || 'other')), p.broker_id && brokerOf(p.broker_id) ? ' · ' + brokerOf(p.broker_id).name : '', p.note ? ' · ' + p.note : ''),
        h('span', {}, p.source_url && h('a', { href: p.source_url, target: '_blank', rel: 'noopener' }, t('link')), ' ', reportBtn('price', `${a.en} · ${p.ptype} · ${p.kind} · ₹${Math.round(p.price_sqft)}/sqft · ${p.observed_on} · ${p.source_url || p.note || ''}`), ' ', !p.pub && (p.owner || !cloud.ready) && h('button', { class: 'linkbtn xs', onclick: async () => { if (confirm(t('confirm_del'))) { await delRec('price_points', p.id).catch(fail); rd(); } } }, t('del')))));
  };
  return [
    h('header', { class: 'hdr' },
      h('button', { class: 'grow areahd', onclick: () => pickArea((x) => { P.area = x.id; rd(); }) }, h('h1', {}, areaName(a, getLang()), icon('down', 20)),
        h('div', { class: 'muted small' }, `${a.district} · ${getLang() === 'en' ? Math.round(km(SURAT.lat, SURAT.lng, a.lat, a.lng)) + ' km from Surat' : 'સુરતથી ' + Math.round(km(SURAT.lat, SURAT.lng, a.lat, a.lng)) + ' કિમી'}${last ? ' · ' + t('updated') + ' ' + fmtDate(last, { day: 'numeric', month: 'short' }) : ''}`)),
      h('select', { class: 'input sel', 'aria-label': t('type'), value: P.ptype, onchange: (e) => { P.ptype = e.target.value; P.unit = null; rd(); } }, PTYPES.map((p) => h('option', { value: p }, t(p))))),
    h('div', { class: 'grid5', style: `grid-template-columns: repeat(${unitsFor(P.ptype).length}, minmax(0, 1fr))` }, unitsFor(P.ptype).map((u) => h('button', { class: 'chip sq' + (u === unit ? ' on' : ''), 'aria-pressed': String(u === unit), onclick: () => { P.unit = u; rd(); } }, unitLabel(u)))),
    seg([[false, t('unfurnished')], [true, t('furnished')]], P.furnished, (v) => { P.furnished = v; rd(); }),
    chips([['all', t('all')], ...GRADES.map((g) => [g, t('g_' + g)])], P.grade, (v) => { P.grade = v; rd(); }, 'scroll'),
    h('section', { class: 'card rates' },
      line(t('market_rate'), mk.median == null ? (estP ? `${t('nearby_estimate')}: ${knnLine(estP, unit)}` : t('no_price')) : [P.stat === 'range' && `${t('median')} ${rate(mk.median, unit)}`, pct(mk.median, j.median) && `${t('vs_jantri')} ${pct(mk.median, j.median)}`, `${mk.used} ${t('prices_found')}`, mk.dropped ? `${mk.dropped} ${t('dropped')}` : null].filter(Boolean).join(' · '), mk.median == null ? (estP ? '≈ ' + rate(estP.value, unit) : '—') : head, true),
      h('div', { class: 'statseg' }, seg([['range', t('range')], ['median', t('median')], ['mean', t('mean')], ['low', t('low')], ['high', t('high')]], P.stat, (v) => { P.stat = v; rd(); })),
      line(t('dastavej'), pct(d.median, j.median) && `${t('vs_jantri')} ${pct(d.median, j.median)}`, rate(d.median, unit)),
      line(t('jantri'), [t('jantri_sub') + ' · ' + t('src_garvi'), j.used > 1 && `${t('median')} ${rate(j.median, unit)} · ${j.used} TP/FP`].filter(Boolean).join(' · '), j.used > 1 && j.min !== j.max ? `₹ ${bare(j.min)} – ${bare(j.max)}` : rate(j.median, unit)),
      gd.median != null && line(t('gidc'), t('gidc_sub') + ' · 2026-27', rate(gd.median, unit))),
    a.ind ? h('div', { class: 'xs goldtext b' }, '🏭 ', t('ind_estate'), ' — ', t('ind_only')) : null,
    h('div', { class: 'grid2' },
      h('button', { class: 'btn green', onclick: () => pricePointForm({ area_id: a.id, ptype: P.ptype, unit }) }, icon('plus', 18), t('add_price')),
      h('button', { class: 'btn', onclick: () => pasteMessage(a.id, P.ptype) }, t('paste_msg'))),
    h('button', { class: 'btn', onclick: bulkPaste }, '📋 ', t('bulk_paste')),
    h('section', { class: 'card' }, h('h2', {}, t('all_quotes'), ' (', quotes.length + mk.old.length + (mk.bad || []).length, ')'),
      h('div', { class: 'xs muted' }, t('quotes_note')),
      quotes.length + mk.old.length + (mk.bad || []).length ? h('div', { class: 'list tight' }, quotes.map((p) => quote(p)), mk.old.map((p) => quote(p, true)), (mk.bad || []).map((p) => quote(p, 'bad'))) : h('div', { class: 'muted small' }, t('no_price'))),
    insightCard(a, mk, unit),
    factsCard(a, mk, j),
    projectsHere(a),
    landLinks(a),
  ];
}
// ---------- quick facts for every area (computed, so no area is left blank) ----------
const LANDMARKS = [['d_station', 21.2049, 72.8411], ['d_airport', 21.1141, 72.7418], ['d_sdb', 21.1297, 72.8159]];
function factsCard(a, mk, j) {
  const en = getLang() === 'en', tags = S.tags[a.id] || {};
  const gidc = AREAS.filter((x) => x.ind && x.id !== a.id && sameBank(a.lat, a.lng, x)).map((x) => ({ x, d: km(a.lat, a.lng, x.lat, x.lng) })).sort((p, q) => p.d - q.d)[0];
  const n = S.projects ? S.projects.filter((p) => p.area_id === a.id).length : null;
  const row = (k, v) => h('div', { class: 'between small' }, h('span', {}, k), h('span', { class: 'b' }, v));
  const kmTxt = (d) => (d < 1 ? '< 1' : Math.round(d)) + (en ? ' km' : ' કિમી');
  const pc = [];
  if (n != null && n >= 3) pc.push(['pro', `${t('f_pipe_pro')} (${n})`]);
  if (n != null && n >= 25) pc.push(['con', `${t('f_pipe_con')} (${n})`]);
  if (!a.ind && gidc && gidc.d <= 2.5) pc.push(['con', `${t('f_gidc_near')}: ${areaName(gidc.x, getLang())} ${kmTxt(gidc.d)}`]);
  if (!a.ind && gidc && gidc.d > 2.5 && gidc.d <= 6) pc.push(['pro', `${t('f_jobs_near')}: ${areaName(gidc.x, getLang())} ${kmTxt(gidc.d)}`]);
  if (tags.metro) pc.push(['pro', `${t('f_metro')} (${t('tv_' + tags.metro)})`]);
  if (mk.median && j.median) pc.push([mk.median / j.median > 2.5 ? 'con' : 'pro', `${t('f_gap')} ${pct(mk.median, j.median)}`]);
  return h('section', { class: 'card' }, h('h2', {}, t('facts')),
    LANDMARKS.map(([k, la, ln]) => row(t(k), kmTxt(km(a.lat, a.lng, la, ln)))),
    gidc && !a.ind && row(t('d_gidc'), `${areaName(gidc.x, getLang())} · ${kmTxt(gidc.d)}`),
    n != null && row(t('f_pipeline'), String(n)),
    pc.map(([k, txt]) => h('div', { class: 'pc ' + k }, h('div', { class: 'small' }, (k === 'pro' ? '+ ' : '− ') + txt))),
    h('div', { class: 'xs muted' }, t('facts_note')));
}
function landLinks(a) {
  const L = [['l_anyror', 'https://anyror.gujarat.gov.in/'], ['l_bhunaksha', 'https://bhunakshaanyror.gujarat.gov.in/'], ['l_garvi', 'https://garvi.gujarat.gov.in/'], ['l_gujrera', 'https://gujrera.gujarat.gov.in/'], ['l_bisag', 'https://bisag-n.gov.in/'], ['l_rnb', 'https://rnb.gujarat.gov.in/'], ['l_marugujarat', 'https://www.marugujarat.in/']];
  return h('section', { class: 'card' }, h('h2', {}, t('land_records')), h('div', { class: 'xs muted' }, a.en, ' · ', a.district),
    L.map(([k, u]) => h('a', { class: 'row', href: u, target: '_blank', rel: 'noopener' }, h('span', {}, t(k)), icon('chev', 16))));
}
// ---------- area pros and cons ----------
const TAGS = ['metro', 'smc_limit', 'tp', 'drainage', 'water'];
function areaPoints(a) {
  const en = getLang() === 'en';
  const pub = S.insights.filter((i) => i.area_id === a.id).map((i) => ({ kind: i.kind, text: (en ? i.title_en || i.title_gu : i.title_gu || i.title_en) || '', en: i.title_en || i.title_gu || '', url: i.url, source: i.source, date: i.date }));
  const own = S.data.area_notes.filter((n) => n.area_id === a.id).map((n) => ({ kind: n.kind, text: n.text, en: n.text, own: n }));
  return [...own, ...pub];
}
function insightCard(a, mk, unit) {
  const pts = areaPoints(a), tags = S.tags[a.id] || {};
  const list = (kind) => { const xs = pts.filter((p) => p.kind === kind); return xs.length ? xs.map((p) => h('div', { class: 'pc ' + kind },
    h('div', { class: 'small' }, p.text),
    h('div', { class: 'between xs muted' }, h('span', {}, p.own ? t('own_note') : [p.source, p.date && fmtDate(p.date, { day: 'numeric', month: 'short', year: '2-digit' })].filter(Boolean).join(' · ')),
      h('span', {}, p.url && h('a', { href: p.url, target: '_blank', rel: 'noopener' }, t('link')), !p.own && ' ', !p.own && reportBtn('insight', `${a.en} · ${p.kind} · ${p.en} · ${p.url || ''}`), p.own && h('button', { class: 'linkbtn xs', onclick: async () => { if (confirm(t('confirm_del'))) { await delRec('area_notes', p.own.id).catch(fail); render(); } } }, t('del')))))) : h('div', { class: 'muted small' }, '—'); };
  const shown = TAGS.filter((k) => tags[k]);
  return h('section', { class: 'card' },
    h('div', { class: 'between' }, h('h2', {}, t('pros_cons')), h('button', { class: 'linkbtn', onclick: () => noteForm(a) }, '+ ', t('own_note'))),
    shown.length ? h('div', { class: 'chips wrap' }, shown.map((k) => h('span', { class: 'tagb v-' + tags[k] }, `${t('tag_' + k)}: ${t('tv_' + tags[k])}`))) : null,
    h('h3', {}, t('pros')), list('pro'), h('h3', {}, t('cons')), list('con'),
    h('button', { class: 'btn gold', onclick: () => shareArea(a, mk, unit).catch(fail) }, t('share_area')));
}
function noteForm(a) {
  const f = { kind: 'pro', text: '' };
  const sh = openSheet(areaName(a, getLang()), (api) => [
    seg([['pro', t('pros')], ['con', t('cons')]], f.kind, (v) => { f.kind = v; api.redraw(); }),
    h('textarea', { class: 'input area', rows: 3, value: f.text, oninput: (e) => { f.text = e.target.value; } }),
    h('button', { class: 'btn gold', onclick: async () => { if (!f.text.trim()) return; try { await saveRec('area_notes', { area_id: a.id, kind: f.kind, text: f.text.trim() }); sh.close(); render(); } catch (e) { fail(e); } } }, t('save'))]);
}
// Area summary card for clients, in English like the property card.
async function shareArea(a, mk, unit) {
  const W = 1080, H = 1350, c = h('canvas', { width: W, height: H }), x = c.getContext('2d');
  const font = (w, s) => { x.font = `${w} ${s}px -apple-system, "Helvetica Neue", Arial, sans-serif`; };
  const wrap = (text, px, py, maxW, lh, maxLines) => { const words = String(text).split(/\s+/); let ln = '', n = 0; for (const w of words) { if (x.measureText(ln + w).width > maxW && ln) { x.fillText(ln.trim(), px, py + n * lh); n++; ln = ''; if (n >= maxLines) return n; } ln += w + ' '; } if (ln.trim() && n < maxLines) { x.fillText(ln.trim(), px, py + n * lh); n++; } return n; };
  x.fillStyle = '#F6F4EE'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#0E3B2E'; x.fillRect(0, 0, W, 300);
  x.fillStyle = '#E3B341'; font(700, 34); x.fillText('AREA SNAPSHOT · ' + a.district.toUpperCase(), 64, 110);
  x.fillStyle = '#FFFFFF'; font(700, 84); x.fillText(a.en, 64, 210, W - 128);
  const U = { sqft: 'sq ft', sqm: 'sq m', var: 'sq yd', vigha: 'vigha', acre: 'acre', hectare: 'hectare' }[unit], r = (v) => Math.round(rateFromSqft(v, unit, vigha())).toLocaleString('en-IN');
  x.fillStyle = '#14201B'; font(700, 54);
  x.fillText(mk.median == null ? 'Price on request' : (mk.used > 1 && mk.min !== mk.max ? `Rs ${r(mk.min)} - ${r(mk.max)} per ${U}` : `Rs ${r(mk.median)} per ${U}`), 64, 400, W - 128);
  x.fillStyle = '#4A5650'; font(400, 32); x.fillText(`${EN[S.price.ptype] || ''}${mk.median != null && mk.used > 1 ? ' · median Rs ' + r(mk.median) + ' · ' + mk.used + ' recent quotes' : ''}`, 64, 452, W - 128);
  let y = 540; const pts = areaPoints(a);
  for (const [kind, label, col] of [['pro', 'Advantages', '#0E3B2E'], ['con', 'Points to check', '#7A5A12']]) {
    const xs = pts.filter((p) => p.kind === kind).slice(0, 4); if (!xs.length) continue;
    x.fillStyle = col; font(700, 40); x.fillText(label, 64, y); y += 56;
    x.fillStyle = '#14201B'; font(400, 34);
    for (const p of xs) { x.fillText('•', 64, y); y += wrap(p.en, 100, y, W - 170, 46, 3) * 46 + 14; }
    y += 24;
  }
  x.fillStyle = '#0E3B2E'; x.fillRect(0, 1190, W, 160);
  x.fillStyle = '#E3B341'; font(700, 52); x.fillText('AMI REALTORS', 64, 1285);
  x.fillStyle = '#FFFFFF'; x.textAlign = 'right'; font(600, 34); x.fillText(cfg.get('bizPhone', '') || 'Chowk Bazaar, Surat', W - 64, 1283); x.textAlign = 'left';
  const out = await new Promise((res) => c.toBlob(res, 'image/png')), file = new File([out], `ami-${a.id}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] }).catch(() => {});
  else h('a', { href: URL.createObjectURL(out), download: file.name }).click();
}

// ---------- capital gains tax on property ----------
// Cost Inflation Index, FY 2001-02 = 100. FY 2026-27 = 384 (CBDT notification 85/2026).
const CII = { 2001: 100, 2002: 105, 2003: 109, 2004: 113, 2005: 117, 2006: 122, 2007: 129, 2008: 137, 2009: 148, 2010: 167, 2011: 184, 2012: 200, 2013: 220, 2014: 240, 2015: 254, 2016: 264, 2017: 272, 2018: 280, 2019: 289, 2020: 301, 2021: 317, 2022: 331, 2023: 348, 2024: 363, 2025: 376, 2026: 384 };
const fyStart = (d) => { const x = new Date(d); return x.getMonth() >= 3 ? x.getFullYear() : x.getFullYear() - 1; };
const ciiFor = (d) => CII[Math.max(2001, Math.min(2026, fyStart(d)))];
function capGains(f) {
  const buy = new Date(f.buy_date), sell = new Date(f.sell_date);
  if (isNaN(buy) || isNaN(sell) || sell <= buy) return null;
  const months = (sell.getFullYear() - buy.getFullYear()) * 12 + (sell.getMonth() - buy.getMonth()) - (sell.getDate() < buy.getDate() ? 1 : 0);
  const cost = N(f.cost) || 0, impr = N(f.improve) || 0, exp = N(f.expenses) || 0, price = N(f.price) || 0, stamp = N(f.stamp_value) || 0;
  // If the jantri (stamp duty) value is more than 110% of the price, the jantri value is taken as the sale price.
  const consideration = stamp > price * 1.1 ? stamp : price;
  const cess = 1.04, longTerm = months > 24, exempt = N(f.exempt) || 0;
  if (!longTerm) {
    const gain = consideration - exp - cost - impr, slab = (N(f.slab) || 0) / 100;
    return { months, longTerm, consideration, gain, taxable: Math.max(0, gain), tax: Math.max(0, gain) * slab * cess, method: 'stcg' };
  }
  const gainA = consideration - exp - cost - impr;
  const taxA = Math.max(0, gainA - exempt) * 0.125 * cess;
  const r = { months, longTerm, consideration, gain: gainA, taxable: Math.max(0, gainA - exempt), tax: taxA, method: 'a', taxA };
  // Bought before 23 July 2024 by a resident individual or HUF: may pay 20% on the indexed gain instead, whichever is lower.
  if (buy < new Date('2024-07-23') && f.resident !== false) {
    const idxCost = cost * ciiFor(sell) / ciiFor(buy < new Date('2001-04-01') ? new Date('2001-04-01') : buy);
    const idxImpr = f.improve_date ? impr * ciiFor(sell) / ciiFor(f.improve_date) : impr;
    const gainB = consideration - exp - idxCost - idxImpr, taxB = Math.max(0, gainB - exempt) * 0.20 * cess;
    Object.assign(r, { idxCost, gainB, taxB });
    if (taxB < taxA) Object.assign(r, { gain: gainB, taxable: Math.max(0, gainB - exempt), tax: taxB, method: 'b' });
  }
  return r;
}
function cgCalc() {
  const f = { buy_date: '', cost: '', improve: '', improve_date: '', sell_date: new Date().toISOString().slice(0, 10), price: '', stamp_value: '', expenses: '', exempt: '', slab: 30, resident: true };
  const out = h('div', { class: 'card inset' });
  const calc = () => {
    const r = capGains(f);
    if (!r) return out.replaceChildren(h('div', { class: 'small muted' }, t('cg_fill')));
    const rows = [result(t('cg_holding'), `${r.months} ${t('cg_months')} · ${r.longTerm ? t('cg_ltcg') : t('cg_stcg')}`), result(t('cg_consideration'), money(r.consideration))];
    if (r.longTerm) {
      rows.push(result(t('cg_opt_a'), money(r.taxA)));
      if (r.taxB != null) rows.push(result(`${t('cg_opt_b')} (${t('cg_indexed_cost')} ${money(r.idxCost)})`, money(r.taxB)));
    }
    rows.push(result(t('cg_gain'), money(r.gain)), result(t('cg_tax'), money(r.tax), true),
      h('div', { class: 'xs muted' }, r.method === 'b' ? t('cg_used_b') : r.method === 'a' ? t('cg_used_a') : t('cg_used_stcg')));
    if (N(f.price) >= 5e6) rows.push(h('div', { class: 'xs muted' }, t('cg_tds')));
    out.replaceChildren(...rows);
  };
  openSheet(t('cg_calc'), () => [
    h('div', { class: 'grid2' }, field(t('cg_buy_date'), inp(f, 'buy_date', { type: 'date' })), field(t('cg_cost'), numInp(f, 'cost'))),
    h('div', { class: 'grid2' }, field(t('cg_improve'), numInp(f, 'improve')), field(t('cg_improve_date'), inp(f, 'improve_date', { type: 'date' }))),
    h('div', { class: 'grid2' }, field(t('cg_sell_date'), inp(f, 'sell_date', { type: 'date' })), field(t('cg_price'), numInp(f, 'price'))),
    h('div', { class: 'grid2' }, field(t('cg_stamp_value'), numInp(f, 'stamp_value')), field(t('cg_expenses'), numInp(f, 'expenses'))),
    h('div', { class: 'grid2' }, field(t('cg_exempt'), numInp(f, 'exempt')), field(t('cg_slab'), numInp(f, 'slab'))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { f.resident = e.target.checked; calc(); } }), t('cg_resident')),
    out, h('p', { class: 'xs muted' }, t('cg_note')),
  ]).body.addEventListener('input', calc);
  calc();
}

// ---------- More ----------
function viewMore() {
  const row = (k, fn) => h('button', { class: 'row big', onclick: fn }, h('span', {}, t(k)), icon('chev', 18));
  return [h('header', { class: 'hdr' }, h('h1', { class: 'grow' }, t('more'))),
    h('section', { class: 'card' }, row('prices', () => go('prices')), row('bulk_paste', bulkPaste), row('brokers', () => brokersSheet()), row('commission', commission)),
    h('section', { class: 'card' }, row('emi_calc', emiCalc), row('stamp_calc', stampCalc), row('cg_calc', cgCalc)),
    h('section', { class: 'card' }, row('reports', reportsSheet), row('settings', settings))];
}

// ---------- report a wrong price, news item, project or ad ----------
// Reports are kept on the phone (and in the cloud when the reports table exists) and can be sent on WhatsApp in one go.
const REPORTS_KEY = 'reports';
function reportBtn(kind, ref) { return h('button', { class: 'linkbtn xs flag', 'aria-label': t('report'), onclick: (e) => { e.stopPropagation(); reportSheet(kind, ref); } }, '⚑ ', t('report')); }
function reportSheet(kind, ref) {
  const f = { reason: 'wrong', note: '' };
  const sh = openSheet(t('report_title'), (api) => [
    h('div', { class: 'xs muted' }, ref),
    chips(['wrong', 'old', 'link', 'area', 'dup', 'other'].map((r) => [r, t('r_' + r)]), f.reason, (v) => { f.reason = v; api.redraw(); }, 'wrap'),
    field(t('report_note'), h('textarea', { class: 'input area', rows: 2, oninput: (e) => { f.note = e.target.value; } })),
    h('button', { class: 'btn gold', onclick: async () => {
      const r = { id: 'r' + Date.now(), kind, ref, reason: f.reason, note: f.note.trim(), at: new Date().toISOString() };
      const all = cfg.get(REPORTS_KEY, []); all.unshift(r); cfg.set(REPORTS_KEY, all.slice(0, 500));
      if (cloud.ready) { try { await store.save('reports', { kind, ref, reason: f.reason, note: r.note }); } catch { /* table not created yet: kept on phone */ } }
      sh.close(); toast(t('reported'));
    } }, t('report_send'))]);
}
function reportsSheet() {
  const all = cfg.get(REPORTS_KEY, []);
  const text = all.map((r) => `• [${r.kind}] ${t('r_' + r.reason)}: ${r.ref}${r.note ? ' — ' + r.note : ''}`).join('\n');
  openSheet(t('reports'), () => [
    all.length ? all.map((r) => h('div', { class: 'pt' }, h('div', { class: 'small b' }, `${t('r_' + r.reason)} · ${fmtDate(r.at, { day: 'numeric', month: 'short' })}`), h('div', { class: 'xs muted' }, r.ref), r.note && h('div', { class: 'xs' }, r.note))) : h('div', { class: 'muted' }, t('no_reports')),
    all.length && h('a', { class: 'btn green', href: 'https://wa.me/?text=' + encodeURIComponent('Ami Realtors app – reports\n' + text), target: '_blank', rel: 'noopener' }, 'WhatsApp')]);
}

// ---------- new projects (GujRERA, all registered projects due 2025-2030) ----------
const SB_PUBLIC_KEY = 'sb_publishable_LBFkjCG99kfNQBPHuw_xxQ_bBdmIw-u';
const PROJ_KEY = 'projects.v1';
async function loadProjects(force) {
  const c = cfg.get(PROJ_KEY, null);
  if (!force && c && Date.now() - c.at < 864e5) { S.projects = c.rows; return; }
  const base = (cfg.get('sbUrl') || DEFAULT_SB_URL) + '/rest/v1/projects?select=rera,name,promoter,ptype,area_id,locality,taluka,district,end_month,phone,price_from,price_to,price_note,price_url&end_month=gte.2025-01&end_month=lte.2030-12&order=end_month';
  const key = SB_PUBLIC_KEY;
  try {
    let rows = [];
    for (let from = 0; from < 10000; from += 1000) {
      const r = await fetch(base, { headers: { apikey: key, Authorization: 'Bearer ' + key, Range: `${from}-${from + 999}` } });
      if (!r.ok) break;
      const part = await r.json(); rows = rows.concat(part); if (part.length < 1000) break;
    }
    if (rows.length) { S.projects = rows; try { cfg.set(PROJ_KEY, { at: Date.now(), rows }); } catch { /* storage full */ } }
  } catch { /* offline */ }
  if (!S.projects) S.projects = c ? c.rows : [];
}
// ---------- villages with official rural jantri (Garvi), stored in Supabase ----------
async function loadVillages() {
  if (S.villagesLoaded) return; S.villagesLoaded = true;
  const key = SB_PUBLIC_KEY, url = (cfg.get('sbUrl') || DEFAULT_SB_URL) + '/rest/v1/villages?select=*&lat=not.is.null';
  let rows = cfg.get('villages.v1', null);
  try { const r = await fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key, Range: '0-1999' } }); if (r.ok) { rows = await r.json(); try { cfg.set('villages.v1', rows); } catch { /* full */ } } } catch { /* offline: use cache */ }
  if (!rows || !rows.length) return;
  const title = (x) => String(x).toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
  const known = new Set(AREAS.flatMap((a) => a.keys));
  const SQM = 10.7639, src = 'https://garvi.gujarat.gov.in/frmPropertCount2.aspx';
  for (const v of rows) {
    const nm = String(v.name).toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const id = 'v-' + v.id;
    if (!areaById(id)) AREAS.push({ id, en: title(nm), gu: title(nm), district: v.district || 'Surat', lat: v.lat, lng: v.lng, ind: 0, village: true, taluka: title(v.taluka || ''), keys: known.has(nm) ? [nm + ' ' + String(v.taluka || '').toLowerCase()] : [nm] });
    const note = (k) => `Garvi rural jantri, ${k}, ${title(v.taluka || '')} taluka${v.survey ? ', survey ' + v.survey : ''}`;
    if (v.agri_sqm) S.data.price_points.push({ id: id + '-agri', pub: true, area_id: id, ptype: 'land', kind: 'jantri', price_sqft: v.agri_sqm / SQM, source: 'garvi', source_url: src, note: note('agricultural (irrigated) Rs ' + v.agri_sqm + '/sq m'), observed_on: v.observed_on });
    if (v.na_res_sqm) S.data.price_points.push({ id: id + '-na', pub: true, area_id: id, ptype: 'plot', kind: 'jantri', price_sqft: v.na_res_sqm / SQM, source: 'garvi', source_url: src, note: note('NA residential Rs ' + v.na_res_sqm + '/sq m'), observed_on: v.observed_on });
  }
  S.fits = null;
  if (S.tab === 'map' && S.map) drawPins();
}
const projArea = (p) => (areaById(p.area_id) ? areaName(areaById(p.area_id), getLang()) : (p.locality || p.taluka || '').replace(/\b\w/g, (m) => m.toUpperCase()));
// Expected launch rate for a new project with no quoted price: today's rate where it stands (own quotes or the model)
// plus a new-construction premium that is highest in the city and fades outside it. Premiums are editable in Settings.
const premIn = () => Number(cfg.get('np.premIn', 20)) || 0, premOut = () => Number(cfg.get('np.premOut', 6)) || 0;
function newPremium(dKm) { const a = premIn(), b = premOut(); if (dKm <= 5) return a; if (dKm >= 20) return b; return a + (b - a) * ((dKm - 5) / 15); }
function expectedRate(p) {
  const pos = projPin(p) || areaById(p.area_id); if (!pos) return null;
  const pt = p.ptype === 'plotted' ? 'plot' : p.ptype === 'commercial' ? 'shop' : 'flat';
  const base = priceAt(pos.lat, pos.lng, pt, projPin(p) ? null : areaById(p.area_id)); if (!base) return null;
  const prem = newPremium(coreKm(pos.lat, pos.lng)) / 100, k = 1 + prem;
  const lo = (base.lo ?? base.value * 0.9) * k, hi = (base.hi ?? base.value * 1.1) * k;
  return { pt, value: base.value * k, lo, hi, prem: Math.round(prem * 100), base: base.value, own: !!base.own };
}
function projCard(p) {
  const ph = tel(p.phone), PP = S.projPrices || {}, pp = PP[p.rera] || PP['name:' + String(p.name).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()] || {};
  const from = p.price_from || pp.from, to = p.price_to || pp.to, rsq = pp.rate_sqft;
  return h('article', { class: 'card' },
    h('div', { class: 'tag' }, [t('p_' + (p.ptype || 'residential')), projArea(p)].filter(Boolean).join(' · ')),
    h('div', { class: 'title' }, p.name),
    h('div', { class: 'small' }, `${t('builder')}: ${p.promoter}`),
    h('div', { class: 'between small' }, h('span', { class: 'b' }, `${t('possession')}: ${fmtDate(p.end_month + '-01', { month: 'short', year: 'numeric' })}`), h('span', { class: 'xs muted' }, `${t('rera')} ${(p.rera.match(/[RCMP]AA\d+/) || [p.rera])[0]}`)),
    rsq && !from ? h('div', { class: 'small b' }, `${t('quoted')}: ${rate(rsq, 'sqft')} / ${unitLabel('sqft')} · ${pp.note || ''}`, pp.url && h('a', { class: 'xs', href: pp.url, target: '_blank', rel: 'noopener' }, ' ', t('link'))) : from ? h('div', { class: 'small b' }, `${t('quoted')}: ${moneyShort(from)}${to && to !== from ? ' – ' + moneyShort(to) : ''}${pp.note || p.price_note ? ' · ' + (pp.note || p.price_note) : ''}`, (pp.url || p.price_url) && h('a', { class: 'xs', href: pp.url || p.price_url, target: '_blank', rel: 'noopener' }, ' ', t('link')))
      : (() => { const e = expectedRate(p); if (!e) return h('div', { class: 'small muted' }, t('price_na')); const u = defaultUnit(e.pt);
        return h('div', {}, h('div', { class: 'small b' }, `${t('expected')}: ₹ ${Math.round(rateFromSqft(e.lo, u, vigha())).toLocaleString('en-IN')} – ${Math.round(rateFromSqft(e.hi, u, vigha())).toLocaleString('en-IN')} / ${unitLabel(u)}`),
          h('div', { class: 'xs muted' }, `${e.own ? t('area_rate') : t('model_price')} ${rate(e.base, u)} + ${t('new_premium')} ${e.prem}% · ${t('ask_builder')}`)); })(),
    h('div', { class: 'grid3' },
      ph ? h('a', { class: 'btn green', href: 'tel:+91' + ph }, t('call')) : h('span', {}),
      ph ? h('a', { class: 'btn', href: 'https://wa.me/91' + ph, target: '_blank', rel: 'noopener' }, 'WhatsApp') : h('span', {}),
      reportBtn('project', `${p.name} · ${p.rera}`)),
    h('div', { class: 'grid2' },
      (() => { const pin = projPin(p); return pin ? gmapsBtn(pin.lat, pin.lng) : gmapsBtn(null, null, `${p.name}, ${(areaById(p.area_id) || {}).en || projArea(p)}, ${p.district || 'Surat'}, Gujarat`); })(),
      h('button', { class: 'btn', onclick: () => { const a = areaById(p.area_id) || SURAT, pin = projPin(p); pinPicker(p.name, pin ? { ...pin, exact: true } : { lat: a.lat, lng: a.lng }, (pos) => { const all = cfg.get(PROJPIN_KEY, {}); all[p.rera] = { lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6) }; cfg.set(PROJPIN_KEY, all); toast(t('saved')); render(); }); } }, projPin(p) ? '📌 ' + t('pin_move') : '📍 ' + t('pin_set'))));
}
function viewProjects() {
  if (!S.projects) { loadProjects().then(render); return [h('div', { class: 'empty' }, t('loading'))]; }
  if (!S.projects.length) return [h('div', { class: 'empty' }, t('proj_offline')), h('button', { class: 'btn', onclick: () => { S.projects = null; loadProjects(true).then(render); } }, t('retry'))];
  const Q = S.projQ ||= { year: 'all', type: 'all', q: '', area: null, n: 40 };
  const q = Q.q.trim().toLowerCase();
  const list = S.projects.filter((p) => (Q.year === 'all' || p.end_month.startsWith(Q.year)) && (Q.type === 'all' || p.ptype === Q.type) && (!Q.area || p.area_id === Q.area) && (!Q.areas || Q.areas.includes(p.area_id))
    && (!q || [p.name, p.promoter, projArea(p), p.locality, p.taluka, p.end_month, areaName(areaById(p.area_id) || {}, 'gu')].join(' ').toLowerCase().includes(q)));
  const years = ['all', '2025', '2026', '2027', '2028', '2029', '2030'];
  return [
    h('label', { class: 'searchbox flat' }, icon('search', 18), h('input', { placeholder: t('search_proj'), value: Q.q, oninput: (e) => { Q.q = e.target.value; Q.n = 40; clearTimeout(S.pqT); S.pqT = setTimeout(render, 250); } })),
    Q.area && h('button', { class: 'chip on', onclick: () => { Q.area = null; render(); } }, areaName(areaById(Q.area), getLang()), ' ✕'),
    Q.areas && h('button', { class: 'chip on', onclick: () => { Q.areas = null; render(); } }, Q.areas.map((id) => areaName(areaById(id), getLang())).filter(Boolean).slice(0, 4).join(', '), ' ✕'),
    chips(years.map((y) => [y, y === 'all' ? t('all') : y]), Q.year, (v) => { Q.year = v; Q.n = 40; render(); }, 'scroll'),
    chips(['all', 'residential', 'plotted', 'mixed', 'commercial'].map((k) => [k, k === 'all' ? t('all') : t('p_' + k)]), Q.type, (v) => { Q.type = v; Q.n = 40; render(); }, 'scroll'),
    h('div', { class: 'between' }, h('div', { class: 'xs muted' }, `${list.length} ${t('proj_count')} · ${t('proj_src')}`),
      h('button', { class: 'chip' + (Q.mapOn ? ' on' : ''), onclick: () => { Q.mapOn = !Q.mapOn; render(); } }, '🗺 ', t('map'))),
    Q.mapOn ? h('div', { id: 'pmap', class: 'pmap', style: 'height:380px;flex:none;border-radius:18px;overflow:hidden;margin:6px 0 10px' }) : null,
    !list.length && h('button', { class: 'btn gold', onclick: () => { S.projQ = { year: 'all', type: 'all', q: '', area: null, n: 40, mapOn: Q.mapOn }; render(); } }, '✕ ', t('clear_filters')),
    list.slice(0, Q.n).map(projCard),
    list.length > Q.n && h('button', { class: 'btn', onclick: () => { Q.n += 60; render(); } }, '+ ', list.length - Q.n),
  ];
}
// Projects map: one bubble per area, sized by how many RERA projects are due there (filters above apply).
function initProjMap() {
  const L = window.L, Q = S.projQ, el = document.getElementById('pmap'); if (!el) return;
  const q = Q.q.trim().toLowerCase();
  const list = S.projects.filter((p) => (Q.year === 'all' || p.end_month.startsWith(Q.year)) && (Q.type === 'all' || p.ptype === Q.type) && (!q || [p.name, p.promoter, projArea(p), p.locality, p.taluka, p.end_month].join(' ').toLowerCase().includes(q)));
  const by = {}; for (const p of list) if (areaById(p.area_id)) (by[p.area_id] ||= []).push(p);
  S.pmap = L.map(el, { zoomControl: false }).setView([SURAT.lat, SURAT.lng], 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(S.pmap);
  for (const [id, ps] of Object.entries(by)) {
    const a = areaById(id), sel = (Q.areas || []).includes(id) || Q.area === id;
    const html = `<div class="pin${sel ? ' sel' : ''}"><span>${areaName(a, getLang())}</span><b>🏗 ${ps.length}</b></div>`;
    L.marker([a.lat, a.lng], { icon: L.divIcon({ className: 'pinwrap', html, iconSize: null }) }).on('click', () => { Q.area = id; Q.areas = null; Q.n = 40; render(); }).addTo(S.pmap);
  }
  const pinLayer = L.layerGroup().addTo(S.pmap), bubbleLayer = L.layerGroup();
  // area bubbles go in bubbleLayer; individual project pins appear from zoom 14
  S.pmap.eachLayer((l) => { if (l instanceof L.Marker) { S.pmap.removeLayer(l); bubbleLayer.addLayer(l); } });
  const esc = (x) => String(x || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const drawProj = () => {
    pinLayer.clearLayers();
    const z = S.pmap.getZoom(), b = S.pmap.getBounds();
    if (z < 14) { if (!S.pmap.hasLayer(bubbleLayer)) bubbleLayer.addTo(S.pmap); return; }
    S.pmap.removeLayer(bubbleLayer);
    for (const ps of Object.values(by)) ps.forEach((p, i) => {
      const pos = projPos(p, i); if (!pos || !b.contains([pos.lat, pos.lng])) return;
      const html = `<div class="pin small${pos.exact ? ' sel' : ' est'}"><span>🏗 ${esc(p.name).slice(0, 22)}</span><b>${fmtDate(p.end_month + '-01', { month: 'short', year: '2-digit' })}</b></div>`;
      L.marker([pos.lat, pos.lng], { icon: L.divIcon({ className: 'pinwrap', html, iconSize: null }) })
        .bindPopup(`<b>${esc(p.name)}</b><br>${esc(p.promoter)}<br>${t('possession')}: ${esc(p.end_month)}<br>${pos.exact ? '' : '<i>' + t('pin_approx') + '</i><br>'}<a href="${gmaps(pos.exact ? pos.lat : null, pos.lng, `${p.name}, ${(areaById(p.area_id) || {}).en || projArea(p)}, Surat, Gujarat`)}" target="_blank" rel="noopener">${t('google_maps')}</a>${p.phone ? ` · <a href="tel:+91${tel(p.phone)}">${t('call')}</a>` : ''}`)
        .addTo(pinLayer);
    });
  };
  S.pmap.on('zoomend moveend', drawProj); drawProj();
  const sel = Q.area && areaById(Q.area); if (sel) S.pmap.setView([sel.lat, sel.lng], 15);
}
function projectsHere(a) {
  if (!S.projects) return null;
  const n = S.projects.filter((p) => p.area_id === a.id).length;
  return n ? h('button', { class: 'btn', onclick: () => { S.propView = 'projects'; S.projQ = { year: 'all', type: 'all', q: '', area: a.id, n: 40 }; go('properties'); } }, `${t('projects')}: ${n}`) : null;
}

// ---------- newspaper "for sale" ads (leads) ----------
const LEADS_KEY = 'leads.own';
function viewLeads() {
  const all = [...cfg.get(LEADS_KEY, []), ...(S.leads || [])].sort((x, y) => String(y.date).localeCompare(String(x.date)));
  return [
    h('div', { class: 'small muted' }, t('leads_note')),
    h('button', { class: 'btn', onclick: bulkPaste }, '📋 ', t('bulk_paste')),
    h('button', { class: 'btn gold', onclick: () => voiceBox(t('add_lead'), (text) => { const p = parseEntry(text); const l = { id: 'l' + Date.now(), date: new Date().toISOString().slice(0, 10), text, phone: p.phone, area_id: p.area_id, ptype: p.ptype, name: p.name, source: t('src_own') }; cfg.set(LEADS_KEY, [l, ...cfg.get(LEADS_KEY, [])]); render(); }) }, icon('plus', 18), t('add_lead')),
    all.length ? all.map((l) => { const ph = tel(l.phone); return h('article', { class: 'card' },
      h('div', { class: 'tag' }, [l.source, l.date && fmtDate(l.date, { day: 'numeric', month: 'short' }), areaById(l.area_id) && areaName(areaById(l.area_id), getLang())].filter(Boolean).join(' · ')),
      h('div', { class: 'small' }, l.text),
      h('div', { class: 'grid3' },
        ph ? h('a', { class: 'btn green', href: 'tel:+91' + ph }, t('call')) : h('span', {}),
        h('button', { class: 'btn', onclick: () => inquiryForm({ name: l.name, phone: ph, area_id: l.area_id, ptype: l.ptype, deal: 'buy', notes: `${t('lead_seller')} · ${l.source || ''}: ${l.text}` }, render) }, t('to_inquiry')),
        reportBtn('lead', `${l.source || ''} ${l.date || ''}: ${String(l.text).slice(0, 80)}`))); })
      : h('div', { class: 'empty' }, t('no_leads')),
  ];
}

// ---------- lock screen ----------
function showLock() {
  return new Promise((done) => {
    const pin = h('input', { class: 'input pin', type: 'password', inputmode: 'numeric', maxlength: 4, 'aria-label': t('enter_pin'), autocomplete: 'off',
      oninput: async (e) => { if (e.target.value.length === 4) { if (await lock.checkPin(e.target.value)) finish(); else { e.target.value = ''; toast(t('wrong_pin'), true); } } } });
    const face = async () => { if (await lock.checkFace()) finish(); };
    const el = h('div', { class: 'lockscreen' }, mark(96, 5), h('div', { class: 'lock-name' }, 'AMI REALTORS'), h('div', { class: 'gold small' }, t('enter_pin')), pin,
      lock.hasFace && h('button', { class: 'btn gold', onclick: face }, t('unlock_faceid')));
    function finish() { el.remove(); done(); }
    document.body.append(el);
    if (lock.hasFace) face(); else setTimeout(() => pin.focus(), 100);
  });
}

// ---------- start ----------
let hiddenAt = 0, locked = false;
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (lock.hasPin && !locked && Date.now() - hiddenAt > 120000) { locked = true; await showLock(); locked = false; }
});
(async function start() {
  setLang(getLang());
  if (lock.hasPin) { locked = true; await showLock(); locked = false; }
  await cloud.init();
  await load();
  render();
  loadPlaces();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
