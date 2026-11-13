// key: [Gujarati, English]
const T = {
  today: ['આજ', 'Today'], map: ['નકશો', 'Map'], prices: ['ભાવ', 'Prices'], inquiries: ['ઇન્ક્વાયરી', 'Inquiries'], properties: ['મિલકત', 'Properties'],
  greeting: ['જય શ્રી કૃષ્ણ', 'Jai Shree Krishna'],
  news: ['આજના સમાચાર', "Today's news"], all: ['બધા', 'All'],
  cat_realestate: ['રિયલ એસ્ટેટ', 'Real estate'], cat_infra: ['ઇન્ફ્રાસ્ટ્રક્ચર', 'Infrastructure'], cat_rules: ['નિયમો', 'Rules'], cat_market: ['બજાર', 'Markets'],
  no_news: ['આજના સમાચાર હજુ આવ્યા નથી. રોજ સવારે 7 વાગ્યે અપડેટ થશે.', 'No news yet. It updates every morning at 7.'],
  read_full: ['આખું વાંચો', 'Read full'],
  gold: ['સોનું (10 ગ્રામ)', 'Gold (10 g)'], silver: ['ચાંદી (કિલો)', 'Silver (kg)'], sensex: ['સેન્સેક્સ', 'Sensex'], home_loan: ['હોમ લોન', 'Home loan'],
  followups_today: ['આજના ફોલો-અપ', "Today's follow-ups"], no_followups: ['આજે કોઈ ફોલો-અપ બાકી નથી', 'No follow-ups due today'],
  due_calls: ['કૉલ બાકી', 'calls due'], new_inq: ['નવી ઇન્ક્વાયરી', 'new inquiries'],
  search_area: ['Search area in English, e.g. Piplod, Ubhrat', 'Search area, e.g. Piplod, Ubhrat'],
  not_found_local: ['આ નામ યાદીમાં નથી. નકશા પર શોધું છું…', 'Not in the list. Looking it up on the map…'],
  not_found: ['200 કિમીમાં આ જગ્યા મળી નથી', 'Place not found within 200 km'],
  jantri: ['જંત્રી', 'Jantri'], dastavej: ['દસ્તાવેજ ભાવ', 'Dastavej rate'], market_rate: ['બજાર ભાવ', 'Market rate'],
  jantri_sub: ['સરકારી દર', 'Government rate'], vs_jantri: ['જંત્રી કરતાં', 'vs jantri'],
  no_price: ['ભાવ નથી', 'No price yet'], range: ['રેન્જ', 'Range'],
  full_detail: ['સંપૂર્ણ વિગત અને સ્ત્રોત', 'Full detail and sources'],
  how_computed: ['આ ભાવ કેવી રીતે નીકળ્યો', 'How this price is worked out'],
  prices_found: ['ભાવ મળ્યા', 'prices found'], median: ['મધ્યક', 'Median'], method: ['સરેરાશની રીત', 'averaging method'], dropped: ['અતિરેક ભાવ બાદ', 'extreme values dropped'],
  sources: ['સ્ત્રોત', 'Sources'], add_price: ['ભાવ ઉમેરો', 'Add a price'], paste_msg: ['વોટ્સએપ મેસેજ પેસ્ટ કરો', 'Paste WhatsApp message'],
  src_own: ['પોતાની એન્ટ્રી', 'Own entry'], src_whatsapp: ['વોટ્સએપ ગ્રુપ', 'WhatsApp group'], src_listing: ['ઓનલાઇન લિસ્ટિંગ', 'Online listing'], src_news: ['સમાચાર', 'News'], src_garvi: ['ગરવી ગુજરાત', 'Garvi Gujarat'], src_other: ['અન્ય', 'Other'],
  outlier: ['અતિરેક', 'extreme'],
  furnished: ['ફર્નિશ્ડ', 'Furnished'], unfurnished: ['ફર્નિચર વગર', 'Unfurnished'], any: ['કોઈ પણ', 'Any'],
  u_sqft: ['ચો.ફૂટ', 'sq ft'], u_sqm: ['ચો.મી.', 'sq m'], u_var: ['વાર', 'var'], u_vigha: ['વીઘા', 'vigha'], u_hectare: ['હેક્ટર', 'hectare'], per: ['પ્રતિ', 'per'],
  flat: ['ફ્લેટ', 'Flat'], bungalow: ['બંગલો', 'Bungalow'], shop: ['દુકાન', 'Shop'], office: ['ઓફિસ', 'Office'], plot: ['પ્લોટ', 'Plot'], land: ['જમીન', 'Land'], industrial: ['ઔદ્યોગિક', 'Industrial'],
  sale: ['વેચાણ', 'Sale'], rent: ['ભાડે', 'Rent'], buy: ['ખરીદી', 'Buy'],
  paste_hint: ['ફોન એપમાંથી નંબર કૉપી કરી અહીં પેસ્ટ કરો', 'Copy the number from the Phone app and paste it here'],
  paste: ['પેસ્ટ', 'Paste'], add: ['ઉમેરો', 'Add'],
  st_new: ['નવી', 'New'], st_visit: ['સાઇટ વિઝિટ', 'Site visit'], st_nego: ['વાટાઘાટ', 'Negotiating'], st_closed: ['પૂર્ણ', 'Closed'], st_lost: ['રદ', 'Lost'],
  call: ['કૉલ', 'Call'], whatsapp: ['વોટ્સએપ', 'WhatsApp'], followup: ['ફોલો-અપ', 'Follow-up'], edit: ['સુધારો', 'Edit'], del: ['કાઢો', 'Delete'],
  matches: ['મિલકત મેળ ખાય છે', 'matching properties'], no_inq: ['હજુ કોઈ ઇન્ક્વાયરી નથી', 'No inquiries yet'],
  name: ['નામ', 'Name'], phone: ['મોબાઇલ નંબર', 'Mobile number'], area: ['વિસ્તાર', 'Area'], budget: ['બજેટ ₹', 'Budget ₹'], notes: ['નોંધ', 'Notes'], status: ['સ્થિતિ', 'Status'],
  save: ['સાચવો', 'Save'], cancel: ['રદ કરો', 'Cancel'], close: ['બંધ', 'Close'],
  new_property: ['નવી મિલકત', 'New property'], nothing_required: ['કોઈ વિગત ફરજિયાત નથી', 'Nothing is compulsory'],
  speak_add: ['બોલીને ઉમેરો', 'Add by speaking'],
  speak_hint: ['નીચેના બોક્સમાં ટેપ કરો, કીબોર્ડનું માઇક દબાવો અને ગુજરાતી-અંગ્રેજી મિક્સ બોલો. દા.ત. "પીપલોદ માં 3 BHK flat, 1450 sq ft, 85 લાખ, Rameshbhai 98xxxxxxxx"', 'Tap the box, press the keyboard mic and speak in Gujarati-English mix. E.g. "Piplod ma 3 BHK flat, 1450 sq ft, 85 lakh, Rameshbhai 98xxxxxxxx"'],
  fill_form: ['ફોર્મ ભરો', 'Fill the form'],
  price: ['કિંમત ₹', 'Price ₹'], size: ['ક્ષેત્રફળ', 'Size'], owner_name: ['માલિકનું નામ', "Owner's name"], owner_phone: ['માલિકનો મોબાઇલ', "Owner's mobile"],
  floor: ['માળ', 'Floor'], facing: ['દિશા', 'Facing'], bhk: ['BHK', 'BHK'], photos: ['ફોટા', 'Photos'], docs: ['દસ્તાવેજ', 'Documents'],
  no_prop: ['હજુ કોઈ મિલકત ઉમેરી નથી', 'No properties added yet'], share_card: ['કાર્ડ શેર કરો', 'Share card'],
  tools: ['સાધનો', 'Tools'], emi_calc: ['EMI ગણતરી', 'EMI calculator'], stamp_calc: ['સ્ટેમ્પ ડ્યુટી ગણતરી', 'Stamp duty calculator'], commission: ['દલાલી હિસાબ', 'Commission tracker'], settings: ['સેટિંગ્સ', 'Settings'],
  loan_amount: ['લોન રકમ ₹', 'Loan amount ₹'], rate_pct: ['વ્યાજ દર %', 'Interest rate %'], years: ['વર્ષ', 'Years'], monthly_emi: ['માસિક હપ્તો', 'Monthly EMI'], total_interest: ['કુલ વ્યાજ', 'Total interest'], total_pay: ['કુલ ચુકવણી', 'Total payment'],
  deal_value: ['દસ્તાવેજ કિંમત ₹', 'Deed value ₹'], jantri_value: ['જંત્રી કિંમત ₹', 'Jantri value ₹'], stamp_pct: ['સ્ટેમ્પ ડ્યુટી %', 'Stamp duty %'], reg_pct: ['નોંધણી ફી %', 'Registration fee %'],
  women_only: ['ફક્ત મહિલા ખરીદનાર (નોંધણી ફી માફ)', 'Women-only buyers (registration fee waived)'],
  taxable: ['ગણતરીની કિંમત (બેમાંથી વધુ)', 'Value used (higher of the two)'], stamp_duty: ['સ્ટેમ્પ ડ્યુટી', 'Stamp duty'], reg_fee: ['નોંધણી ફી', 'Registration fee'], total: ['કુલ', 'Total'],
  stamp_note: ['દર બદલાઈ શકે છે. દસ્તાવેજ પહેલાં ગરવી પોર્ટલ પર ખાતરી કરો.', 'Rates can change. Confirm on the Garvi portal before the deed.'],
  deal_title: ['સોદો', 'Deal'], client: ['ગ્રાહક', 'Client'], date: ['તારીખ', 'Date'], brokerage_due: ['દલાલી લેવાની ₹', 'Brokerage due ₹'], brokerage_recv: ['દલાલી મળી ₹', 'Brokerage received ₹'], pending: ['બાકી', 'Pending'], add_deal: ['સોદો ઉમેરો', 'Add deal'], no_deals: ['હજુ કોઈ સોદો નથી', 'No deals yet'],
  customers: ['ગ્રાહકો', 'Customers'], list: ['યાદી', 'List'], pipeline: ['પાઇપલાઇન', 'Pipeline'], search_customer: ['નામ કે નંબર શોધો', 'Search name or number'],
  st_token: ['ટોકન', 'Token'], st_dastavej: ['દસ્તાવેજ', 'Dastavej'], task: ['કામ', 'Task'], tasks: ['કામ', 'Tasks'], due: ['ક્યારે', 'Due'], todo_today: ['આજના કામ અને ફોલો-અપ', "Today's tasks and follow-ups"],
  history: ['ઇતિહાસ', 'History'], act_call: ['કૉલ', 'Call'], act_whatsapp: ['વોટ્સએપ', 'WhatsApp'], act_note: ['નોંધ', 'Note'], act_visit: ['સાઇટ વિઝિટ', 'Site visit'], act_inquiry: ['ઇન્ક્વાયરી', 'Inquiry'],
  alt_phone: ['બીજો નંબર', 'Other number'], templates: ['વોટ્સએપ મેસેજ', 'WhatsApp messages'], my_template: ['મારો મેસેજ', 'My message'], new_template: ['નવો મેસેજ લખો. નામ માટે {name} વાપરો', 'Write a new message. Use {name} for the name'],
  brokers: ['દલાલો', 'Brokers'], other_brokers: ['સાથી દલાલ', 'Other brokers'], firm: ['પેઢી', 'Firm'], share_pct: ['ભાગ %', 'Share %'],
  mean: ['સરેરાશ', 'Mean'], low: ['નીચો', 'Low'], high: ['ઊંચો', 'High'], all_quotes: ['બધા ભાવ', 'All quotes'], quotes_note: ['છેલ્લા 6 મહિનાના ભાવ ગણતરીમાં લેવાય છે. જૂના ભાવ ઝાંખા દેખાય છે.', 'Quotes from the last 6 months count. Older ones are shown faded.'], old_quote: ['જૂનો', 'old'],
  g_premium: ['પ્રીમિયમ', 'Premium'], g_standard: ['સ્ટાન્ડર્ડ', 'Standard'], g_basic: ['સાદું', 'Basic'], g_none: ['ગ્રેડ નથી', 'No grade'],
  pros_cons: ['ફાયદા અને ગેરફાયદા', 'Pros and cons'], pros: ['ફાયદા', 'Pros'], cons: ['ગેરફાયદા', 'Cons'], own_note: ['પોતાની નોંધ', 'Own note'], share_area: ['વિસ્તારનું કાર્ડ શેર કરો', 'Share area card'],
  tag_metro: ['મેટ્રો', 'Metro'], tag_smc_limit: ['SMC હદ', 'SMC limit'], tag_tp: ['TP સ્કીમ', 'TP scheme'], tag_drainage: ['ડ્રેનેજ', 'Drainage'], tag_water: ['પાણી', 'Water'],
  tv_yes: ['છે', 'Yes'], tv_no: ['નથી', 'No'], tv_planned: ['આયોજનમાં', 'Planned'], tv_construction: ['કામ ચાલુ', 'Under construction'], tv_final: ['ફાઇનલ', 'Final'], tv_draft: ['ડ્રાફ્ટ', 'Draft'], tv_inside: ['અંદર', 'Inside'], tv_outside: ['બહાર', 'Outside'], tv_proposed: ['સૂચિત', 'Proposed'],
  language: ['ભાષા', 'Language'], vigha_size: ['1 વીઘા = કેટલા ચો.ફૂટ', '1 vigha = how many sq ft'], biz_phone: ['કાર્ડ પર છાપવાનો ફોન નંબર', 'Phone number printed on cards'],
  lock: ['એપ લોક', 'App lock'], set_pin: ['PIN સેટ કરો', 'Set PIN'], remove_pin: ['PIN કાઢો', 'Remove PIN'], enable_faceid: ['Face ID ચાલુ કરો', 'Turn on Face ID'], faceid_on: ['Face ID ચાલુ છે', 'Face ID is on'],
  enter_pin: ['PIN નાખો', 'Enter PIN'], wrong_pin: ['ખોટો PIN', 'Wrong PIN'], unlock_faceid: ['Face ID થી ખોલો', 'Unlock with Face ID'], pin_4: ['4 આંકડાનો PIN', '4 digit PIN'],
  cloud: ['ક્લાઉડ સિંક (Supabase)', 'Cloud sync (Supabase)'], cloud_off: ['ડેટા હાલ ફક્ત આ ફોનમાં સચવાય છે', 'Data is saved only on this phone for now'], cloud_on: ['ક્લાઉડ સાથે જોડાયેલ', 'Connected to cloud'],
  sb_url: ['Supabase URL', 'Supabase URL'], sb_key: ['Supabase anon key', 'Supabase anon key'], email: ['ઇમેઇલ', 'Email'], password: ['પાસવર્ડ', 'Password'], sign_in: ['સાઇન ઇન', 'Sign in'], sign_up: ['નવું ખાતું', 'Create account'], sign_out: ['સાઇન આઉટ', 'Sign out'],
  upload_local: ['ફોનનો ડેટા ક્લાઉડમાં મોકલો', 'Upload phone data to cloud'], done: ['થઈ ગયું', 'Done'], saved: ['સચવાયું', 'Saved'], error: ['ભૂલ', 'Error'],
  confirm_del: ['ખરેખર કાઢવું છે?', 'Really delete?'], add_cal: ['કેલેન્ડરમાં ઉમેરો', 'Add to Calendar'],
  kind: ['પ્રકાર', 'Kind'], source: ['સ્ત્રોત', 'Source'], link: ['લિંક', 'Link'], updated: ['અપડેટ', 'Updated'], within_km: ['સુરતથી કિમી', 'km from Surat'],
  type: ['મિલકતનો પ્રકાર', 'Property type'], more: ['વધુ', 'More'], approx: ['આશરે', 'approx.'],
};

let lang = localStorage.getItem('ami.lang') || 'gu';
export const getLang = () => lang;
export function setLang(l) { lang = l; localStorage.setItem('ami.lang', l); document.documentElement.lang = l; }
export const t = (k) => (T[k] ? T[k][lang === 'en' ? 1 : 0] : k);

export function money(n) {
  if (n == null || isNaN(n)) return '—';
  return '₹ ' + Math.round(n).toLocaleString('en-IN');
}
export function moneyShort(n) {
  if (n == null || isNaN(n)) return '—';
  const en = lang === 'en';
  if (n >= 1e7) return '₹ ' + +(n / 1e7).toFixed(2) + (en ? ' Cr' : ' કરોડ');
  if (n >= 1e5) return '₹ ' + +(n / 1e5).toFixed(2) + (en ? ' L' : ' લાખ');
  return money(n);
}
export function fmtDate(d, opts) {
  return new Date(d).toLocaleDateString(lang === 'en' ? 'en-IN' : 'gu-IN', opts || { weekday: 'long', day: 'numeric', month: 'long' });
}
