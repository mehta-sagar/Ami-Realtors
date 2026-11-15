// Valuation methods used by registered valuers and banks, each shown separately so Dad can see why a number
// comes out the way it does. All rates are ₹ per sq ft unless stated. Default percentages are practitioner
// defaults (Institution of Valuers articles, CGDCR 2017, SMC property-tax factors); every one is editable.
// Sources for each default are listed in tools/research_2026-11.md.

// ---------- 1. Sales comparison: adjust the area's market rate for this exact plot ----------
// Road width relative to a 12 m road (IOV: 24 m vs 9 m road = 30-40% for plots).
const ROAD_PLOT = [[6, -0.18], [7.5, -0.14], [9, -0.10], [12, 0], [18, 0.07], [24, 0.12], [30, 0.18], [36, 0.25], [45, 0.30], [60, 0.32]];
const interp = (tab, x) => {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return tab[tab.length - 1][1];
};
// How strongly each property type reacts to the plot's own features (a flat in a tower cares less about the gate road).
const SENS = { plot: 1, land: 1, bungalow: 0.8, shop: 1.4, office: 0.6, industrial: 0.9, flat: 0.35 };
export const DEFAULT_INPUTS = {
  road_m: null, corner: false, highway_frontage: false, hw_km: null, rail_km: null, metro_km: null,
  electricity: 'yes', water: 'yes', sewer: 'yes', authority: 'smc', tp: 'final', tenure: 'old', na: 'na',
  irrigation: 'rainfed', soil: 'normal', access: 'pakka', floor: '', age: '', shop_front: 'main',
};
export function adjustments(ptype, inp) {
  const k = SENS[ptype] ?? 0.5, out = [];
  const add = (key, pct, note) => { if (pct && Math.abs(pct) >= 0.005) out.push({ key, pct, note }); };
  if (inp.road_m) add('adj_road', interp(ROAD_PLOT, inp.road_m) * k, `${Math.round(inp.road_m)} m`);
  if (inp.corner && ['plot', 'bungalow', 'shop', 'land', 'industrial'].includes(ptype)) add('adj_corner', ptype === 'shop' ? 0.15 : 0.10);
  // Highways: frontage is a big premium for land, plots, shops, sheds; a little distance helps access.
  const hw = inp.hw_km;
  if (inp.highway_frontage) add('adj_hw_front', { land: 0.6, plot: 0.3, industrial: 0.25, shop: 0.3, office: 0.1, bungalow: -0.05, flat: -0.03 }[ptype] ?? 0.1, '');
  else if (hw != null) {
    if (['land', 'plot', 'industrial'].includes(ptype)) add('adj_hw_dist', hw <= 1 ? 0.15 : hw <= 3 ? 0.15 - (hw - 1) * 0.06 : hw <= 8 ? 0.03 - (hw - 3) * 0.02 : -0.08, `${hw.toFixed(1)} km`);
    else if (hw <= 0.25 && ['flat', 'bungalow'].includes(ptype)) add('adj_hw_noise', -0.03, `${Math.round(hw * 1000)} m`);
  }
  // Metro (Surat study, IRJET V8I796): just beside a station slightly lower, 0.5–1 km about +3–5%.
  if (inp.metro_km != null && ['flat', 'office', 'shop', 'bungalow'].includes(ptype)) add('adj_metro', inp.metro_km < 0.5 ? -0.005 : inp.metro_km <= 1 ? 0.04 : inp.metro_km <= 1.5 ? 0.016 : 0, `${inp.metro_km.toFixed(1)} km`);
  // Services
  if (inp.electricity === 'no') add('adj_elec', ptype === 'land' ? -0.05 : ptype === 'industrial' ? -0.12 : -0.05);
  if (inp.water === 'no') add('adj_water', ptype === 'land' ? 0 : -0.05);
  if (inp.sewer === 'no') add('adj_sewer', ['land', 'industrial'].includes(ptype) ? 0 : -0.05);
  // Who governs it: SMC with a final TP is the base. SUDA DP area and gram panchayat are cheaper.
  if (inp.authority === 'suda') add('adj_suda', -0.12 * Math.max(0.5, k));
  if (inp.authority === 'gp') add('adj_gp', -0.30 * Math.max(0.5, k));
  if (inp.tp === 'draft') add('adj_tp_draft', -0.08 * Math.max(0.5, k));
  if (inp.tp === 'none' && ptype !== 'land') add('adj_tp_none', -0.15 * Math.max(0.5, k));
  if (ptype === 'shop') add('adj_shop_front', inp.shop_front === 'inner' ? -0.30 : inp.shop_front === 'upper' ? -0.40 : 0);
  if (ptype === 'flat' && inp.floor !== '' && inp.floor != null) { const f = +inp.floor; add('adj_floor', f === 0 ? -0.03 : f >= 15 ? 0.03 : 0, String(f)); }
  if (inp.age !== '' && inp.age != null && ['flat', 'bungalow', 'office', 'shop', 'industrial'].includes(ptype)) {
    // Market rates in our data are mostly for new/resale-young stock; older buildings lose value on the structure part.
    const a = +inp.age, share = ptype === 'flat' || ptype === 'office' ? 0.45 : 0.35;
    add('adj_age', -Math.min(0.6, a * 0.012) * share + (a <= 3 ? 0.02 : 0), `${a} yr`);
  }
  const total = out.reduce((m, x) => m * (1 + x.pct), 1) - 1;
  return { list: out, total };
}

// ---------- 2. Income (rent capitalisation) for shops, offices, sheds, rented flats ----------
// Surat defaults (gross yields, local convention; CBRE Q1 2026 India: offices 7.5-8.4%, warehousing 7.15-7.75%).
export const CAP = { shop: 6.5, office: 7.5, industrial: 8.5, flat: 3.5, bungalow: 3.0, plot: 0, land: 0 };
export const VACANCY = { shop: 5, office: 12, industrial: 8, flat: 5, bungalow: 5 };
export const OUTGO = { shop: 15, office: 20, industrial: 12, flat: 20, bungalow: 20 };
export function incomeValue({ rent, cap, vacancy, outgo, years, sink = 4, growth = 0 }) {
  if (!rent || !cap) return null;
  const gross = rent * 12, egi = gross * (1 - vacancy / 100), noi = egi * (1 - outgo / 100), i = cap / 100;
  // In perpetuity, or for a lease of `years` (dual-rate YP with a sinking fund), or growing rent (i − g).
  const ypPerp = 1 / i;
  const yp = years ? 1 / (i + (sink / 100) / ((1 + sink / 100) ** years - 1)) : growth && growth / 100 < i ? 1 / (i - growth / 100) : ypPerp;
  return { gross, egi, noi, yp, value: noi * yp, grossYield: null, grm: null };
}
// Rent a property should fetch, from the area's sale rate and the usual yield (for the reverse check).
export const rentFromValue = (value, ptype) => (CAP[ptype] ? value * (CAP[ptype] / 100) / 12 : null);

// ---------- 3. Land residual (what a builder can pay for a plot) ----------
// GDV − construction − premium FSI − fees − profit = what the land is worth to a developer.
export function residualLand({ plotSqft, fsi, saleRate, buildCost = 2150, superFactor = 1.45, premFsi = 0, jantriSqft = 0, profit = 20, fees = 8, finance = 6 }) {
  if (!plotSqft || !fsi || !saleRate) return null;
  const bua = plotSqft * fsi, saleable = bua * superFactor, gdv = saleable * saleRate;
  const cons = bua * buildCost * 1.15; // +15% for parking/basement, common areas
  const premium = plotSqft * premFsi * jantriSqft * 0.30; // chargeable FSI at 30% of jantri (CGDCR 2023)
  const softs = cons * fees / 100, fin = (cons + premium) * finance / 100, prof = gdv * profit / 100;
  const land = gdv - cons - premium - softs - fin - prof;
  return { bua, saleable, gdv, cons, premium, softs, fin, prof, land, perSqft: land / plotSqft };
}
// CGDCR 2017 R1 zone: base FSI 1.8, max 2.7; 36 m road 3.6; 45 m road 4.0 (verify per TP).
export const fsiFor = (road_m) => (road_m >= 45 ? { base: 1.8, max: 4.0 } : road_m >= 36 ? { base: 1.8, max: 3.6 } : { base: 1.8, max: 2.7 });

// ---------- 4. Cost method (bungalows, sheds): land + depreciated building ----------
export function costValue({ landSqft, landRate, buaSqft, buildRate, age, life = 60 }) {
  if (!landSqft || !landRate) return null;
  const dep = Math.min(0.9, (age || 0) / life * 0.9), bld = (buaSqft || 0) * (buildRate || 0) * (1 - dep);
  return { land: landSqft * landRate, building: bld, dep, value: landSqft * landRate + bld };
}

// ---------- 5. Agricultural land ----------
// Market = village jantri × local multiple, adjusted for highway, road access, irrigation, soil, tenure, NA potential.
export function agriValue({ jantriSqm, multiple = 5, inp, marketSqft }) {
  const adj = [];
  const add = (key, pct, note) => { if (pct) adj.push({ key, pct, note }); };
  if (inp.highway_frontage) add('adj_hw_front', 0.6);
  else if (inp.hw_km != null) add('adj_hw_dist', inp.hw_km <= 1 ? 0.25 : inp.hw_km <= 3 ? 0.25 - (inp.hw_km - 1) * 0.1 : inp.hw_km <= 10 ? 0.05 - (inp.hw_km - 3) * 0.02 : -0.12, `${inp.hw_km.toFixed(1)} km`);
  add('adj_access', inp.access === 'none' ? -0.25 : inp.access === 'kachha' ? -0.10 : 0);
  add('adj_irrig', inp.irrigation === 'canal' ? 0.18 : inp.irrigation === 'bore' ? 0.07 : 0);
  add('adj_soil', inp.soil === 'khar' ? -0.30 : 0);
  if (inp.na === 'na') add('adj_na', 0.35);
  else if (inp.na === 'zone') add('adj_na_zone', 0.20);
  const mult = adj.reduce((m, x) => m * (1 + x.pct), 1);
  // New tenure (navi sharat): buyer must pay ~30% of jantri premium to convert (20-50% range) and waits.
  const SQM = 10.7639;
  const base = jantriSqm ? (jantriSqm / SQM) * multiple : marketSqft || null;
  if (!base) return null;
  let value = base * mult;
  const premium = inp.tenure === 'new' && jantriSqm ? (jantriSqm / SQM) * 0.30 : 0;
  if (premium) { value -= premium; adj.push({ key: 'adj_new_tenure', abs: -premium }); }
  if (inp.tenure === 'new') { value *= 0.92; adj.push({ key: 'adj_tenure_delay', pct: -0.08 }); }
  return { base, value, adj, multiple, fromJantri: !!jantriSqm };
}

// ---------- reconciliation ----------
export function reconcile(parts) {
  const ok = parts.filter((p) => p && p.value > 0 && isFinite(p.value));
  if (!ok.length) return null;
  const w = ok.reduce((s, p) => s + p.w, 0), v = ok.reduce((s, p) => s + p.value * p.w, 0) / w;
  const lo = Math.min(...ok.map((p) => p.value)), hi = Math.max(...ok.map((p) => p.value));
  return { value: v, lo: Math.min(lo, v * 0.9), hi: Math.max(hi, v * 1.1), n: ok.length };
}
