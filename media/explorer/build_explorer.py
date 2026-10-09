"""Prepare the website part explorer from a fluxplot bundle: a scoped inline-safe SVG and a
compact JSON description of the parts tree (ids, roles, labels, statistics)."""
import json, re, sys, html
src = sys.argv[1]            # directory holding explorer-fluxbox.svg + .fluxplot.json
site = sys.argv[2]           # website root
svg = open(f"{src}/explorer-fluxbox.svg").read()
m = json.load(open(f"{src}/explorer-fluxbox.fluxplot.json"))
# Scale with the page: keep the viewBox, drop the pt size; scope matplotlib's global style rule.
svg = re.sub(r'\swidth="[\d.]+pt"\sheight="[\d.]+pt"', '', svg, count=1)
svg = svg.replace('<style type="text/css">*{stroke-linejoin: round; stroke-linecap: butt}</style>', '')
svg = re.sub(r'<\?xml[^>]*\?>\s*', '', svg)
svg = svg.replace('<svg ', '<svg role="img" aria-label="A fluxbox plot of three conditions. Hover or use the parts list to inspect each named part." ', 1)
open(f"{site}/site/assets/media/docs/explorer-fluxbox.svg", "w").write(svg)
# Compact data: the parts tree as emitted, plus the facts a reader may ask about.
series = {}
for s in m["series"]:
    fb = s.get("fluxbox", {})
    series[s["id"]] = {
        "label": s.get("label") or s["name"], "color": s["color"]["hex"],
        "n": fb.get("n"), "mean": fb.get("mean"), "median": fb.get("median"), "q1": fb.get("q1"), "q3": fb.get("q3"),
        "iqr": fb.get("iqr"), "whiskerLow": fb.get("whiskerLow"), "whiskerHigh": fb.get("whiskerHigh"),
        "points": [{"id": p["svgId"], "y": p["y"]} for p in s.get("points", [])],
    }
axes = {}
for a in m["axes"]:
    for which in ("x", "y"):
        ax = a[which]
        axes[which] = {"label": ax.get("label"), "scale": ax.get("scale"), "domain": ax.get("domain"), "ticks": ax.get("ticks")}
data = {"plotType": m["plotType"], "generator": m["generator"], "parts": m["parts"], "series": series, "axes": axes}
text = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
open(f"{src}/explorer-data.json", "w").write(text)
print("svg", len(svg), "data", len(text))
