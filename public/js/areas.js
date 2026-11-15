// Area master list. Coordinates are approximate centre points; correct any pin in Supabase `areas` or here.
// [id, English, Gujarati, district, lat, lng, extra search aliases]
const A = [
  ['piplod', 'Piplod', 'પીપલોદ', 'Surat', 21.158, 72.770, 'piplodh pipload svnit'],
  ['vesu', 'Vesu', 'વેસુ', 'Surat', 21.141, 72.771, 'vesoo'],
  ['adajan', 'Adajan', 'અડાજણ', 'Surat', 21.196, 72.793, 'adajn adajan patiya'],
  ['pal', 'Pal', 'પાલ', 'Surat', 21.196, 72.776, 'pal gam'],
  ['katargam', 'Katargam', 'કતારગામ', 'Surat', 21.229, 72.831, 'katargaam'],
  ['varachha', 'Varachha', 'વરાછા', 'Surat', 21.210, 72.857, 'varacha varachha road'],
  ['mota-varachha', 'Mota Varachha', 'મોટા વરાછા', 'Surat', 21.238, 72.884, 'mota varacha'],
  ['sarthana', 'Sarthana', 'સરથાણા', 'Surat', 21.230, 72.905, 'sarthana jakatnaka'],
  ['city-light', 'City Light', 'સિટી લાઇટ', 'Surat', 21.170, 72.790, 'citylight સિટીલાઇટ'],
  ['athwalines', 'Athwalines', 'અઠવાલાઇન્સ', 'Surat', 21.177, 72.803, 'athwa athwa lines અઠવા'],
  ['ghod-dod-road', 'Ghod Dod Road', 'ઘોડ દોડ રોડ', 'Surat', 21.176, 72.808, 'ghoddod ghod dod'],
  ['althan', 'Althan', 'અલથાણ', 'Surat', 21.149, 72.797, 'althaan'],
  ['bhatar', 'Bhatar', 'ભટાર', 'Surat', 21.165, 72.812, 'bhatar road'],
  ['udhna', 'Udhna', 'ઉધના', 'Surat', 21.170, 72.842, 'udhana'],
  ['pandesara', 'Pandesara', 'પાંડેસરા', 'Surat', 21.146, 72.838, 'pandesra'],
  ['dindoli', 'Dindoli', 'ડીંડોલી', 'Surat', 21.143, 72.874, 'dindoli ડિંડોલી'],
  ['sachin', 'Sachin', 'સચિન', 'Surat', 21.086, 72.881, 'sachin gidc'],
  ['hojiwala', 'Hojiwala (Sachin)', 'હોજીવાલા (સચિન)', 'Surat', 21.073, 72.905, 'hojiwala hoziwala hojiwala industrial estate હોજીવાલા', 1.2],
  ['vip-road-vesu', 'VIP Road (Vesu)', 'વીઆઈપી રોડ (વેસુ)', 'Surat', 21.148, 72.786, 'vip road vip વીઆઈપી'],
  ['maroli', 'Maroli', 'મરોલી', 'Navsari', 21.025, 72.895, 'maroli arasan'],
  ['zadeshwar', 'Zadeshwar (Bharuch)', 'ઝાડેશ્વર (ભરૂચ)', 'Bharuch', 21.722, 73.020, 'zadeshwar jhadeshwar ઝાડેશ્વર'],
  ['kansad', 'Kansad', 'કનસાડ', 'Surat', 21.0784, 72.8732, ''],
  ['bhesan', 'Bhesan', 'ભેસાણ', 'Surat', 21.2197, 72.769, ''],
  ['saroli', 'Saroli', 'સરોલી', 'Surat', 21.189, 72.893, ''],
  ['kosad', 'Kosad', 'કોસાડ', 'Surat', 21.2612, 72.8675, ''],
  ['abrama', 'Abrama', 'અબ્રામા', 'Surat', 21.2451, 72.9101, ''],
  ['valak', 'Valak', 'વાલક', 'Surat', 21.2491, 72.9042, ''],
  ['limbayat', 'Limbayat', 'લિંબાયત', 'Surat', 21.176, 72.8568, ''],
  ['godadara', 'Godadara', 'ગોડાદરા', 'Surat', 21.1755, 72.8722, 'godadra'],
  ['puna', 'Puna', 'પુણા', 'Surat', 21.2024, 72.8766, 'puna gam'],
  ['kapodra', 'Kapodra', 'કાપોદ્રા', 'Surat', 21.2165, 72.8675, ''],
  ['bhimrad', 'Bhimrad', 'ભીમરાડ', 'Surat', 21.143, 72.8048, ''],
  ['amroli', 'Amroli', 'અમરોલી', 'Surat', 21.2354, 72.8447, ''],
  ['utran', 'Utran', 'ઉત્રાણ', 'Surat', 21.2336, 72.8552, ''],
  ['variyav', 'Variyav', 'વરિયાવ', 'Surat', 21.2595, 72.8168, 'variav'],
  ['bhestan', 'Bhestan', 'ભેસ્તાન', 'Surat', 21.1226, 72.863, ''],
  ['parvat', 'Parvat Patiya', 'પર્વત પાટિયા', 'Surat', 21.1796, 72.8662, 'parvat'],
  ['nanpura', 'Nanpura', 'નાનપુરા', 'Surat', 21.1921, 72.8169, ''],
  ['ichchhapor', 'Ichchhapor', 'ઇચ્છાપોર', 'Surat', 21.1946, 72.7327, 'ichhapore ichhapor'],
  ['kadodara', 'Kadodara', 'કડોદરા', 'Surat', 21.1701, 72.9651, ''],
  ['vadod', 'Vadod', 'વડોદ', 'Surat', 21.1277, 72.8348, ''],
  ['ved', 'Ved Road', 'વેડ રોડ', 'Surat', 21.2276, 72.8215, 'ved'],
  ['ugat', 'Ugat', 'ઉગત', 'Surat', 21.2185, 72.7812, ''],
  ['majura', 'Majura Gate', 'મજુરા ગેટ', 'Surat', 21.181, 72.8184, 'majura'],
  ['anjana', 'Anjana', 'અંજના', 'Surat', 21.1828, 72.8448, ''],
  ['magob', 'Magob', 'મગોબ', 'Surat', 21.1902, 72.8686, ''],
  ['dabholi', 'Dabholi', 'ડભોલી', 'Surat', 21.2354, 72.8074, ''],
  ['mahidharpura', 'Mahidharpura', 'મહીધરપુરા', 'Surat', 21.2024, 72.8345, ''],
  ['chalthan', 'Chalthan', 'ચલથાણ', 'Surat', 21.1574, 72.9563, ''],
  ['sayan', 'Sayan', 'સાયણ', 'Surat', 21.3175, 72.89, ''],
  ['kathor', 'Kathor', 'કઠોર', 'Surat', 21.2885, 72.9404, ''],
  ['dandi', 'Dandi', 'દાંડી', 'Navsari', 20.8906, 72.8059, ''],
  ['jalalpore', 'Jalalpore', 'જલાલપોર', 'Navsari', 20.9485, 72.8979, 'jalalpor'],
  ['bamroli', 'Bamroli', 'બમરોલી', 'Surat', 21.1497, 72.8252, ''],
  ['suvali', 'Suvali', 'સુવાલી', 'Surat', 21.1645, 72.62, 'suvali beach'],
  ['kawas', 'Kawas', 'કવાસ', 'Surat', 21.1699, 72.6869, ''],
  ['kharvasa', 'Kharvasa', 'ખરવાસા', 'Surat', 21.1229, 72.903, ''],
  ['niyol', 'Niyol', 'નિયોલ', 'Surat', 21.1603, 72.9032, ''],
  ['vanz', 'Vanz', 'વાંઝ', 'Surat', 21.0921, 72.9035, ''],
  ['kachholi', 'Kachholi', 'કછોલી', 'Navsari', 20.8413, 72.9702, ''],
  ['laskana', 'Laskana', 'લસકાણા', 'Surat', 21.2494, 72.9266, ''],
  ['nana-varachha', 'Nana Varachha', 'નાના વરાછા', 'Surat', 21.2258, 72.889, ''],
  ['umarwada', 'Umarwada', 'ઉમરવાડા', 'Surat', 21.1973, 72.8438, ''],
  ['salabatpura', 'Salabatpura', 'સલાબતપુરા', 'Surat', 21.1917, 72.8326, ''],
  ['gopipura', 'Gopipura', 'ગોપીપુરા', 'Surat', 21.1940, 72.8235, ''],
  ['sagrampura', 'Sagrampura', 'સગરામપુરા', 'Surat', 21.1861, 72.8218, ''],
  ['tadkeshwar', 'Tadkeshwar', 'તડકેશ્વર', 'Surat', 21.3546, 73.0679, ''],
  ['bharthana-vesu', 'Bharthana (Vesu)', 'ભરથાણા (વેસુ)', 'Surat', 21.1422, 72.7922, 'bharthana'],
  ['palanpur', 'Palanpur (Surat)', 'પાલનપુર (સુરત)', 'Surat', 21.2115, 72.7771, 'palanpor palanpur patia'],
  ['singanpor', 'Singanpor', 'સિંગણપોર', 'Surat', 21.2248, 72.8323, 'singanpore'],
  ['chhaprabhatha', 'Chhaprabhatha', 'છાપરાભાઠા', 'Surat', 21.2542, 72.8403, 'chaprabhatha'],
  ['gaviyar', 'Gaviyar', 'ગવિયર', 'Surat', 21.1277, 72.7342, 'gavier'],
  ['lal-darwaja', 'Lal Darwaja', 'લાલ દરવાજા', 'Surat', 21.2017, 72.8399, 'laldarwaja'],
  ['rander', 'Rander', 'રાંદેર', 'Surat', 21.218, 72.795, 'rander road'],
  ['jahangirpura', 'Jahangirpura', 'જહાંગીરપુરા', 'Surat', 21.228, 72.783, 'jahangirpura'],
  ['chowk-bazaar', 'Chowk Bazaar', 'ચોક બજાર', 'Surat', 21.196, 72.819, 'chowk chok bazar ચોક'],
  ['magdalla', 'Magdalla', 'મગદલ્લા', 'Surat', 21.140, 72.745, 'magdala'],
  ['dumas', 'Dumas', 'ડુમસ', 'Surat', 21.085, 72.715, 'dumas road dummas'],
  ['khajod', 'Khajod (DREAM City)', 'ખજોદ (ડ્રીમ સિટી)', 'Surat', 21.118, 72.790, 'dream city diamond bourse ખજોદ ડ્રીમ સિટી'],
  ['hazira', 'Hazira (industrial zone)', 'હજીરા (ઔદ્યોગિક)', 'Surat', 21.113, 72.648, 'hajira', 3],
  ['olpad', 'Olpad', 'ઓલપાડ', 'Surat', 21.337, 72.752, 'olpaad'],
  ['kamrej', 'Kamrej', 'કામરેજ', 'Surat', 21.268, 72.958, 'kamrej char rasta'],
  ['kim', 'Kim', 'કીમ', 'Surat', 21.401, 72.928, 'keem'],
  ['kosamba', 'Kosamba', 'કોસંબા', 'Surat', 21.462, 72.958, ''],
  ['palsana', 'Palsana', 'પલસાણા', 'Surat', 21.085, 72.985, ''],
  ['bardoli', 'Bardoli', 'બારડોલી', 'Surat', 21.122, 73.112, 'bardoli'],
  ['mandvi-surat', 'Mandvi', 'માંડવી', 'Surat', 21.255, 73.305, 'mandavi'],
  ['ubhrat', 'Ubhrat', 'ઉભરાટ', 'Navsari', 21.010, 72.740, 'ubhrat beach ubharat nimlai ઉભરાટ'],
  ['navsari', 'Navsari', 'નવસારી', 'Navsari', 20.947, 72.952, ''],
  ['gandevi', 'Gandevi', 'ગણદેવી', 'Navsari', 20.812, 72.997, ''],
  ['bilimora', 'Bilimora', 'બીલીમોરા', 'Navsari', 20.769, 72.962, 'billimora'],
  ['chikhli', 'Chikhli', 'ચીખલી', 'Navsari', 20.757, 73.064, 'chikhali'],
  ['valsad', 'Valsad', 'વલસાડ', 'Valsad', 20.599, 72.934, 'bulsar'],
  ['vapi', 'Vapi', 'વાપી', 'Valsad', 20.372, 72.905, ''],
  ['vyara', 'Vyara', 'વ્યારા', 'Tapi', 21.110, 73.394, ''],
  ['ankleshwar', 'Ankleshwar', 'અંકલેશ્વર', 'Bharuch', 21.626, 73.015, 'ankleshvar'],
  ['bharuch', 'Bharuch', 'ભરૂચ', 'Bharuch', 21.705, 72.996, 'bharuch broach'],
  // Industrial estates: [id, en, gu, district, lat, lng, aliases, radius km]. They keep their own prices and never mix with homes nearby.
  ['sachin-gidc', 'Sachin GIDC', 'સચિન જીઆઈડીસી', 'Surat', 21.0835, 72.8735, 'sachin gidc sachingidc lajpore gidc', 2.2],
  ['pandesara-gidc', 'Pandesara GIDC', 'પાંડેસરા જીઆઈડીસી', 'Surat', 21.1435, 72.8395, 'pandesara gidc pandesra gidc', 1.2],
  ['udhna-udyognagar', 'Udhna Udyog Nagar', 'ઉધના ઉદ્યોગનગર', 'Surat', 21.1705, 72.8395, 'udyog nagar udyognagar udhna gidc', 0.8],
  ['katargam-gidc', 'Katargam GIDC', 'કતારગામ જીઆઈડીસી', 'Surat', 21.2265, 72.8265, 'katargam gidc', 0.6],
  ['khatodara-gidc', 'Khatodara GIDC', 'ખટોદરા જીઆઈડીસી', 'Surat', 21.1765, 72.8185, 'khatodara gidc khatodra', 0.5],
  ['ichhapore-gidc', 'Ichhapore–Bhatpore GIDC', 'ઇચ્છાપોર-ભાટપોર જીઆઈડીસી', 'Surat', 21.1555, 72.6555, 'ichhapore gidc ichchhapor gidc bhatpore gidc bhatpor', 1.8],
  ['apparel-park-sez', 'Sachin Apparel Park (SEZ)', 'સચિન એપેરલ પાર્ક (SEZ)', 'Surat', 21.0755, 72.8905, 'apparel park sez surat sez', 0.8],
  ['palsana-industrial', 'Palsana Industrial Belt', 'પલસાણા ઔદ્યોગિક પટ્ટો', 'Surat', 21.0855, 72.9755, 'palsana industrial makhinga jolva jolwa', 2.5],
  ['kadodara-industrial', 'Kadodara Industrial', 'કડોદરા ઔદ્યોગિક', 'Surat', 21.1655, 72.9605, 'kadodara industrial', 1.5],
  ['kim-pipodara', 'Kim–Pipodara Industrial', 'કીમ-પીપોદરા ઔદ્યોગિક', 'Surat', 21.3555, 72.9255, 'pipodara palod kim industrial', 2.5],
  ['olpad-gidc', 'Olpad GIDC', 'ઓલપાડ જીઆઈડીસી', 'Surat', 21.3355, 72.7555, 'olpad gidc', 0.8],
  ['bardoli-gidc', 'Bardoli GIDC', 'બારડોલી જીઆઈડીસી', 'Surat', 21.1155, 73.1055, 'bardoli gidc', 0.8],
  ['vapi-gidc', 'Vapi GIDC', 'વાપી જીઆઈડીસી', 'Valsad', 20.3755, 72.9255, 'vapi gidc', 3],
  ['sarigam-gidc', 'Sarigam GIDC', 'સરીગામ જીઆઈડીસી', 'Valsad', 20.2655, 72.7855, 'sarigam gidc', 1.5],
  ['umbergaon-gidc', 'Umbergaon GIDC', 'ઉમરગામ જીઆઈડીસી', 'Valsad', 20.1855, 72.7655, 'umargam gidc umbergaon gidc', 1.5],
  ['valsad-gidc', 'Valsad GIDC', 'વલસાડ જીઆઈડીસી', 'Valsad', 20.6155, 72.9455, 'valsad gidc', 1],
  ['navsari-gidc', 'Navsari GIDC', 'નવસારી જીઆઈડીસી', 'Navsari', 20.9555, 72.9355, 'navsari gidc vijalpore gidc', 1],
  ['bilimora-gidc', 'Bilimora GIDC', 'બીલીમોરા જીઆઈડીસી', 'Navsari', 20.7755, 72.9655, 'bilimora gidc', 0.8],
  ['ankleshwar-gidc', 'Ankleshwar GIDC', 'અંકલેશ્વર જીઆઈડીસી', 'Bharuch', 21.6155, 73.0155, 'ankleshwar gidc', 3],
  ['panoli-gidc', 'Panoli GIDC', 'પાનોલી જીઆઈડીસી', 'Bharuch', 21.5555, 73.0455, 'panoli gidc', 1.5],
  ['jhagadia-gidc', 'Jhagadia GIDC', 'ઝઘડિયા જીઆઈડીસી', 'Bharuch', 21.7055, 73.1355, 'jhagadia gidc', 3],
  ['dahej-pcpir', 'Dahej (GIDC / PCPIR)', 'દહેજ (જીઆઈડીસી)', 'Bharuch', 21.7055, 72.5855, 'dahej gidc dahej sez pcpir', 5],
];

export const SURAT = { lat: 21.1702, lng: 72.8311 };

export const AREAS = A.map(([id, en, gu, district, lat, lng, alias, r]) => ({
  id, en, gu, district, lat, lng, ind: r ? r : 0,
  keys: [en.toLowerCase(), gu, ...aliasList(alias)].filter(Boolean),
}));

function aliasList(s) {
  // aliases are space separated single words, except known multi-word ones we keep whole
  const multi = ['hojiwala industrial estate', 'sachin gidc', 'pandesara gidc', 'pandesra gidc', 'udyog nagar', 'udhna gidc', 'katargam gidc', 'khatodara gidc', 'ichhapore gidc', 'ichchhapor gidc', 'bhatpore gidc', 'hazira gidc', 'hazira industrial', 'apparel park', 'surat sez', 'palsana industrial', 'kadodara industrial', 'kim industrial', 'olpad gidc', 'bardoli gidc', 'vapi gidc', 'sarigam gidc', 'umargam gidc', 'umbergaon gidc', 'valsad gidc', 'navsari gidc', 'vijalpore gidc', 'bilimora gidc', 'ankleshwar gidc', 'panoli gidc', 'jhagadia gidc', 'dahej gidc', 'dahej sez', 'lajpore gidc', 'vip road', 'adajan patiya', 'pal gam', 'varachha road', 'mota varacha', 'sarthana jakatnaka', 'athwa lines', 'ghod dod', 'bhatar road', 'sachin gidc', 'rander road', 'chok bazar', 'dumas road', 'dream city', 'diamond bourse', 'ડ્રીમ સિટી', 'kamrej char rasta', 'ubhrat beach'];
  const out = [];
  let rest = s;
  for (const m of multi) if (rest.includes(m)) { out.push(m); rest = rest.replace(m, ' '); }
  return out.concat(rest.split(/\s+/).filter(Boolean));
}

export const areaById = (id) => AREAS.find((a) => a.id === id);
export const areaName = (a, lang) => (a ? (lang === 'en' ? a.en : a.gu) : '');

export function km(aLat, aLng, bLat, bLng) {
  const R = 6371, d = Math.PI / 180;
  const x = Math.sin(((bLat - aLat) * d) / 2) ** 2 + Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(((bLng - aLng) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Search in English or Gujarati. Returns best matches first.
export function searchAreas(q) {
  q = (q || '').trim().toLowerCase();
  if (!q) return AREAS.slice();
  const scored = [];
  for (const a of AREAS) {
    let best = 0;
    for (const k of a.keys) {
      if (k === q) best = Math.max(best, 3);
      else if (k.startsWith(q)) best = Math.max(best, 2);
      else if (k.includes(q)) best = Math.max(best, 1);
    }
    if (a.district.toLowerCase() === q) best = Math.max(best, 1);
    if (best) scored.push([best, a]);
  }
  return scored.sort((x, y) => y[0] - x[0]).map((x) => x[1]);
}

// Longest area key found inside free text (voice / WhatsApp message).
export function findAreaInText(text) {
  const t = ' ' + (text || '').toLowerCase() + ' ';
  let hit = null, len = 0;
  for (const a of AREAS) for (const k of a.keys) {
    if (k.length < 3) continue;
    const latin = /^[a-z ]+$/.test(k);
    const found = latin ? new RegExp('[^a-z]' + k.replace(/ /g, '\\s*') + '[^a-z]').test(t) : t.includes(k);
    if (found && k.length > len) { hit = a; len = k.length; }
  }
  return hit;
}
