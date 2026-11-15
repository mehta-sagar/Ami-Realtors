"""Checks public/data/prices.json and removes points that are not trustworthy.

Run: python3 tools/check_prices.py          (report only)
     python3 tools/check_prices.py --fix    (rewrite the file without the bad points)

A point is dropped when its link is a search or list page instead of the page that shows
that exact figure, when a required field is missing, or when its rate per square foot is
outside a sane band for its property type.
"""
import json, re, sys
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "public/data/prices.json"
# Rupees per square foot. Land is agricultural / raw land, so its band is low.
BOUNDS = {"flat": (500, 30000), "bungalow": (500, 40000), "shop": (800, 60000), "office": (800, 40000),
          "plot": (100, 50000), "industrial": (10, 15000), "land": (10, 1500)}
LIST_PAGE = [
    re.compile(r"99acres\.com/(?!.*spid-)(?!property-rates-and-price-trends).*-ffid"),  # 99acres search results
    re.compile(r"realestateindia\.com/[^/]+-property/[^_]*\.htm$"),                   # realestateindia list pages
    re.compile(r"olx\.in/"),
    re.compile(r"magicbricks\.com/property-for-sale/"),
    re.compile(r"housing\.com/in/buy/searches/"),
]
REQUIRED = ["area_id", "ptype", "kind", "price_sqft", "source", "source_url", "observed_on"]

def problems(p):
    out = [f"missing {k}" for k in REQUIRED if p.get(k) in (None, "")]
    # rent quotes are monthly rupees per sq ft (shops/offices ~15-400, flats ~8-60, sheds ~8-60)
    lo, hi = (2, 600) if p.get("kind") == "rent" else BOUNDS.get(p.get("ptype"), (0, 1e9))
    try:
        v = float(p.get("price_sqft"))
        if not lo <= v <= hi:
            out.append(f"rate {v:.0f}/sq ft outside {lo}-{hi} for {p.get('ptype')}")
    except (TypeError, ValueError):
        out.append("rate not a number")
    url = p.get("source_url") or ""
    if p.get("kind") == "market" and any(r.search(url) for r in LIST_PAGE):
        out.append("link is a search/list page, not the page with this figure")
    return out

def reconcile(pts):
    """Cross-check: flag area/type prices that rest on one source, disagree, or sit below jantri/GIDC."""
    from collections import defaultdict
    from statistics import median
    from urllib.parse import urlparse
    g = defaultdict(list)
    for p in pts: g[(p["area_id"], p["ptype"], p["kind"])].append(p)
    for (a, t, k), ps in sorted(g.items()):
        if k != "market": continue
        ps = [p for p in ps if not (t == "industrial" and re.search(r"shed|building|factory|rcc", p.get("note") or "", re.I))]
        if not ps: continue
        m = median(p["price_sqft"] for p in ps)
        hosts = {urlparse(p["source_url"]).netloc for p in ps}
        flags = []
        if len(hosts) < 2: flags.append("SINGLE-SOURCE")
        if max(p["price_sqft"] for p in ps) > 1.6 * min(p["price_sqft"] for p in ps): flags.append("SPLIT")
        for kind, lo in (("jantri", 0.9), ("gidc", 1.0)):
            ref = [p["price_sqft"] for p in g.get((a, t, kind), [])]
            if ref and m < lo * median(ref): flags.append(f"BELOW-{kind.upper()}")
        if flags: print(f"CHECK {a} {t} median {m:.0f}/sqft from {len(ps)} pts: {' '.join(flags)}")

def main():
    data = json.loads(PATH.read_text(encoding="utf-8"))
    keep, bad = [], []
    for p in data:
        pr = problems(p)
        (bad if pr else keep).append((p, pr))
    for p, pr in bad:
        print(f"DROP {p.get('area_id')} {p.get('ptype')} {p.get('price_sqft')}: {'; '.join(pr)}")
    print(f"{len(keep)} ok, {len(bad)} bad")
    reconcile([p for p, _ in keep])
    if "--fix" in sys.argv:
        PATH.write_text(json.dumps([p for p, _ in keep], ensure_ascii=False, indent=1), encoding="utf-8")

if __name__ == "__main__":
    main()
