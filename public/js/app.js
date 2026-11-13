import { t, getLang, setLang, money, moneyShort, fmtDate } from './i18n.js';
import { AREAS, SURAT, areaById, areaName, km, searchAreas } from './areas.js';
import { UNITS, PTYPES, sqftPer, toSqft, rateToSqft, rateFromSqft, defaultUnit, summarize, emi, DEFAULT_VIGHA_SQFT } from './units.js';
import { parseEntry } from './parse.js';
import { store, cloud, cfg, lock, DEFAULT_SB_URL } from './store.js';

const S = {
  tab: 'today', newsCat: 'all', inqFilter: 'all', mapType: 'flat', mapSel: null, map: null,
  price: { area: 'piplod', ptype: 'flat', unit: null, furnished: false, showPoints: false },
  data: { properties: [], inquiries: [], deals: [], price_points: [], news: [], market: [] },
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
  properties: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M4.900 19.100L7 17M17 7l2.100-2.100"/>',
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
  const [news, market, prices] = await Promise.all([pub('news'), pub('market'), pub('prices')]);
  if (news.length) S.data.news = news.sort((a, b) => String(b.published_on).localeCompare(String(a.published_on)));
  if (market.length) S.data.market = market.sort((a, b) => String(b.day).localeCompare(String(a.day)));
  S.data.price_points = S.data.price_points.filter((p) => !p.pub).concat(prices.map((p, i) => ({ ...p, id: p.id || 'pub-' + i, pub: true })));
}
async function saveRec(table, rec) { const row = await store.save(table, rec); const a = S.data[table], i = a.findIndex((r) => r.id === row.id); if (i >= 0) a[i] = row; else a.push(row); return row; }
async function delRec(table, id) { await store.remove(table, id); S.data[table] = S.data[table].filter((r) => r.id !== id); }

function stats(areaId, ptype, kind, furnished) {
  let pts = S.data.price_points.filter((p) => p.area_id === areaId && p.ptype === ptype && p.kind === kind);
  if (kind === 'market' && furnished != null) pts = pts.filter((p) => (furnished ? p.furnished === true : p.furnished !== true));
  if (kind === 'jantri') {
    const last = pts.slice().sort((a, b) => String(b.observed_on).localeCompare(String(a.observed_on)))[0];
    return { n: pts.length, used: last ? 1 : 0, dropped: 0, median: last ? Number(last.price_sqft) : null, min: null, max: null, lo: -Infinity, hi: Infinity, points: pts };
  }
  return { ...summarize(pts), points: pts };
}
const rate = (v, unit) => (v == null ? '—' : money(rateFromSqft(v, unit, vigha())));
const pct = (a, b) => (a && b ? (a >= b ? '+' : '') + Math.round(((a - b) / b) * 100) + '%' : null);

// ---------- shell ----------
function render() {
  if (S.map && S.tab !== 'map') { S.map.remove(); S.map = null; }
  const view = { today: viewToday, map: viewMap, prices: viewPrices, inquiries: viewInq, properties: viewProps }[S.tab]();
  $('#app').replaceChildren(h('main', { class: 'screen ' + S.tab }, view), tabbar());
  if (S.tab === 'map') initMap();
}
function tabbar() {
  return h('nav', { class: 'tabbar', 'aria-label': 'Tabs' }, ['today', 'map', 'prices', 'inquiries', 'properties'].map((k) =>
    h('button', { class: k === S.tab ? 'on' : '', 'aria-current': k === S.tab ? 'page' : null, onclick: () => { S.tab = k; render(); } }, icon(k), h('span', {}, t(k)))));
}

// ---------- Today ----------
function viewToday() {
  const now = new Date(), end = new Date(now); end.setHours(23, 59, 59);
  const open = S.data.inquiries.filter((i) => !['closed', 'lost'].includes(i.status));
  const due = open.filter((i) => i.followup_at && new Date(i.followup_at) <= end);
  const fresh = open.filter((i) => (i.status || 'new') === 'new');
  const m = S.data.market[0];
  const cats = ['all', 'realestate', 'infra', 'rules', 'market'];
  const news = S.data.news.filter((n) => S.newsCat === 'all' || n.category === S.newsCat);
  const en = getLang() === 'en';
  return [
    h('header', { class: 'hdr' }, h('div', { class: 'logo' }, mark(30, 8)),
      h('div', { class: 'grow' }, h('h1', {}, t('greeting')), h('div', { class: 'muted small' }, fmtDate(now))),
      h('button', { class: 'iconbtn', 'aria-label': t('more'), onclick: openTools }, icon('gear'))),
    m && h('div', { class: 'grid4' }, [['gold', m.gold_10g, money], ['silver', m.silver_kg, money], ['sensex', m.sensex, (x) => Number(x).toLocaleString('en-IN')], ['home_loan', m.home_loan_rate, (x) => x + '%']]
      .map(([k, v, f]) => h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t(k)), h('div', { class: 'b' }, v == null ? '—' : f(v))))),
    h('button', { class: 'hero', onclick: () => { S.tab = 'inquiries'; render(); } },
      h('div', { class: 'grow' }, h('div', { class: 'gold small' }, t('followups_today')),
        h('div', { class: 'hero-t' }, due.length || fresh.length ? `${due.length} ${t('due_calls')} · ${fresh.length} ${t('new_inq')}` : t('no_followups'))), icon('chev', 20)),
    h('div', { class: 'rowhd' }, h('h2', {}, t('news'))),
    chips(cats.map((c) => [c, c === 'all' ? t('all') : t('cat_' + c)]), S.newsCat, (c) => { S.newsCat = c; render(); }, 'scroll'),
    news.length ? news.map((n) => h('article', { class: 'card' },
      h('div', { class: 'tag' }, t('cat_' + n.category) || n.category, ' · ', fmtDate(n.published_on, { day: 'numeric', month: 'short' })),
      h('div', { class: 'title' }, (en ? n.title_en || n.title_gu : n.title_gu || n.title_en) || ''),
      (en ? n.summary_en || n.summary_gu : n.summary_gu || n.summary_en) && h('div', { class: 'small' }, en ? n.summary_en || n.summary_gu : n.summary_gu || n.summary_en),
      h('div', { class: 'between small muted' }, h('span', {}, n.source || ''), n.url && h('a', { href: n.url, target: '_blank', rel: 'noopener' }, t('read_full')))))
      : h('div', { class: 'empty' }, t('no_news')),
  ];
}

// ---------- Map ----------
function viewMap() {
  return [
    h('div', { id: 'map' }),
    h('div', { class: 'map-top' },
      h('label', { class: 'searchbox' }, icon('search', 20),
        h('input', { id: 'mapq', placeholder: t('search_area'), 'aria-label': 'Search area', autocapitalize: 'none', autocomplete: 'off', enterkeyhint: 'search', oninput: mapSuggest, onkeydown: (e) => { if (e.key === 'Enter') mapSearch(e.target.value); } })),
      h('div', { id: 'mapsug', class: 'sug' }),
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
  S.border = null; S.spot = null;
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
function drawPins() {
  const L = window.L, b = S.map.getBounds().pad(0.15), c = S.map.getCenter(), unit = defaultUnit(S.mapType);
  S.layer.clearLayers();
  const placed = [];
  AREAS.filter((a) => b.contains([a.lat, a.lng])).map((a) => ({ a, s: stats(a.id, S.mapType, 'market', null) }))
    .sort((x, y) => (y.a.id === S.mapSel) - (x.a.id === S.mapSel) || (y.s.median != null) - (x.s.median != null) || km(c.lat, c.lng, x.a.lat, x.a.lng) - km(c.lat, c.lng, y.a.lat, y.a.lng))
    .filter(({ a }) => { const p = S.map.latLngToContainerPoint([a.lat, a.lng]); if (placed.some((q) => Math.abs(q.x - p.x) < 92 && Math.abs(q.y - p.y) < 50)) return false; placed.push(p); return true; })
    .slice(0, 40).forEach(({ a, s }) => {
    const html = `<div class="pin${a.id === S.mapSel ? ' sel' : ''}"><span>${areaName(a, getLang())}</span><b>${s.median == null ? '—' : rate(s.median, unit)}</b></div>`;
    L.marker([a.lat, a.lng], { icon: L.divIcon({ className: 'pinwrap', html, iconSize: null }), keyboard: true, title: a.en })
      .on('click', () => { S.mapSel = a.id; S.spotNote = null; drawPins(); drawMapCard(); drawBorder(a); }).addTo(S.layer);
  });
}
function drawMapCard() {
  const el = $('#mapcard'); if (!el) return;
  const a = S.mapSel && areaById(S.mapSel);
  if (!a) return el.replaceChildren();
  const unit = defaultUnit(S.mapType), j = stats(a.id, S.mapType, 'jantri'), d = stats(a.id, S.mapType, 'dastavej'), mk = stats(a.id, S.mapType, 'market', null);
  el.replaceChildren(h('div', { class: 'card float' },
    h('div', { class: 'between' }, h('div', { class: 'title big' }, areaName(a, getLang())), h('div', { class: 'muted small' }, `${t(S.mapType)} · ${t('per')} ${unitLabel(unit)}`)),
    S.spotNote && h('div', { class: 'small goldtext b' }, S.spotNote),
    h('div', { class: 'grid3' },
      h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t('jantri')), h('div', { class: 'b' }, rate(j.median, unit))),
      h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t('dastavej')), h('div', { class: 'b' }, rate(d.median, unit))),
      h('div', { class: 'tile dark' }, h('div', { class: 'gold xs' }, t('market_rate')), h('div', { class: 'b' }, rate(mk.median, unit)))),
    h('button', { class: 'btn gold', onclick: () => { S.price.area = a.id; S.price.ptype = S.mapType; S.price.unit = null; S.tab = 'prices'; render(); } }, t('full_detail'))));
}
function mapSuggest(e) {
  const q = e.target.value.trim(), box = $('#mapsug');
  if (!q) return box.replaceChildren();
  box.replaceChildren(...searchAreas(q).slice(0, 6).map((a) => h('button', { class: 'row', onclick: () => goArea(a) },
    h('span', {}, areaName(a, getLang())), h('span', { class: 'muted' }, `${a.en} · ${Math.round(km(SURAT.lat, SURAT.lng, a.lat, a.lng))} km`))));
}
function goArea(a) {
  S.mapSel = a.id; S.spotNote = null; if (S.spot) { S.spot.remove(); S.spot = null; }
  $('#mapsug').replaceChildren(); $('#mapq').value = a.en; $('#mapq').blur();
  S.map.flyTo([a.lat, a.lng], 14, { duration: 0.6 }); drawMapCard(); drawBorder(a);
}
async function mapSearch(q) {
  q = q.trim(); if (!q) return;
  const local = searchAreas(q);
  if (local.length) return goArea(local[0]);
  toast(t('not_found_local'));
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&viewbox=70.8,23.1,74.9,19.2&bounded=1&q=' + encodeURIComponent(q);
    const r = await (await fetch(url, { headers: { 'Accept-Language': 'en' } })).json();
    const p = r[0] && { lat: Number(r[0].lat), lng: Number(r[0].lon) };
    if (!p || km(SURAT.lat, SURAT.lng, p.lat, p.lng) > 200) return toast(t('not_found'), true);
    $('#mapsug').replaceChildren(); $('#mapq').blur();
    // A landmark (college, society, road): pin it and show the price of the area it falls in.
    const L = window.L, near = AREAS.map((a) => [km(p.lat, p.lng, a.lat, a.lng), a]).sort((x, y) => x[0] - y[0])[0];
    if (S.spot) S.spot.remove();
    S.spot = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: 'pinwrap', html: h('div', {}, h('div', { class: 'spot' }, q)).innerHTML, iconSize: null }), interactive: false }).addTo(S.map);
    if (near[0] <= 6) { S.mapSel = near[1].id; S.spotNote = `${q} · ${near[0].toFixed(1)} km`; drawMapCard(); drawBorder(near[1]); }
    S.map.flyTo([p.lat, p.lng], 14, { duration: 0.6 });
  } catch { toast(t('not_found'), true); }
}

// ---------- Prices ----------
function viewPrices() {
  const P = S.price, a = areaById(P.area) || AREAS[0], unit = P.unit || defaultUnit(P.ptype);
  const j = stats(a.id, P.ptype, 'jantri'), d = stats(a.id, P.ptype, 'dastavej'), mk = stats(a.id, P.ptype, 'market', P.furnished);
  const all = [...mk.points, ...d.points, ...j.points];
  const bySrc = {}; all.forEach((p) => { bySrc[p.source || 'other'] = (bySrc[p.source || 'other'] || 0) + 1; });
  const last = all.map((p) => p.observed_on).sort().pop();
  const line = (label, sub, val, strong) => h('div', { class: 'rate' + (strong ? ' strong' : '') }, h('div', {}, h('div', { class: 'b' }, label), sub && h('div', { class: 'xs ' + (strong ? 'goldtext b' : 'muted') }, sub)), h('div', { class: 'num' }, val));
  const rd = () => render();
  return [
    h('header', { class: 'hdr' },
      h('button', { class: 'grow areahd', onclick: () => pickArea((x) => { P.area = x.id; rd(); }) }, h('h1', {}, areaName(a, getLang()), icon('down', 20)),
        h('div', { class: 'muted small' }, `${a.district} · ${getLang() === 'en' ? Math.round(km(SURAT.lat, SURAT.lng, a.lat, a.lng)) + ' km from Surat' : 'સુરતથી ' + Math.round(km(SURAT.lat, SURAT.lng, a.lat, a.lng)) + ' કિમી'}${last ? ' · ' + t('updated') + ' ' + fmtDate(last, { day: 'numeric', month: 'short' }) : ''}`)),
      h('select', { class: 'input sel', 'aria-label': t('type'), value: P.ptype, onchange: (e) => { P.ptype = e.target.value; P.unit = null; rd(); } }, PTYPES.map((p) => h('option', { value: p }, t(p))))),
    h('div', { class: 'grid5' }, UNITS.map((u) => h('button', { class: 'chip sq' + (u === unit ? ' on' : ''), 'aria-pressed': String(u === unit), onclick: () => { P.unit = u; rd(); } }, unitLabel(u)))),
    seg([[false, t('unfurnished')], [true, t('furnished')]], P.furnished, (v) => { P.furnished = v; rd(); }),
    h('section', { class: 'card rates' },
      line(t('jantri'), t('jantri_sub') + ' · ' + t('src_garvi'), rate(j.median, unit)),
      line(t('dastavej'), pct(d.median, j.median) && `${t('vs_jantri')} ${pct(d.median, j.median)}`, rate(d.median, unit)),
      line(t('market_rate'), mk.median == null ? t('no_price') : [pct(mk.median, j.median) && `${t('vs_jantri')} ${pct(mk.median, j.median)}`, mk.used > 1 && `${t('range')} ${rate(mk.min, unit)} – ${rate(mk.max, unit).replace('₹ ', '')}`].filter(Boolean).join(' · '), rate(mk.median, unit), true)),
    h('section', { class: 'card' },
      h('h2', {}, t('how_computed')),
      h('div', { class: 'grid3' },
        h('div', { class: 'tile' }, h('div', { class: 'b' }, mk.n), h('div', { class: 'muted xs' }, t('prices_found'))),
        h('div', { class: 'tile' }, h('div', { class: 'b' }, t('median')), h('div', { class: 'muted xs' }, t('method'))),
        h('div', { class: 'tile' }, h('div', { class: 'b' }, mk.dropped), h('div', { class: 'muted xs' }, t('dropped')))),
      Object.keys(bySrc).length ? h('div', { class: 'list tight' }, Object.entries(bySrc).map(([s, n]) => h('div', { class: 'between small' }, h('span', {}, t('src_' + s)), h('span', { class: 'b' }, n)))) : null,
      all.length ? h('button', { class: 'linkbtn', onclick: () => { P.showPoints = !P.showPoints; rd(); } }, t('sources'), ' (', all.length, ')') : null,
      P.showPoints && h('div', { class: 'list tight' }, all.sort((x, y) => String(y.observed_on).localeCompare(String(x.observed_on))).map((p) => {
        const out = p.kind === 'market' && (p.price_sqft < mk.lo || p.price_sqft > mk.hi);
        return h('div', { class: 'pt' + (out ? ' out' : '') },
          h('div', { class: 'between small' }, h('span', { class: 'b' }, `${t(p.kind === 'market' ? 'market_rate' : p.kind)} · ${rate(p.price_sqft, unit)}`, out ? ` (${t('outlier')})` : ''), h('span', { class: 'muted' }, fmtDate(p.observed_on, { day: 'numeric', month: 'short' }))),
          h('div', { class: 'between xs muted' }, h('span', {}, t('src_' + (p.source || 'other')), p.note ? ' · ' + p.note : ''),
            h('span', {}, p.source_url && h('a', { href: p.source_url, target: '_blank', rel: 'noopener' }, t('link')), ' ', !p.pub && (p.owner || !cloud.ready) && h('button', { class: 'linkbtn xs', onclick: async () => { if (confirm(t('confirm_del'))) { await delRec('price_points', p.id).catch(fail); rd(); } } }, t('del')))));
      }))),
    h('div', { class: 'grid2' },
      h('button', { class: 'btn green', onclick: () => pricePointForm({ area_id: a.id, ptype: P.ptype, unit }) }, icon('plus', 18), t('add_price')),
      h('button', { class: 'btn', onclick: () => pasteMessage(a.id, P.ptype) }, t('paste_msg'))),
  ];
}
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
    h('div', { class: 'grid2' }, field(t('source'), h('select', { class: 'input', value: f.source, onchange: (e) => { f.source = e.target.value; } }, ['own', 'whatsapp', 'listing', 'news', 'garvi', 'other'].map((s) => h('option', { value: s }, t('src_' + s))))),
      field(t('date'), inp(f, 'observed_on', { type: 'date' }))),
    field(t('notes'), inp(f, 'note')), field(t('link'), inp(f, 'source_url', { inputmode: 'url', autocapitalize: 'none' })),
    h('button', { class: 'btn gold', onclick: async () => {
      const v = N(f.value); if (!v || !f.area_id) return toast(t('area') + ' + ' + t('prices'), true);
      try {
        await saveRec('price_points', { area_id: f.area_id, ptype: f.ptype, kind: f.kind, price_sqft: rateToSqft(v, f.unit, vigha()), furnished: f.furnished === 'yes' ? true : f.furnished === 'no' ? false : null, source: f.source, note: f.note || null, source_url: f.source_url || null, observed_on: f.observed_on });
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

// ---------- Inquiries ----------
const ST = ['new', 'visit', 'nego', 'closed', 'lost'];
function matches(q) {
  return S.data.properties.filter((p) => (!q.area_id || !p.area_id || p.area_id === q.area_id) && (!q.ptype || !p.ptype || p.ptype === q.ptype)
    && ((q.deal === 'rent') === (p.deal === 'rent')) && (!q.budget || !p.price || Number(p.price) <= Number(q.budget) * 1.1) && (q.area_id || q.ptype || q.budget));
}
const tel = (p) => String(p || '').replace(/\D/g, '').slice(-10);
function viewInq() {
  const q = { v: '' };
  const list = S.data.inquiries.filter((i) => S.inqFilter === 'all' || (i.status || 'new') === S.inqFilter).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const start = (text) => { const p = parseEntry(text || ''); inquiryForm({ phone: p.phone || tel(text), name: p.name, area_id: p.area_id, ptype: p.ptype, deal: p.deal === 'rent' ? 'rent' : 'buy', budget: p.price, notes: (text || '').replace(/[\d\s+()-]/g, '').length > 3 ? text : '' }); };
  return [
    h('header', { class: 'hdr' }, h('h1', { class: 'grow' }, t('inquiries'))),
    h('section', { class: 'hero col' }, h('label', { class: 'gold small', for: 'pasteNum' }, t('paste_hint')),
      h('div', { class: 'pasterow' },
        h('input', { id: 'pasteNum', class: 'input', inputmode: 'tel', placeholder: '+91', oninput: (e) => { q.v = e.target.value; } }),
        h('button', { class: 'btn gold', onclick: async () => { try { const s = await navigator.clipboard.readText(); $('#pasteNum').value = q.v = s.trim(); } catch { $('#pasteNum').focus(); } } }, t('paste')),
        h('button', { class: 'btn mid', onclick: () => start(q.v) }, t('add'))),
      h('button', { class: 'linkbtn goldlink', onclick: () => voiceBox(t('speak_add'), (text) => start(text)) }, icon('mic', 18), ' ', t('speak_add'))),
    chips([['all', t('all')], ...ST.map((s) => [s, t('st_' + s)])], S.inqFilter, (v) => { S.inqFilter = v; render(); }, 'scroll'),
    list.length ? list.map((i) => {
      const a = areaById(i.area_id), m = matches(i), ph = tel(i.phone);
      return h('article', { class: 'card' },
        h('div', { class: 'between top' }, h('div', {}, h('div', { class: 'title' }, i.name || (ph ? '+91 ' + ph : '—')),
          h('div', { class: 'small muted' }, [a && areaName(a, getLang()), i.ptype && t(i.ptype), i.deal && t(i.deal), i.budget && moneyShort(i.budget)].filter(Boolean).join(' · '))),
          h('select', { class: 'badge st-' + (i.status || 'new'), 'aria-label': t('status'), value: i.status || 'new', onchange: async (e) => { await saveRec('inquiries', { ...i, status: e.target.value }).catch(fail); render(); } }, ST.map((s) => h('option', { value: s }, t('st_' + s))))),
        m.length ? h('button', { class: 'linkbtn', onclick: () => openSheet(`${m.length} ${t('matches')}`, () => m.map(propCard)) }, `${m.length} ${t('matches')}`) : null,
        i.followup_at && h('div', { class: 'small goldtext b' }, `${t('followup')}: ${new Date(i.followup_at).toLocaleString(getLang() === 'en' ? 'en-IN' : 'gu-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`),
        i.notes && h('div', { class: 'small' }, i.notes),
        h('div', { class: 'grid3' },
          ph ? h('a', { class: 'btn green', href: 'tel:+91' + ph }, t('call')) : h('span', {}),
          ph ? h('a', { class: 'btn', href: 'https://wa.me/91' + ph, target: '_blank', rel: 'noopener' }, t('whatsapp')) : h('span', {}),
          h('button', { class: 'btn', onclick: () => inquiryForm(i) }, t('edit'))));
    }) : h('div', { class: 'empty' }, t('no_inq')),
  ];
}
function ics(i) {
  const d = new Date(i.followup_at), z = (x) => x.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ami Realtors//EN', 'BEGIN:VEVENT', 'UID:' + (i.id || Date.now()) + '@ami', 'DTSTAMP:' + z(new Date()), 'DTSTART:' + z(d), 'DTEND:' + z(new Date(+d + 9e5)),
    'SUMMARY:Call ' + (i.name || '') + ' ' + (i.phone || ''), 'BEGIN:VALARM', 'TRIGGER:-PT5M', 'ACTION:DISPLAY', 'DESCRIPTION:Follow-up', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([body], { type: 'text/calendar' })), download: 'follow-up.ics' }); a.click();
}
function inquiryForm(init) {
  const f = { status: 'new', deal: 'buy', ...init };
  for (const k of Object.keys(f)) if (f[k] == null) delete f[k];
  if (f.followup_at) f.followup_at = toLocalInput(f.followup_at);
  const sh = openSheet(t('inquiries'), (api) => [
    h('div', { class: 'grid2' }, field(t('name'), inp(f, 'name')), field(t('phone'), inp(f, 'phone', { inputmode: 'tel' }))),
    areaBtn(f, 'area_id', api.redraw),
    chips(PTYPES.map((p) => [p, t(p)]), f.ptype, (v) => { f.ptype = f.ptype === v ? undefined : v; api.redraw(); }, 'wrap'),
    seg([['buy', t('buy')], ['rent', t('rent')]], f.deal, (v) => { f.deal = v; api.redraw(); }),
    h('div', { class: 'grid2' }, field(t('budget'), numInp(f, 'budget')), field(t('followup'), inp(f, 'followup_at', { type: 'datetime-local' }))),
    field(t('notes'), h('textarea', { class: 'input area', rows: 2, value: f.notes || '', oninput: (e) => { f.notes = e.target.value; } })),
    h('button', { class: 'btn gold', onclick: async () => {
      try {
        const row = await saveRec('inquiries', { id: f.id, created_at: f.created_at, name: f.name || null, phone: tel(f.phone) || null, area_id: f.area_id || null, ptype: f.ptype || null, deal: f.deal, budget: N(f.budget), notes: f.notes || null, status: f.status, followup_at: f.followup_at ? new Date(f.followup_at).toISOString() : null });
        sh.close(); toast(t('saved')); render();
        if (row.followup_at && row.followup_at !== init.followup_at && confirm(t('add_cal') + '?')) ics(row);
      } catch (e) { fail(e); }
    } }, t('save')),
    f.id && h('button', { class: 'btn danger', onclick: async () => { if (confirm(t('confirm_del'))) { await delRec('inquiries', f.id).catch(fail); sh.close(); render(); } } }, t('del')),
  ]);
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
const EN = { flat: 'Flat', bungalow: 'Bungalow', shop: 'Shop', office: 'Office', plot: 'Plot', land: 'Land', industrial: 'Industrial', u_sqft: 'sq ft', u_sqm: 'sq m', u_var: 'sq yd', u_vigha: 'vigha', u_hectare: 'hectare' };
function propCard(p) {
  const a = areaById(p.area_id), ph = tel(p.owner_phone);
  const img = h('div', { class: 'thumb' });
  if (p.photos?.[0]) store.fileUrl(p.photos[0]).then((u) => { if (u) img.style.backgroundImage = `url(${u})`; });
  return h('article', { class: 'card' },
    h('div', { class: 'prow' }, p.photos?.[0] ? img : null, h('div', { class: 'grow' },
      h('div', { class: 'tag' }, [t(p.deal || 'sale'), a ? areaName(a, getLang()) : p.area_text].filter(Boolean).join(' · ')),
      h('div', { class: 'title' }, propTitle(p)),
      h('div', { class: 'b' }, p.price ? moneyShort(p.price) : '—', p.price && p.size ? h('span', { class: 'muted small' }, ` · ${money(p.price / p.size)} / ${unitLabel(p.size_unit || 'sqft')}`) : null),
      h('div', { class: 'small muted' }, [p.owner_name, p.furnished === true ? t('furnished') : p.furnished === false ? t('unfurnished') : null, p.floor && `${t('floor')} ${p.floor}`, p.facing].filter(Boolean).join(' · ')))),
    h('div', { class: 'grid3' },
      ph ? h('a', { class: 'btn green', href: 'tel:+91' + ph }, t('call')) : h('span', {}),
      h('button', { class: 'btn', onclick: () => shareCard(p).catch(fail) }, t('share_card')),
      h('button', { class: 'btn', onclick: () => propertyForm(p) }, t('edit'))));
}
function viewProps() {
  const list = S.data.properties.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return [
    h('header', { class: 'hdr' }, h('h1', { class: 'grow' }, t('properties')), h('span', { class: 'muted small' }, list.length || '')),
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
    fileRow('photos', 'image/*', t('photos')), fileRow('docs', 'image/*,application/pdf', t('docs')),
    field(t('notes'), h('textarea', { class: 'input area', rows: 2, value: f.notes || '', oninput: (e) => { f.notes = e.target.value; } })),
    h('button', { class: 'btn gold', onclick: async () => {
      try {
        await saveRec('properties', { id: f.id, created_at: f.created_at, ptype: f.ptype || null, deal: f.deal, area_id: f.area_id || null, price: N(f.price), size: N(f.size), size_unit: f.size_unit, bhk: N(f.bhk), floor: f.floor || null, facing: f.facing || null, furnished: f.furnished ?? null, owner_name: f.owner_name || null, owner_phone: tel(f.owner_phone) || null, notes: f.notes || null, photos: f.photos, docs: f.docs });
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
function openTools() {
  const sh = openSheet(t('tools'), () => [['emi_calc', emiCalc], ['stamp_calc', stampCalc], ['commission', commission], ['settings', settings]].map(([k, fn]) =>
    h('button', { class: 'row big', onclick: () => { sh.close(); fn(); } }, h('span', {}, t(k)), icon('chev', 18))));
}
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
    const due = d.reduce((s, r) => s + (Number(r.brokerage_due) || 0), 0), got = d.reduce((s, r) => s + (Number(r.brokerage_received) || 0), 0);
    return [h('div', { class: 'grid3' }, [['brokerage_due', due], ['brokerage_recv', got], ['pending', due - got]].map(([k, v]) => h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t(k).replace(' ₹', '')), h('div', { class: 'b' }, moneyShort(v))))),
      h('button', { class: 'btn gold', onclick: () => dealForm({}, api.redraw) }, icon('plus', 18), t('add_deal')),
      d.length ? d.map((r) => h('button', { class: 'card rowcard', onclick: () => dealForm(r, api.redraw) }, h('div', { class: 'between' }, h('span', { class: 'b' }, r.title || '—'), h('span', { class: 'muted small' }, r.deal_date ? fmtDate(r.deal_date, { day: 'numeric', month: 'short', year: 'numeric' }) : '')),
        h('div', { class: 'between small' }, h('span', { class: 'muted' }, r.client || ''), h('span', {}, `${moneyShort(Number(r.brokerage_received) || 0)} / ${moneyShort(Number(r.brokerage_due) || 0)}`)))) : h('div', { class: 'empty' }, t('no_deals'))];
  });
}
function dealForm(init, after) {
  const f = { deal_date: new Date().toISOString().slice(0, 10), ...init };
  const sh = openSheet(t('deal_title'), () => [field(t('deal_title'), inp(f, 'title')), h('div', { class: 'grid2' }, field(t('client'), inp(f, 'client')), field(t('date'), inp(f, 'deal_date', { type: 'date' }))),
    field(t('deal_value'), numInp(f, 'deal_value')), h('div', { class: 'grid2' }, field(t('brokerage_due'), numInp(f, 'brokerage_due')), field(t('brokerage_recv'), numInp(f, 'brokerage_received'))),
    h('button', { class: 'btn gold', onclick: async () => { try { await saveRec('deals', { id: f.id, created_at: f.created_at, title: f.title || null, client: f.client || null, deal_date: f.deal_date || null, deal_value: N(f.deal_value), brokerage_due: N(f.brokerage_due), brokerage_received: N(f.brokerage_received) }); sh.close(); after(); } catch (e) { fail(e); } } }, t('save')),
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
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
