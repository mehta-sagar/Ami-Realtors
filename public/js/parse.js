// Turns a spoken or pasted Gujarati + English sentence into form fields. Rule based, works offline.
import { findAreaInText } from './areas.js';

const GU_DIGITS = '૦૧૨૩૪૫૬૭૮૯';
export const normDigits = (s) => (s || '').replace(/[૦-૯]/g, (d) => GU_DIGITS.indexOf(d));

const NUM = '(\\d+(?:[.,]\\d+)*)';
const num = (s) => parseFloat(String(s).replace(/,/g, ''));

const UNIT_PATTERNS = [
  ['sqft', '(?:sq\\.?\\s*f(?:ee|oo)?t\\.?|sqft|square\\s*f(?:ee|oo)t|ચો\\.?\\s*ફૂ?ટ|ચોરસ\\s*ફૂટ|ફૂટ|ફુટ|feet|foot)'],
  ['sqm', '(?:sq\\.?\\s*m(?:eter|etre|tr)?s?\\.?|sqm|square\\s*met(?:er|re)s?|ચો\\.?\\s*મી\\.?|ચોરસ\\s*મીટર|મીટર)'],
  ['var', '(?:sq\\.?\\s*y(?:ar)?ds?\\.?|vaar|var|waar|war|gaj|yards?|વાર|ગજ)'],
  ['vigha', '(?:vigha|vigho|vigha|bigha|વીઘા|વિઘા|વીઘો|વીઘું|વીઘુ)'],
  ['hectare', '(?:hectares?|હેક્ટર|હેકટર)'],
];
const MULT = [
  [1e7, '(?:crores?|cr\\.?|karod|કરોડ)'],
  [1e5, '(?:lakhs?|lacs?|lac|લાખ|l)'],
  [1e3, '(?:thousand|hajar|hazar|હજાર|k)'],
];
const TYPES = [
  ['flat', /flat|ફ્લેટ|apartment|એપાર્ટમેન્ટ|bhk/i],
  ['bungalow', /bungalow|banglo|બંગલો|બંગ્લો|row\s*house|રો\s*હાઉસ|villa|વિલા|tenament|tenement|ટેનામેન્ટ/i],
  ['shop', /shop|dukan|દુકાન|showroom|શોરૂમ/i],
  ['office', /office|ઓફિસ|ઑફિસ/i],
  ['plot', /plot|પ્લોટ/i],
  ['land', /land|jamin|jameen|જમીન|khetar|ખેતર|ખેતી|farm|ફાર્મ|vadi|વાડી/i],
  ['industrial', /godown|ગોડાઉન|shed|શેડ|industrial|factory|ફેક્ટરી|gidc/i],
];

// Every Indian mobile number in a text (last 10 digits), e.g. "78200 27373 | 97270-68111".
export const allPhones = (raw) => [...new Set([...normDigits(raw || '').matchAll(/(?<!\d)(?:\+?91[\s-]?|0)?([6-9]\d{4}[\s-]?\d{5}|[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4})(?![\d])/g)].map((m) => m[1].replace(/\D/g, '')))];

export function parseEntry(raw) {
  const text = normDigits(raw || '');
  const low = text.toLowerCase();
  const out = {};

  // phone (Indian mobile)
  const ph = text.replace(/[\s-]/g, '').match(/(?:\+?91|0)?([6-9]\d{9})(?!\d)/);
  if (ph) out.phone = ph[1];
  let body = text;
  if (ph) body = body.replace(/(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}/, ' ');

  // bhk
  const bhk = body.match(/(\d)\s*(?:bhk|બીએચકે|bed\s*rooms?|બેડરૂમ)/i);
  if (bhk) { out.bhk = Number(bhk[1]); body = body.replace(bhk[0], ' '); }

  // rate per unit: "5500 per sq ft", "વારના 45000", "45000 no bhav var"
  for (const [u, pat] of UNIT_PATTERNS) {
    let m = body.match(new RegExp(NUM + '\\s*(?:rs\\.?|₹|rupees?|રૂપિયા)?\\s*(?:per|પ્રતિ|\\/|na|no|nu|ના|નો|નું)\\s*' + pat, 'i'))
      || body.match(new RegExp(pat + '\\s*(?:(?:na|no|nu|ના|નો|નું)\\s*(?:bhav|ભાવ|rate)?|bhav|ભાવ|rate)\\s*(?:rs\\.?|₹)?\\s*' + NUM, 'i'));
    if (m) {
      let val = num(m[1]), cut = m[0];
      const rest = body.slice(m.index + m[0].length);
      for (const [mult, mp] of MULT) { const mm = rest.match(new RegExp('^\\s*' + mp + '(?![a-z])', 'i')); if (mm) { val *= mult; cut += mm[0]; break; } }
      if (val >= 100) { out.rate = val; out.rate_unit = u; body = body.replace(cut, ' '); break; }
    }
  }

  // size: "1450 sq ft", "200 var", "5 vigha"
  for (const [u, pat] of UNIT_PATTERNS) {
    const m = body.match(new RegExp(NUM + '\\s*' + pat + '(?![a-z])', 'i'));
    if (m) { out.size = num(m[1]); out.size_unit = u; body = body.replace(m[0], ' '); break; }
  }

  // total price / budget: "85 lakh", "1 crore 20 lakh", "1.2 cr"
  let total = 0, found = false;
  for (const [mult, pat] of MULT) {
    const re = new RegExp(NUM + '\\s*' + pat + '(?![a-z])', 'i');
    const m = body.match(re);
    if (m) { total += num(m[1]) * mult; found = true; body = body.replace(m[0], ' '); }
  }
  if (found) out.price = Math.round(total);
  else {
    const m = body.match(/(?:rs\.?|₹|rupees?|રૂપિયા|price|કિંમત|budget|બજેટ|bhav|ભાવ)\s*:?\s*(\d[\d,]{4,})/i);
    if (m) out.price = num(m[1]);
  }
  if (out.price == null && out.rate == null) {
    const m = body.match(/(?:bhav|ભાવ|rate)\s*:?\s*(\d[\d,]{2,})/i);
    if (m) out.rate = num(m[1]);
  }

  for (const [t, re] of TYPES) if (re.test(low)) { out.ptype = t; break; }

  if (/rent|bhade|bhada|ભાડે|ભાડું|ભાડા|lease|લીઝ/i.test(low)) out.deal = 'rent';
  else if (/vech|વેચ|sell|sale|for sale/i.test(low)) out.deal = 'sale';
  else if (/levo|levi|levu|લેવો|લેવી|લેવું|kharid|ખરીદ|buy|joie|joiye|જોઈએ|જોઇએ|required|requirement/i.test(low)) out.deal = 'buy';

  if (/unfurnish|un-furnish|without\s*furni|ફર્નિચર\s*વગર|furniture\s*vagar|વગર\s*ફર્નિ/i.test(low)) out.furnished = false;
  else if (/furnish|ફર્નિશ|ફર્નિચર\s*સાથે|furniture\s*sathe/i.test(low)) out.furnished = true;

  const area = findAreaInText(text);
  if (area) out.area_id = area.id;

  const nm = text.match(/([A-Za-z઀-૿]{2,})\s*(bhai|ben|ભાઈ|ભાઇ|બેન|બહેન)(?![A-Za-z઀-૿])/i);
  if (nm) out.name = (nm[1] + nm[2]).replace(/\s+/g, '');

  return out;
}

// ---------- Ami listing format: one WhatsApp message that fills every field when pasted ----------
// Lines are "Label: value" (English or Gujarati labels, any order, emojis and *bold* ignored).
// Recognised when it starts with "AMI LISTING" or has at least four known labels.
const CARD_LABELS = {
  deal: /^(deal|for|sale\s*\/\s*rent|સોદો|વેચાણ\s*\/\s*ભાડે)$/,
  ptype: /^(type|property\s*type|પ્રકાર|મિલકત)$/,
  bhk: /^(bhk|bedrooms?|બીએચકે|રૂમ)$/,
  society: /^(society|building|project|apartment|complex|સોસાયટી|બિલ્ડિંગ|પ્રોજેક્ટ|એપાર્ટમેન્ટ)$/,
  tower: /^(tower|wing|block|tower\s*\/\s*wing|ટાવર|વિંગ|બ્લોક)$/,
  unit: /^(flat\s*no\.?|unit\s*no\.?|shop\s*no\.?|office\s*no\.?|house\s*no\.?|plot\s*no\.?|no\.?|ફ્લેટ\s*નં\.?|નંબર|નં\.?)$/,
  floor: /^(floor|માળ)$/,
  area: /^(area|locality|વિસ્તાર|એરિયા)$/,
  address: /^(address|landmark|સરનામું|લેન્ડમાર્ક)$/,
  size: /^(size|super\s*built[\s-]*up|sbu|built[\s-]*up|plot\s*size|land\s*size|સાઇઝ|ક્ષેત્રફળ|માપ)$/,
  carpet: /^(carpet|carpet\s*area|કાર્પેટ)$/,
  price: /^(price|asking|asking\s*price|expected\s*price|કિંમત|ભાવ)$/,
  rent: /^(rent|monthly\s*rent|ભાડું)$/,
  deposit: /^(deposit|ડિપોઝિટ)$/,
  maint: /^(maintenance|મેન્ટેનન્સ)$/,
  facing: /^(facing|ફેસિંગ|દિશા)$/,
  furnished: /^(furnished|furnishing|ફર્નિચર|ફર્નિશ્ડ)$/,
  parking: /^(parking|પાર્કિંગ)$/,
  age: /^(age|building\s*age|ઉંમર|જૂનું)$/,
  possession: /^(possession|status|પઝેશન)$/,
  owner: /^(owner|owner\s*name|name|માલિક|નામ)$/,
  phone: /^(mobile|phone|contact|owner\s*mobile|મોબાઇલ|ફોન|નંબર\s*\(મોબાઇલ\))$/,
  dalal: /^(dalal|broker|દલાલ|બ્રોકર)$/,
  location: /^(location|map|google\s*map|maps|લોકેશન|નકશો)$/,
  notes: /^(notes?|details?|remarks?|વિગત|નોંધ)$/,
  ref: /^(ref|id|listing\s*id)$/,
};
const moneyOf = (s) => {
  const x = normDigits(s || '').replace(/,/g, '');
  let total = 0, hit = false;
  for (const [mult, pat] of [[1e7, '(?:crores?|cr\\.?|karod|કરોડ)'], [1e5, '(?:lakhs?|lacs?|lac|લાખ|l)'], [1e3, '(?:thousand|k|હજાર)']]) {
    const m = x.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*' + pat + '(?![a-z])', 'i')); if (m) { total += parseFloat(m[1]) * mult; hit = true; }
  }
  if (hit) return Math.round(total);
  const m = x.match(/(\d{4,})/); return m ? Number(m[1]) : null;
};
export function parseCard(raw) {
  const text = normDigits(String(raw || '')).replace(/\r/g, '');
  const out = {}; let known = 0;
  for (const line0 of text.split('\n')) {
    const line = line0.replace(/[*_~`]/g, '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
    const m = line.match(/^([^:：=]{1,30}?)\s*[:：=]\s*(.*)$/); if (!m) continue;
    const label = m[1].toLowerCase().replace(/\s+/g, ' ').trim(), val = m[2].trim();
    for (const [k, re] of Object.entries(CARD_LABELS)) if (re.test(label)) { if (val && out[k] == null) out[k] = val; known++; break; }
  }
  if (!/ami\s*listing|અમી\s*લિસ્ટિંગ/i.test(text) && known < 4) return null;
  const r = { raw: String(raw).trim() };
  const low = (s) => String(s || '').toLowerCase();
  if (out.deal) r.deal = /rent|ભાડ|lease|લીઝ/i.test(out.deal) ? 'rent' : 'sale';
  if (out.ptype) for (const [t2, re] of TYPES) if (re.test(low(out.ptype))) { r.ptype = t2; break; }
  if (!r.ptype && (out.bhk || /flat|ફ્લેટ/i.test(text))) r.ptype = 'flat';
  if (out.bhk) { const b = out.bhk.match(/\d/); if (b) r.bhk = Number(b[0]); }
  for (const k of ['society', 'tower', 'unit', 'address', 'facing', 'parking', 'age', 'possession', 'owner', 'notes', 'deposit', 'maint', 'ref']) if (out[k]) r[k] = out[k];
  if (out.floor) { r.floor = out.floor.replace(/\s*(?:of|\/|માંથી)\s*/i, '/').replace(/\s*(?:th|st|nd|rd|floor|માળ)\b/gi, '').trim(); const f = r.floor.match(/-?\d+|ground|g\b|ગ્રાઉન્ડ/i); r.floor_no = f ? (/\d/.test(f[0]) ? Number(f[0]) : 0) : null; const tf = r.floor.match(/\/\s*(\d+)/); if (tf) r.floors_total = Number(tf[1]); }
  const sizeOf = (s) => { const p = parseEntry(s); return p.size ? { size: p.size, unit: p.size_unit } : (s.match(/\d/) ? { size: Number((s.match(/\d+(?:\.\d+)?/) || [])[0]), unit: 'sqft' } : null); };
  if (out.size) { const s = sizeOf(out.size); if (s) { r.size = s.size; r.size_unit = s.unit; } }
  if (out.carpet) { const s = sizeOf(out.carpet); if (s) r.carpet = s.size; if (!r.size && s) { r.size = s.size; r.size_unit = s.unit; } }
  if (out.price) r.price = moneyOf(out.price);
  if (out.rent) r.rent = moneyOf(out.rent);
  if (out.furnished) r.furnished = /un|no|વગર|નથી/i.test(out.furnished) ? false : /semi|સેમી|full|yes|હા|furnished|ફર્નિશ/i.test(out.furnished) ? true : null;
  if (out.phone) { const p = allPhones(out.phone)[0]; if (p) r.phone = p; }
  if (out.dalal) { const p = allPhones(out.dalal)[0]; r.dalal = { name: out.dalal.replace(/[+\d\s-]{8,}/g, ' ').replace(/\s+/g, ' ').trim() || null, phone: p || null }; }
  if (out.location) r.location = out.location;
  const a = findAreaInText([out.area, out.address, out.society].filter(Boolean).join(' ')) || (out.area ? findAreaInText(text) : null);
  if (a) r.area_id = a.id;
  if (out.area) r.area_text = out.area;
  return r;
}
