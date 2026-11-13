import { t, getLang, setLang, money, moneyShort, fmtDate } from './i18n.js';
import { AREAS, SURAT, areaById, areaName, km, searchAreas } from './areas.js';
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
  const [news, market, prices, insights, tags] = await Promise.all([pub('news'), pub('market'), pub('prices'), pub('insights'), pub('tags')]);
  S.insights = Array.isArray(insights) ? insights : []; S.tags = tags && !Array.isArray(tags) ? tags : {};
  if (news.length) S.data.news = news.sort((a, b) => String(b.published_on).localeCompare(String(a.published_on)));
  if (market.length) S.data.market = market.sort((a, b) => String(b.day).localeCompare(String(a.day)));
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
    h('button', { class: 'btn gold', onclick: () => { S.price.area = a.id; S.price.ptype = S.mapType; S.price.unit = null; S.price.grade = 'all'; S.tab = 'prices'; render(); } }, t('full_detail'))));
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
    field(t('notes'), inp(f, 'note')), field(t('link'), inp(f, 'source_url', { inputmode: 'url', autocapitalize: 'none' })),
    h('button', { class: 'btn gold', onclick: async () => {
      const v = N(f.value); if (!v || !f.area_id) return toast(t('area') + ' + ' + t('prices'), true);
      try {
        await saveRec('price_points', { area_id: f.area_id, ptype: f.ptype, kind: f.kind, price_sqft: rateToSqft(v, f.unit, vigha()), furnished: f.furnished === 'yes' ? true : f.furnished === 'no' ? false : null, grade: f.kind === 'market' && f.grade ? f.grade : null, source: f.source, note: f.note || null, source_url: f.source_url || null, observed_on: f.observed_on });
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
  const view = { today: viewToday, map: viewMap, prices: viewPrices, customers: viewCustomers, properties: viewProps, more: viewMore }[S.tab]();
  $('#app').replaceChildren(h('main', { class: 'screen ' + S.tab }, view), tabbar());
  if (S.tab === 'map') initMap();
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
  const cats = ['all', 'realestate', 'infra', 'rules', 'market'];
  const news = S.data.news.filter((n) => S.newsCat === 'all' || n.category === S.newsCat);
  const en = getLang() === 'en';
  return [
    h('header', { class: 'hdr' }, h('div', { class: 'logo' }, mark(30, 8)),
      h('div', { class: 'grow' }, h('h1', {}, t('greeting')), h('div', { class: 'muted small' }, fmtDate(now))),
      h('button', { class: 'iconbtn', 'aria-label': t('settings'), onclick: settings }, icon('gear'))),
    m && h('div', { class: 'grid4' }, [['gold', m.gold_10g, moneyShort], ['silver', m.silver_kg, moneyShort], ['sensex', m.sensex, (x) => Number(x).toLocaleString('en-IN')], ['home_loan', m.home_loan_rate, (x) => x + '%']]
      .map(([k, v, f]) => h('div', { class: 'tile' }, h('div', { class: 'muted xs' }, t(k)), h('div', { class: 'b' }, v == null ? '—' : f(v))))),
    h('section', { class: 'card' },
      h('div', { class: 'between' }, h('h2', {}, t('todo_today')), h('button', { class: 'linkbtn', onclick: () => taskForm({}, render) }, '+ ', t('task'))),
      due.length ? due.map((d) => dueRow(d, render)) : h('div', { class: 'muted small' }, t('no_followups'))),
    h('div', { class: 'rowhd' }, h('h2', {}, t('news'))),
    chips(cats.map((c) => [c, c === 'all' ? t('all') : t('cat_' + c)]), S.newsCat, (c) => { S.newsCat = c; render(); }, 'scroll'),
    news.length ? news.map((n) => h('article', { class: 'card' },
      h('div', { class: 'tag' }, t('cat_' + n.category), ' · ', fmtDate(n.published_on, { day: 'numeric', month: 'short' })),
      h('div', { class: 'title' }, (en ? n.title_en || n.title_gu : n.title_gu || n.title_en) || ''),
      (en ? n.summary_en || n.summary_gu : n.summary_gu || n.summary_en) && h('div', { class: 'small' }, en ? n.summary_en || n.summary_gu : n.summary_gu || n.summary_en),
      h('div', { class: 'between small muted' }, h('span', {}, n.source || ''), n.url && h('a', { href: n.url, target: '_blank', rel: 'noopener' }, t('read_full')))))
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
  const j = stats(a.id, P.ptype, 'jantri'), d = stats(a.id, P.ptype, 'dastavej'), mk = stats(a.id, P.ptype, 'market', P.furnished, P.grade);
  const quotes = [...mk.points, ...d.points, ...j.points].sort((x, y) => String(y.observed_on).localeCompare(String(x.observed_on)));
  const last = quotes.map((p) => p.observed_on).sort().pop();
  const bare = (v) => rate(v, unit).replace('₹ ', '');
  const head = { range: mk.used > 1 && mk.min !== mk.max ? `₹ ${bare(mk.min)} – ${bare(mk.max)}` : rate(mk.median, unit), median: rate(mk.median, unit), mean: rate(mk.mean, unit), low: rate(mk.min, unit), high: rate(mk.max, unit) }[P.stat];
  const line = (label, sub, val, strong) => h('div', { class: 'rate' + (strong ? ' strong' : '') }, h('div', {}, h('div', { class: 'b' }, label), sub && h('div', { class: 'xs ' + (strong ? 'goldtext b' : 'muted') }, sub)), h('div', { class: 'num' }, val));
  const quote = (p, old) => {
    const out = p.kind === 'market' && !old && (p.price_sqft < mk.lo || p.price_sqft > mk.hi);
    return h('div', { class: 'pt' + (out || old ? ' out' : '') },
      h('div', { class: 'between small' }, h('span', { class: 'b' }, rate(p.price_sqft, unit), p.kind !== 'market' ? ` · ${t(p.kind)}` : '', out ? ` (${t('outlier')})` : '', old === 'bad' ? ` (${t('check_quote')})` : old ? ` (${t('old_quote')})` : ''),
        h('span', {}, p.grade && h('span', { class: 'gbadge g-' + p.grade }, t('g_' + p.grade)), ' ', h('span', { class: 'muted' }, fmtDate(p.observed_on, { day: 'numeric', month: 'short', year: '2-digit' })))),
      h('div', { class: 'between xs muted' }, h('span', {}, t('src_' + (p.source || 'other')), p.note ? ' · ' + p.note : ''),
        h('span', {}, p.source_url && h('a', { href: p.source_url, target: '_blank', rel: 'noopener' }, t('link')), ' ', !p.pub && (p.owner || !cloud.ready) && h('button', { class: 'linkbtn xs', onclick: async () => { if (confirm(t('confirm_del'))) { await delRec('price_points', p.id).catch(fail); rd(); } } }, t('del')))));
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
      line(t('market_rate'), mk.median == null ? t('no_price') : [P.stat === 'range' && `${t('median')} ${rate(mk.median, unit)}`, pct(mk.median, j.median) && `${t('vs_jantri')} ${pct(mk.median, j.median)}`, `${mk.used} ${t('prices_found')}`, mk.dropped ? `${mk.dropped} ${t('dropped')}` : null].filter(Boolean).join(' · '), mk.median == null ? '—' : head, true),
      h('div', { class: 'statseg' }, seg([['range', t('range')], ['median', t('median')], ['mean', t('mean')], ['low', t('low')], ['high', t('high')]], P.stat, (v) => { P.stat = v; rd(); })),
      line(t('dastavej'), pct(d.median, j.median) && `${t('vs_jantri')} ${pct(d.median, j.median)}`, rate(d.median, unit)),
      line(t('jantri'), [t('jantri_sub') + ' · ' + t('src_garvi'), j.used > 1 && `${t('median')} ${rate(j.median, unit)} · ${j.used} TP/FP`].filter(Boolean).join(' · '), j.used > 1 && j.min !== j.max ? `₹ ${bare(j.min)} – ${bare(j.max)}` : rate(j.median, unit))),
    h('div', { class: 'grid2' },
      h('button', { class: 'btn green', onclick: () => pricePointForm({ area_id: a.id, ptype: P.ptype, unit }) }, icon('plus', 18), t('add_price')),
      h('button', { class: 'btn', onclick: () => pasteMessage(a.id, P.ptype) }, t('paste_msg'))),
    h('section', { class: 'card' }, h('h2', {}, t('all_quotes'), ' (', quotes.length + mk.old.length + (mk.bad || []).length, ')'),
      h('div', { class: 'xs muted' }, t('quotes_note')),
      quotes.length + mk.old.length + (mk.bad || []).length ? h('div', { class: 'list tight' }, quotes.map((p) => quote(p)), mk.old.map((p) => quote(p, true)), (mk.bad || []).map((p) => quote(p, 'bad'))) : h('div', { class: 'muted small' }, t('no_price'))),
    insightCard(a, mk, unit),
  ];
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
      h('span', {}, p.url && h('a', { href: p.url, target: '_blank', rel: 'noopener' }, t('link')), p.own && h('button', { class: 'linkbtn xs', onclick: async () => { if (confirm(t('confirm_del'))) { await delRec('area_notes', p.own.id).catch(fail); render(); } } }, t('del')))))) : h('div', { class: 'muted small' }, '—'); };
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

// ---------- More ----------
function viewMore() {
  const row = (k, fn) => h('button', { class: 'row big', onclick: fn }, h('span', {}, t(k)), icon('chev', 18));
  return [h('header', { class: 'hdr' }, h('h1', { class: 'grow' }, t('more'))),
    h('section', { class: 'card' }, row('prices', () => go('prices')), row('brokers', () => brokersSheet()), row('commission', commission)),
    h('section', { class: 'card' }, row('emi_calc', emiCalc), row('stamp_calc', stampCalc)),
    h('section', { class: 'card' }, row('settings', settings))];
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
