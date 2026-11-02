"""Illustrative plots for the website guides, drawn with fluxplot (run inside the fluxplot checkout):
    uv run python media/docs-plots/make_docs_plots.py <outdir>
All values are synthetic and the pages say so. growth.* is the tutorial's plot, saved with its
manifest and recipe so the app screenshots can show a fluxplot >= 0.4 plot reflowing."""
import os, sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import fluxplot as fp
from fluxplot import style as fx

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

# 1. The tutorial plot from "Your first project" (illustrative values), saved with a recipe.
def growth():
    fx.use_paper()
    time = [0, 4, 8, 12, 16, 20, 24]
    control = [0.02, 0.05, 0.13, 0.41, 0.95, 1.60, 1.90]
    treatment = [0.02, 0.07, 0.25, 0.80, 1.50, 1.95, 2.10]
    fig, ax = plt.subplots(figsize=(4.8, 3.2))
    fp.line(ax, time, control, series="control", marker="o", label="Control")
    fp.line(ax, time, treatment, series="treatment", marker="s", label="Treatment")
    ax.set(xlabel="Time (h)", ylabel="Illustrative response")
    ax.set_title("Synthetic growth profiles")
    ax.legend(frameon=False)
    fig.tight_layout()
    fp.save(fig, os.path.join(OUT, "growth.svg"))
    plt.close(fig)

rng = np.random.default_rng(7)
def paired_table():
    rows = {"subject": [], "condition": [], "response": []}
    base = rng.normal(0, 0.18, 10)
    for c, mu in (("Baseline", 1.0), ("Treated", 1.45)):
        for i in range(10):
            rows["subject"].append(f"s{i+1:02d}")
            rows["condition"].append(c)
            rows["response"].append(round(float(mu + base[i] + rng.normal(0, 0.09)), 3))
    return rows

# 2. Meanmark beside fluxbox: the same paired table, the same lanes and colours.
def meanmark_vs_fluxbox():
    fx.use_paper()
    rows = paired_table()
    fig, (a, b) = plt.subplots(1, 2, figsize=(6.4, 2.9), sharey=True)
    fp.meanmark(rows, x="condition", y="response", units="subject", ax=a)
    fp.fluxbox(rows, x="condition", y="response", units="subject", ax=b)
    a.set_title("meanmark"); b.set_title("fluxbox")
    a.set_ylabel("Response (a.u.)"); b.set_ylabel("")
    for ax in (a, b): ax.set_xlabel("")
    fig.tight_layout()
    fp.save(fig, os.path.join(OUT, "meanmark-vs-fluxbox.svg"), recipe=False)
    plt.close(fig)

# 3. Three groups with stacked significance brackets from reporting rows.
def meanmark_brackets():
    fx.use_paper()
    groups = {"Control": rng.normal(1.0, 0.16, 12), "Low dose": rng.normal(1.35, 0.16, 12), "High dose": rng.normal(1.9, 0.2, 12)}
    rows_tbl = {"group": [], "value": []}
    for g, v in groups.items():
        rows_tbl["group"] += [g] * len(v); rows_tbl["value"] += [float(x) for x in v]
    fig, ax = plt.subplots(figsize=(3.6, 3.0))
    mm = fp.meanmark(rows_tbl, x="group", y="value", ax=ax)
    rows = fp.stats.pairwise(fp.stats.welch_hedges, groups)
    mm.brackets(rows)
    ax.set_xlabel(""); ax.set_ylabel("Response (a.u.)")
    fig.tight_layout()
    fp.save(fig, os.path.join(OUT, "meanmark-brackets.svg"), recipe=False)
    plt.close(fig)

# 4. The same meanmark on the paper theme and on the dark theme.
def meanmark_themes():
    rows = paired_table()
    for name, use in (("meanmark-paper", fx.use_paper), ("meanmark-dark", fx.use_dark)):
        use()
        fig, ax = plt.subplots(figsize=(3.2, 2.6))
        fp.meanmark(rows, x="condition", y="response", units="subject", ax=ax)
        ax.set_xlabel(""); ax.set_ylabel("Response (a.u.)")
        fig.tight_layout()
        fp.save(fig, os.path.join(OUT, f"{name}.svg"), recipe=False)
        plt.close(fig)

growth(); meanmark_vs_fluxbox(); meanmark_brackets(); meanmark_themes()
print(sorted(os.listdir(OUT)))
