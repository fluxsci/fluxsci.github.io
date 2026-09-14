#!/usr/bin/env python3
"""Additional original, single-axis neuroscience plots from the bundled Allen data.

Run with the project's uv environment: python scripts/advanced/tuning.py --project .
No observations are generated. Curve/surface interpolation and kernel density estimates
are visual guides computed from the measured values; their definitions are recorded in
the inventory. Existing figures, slides, website assets, and earlier plots are untouched.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.stats import gaussian_kde
import fluxplot as fp
from fluxplot import style as fx
from morph_identity import stabilize_morph_references

fx.use_light()
# Keep SVG text editable and topology deterministic for native Data morph.
plt.rcParams["svg.fonttype"] = "none"
plt.rcParams["svg.hashsalt"] = "flux-neural-advanced-tuning-v1"

INK = fx.FLEXOKI["black"]
MUTED = fx.FLEXOKI["base500"]
RULE = fx.FLEXOKI["base150"]
PAPER = fx.FLEXOKI["paper"]
CELL_COLORS = [fx.FLEXOKI[k] for k in ("blue", "cyan", "green", "orange", "purple", "magenta")]
DIR_COLORS = [fx.FLEXOKI[k] for k in ("blue", "cyan", "green", "yellow", "orange", "red", "magenta", "purple")]
CELL_IDS = [517470610, 517470181, 587375741, 517472541, 517470177, 517470480]


class Publisher:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.data = self.root / "data" / "allen"
        self.output = self.root / "plots" / "advanced"
        self.preview = self.root / "exports" / "advanced-previews"
        self.output.mkdir(parents=True, exist_ok=True)
        self.preview.mkdir(parents=True, exist_ok=True)
        self.records = []
        inventory = self.output / "tuning-inventory.json"
        self.previous = {r["id"]: r for r in json.loads(inventory.read_text()).get("plots", [])} if inventory.exists() else {}

    def save(self, fig, name, title, inputs, methods, *, morph_family=None, state=None):
        if len(fig.axes) != 1:
            raise ValueError("Each delivered SVG must contain exactly one matplotlib axis.")
        path = self.output / f"{name}.svg"
        # Matplotlib's set_layout_engine(None) re-reads the global default. Keep the
        # explicit manual single-axis layout through fluxplot's renderer restoration.
        with plt.rc_context({"figure.constrained_layout.use": False}):
            result = fp.save(fig, str(path), force_vectors=True,
                             recipe={"script": str(Path(__file__).resolve()), "params": {},
                                     "inputs": [str(self.data / f) for f in inputs]})
        # FLUXPLOT_ONLY can skip sibling outputs during a per-plot regenerate.
        if result is None or getattr(result, "skipped", False) or not path.exists():
            if name in self.previous:
                self.records.append(self.previous[name])
            plt.close(fig)
            return
        if morph_family:
            stabilize_morph_references(path)
        recipe_path = path.with_suffix(".recipe.json")
        recipe = json.loads(recipe_path.read_text())
        recipe.update(command="uv", cwd="../..",
                      args=["run", "--project", "scripts/advanced", "python",
                            "scripts/advanced/tuning.py", "--project", "."],
                      script={"path": "scripts/advanced/tuning.py"})
        for item in recipe.get("inputs", []):
            item["path"] = "data/allen/" + Path(item["path"]).name
        recipe_path.write_text(json.dumps(recipe, indent=2) + "\n")
        with plt.rc_context({"figure.constrained_layout.use": False}):
            fig.savefig(self.preview / f"{name}.png", dpi=300)
            fig.savefig(self.preview / f"{name}.pdf", metadata={
                "Title": title, "Author": "Flux demonstration project",
                "Subject": "Original visualization of public Allen Institute data",
                "CreationDate": None, "ModDate": None,
            })
        manifest = json.loads(path.with_suffix(".fluxplot.json").read_text())
        self.records.append({
            "id": name, "title": title, "file": f"plots/advanced/{name}.svg",
            "preview": f"exports/advanced-previews/{name}.png",
            "pdf": f"exports/advanced-previews/{name}.pdf",
            "widthIn": float(fig.get_size_inches()[0]), "heightIn": float(fig.get_size_inches()[1]),
            "sources": [f"data/allen/{x}" for x in inputs], "methods": methods,
            "experimentId": 501940850, "morphFamily": morph_family, "state": state,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "series": [s["id"] for s in manifest.get("series", [])],
        })
        plt.close(fig)
        print(path.name, flush=True)


def tuning_landscape(pub, source):
    response = np.asarray(source["mean_response_pct"], float)
    all_ids = list(source["cell_specimen_ids"])
    indices = np.array([all_ids.index(x) for x in CELL_IDS])
    dirs = np.asarray(source["directions_deg"], float)
    freq = np.asarray(source["temporal_frequencies_hz"], float)
    states = [1, 2, 4]
    # One fixed scale per cell across all three frequencies; retain negative responses.
    chosen = response[:, :3, indices]
    scales = np.max(np.abs(chosen), axis=(0, 1))
    x_knots = np.r_[dirs, 360.]
    x_smooth = np.linspace(0., 360., 161)
    offsets = np.arange(6, dtype=float)[::-1]
    for hz in states:
        f = int(np.flatnonzero(freq == hz)[0])
        fig, ax = plt.subplots(figsize=(3.45, 3.25), layout="none")
        fig.subplots_adjust(left=.255, right=.965, bottom=.15, top=.965)
        for row, (cell_id, cell, offset, color) in enumerate(zip(CELL_IDS, indices, offsets, CELL_COLORS)):
            values = response[:, f, cell] / scales[row]
            cyclic = np.r_[values, values[0]]
            smooth = PchipInterpolator(x_knots, cyclic)(x_smooth)
            ax.axhline(offset, color=RULE, linewidth=.45, zorder=0)
            # Separate measured points and interpolated guides are both exact native
            # line/point series with stable cell identities and point ordering.
            fp.line(ax, x_smooth, offset + .7 * smooth, series=f"cell-{cell_id}-guide",
                    color=color, linewidth=1.15, zorder=3)
            fp.scatter(ax, dirs, offset + .7 * values, series=f"cell-{cell_id}-means",
                       s=8, color=color, edgecolor=PAPER, linewidth=.35, zorder=4)
        ax.set_xlim(0, 360)
        ax.set_ylim(-.28, 5.88)
        ax.set_xticks([0, 90, 180, 270, 360])
        ax.set_yticks(offsets, [str(x) for x in CELL_IDS])
        ax.tick_params(axis="y", length=0, pad=5)
        ax.tick_params(axis="x", length=3, width=.65)
        ax.spines["left"].set_visible(False)
        ax.spines["bottom"].set_linewidth(.65)
        ax.set_xlabel("Drift direction (°)")
        ax.set_ylabel("Cell ID · normalized response", labelpad=6)
        pub.save(fig, f"16-tuning-landscape-{hz}hz", "Direction tuning across temporal frequency",
                 ["responses.json"], {
                    "cellSpecimenIds": CELL_IDS,
                    "selection": "Six responsive example cells selected to show varied directional preferences; not a random sample.",
                    "normalization": "Each cell is divided by its own maximum absolute mean over all eight directions and 1, 2, 4 Hz. Values are multiplied by 0.7 and vertically offset by integer cell rows. Negative observations remain negative.",
                    "points": "Eight measured condition means per cell. Their ordering and IDs are constant across states.",
                    "curves": "Shape-preserving piecewise cubic interpolation over direction, with a duplicate 0-degree value at 360 degrees. Lines are visual guides, not fitted tuning models.",
                    "scale": "Each row's baseline-to-peak separation of 0.7 is one normalized response unit. All axes, ticks, positions, and cell colors are fixed across states.",
                 }, morph_family="tuning-temporal-frequency", state={"temporalFrequencyHz": hz})


def raincloud(pub, source):
    trials = json.loads((pub.data / "trials.json").read_text())
    cell_id = 587375741
    cell = trials["cell_specimen_ids"].index(cell_id)
    dirs = np.asarray(source["directions_deg"], float)
    values = []
    trial_ids = []
    for angle in dirs:
        selected = [t for t in trials["trials"] if t["blank_sweep"] == 0
                    and t["temporal_frequency"] == 2 and t["orientation"] == angle]
        values.append(np.asarray([t["responses_pct"][cell] for t in selected], float))
        trial_ids.append([t["trial_index"] for t in selected])
    estimates = [gaussian_kde(v) for v in values]
    # Include three kernel standard deviations beyond each condition's observations,
    # so density tails finish naturally instead of being cut at the last trial.
    lo = min(v.min() - 3*np.sqrt(k.covariance[0, 0]) for v, k in zip(values, estimates))
    hi = max(v.max() + 3*np.sqrt(k.covariance[0, 0]) for v, k in zip(values, estimates))
    x = np.linspace(lo, hi, 220)
    fig, ax = plt.subplots(figsize=(3.5, 3.3), layout="none")
    fig.subplots_adjust(left=.16, right=.965, bottom=.145, top=.975)
    rng = np.random.default_rng(1717)
    interval_records = []
    for j, (angle, raw, color) in enumerate(zip(dirs, values, DIR_COLORS)):
        y = 7 - j
        density = estimates[j](x)
        density = .48 * density / density.max()
        # Density shapes are named parts; the observations are separate point series.
        poly = ax.fill_between(x, y+.035, y+.035+density,
                               color=color, alpha=.31, linewidth=0)
        fp.tag(poly, role="x-trial-density", series=f"direction-{int(angle)}-density")
        fp.line(ax, x, y+.035+density, series=f"direction-{int(angle)}-density-outline",
                color=color, linewidth=.7)
        # Deterministic rug-like staggering; x positions remain the raw observations.
        order = np.argsort(raw, kind="stable")
        strip = np.empty(len(raw))
        strip[order] = y - .105 - .095 * (np.arange(len(raw)) % 3)
        fp.scatter(ax, raw, strip, series=f"direction-{int(angle)}-trials",
                   s=6.5, color=color, alpha=.74, edgecolor=PAPER, linewidth=.25, zorder=3)
        boot = rng.choice(raw, size=(10000, len(raw)), replace=True).mean(axis=1)
        ci = np.quantile(boot, [.025, .975])
        mean = float(raw.mean())
        fp.line(ax, ci, [y, y], series=f"direction-{int(angle)}-mean-ci",
                color=INK, linewidth=1.2, zorder=4)
        fp.scatter(ax, [mean], [y], series=f"direction-{int(angle)}-mean",
                   s=15, marker="o", facecolor=PAPER, edgecolor=INK, linewidth=.6, zorder=5)
        interval_records.append({"directionDeg": float(angle), "n": len(raw), "meanPct": mean,
                                 "bootstrap95CI": [float(v) for v in ci], "trialIndices": trial_ids[j]})
    ax.axvline(0, color=RULE, linewidth=.75, zorder=0)
    ax.set_ylim(-.5, 7.67)
    ax.set_yticks(np.arange(8)[::-1], [str(int(x)) for x in dirs])
    ax.set_xticks([0, 50, 100, 150, 200])
    # Fixed scientific ticks that are actually inside the observed plotting range.
    ax.set_xticks([t for t in ax.get_xticks() if x[0] <= t <= x[-1]])
    ax.set_xlim(x[0], x[-1])
    ax.tick_params(axis="y", length=0)
    ax.tick_params(axis="x", length=3, width=.65)
    ax.spines["left"].set_visible(False)
    ax.spines["bottom"].set_linewidth(.65)
    ax.set_xlabel("Trial response, ΔF/F (%)")
    ax.set_ylabel("Drift direction (°)")
    pub.save(fig, "17-trial-response-raincloud", "Trial response distributions by drift direction",
             ["trials.json", "responses.json"], {
                "cellSpecimenId": cell_id, "temporalFrequencyHz": 2,
                "selection": "Example cell selected for a clear measured response to opposing drift directions.",
                "points": "Every available nonblank trial in each plotted condition; no response clipping or removal.",
                "density": "Gaussian kernel density estimate with scipy's default Scott bandwidth, each half-density normalized to equal visual height. Density outlines are guides, not new observations.",
                "summary": "Open circles are arithmetic means; horizontal whiskers are percentile 95% bootstrap intervals from 10,000 resamples within each direction (seed 1717). Intervals describe this single cell's sampled trials; no population or between-animal inference is made.",
                "intervals": interval_records,
             })


def response_surface(pub, source):
    cell_id = 517470181
    cell = source["cell_specimen_ids"].index(cell_id)
    means = np.asarray(source["mean_response_pct"], float)[:, :, cell]
    dirs = np.asarray(source["directions_deg"], float)
    freq = np.asarray(source["temporal_frequencies_hz"], float)
    # Interpolate in log2 temporal-frequency spacing, with no extrapolation. PCHIP
    # retains the measured knots and avoids the overshoot of a high-order spline.
    x = np.linspace(0, 360, 65)
    y = np.linspace(0, np.log2(15), 33)
    periodic = np.concatenate([means, means[:1]], axis=0)
    along_direction = PchipInterpolator(np.r_[dirs, 360], periodic, axis=0)(x)
    z = PchipInterpolator(np.log2(freq), along_direction, axis=1)(y).T
    X, Y = np.meshgrid(x, y)
    fig = plt.figure(figsize=(3.5, 3.35), layout="none")
    ax = fig.add_subplot(111, projection="3d", computed_zorder=False)
    fig.subplots_adjust(left=.015, right=.85, bottom=.11, top=.97)
    # Uniform material + geometric shading: hue does not claim an extra measurement.
    surface = ax.plot_surface(X, Y, z, rcount=33, ccount=65, color=fx.FLEXOKI["cyan"],
                              edgecolor="none", linewidth=0, alpha=.83, shade=True,
                              lightsource=LightSource(azdeg=315, altdeg=52), zorder=2)
    fp.tag(surface, role="x-response-surface", series=f"cell-{cell_id}-interpolated-surface")
    # The measured 5 × 8 knots form explicitly named point/mesh objects. The
    # separate 360-degree repeat closes the guide, not an additional observation.
    for j, hz in enumerate(freq):
        artist, = ax.plot(np.r_[dirs, 360], np.full(9, np.log2(hz)), periodic[:, j],
                          color=fx.FLEXOKI["cyan"], linewidth=.6, alpha=.95, zorder=3)
        fp.tag(artist, role="x-measured-frequency-slice", series=f"frequency-{hz:g}hz")
    D, F = np.meshgrid(dirs, np.log2(freq), indexing="ij")
    points = ax.scatter(D.ravel(), F.ravel(), means.ravel(), s=6.5,
                        color=INK, edgecolor=PAPER, linewidth=.25, depthshade=False, zorder=4)
    fp.tag(points, role="x-measured-condition-knots", series=f"cell-{cell_id}-condition-means")
    ax.set_xlim(0, 360)
    ax.set_ylim(0, np.log2(15))
    ax.set_zlim(-20, 160)
    ax.set_xticks([0, 90, 180, 270, 360])
    ax.set_yticks(np.log2(freq), [f"{f:g}" for f in freq])
    ax.set_zticks([0, 50, 100, 150])
    ax.set_xlabel("Drift direction (°)", labelpad=1)
    ax.set_ylabel("Temporal frequency (Hz)", labelpad=1)
    ax.set_zlabel("Mean ΔF/F (%)", labelpad=1)
    ax.tick_params(axis="both", labelsize=5, pad=0, length=2, width=.5)
    ax.view_init(elev=29, azim=-55)
    ax.set_box_aspect((1.6, 1.05, 1.0), zoom=.95)
    for axis in (ax.xaxis, ax.yaxis, ax.zaxis):
        axis.pane.fill = False
        axis.pane.set_edgecolor(RULE)
        axis.line.set_color(MUTED)
        axis.line.set_linewidth(.6)
        axis._axinfo["grid"].update(color=RULE, linewidth=.35)
    pub.save(fig, "18-joint-tuning-surface", "Joint direction and temporal-frequency tuning",
             ["responses.json"], {
                 "cellSpecimenId": cell_id,
                 "points": "All 40 observed means: eight directions × five temporal frequencies. Black dots are the measured conditions; no synthetic observations or omitted conditions.",
                 "surface": "Shape-preserving piecewise cubic interpolation first across direction, then across log2 temporal frequency. Direction 360 repeats direction 0 for visual closure. The interpolated surface is a visual guide, not a fitted biological model or evidence for unmeasured responses.",
                 "shading": "Uniform cyan material with geometric illumination only. Z height carries the response value; color is not an independent variable.",
                 "selection": "One responsive example cell selected to show a structured joint-tuning landscape.",
             })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[2])
    args = parser.parse_args()
    pub = Publisher(args.project)
    source = json.loads((pub.data / "responses.json").read_text())
    tuning_landscape(pub, source)
    raincloud(pub, source)
    response_surface(pub, source)
    (pub.output / "tuning-inventory.json").write_text(json.dumps({
        "generator": "scripts/advanced/tuning.py", "plots": pub.records,
        "attribution": "Allen Institute. Public Allen Brain Observatory Visual Coding experiment 501940850. Source terms and checksums: data/README.md and data/allen/provenance.json.",
        "originality": "All plot compositions and explanatory wording authored for this demonstration; no published research-paper images or prose are used.",
    }, indent=2) + "\n")


if __name__ == "__main__":
    main()
