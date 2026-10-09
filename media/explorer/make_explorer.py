"""Synthetic fluxbox for the website part explorer (site/assets/media/docs/explorer-fluxbox.svg).
All values are made up. Run inside the fluxplot checkout: uv run python media/explorer/make_explorer.py <outdir>"""
import json, os, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import fluxplot as fp
from fluxplot import style as fx

OUT = sys.argv[1]
fx.use_light()
rng = np.random.default_rng(11)
conditions = ["Control", "Low dose", "High dose"]
centres = [1.0, 1.55, 2.4]
rows = {"subject": [], "condition": [], "response": []}
for c, mu in zip(conditions, centres):
    for i in range(1, 9):
        rows["subject"].append(f"s{i}")
        rows["condition"].append(c)
        rows["response"].append(round(float(mu + rng.normal(0, 0.28)), 3))
fig, ax = plt.subplots(figsize=(3.1, 2.4))
fb = fp.fluxbox(rows, x="condition", y="response", ax=ax)
ax.set_xlabel("Condition")
ax.set_ylabel("Response (a.u.)")
fp.save(fig, os.path.join(OUT, "explorer-fluxbox.svg"), recipe=False)
print({c: (round(s["median"], 2), round(s["mean"], 2)) for c, s in fb.stats.items()})
