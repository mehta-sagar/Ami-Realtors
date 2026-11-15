import { t, getLang, setLang, money, moneyShort, fmtDate } from './i18n.js';
import { AREAS, SURAT, areaById, areaName, km, searchAreas, findAreaInText } from './areas.js';
import { UNITS, unitsFor, inBounds, PTYPES, sqftPer, toSqft, rateToSqft, rateFromSqft, defaultUnit, summarize, emi, DEFAULT_VIGHA_SQFT } from './units.js';
import { parseEntry } from './parse.js';
import { store, cloud, cfg, lock, DEFAULT_SB_URL, SB_PUBLIC_KEY, PRIVATE } from './store.js';
import { resolveMapsLink, coordsFromText, firstUrl, isMapsUrl, roadsAround, facilitiesAround } from './geo.js';
import { DEFAULT_INPUTS, adjustments, incomeValue, rentFromValue, residualLand, fsiFor, agriValue, reconcile as reconcileVals, CAP, VACANCY, OUTGO } from './valuation.js';

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
  chev: '<polyline points="9,5 16,12 9,19"/>', backarrow: '<polyline points="15,5 8,12 15,19"/>', share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M16 15h0M8 18h2M12 18h4"/>', link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>', wa: '<path d="M4 20l1.300-4A8 8 0 1 1 8 19z"/><path d="M9 9.500c.5 2 2 3.500 4 4.500l1.300-1.200 2 1-.5 1.700c-3.500.3-7.500-3.500-7.300-7l1.700-.5 1 2z"/>', down: '<polyline points="6,9 12,15 18,9"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
};
const icon = (name, size = 24) => h('span', { class: 'ic', 'aria-hidden': 'true', html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${SVG[name]}</svg>` });
const MARK = '<path stroke-linejoin="round" d="M78.6 24.3 A40 40 0 1 0 70 83.4 L70 49.2"/><path d="M26 56 L52 34 L78 56"/><path d="M34 49.2 V87.5"/><path d="M34 67 H70"/>';
const mark = (size, sw = 6) => h('span', { class: 'mark', role: 'img', 'aria-label': 'Ami Realtors', html: `<svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" stroke="#E3B341" stroke-width="${sw}">${MARK}</svg>` });

function toast(msg, bad) {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const el = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, msg);
  document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}
// In-app yes/no (the browser's own confirm box looks foreign and blocks the page).
function ask(msg, okLabel) {
  return new Promise((res) => {
    let done = false;
    const fin = (v) => { if (done) return; done = true; res(v); };
    const sh = openSheet(t('please_confirm'), () => [h('div', { class: 'small' }, msg),
      h('div', { class: 'grid2' }, h('button', { class: 'btn', onclick: () => { fin(false); sh.userClose(); } }, t('cancel')), h('button', { class: 'btn gold', onclick: () => { fin(true); sh.userClose(); } }, okLabel || t('yes')))],
    { onClose: () => fin(false) });
  });
}
function undoToast(msg, undo) {
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  const el = h('div', { class: 'toast undo', role: 'status' }, h('span', {}, msg), h('button', { onclick: async () => { el.remove(); try { await undo(); toast(t('restored')); } catch (e) { fail(e); } } }, t('undo')));
  document.body.append(el);
  setTimeout(() => el.remove(), 10000);
}
const fail = (e) => { console.error(e); toast(t('error') + ': ' + (e.message || e), true); };

// ---------- navigation: every sheet and sub-screen is a history entry, so the phone's back gesture,
// Android's back button and the on-screen ← all step back one level instead of leaving the app.
const NAV = [];
function navPush(undo) { const e = { undo, dead: false }; NAV.push(e); history.pushState({ ami: NAV.length }, ''); return e; }
function navBack() { history.back(); }
window.addEventListener('popstate', () => {
  const e = NAV.pop(); if (!e) return;
  if (e.dead) { if (NAV.length) history.back(); return; } // entry already closed in code: skip it
  e.undo();
});
const sheets = [];
function openSheet(title, build, opts = {}) {
  const body = h('div', { class: 'sheet-body' });
  const depth = sheets.length;
  const wrap = h('div', { class: 'sheet-wrap', onclick: (e) => { if (e.target === wrap) close(); } },
    h('div', { class: 'sheet' + (opts.full ? ' full' : ''), role: 'dialog', 'aria-label': title },
      h('div', { class: 'sheet-grip' }),
      h('div', { class: 'sheet-hd' },
        h('button', { class: 'iconbtn back', 'aria-label': t('back'), onclick: () => close() }, icon('backarrow')),
        h('h2', { class: 'grow' }, title),
        depth ? h('button', { class: 'iconbtn', 'aria-label': t('close'), onclick: () => closeAll() }, icon('x')) : null),
      body));
  let gone = false;
  function remove() { if (gone) return; gone = true; wrap.classList.add('out'); setTimeout(() => wrap.remove(), 180); const i = sheets.indexOf(api); if (i >= 0) sheets.splice(i, 1); if (opts.onClose) opts.onClose(); }
  // Closed by the user (✕, tap outside, back): go back one history step. Closed by code after a save: mark dead.
  function close() { if (gone) return; if (NAV[NAV.length - 1] === entry) navBack(); else { entry.dead = true; remove(); } }
  function closeCode() { if (gone) return; entry.dead = true; remove(); }
  function closeAll() { for (const s of sheets.slice().reverse()) s.close(); }
  const api = { close: closeCode, userClose: close, body, redraw: () => { const st = body.scrollTop; body.replaceChildren(...[].concat(build(api)).flat(9).filter(Boolean)); body.scrollTop = st; } };
  const entry = navPush(remove);
  sheets.push(api);
  api.redraw();
  document.body.append(wrap);
  return api;
}
// Sub-screens (area prices, project, ad, news article, trash...). Tabs are the roots.
function goSub(change) {
  const snap = { tab: S.tab, detail: S.detail, propView: S.propView, scroll: $('.screen') ? $('.screen').scrollTop : 0 };
  change();
  navPush(() => { Object.assign(S, { tab: snap.tab, detail: snap.detail, propView: snap.propView }); render(); const sc = $('.screen'); if (sc) sc.scrollTop = snap.scroll; });
  render();
  const sc = $('.screen'); if (sc) sc.scrollTop = 0;
}
const openDetail = (kind, data) => goSub(() => { S.detail = { kind, data }; });
const backHdr = (title, sub, extra) => h('header', { class: 'hdr sub' },
  h('button', { class: 'iconbtn back', 'aria-label': t('back'), onclick: navBack }, icon('backarrow')),
  h('div', { class: 'grow' }, h('h1', { class: 'sm' }, title), sub && h('div', { class: 'muted small' }, sub)), extra || null);

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
  const [news, market, prices, insights, tags, leads, pprices, refs] = await Promise.all([pub('news'), pub('market'), pub('prices'), pub('insights'), pub('tags'), pub('leads'), pub('project_prices'), pub('refs')]);
  S.refs = refs && !Array.isArray(refs) ? refs : {};
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
      h('div', { class: 'maprow' },
        h('button', { class: 'locbtn', 'aria-label': t('my_location'), onclick: myLocation }, icon('loc', 20), h('span', {}, t('my_location'))),
        h('button', { class: 'locbtn', 'aria-label': t('link_title'), onclick: linkSheet }, icon('link', 20), h('span', {}, t('link_short')))),
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
  const style = { color: '#4A3220', weight: 2.5, fillColor: '#C9A24A', fillOpacity: 0.12, interactive: false };
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
      S.places = j.elements.filter((e) => e.lat != null && e.tags && e.tags.name).map((e) => ({ en: e.tags['name:en'] || e.tags.name, gu: e.tags['name:gu'] || (/[઀-૿]/.test(e.tags.name) ? e.tags.name : ''), lat: e.lat, lng: e.lon, type: e.tags.place }))
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
      h('button', { class: 'btn gold', onclick: () => openDetail('value', { lat: sp.lat, lng: sp.lng, label: sp.label, ptype: pType, area: hint ? hint.id : null }) }, icon('calc', 18), t('valuation')),
      h('div', { class: 'grid3' }, h('a', { class: 'btn sm', href: gmaps(sp.lat, sp.lng), target: '_blank', rel: 'noopener' }, '🗺 Maps'), h('button', { class: 'btn sm', onclick: () => savePlace(sp) }, '＋ ', t('save_short')), h('button', { class: 'btn sm', 'aria-label': t('close'), onclick: () => { S.spotAt = null; if (S.spot) { S.spot.remove(); S.spot = null; } drawMapCard(); } }, '✕')),
      nProj ? h('button', { class: 'btn', onclick: () => goProjects({ areas: projNear }) }, `🏗 ${t('proj_near')}: ${nProj}`) : null,
      near && near.d <= 8 && h('button', { class: 'btn gold', onclick: () => openPrices(near.a.id, S.mapType) }, `${t('full_detail')}: ${areaName(near.a, getLang())}`)));
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
    S.projects && S.projects.some((p) => p.area_id === a.id) && h('button', { class: 'btn', onclick: () => goProjects({ area: a.id }) }, `🏗 ${t('proj_near')}: ${S.projects.filter((p) => p.area_id === a.id).length}`),
    h('button', { class: 'btn gold', onclick: () => openPrices(a.id, S.mapType) }, t('full_detail'))));
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
  if (coordsFromText(q) || isMapsUrl(firstUrl(q))) return priceFromLink(q);
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
function projPos(p) {
  // Only real locations: Dad's own pin. RERA gives no coordinates, so we never invent a spot for a project.
  const own = projPin(p); if (own) return { ...own, exact: true };
  return p.lat && p.lng ? { lat: p.lat, lng: p.lng, exact: true, rera: true } : null;
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
        const el = h('button', { type: 'button', class: 'thumb sm', 'aria-label': t('del'), onclick: async () => { if (await ask(t('confirm_del'))) { await store.removeFile(ref).catch(() => {}); f[key].splice(ix, 1); sh.redraw(); } } }, key === 'docs' ? 'DOC' : '');
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
    f.id && h('button', { class: 'btn danger', onclick: async () => { if (await ask(t('confirm_del'))) { await delRec('properties', f.id).catch(fail); sh.close(); render(); } } }, t('del')),
  ]);
}

// WhatsApp card, always in English.
const BRAND = { name: 'Ami Realtors', person: 'Dharmesh Mehta', phones: '78200 27373 / 97270 68111', phone1: '7820027373', tag_gu: 'સોદા નહીં, સંબંધોમાં પણ', motto_gu: 'તમે અમારું શુભ વિચારજો, અમે તમારો લાભ વિચારીશું.', line: 'PROPERTY · TRUST · VALUE' };
const bizPhone = () => cfg.get('bizPhone', '') || BRAND.phones;
const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
// Branded footer used on every shared image: logo tile, name, Dharmesh Mehta, both numbers, motto.
async function brandFooter(x, W, y, H) {
  x.fillStyle = '#4A3220'; x.fillRect(0, y, W, H);
  x.fillStyle = '#C9A24A'; x.fillRect(0, y, W, 6);
  try { const im = await loadImg('img/emblem.jpg'), s = H - 60; x.save(); x.beginPath(); x.roundRect(48, y + 30, s, s, 22); x.clip(); x.drawImage(im, 48, y + 30, s, s); x.restore(); } catch { /* offline */ }
  const tx = 48 + H - 60 + 32, f = (w, sz, fam) => { x.font = `${w} ${sz}px ${fam || 'Georgia, "Times New Roman", serif'}`; };
  x.textAlign = 'left'; x.fillStyle = '#E8C979'; f(700, 52); x.fillText('AMI REALTORS', tx, y + 92);
  x.fillStyle = '#F3ECE1'; f(600, 32, '-apple-system, Arial, sans-serif'); x.fillText(`${BRAND.person} · ${bizPhone()}`, tx, y + 144, W - tx - 40);
  x.fillStyle = '#D9C49A'; f(400, 28, '"Noto Sans Gujarati", "Gujarati Sangam MN", sans-serif'); x.fillText(BRAND.motto_gu, tx, y + 190, W - tx - 40);
}
async function shareCard(p) {
  const W = 1080, H = 1350, c = h('canvas', { width: W, height: H }), x = c.getContext('2d'), a = areaById(p.area_id);
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#EFE6D6'; x.fillRect(0, 0, W, 640);
  const blob = p.photos?.[0] && await store.fileBlob(p.photos[0]).catch(() => null);
  if (blob) { const b = await createImageBitmap(blob), k = Math.max(W / b.width, 640 / b.height), w = b.width * k, hh = b.height * k; x.save(); x.beginPath(); x.rect(0, 0, W, 640); x.clip(); x.drawImage(b, (W - w) / 2, (640 - hh) / 2, w, hh); x.restore(); }
  const font = (w, s) => { x.font = `${w} ${s}px -apple-system, "Helvetica Neue", Arial, sans-serif`; };
  x.textBaseline = 'alphabetic';
  x.fillStyle = '#7A5A12'; font(700, 34); x.fillText(`FOR ${p.deal === 'rent' ? 'RENT' : 'SALE'}${a ? ' · ' + a.en.toUpperCase() + ', ' + a.district.toUpperCase() : ''}`, 64, 730);
  x.fillStyle = '#4A3220'; font(700, 68); x.fillText(propTitle(p, 'en-card'), 64, 820, W - 128);
  const cells = [['Price', p.price ? 'Rs ' + (p.price >= 1e7 ? +(p.price / 1e7).toFixed(2) + ' Cr' : p.price >= 1e5 ? +(p.price / 1e5).toFixed(2) + ' L' : Number(p.price).toLocaleString('en-IN')) : 'On request'], ['Floor', p.floor || '-'], ['Furnishing', p.furnished === true ? 'Furnished' : p.furnished === false ? 'Unfurnished' : '-']];
  cells.forEach(([k, v], i) => { const cx = 64 + i * 324; x.fillStyle = '#F3ECE1'; x.beginPath(); x.roundRect(cx, 880, 304, 150, 24); x.fill(); x.fillStyle = '#6E5F50'; font(400, 30); x.fillText(k, cx + 24, 932); x.fillStyle = '#2B1F15'; font(700, 42); x.fillText(v, cx + 24, 992, 256); });
  await brandFooter(x, W, 1110, 240);
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
    f.id && h('button', { class: 'btn danger', onclick: async () => { if (await ask(t('confirm_del'))) { await delRec('deals', f.id).catch(fail); sh.close(); after(); } } }, t('del'))]);
}
function settings() {
  const f = { vigha: vigha(), bizPhone: cfg.get('bizPhone', ''), pin: '' };
  const sh = openSheet(t('settings'), (api) => {
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
      h('h3', {}, t('cloud')),
      h('div', { class: 'small goldtext b' }, `${cloud.live ? '🟢 ' + t('live_on') : '🟡 ' + t('live_off')} · ${cloud.email}`),
      cloud.team && !cloud.team.missing && h('div', { class: 'small' }, `${cloud.team.team_name} · ${t('role_' + cloud.team.role)}`),
      h('button', { class: 'btn green', onclick: async () => { try { const n = await store.uploadLocal(); await load(); render(); toast(`${t('done')} (${n})`); } catch (e) { fail(e); } } }, t('upload_local')),
      h('button', { class: 'btn', onclick: async () => { if (await ask(t('sign_out') + '?')) { await cloud.signOut(); location.reload(); } } }, t('sign_out')),
    ];
  });
}

// ---------- shell ----------
function render() {
  if (S.map && (S.tab !== 'map' || S.detail)) { S.map.remove(); S.map = null; }
  if (S.dmap) { S.dmap.remove(); S.dmap = null; }
  if (S.pmap) { S.pmap.remove(); S.pmap = null; }
  const view = S.detail ? viewDetail() : { today: viewToday, map: viewMap, prices: viewPrices, customers: viewCustomers, properties: viewProps, more: viewMore }[S.tab]();
  $('#app').replaceChildren(h('main', { class: 'screen ' + (S.detail ? 'detail' : S.tab) }, view), tabbar());
  if (S.tab === 'map' && !S.detail) initMap();
  if (S.detail && S.detail.after) S.detail.after();
  if (!S.detail && S.tab === 'properties' && S.propView === 'projects' && S.projQ && S.projQ.mapOn && S.projects && S.projects.length) initProjMap();
}
function tabbar() {
  const cur = S.tab === 'prices' ? 'map' : S.tab;
  return h('nav', { class: 'tabbar', 'aria-label': 'Tabs' }, ['today', 'map', 'customers', 'properties', 'more'].map((k) =>
    h('button', { class: k === cur ? 'on' : '', 'aria-current': k === cur ? 'page' : null, onclick: () => go(k) }, icon(k), h('span', {}, t(k)))));
}
// Tab bar = the roots: closes every sheet and sub-screen.
function go(tab) {
  for (const sh of sheets.slice().reverse()) sh.close();
  for (const e of NAV) e.dead = true;
  if (S.tab === tab && !S.detail) { const sc = $('.screen'); if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  S.tab = tab; S.detail = null; render();
}
function openPrices(areaId, ptype) {
  goSub(() => { S.spotAt = null; S.price.area = areaId; if (ptype) S.price.ptype = ptype; S.price.unit = null; S.price.grade = 'all'; S.tab = 'prices'; S.detail = null; });
}
function goProjects(q) {
  goSub(() => { S.tab = 'properties'; S.propView = 'projects'; S.projOnly = null; S.projQ = { year: 'all', type: 'all', q: '', area: null, n: 40, ...q }; S.detail = null; });
}

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
  const fu = S.data.inquiries.filter((i) => !isGone(i) && !['closed', 'lost'].includes(i.status) && i.followup_at && new Date(i.followup_at) <= end)
    .map((i) => ({ at: i.followup_at, title: `${t('followup')}: ${inqName(i)}`, sub: inqLine(i), inq: i }));
 const tk = S.data.tasks.filter((x) => !isGone(x) && !x.done && (!x.due_at || new Date(x.due_at) <= end)).map((x) => ({ at: x.due_at, title: x.title, sub: custOf(x.customer_id) ? custLabel(custOf(x.customer_id)) : '', task: x }));
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
    h('header', { class: 'hdr' }, h('div', { class: 'logo' }, h('img', { src: 'img/emblem.jpg', alt: 'Ami Realtors' })),
      h('div', { class: 'grow' }, h('h1', {}, t('greeting')), h('div', { class: 'brandline' }, 'Ami Realtors – ', BRAND.tag_gu), h('div', { class: 'muted small' }, fmtDate(now))),
      h('button', { class: 'iconbtn', 'aria-label': t('settings'), onclick: settings }, icon('gear'))),
    m && h('div', { class: 'grid4' }, [['gold', m.gold_10g, moneyShort], ['silver', m.silver_kg, moneyShort], ['sensex', m.sensex, (x) => Number(x).toLocaleString('en-IN')], ['home_loan', m.home_loan_rate, (x) => x + '%']]
      .map(([k, v, f]) => h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t(k)), h('div', { class: 'b' }, v == null ? '—' : f(v))))),
    h('button', { class: 'hero linkhero', onclick: linkSheet }, h('span', { class: 'hero-ic' }, '📍'), h('div', { class: 'grow' }, h('div', { class: 'hero-t' }, t('link_title')), h('div', { class: 'xs' }, t('link_sub'))), icon('chev', 18)),
    !pushOn() && h('button', { class: 'btn gold', onclick: async () => { await enablePush(); render(); } }, '🔔 ', t('push_enable')),
    h('section', { class: 'card' },
      h('div', { class: 'between' }, h('h2', {}, t('todo_today')), h('button', { class: 'linkbtn', onclick: () => taskForm({}, render) }, '+ ', t('task'))),
      due.length ? due.map((d) => dueRow(d, render)) : h('div', { class: 'muted small' }, t('no_followups'))),
    h('div', { class: 'rowhd' }, h('h2', {}, t('news'))),
    chips(cats.map((c) => [c, c === 'all' ? t('all') : t('cat_' + c)]), S.newsCat, (c) => { S.newsCat = c; render(); }, 'scroll'),
    news.length ? news.map((n) => h('article', { class: 'card tap', onclick: (e) => { if (!e.target.closest('a,button')) openDetail('news', n); } },
      h('div', { class: 'tag' }, t('cat_' + n.category), ' · ', fmtDate(n.published_on, { day: 'numeric', month: 'short' })),
      h('div', { class: 'title' }, (en ? n.title_en || n.title_gu : n.title_gu || n.title_en) || ''),
      (en ? n.summary_en || n.summary_gu : n.summary_gu || n.summary_en) && h('div', { class: 'small clamp3' }, en ? n.summary_en || n.summary_gu : n.summary_gu || n.summary_en),
      h('div', { class: 'between small muted' }, h('span', {}, n.source || ''), h('span', { class: 'goldtext b' }, t('read_full'), ' ›'))))
      : h('div', { class: 'empty' }, t('no_news')),
  ];
}

function viewCustomers() {
  const q = { v: '' };
  const start = (text) => { const p = parseEntry(text || ''); inquiryForm({ phone: p.phone || tel(text), name: p.name, area_id: p.area_id, ptype: p.ptype, deal: p.deal === 'rent' ? 'rent' : 'buy', budget: p.price, notes: (text || '').replace(/[\d\s+()-]/g, '').length > 3 ? text : '' }, render); };
  const body = h('div', { class: 'stack' });
  const drawList = () => {
    const s = (S.crmQ || '').trim().toLowerCase();
 const rows = S.data.customers.filter((c) => !isGone(c) && (!s || (c.name || '').toLowerCase().includes(s) || (c.phone || '').includes(s))).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    body.replaceChildren(...(rows.length ? rows.map((c) => {
      const open = S.data.inquiries.filter((i) => i.customer_id === c.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      return h('button', { class: 'card rowcard white', onclick: () => customerSheet(c) },
        h('div', { class: 'between' }, h('span', { class: 'title' }, custLabel(c)), open && h('span', { class: 'badge st-' + (open.status || 'new') }, t('st_' + (open.status || 'new')))),
        h('div', { class: 'small muted' }, [c.name && c.phone && '+91 ' + c.phone, open && inqLine(open)].filter(Boolean).join(' · ')));
    }) : [h('div', { class: 'empty' }, t('no_inq'))]));
  };
  const board = () => h('div', { class: 'board' }, ST.map((s) => {
    const items = S.data.inquiries.filter((i) => !isGone(i) && (i.status || 'new') === s).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    return h('section', { class: 'kcol' }, h('div', { class: 'between' }, h('span', { class: 'b' }, t('st_' + s)), h('span', { class: 'muted small' }, items.length)),
      items.map((i) => h('div', { class: 'card kcard' },
        h('button', { class: 'duetext', onclick: () => { const c = custOf(i.customer_id); if (c) customerSheet(c); } }, h('div', { class: 'b' }, inqName(i)), h('div', { class: 'xs muted' }, inqLine(i))),
        h('select', { class: 'badge st-' + s, 'aria-label': t('status'), value: s, onchange: async (e) => { await saveRec('inquiries', { ...i, status: e.target.value }).catch(fail); render(); } }, ST.map((x) => h('option', { value: x }, t('st_' + x)))))));
  }));
  if (S.crmView !== 'pipeline') drawList();
  return [
    h('header', { class: 'hdr' }, h('h1', { class: 'grow' }, t('customers')), h('span', { class: 'muted small' }, S.data.customers.filter((c) => !isGone(c)).length || '')),
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
    const inqs = S.data.inquiries.filter((i) => !isGone(i) && i.customer_id === c.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
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
    cloud.ready && cloud.isOwner && (S.members || []).length > 1 && field(t('assigned_to'), h('select', { class: 'input', value: f.assigned_to || '', onchange: (e) => { f.assigned_to = e.target.value || null; } },
      h('option', { value: '' }, '—'), S.members.map((m) => h('option', { value: m.user_id }, m.name || m.email)))),
    field(t('notes'), h('textarea', { class: 'input area', rows: 3, value: f.notes || '', oninput: (e) => { f.notes = e.target.value; } })),
    h('button', { class: 'btn gold', onclick: async () => { try { await saveRec('customers', { id: f.id, created_at: f.created_at, name: f.name || null, phone: tel(f.phone) || null, alt_phone: tel(f.alt_phone) || null, notes: f.notes || null, ...(f.assigned_to !== undefined ? { assigned_to: f.assigned_to || null } : {}) }); sh.close(); after(false); } catch (e) { fail(e); } } }, t('save')),
    f.id && canDelete() && h('button', { class: 'btn danger', onclick: async () => { if (!await ask(t('confirm_trash'))) return; try { const c = custOf(f.id) || f; await trashCustomer(c); sh.close(); after(true); undoToast(t('moved_trash'), async () => { await restoreCustomer(custOf(f.id) || c); render(); }); } catch (e) { fail(e); } } }, icon('trash', 18), t('to_trash')),
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
        if (row.followup_at && row.followup_at !== had && await ask(t('add_cal') + '?')) ics(row);
      } catch (e) { fail(e); }
    } }, t('save')),
    f.id && h('button', { class: 'btn danger', onclick: async () => { if (await ask(t('confirm_del'))) { await delRec('inquiries', f.id).catch(fail); sh.close(); (after || render)(); } } }, t('del')),
  ]);
}
// Ready WhatsApp messages. {name} is replaced with the customer's name.
function waTemplates(c, log) {
  const en = getLang() === 'en', nm = c.name || '';
  const built = en ? [
    ['Introduction', 'Namaste {name}, this is Dharmesh Mehta from Ami Realtors, Chowk Bazaar, Surat (78200 27373). Thank you for your inquiry. Please tell me your preferred area and budget and I will share suitable options.'],
    ['Property details', 'Namaste {name}, as discussed I am sending the property details. Please have a look and tell me a convenient time for a site visit.'],
    ['Visit confirmation', 'Namaste {name}, confirming our site visit. Please share a time that suits you. - Dharmesh Mehta, Ami Realtors (78200 27373)'],
    ['Follow-up', 'Namaste {name}, did you get a chance to think about the property we discussed? Happy to answer any question. - Dharmesh Mehta, Ami Realtors (78200 27373)'],
    ['Festival greeting', 'Namaste {name}, warm festival wishes to you and your family from Dharmesh Mehta, Ami Realtors. તમે અમારું શુભ વિચારજો, અમે તમારો લાભ વિચારીશું.'],
  ] : [
    ['ઓળખાણ', 'નમસ્તે {name}, અમી રિયલ્ટર્સ, ચોક બજાર, સુરતથી. તમારી ઇન્ક્વાયરી બદલ આભાર. તમને કયો વિસ્તાર અને કેટલું બજેટ અનુકૂળ છે તે જણાવશો તો યોગ્ય મિલકત બતાવીશ. – ધર્મેશ મહેતા, અમી રિયલ્ટર્સ (78200 27373)'],
    ['મિલકતની વિગત', 'નમસ્તે {name}, આપણી વાત મુજબ મિલકતની વિગત મોકલું છું. જોઈને સાઇટ વિઝિટ માટે અનુકૂળ સમય જણાવશો.'],
    ['વિઝિટ કન્ફર્મ', 'નમસ્તે {name}, આપણી સાઇટ વિઝિટ કન્ફર્મ કરવા માટે મેસેજ કરું છું. તમને અનુકૂળ સમય જણાવશો. - અમી રિયલ્ટર્સ – ધર્મેશ મહેતા, અમી રિયલ્ટર્સ (78200 27373)'],
    ['ફોલો-અપ', 'નમસ્તે {name}, આપણે જોયેલી મિલકત વિશે વિચાર્યું? કોઈ પ્રશ્ન હોય તો જણાવશો. - અમી રિયલ્ટર્સ – ધર્મેશ મહેતા, અમી રિયલ્ટર્સ (78200 27373)'],
    ['તહેવારની શુભેચ્છા', 'નમસ્તે {name}, અમી રિયલ્ટર્સ તરફથી તમને અને તમારા પરિવારને તહેવારની હાર્દિક શુભેચ્છા. – ધર્મેશ મહેતા, અમી રિયલ્ટર્સ (78200 27373)'],
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
    f.id && h('button', { class: 'btn danger', onclick: async () => { if (await ask(t('confirm_del'))) { await delRec('brokers', f.id).catch(fail); sh.close(); after(null); } } }, t('del')),
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
const withBuilding = (p) => /shed|building|factory|godown|rcc|construction/i.test(String(p.note || ''));
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
  const fresh = all.filter((p) => String(p.observed_on) >= cut), bld = ptype === 'industrial' ? fresh.filter(withBuilding) : [];
  const pts = fresh.filter((p) => !bld.includes(p));
  return { ...summarize(pts), points: pts, bld, old: all.filter((p) => String(p.observed_on) < cut), bad: every.filter((p) => !inBounds(p)) };
}
// ---------- fact check: reconcile every market price against independent anchors ----------
// Anchors: other sources for the same area, the government jantri, the GIDC allotment rate (industrial),
// and the model price built only from OTHER areas. A price is "verified" only when they agree.
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
function reconcile(a, ptype, mk, j, gd) {
  const C = [], add = (lvl, k, ...v) => C.push([lvl, t(k) + (v.length ? ' ' + v.join(' ') : '')]);
  const m = mk.median; if (m == null) return null;
  const pts = mk.points, srcs = new Set(pts.map((p) => host(p.source_url) || p.broker_id || p.source));
  const agree = pts.filter((p) => Math.abs(p.price_sqft / m - 1) <= 0.25).length;
  if (srcs.size >= 2 && agree >= 2) add('ok', 'fc_sources_ok', srcs.size);
  else if (srcs.size === 1) add('warn', 'fc_single', `(${[...srcs][0]})`);
  else add('bad', 'fc_sources_split', `${Math.round(mk.min)}–${Math.round(mk.max)}`);
  if (pts.every((p) => p.source === 'listing')) add('warn', 'fc_asking');
  if (mk.bld && mk.bld.length) add('warn', 'fc_building', mk.bld.length);
  if (j.median) {
    const r = m / j.median, max = ptype === 'land' ? 8 : ptype === 'industrial' ? 6 : 4;
    add(r < 0.9 ? 'bad' : r > max ? 'bad' : 'ok', r < 0.9 ? 'fc_below_jantri' : r > max ? 'fc_far_jantri' : 'fc_jantri_ok', `× ${r.toFixed(1)}`);
  }
  if (gd.median) {
    const r = m / gd.median;
    add(r < 1 ? 'bad' : r > 6 ? 'warn' : 'ok', r < 1 ? 'fc_below_gidc' : r > 6 ? 'fc_far_gidc' : 'fc_gidc_ok', `× ${r.toFixed(1)}`);
  }
  const model = knn(a.lat, a.lng, ptype, a.id);
  if (model && model.value) {
    const r = m / model.value, lo = model.conf === 'mid' ? 0.67 : 0.5, hi = 1 / lo;
    add(r < lo || r > hi ? 'warn' : 'ok', r < lo || r > hi ? 'fc_model_off' : 'fc_model_ok', `${r >= 1 ? '+' : ''}${Math.round((r - 1) * 100)}%`);
  }
  const age = Math.max(...pts.map((p) => (Date.now() - new Date(p.observed_on)) / 864e5));
  if (age > 120) add('warn', 'fc_old', Math.round(age));
  const bad = C.filter((c) => c[0] === 'bad').length, warn = C.filter((c) => c[0] === 'warn').length;
  const grade = bad ? 'conflict' : srcs.size >= 2 && agree >= 2 && warn <= 1 ? 'verified' : 'check';
  return { grade, checks: C };
}
const FC_ICON = { verified: '✅', check: '🟡', conflict: '🔴' };
function factCheckCard(rc) {
  if (!rc) return null;
  return h('section', { class: 'card' }, h('h2', {}, '🔎 ', t('fc_title'), ': ', FC_ICON[rc.grade], ' ', t('fc_' + rc.grade)),
    rc.checks.map(([lvl, txt]) => h('div', { class: 'small' }, (lvl === 'ok' ? '✓ ' : lvl === 'warn' ? '⚠ ' : '✗ ') + txt)),
    h('div', { class: 'xs muted' }, t('fc_note')));
}
function viewPrices() {
  const P = S.price, a = areaById(P.area) || AREAS[0], unit = unitsFor(P.ptype).includes(P.unit) ? P.unit : defaultUnit(P.ptype), rd = () => render();
  const j = stats(a.id, P.ptype, 'jantri'), d = stats(a.id, P.ptype, 'dastavej'), mk = stats(a.id, P.ptype, 'market', P.furnished, P.grade), gd = stats(a.id, P.ptype, 'gidc');
  const estP = mk.median == null ? knn(a.lat, a.lng, P.ptype, a.id) : null;
  const rc = reconcile(a, P.ptype, mk, j, gd);
  const quotes = [...mk.points, ...d.points, ...j.points, ...gd.points].sort((x, y) => String(y.observed_on).localeCompare(String(x.observed_on)));
  const last = quotes.map((p) => p.observed_on).sort().pop();
  const bare = (v) => rate(v, unit).replace('₹ ', '');
  const head = { range: mk.used > 1 && mk.min !== mk.max ? `₹ ${bare(mk.min)} – ${bare(mk.max)}` : rate(mk.median, unit), median: rate(mk.median, unit), mean: rate(mk.mean, unit), low: rate(mk.min, unit), high: rate(mk.max, unit) }[P.stat];
  const line = (label, sub, val, strong) => h('div', { class: 'rate' + (strong ? ' strong' : '') }, h('div', {}, h('div', { class: 'b' }, label), sub && h('div', { class: 'xs ' + (strong ? 'goldtext b' : 'muted') }, sub)), h('div', { class: 'num' }, val));
  const quote = (p, old) => {
    const out = p.kind === 'market' && !old && (p.price_sqft < mk.lo || p.price_sqft > mk.hi);
    return h('div', { class: 'pt' + (out || old ? ' out' : '') },
      h('div', { class: 'between small' }, h('span', { class: 'b' }, rate(p.price_sqft, unit), p.kind !== 'market' ? ` · ${t(p.kind)}` : '', out ? ` (${t('outlier')})` : '', old === 'bad' ? ` (${t('check_quote')})` : old === 'bld' ? ` (${t('fc_bld_tag')})` : old ? ` (${t('old_quote')})` : ''),
        h('span', {}, p.grade && h('span', { class: 'gbadge g-' + p.grade }, t('g_' + p.grade)), ' ', h('span', { class: 'muted' }, fmtDate(p.observed_on, { day: 'numeric', month: 'short', year: '2-digit' })))),
      h('div', { class: 'between xs muted' }, h('span', {}, t('src_' + (p.source || 'other')), p.broker_id && brokerOf(p.broker_id) ? ' · ' + brokerOf(p.broker_id).name : '', p.note ? ' · ' + p.note : ''),
        h('span', {}, p.source_url && h('a', { href: p.source_url, target: '_blank', rel: 'noopener' }, t('link')), ' ', reportBtn('price', `${a.en} · ${p.ptype} · ${p.kind} · ₹${Math.round(p.price_sqft)}/sqft · ${p.observed_on} · ${p.source_url || p.note || ''}`), ' ', !p.pub && (p.owner || !cloud.ready) && h('button', { class: 'linkbtn xs', onclick: async () => { if (await ask(t('confirm_del'))) { await delRec('price_points', p.id).catch(fail); rd(); } } }, t('del')))));
  };
  return [
    h('header', { class: 'hdr' },
      h('button', { class: 'iconbtn back', 'aria-label': t('back'), onclick: navBack }, icon('backarrow')),
      h('button', { class: 'grow areahd', onclick: () => pickArea((x) => { P.area = x.id; rd(); }) }, h('h1', {}, areaName(a, getLang()), icon('down', 20)),
        h('div', { class: 'muted small' }, `${a.district} · ${getLang() === 'en' ? Math.round(km(SURAT.lat, SURAT.lng, a.lat, a.lng)) + ' km from Surat' : 'સુરતથી ' + Math.round(km(SURAT.lat, SURAT.lng, a.lat, a.lng)) + ' કિમી'}${last ? ' · ' + t('updated') + ' ' + fmtDate(last, { day: 'numeric', month: 'short' }) : ''}`)),
      h('select', { class: 'input sel', 'aria-label': t('type'), value: P.ptype, onchange: (e) => { P.ptype = e.target.value; P.unit = null; rd(); } }, PTYPES.map((p) => h('option', { value: p }, t(p))))),
    h('div', { class: 'grid5', style: `grid-template-columns: repeat(${unitsFor(P.ptype).length}, minmax(0, 1fr))` }, unitsFor(P.ptype).map((u) => h('button', { class: 'chip sq' + (u === unit ? ' on' : ''), 'aria-pressed': String(u === unit), onclick: () => { P.unit = u; rd(); } }, unitLabel(u)))),
    seg([[false, t('unfurnished')], [true, t('furnished')]], P.furnished, (v) => { P.furnished = v; rd(); }),
    chips([['all', t('all')], ...GRADES.map((g) => [g, t('g_' + g)])], P.grade, (v) => { P.grade = v; rd(); }, 'scroll'),
    h('section', { class: 'card rates' },
      line(t('market_rate'), mk.median == null ? (estP ? `${t('nearby_estimate')}: ${knnLine(estP, unit)}` : t('no_price')) : [P.stat === 'range' && `${t('median')} ${rate(mk.median, unit)}`, pct(mk.median, j.median) && `${t('vs_jantri')} ${pct(mk.median, j.median)}`, `${mk.used} ${t('prices_found')}`, rc && `${FC_ICON[rc.grade]} ${t('fc_' + rc.grade)}`, mk.dropped ? `${mk.dropped} ${t('dropped')}` : null].filter(Boolean).join(' · '), mk.median == null ? (estP ? '≈ ' + rate(estP.value, unit) : '—') : head, true),
      h('div', { class: 'statseg' }, seg([['range', t('range')], ['median', t('median')], ['mean', t('mean')], ['low', t('low')], ['high', t('high')]], P.stat, (v) => { P.stat = v; rd(); })),
      line(t('dastavej'), pct(d.median, j.median) && `${t('vs_jantri')} ${pct(d.median, j.median)}`, rate(d.median, unit)),
      line(t('jantri'), [t('jantri_sub') + ' · ' + t('src_garvi'), j.used > 1 && `${t('median')} ${rate(j.median, unit)} · ${j.used} TP/FP`].filter(Boolean).join(' · '), j.used > 1 && j.min !== j.max ? `₹ ${bare(j.min)} – ${bare(j.max)}` : rate(j.median, unit)),
      gd.median != null && line(t('gidc'), t('gidc_sub') + ' · 2026-27', rate(gd.median, unit))),
    factCheckCard(rc),
    a.ind ? h('div', { class: 'xs goldtext b' }, '🏭 ', t('ind_estate'), ' — ', t('ind_only')) : null,
    h('div', { class: 'grid2' },
      h('button', { class: 'btn green', onclick: () => pricePointForm({ area_id: a.id, ptype: P.ptype, unit }) }, icon('plus', 18), t('add_price')),
      h('button', { class: 'btn', onclick: () => pasteMessage(a.id, P.ptype) }, t('paste_msg'))),
    h('button', { class: 'btn', onclick: bulkPaste }, '📋 ', t('bulk_paste')),
    h('section', { class: 'card' }, h('h2', {}, t('all_quotes'), ' (', quotes.length + mk.old.length + (mk.bad || []).length, ')'),
      h('div', { class: 'xs muted' }, t('quotes_note')),
      quotes.length + mk.old.length + (mk.bad || []).length ? h('div', { class: 'list tight' }, quotes.map((p) => quote(p)), mk.old.map((p) => quote(p, true)), (mk.bad || []).map((p) => quote(p, 'bad')), (mk.bld || []).map((p) => quote(p, 'bld'))) : h('div', { class: 'muted small' }, t('no_price'))),
    insightCard(a, mk, unit),
    factsCard(a, mk, j),
    projectsHere(a),
    h('button', { class: 'btn gold', onclick: () => openDetail('value', { lat: a.lat, lng: a.lng, label: areaName(a, getLang()), ptype: P.ptype, area: a.id }) }, icon('calc', 18), t('valuation')),
    h('section', { class: 'card' }, h('h2', {}, t('nearby')), nearbyBlock(a.lat, a.lng)),
    h('section', { class: 'card' }, h('h2', {}, t('land_records')), areaLinks(a)),
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
      h('span', {}, p.url && h('a', { href: p.url, target: '_blank', rel: 'noopener' }, t('link')), !p.own && ' ', !p.own && reportBtn('insight', `${a.en} · ${p.kind} · ${p.en} · ${p.url || ''}`), p.own && h('button', { class: 'linkbtn xs', onclick: async () => { if (await ask(t('confirm_del'))) { await delRec('area_notes', p.own.id).catch(fail); render(); } } }, t('del')))))) : h('div', { class: 'muted small' }, '—'); };
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
  x.fillStyle = '#F3ECE1'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#4A3220'; x.fillRect(0, 0, W, 300);
  x.fillStyle = '#C9A24A'; font(700, 34); x.fillText('AREA SNAPSHOT · ' + a.district.toUpperCase(), 64, 110);
  x.fillStyle = '#FFFFFF'; font(700, 84); x.fillText(a.en, 64, 210, W - 128);
  const U = { sqft: 'sq ft', sqm: 'sq m', var: 'sq yd', vigha: 'vigha', acre: 'acre', hectare: 'hectare' }[unit], r = (v) => Math.round(rateFromSqft(v, unit, vigha())).toLocaleString('en-IN');
  x.fillStyle = '#2B1F15'; font(700, 54);
  x.fillText(mk.median == null ? 'Price on request' : (mk.used > 1 && mk.min !== mk.max ? `Rs ${r(mk.min)} - ${r(mk.max)} per ${U}` : `Rs ${r(mk.median)} per ${U}`), 64, 400, W - 128);
  x.fillStyle = '#6E5F50'; font(400, 32); x.fillText(`${EN[S.price.ptype] || ''}${mk.median != null && mk.used > 1 ? ' · median Rs ' + r(mk.median) + ' · ' + mk.used + ' recent quotes' : ''}`, 64, 452, W - 128);
  let y = 540; const pts = areaPoints(a);
  for (const [kind, label, col] of [['pro', 'Advantages', '#4A3220'], ['con', 'Points to check', '#7A5A12']]) {
    const xs = pts.filter((p) => p.kind === kind).slice(0, 4); if (!xs.length) continue;
    x.fillStyle = col; font(700, 40); x.fillText(label, 64, y); y += 56;
    x.fillStyle = '#2B1F15'; font(400, 34);
    for (const p of xs) { x.fillText('•', 64, y); y += wrap(p.en, 100, y, W - 170, 46, 3) * 46 + 14; }
    y += 24;
  }
  await brandFooter(x, W, 1110, 240);
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

// ---------- visiting card ----------
async function shareBizCard() {
  try {
    const b = await fetch('img/card.jpg').then((r) => r.blob()), file = new File([b], 'ami-realtors-dharmesh-mehta.jpg', { type: 'image/jpeg' });
    const text = `Ami Realtors – ${BRAND.tag_gu}\n${BRAND.person} · ${BRAND.phones}\nChowk Bazaar, Surat`;
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text }).catch(() => {});
    else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  } catch (e) { fail(e); }
}
// ---------- More ----------
function viewMore() {
  const row = (k, fn) => h('button', { class: 'row big', onclick: fn }, h('span', {}, t(k)), icon('chev', 18));
  return [h('header', { class: 'hdr' }, h('h1', { class: 'grow' }, t('more'))),
    h('section', { class: 'card bizcard' }, h('img', { src: 'img/card.jpg', alt: 'Ami Realtors – Dharmesh Mehta' }),
      h('div', { class: 'grid2' }, h('button', { class: 'btn gold', onclick: shareBizCard }, '📤 ', t('share_bizcard')), h('a', { class: 'btn green', href: 'tel:+91' + BRAND.phone1 }, t('call'), ' ', BRAND.phones.split(' / ')[0]))),
    h('section', { class: 'card' }, row('prices', () => openPrices(S.price.area, S.price.ptype)), row('bulk_paste', bulkPaste), row('brokers', () => brokersSheet()), row('commission', commission)),
    h('section', { class: 'card' }, row('emi_calc', emiCalc), row('stamp_calc', stampCalc), row('cg_calc', cgCalc)),
    h('section', { class: 'card' }, row('link_title', linkSheet), row('sources_title', () => openDetail('sources')), row('trash', () => openDetail('trash'))),
    h('section', { class: 'card' }, cloud.ready && row('team', () => openDetail('team')), row('reports', reportsSheet), row('settings', settings), cloud.ready && row('sign_out', async () => { if (await ask(t('sign_out') + '?')) { await cloud.signOut(); location.reload(); } }))];
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
const PROJ_KEY = 'projects.v2';
async function loadProjects(force) {
  const c = cfg.get(PROJ_KEY, null);
  if (!force && c && Date.now() - c.at < 864e5) { S.projects = c.rows; return; }
  const base = (cfg.get('sbUrl') || DEFAULT_SB_URL) + '/rest/v1/projects?select=rera,name,promoter,ptype,area_id,locality,taluka,district,end_month,phone,price_from,price_to,price_note,price_url,lat,lng,address&end_month=gte.2025-01&end_month=lte.2030-12&order=end_month';
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
  // RERA coordinates are the truth: put each located project in the area it actually sits in (e.g. "Adajan taluka" can be Kosad).
  for (const p of S.projects) if (p.lat && p.lng) {
    const n = AREAS.filter((a) => !a.ind && !String(a.id).startsWith('v-')).map((a) => ({ a, d: km(p.lat, p.lng, a.lat, a.lng) })).sort((x, y) => x.d - y.d)[0];
    if (n && n.d <= 3) p.area_id = n.a.id;
  }
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
// Quoted price (builder / portal) or, if none, the expected launch range from the model.
function projPrice(p) {
  const PP = S.projPrices || {}, pp = PP[p.rera] || PP['name:' + String(p.name).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()] || {};
  const from = p.price_from || pp.from, to = p.price_to || pp.to, rsq = pp.rate_sqft;
  if (rsq && !from) return { kind: 'quoted', text: `${rate(rsq, 'sqft')} / ${unitLabel('sqft')}`, note: pp.note, url: pp.url };
  if (from) return { kind: 'quoted', text: `${moneyShort(from)}${to && to !== from ? ' – ' + moneyShort(to) : ''}`, note: pp.note || p.price_note, url: pp.url || p.price_url };
  const e = expectedRate(p); if (!e) return null;
  const u = defaultUnit(e.pt);
  return { kind: 'expected', e, text: `₹ ${Math.round(rateFromSqft(e.lo, u, vigha())).toLocaleString('en-IN')} – ${Math.round(rateFromSqft(e.hi, u, vigha())).toLocaleString('en-IN')} / ${unitLabel(u)}`, note: `${e.own ? t('area_rate') : t('model_price')} ${rate(e.base, u)} + ${t('new_premium')} ${e.prem}%` };
}
const reraNo = (p) => (String(p.rera).match(/[RCMP]AA\d+/) || [p.rera])[0];
function projCard(p) {
  const ph = tel(p.phone), pr = projPrice(p), Q = S.projQ || {};
  const selOn = !!S.bsel;
  const pick = selOn && h('input', { type: 'checkbox', class: 'pick-cb', checked: S.bsel.has(p.rera), 'aria-label': t('select'), onclick: (e) => e.stopPropagation(), onchange: (e) => { if (e.target.checked) S.bsel.add(p.rera); else S.bsel.delete(p.rera); updSelBar(); } });
  return h('article', { class: 'card tap' + (selOn && S.bsel.has(p.rera) ? ' picked' : ''), onclick: (e) => { if (e.target.closest('a,button,input')) return; if (selOn) { const cb = e.currentTarget.querySelector('.pick-cb'); cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); e.currentTarget.classList.toggle('picked', cb.checked); return; } openDetail('project', p); } },
    h('div', { class: 'between top' },
      h('div', { class: 'grow' },
        h('div', { class: 'tag' }, [t('p_' + (p.ptype || 'residential')), projArea(p)].filter(Boolean).join(' · ')),
        h('div', { class: 'title' }, p.name),
        h('div', { class: 'small muted' }, p.promoter)),
      pick || icon('chev', 18)),
    h('div', { class: 'between small' },
      h('span', {}, pr ? h('span', { class: 'b' + (pr.kind === 'expected' ? ' goldtext' : '') }, (pr.kind === 'expected' ? t('expected') + ': ' : '') + pr.text) : h('span', { class: 'muted' }, t('price_na'))),
      h('span', { class: 'xs muted' }, fmtDate(p.end_month + '-01', { month: 'short', year: 'numeric' }))),
    !selOn && h('div', { class: 'grid3' },
      ph ? h('a', { class: 'btn green sm', href: 'tel:+91' + ph }, t('call')) : h('span', {}),
      ph ? h('a', { class: 'btn sm', href: waLink(ph, builderMsg(p)), target: '_blank', rel: 'noopener' }, icon('wa', 16), 'WhatsApp') : h('span', {}),
      h('button', { class: 'btn sm', onclick: () => openDetail('project', p) }, t('details'))));
}
function viewProjects() {
  if (!S.projects) { loadProjects().then(render); return [h('div', { class: 'empty' }, t('loading'))]; }
  if (!S.projects.length) return [h('div', { class: 'empty' }, t('proj_offline')), h('button', { class: 'btn', onclick: () => { S.projects = null; loadProjects(true).then(render); } }, t('retry'))];
  const Q = S.projQ ||= { year: 'all', type: 'all', q: '', area: null, n: 40 };
  const years = ['all', '2025', '2026', '2027', '2028', '2029', '2030'];
  const count = h('div', { class: 'xs muted' }), box = h('div', { class: 'stack' }), clear = h('div', {});
  const cur = () => (S.projOnly ? S.projects.filter((p) => S.projOnly.includes(p.rera)) : projFilter(Q));
  // Only the list redraws while typing, so the search box keeps focus and the keyboard stays open.
  const drawList = (first) => {
    const list = cur();
    count.textContent = `${list.length} ${t('proj_count')} · ${t('proj_src')}`;
    clear.replaceChildren(!list.length ? h('button', { class: 'btn gold', onclick: () => { S.projQ = { year: 'all', type: 'all', q: '', area: null, n: 40, mapOn: Q.mapOn }; render(); } }, '✕ ', t('clear_filters')) : '');
    box.replaceChildren(...list.slice(0, Q.n).map(projCard), list.length > Q.n ? h('button', { class: 'btn', onclick: () => { Q.n += 60; drawList(); } }, '+ ', list.length - Q.n) : '');
    if (!first && S.pmap) { S.pmap.remove(); S.pmap = null; initProjMap(); }
    updSelBar();
  };
  S.drawProjList = drawList;
  const search = h('input', { type: 'search', placeholder: t('search_proj'), value: Q.q, autocomplete: 'off', autocorrect: 'off', autocapitalize: 'none', spellcheck: 'false', enterkeyhint: 'search',
    oninput: (e) => { Q.q = e.target.value; Q.n = 40; S.projOnly = null; clearTimeout(S.pqT); S.pqT = setTimeout(drawList, 180); },
    onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); } });
  setTimeout(() => drawList(true), 0);
  return [
    h('div', { class: 'stickybar' },
      h('label', { class: 'searchbox flat' }, icon('search', 18), search,
        Q.q ? h('button', { class: 'iconbtn sm', 'aria-label': t('clear'), onclick: () => { Q.q = ''; search.value = ''; drawList(); search.focus(); } }, icon('x', 16)) : null),
      S.projOnly && h('button', { class: 'chip on', onclick: () => { S.projOnly = null; render(); } }, `🏗 ${S.projOnly.length} ${t('proj_count')}`, ' ✕'),
      Q.area && h('button', { class: 'chip on', onclick: () => { Q.area = null; render(); } }, areaName(areaById(Q.area), getLang()), ' ✕'),
      Q.areas && h('button', { class: 'chip on', onclick: () => { Q.areas = null; render(); } }, Q.areas.map((id) => areaName(areaById(id), getLang())).filter(Boolean).slice(0, 4).join(', '), ' ✕'),
      chips(years.map((y) => [y, y === 'all' ? t('all') : y]), Q.year, (v) => { Q.year = v; Q.n = 40; render(); }, 'scroll'),
      chips(['all', 'residential', 'plotted', 'mixed', 'commercial'].map((k) => [k, k === 'all' ? t('all') : t('p_' + k)]), Q.type, (v) => { Q.type = v; Q.n = 40; render(); }, 'scroll')),
    h('div', { class: 'between' }, count,
      h('div', { class: 'chips' },
        h('button', { class: 'chip' + (S.bsel ? ' on' : ''), onclick: () => { S.bsel = S.bsel ? null : new Set(); render(); } }, '✓ ', t('select')),
        h('button', { class: 'chip' + (Q.mapOn ? ' on' : ''), onclick: () => { Q.mapOn = !Q.mapOn; render(); } }, '🗺 ', t('map')))),
    S.bsel && h('div', { class: 'card inset selbar' },
      h('div', { class: 'between' }, h('span', { class: 'b', id: 'selcount' }, ''),
        h('div', { class: 'chips' },
          h('button', { class: 'chip', onclick: () => { for (const p of cur()) S.bsel.add(p.rera); drawList(); } }, t('select_all')),
          h('button', { class: 'chip', onclick: () => { S.bsel.clear(); drawList(); } }, t('select_none')))),
      h('button', { class: 'btn gold', onclick: () => { const sel = S.projects.filter((p) => S.bsel.has(p.rera)); if (!sel.length) return toast(t('select_first'), true); broadcastSheet(sel); } }, icon('wa', 18), t('bc_send'))),
    Q.mapOn ? h('div', { id: 'pmap', class: 'pmap', style: 'height:380px;flex:none;border-radius:18px;overflow:hidden;margin:6px 0 10px' }) : null,
    Q.mapOn ? h('div', { class: 'xs muted' }, t('proj_nopin')) : null,
    clear, box,
  ];
}
function updSelBar() {
  const el = document.getElementById('selcount'); if (!el || !S.bsel) return;
  const n = S.bsel.size, ph = new Set(S.projects.filter((p) => S.bsel.has(p.rera) && tel(p.phone)).map((p) => tel(p.phone))).size;
  el.textContent = `${n} ${t('selected')} · ${ph} ${t('bc_builders')}`;
}
// Projects map: clustered like Google Maps. Nearby projects merge into one "+N" bubble; tap it to zoom in.
// Only what is on screen is drawn, and the grid is rebuilt on every pan/zoom, so 1,500+ projects stay light.
function projFilter(Q) {
  const q = Q.q.trim().toLowerCase();
  return S.projects.filter((p) => (Q.year === 'all' || p.end_month.startsWith(Q.year)) && (Q.type === 'all' || p.ptype === Q.type) && (!Q.area || p.area_id === Q.area) && (!Q.areas || Q.areas.includes(p.area_id))
    && (!q || [p.name, p.promoter, projArea(p), p.locality, p.taluka, p.end_month, p.address].join(' ').toLowerCase().includes(q)));
}
function initProjMap() {
  const L = window.L, Q = S.projQ, el = document.getElementById('pmap'); if (!el) return;
  const pts = projFilter(Q).map((p) => ({ p, pos: projPos(p) })).filter((x) => x.pos);
  const sel = Q.area && areaById(Q.area);
  S.pmap = L.map(el, { zoomControl: false, preferCanvas: true });
  if (Q.view) S.pmap.setView(Q.view.c, Q.view.z); else if (sel) S.pmap.setView([sel.lat, sel.lng], 14); else S.pmap.setView([SURAT.lat, SURAT.lng], 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(S.pmap);
  const layer = L.layerGroup().addTo(S.pmap);
  const esc = (x) => String(x || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const popup = (p, pos) => `<b>${esc(p.name)}</b><br>${esc(p.promoter)}<br>${t('possession')}: ${esc(p.end_month)}${p.address ? '<br><small>' + esc(p.address) + '</small>' : ''}<br><a href="${gmaps(pos.lat, pos.lng)}" target="_blank" rel="noopener">${t('google_maps')}</a>${p.phone ? ` · <a href="tel:+91${tel(p.phone)}">${t('call')}</a>` : ''}`;
  const draw = () => {
    layer.clearLayers();
    const z = S.pmap.getZoom(), b = S.pmap.getBounds().pad(0.2), cell = z >= 17 ? 40 : 64, cells = new Map();
    for (const x of pts) {
      if (!b.contains([x.pos.lat, x.pos.lng])) continue;
      const pt = S.pmap.latLngToLayerPoint([x.pos.lat, x.pos.lng]), k = Math.floor(pt.x / cell) + ':' + Math.floor(pt.y / cell);
      const c = cells.get(k); if (c) { c.m.push(x); c.lat += x.pos.lat; c.lng += x.pos.lng; } else cells.set(k, { m: [x], lat: x.pos.lat, lng: x.pos.lng });
    }
    for (const c of cells.values()) {
      if (c.m.length === 1) {
        const { p, pos } = c.m[0];
        const html = `<div class="pin small sel"><span>🏗 ${esc(p.name).slice(0, 20)}</span><b>${fmtDate(p.end_month + '-01', { month: 'short', year: '2-digit' })}</b></div>`;
        L.marker([pos.lat, pos.lng], { icon: L.divIcon({ className: 'pinwrap', html, iconSize: null }) }).bindPopup(popup(p, pos)).addTo(layer);
        continue;
      }
      const n = c.m.length, at = [c.lat / n, c.lng / n], sz = n >= 100 ? 54 : n >= 20 ? 46 : 38;
      L.marker(at, { icon: L.divIcon({ className: 'pinwrap', html: `<div class="clus" style="width:${sz}px;height:${sz}px">+${n}</div>`, iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2] }) })
        .on('click', () => {
          const bb = L.latLngBounds(c.m.map((x) => [x.pos.lat, x.pos.lng]));
          // same building (can't split by zooming) → show them in the list below instead
          if (z >= 18 || bb.getNorthEast().distanceTo(bb.getSouthWest()) < 25) { Q.areas = null; Q.area = null; Q.q = ''; S.projOnly = c.m.map((x) => x.p.rera); Q.view = { c: at, z }; render(); return; }
          S.pmap.fitBounds(bb.pad(0.3), { maxZoom: 18 });
        }).addTo(layer);
    }
  };
  let tm; S.pmap.on('moveend zoomend', () => { clearTimeout(tm); tm = setTimeout(() => { Q.view = { c: S.pmap.getCenter(), z: S.pmap.getZoom() }; draw(); }, 60); });
  draw();
}
function projectsHere(a) {
  if (!S.projects) return null;
  const n = S.projects.filter((p) => p.area_id === a.id).length;
  return n ? h('button', { class: 'btn', onclick: () => goProjects({ area: a.id }) }, `${t('projects')}: ${n}`) : null;
}

// ---------- newspaper "for sale" ads (leads) ----------
const LEADS_KEY = 'leads.own';
function viewLeads() {
  const all = [...cfg.get(LEADS_KEY, []), ...(S.leads || [])].sort((x, y) => String(y.date).localeCompare(String(x.date)));
  return [
    h('div', { class: 'small muted' }, t('leads_note')),
    h('button', { class: 'btn', onclick: bulkPaste }, '📋 ', t('bulk_paste')),
    h('button', { class: 'btn gold', onclick: () => voiceBox(t('add_lead'), (text) => { const p = parseEntry(text); const l = { id: 'l' + Date.now(), date: new Date().toISOString().slice(0, 10), text, phone: p.phone, area_id: p.area_id, ptype: p.ptype, name: p.name, source: t('src_own') }; cfg.set(LEADS_KEY, [l, ...cfg.get(LEADS_KEY, [])]); render(); }) }, icon('plus', 18), t('add_lead')),
    all.length ? all.map((l) => { const ph = tel(l.phone); return h('article', { class: 'card tap', onclick: (e) => { if (!e.target.closest('a,button')) openDetail('lead', l); } },
      h('div', { class: 'tag' }, [l.source, l.date && fmtDate(l.date, { day: 'numeric', month: 'short' }), areaById(l.area_id) && areaName(areaById(l.area_id), getLang())].filter(Boolean).join(' · ')),
      h('div', { class: 'small' }, l.text),
      h('div', { class: 'grid3' },
        ph ? h('a', { class: 'btn green', href: 'tel:+91' + ph }, t('call')) : h('span', {}),
        h('button', { class: 'btn', onclick: () => inquiryForm({ name: l.name, phone: ph, area_id: l.area_id, ptype: l.ptype, deal: 'buy', notes: `${t('lead_seller')} · ${l.source || ''}: ${l.text}` }, render) }, t('to_inquiry')),
        h('button', { class: 'btn', onclick: () => openDetail('lead', l) }, t('details')))); })
      : h('div', { class: 'empty' }, t('no_leads')),
  ];
}

// =====================================================================================================
// Detail screens: project, paper ad, news article, valuation, trash, data sources
// =====================================================================================================
function viewDetail() {
  const d = S.detail;
  const fn = { project: viewProjectDetail, lead: viewLeadDetail, news: viewNewsDetail, value: viewValuation, trash: viewTrash, sources: viewSources, team: viewTeam }[d.kind];
  return fn ? fn(d.data) : [backHdr('—')];
}
const waLink = (ph, text) => 'https://wa.me/' + (ph ? '91' + tel(ph) : '') + (text ? '?text=' + encodeURIComponent(text) : '');
const CARD_URL = () => location.origin + '/card.html';
function builderMsg(p) {
  const en = getLang() === 'en';
  return en
    ? `Namaste, I am Dharmesh Mehta from Ami Realtors, Chowk Bazaar, Surat (${BRAND.phones}). We have buyers looking in ${projArea(p) || 'your area'}. Please share the price list, floor plans and brokerage terms for ${p.name}. Our visiting card: ${CARD_URL()}`
    : `નમસ્તે, હું ધર્મેશ મહેતા, અમી રિયલ્ટર્સ, ચોક બજાર, સુરત (${BRAND.phones}). ${projArea(p) || 'આપના વિસ્તાર'}માં અમારી પાસે ગ્રાહકો છે. ${p.name} પ્રોજેક્ટનું પ્રાઇસ લિસ્ટ, પ્લાન અને બ્રોકરેજની શરતો મોકલશો. અમારું વિઝિટિંગ કાર્ડ: ${CARD_URL()}`;
}
// ---------- many builders at once: one tap per builder, card + message already filled ----------
// WhatsApp lets no app send to many chats by itself, so this is a queue: Send → WhatsApp opens with the
// text ready → tap send there → come back → next one is already highlighted.
function broadcastSheet(projects) {
  const byPhone = new Map();
  for (const p of projects) { const ph = tel(p.phone); if (!ph) continue; const x = byPhone.get(ph) || { ph, builder: p.promoter, projects: [] }; x.projects.push(p); byPhone.set(ph, x); }
  const rows = [...byPhone.values()];
  const sent = new Set(cfg.get('bc.sent.' + new Date().toISOString().slice(0, 10), []));
  const f = { text: '', withName: true };
  const msgFor = (x) => {
    const names = x.projects.map((p) => p.name).slice(0, 3).join(', ');
    const base = f.text.trim() || builderMsg(x.projects[0]);
    return f.text.trim() ? `${base}\n\n${getLang() === 'en' ? 'Projects' : 'પ્રોજેક્ટ'}: ${names}\n${CARD_URL()}` : base.replace(x.projects[0].name, names);
  };
  openSheet(t('bc_title'), (api) => {
    const next = rows.find((x) => !sent.has(x.ph));
    return [
      h('div', { class: 'small muted' }, `${rows.length} ${t('bc_builders')} · ${projects.length - rows.reduce((s, x) => s + x.projects.length, 0)} ${t('bc_nophone')}`),
      h('div', { class: 'card inset' }, h('div', { class: 'b small' }, t('bc_card')),
        h('div', { class: 'prow' }, h('img', { src: 'img/card.jpg', alt: '', class: 'cardthumb' }), h('div', { class: 'grow stack tight' }, h('button', { class: 'btn sm', onclick: shareBizCard }, icon('share', 16), t('bc_card_share')), h('div', { class: 'xs muted' }, t('bc_card_help'))))),
      field(t('bc_msg'), h('textarea', { class: 'input area', rows: 4, placeholder: builderMsg(projects[0] || { name: '', promoter: '' }), oninput: (e) => { f.text = e.target.value; } })),
      h('div', { class: 'between' }, h('span', { class: 'b' }, `${sent.size}/${rows.length} ${t('bc_done')}`), sent.size ? h('button', { class: 'linkbtn', onclick: () => { sent.clear(); cfg.set('bc.sent.' + new Date().toISOString().slice(0, 10), []); api.redraw(); } }, t('bc_reset')) : null),
      h('div', { class: 'progress' }, h('span', { style: `width:${rows.length ? (sent.size / rows.length) * 100 : 0}%` })),
      rows.map((x) => {
        const done = sent.has(x.ph), isNext = x === next;
        return h('div', { class: 'card inset bcrow' + (done ? ' done' : '') + (isNext ? ' next' : '') },
          h('div', { class: 'between' }, h('div', { class: 'grow' }, h('div', { class: 'b small' }, x.builder || '—'), h('div', { class: 'xs muted' }, '+91 ' + x.ph + ' · ' + x.projects.map((p) => p.name).join(', '))),
            h('a', { class: 'btn ' + (done ? '' : 'green') + ' sm', href: waLink(x.ph, msgFor(x)), target: '_blank', rel: 'noopener', onclick: () => { sent.add(x.ph); cfg.set('bc.sent.' + new Date().toISOString().slice(0, 10), [...sent]); setTimeout(api.redraw, 400); } }, done ? '✓ ' + t('bc_again') : icon('wa', 16), done ? '' : t('send'))));
      }),
    ];
  }, { full: true });
}

// ---------- shared pieces for detail screens ----------
const kmTxt = (d) => (d == null ? '—' : d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(1) + (getLang() === 'en' ? ' km' : ' કિમી'));
// Area price block: market, jantri, model for one property type
function areaPriceBlock(a, ptype, lat, lng) {
  const unit = defaultUnit(ptype), mk = stats(a.id, ptype, 'market', null), j = stats(a.id, ptype, 'jantri');
  const m = lat != null ? priceAt(lat, lng, ptype, a) : (mk.median != null ? { value: mk.median, own: a } : knn(a.lat, a.lng, ptype, a.id));
  return h('div', { class: 'grid3' },
    h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t('market_rate')), h('div', { class: 'b' }, mk.median != null ? (mk.used > 1 && mk.min !== mk.max ? `${rate(mk.min, unit).replace('₹ ', '')}–${rate(mk.max, unit).replace('₹ ', '')}` : rate(mk.median, unit)) : '—')),
    h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t('jantri')), h('div', { class: 'b' }, rate(j.median, unit))),
    h('div', { class: 'tile dark' }, h('div', { class: 'gold xs' }, m && m.own ? t('here_rate') : t('model_price')), h('div', { class: 'b' }, m ? (m.own ? '' : '≈ ') + rate(m.value, unit) : '—')),
    h('div', { class: 'xs muted span3' }, `${t(ptype)} · ₹ / ${unitLabel(unit)}`));
}
function prosConsBlock(a) {
  const pts = areaPoints(a), en = getLang() === 'en';
  const pro = pts.filter((p) => p.kind === 'pro').slice(0, 6), con = pts.filter((p) => p.kind === 'con').slice(0, 6);
  const row = (p, k) => h('div', { class: 'pc ' + k }, h('div', { class: 'small' }, p.text), (p.source || p.url) && h('div', { class: 'xs muted' }, p.source || '', p.url ? [' · ', h('a', { href: p.url, target: '_blank', rel: 'noopener' }, t('link'))] : ''));
  if (!pro.length && !con.length) return h('div', { class: 'muted small' }, en ? 'No pros/cons recorded for this area yet.' : 'આ વિસ્તાર માટે હજુ ફાયદા/ગેરફાયદા નોંધાયા નથી.');
  return [h('h3', {}, t('pros')), pro.length ? pro.map((p) => row(p, 'pro')) : h('div', { class: 'muted small' }, '—'), h('h3', {}, t('cons')), con.length ? con.map((p) => row(p, 'con')) : h('div', { class: 'muted small' }, '—')];
}
const FAC = [['school', '🏫'], ['hospital', '🏥'], ['market', '🛒'], ['bank', '🏦'], ['bus', '🚌'], ['park', '🌳'], ['worship', '🛕'], ['fuel', '⛽']];
// Roads + facilities around a point, filled in when OpenStreetMap answers.
function nearbyBlock(lat, lng) {
  const roads = h('div', { class: 'stack tight' }, h('div', { class: 'muted small shimmer' }, t('loading'))), fac = h('div', { class: 'stack tight' }, h('div', { class: 'muted small shimmer' }, t('loading')));
  roadsAround(lat, lng, cfg).then((r) => roads.replaceChildren(...roadRows(r))).catch(() => roads.replaceChildren(h('div', { class: 'muted small' }, t('osm_fail'))));
  facilitiesAround(lat, lng, cfg).then((f) => fac.replaceChildren(...FAC.map(([k, e]) => {
    const xs = f[k] || []; if (!xs.length) return h('div', { class: 'between small' }, h('span', {}, e, ' ', t('fac_' + k)), h('span', { class: 'muted' }, t('fac_none')));
    const top = xs[0];
    return h('div', { class: 'between small' }, h('span', {}, e, ' ', t('fac_' + k), h('span', { class: 'xs muted' }, ` · ${xs.length} ${t('within_2km')}`)), h('span', { class: 'b ellip' }, `${(getLang() !== 'en' && top.gu) || top.name || ''} ${kmTxt(top.d)}`));
  }))).catch(() => fac.replaceChildren(h('div', { class: 'muted small' }, t('osm_fail'))));
  return [h('h3', {}, '🛣 ', t('roads')), roads, h('h3', {}, '📍 ', t('facilities')), fac, h('div', { class: 'xs muted' }, t('osm_note'))];
}
function roadRows(r) {
  const rows = [];
  const row = (k, v, sub) => h('div', { class: 'between small' }, h('span', {}, k), h('span', { class: 'b' }, v, sub ? h('span', { class: 'xs muted' }, ' ' + sub) : ''));
  rows.push(row(t('r_front'), r.front ? `${r.front.width} m` : '—', r.front ? `${t('rc_' + r.front.cls) || r.front.cls}${r.front.name ? ' · ' + r.front.name : ''}${r.front.tagged ? '' : ' · ' + t('r_est')}` : ''));
  rows.push(row(t('r_highway'), r.highway ? kmTxt(r.highway.d) : '> ' + kmTxt(6), r.highway ? r.highway.ref : ''));
  rows.push(row(t('r_state'), r.state ? kmTxt(r.state.d) : '> ' + kmTxt(2.5), r.state ? r.state.ref : ''));
  rows.push(row(t('r_rail'), r.rail ? kmTxt(r.rail.d) : '> ' + kmTxt(3), r.rail ? r.rail.name : ''));
  if (r.metro) rows.push(row(t('r_metro'), kmTxt(r.metro.d), r.metro.name));
  return rows;
}
// Exact official pages for this area: TP scheme PDF, DP sheet, jantri lookup path, land records, RERA.
function areaLinks(a, extra = {}) {
  const L = S.refs || {}, en = getLang() === 'en';
  const out = [];
  const link = (label, url, sub, kind = '') => out.push(h('a', { class: 'row linkrow ' + kind, href: url, target: '_blank', rel: 'noopener' }, h('div', { class: 'grow' }, h('div', { class: 'small b' }, label), sub && h('div', { class: 'xs muted' }, sub)), icon('link', 16)));
  const tps = (L.tp || []).filter((x) => (x.areas || []).includes(a.id));
  for (const tp of tps.slice(0, 4)) link(`${t('l_tp')} ${tp.no} ${tp.name}`, tp.url, `${tp.status ? t('tp_' + tp.status) + ' · ' : ''}SMC · PDF${tp.page ? ' · ' + t('page') + ' ' + tp.page : ''}`, 'pdf');
  const jr = (L.jantri || {})[a.id];
  if (jr) link(`${t('jantri')}: ${areaName(a, getLang())}`, jr.url, `${jr.note || ''}${jr.page ? ' · ' + t('page') + ' ' + jr.page : ''}${jr.date ? ' · ' + jr.date : ''}`, 'pdf');
  else link(`${t('jantri')}: ${t('l_garvi_lookup')}`, 'https://garvi.gujarat.gov.in/', `${t('l_path')}: ${t('l_jantri_path')} → ${a.district} → ${a.taluka || (a.district === 'Surat' ? 'Surat City / Choryasi' : '')} → ${a.en}`);
  const dp = (L.dp || {})[a.id];
  if (dp) link(`${t('l_dp')} – ${t('sheet')} ${dp.sheet}`, dp.url, 'SUDA DP-2035 · JPG');
  else if (a.district === 'Surat') link(t('l_dp_index'), 'https://www.sudaonline.org/wp-content/uploads/2020/11/INDAX-MAP.jpg', 'SUDA DP-2035 · ' + (en ? 'find the sheet letter for this area' : 'આ વિસ્તારનો શીટ અક્ષર જુઓ'));
  link(t('l_anyror'), a.village || a.taluka ? 'https://anyror.gujarat.gov.in/LandRecordRural.aspx' : 'https://anyror.gujarat.gov.in/emilkat/GeneralReport_IDB.aspx', `${t('l_path')}: ${a.village || a.taluka ? `VF-7/12 → ${a.district} → ${a.taluka || ''} → ${a.en}` : (en ? 'Urban property card → Surat → ' : 'શહેરી પ્રોપર્ટી કાર્ડ → સુરત → ') + a.en}`);
  link(t('l_index2'), 'https://garvi.gujarat.gov.in/', `${t('l_path')}: ${en ? 'Index-2 / Property search → Sub-registrar Surat → year → document no.' : 'ઇન્ડેક્સ-2 / પ્રોપર્ટી સર્ચ → સબ-રજિસ્ટ્રાર સુરત → વર્ષ → દસ્તાવેજ નં.'}`);
  if (extra.rera) link(`GujRERA: ${extra.rera}`, 'https://gujrera.gujarat.gov.in/project-search', `${t('l_path')}: ${en ? 'Project search → paste' : 'પ્રોજેક્ટ સર્ચ → પેસ્ટ કરો'} ${extra.rera}`);
  link(t('l_tp_all'), 'https://www.suratmunicipal.gov.in/Departments/TownPlanningAllTPSchemes', 'SMC');
  return h('div', { class: 'list' }, out);
}
const copyBtn = (text) => h('button', { class: 'linkbtn xs', onclick: async () => { try { await navigator.clipboard.writeText(text); toast(t('copied')); } catch { /* old phone */ } } }, t('copy'));

// ---------- project detail ----------
function viewProjectDetail(p) {
  const a = areaById(p.area_id), pos = projPos(p), pr = projPrice(p), ph = tel(p.phone);
  const pt = p.ptype === 'plotted' ? 'plot' : p.ptype === 'commercial' ? 'shop' : 'flat';
  const at = pos || a;
  return [
    backHdr(p.name, `${p.promoter}${projArea(p) ? ' · ' + projArea(p) : ''}`),
    h('section', { class: 'card hero-card' },
      h('div', { class: 'tag' }, [t('p_' + (p.ptype || 'residential')), `${t('possession')} ${fmtDate(p.end_month + '-01', { month: 'short', year: 'numeric' })}`].join(' · ')),
      pr ? [h('div', { class: 'xs gold b' }, pr.kind === 'expected' ? t('expected') : t('quoted')), h('div', { class: 'title big' }, pr.text), pr.note && h('div', { class: 'xs muted' }, pr.note, pr.url ? [' · ', h('a', { href: pr.url, target: '_blank', rel: 'noopener' }, t('link'))] : '')] : h('div', { class: 'muted' }, t('price_na')),
      h('div', { class: 'between xs' }, h('span', { class: 'muted' }, `RERA ${reraNo(p)}`), copyBtn(p.rera)),
      p.address && h('div', { class: 'small' }, '📍 ', p.address),
      h('div', { class: 'grid3' },
        ph ? h('a', { class: 'btn green', href: 'tel:+91' + ph }, t('call')) : h('span', {}),
        ph ? h('a', { class: 'btn', href: waLink(ph, builderMsg(p)), target: '_blank', rel: 'noopener' }, icon('wa', 16), 'WhatsApp') : h('span', {}),
        pos ? gmapsBtn(pos.lat, pos.lng) : h('a', { class: 'btn', href: gmaps(null, null, [p.name, p.promoter, p.locality || (a || {}).en, 'Surat'].filter(Boolean).join(', ')), target: '_blank', rel: 'noopener' }, '🔍 ', t('gsearch'))),
      h('div', { class: 'grid2' },
        h('button', { class: 'btn', onclick: () => { const c = a || SURAT, pin = projPin(p); pinPicker(p.name, pin ? { ...pin, exact: true } : { lat: c.lat, lng: c.lng }, (ps) => { const all = cfg.get(PROJPIN_KEY, {}); all[p.rera] = { lat: +ps.lat.toFixed(6), lng: +ps.lng.toFixed(6) }; cfg.set(PROJPIN_KEY, all); toast(t('saved')); render(); }); } }, projPin(p) ? '📌 ' + t('pin_move') : '📍 ' + t('pin_set')),
        at && h('button', { class: 'btn gold', onclick: () => openDetail('value', { lat: at.lat, lng: at.lng, label: p.name, ptype: pt, area: p.area_id }) }, icon('calc', 18), t('valuation')))),
    a && h('section', { class: 'card' }, h('div', { class: 'between' }, h('h2', {}, t('locality'), ': ', areaName(a, getLang())), h('button', { class: 'linkbtn', onclick: () => openPrices(a.id, pt) }, t('full_detail'))),
      areaPriceBlock(a, pt, pos && pos.lat, pos && pos.lng)),
    a && h('section', { class: 'card' }, h('h2', {}, t('pros_cons')), prosConsBlock(a)),
    at && h('section', { class: 'card' }, h('h2', {}, t('nearby')), nearbyBlock(at.lat, at.lng)),
    h('section', { class: 'card' }, h('h2', {}, t('sources')), areaLinks(a || { id: '', en: p.locality || 'Surat', district: p.district || 'Surat' }, { rera: p.rera })),
    h('div', { class: 'center' }, reportBtn('project', `${p.name} · ${p.rera}`)),
  ];
}

// ---------- paper ad / lead detail ----------
function viewLeadDetail(l) {
  const a = areaById(l.area_id), ph = tel(l.phone), p = parseEntry(l.text || '');
  const ptype = l.ptype || p.ptype || 'flat', unit = defaultUnit(ptype);
  const size = p.size ? toSqft(p.size, p.size_unit || defaultUnit(ptype), vigha()) : null;
  const ask = p.price && size ? p.price / size : p.rate ? rateToSqft(p.rate, p.rate_unit || unit, vigha()) : null;
  const mkt = a ? priceAt(a.lat, a.lng, ptype, a) : null;
  const rent = /ભાડે|rent/i.test(l.text || '') && !/જોઈએ/.test(l.text || '');
  return [
    backHdr(l.source ? l.source.split(',')[0] : t('leads'), [l.date && fmtDate(l.date, { day: 'numeric', month: 'short', year: 'numeric' }), a && areaName(a, getLang())].filter(Boolean).join(' · ')),
    h('section', { class: 'card hero-card' },
      h('div', { class: 'tag' }, [t(ptype), rent ? t('rent') : t('sale')].join(' · ')),
      h('div', { class: 'title' }, l.text),
      h('div', { class: 'xs muted' }, l.source || ''),
      ph && h('div', { class: 'between' }, h('span', { class: 'b' }, '📞 +91 ' + ph), copyBtn(ph)),
      h('div', { class: 'grid3' },
        ph ? h('a', { class: 'btn green', href: 'tel:+91' + ph }, t('call')) : h('span', {}),
        ph ? h('a', { class: 'btn', href: waLink(ph, getLang() === 'en' ? `Namaste, I saw your ad (${l.source || 'newspaper'}). Is it still available? – Dharmesh Mehta, Ami Realtors (${BRAND.phones})` : `નમસ્તે, આપની જાહેરાત (${l.source || 'છાપું'}) જોઈ. મિલકત હજુ ઉપલબ્ધ છે? – ધર્મેશ મહેતા, અમી રિયલ્ટર્સ (${BRAND.phones})`), target: '_blank', rel: 'noopener' }, icon('wa', 16), 'WhatsApp') : h('span', {}),
        h('button', { class: 'btn', onclick: () => inquiryForm({ name: l.name, phone: ph, area_id: l.area_id, ptype, deal: 'buy', notes: `${t('lead_seller')} · ${l.source || ''}: ${l.text}` }, render) }, t('to_inquiry'))),
      a && h('button', { class: 'btn gold', onclick: () => openDetail('value', { lat: a.lat, lng: a.lng, label: areaName(a, getLang()), ptype, area: a.id, size: size || null, rent: rent && p.price ? p.price : null }) }, icon('calc', 18), t('valuation'))),
    (ask || p.price) && h('section', { class: 'card' }, h('h2', {}, t('ad_vs_market')),
      p.price && h('div', { class: 'between small' }, h('span', {}, t('asking')), h('span', { class: 'b' }, moneyShort(p.price))),
      ask && h('div', { class: 'between small' }, h('span', {}, t('asking_rate')), h('span', { class: 'b' }, rate(ask, unit) + ' / ' + unitLabel(unit))),
      ask && mkt && h('div', { class: 'between small' }, h('span', {}, mkt.own ? t('market_rate') : t('model_price')), h('span', { class: 'b' }, rate(mkt.value, unit))),
      ask && mkt && h('div', { class: 'pc ' + (ask <= mkt.value * 1.05 ? 'pro' : 'con') }, h('div', { class: 'small b' }, `${pct(ask, mkt.value)} ${t('vs_market')}`))),
    a && h('section', { class: 'card' }, h('div', { class: 'between' }, h('h2', {}, t('locality'), ': ', areaName(a, getLang())), h('button', { class: 'linkbtn', onclick: () => openPrices(a.id, ptype) }, t('full_detail'))), areaPriceBlock(a, ptype)),
    a && h('section', { class: 'card' }, h('h2', {}, t('pros_cons')), prosConsBlock(a)),
    a && h('section', { class: 'card' }, h('h2', {}, t('nearby')), h('div', { class: 'xs muted' }, t('near_area_centre')), nearbyBlock(a.lat, a.lng)),
    a && h('section', { class: 'card' }, h('h2', {}, t('sources')), areaLinks(a)),
    h('div', { class: 'center' }, reportBtn('lead', `${l.source || ''} ${l.date || ''}: ${String(l.text).slice(0, 80)}`)),
  ];
}

// ---------- news article: full Gujarati write-up kept in the card ----------
function newsText(n) {
  const en = getLang() === 'en';
  return {
    title: (en ? n.title_en || n.title_gu : n.title_gu || n.title_en) || '',
    body: (en ? n.body_en || n.summary_en : n.body_gu || n.summary_gu) || (en ? n.summary_gu : n.summary_en) || '',
    points: (en ? n.points_en : n.points_gu) || [],
  };
}
function newsShareText(n) {
  const x = newsText(n);
  return `*${x.title}*\n\n${x.body}${x.points.length ? '\n\n' + x.points.map((p) => '• ' + p).join('\n') : ''}\n\n${t('source')}: ${n.source || ''}${n.url ? ' ' + n.url : ''}\n— ${BRAND.name}, ${BRAND.person} (${BRAND.phones})`;
}
function viewNewsDetail(n) {
  const x = newsText(n);
  return [
    backHdr(t('cat_' + n.category), fmtDate(n.published_on, { day: 'numeric', month: 'long', year: 'numeric' })),
    h('article', { class: 'card article' },
      h('h2', { class: 'atitle' }, x.title),
      h('div', { class: 'xs muted' }, n.source || ''),
      ...String(x.body).split(/\n{2,}/).map((para) => h('p', {}, para)),
      x.points.length ? h('ul', { class: 'apoints' }, x.points.map((p) => h('li', {}, p))) : null,
      n.area_ids && n.area_ids.length ? h('div', { class: 'chips wrap' }, n.area_ids.map((id) => areaById(id) && h('button', { class: 'chip', onclick: () => openPrices(id) }, areaName(areaById(id), getLang())))) : null),
    h('div', { class: 'grid2' },
      h('a', { class: 'btn green', href: 'https://wa.me/?text=' + encodeURIComponent(newsShareText(n)), target: '_blank', rel: 'noopener' }, icon('wa', 18), t('share_wa')),
      n.url ? h('a', { class: 'btn', href: n.url, target: '_blank', rel: 'noopener' }, t('original')) : h('span', {})),
    h('div', { class: 'xs muted center' }, t('news_note')),
    h('div', { class: 'center' }, reportBtn('news', `${n.published_on} · ${n.title_en || n.title_gu} · ${n.url || ''}`)),
  ];
}

// ---------- valuation: every method side by side for one spot ----------
function viewValuation(d) {
  const V = S.val && S.val.key === `${d.lat},${d.lng}` ? S.val : (S.val = { key: `${d.lat},${d.lng}`, ptype: d.ptype || S.mapType || 'flat', size: d.size ? Math.round(d.size) : '', rent: d.rent || '', inp: { ...DEFAULT_INPUTS }, roads: null, more: false, cap: null, mult: 5 });
  const inp = V.inp, pt = V.ptype, unit = defaultUnit(pt);
  const hint = d.area ? areaById(d.area) : null;
  const box = h('div', { class: 'stack' });
  const redraw = () => box.replaceChildren(...valuationBody(d, V, hint));
  const again = () => { if (S.detail && S.detail.kind === 'value' && S.val === V) { const y = $('.screen').scrollTop; render(); $('.screen').scrollTop = y; } };
  if (!V.roads && !V.loading) {
    V.loading = true;
    roadsAround(d.lat, d.lng, cfg).then((r) => {
      V.roads = r;
      if (inp.road_m == null && r.front) inp.road_m = r.front.width;
      if (inp.hw_km == null && r.highway) inp.hw_km = r.highway.d;
      if (r.highway && r.highway.d <= 0.05) inp.highway_frontage = true;
      if (inp.metro_km == null && r.metro) inp.metro_km = r.metro.d;
      again();
    }).catch(() => { V.roads = { failed: true }; again(); });
  }
  // municipal reach: inside SMC roughly within 12 km of Chowk, SUDA up to ~25 km, otherwise gram panchayat (editable)
  if (!V.authSet) { const dk = coreKm(d.lat, d.lng); inp.authority = dk <= 11 ? 'smc' : dk <= 25 ? 'suda' : 'gp'; inp.tp = dk <= 11 ? 'final' : dk <= 25 ? 'draft' : 'none'; if (dk > 25) { inp.sewer = 'no'; inp.water = 'no'; } V.authSet = true; }
  redraw();
  return [backHdr(t('valuation'), `${d.label || `${(+d.lat).toFixed(5)}, ${(+d.lng).toFixed(5)}`}`), box];
}
function valuationBody(d, V, hint) {
  const inp = V.inp, pt = V.ptype, unit = defaultUnit(pt), rd = () => { const y = $('.screen').scrollTop; render(); $('.screen').scrollTop = y; };
  const base = priceAt(d.lat, d.lng, pt, hint);
  const adj = adjustments(pt, inp);
  const a = hint || AREAS.filter((x) => !x.ind && sameBank(d.lat, d.lng, x)).map((x) => ({ x, d: km(d.lat, d.lng, x.lat, x.lng) })).sort((p, q) => p.d - q.d)[0]?.x;
  const ja = jantriAt(d.lat, d.lng, pt === 'land' ? 'land' : pt);
  const parts = [];
  // 1 market comparison
  const comp = base ? base.value * (1 + adj.total) : null;
  if (comp) parts.push({ key: 'm_comparison', value: comp, w: base.own ? 3 : 2 });
  // 2 income
  const cap = V.cap ?? CAP[pt];
  const inc = N(V.rent) && cap ? incomeValue({ rent: N(V.rent), cap, vacancy: VACANCY[pt] ?? 5, outgo: OUTGO[pt] ?? 15 }) : null;
  const sizeSqft = N(V.size) ? N(V.size) : null;
  if (inc && sizeSqft) parts.push({ key: 'm_income', value: inc.value / sizeSqft, w: ['shop', 'office', 'industrial'].includes(pt) ? 3 : 1 });
  // 3 residual (plots)
  let resid = null;
  if (pt === 'plot' && sizeSqft) {
    const flat = priceAt(d.lat, d.lng, 'flat', hint), fsi = fsiFor(inp.road_m || 12);
    const jp = jantriAt(d.lat, d.lng, 'plot');
    if (flat) resid = residualLand({ plotSqft: sizeSqft, fsi: fsi.base, saleRate: flat.value * 1.1, jantriSqft: jp ? jp.j : 0 });
    if (resid && resid.perSqft > 0) parts.push({ key: 'm_residual', value: resid.perSqft, w: 1 });
  }
  // 4 agriculture
  let agri = null;
  if (pt === 'land') {
    const vj = ja && ja.a && ja.a.village ? ja.j * 10.7639 : null;
    agri = agriValue({ jantriSqm: vj, multiple: V.mult, inp, marketSqft: base ? base.value : null });
    if (agri) parts.push({ key: 'm_agri', value: agri.value, w: 2 });
  }
  const fin = reconcileVals(parts);
  const r = (v) => rate(v, unit), tot = (v) => (sizeSqft ? moneyShort(v * sizeSqft) : '');
  const sel = (key, opts) => h('select', { class: 'input', value: String(inp[key]), onchange: (e) => { inp[key] = e.target.value; rd(); } }, opts.map(([v, l]) => h('option', { value: v }, l)));
  const yn = [['yes', t('yes')], ['no', t('no')]];
  const sizeUnitLbl = unitLabel('sqft');
  const methodRow = (p) => h('div', { class: 'mrow' }, h('div', {}, h('div', { class: 'b small' }, t(p.key)), h('div', { class: 'xs muted' }, t(p.key + '_how'))), h('div', { class: 'num' }, r(p.value), sizeSqft ? h('div', { class: 'xs muted' }, tot(p.value)) : ''));
  return [
    chips(PTYPES.map((p) => [p, t(p)]), pt, (v) => { V.ptype = v; rd(); }, 'scroll'),
    h('section', { class: 'card hero-card' },
      h('div', { class: 'xs gold b' }, t('val_final')),
      h('div', { class: 'title big' }, fin ? `${r(fin.value)} / ${unitLabel(unit)}` : t('no_price')),
      fin && h('div', { class: 'small' }, `${t('range')}: ${r(fin.lo).replace('₹ ', '₹ ')} – ${r(fin.hi).replace('₹ ', '')}`),
      fin && sizeSqft && h('div', { class: 'title' }, `${t('total')}: ${moneyShort(fin.value * sizeSqft)}`, h('span', { class: 'xs muted' }, ` (${moneyShort(fin.lo * sizeSqft)} – ${moneyShort(fin.hi * sizeSqft)})`)),
      h('div', { class: 'grid2' },
        field(`${t('size')} (${sizeUnitLbl})`, h('input', { class: 'input', inputmode: 'decimal', value: V.size, onchange: (e) => { V.size = e.target.value; rd(); } })),
        field(`${t('rent_month')} ₹`, h('input', { class: 'input', inputmode: 'decimal', value: V.rent, onchange: (e) => { V.rent = e.target.value; rd(); } }))),
      pt === 'land' && h('div', { class: 'xs muted' }, `1 ${t('u_vigha')} = ${vigha().toLocaleString('en-IN')} ${sizeUnitLbl}`)),
    h('section', { class: 'card' }, h('h2', {}, t('val_methods')),
      parts.length ? parts.map(methodRow) : h('div', { class: 'muted small' }, t('val_need')),
      base && h('div', { class: 'xs muted' }, `${t('m_base')}: ${base.own ? t('own_short') + ' ' + areaName(base.own, getLang()) : knnLine(base, unit)}`),
      inc && h('div', { class: 'card inset' }, h('div', { class: 'b small' }, t('m_income')),
        result(t('inc_gross'), money(inc.gross)), result(t('inc_noi'), money(inc.noi)), result(`${t('inc_cap')} ${cap}% → YP ${inc.yp.toFixed(1)}`, money(inc.value), true),
        h('div', { class: 'grid2' }, field(t('inc_cap') + ' %', h('input', { class: 'input', inputmode: 'decimal', value: cap, onchange: (e) => { V.cap = N(e.target.value); rd(); } })),
          h('div', { class: 'xs muted' }, t('inc_note')))),
      !inc && comp && CAP[pt] ? h('div', { class: 'xs muted' }, `${t('inc_expected')}: ${money(rentFromValue(comp * (sizeSqft || 1000), pt))} / ${t('month')} ${sizeSqft ? '' : '(1,000 ' + sizeUnitLbl + ')'} @ ${CAP[pt]}%`) : null,
      resid && h('div', { class: 'card inset' }, h('div', { class: 'b small' }, t('m_residual')),
        result(t('res_gdv'), moneyShort(resid.gdv)), result(t('res_cost'), moneyShort(resid.cons + resid.softs + resid.fin + resid.premium)), result(t('res_profit'), moneyShort(resid.prof)), result(t('res_land'), moneyShort(resid.land), true),
        h('div', { class: 'xs muted' }, t('res_note'))),
      agri && h('div', { class: 'card inset' }, h('div', { class: 'b small' }, t('m_agri')),
        result(agri.fromJantri ? `${t('jantri')} × ${agri.multiple}` : t('market_rate'), r(agri.base)),
        agri.adj.map((x) => result(t(x.key) + (x.note ? ' (' + x.note + ')' : ''), x.abs ? r(x.abs) : `${x.pct > 0 ? '+' : ''}${Math.round(x.pct * 100)}%`)),
        result(t('m_agri'), r(agri.value), true),
        h('div', { class: 'grid2' }, field(t('agri_mult'), h('input', { class: 'input', inputmode: 'decimal', value: V.mult, onchange: (e) => { V.mult = N(e.target.value) || 5; rd(); } })), h('div', { class: 'xs muted' }, t('agri_note'))))),
    h('section', { class: 'card' }, h('h2', {}, t('val_adjust')),
      adj.list.length ? adj.list.map((x) => result(t(x.key) + (x.note ? ` (${x.note})` : ''), `${x.pct > 0 ? '+' : ''}${Math.round(x.pct * 1000) / 10}%`)) : h('div', { class: 'muted small' }, t('adj_none')),
      adj.list.length ? result(t('total'), `${adj.total > 0 ? '+' : ''}${Math.round(adj.total * 1000) / 10}%`, true) : null,
      V.roads && !V.roads.failed ? h('div', { class: 'stack tight' }, roadRows(V.roads)) : h('div', { class: 'xs muted shimmer' }, V.roads && V.roads.failed ? t('osm_fail') : t('loading'))),
    h('section', { class: 'card' }, h('h2', {}, t('val_inputs')), h('div', { class: 'xs muted' }, t('val_inputs_help')),
      h('div', { class: 'grid2' },
        field(t('r_front') + ' (m)', h('input', { class: 'input', inputmode: 'decimal', value: inp.road_m ?? '', onchange: (e) => { inp.road_m = N(e.target.value); rd(); } })),
        field(t('r_highway') + ' (km)', h('input', { class: 'input', inputmode: 'decimal', value: inp.hw_km ?? '', onchange: (e) => { inp.hw_km = N(e.target.value); rd(); } }))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: inp.highway_frontage, onchange: (e) => { inp.highway_frontage = e.target.checked; rd(); } }), t('adj_hw_front')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: inp.corner, onchange: (e) => { inp.corner = e.target.checked; rd(); } }), t('adj_corner')),
      h('div', { class: 'grid3' }, field('⚡ ' + t('i_elec'), sel('electricity', yn)), field('💧 ' + t('i_water'), sel('water', yn)), field('🚽 ' + t('i_sewer'), sel('sewer', yn))),
      h('div', { class: 'grid2' }, field(t('i_auth'), sel('authority', [['smc', 'SMC'], ['suda', 'SUDA'], ['gp', t('i_gp')]])), field('TP', sel('tp', [['final', t('tp_final')], ['draft', t('tp_draft')], ['none', t('tp_none')]]))),
      pt === 'shop' && field(t('i_shop_front'), sel('shop_front', [['main', t('i_main')], ['inner', t('i_inner')], ['upper', t('i_upper')]])),
      ['flat', 'office'].includes(pt) && h('div', { class: 'grid2' }, field(t('floor'), h('input', { class: 'input', inputmode: 'numeric', value: inp.floor, onchange: (e) => { inp.floor = e.target.value; rd(); } })), field(t('i_age'), h('input', { class: 'input', inputmode: 'numeric', value: inp.age, onchange: (e) => { inp.age = e.target.value; rd(); } }))),
      ['bungalow', 'shop', 'industrial'].includes(pt) && field(t('i_age'), h('input', { class: 'input', inputmode: 'numeric', value: inp.age, onchange: (e) => { inp.age = e.target.value; rd(); } })),
      pt === 'land' && [
        h('div', { class: 'grid2' }, field(t('i_access'), sel('access', [['pakka', t('i_pakka')], ['kachha', t('i_kachha')], ['none', t('i_noroad')]])), field(t('i_irrig'), sel('irrigation', [['rainfed', t('i_rain')], ['bore', t('i_bore')], ['canal', t('i_canal')]]))),
        h('div', { class: 'grid2' }, field(t('i_tenure'), sel('tenure', [['old', t('i_old')], ['new', t('i_new')]])), field(t('i_na'), sel('na', [['agri', t('i_agri')], ['zone', t('i_zone')], ['na', 'NA']]))),
        field(t('i_soil'), sel('soil', [['normal', t('i_soil_ok')], ['khar', t('i_khar')]])),
        h('div', { class: 'xs muted' }, t('agri_rule'))]),
    h('div', { class: 'grid2' },
      h('button', { class: 'btn', onclick: () => { openDetail('sources'); } }, t('how_calc')),
      a ? h('button', { class: 'btn', onclick: () => openPrices(a.id, pt) }, t('full_detail')) : h('span', {})),
    h('div', { class: 'xs muted' }, t('val_disclaimer')),
  ];
}

// ---------- Google Maps link from WhatsApp → price at that exact spot ----------
async function priceFromLink(text) {
  if (!text || !text.trim()) return toast(t('link_paste'), true);
  toast(t('link_reading'));
  try {
    const c = await resolveMapsLink(text.trim());
    if (!c || c.lat == null) return toast(c && c.name ? `${t('link_noloc')}: ${c.name}` : t('link_bad'), true);
    S.spotAt = { lat: c.lat, lng: c.lng, label: c.name || null, fromLink: true };
    for (const sh of sheets.slice().reverse()) sh.close();
    S.detail = null;
    if (S.tab !== 'map') { S.tab = 'map'; render(); }
    if (S.map) { S.map.setView([c.lat, c.lng], 17); showSpot(c.lat, c.lng, c.name || null, true); }
  } catch { toast(t('link_fail'), true); }
}
function linkSheet() {
  const f = { v: '' };
  const sh = openSheet(t('link_title'), () => [
    h('div', { class: 'small muted' }, t('link_help')),
    h('textarea', { class: 'input area', rows: 3, placeholder: 'https://maps.app.goo.gl/…', oninput: (e) => { f.v = e.target.value; } }),
    h('div', { class: 'grid2' },
      h('button', { class: 'btn', onclick: async () => { try { f.v = await navigator.clipboard.readText(); sh.body.querySelector('textarea').value = f.v; } catch { toast(t('link_paste'), true); } } }, '📋 ', t('paste')),
      h('button', { class: 'btn gold', onclick: () => priceFromLink(f.v) }, t('get_price')))]);
}

// ---------- trash (deleted customers stay 30 days) ----------
const TRASH_DAYS = 30;
const isGone = (r) => !!r.deleted_at;
async function trashCustomer(c) {
  const now = new Date().toISOString();
  await saveRec('customers', { ...c, deleted_at: now });
  for (const i of S.data.inquiries.filter((x) => x.customer_id === c.id)) await saveRec('inquiries', { ...i, deleted_at: now });
  for (const x of S.data.tasks.filter((y) => y.customer_id === c.id && !y.done)) await saveRec('tasks', { ...x, deleted_at: now });
}
async function restoreCustomer(c) {
  const at = c.deleted_at;
  await saveRec('customers', { ...c, deleted_at: null });
  for (const i of S.data.inquiries.filter((x) => x.customer_id === c.id && x.deleted_at === at)) await saveRec('inquiries', { ...i, deleted_at: null });
  for (const x of S.data.tasks.filter((y) => y.customer_id === c.id && y.deleted_at === at)) await saveRec('tasks', { ...x, deleted_at: null });
}
async function purgeTrash() {
  const cut = new Date(Date.now() - TRASH_DAYS * 864e5).toISOString();
  for (const c of S.data.customers.filter((x) => x.deleted_at && x.deleted_at < cut)) {
    try {
      for (const tb of ['inquiries', 'activities', 'tasks']) for (const r of S.data[tb].filter((x) => x.customer_id === c.id)) await delRec(tb, r.id);
      await delRec('customers', c.id);
    } catch (e) { console.warn('purge', e); return; }
  }
}
function viewTrash() {
  const gone = S.data.customers.filter(isGone).sort((a, b) => String(b.deleted_at).localeCompare(String(a.deleted_at)));
  const left = (c) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(c.deleted_at)) / 864e5));
  return [
    backHdr(t('trash'), t('trash_help')),
    gone.length ? gone.map((c) => h('div', { class: 'card' },
      h('div', { class: 'between' }, h('div', {}, h('div', { class: 'title' }, custLabel(c)), h('div', { class: 'xs muted' }, `${t('deleted_on')} ${fmtDate(c.deleted_at, { day: 'numeric', month: 'short' })} · ${left(c)} ${t('days_left')}`)),
        h('button', { class: 'btn green sm', onclick: async () => { try { await restoreCustomer(c); toast(t('restored')); render(); } catch (e) { fail(e); } } }, t('restore'))))) : h('div', { class: 'empty' }, t('trash_empty')),
  ];
}

// ---------- where every number comes from (data catalogue) ----------
const SOURCES = [
  ['src_jantri', 'Garvi (IGR Gujarat)', 'https://garvi.gujarat.gov.in/', 'src_jantri_p', 'src_jantri_c'],
  ['src_dastavej', 'Garvi Index-2', 'https://garvi.gujarat.gov.in/', 'src_dast_p', 'src_dast_c'],
  ['src_land', 'AnyROR / e-Dhara / iORA', 'https://anyror.gujarat.gov.in/', 'src_land_p', 'src_land_c'],
  ['src_rera', 'GujRERA', 'https://gujrera.gujarat.gov.in/', 'src_rera_p', 'src_rera_c'],
  ['src_tp', 'SMC Town Planning', 'https://www.suratmunicipal.gov.in/Departments/TownPlanningAllTPSchemes', 'src_tp_p', 'src_tp_c'],
  ['src_dp', 'SUDA DP-2035', 'https://www.sudaonline.org/development-plans/dp-2035-sheet-dt-08-10-2020-corrigendum-9-11-2020/', 'src_dp_p', 'src_dp_c'],
  ['src_gidc', 'GIDC allotment price', 'https://gidc.gujarat.gov.in/allotmentprice', 'src_gidc_p', 'src_gidc_c'],
  ['src_portals', '99acres · MagicBricks · Housing · SquareYards', 'https://www.99acres.com/', 'src_portals_p', 'src_portals_c'],
  ['src_paper', 'Sandesh · Gujarat Samachar e-paper', 'https://sandesh.com/epaper/surat', 'src_paper_p', 'src_paper_c'],
  ['src_osm', 'OpenStreetMap', 'https://www.openstreetmap.org/', 'src_osm_p', 'src_osm_c'],
  ['src_own', 'Ami Realtors (own deals, WhatsApp groups)', null, 'src_own_p', 'src_own_c'],
];
function viewSources() {
  return [
    backHdr(t('sources_title'), t('sources_sub')),
    h('section', { class: 'card' }, h('h2', {}, t('how_calc')), h('div', { class: 'small' }, t('how_calc_body'))),
    SOURCES.map(([k, name, url, pro, con]) => h('section', { class: 'card' },
      h('div', { class: 'between' }, h('div', {}, h('div', { class: 'tag' }, t(k)), h('div', { class: 'title' }, name)), url && h('a', { class: 'iconbtn', href: url, target: '_blank', rel: 'noopener', 'aria-label': name }, icon('link', 18))),
      h('div', { class: 'pc pro' }, h('div', { class: 'small' }, '+ ', t(pro))), h('div', { class: 'pc con' }, h('div', { class: 'small' }, '− ', t(con))))),
  ];
}

// ---------- lock screen ----------
function showLock() {
  return new Promise((done) => {
    const pin = h('input', { class: 'input pin', type: 'password', inputmode: 'numeric', maxlength: 4, 'aria-label': t('enter_pin'), autocomplete: 'off',
      oninput: async (e) => { if (e.target.value.length === 4) { if (await lock.checkPin(e.target.value)) finish(); else { e.target.value = ''; toast(t('wrong_pin'), true); } } } });
    const face = async () => { if (await lock.checkFace()) finish(); };
    const el = h('div', { class: 'lockscreen' }, h('div', { class: 'lockbox' }, h('img', { src: 'img/logo.jpg', alt: 'Ami Realtors' }), h('div', { class: 'brandline' }, BRAND.tag_gu), h('div', { class: 'goldtext small b' }, t('enter_pin')), pin,
      lock.hasFace && h('button', { class: 'btn gold', onclick: face }, t('unlock_faceid'))));
    function finish() { el.remove(); done(); }
    document.body.append(el);
    if (lock.hasFace) face(); else setTimeout(() => pin.focus(), 100);
  });
}

// ---------- sign in first (every phone, every person) ----------
function authShell(...kids) {
  return h('div', { class: 'authscreen' }, h('div', { class: 'authbox' },
    h('img', { class: 'authlogo', src: 'img/logo.jpg', alt: 'Ami Realtors' }), h('div', { class: 'brandline center' }, BRAND.tag_gu), ...kids));
}
function showLogin() {
  return new Promise((done) => {
    const f = { email: cfg.get('lastEmail', ''), password: '', mode: 'in' };
    const el = h('div', {});
    const draw = () => el.replaceChildren(authShell(
      h('h1', { class: 'center' }, f.mode === 'up' ? t('create_account') : f.mode === 'reset' ? t('forgot') : t('sign_in')),
      h('div', { class: 'small muted center' }, t('login_why')),
      field(t('email'), h('input', { class: 'input', type: 'email', autocomplete: 'username', autocapitalize: 'none', value: f.email, oninput: (e) => { f.email = e.target.value; } })),
      f.mode !== 'reset' && field(t('password'), h('input', { class: 'input', type: 'password', autocomplete: f.mode === 'up' ? 'new-password' : 'current-password', value: f.password, oninput: (e) => { f.password = e.target.value; }, onkeydown: (e) => { if (e.key === 'Enter') go1(); } })),
      h('button', { class: 'btn gold big', onclick: go1 }, f.mode === 'up' ? t('create_account') : f.mode === 'reset' ? t('send_link') : t('sign_in')),
      h('div', { class: 'between' },
        h('button', { class: 'linkbtn', onclick: () => { f.mode = f.mode === 'up' ? 'in' : 'up'; draw(); } }, f.mode === 'up' ? t('have_account') : t('new_here')),
        f.mode !== 'reset' ? h('button', { class: 'linkbtn', onclick: () => { f.mode = 'reset'; draw(); } }, t('forgot')) : h('button', { class: 'linkbtn', onclick: () => { f.mode = 'in'; draw(); } }, t('back'))),
      h('div', { class: 'seg mini' }, ...[['gu', 'ગુજરાતી'], ['en', 'English']].map(([v, l]) => h('button', { class: getLang() === v ? 'on' : '', onclick: () => { setLang(v); draw(); } }, l)))));
    async function go1() {
      const email = f.email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return toast(t('email'), true);
      try {
        if (f.mode === 'reset') { await cloud.resetPassword(email); toast(t('reset_sent')); f.mode = 'in'; return draw(); }
        if (f.password.length < 6) return toast(t('pw_short'), true);
        await cloud.signIn(email, f.password, f.mode === 'up');
        cfg.set('lastEmail', email); el.remove(); done();
      } catch (e) {
        if (e.message === 'CONFIRM_EMAIL') { toast(t('confirm_email')); f.mode = 'in'; draw(); return; }
        toast(/invalid login/i.test(e.message) ? t('wrong_login') : /fetch|network/i.test(e.message) ? t('no_net') : e.message, true);
      }
    }
    draw(); document.body.append(el);
  });
}
// First owner creates the team; everyone else joins with a code. Before the v3 database update this is skipped.
function showTeamSetup() {
  return new Promise((done) => {
    const f = { name: 'Ami Realtors', person: '', code: '', mode: 'join' };
    const el = h('div', {});
    const draw = () => el.replaceChildren(authShell(
      h('h1', { class: 'center' }, t('team_setup')),
      h('div', { class: 'small muted center' }, cloud.email),
      seg([['join', t('team_join')], ['create', t('team_create')]], f.mode, (v) => { f.mode = v; draw(); }),
      field(t('your_name'), h('input', { class: 'input', value: f.person, oninput: (e) => { f.person = e.target.value; } })),
      f.mode === 'join' ? field(t('invite_code'), h('input', { class: 'input code', value: f.code, maxlength: 6, autocapitalize: 'characters', oninput: (e) => { f.code = e.target.value.toUpperCase(); } }))
        : [field(t('team_name'), h('input', { class: 'input', value: f.name, oninput: (e) => { f.name = e.target.value; } })), h('div', { class: 'xs muted' }, t('team_create_help'))],
      h('button', { class: 'btn gold big', onclick: async () => {
        try {
          if (f.mode === 'join') { if (f.code.trim().length < 6) return toast(t('invite_code'), true); await cloud.joinTeam(f.code, f.person.trim()); }
          else await cloud.createTeam(f.name.trim(), f.person.trim());
          el.remove(); done(); toast(t('team_ok'));
        } catch (e) { toast(e.message, true); }
      } }, t('continue')),
      h('button', { class: 'linkbtn', onclick: async () => { await cloud.signOut(); location.reload(); } }, t('sign_out'))));
    draw(); document.body.append(el);
  });
}
const canDelete = () => !cloud.ready || cloud.isOwner;
// Live sync: apply other phones' changes as they happen, without disturbing typing or an open form.
function startLive() {
  if (!cloud.ready) return;
  cloud.onStatus = () => { const d = document.querySelector('.livedot'); if (d) d.className = 'livedot' + (cloud.live ? ' on' : ''); };
  cloud.listen(PRIVATE.filter((x) => x !== 'reports'), (table, ev, row, old) => {
    if (!S.data[table]) return;
    const a = S.data[table];
    if (ev === 'DELETE') S.data[table] = a.filter((r) => r.id !== (old && old.id));
    else if (row && row.id) { const i = a.findIndex((r) => r.id === row.id); if (i >= 0) { if (String(a[i].updated_at) > String(row.updated_at)) return; a[i] = row; } else a.push(row); }
    if (table === 'price_points') S.fits = null;
    softRender();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && cloud.ready && !cloud.live) startLive(); });
}
function softRender() {
  clearTimeout(S.softT);
  S.softT = setTimeout(() => {
    const ae = document.activeElement;
    if (sheets.length || (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) || S.tab === 'map') { S.dirty = true; return; }
    const sc = $('.screen'), y = sc ? sc.scrollTop : 0; render(); const sc2 = $('.screen'); if (sc2) sc2.scrollTop = y;
  }, 300);
}
document.addEventListener('focusout', () => { if (S.dirty && !sheets.length) setTimeout(() => { if (S.dirty && !sheets.length && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) { S.dirty = false; softRender(); } }, 400); });
// Android share sheet → "Ami Realtors": a Google Maps link opens straight on the map with the price.
function handleShared() {
  const q = new URLSearchParams(location.search), txt = [q.get('text'), q.get('url'), q.get('title')].filter(Boolean).join(' ');
  if (q.get('open') === 'link') { history.replaceState(null, '', location.pathname); return linkSheet(); }
  if (!txt) return;
  history.replaceState(null, '', location.pathname);
  if (coordsFromText(txt) || isMapsUrl(firstUrl(txt))) priceFromLink(txt);
  else { S.tab = 'customers'; render(); }
}
// ---------- team: members, roles, invite codes ----------
function viewTeam() {
  const box = h('div', { class: 'stack' }, h('div', { class: 'muted small shimmer' }, t('loading')));
  const tm = cloud.team || {};
  const draw = async () => {
    if (tm.missing) return box.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'b' }, t('db_update')), h('div', { class: 'small' }, t('db_update_help'))));
    try {
      const ms = await cloud.members(); S.members = ms;
      box.replaceChildren(
        ...ms.map((m) => h('div', { class: 'card' }, h('div', { class: 'between' },
          h('div', {}, h('div', { class: 'title' }, m.name || m.email || '—'), h('div', { class: 'xs muted' }, [m.email, t('role_' + m.role)].filter(Boolean).join(' · '))),
          cloud.isOwner && m.user_id !== cloud.uid ? h('select', { class: 'input sel', value: m.role, onchange: async (e) => { try { await cloud.setRole(m.user_id, e.target.value); toast(t('saved')); } catch (er) { fail(er); } } }, ['owner', 'staff'].map((r) => h('option', { value: r }, t('role_' + r)))) : h('span', { class: 'badge' }, t('role_' + m.role))))),
        cloud.isOwner && h('section', { class: 'card' }, h('h2', {}, t('invite')), h('div', { class: 'small muted' }, t('invite_help')),
          h('div', { class: 'grid2' },
            ...['staff', 'owner'].map((r) => h('button', { class: 'btn ' + (r === 'staff' ? 'gold' : ''), onclick: async () => {
              try {
                const code = await cloud.invite(r);
                const msg = `${t('invite_msg')}\n${location.origin}\n${t('invite_code')}: ${code}`;
                openSheet(t('invite'), () => [h('div', { class: 'codebig' }, code), h('div', { class: 'small' }, t('invite_steps')),
                  h('a', { class: 'btn green', href: 'https://wa.me/?text=' + encodeURIComponent(msg), target: '_blank', rel: 'noopener' }, icon('wa', 18), 'WhatsApp'), copyBtn(code)]);
              } catch (er) { fail(er); }
            } }, `+ ${t('role_' + r)}`)))));
    } catch (e) { box.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'small' }, t('db_update_help')))); }
  };
  draw();
  return [backHdr(t('team'), `${tm.team_name || ''} · ${cloud.email}`), box];
}

// ---------- start ----------
let hiddenAt = 0, locked = false;
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (lock.hasPin && !locked && Date.now() - hiddenAt > 120000) { locked = true; await showLock(); locked = false; }
});
(async function start() {
  setLang(getLang());
  await cloud.init();
  if (!cloud.ready) await showLogin();
  if (cloud.team === null && cloud.ready) await showTeamSetup();
  if (lock.hasPin) { locked = true; await showLock(); locked = false; }
  // Anything saved on this phone before signing in moves to the cloud automatically (nothing is lost).
  if (cloud.ready) { try { if (await store.hasLocal()) { const n = await store.uploadLocal(); if (n) toast(`${t('upload_local')} ✓ (${n})`); } } catch (e) { console.warn('upload', e); } }
  await load();
  purgeTrash().catch(() => {});
  render();
  startLive();
  if (cloud.ready && cloud.isOwner && cloud.team && cloud.team.team_id) cloud.members().then((m) => { S.members = m; }).catch(() => {});
  loadPlaces();
  handleShared();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
