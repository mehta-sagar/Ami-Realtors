// All prices are stored per square foot and all sizes in square feet. Other units are converted for display.
export const DEFAULT_VIGHA_SQFT = 17424; // changeable in Settings; local vigha sizes differ across Gujarat

export const UNITS = ['sqft', 'sqm', 'var', 'vigha', 'acre', 'hectare'];
// Which units make sense per property type. A flat or a small plot is never priced per vigha or hectare,
// and farm land is never priced per sq ft, so the screen only offers the units a broker would quote in.
export const UNITS_BY_TYPE = {
  flat: ['sqft', 'sqm'], office: ['sqft', 'sqm'], shop: ['sqft', 'sqm'], bungalow: ['sqft', 'sqm', 'var'],
  plot: ['var', 'sqft', 'sqm'], industrial: ['sqm', 'sqft', 'var'], land: ['vigha', 'acre', 'hectare'],
};
export const unitsFor = (ptype) => UNITS_BY_TYPE[ptype] || UNITS;
// Sane band in rupees per sq ft; anything outside is kept out of the averages and shown as "check".
export const BOUNDS = { flat: [500, 30000], bungalow: [500, 40000], shop: [800, 60000], office: [800, 40000], plot: [100, 50000], industrial: [10, 15000], land: [10, 1500] };
export const inBounds = (p) => { const b = BOUNDS[p.ptype]; const v = Number(p.price_sqft); return !b || (v >= b[0] && v <= b[1]); };

export function sqftPer(unit, vighaSqft = DEFAULT_VIGHA_SQFT) {
  return { sqft: 1, sqm: 10.7639, var: 9, vigha: vighaSqft, acre: 43560, hectare: 107639 }[unit] || 1;
}
export const toSqft = (size, unit, v) => Number(size) * sqftPer(unit, v);
export const rateToSqft = (rate, unit, v) => Number(rate) / sqftPer(unit, v);
export const rateFromSqft = (rateSqft, unit, v) => Number(rateSqft) * sqftPer(unit, v);

export const PTYPES = ['flat', 'bungalow', 'shop', 'office', 'plot', 'land', 'industrial'];
export const defaultUnit = (ptype) => (ptype === 'plot' ? 'var' : ptype === 'land' ? 'vigha' : 'sqft');

export function median(xs) {
  const s = xs.slice().sort((a, b) => a - b), n = s.length;
  if (!n) return null;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Median after dropping extreme values (outside 1.5 x IQR). With fewer than 4 prices nothing is dropped.
export function summarize(points) {
  const vals = points.map((p) => Number(p.price_sqft)).filter((x) => x > 0).sort((a, b) => a - b);
  if (!vals.length) return { n: 0, used: 0, dropped: 0, median: null, mean: null, min: null, max: null, lo: null, hi: null };
  let lo = -Infinity, hi = Infinity;
  if (vals.length >= 4) {
    const q1 = quantile(vals, 0.25), q3 = quantile(vals, 0.75), iqr = q3 - q1;
    lo = q1 - 1.5 * iqr; hi = q3 + 1.5 * iqr;
  }
  const kept = vals.filter((x) => x >= lo && x <= hi);
  return { n: vals.length, used: kept.length, dropped: vals.length - kept.length, median: median(kept), mean: kept.reduce((x, y) => x + y, 0) / kept.length, min: kept[0], max: kept[kept.length - 1], lo, hi };
}

export function emi(principal, annualRatePct, years) {
  const n = Math.round(years * 12), r = annualRatePct / 1200;
  if (!principal || !n) return { emi: 0, total: 0, interest: 0 };
  const e = r ? (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1) : principal / n;
  return { emi: e, total: e * n, interest: e * n - principal };
}
