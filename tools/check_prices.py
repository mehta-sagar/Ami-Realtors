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
          "plot": (100, 50000), "industrial": (100, 15000), "land": (10, 1500)}
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
    lo, hi = BOUNDS.get(p.get("ptype"), (0, 1e9))
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

def main():
    data = json.loads(PATH.read_text(encoding="utf-8"))
    keep, bad = [], []
    for p in data:
        pr = problems(p)
        (bad if pr else keep).append((p, pr))
    for p, pr in bad:
        print(f"DROP {p.get('area_id')} {p.get('ptype')} {p.get('price_sqft')}: {'; '.join(pr)}")
    print(f"{len(keep)} ok, {len(bad)} bad")
    if "--fix" in sys.argv:
        PATH.write_text(json.dumps([p for p, _ in keep], ensure_ascii=False, indent=1), encoding="utf-8")

if __name__ == "__main__":
    main()
