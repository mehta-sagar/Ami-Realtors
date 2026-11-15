# Ami Realtors: valuation and data-source research (Surat, Gujarat)

Research date: 2026-11-15. Method: WebSearch + WebFetch only (no curl or scripts).

Conventions
- "Opened" means the URL was fetched in this session and the figure comes from that page.
- **UNVERIFIED** means it comes from memory, general practice, or a secondary source that could not be checked against the primary source. Confirm before relying on it.
- **Important access note:** these Gujarat government sites blocked automated fetching (`robots_disallowed`): garvi.gujarat.gov.in, anyror.gujarat.gov.in, gujrera.gujarat.gov.in, revenuedepartment.gujarat.gov.in and stampsregistration.gujarat.gov.in. Their deep-link paths below come from secondary guides and are marked UNVERIFIED. The robots policy is itself a ToS and automation signal: do not scrape these sites from the app.
- The SMC sites (suratmunicipal.gov.in), SUDA (sudaonline.org) and GIDC (gidc.gujarat.gov.in) did allow fetching.

---------------------------------------------------------------------------------------------------

## A. Valuation methods (Indian / Gujarat practice)

### A.0 Jantri (ASR) basics an app must model

- Jantri means the Annual Statement of Rates under s.32A of the Gujarat Stamp Act 1958. It is the floor value for stamp duty, not market value.
  - Source: https://www.latestly.com/agency-news/india-news-gujarat-releases-draft-annual-statement-of-rates-jantri-for-2024-public-input-invited-6432668.html
- History:
  - 2011 Jantri took effect 18-Apr-2011 (housing.com: https://housing.com/news/gujarat-doubles-jantri-rates).
  - A 100% hike was announced 4-Feb-2023. housing.com says it was effective 5-Feb-2023. Other sources say the 2023 rates apply "from 15 Apr 2023" (latestly, above; also https://www.sobha.com/blog/jantri-rate-gujarat-gift-city-gandhinagar/).
  - Practical reading: the 2011 rates ×2, as applied from 15-Apr-2023, are in force. **Verify the exact date on Garvi.**
- Draft Jantri-2024:
  - Published 20/21-Nov-2024. It came from a field survey (Apr–Nov 2023) covering 23,846 urban value zones and 17,131 rural villages. Objections were first due by 20-Dec-2024 (latestly), then extended to 20-Jan-2025.
  - The CM said rates were "expected from April 1" 2025 (https://deshgujarat.com/2025/01/04/dont-fear-from-jantri-rate-will-improve-fsi-base-also-gujarat-cm-to-builders-and-developers/).
  - More than 11,000 objections were received (https://deshgujarat.com/2025/01/22/gujarat-govt-get-over-11000-objections-suggestions-on-draft-jantri-rates).
  - Status: "delayed once again", originally due 1-Apr-2025 (https://www.landeed.com/post/jantri-rates-in-gujarat-latest-updates-and-what-it-means-for-you). Bhatt & Joshi says it had "not been brought into force as of September 2026" (https://bhattandjoshiassociates.com/?p=56884).
  - I found no news of notification up to 2026-11-15. **UNVERIFIED that it is still unimplemented today**: re-check Garvi.
- 2023 multipliers and calculation rules, as summarised by a broker blog (https://cityprop.co.in/blog/jantri-rate-ahmedabad/). Treat as UNVERIFIED until checked against the official GR, `GR_Jantry_2023.PDF` on Garvi.
  - 2023 rate = 2011 zone rate × multiplier: residential flat 1.8, construction cost 1.5, office 1.5, shop and open land 2.0.
  - Carpet to built-up: built-up = 1.2 × carpet.
  - Size bands (built-up): ≤100 m² −10%; 101–200 m² 100%; >200 m² +20%.
  - Floors with lift: 100% on all floors except the top floor at 95%.
  - Parking: covered 10% of zone rate, open 5%. Terrace 40%.
  - Bungalow = land area × open-plot rate + built-up × construction rate × (1 − depreciation). Depreciation is 1.2% per year, capped at 60% (more than 50 years old).
- 2011 guideline items (http://www.swamilawyer.com/2011/04/new-jantri-asr-rates-updates.html):
  - Residential on 3rd floor and above: −10% versus ground to 2nd floor.
  - Commercial cellar: −20%.
  - Depreciation: 1.2% per year (previously 1%).
  - Unfinished or slab-less construction: −20%.
  - Shops with and without frontage have different rates.
- Stamp duty is 4.9% (3.5% basic + 40% surcharge) on the higher of Jantri and consideration. Registration fee is 1%, waived for a sole woman buyer (https://1acre.in/guides/how-to-buy-land-in-gujarat).
  - Short leases under 1 year: fixed duty of ₹500 residential and ₹1,000 commercial from 10-Apr-2025 (https://deshgujarat.com/2025/04/08/gujarat-govt-cuts-jantri-rates-new-stamp-duty-act-provisions-effective-from-april-10/).
- Historical Surat ASR example: the 2006 draft ASR for the SUDA area is hosted on the SMC site (https://www.suratmunicipal.gov.in/Content/Documents/Downloads/GRUDA/SUDA.pdf; SMC area: https://suratmunicipal.org/Content/Documents/Downloads/GRUDA/SMC.pdf).
  - It lists rates per village and zone (₹/m²) for developed land, residential, office and shop. Example, Magdalla zone 41/1: land 8,000; residential 12,000; office 13,200; shop 14,400.
  - It is useful only to show the format: office ≈ 1.1 × residential and shop ≈ 1.2 × residential within a zone.

**App implication:** store the Jantri value per zone with type columns [open land, residential, office, shop, construction] and apply the rule set above. Show "Jantri value" and "Market estimate" separately, because Jantri is a floor value, not market value.

### A.1 Sales comparison with adjustment grid

Formula used by Indian valuers:

```
Adjusted rate_i = Comparable rate_i × Π(1 + adj_ik)      (multiplicative)  or
                  Comparable rate_i × (1 + Σ adj_ik)      (additive; common in bank reports)
Subject rate    = Σ w_i × Adjusted rate_i / Σ w_i,  with w_i ∝ 1 / (gross adjustment_i)
Time adjustment : rate_t = rate_0 × (1 + g)^years     (example used g = 12%/yr)
```

Published percentages I could verify. Most are from Institution of Valuers (IOV) journal articles:

| Factor | Adjustment | Source (opened) |
|---|---|---|
| Road width: 24 m main road vs 9 m internal road | subtract **30–40%** for the 9 m plot | IOV e-journal, D. D. Narsay: https://iovrvfhub.org/media/e_journals/553664_digvijay_d_narsay_2.pdf |
| Corner plot (two-side access) | **+10–15%** (his case study used +5%) | same |
| East/West facing vs N/S | **+5–10%** (case study used factor 0.97–0.99 for non-E/W) | same |
| Bad shape | factor **0.96–0.99** | same |
| Size / proportion | S6 = 1.5 / (1.5 + \|1.5 − L/W\|), e.g. L/W 1.636 gives 0.92 | same |
| Depth (belting method) | front belt 100%; middle belt (1.5 × avg front depth) **66.7%**; rear belt **50%**; recessed land **75%** | IOV e-journal, N. Garg: https://iovrvfhub.org/media/e_journals/679585_naiti_garg_25.pdf |
| Flat floor (Jantri rule, 2023) | top floor 95%; other floors 100% (lift buildings) | cityprop (above), UNVERIFIED vs GR |
| Flat floor (Jantri rule, 2011) | 3rd floor and above −10% | swamilawyer (above) |
| Unit size (Jantri rule, 2023) | ≤100 m² −10%; >200 m² +20% | cityprop, UNVERIFIED |
| Age (Jantri) | −1.2% per year, max −60% | cityprop / swamilawyer |
| Age (SMC property tax, proxy for market) | factor 1.20 (0–10 yr), 1.05 (11–20), 0.90 (21–30), 0.70 (31–40), 0.50 (41–50), 0.40 (51–60), 0.30 (61+) | https://www.suratmunicipal.gov.in/Content/Documents/Departments/PropertyTax/2023-24.pdf |
| Metro proximity (Surat, measured) | 0–0.5 km of station **−0.1 to −1.2%**; 0.5–1.0 km **+2.7 to +4.7%**; 1.0–1.5 km **+1.2 to +2.0%** (VIP Road Jn and Rupali Canal Jn, announcement to pre-construction) | IRJET V8I796: https://www.irjet.net/archives/V8/i7/IRJET-V8I796.pdf |

Suggested default grid for the app. These are **practitioner-style defaults (UNVERIFIED)**, built from the sourced ranges above plus common bank-valuer practice. Make every value editable.

| Factor | Default | Notes |
|---|---|---|
| Road width (plots / bungalows), relative to a 12 m base | 9 m −10%; 12 m 0; 18 m +7%; 24 m +12%; 30 m +18%; 36–45 m +25% | Consistent with the IOV "24 m vs 9 m = 30–40%" gap. Above 36 m, FSI bonuses also apply (A.3) |
| Corner | +10% (range 5–15%) | IOV |
| Frontage-to-depth | apply belting beyond the average front depth | IOV belting |
| Shop: main-road frontage vs inner | +25–50% | UNVERIFIED; Jantri treats frontage separately |
| Shop floor | GF 100%; 1st 60–70%; 2nd 50–60%; basement 50–80% | UNVERIFIED; Jantri cellar is −20% |
| Flat floor | GF to 2nd 0; middle 0 to +3%; top −5% | Jantri 2023 |
| Age / depreciation | straight-line on the building part only (A.4) | — |
| Amenities (club, lift, parking) | ±2–5% each | UNVERIFIED |
| Highway distance (agricultural / NA land) | see A.5 and A.6 | — |
| Title: NA vs agricultural | NA (with sanctioned plan) ≈ agricultural rate + NA cost (premium + conversion tax + infrastructure) + entrepreneur margin | — |
| Title: new tenure (navi sharat) | discount ≈ premium payable (20–50% of Jantri) + delay | A.5 |
| TP status | Final TP or FP allotted: 0; draft TP: −5 to −15% (deduction and FP-shift risk) | UNVERIFIED |

### A.2 Income / rent capitalisation (commercial)

Standard valuation formulas. These are textbook relations, not from one opened source.

```
GRV (gross annual rent)        = monthly rent × 12  (+ escalations if within term)
Vacancy & collection loss      = typically 5–10% (shops in good street 5%, offices 10–15%)        UNVERIFIED
Effective gross income (EGI)   = GRV × (1 − vacancy)
Outgoings (landlord-borne)     = property tax + repairs (≈ 5–10% of GRV) + insurance (0.1–0.3% of
                                  building value) + management (≈ 2–5%) + society/maint if borne
                                  → commonly 15–25% of GRV in Indian valuer practice             UNVERIFIED
NOI (net income)               = EGI − outgoings
Capitalised value (perpetuity) = NOI / cap rate            (YP in perpetuity = 1 / i)
Terminating income, n years    : YP = (1 − (1+i)^−n) / i                (single rate)
Dual-rate YP (leasehold)       : YP = 1 / (i + s / ((1+s)^n − 1))        (s = sinking-fund rate)
Growing rent (escalation e% every k yrs): PV = Σ_t Rent_t / (1+i)^t   (DCF), or approx
                                  cap value ≈ NOI / (i − g),  g = (1+e)^(1/k) − 1
Gross yield = annual rent / price;   Net yield = NOI / (price + acquisition costs 5.9%)
```

Typical Indian lease escalation is 15% every 3 years for offices and 5% per year for retail and warehousing (UNVERIFIED, common market convention).

Published yields and rents:

| Asset | Figure | Source (opened) |
|---|---|---|
| Grade A office, India core CBD | cap rate **7.50–8.40%** (Q1 2026) | CBRE via IANS: https://ianslive.in/india-offers-highest-property-yields-in-asia-pacific-region-in-q1-report--20260521142323 |
| Institutional logistics / warehousing, India | **7.15–7.75%** (Q1 2026) | same |
| Ahmedabad office rent | ₹488/m²/month (≈ ₹45/sqft/month), +3% YoY; vacancy **37.1%** (H1 2026) | Knight Frank: https://content.knightfrank.com/research/3116/documents/en/india-real-estate-office-and-residential-market-h1-2026-12927.pdf |
| Ahmedabad warehousing rent | ₹19.4/sqft/month (H1 2026), +6% YoY; vacancy 12.6% | Knight Frank: https://content.knightfrank.com/research/3131/documents/en/india-warehousing-market-report-h1-2026-12992.pdf |
| Residential gross yield, Ahmedabad | **3.9%** (highest of 13 cities; average 3.62%), Q3 2024 | Magicbricks via Business Standard: https://www.business-standard.com/amp/finance/personal-finance/want-passive-income-ahmedabad-leads-with-highest-rental-yield-of-3-9-124112700201_1.html |
| Residential yields, top cities (no Gujarat city) | 3.2–4.6% in Q2 2026 | Anarock via Business Today: https://www.businesstoday.in/personal-finance/real-estate/story/top-housing-markets-deliver-up-to-125-price-appreciation-rental-yields-rise-by-100-bps-anarock-547053-2026-08-04 |
| Surat | Neither Knight Frank report covers Surat. I found no institutional cap-rate study for Surat | — |

Rough Surat example (derived, UNVERIFIED): Square Yards Adajan shows an average asking price of ₹3,800/sqft and an average 2 BHK rent of ₹18,250/month (https://www.squareyards.com/property-rates/adajan-surat). For a 1,150 sqft super built-up 2 BHK, that is ≈ ₹43.7 L price and ₹2.19 L/year rent, about **5.0% gross**. The page itself says yield data is "unavailable".

Suggested Surat cap-rate defaults (UNVERIFIED; local broker convention, not cited):
- Pre-leased high-street shop (Ghod Dod Rd, VIP Rd, Vesu): gross 6–7.5%
- Office in a strata building (Ring Road, Majura Gate, Vesu, Adajan): gross 7–9%. Vacancy in strata offices is high, so use 10–20% vacancy.
- Textile-market shop (Ring Road / Saroli markets): gross 5–7%
- Warehouse or industrial shed (Sachin, Palsana, Kim, Kadodara, Hazira belt): gross 8–10%; institutional Grade A 7.15–7.75% (CBRE national)
- Residential: gross 2.5–4%; net 2–3%

### A.3 Land residual / development method

```
GDV  = saleable area × sale rate  (+ parking, + commercial podium)
       saleable area ≈ permissible BUA × loading (super/BUA ≈ 1.4–1.7 in Surat super-built-up
       selling; carpet/BUA ≈ 0.75–0.80)                                                UNVERIFIED
Costs = construction (BUA incl. basement/parking × rate) + premium FSI charges
      + approvals/impact fees + professional fees (≈ 5–8%) + marketing (≈ 2–4%)
      + finance (≈ 10–12%/yr on ~50% of cost for project duration) + GST borne
      + developer profit (15–25% of GDV or 20–30% on cost)                               UNVERIFIED
Residual land value = (GDV − Costs) / (1+i)^t        (t = years to land payment recovery)
Premium FSI cost    = premium FSI area (m²) × Jantri (open land, ₹/m²) × charge %
```

FSI under the Gujarat CGDCR 2017, Surat (SMC/SUDA):
- R1 zone, from 1acre's CGDCR Table 6.8 summary (https://1acre.in/fsi-calculator/surat):
  - Base FSI **1.8**; chargeable FSI 0.9, so a maximum of **2.7**.
  - Within 200 m of a **36 m** road: chargeable 1.8, maximum **3.6**.
  - Within 200 m of a **45 m** road: chargeable 2.2, maximum **4.0**.
  - Ring-road residential maximum 4.0; High Speed Rail corridor CBD maximum **5.4**; Kamrej–Palsana corridor maximum 4.0.
  - The page itself is internally inconsistent: verify against the official Part II PDF below.
- Chargeable FSI price:
  - 1acre says **30% of Jantri** after the 13-04-2023 amendment, down from 40%.
  - Propnewstime agrees: R1, R2 and TOZ chargeable FSI cut from 40% to 30% of Jantri; tall buildings cut from 50% to 40%; affordable-housing paid FSI cut by 50% (https://propnewstime.com/getdetailsStories/NzM5/gujarat-government-declares-concessions-for-the-new-jantri-rates).
- TOD / TOZ along the Surat Metro:
  - 1acre says the TOZ mechanism is scoped to AUDA, so it does not apply in Surat. **UNVERIFIED.**
  - CGDCR has a TOZ concept, and Surat Metro Phase 1 is under construction. I found no Surat TOZ notification. Check SMC "Notifications and Circulars": https://www.suratmunicipal.gov.in/Departments/TownDevelopmentNotificationsAndCirculars
- Official CGDCR PDFs (opened listing at https://www.suratmunicipal.gov.in/Departments/TownDevelopmentCGDCR2017VM):
  - Part I: https://www.suratmunicipal.gov.in/Content/Documents/Departments/Towndevelopment/CGDCR2017VM/FN_CGDCR20217_P1.pdf
  - Part II (Planning, with FSI tables): https://www.suratmunicipal.gov.in/Content/Documents/Departments/Towndevelopment/CGDCR2017VM/FN_CGDCR20217_P2.pdf
  - Part III: https://www.suratmunicipal.gov.in/Content/Documents/Departments/Towndevelopment/CGDCR2017VM/FN_CGDCR20217_P3.pdf
  - Variations dated 11-11-2020, 27-05-2021 (tall buildings), 13-09-2022, 13-04-2023 and 05-09-2024. Example: https://www.suratmunicipal.gov.in/Content/Documents/Departments/Towndevelopment/CGDCR2017VM/CGDCR_V_Dated05_09_2024.pdf
  - Note: the 13-04-2023 PDF is a scan with no text layer, so it needs OCR.
  - The CGDCR is also hosted by the state: https://townplanning.gujarat.gov.in/act-legislation/common_gdcr.aspx (linked from SUDA; not opened).

Construction cost, Surat 2025-26:

| Item | Figure | Source (opened) |
|---|---|---|
| Surat, standard-quality residential | **₹2,153/sqft** average (range ₹1,895–2,454); basic ≈ ₹1,679; premium ≈ ₹2,907 (as of 22-May-2026) | https://infralens.in/prices/surat |
| Cement, Surat (50 kg) | OPC53 ₹423, PPC ₹387; Fe500D TMT ≈ ₹59–62/kg | same |
| Gujarat, residential | ₹1,300–1,800 low cost; ₹1,800–2,500 standard; ₹2,500–3,500+ premium (Aug 2025) | https://constructionestimatorindia.com/?p=997 |
| PEB shed / warehouse, India | basic godown ₹1,200–1,900; standard logistics ₹1,850–2,600; high-spec ₹2,600–3,800/sqft; civil works ₹250–500/sqft (Jul 2026) | https://constructionestimatorindia.com/peb-shed-construction-cost-per-sq-ft/ |

High-rise RCC (more than 70 m, with basements) usually costs well above "standard". Use ₹2,800–3,500/sqft of BUA plus basement at ₹2,500–3,000 (UNVERIFIED). GST and approvals are extra.

### A.4 Cost method (depreciated replacement cost) for bungalows and industrial

```
Value = Land (by comparison or Jantri×market ratio)
      + Σ [BUA_j × replacement rate_j × (1 − D_j)]
      + site works (compound wall, paving, borewell, sump, DG, transformer) at depreciated cost
Straight-line: D = (age / life) × (1 − salvage)            salvage ≈ 10%   (UNVERIFIED convention)
Jantri rule:   D = min(1.2% × age, 60%)                    (cityprop; swamilawyer)
Constant %:    V = C × (1 − r)^age
Sinking fund:  D = C(1−s) × ((1+i)^age − 1)/((1+i)^life − 1)
```

- Typical economic lives (UNVERIFIED; common bank and CPWD-style assumptions): RCC framed 60–70 years; load-bearing 50–60; PEB / steel shed 30–40; AC-sheet / temporary shed 15–25. The IOV case studies used a **65-year life** for RCC (Narsay PDF above).
- Industrial: value the land at GIDC allotment or market rate (B.6). Value the structure by DRC using PEB rates (A.3). Value plant and machinery separately.

### A.5 Agricultural land (Gujarat)

How it is valued in practice:
1. **Jantri for agricultural land** is a ₹/m² rate per village and value zone. A rural survey number falls in a village zone, and the rate is set by land class (agricultural / NA / developed); the 7/12 tenure and class decide which applies (https://1acre.in/guides/gujarat/garvi-market-value).
   - Rural rates are tiny compared with market. Example: Olpad and Mangrol villages on the bullet-train route had Jantri "as low as ₹100" per m², with a proposal to raise it to ₹700–1,200 (https://www.deshgujarat.com/2019/08/23/surat-collector-sends-report-to-state-govt-proposing-hike-in-jantri-of-8-villages-on-bullet-train-route/; villages Kushlad, Mulad, Kareli, Kimamali, Ghaludi, Shekhpur, Hathuran, Kuvanda).
2. **Market evidence and acquisition multipliers:**
   - In the Surat POWERGRID line dispute, the Collector awarded **4 × Jantri**. Where Jantri was ₹100 or less, the highest Jantri of nearby villages was used (villages Hathuran, Mahuvej, Kosamba, Kathwada; https://deshgujarat.com/2025/08/31/powergrid-dispute-resolved-farmers-in-surat-to-get-nearly-5-times-higher-compensation).
   - Under RFCTLARR s.26, market value is the highest of Jantri and the average of the upper half of sale deeds in the last 3 years. The rural multiplier is 1–2 and urban is 1. A development deduction of 20–50% applies when small-plot sales are used for a large block (https://bhattandjoshiassociates.com/?p=56884).
   - **Market-to-Jantri ratios for Olpad, Kamrej, Palsana, Choryasi and Bardoli: none published that I could find. UNVERIFIED.** Field reports commonly cite 3–10× for peri-urban agricultural land on the 2023 Jantri. Build a per-village ratio table from the realtor's own deals.
3. **Value drivers to adjust for (UNVERIFIED defaults; tune with local deals):**
   - Highway frontage: NH-48 / NH-53 frontage +40–100% over an interior plot in the same village. Distance decay is about −10% per km for the first 3 km.
   - Road access: no approach road −20–30%; kachha road −10%; pakka road of 9 m or more is the base.
   - Irrigation: canal command (Ukai / Kakrapar right and left bank canals) +10–25%; borewell +5–10%; rain-fed is the base.
   - Soil: black cotton with a good sugarcane / banana track record is the base. Saline or khar land near the coast (Olpad / Choryasi) −20–40%.
   - Inclusion in a SUDA DP zone (residential / industrial) or in a draft TP raises value substantially (NA potential). Agriculture-zone, CRZ or green-belt land is worth much less.
   - Shape and frontage-to-depth: use belting (A.1).
4. **Tenure:**
   - Old tenure (juni sharat) is freely transferable.
   - New tenure (navi sharat) needs Collector permission and a premium to convert to old tenure, "typically 20–50% of Jantri" (https://1acre.in/guides/how-to-buy-land-in-gujarat) or "20–40%" (https://bhattandjoshiassociates.com/na-non-agricultural-permission-in-gujarat-process-timeline-fees-common-rejections-updated-2026/).
   - In April 2023 the premium was cut from 40% to 30% of Jantri for agricultural-to-NA, and from 25% to 20% for "agricultural land conversion" as worded (propnewstime, above).
   - Value of navi-sharat land ≈ old-tenure value − premium − delay and risk discount.
5. **NA conversion costs:**
   - In Nov 2024 the premium on revised NA permissions for previously NA land (where premium was still leviable) was cut from **30% to 10% of prevailing Jantri** (https://english.gujaratsamachar.com/news/gujarat/gujarat-eases-non-agricultural-land-permit-rules-premium-on-jantri-cut-from-30-to-10).
   - A conversion tax per m², set by use (industrial higher), also applies. Rates were not published in the sources opened (UNVERIFIED).
   - Applications go through iORA (https://iora.gujarat.gov.in, per 1acre; not opened). The target is 45–90 days (Bhatt & Joshi).
   - NA is not allowed near irrigation projects, CRZ areas, protected forests, railways or NHs, per 1acre (UNVERIFIED as a blanket rule; it is really setback-based).
6. **Khedut khatedar (farmer-only purchase) rule:**
   - Under the Gujarat Tenancy & Agricultural Lands Act ss.63 and 63AA, only an agriculturist can buy agricultural land. Non-farmers, companies and NRIs cannot, unless the land is NA (https://1acre.in/guides/how-to-buy-land-in-gujarat).
   - Circulars of 13-Sep-2024 limited farmer verification to revenue records from **6-4-1995** onward, plus a self-declaration (https://www.scconline.com/blog/post/2024/09/25/gujarat-farmer-verification-process-streamlined-for-buying-agricultural-land-non-agricultural-use-permission/).
   - Out-of-state farmers may buy subject to verification (1acre).
   - The old "8 km residence" rule was abolished years ago. That is UNVERIFIED in this session: it was not found in the opened sources.
   - App implication: the buyer pool for agricultural land is restricted, which justifies a liquidity discount versus NA land.

### A.6 Hedonic factors: published numbers

| Factor | Number | Source |
|---|---|---|
| Road width 24 m vs 9 m | 30–40% | IOV Narsay (A.1) |
| Corner | +10–15% | IOV Narsay |
| Orientation E/W | +5–10% | IOV Narsay |
| Depth belts | 100 / 66.7 / 50%; recess 75% | IOV Garg |
| Metro distance (Surat, measured) | 0–0.5 km −0.1 to −1.2%; 0.5–1 km +2.7 to +4.7%; 1–1.5 km +1.2 to +2.0% | IRJET V8I796 |
| Metro distance (Ahmedabad) | 0–0.5 km −0.6 to −4.6%; 0.5–1 km +5 to +9.8% | same |
| Proximity to major highways, commercial density, FAR | significant positive land-value drivers (spatial error hedonic model, Thiruvananthapuram); no coefficients on the free page | Binoy, Naseer & Anil Kumar 2022, J. Property Research 39(3): https://ideas.repec.org/a/taf/jpropr/v39y2022i3p268-292.html |
| FSI bonus by road (CGDCR) | 36 m road: max FSI 3.6 vs 2.7 (+33% BUA); 45 m road: 4.0 (+48%) | 1acre / CGDCR (A.3) |
| SMC location zones (property tax) | A 1.5, B 1.3, C 1.1, D 0.9, E 0.7, F 0.5. Each zone splits by road: sub-zone 1 for roads wider than 12 m, sub-zone 2 for 12 m or less | https://www.suratmunicipal.gov.in/Departments/PropertyTaxFAQs and the 2023-24 PDF |
| SMC occupancy factor | non-residential tenant 1.75 × owner | 2023-24 PDF |

Not found (UNVERIFIED; use as tunable defaults):
- NH-48 / NH-53 frontage premium
- TP final vs draft discount
- DGVCL connection
- Water and sewerage
- SMC vs SUDA vs gram panchayat jurisdiction

Suggested defaults:
- Jurisdiction: SMC (within a TP with FP allotted) is the base; SUDA DP area −10 to −25%; gram panchayat outside SUDA −30 to −50%.
- Utilities: no DGVCL connection −3 to −5% (cost and time of a new connection or transformer); no piped water or sewer −5%.

---------------------------------------------------------------------------------------------------

## B. Data sources

Ratings: Access = open / login / captcha / paid. "Robots" means automated fetch was blocked in this session.

### B.1 Jantri (ASR): Garvi

- Portal: https://garvi.gujarat.gov.in/. Robots blocked, so I could not inspect it. The lookup flow per guides (squareyards: https://squareyards.com/blog/how-to-check-gujarat-jantri-rate-online-garvi-gujarat-gov-in; 1acre):
  1. Pick the district on a map.
  2. Pick the taluka, then the village.
  3. Pick the land type and survey number, or the zone.
  4. Click "Show Jantri".
- Page cited by sobha.com (UNVERIFIED path): **https://garvi.gujarat.gov.in/ViewJantri_New.aspx**, described as "Jantri lookup and district-wise PDFs".
- Guideline PDF: **https://garvi.gujarat.gov.in/PDF/GR_Jantry_2023.PDF** (UNVERIFIED path, from sobha.com).
- Revenue Department Jantri page: https://revenuedepartment.gujarat.gov.in/gujarat-jantari (from nobroker; robots blocked).
- Draft Jantri-2024 was published on Garvi with online objections (latestly). The exact URL was not found.
- Per-village PDF: the old ASR (2006/2011) was published as district/ULB PDFs with one page per village and zone (see the SUDA 2006 example in A.0). Whether Garvi still serves per-village PDFs for 2011×2 is **UNVERIFIED**.
- Adajan (Surat City) deep link: **not obtainable** (robots). Adajan is in the Surat City taluka, and its zone is chosen in the form. Do it manually in a browser once and record the zone codes for the realtor's working areas.
- Access: open web form, likely ASP.NET postback and possibly captcha (UNVERIFIED). There is also a "Garvi Gujarat" Android app (nobroker).
- ToS: government site with robots disallow, so **do not scrape**. Recommended: build a small manually maintained `jantri_zones.json` (district / taluka / village / zone → rates by type), entered from screenshots or PDFs.

### B.2 Registered documents / Index-2

- On Garvi there is an "Index2 Details" option. Inputs: SRO, registration year and document number (https://savitarrealty.blogspot.com/2026/05/how-to-get-your-index-2-index-copy.html). There is also a "property search" by survey or TP/FP number.
  - Login and fee status for the view: UNVERIFIED.
  - Certified digitally signed copies go through iORA / Garvi, about ₹300–500 per the blog (UNVERIFIED).
- Index-2 fields: registration number and year; seller and buyer names; property description (survey / TP / FP, area); **market value (Jantri)** and **consideration**; stamp duty paid (same blog). Consideration ÷ area gives real transacted rates, the best comparable data available.
- Coverage: online records from about 1993–2007 were reported missing, with uploads in progress (https://www.propscience.com/stories_detail/1424/prolonged-delays-in-uploading-property-transaction-records-stall-real-estate-deals-in-gujarat; undated article).
- Bulk access: **none official**. Paid aggregators exist:
  - Landeed sells certified Gujarat Index-2 copies per document (https://web.landeed.com/products/gujarat/index-2).
  - Surepass offers a land-record API (https://surepass.io/gujarat-land-record-check-api/; not opened, so pricing is UNVERIFIED).
  - Propstack, Zapkey and IndexTap (CRE Matrix) are mostly Mumbai/Pune/Bengaluru/NCR focused and paid. **Gujarat/Surat free coverage: UNVERIFIED; likely none.**
  - Square Yards publishes registration analyses for "top 8 cities". Whether Surat is included is UNVERIFIED (https://www.squareyards.com/research-reports/fy2025-residential-registrations-rise; not opened).
- Privacy: Index-2 carries personal names. Under the DPDP Act 2023, the government's position is that consent is needed even to scrape public personal data (https://beta3.law.asia/?p=603912). Store only property and price fields, not names.

### B.3 Land records: AnyROR, e-Dhara, iORA, Bhunaksha

- AnyROR: https://anyror.gujarat.gov.in/ (robots blocked). Menu per guides (https://www.citizennest.com/guide/gujarat-anyror-land-record):
  - "View Land Record – Rural":
    - VF-7 Survey No Details (7/12): district, taluka, village, survey number or owner name, CAPTCHA
    - VF-8A Khata Details: owner name or khata number
    - VF-6 Entry Details: entry number
    - 135-D notices
  - "View Land Record – Urban" → Property Card: district, survey office, ward, survey (CS) number, CAPTCHA
- Deep links with parameters: **none exist that I could verify**. The pages are ASP.NET postback forms with captcha. Historically the paths were `/LandRecordRural.aspx` and `/emilkat/GeneralReport_IDB.aspx` (**UNVERIFIED, from memory**).
  - The app should open AnyROR's home page and show the user the district / taluka / village / survey values to enter (a copy-to-clipboard helper).
- Paid API wrappers: Surepass (above) and Landeed (certified 7/12: https://web.landeed.com/products/gujarat/certified-satbara-ror).
- iORA (NA, premium, mutations, property-card services): https://iora.gujarat.gov.in (per 1acre; not opened).
- e-Dhara Kendras at mamlatdar offices issue certified copies offline.
- Village maps: Revenue Department "Village Maps", https://revenuedepartment.gujarat.gov.in/maps (from housing.com: https://housing.com/news/bhu-naksha-gujarat; robots blocked). Steps: district → area → download (PDF/image).
  - Gujarat is not on the national bhunaksha.gov.in platform in the usual way (UNVERIFIED).
- ToS: captcha plus robots, so automation is not permitted. Use manual lookup.

### B.4 GujRERA

- Portal: https://gujrera.gujarat.gov.in/ (robots blocked; Angular single-page app, UNVERIFIED). The government directory entry only gives the base URL (https://www.publicservicesmap.in/schemes/real-estate-project-search--gj-9018?lang=en).
- Registration number format, seen on aurumproptech for a Gandhinagar project (https://www.aurumproptech.in/pulse/rera/gujarat/gandhinagar/tps-09-fp-149-ews-ii/19122):
  - `PR/GJ/GANDHINAGAR/GANDHINAGAR/Others/RAA12173/240823`, i.e. PR/GJ/{DISTRICT}/{TALUKA}/{AUTHORITY}/{ID}/{DDMMYY}
  - Acknowledgement: `PR/GANDHINAGAR/GANDHINAGAR/GUJRERA/230622/014789`
  - Surat projects use `PR/GJ/SURAT/{TALUKA}/{SUDA|SMC|...}/...` (UNVERIFIED by example).
- Project detail URL format and JSON API endpoints: **UNVERIFIED / not found**. No public documented API exists. Third-party aggregators (aurumproptech pulse, Actowiz) re-host the data.
- Recommendation: store the RERA number and link to the GujRERA home page plus search. Do not hard-code SPA hash routes.

### B.5 SMC and SUDA planning data (all opened unless noted)

- SMC Town Planning home: https://www.suratmunicipal.gov.in/Departments/TownPlanningHome
- TP status summary: https://www.suratmunicipal.gov.in/Departments/TownPlanningTPDetails
  - 74 sanctioned final (8,286 ha), 18 sanctioned preliminary (2,422 ha), 49 sanctioned draft (9,455 ha), 5 drafts submitted to government (927 ha). Total 146 schemes, 21,090 ha.
  - Final: https://www.suratmunicipal.gov.in/Departments/TownPlanningSanctionedFinalSchemes (PDF: https://www.suratmunicipal.gov.in/Content/Documents/Departments/FinalSchemes.pdf)
  - Preliminary: https://www.suratmunicipal.gov.in/Departments/TownPlanningPreliminarySchemes (PDF …/PreliminarySchemes.pdf)
  - Draft: https://www.suratmunicipal.gov.in/Departments/TownPlanningDraftSchemes (PDF …/DraftSanctionedSchemes.pdf)
  - Submitted to government: https://www.suratmunicipal.gov.in/Departments/TownPlanningDraftSchemesSubmitToGov (PDF …/DraftSubmittedGovtSchemes.pdf)
  - All: https://www.suratmunicipal.gov.in/Departments/TownPlanningAllTPSchemes; https://www.suratmunicipal.gov.in/Content/Documents/Departments/AllSchemesStatus.pdf
  - Per-scheme F-Form (FP list with OP/FP areas) pattern, seen in search results: `https://www.suratmunicipal.gov.in/Content/Documents/Departments/FinalSchemes/TP13 Adajan/TP13_ADAJAN_FORM.pdf` and `.../FinalSchemes/TP06 PIPLOD/T.P.06(PIPLOD) F-FORM.pdf`. Draft pattern: `.../Draftschemes/TP64 DUMBHAL-MAGOB/TP64(DUMBHAL-MAGOB).pdf`. Filenames are irregular, so scrape the listing page rather than construct names.
  - Development Plans: https://www.suratmunicipal.gov.in/Departments/TownPlanningDevelopmentPlans
- SMC GIS portal: https://gis.suratmunicipal.org/. Layers include zone, ward, TP boundary, building footprint, survey / original / final plot, DEM, and imagery for 2006/2012/2018/2023. Login and registration form; no public REST endpoint found.
- SMC property tax:
  - Online lookup and pay: https://www.suratmunicipal.gov.in/OnlineServices/PropertyTax/Enroll/ (tenement number format such as `01A-01-0001-0-001`)
  - Calculator: https://www.suratmunicipal.gov.in/Departments/PropertyTaxCalculator
  - Rate structure: https://www.suratmunicipal.gov.in/Departments/PropertyTaxStructure
  - Formula: tax = area (m²) × rate (₹12/m² residential, ₹35/m² non-residential) × type × location × age × occupancy factors (2023-24 PDF above).
- SUDA:
  - DP-2035 sanctioned 08-10-2020, corrigendum 09-11-2020. Map sheets are JPGs: https://www.sudaonline.org/development-plans/dp-2035-sheet-dt-08-10-2020-corrigendum-9-11-2020/ (files `https://www.sudaonline.org/wp-content/uploads/2020/11/{INDAX-MAP|BASE-MAP|A..Z|C1..W1}.jpg`, about 47 sheets)
  - DP report: https://www.sudaonline.org/wp-content/uploads/2017/03/SUDA-DP-2035-report-final-22.02.2017.pdf
  - Proposed variation page: https://www.sudaonline.org/development-plans/sanction-dp-2035-proposed-variation/
  - TP schemes:
    - Sanctioned: https://www.sudaonline.org/services/tp-schemes/ (17 sanctioned draft TPs, e.g. TP 35 Kumbharia-Saniya Hemad-Saroli-Devadh, TP 60 Antroli-Chalthan-Vankaneda-Karala, TP 102 Kanad). PDFs at `/wp-content/uploads/{YYYY}/{MM}/...`
    - Published: https://www.sudaonline.org/services/published-tp-scheme/
    - Intention: https://www.sudaonline.org/services/tp-scheme-intention/
  - DP amendment proposals, gazette 21-Feb-2025: Dabholi and Variav recreational-to-residential, and road realignments (https://deshgujarat.com/2025/02/25/gujarat-govt-proposes-to-amend-final-development-plan-of-suda-in-surat/). A 10-06-2025 gazette PDF is at https://www.sudaonline.org/wp-content/uploads/2025/06/1.-10-06-2025_Gazette_Extraordinary_Extra-No.-199_UDUHD_SUDA_us-19.pdf (not opened).
- ToS: public PDFs and JPGs are fine to link. Georeferencing the DP JPGs is possible (manual GCPs).

### B.6 GIDC

- Allotment price tool: https://gidc.gujarat.gov.in/allotmentprice (opened; FY 2026-27, ₹/m²). Surat district:

| Estate | ₹/m² FY 2026-27 |
|---|---|
| Khatodara | 11,950 |
| Katargam | 11,150 |
| Sachin | 8,940 |
| Pandesara | 8,940 |
| Ichchhapore | 8,940 |
| Hajira (as is where is) | 6,490 |
| Apparel Park Sachin (SEZ) | 3,900 |
| Nizar (tentative) | 1,460 |
| Bardoli | 1,320 |
| Olpad | 1,060 |
| Valod (as is where is) | 180 |
| Doswada (as is where is) | 170 |
| Miyawadi / Miyawadi MSME (tentative) | not listed |

  Nearby: Ankleshwar ₹4,740; Navsari ₹1,720; Bilimora ₹1,270. News coverage: https://deshgujarat.com/2026/08/15/gidc-revises-industrial-land-allotment-rates-across-gujarat-for-fy-2026-27/
- GIDC allotment rates are a primary-market price for leasehold plots. Secondary resale in Sachin and Pandesara trades at a large premium (UNVERIFIED; no source found).
- E-auction notices (Surat region), for example: https://gidc.gujarat.gov.in/Document/LinkManagment/E-Auction/advertisement-auction-surat-202511092025030957.pdf (not opened)
- Allotment info: https://gidc.gujarat.gov.in/Pages/Contents/allotment of properties (not opened)

### B.7 Listings and price-trend sources

| Source | What is free | Opened example | ToS stance |
|---|---|---|---|
| Housing.com price trends | Locality average ₹/sqft, range, YoY. Surat average ₹4,558/sqft, +3.73% YoY (2026). Vesu 5,716; Adajan 4,000; Pal 4,519; Bhimrad 5,106 | https://housing.com/price-trends/property-rates-for-buy-in-surat_gujarat-P20drlq24mltepds2 | ToS not opened; **UNVERIFIED**. Indian portals generally prohibit automated extraction |
| Square Yards | Locality asking price and rent. Adajan ₹3,800/sqft; 2 BHK rent ₹18,250 (Sep 2026) | https://www.squareyards.com/property-rates/adajan-surat | not opened; UNVERIFIED |
| 99acres / MagicBricks / NoBroker | Listings and locality trends | 99acres ToS URL attempt failed | Many commercial scrapers exist (Apify etc.), but scraping is legally grey: IT Act s.43 and contract/ToS (https://beta3.law.asia/?p=603912). **Do not scrape; manual reference only** |
| Knight Frank / CBRE / Anarock / JLL | Free PDF reports (Ahmedabad, not Surat) | see A.2 | Free to cite with attribution |

**Recommendation:** the realtor's own closed deals plus Index-2 consideration values are the only defensible comparable dataset. Use portals only as manual sanity checks.

### B.8 OSM / Overpass / Bhuvan / Google

- OSM tags for India (https://wiki.openstreetmap.org/wiki/India/Tags/Highway; opened):
  - NE → `highway=motorway`
  - NH → `highway=trunk`, with `ref=NH48` style. Old numbers go in `ref:old`.
  - SH → `highway=primary`
  - MDR → `highway=secondary`
  - ODR → `highway=tertiary`
  - Village road → `highway=unclassified`
- Overpass usage policy (https://dev.overpass-api.de/overpass-doc/en/preface/commons.html; opened):
  - Limits: about 10,000 requests per day and about 1 GB per day. Default timeout 180 s and 512 MiB.
  - HTTP 429 when slots are exhausted. Do not build a broad-audience app on the public instance.
  - For one realtor, live queries are fine. Better: pre-extract Surat-district trunk and primary roads once into GeoJSON and compute distances client-side (turf.js).
- Example Overpass query for nearest NH / SH within 5 km:

```
[out:json][timeout:25];
way(around:5000,{{lat}},{{lng}})["highway"~"^(motorway|trunk|primary)$"];
out tags geom;
```

  Compute point-to-line distance client-side. Use `ref` (NH48, NH53) to label the road.
  - Road width is rarely tagged in OSM India (`width`, `lanes` sparse), so use TP/DP road widths from SMC/SUDA maps instead.
- OSM data licence: ODbL. Attribution "© OpenStreetMap contributors" is required.
- Bhuvan (ISRO): OGC WMS/WMTS thematic services (https://bhuvan-app1.nrsc.gov.in/thematic/thematic/help/html/web_services.htm; opened). The page gives no endpoint list and says to read the usage policy first. LULC layers are useful as an overlay. Access terms are UNVERIFIED.
- Google Maps URL API (https://developers.google.com/maps/documentation/urls/guide; opened); see C.

---------------------------------------------------------------------------------------------------

## C. Google Maps share links: formats and lat/lng extraction

Formats people paste in WhatsApp:

| # | Format | Example | Coordinates present? |
|---|---|---|---|
| 1 | Short link (current mobile share) | `https://maps.app.goo.gl/AbCdEf123` | No; must follow the redirect |
| 2 | Legacy short link | `https://goo.gl/maps/XyZ` | No; follow the redirect. goo.gl was deprecated, but maps links still redirect (UNVERIFIED for all old links) |
| 3 | Place URL | `https://www.google.com/maps/place/Name/@21.1702,72.8311,17z/data=!3m1!4b1!4m6!3m5!1s0x..:0x..!8m2!3d21.17025!4d72.83112!16s...` | Yes: `!3d{lat}!4d{lng}` is the pin (most authoritative); `@lat,lng,zoom` is the viewport centre |
| 4 | Dropped pin / search | `https://www.google.com/maps?q=21.1702,72.8311` or `https://maps.google.com/?q=21.1702,72.8311` | Yes: `q=` (may also be text) |
| 5 | `ll=` / `sll=` | `https://maps.google.com/?ll=21.17,72.83&z=15` | Yes |
| 6 | API search | `https://www.google.com/maps/search/?api=1&query=21.1702%2C72.8311&query_place_id=ChIJ...` | Yes when query is lat,lng |
| 7 | Directions | `https://www.google.com/maps/dir/?api=1&origin=..&destination=21.17,72.83` or `/maps/dir/A/B/@lat,lng,z/data=...!1d{lng}!2d{lat}` | `destination=`, `daddr=`; in `data`, `!1d{lng}!2d{lat}` is **lng first**; the last pair is the destination |
| 8 | Map display | `https://www.google.com/maps/@?api=1&map_action=map&center=21.17%2C72.83&zoom=15` | `center=` |
| 9 | Street View | `...map_action=pano&viewpoint=lat,lng` | `viewpoint=` |
| 10 | Mobile "copy link" with `?g_st=` | `...&geocode=<base64url protobuf>` | Encoded: tag 0x15 = lat and 0x1D = lng, each a little-endian fixed32 × 1e6 (per https://dev.to/piyaklabs/routing-around-google-maps-in-korea-naver-kakao-deep-links-weird-coordinates-and-ios-clipboard-25mf) |
| 11 | Plus code | `https://plus.codes/7JJQ5RCJ+2V` or `5RCJ+2V Surat` inside `q=` | Full codes decode offline. Short codes (`5RCJ+2V`) need a reference point (Surat centre 21.17, 72.83) via `recoverNearest` in Google's Apache-2.0 open-location-code library (https://github.com/google/open-location-code) |
| 12 | `share.google/...` | new style | Auth-gated; the google-maps-link-parser package does not support it (https://www.pkgstats.com/pkg:google-maps-link-parser) |

The official URL API formats (search, dir, map, pano) and the 2,048-character limit are from https://developers.google.com/maps/documentation/urls/guide.

Extraction order (after URL-decoding):
1. `!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)`, the pin
2. `[?&](?:q|query|destination|daddr|ll|sll|center|viewpoint)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)`
3. `/@(-?\d+\.\d+),(-?\d+\.\d+)`, the viewport
4. `!1d(-?\d+\.\d+)!2d(-?\d+\.\d+)`: **swap** (lng, lat); take the last pair
5. `/place/(-?\d+\.\d+),(-?\d+\.\d+)`
6. Plus-code regex `[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}`
7. `geocode=` protobuf decode

Sanity check: Surat district falls within lat 20.9–21.7 and lng 72.5–73.6.

Short links and CORS:
- A browser `fetch('https://maps.app.goo.gl/..')` from the app's origin cannot read the redirect target. Google's redirector sends no `Access-Control-Allow-Origin` header, and `redirect:'manual'` gives an opaque response with no `Location`. The dev.to author states it outright: "the browser → Google is blocked by CORS", so they resolve server-side.
- The google-maps-link-parser npm package also supports network unfurling only in server and edge runtimes. Browsers get parsing only.
- **A server hop is required.** A Cloudflare Worker is the cheapest option (free tier):

```js
// worker.js  – GET /resolve?u=<short url>
export default { async fetch(req) {
  const u = new URL(req.url).searchParams.get('u') || '';
  const ok = /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com|www\.google\.com\/maps)/.test(u);
  if (!ok) return new Response('bad url', { status: 400 });
  let url = u;
  for (let i = 0; i < 5; i++) {                       // follow hop-by-hop, allow-listed
    const r = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const loc = r.headers.get('location');
    if (!loc) break;
    url = new URL(loc, url).toString();
    if (!/^https:\/\/([a-z]+\.)?google\.[a-z.]+\/|^https:\/\/maps\.app\.goo\.gl\//.test(url)) break;
  }
  return new Response(JSON.stringify({ url }), { headers: {
    'content-type': 'application/json', 'access-control-allow-origin': '*' } });
}};
```

- Use a plain `User-Agent: Mozilla/5.0`. With a full browser user agent, the redirector may serve a JS interstitial instead of a 302 (observed by the gist author: https://gist.github.com/ForceGT/bbb9423e2d23e9639672a390933eb710).
- Older Stack Overflow advice is the same: fetch with redirects disabled, then `decodeURIComponent(Location)` (https://kaweah.freedombox.rocks/kiwix/content/stackoverflow.com_en_all_2023-11/questions/54330631/un-shorten-a-goo-gl-maps-link-to-coordinates).
- If the final URL has only a place name and no coordinates (rare), fall back to asking the user to long-press and drop a pin, or use the Geocoding API (paid key).
- No-server fallback: tell the user to open the short link in the Google Maps app, then "Share → Copy link" from the browser address bar, or long-press the pin to copy the coordinates text.

---------------------------------------------------------------------------------------------------

## D. WhatsApp: multi-recipient sending with an image (free)

| Option | Image? | Multiple recipients? | Limits / notes | Source |
|---|---|---|---|---|
| `wa.me` click-to-chat: `https://wa.me/91XXXXXXXXXX?text=<urlencoded>`, `https://wa.me/?text=...` (no recipient, user picks chats) | **No.** Text and links only | One chat per link. With no number, the user can pick several chats in the forward picker (UNVERIFIED that multi-select is offered on all versions) | Official format; number in international format without + | https://whatsapp.com/faq/iphone/23559013 |
| Web Share API Level 2 `navigator.share({files:[jpg], text})` | **Yes** | User picks WhatsApp, then can select **multiple chats** in WhatsApp's share sheet (forward limit applies, typically 5 chats; UNVERIFIED in this session) | Supported on iOS Safari 14+ and Chromium (Chrome 89+ desktop, Edge 81+ / 93); not Firefox desktop (https://caniuse.com/mdn-api_navigator_share_data_files_parameter). Must be HTTPS and triggered by a user tap; check `navigator.canShare({files})` first (https://web.dev/articles/files/share-files). iOS may drop `text` when files are present; put the caption in the image or send text separately (UNVERIFIED quirk) | caniuse, web.dev |
| WhatsApp iOS Share Extension (what Web Share hands off to) | Yes | — | Up to 30 media items; images up to 16 MB | https://whatsapp.com/faq/iphone/23559013 |
| Broadcast list (WhatsApp / WhatsApp Business app) | Yes | Up to **256 contacts per list**, unlimited lists | Recipients **must have saved your number**. Mobile only (not Web/Desktop). Monthly broadcast caps are being tested in some countries (Meta's example: 30 per month) | https://whatsapp.com/faq/iphone/23782313; https://techcrunch.com/2025/03/18/whatsapp-will-soon-limit-number-of-broadcast-messages-users-and-businesses-can-send/; https://www.qiscus.com/en/blog/whatsapp-broadcast-limit/ |
| Community announcement group | Yes | Up to **2,000 members** per community (100 linked groups; groups up to 1,024 members); only admins post | Members see each other's numbers in some views (privacy concern) | https://getkanal.com/blog/whatsapp-communities-guide |
| WhatsApp Channel | Yes | Unlimited followers, one-way | Followers must opt in; good for a "new listings" feed | (general; UNVERIFIED specifics) |
| WhatsApp Cloud API (Meta) | Yes | Programmatic | Not free for marketing templates (per-message pricing); needs Business verification. Overkill | (UNVERIFIED pricing) |

**Recommendation (easiest free path):**
1. In the app, render the listing card as a JPEG on a canvas, with the caption, price and Maps link printed on the image or in `text`.
2. Add a "Share to WhatsApp" button that calls `navigator.share({ files:[file], text })`. On iPhone Safari, the user picks WhatsApp, then multi-selects chats or groups.
3. Fall back to downloading the image plus a `wa.me/?text=` link on unsupported browsers.
4. For regular blasts to more than 5 people, the realtor should keep **WhatsApp Business broadcast lists** of 256 (clients who saved the number), or a Channel / Community announcement group. Share the generated image into that list from the phone's share sheet.
5. No server and no API cost. Avoid unofficial "bulk sender" tools: they risk an account ban (general WhatsApp policy, UNVERIFIED).

---------------------------------------------------------------------------------------------------

## E. Open items to verify manually (in a normal browser)

1. Garvi: confirm `ViewJantri_New.aspx` and the 2023 GR PDF. Record zone codes and rates for Adajan, Vesu, Pal, Palanpur, Althan, Piplod, Dumas, Bhatar, Katargam and Varachha. Record agricultural-land Jantri for target villages in Olpad, Kamrej, Palsana, Choryasi and Bardoli.
2. Whether the revised Jantri was notified after Sept 2026.
3. Whether SMC/SUDA notified a TOZ for the metro corridor, or HSR-station FSI (TP for the bullet-train station area: https://swarajyamag.com/amp/story/news-brief/surat-unveils-gujarats-first-bullet-train-linked-town-planning-scheme-to-transform-station-zones, not opened).
4. GujRERA project detail URL pattern (inspect the SPA network calls manually) and its ToS.
5. CGDCR Part II Table 6.8 (official FSI by zone) from the SMC PDF.
6. Portal ToS pages (99acres, MagicBricks, Housing, NoBroker, Square Yards): read and archive.
