#!/usr/bin/env python3
"""Three original population-level plot families from the bundled Allen measurements.

Run from the project root with:
    uv run --project scripts/advanced python scripts/advanced/population.py

No observations are simulated. The common bases, cell ordering, transformations and
source hashes are saved alongside the semantic SVGs. Nothing in fig/, slides/, the
manuscript, or the public website is written by this script.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import colors as mcolors
from matplotlib.collections import PolyCollection
from matplotlib.lines import Line2D
from matplotlib.patches import Rectangle
from mpl_toolkits.mplot3d.art3d import Line3DCollection
import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.stats import gaussian_kde

import fluxplot as fp
from fluxplot import style as fx
from morph_identity import stabilize_morph_references

# House style is the source of typography, paper, axes and categorical colors.
# Ordering the house hues around the color wheel encodes *circular* direction.
fx.use_light()
DIRECTION_COLORS = [fx.FLEXOKI[k] for k in
                    ("blue", "cyan", "green", "yellow", "orange", "red", "magenta", "purple")]
INK = fx.FLEXOKI["black"]
MUTED = fx.FLEXOKI["base700"]
LIGHT = fx.FLEXOKI["base150"]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def orient_basis(vectors):
    """Remove arbitrary SVD sign flips; make each largest loading positive."""
    vectors = vectors.copy()
    for row in vectors:
        row *= 1 if row[np.argmax(np.abs(row))] >= 0 else -1
    return vectors


class Publisher:
    def __init__(self, project: Path):
        self.project = project
        self.data = project / "data/allen"
        self.output = project / "plots/advanced"
        self.preview = project / "exports/advanced-previews"
        self.output.mkdir(parents=True, exist_ok=True)
        self.preview.mkdir(parents=True, exist_ok=True)
        self.records = []

    def save(self, fig, name, *, title, sources, description, morph_group=None,
             state=None, analysis=None):
        assert len(fig.axes) == 1, "Each source SVG is one axis; arrange in Flux later."
        svg = self.output / f"{name}.svg"
        recipe = dict(script=__file__, params={}, inputs=[str(self.data / x) for x in sources])
        result = fp.save(fig, str(svg), force_vectors=True, recipe=recipe)
        if getattr(result, "skipped", False):
            plt.close(fig)
            return
        if morph_group:
            stabilize_morph_references(svg)
        # fluxplot restores a None layout engine via Matplotlib's global style;
        # that can re-enable constrained layout after SVG export. Keep previews
        # frozen to the already exported, explicitly positioned SVG geometry.
        fig.set_layout_engine("none")
        recipe_path = svg.with_suffix(".recipe.json")
        portable = json.loads(recipe_path.read_text())
        portable.update(command="uv", cwd="../..",
                        args=["run", "--project", "scripts/advanced", "python",
                              "scripts/advanced/population.py"],
                        script={"path": "scripts/advanced/population.py"})
        for item in portable.get("inputs", []):
            item["path"] = "data/allen/" + Path(item["path"]).name
        write_json(recipe_path, portable)
        fig.savefig(self.preview / f"{name}.png", dpi=360)
        fig.savefig(self.preview / f"{name}.pdf")
        w, h = fig.get_size_inches()
        record = dict(id=name, title=title, family=name[:2],
                      svg=f"plots/advanced/{name}.svg",
                      preview=f"exports/advanced-previews/{name}.png",
                      pdf=f"exports/advanced-previews/{name}.pdf",
                      widthIn=float(w), heightIn=float(h), axes=1,
                      description=description,
                      generator=dict(script="scripts/advanced/population.py",
                                     sha256=sha(Path(__file__)),
                                     morphIdentityHelperSha256=sha(Path(__file__).with_name("morph_identity.py")) if morph_group else None),
                      sources=[dict(path=f"data/allen/{x}", sha256=sha(self.data / x)) for x in sources],
                      morphGroup=morph_group, state=state)
        if analysis is not None:
            analysis_path = self.output / f"{name}.analysis.json"
            write_json(analysis_path, analysis)
            record["analysis"] = f"plots/advanced/{name}.analysis.json"
        write_json(self.output / f"{name}.notes.json", record)
        self.records.append(record)
        plt.close(fig)
        print(f"Wrote {name}", flush=True)


def direction_legend(ax, *, y=-.21, line=False, figure_y=None):
    handles = [Line2D([], [], color=c, marker=None if line else "o",
                      linestyle="-" if line else "none", linewidth=1.15,
                      markersize=3, markeredgewidth=0,
                      label=f"{i * 45}°") for i, c in enumerate(DIRECTION_COLORS)]
    location = dict(bbox_to_anchor=(.5, y)) if figure_y is None else dict(
        bbox_to_anchor=(.55, figure_y), bbox_transform=ax.figure.transFigure)
    ax.legend(handles=handles, loc="upper center", **location,
              ncol=4, fontsize=5, frameon=False, handlelength=1.1,
              handletextpad=.45, columnspacing=1.2, labelspacing=.55, borderpad=0)


def trajectory(pub: Publisher, traces):
    # Smooth only along measured time: sigma=2.5 frames (~83 ms nominal).
    raw = np.asarray(traces["mean_trial_trace_pct"], dtype=float)
    smooth = gaussian_filter1d(raw, 2.5, axis=-1, mode="nearest")
    baseline = smooth[:, :, :30].mean(axis=(0, 2))
    scale = np.maximum(smooth.std(axis=(0, 2)), 1e-9)
    standardized = (smooth - baseline[None, :, None]) / scale[None, :, None]
    observations = standardized.transpose(0, 2, 1).reshape(-1, len(baseline))
    center = observations.mean(axis=0)
    _, singular, vectors = np.linalg.svd(observations - center, full_matrices=False)
    basis = orient_basis(vectors[:3])
    scores = ((observations - center) @ basis.T).reshape(8, 120, 3)
    explained = singular[:3] ** 2 / np.sum(singular ** 2)

    fig, ax = plt.subplots(figsize=(3.45, 3.1), subplot_kw={"projection": "3d"}, layout="none")
    ax.set_position([.015, .16, .90, .82])
    ax.view_init(elev=25, azim=-55)
    ax.set_proj_type("ortho")
    ax.set_box_aspect((1.25, 1.0, .8), zoom=1.04)
    minima, maxima = scores.min(axis=(0, 1)), scores.max(axis=(0, 1))
    span = maxima - minima
    limits = np.column_stack([minima - .09 * span, maxima + .09 * span])
    for axis, bounds, label in zip((ax.xaxis, ax.yaxis, ax.zaxis), limits,
                                  [f"PC {i+1} ({x*100:.1f}%)" for i, x in enumerate(explained)]):
        axis.set_pane_color((1, 1, 1, 0))
        axis.line.set_color(LIGHT)
        axis.line.set_linewidth(.65)
        axis._axinfo["grid"].update(color=mcolors.to_rgba(LIGHT, .6), linewidth=.35)
        axis._axinfo["tick"].update(inward_factor=0., outward_factor=.1)
        axis.set_ticks([-10, 0, 10] if bounds[0] < -9 or bounds[1] > 9 else [-5, 0, 5])
        axis.set_tick_params(labelsize=5, pad=-1)
        axis.set_label_text(label, fontsize=6)
        axis.labelpad = -1
    ax.set_xlim(*limits[0]); ax.set_ylim(*limits[1]); ax.set_zlim(*limits[2])

    # A faint physical projection gives the curves depth without inventing geometry.
    for direction, color in enumerate(DIRECTION_COLORS):
        pts = scores[direction]
        shadow, = ax.plot(pts[:, 0], pts[:, 1], np.full(120, limits[2, 0]),
                          color=color, linewidth=.55, alpha=.15, zorder=1)
        fp.tag(shadow, role="x-trajectory-projection", series=f"direction-{direction*45}-projection")
        before, = ax.plot(*pts[:31].T, color=color, linewidth=.65, alpha=.32, zorder=2)
        after, = ax.plot(*pts[89:].T, color=color, linewidth=.65, alpha=.42, zorder=2)
        fp.tag(before, role="x-population-trajectory", series=f"direction-{direction*45}-baseline")
        fp.tag(after, role="x-population-trajectory", series=f"direction-{direction*45}-recovery")
        active, = ax.plot(*pts[30:91].T, color=color, linewidth=1.45,
                          solid_capstyle="round", zorder=4)
        fp.tag(active, role="x-population-trajectory", series=f"direction-{direction*45}-stimulus")
        # Start/end glyphs represent exact measured frames, not inferred velocity.
        onset = ax.scatter(*pts[30], color=color, edgecolors="white", linewidths=.45,
                           s=15, depthshade=False, zorder=6)
        offset = ax.scatter(*pts[90], color=color, edgecolors="white", linewidths=.35,
                            marker="s", s=12, depthshade=False, zorder=6)
        fp.tag(onset, role="x-stimulus-onset", series=f"direction-{direction*45}-onset")
        fp.tag(offset, role="x-stimulus-offset", series=f"direction-{direction*45}-offset")
    ax.set_zlabel("")
    fig.text(.96, .59, f"PC 3 ({explained[2]*100:.1f}%)", rotation=90,
             fontsize=6, ha="center", va="center")
    direction_legend(ax, y=-.04, line=True, figure_y=.106)
    # Quantitative timing key belongs below the axes, away from every trajectory.
    fig.text(.5, .016, "● 0 frames     ■ 60 frames     143 cells · 2 Hz",
             fontsize=5, ha="center", color=MUTED)
    pub.save(fig, "13-population-trajectories", title="Population trajectories during directional stimulation",
             sources=["traces.json"],
             description="Eight trajectories in a shared three-dimensional PCA basis fitted to all 960 population states. Actual mean traces at a 2 Hz stimulus frequency; 143 cells, 120 source frames per direction. Gaussian temporal smoothing sigma 2.5 frames; each cell centered to its pooled baseline and divided by its pooled temporal standard deviation. Saturated lines mark stimulus frames 0–60; pale lines show pre-stimulus and recovery epochs. Circles and squares mark onset and offset. Floor projections indicate geometry only. This 3D plot supports semantic editing and build animations, not Data Morph.",
             analysis=dict(cellSpecimenIds=traces["cell_specimen_ids"],
                           sampleFrames=traces["sample_frames_relative_to_onset"],
                           stimulusFrequencyHz=2, smoothingSigmaFrames=2.5,
                           perCellBaseline=baseline.tolist(), perCellScale=scale.tolist(),
                           mean=center.tolist(), basis=basis.tolist(),
                           explainedVariance=explained.tolist(), scores=scores.tolist()))


def geometry(pub: Publisher, responses):
    raw = np.asarray(responses["mean_response_pct"], dtype=float)
    ids = np.asarray(responses["cell_specimen_ids"])
    # Asinh compresses the public response outliers while retaining signs and zero.
    # Remove each condition profile's mean to isolate directional *shape*; each
    # cell uses one common scale over all five frequencies, never a per-state scale.
    transformed = np.arcsinh(raw / 2.0).transpose(1, 2, 0)
    transformed -= transformed.mean(axis=-1, keepdims=True)
    scale = np.maximum(transformed.std(axis=(0, 2)), 1e-9)
    transformed /= scale[None, :, None]
    observations = transformed.reshape(-1, 8)
    center = observations.mean(axis=0)
    _, singular, vectors = np.linalg.svd(observations - center, full_matrices=False)
    basis = orient_basis(vectors[:2])
    scores = ((observations - center) @ basis.T).reshape(5, len(ids), 2)
    variance = singular[:2] ** 2 / np.sum(singular ** 2)
    # Cell identity and color never change across frames. The same 143 cells stay in
    # the source ordering and thus retain fp.scatter's per-point semantic IDs.
    preferred = np.argmax(np.maximum(raw, 0).mean(axis=1), axis=0)
    point_colors = [DIRECTION_COLORS[i] for i in preferred]
    pooled = scores.reshape(-1, 2)
    xlim = (-4.0, 6.0); ylim = (-3.9, 5.4)
    gx, gy = np.meshgrid(np.linspace(*xlim, 160), np.linspace(*ylim, 160))
    density = gaussian_kde(pooled.T, bw_method=.32)(np.vstack([gx.ravel(), gy.ravel()])).reshape(gx.shape)
    # Fixed pooled density backdrop across every state. It is intentionally an
    # untagged guide so the only data series is the morphable neuron point cloud.
    sorted_density = np.sort(density.ravel())[::-1]
    mass = np.cumsum(sorted_density) / sorted_density.sum()
    levels = np.sort([sorted_density[np.searchsorted(mass, x)] for x in (.5, .8, .95)])
    shared = dict(cellSpecimenIds=ids.tolist(), frequenciesHz=responses["temporal_frequencies_hz"],
                  pointSeriesId="cell-profiles", pointOrder="source cell_specimen_ids ordering",
                  transform="asinh(response_pct / 2), subtract per-profile direction mean, divide by per-cell standard deviation pooled over all frequencies and directions",
                  perCellScale=scale.tolist(), mean=center.tolist(), basis=basis.tolist(),
                  explainedVariance=variance.tolist(), scores=scores.tolist(),
                  colorPreferredDirectionDeg=(preferred * 45).tolist(),
                  xDomain=list(xlim), yDomain=list(ylim),
                  densityGuide="Fixed Gaussian KDE of all 715 cell-frequency points; contours enclose 50%, 80%, 95% of the sampled density mass.")

    for index in (0, 2, 4):
        frequency = int(responses["temporal_frequencies_hz"][index])
        fig, ax = plt.subplots(figsize=(2.9, 3.0), layout="none")
        fig.subplots_adjust(left=.2, right=.96, bottom=.28, top=.93)
        ax.contour(gx, gy, density, levels=levels, colors=LIGHT, linewidths=.65, zorder=0)
        ax.axhline(0, color=LIGHT, linewidth=.45, zorder=0)
        ax.axvline(0, color=LIGHT, linewidth=.45, zorder=0)
        fp.scatter(ax, scores[index, :, 0], scores[index, :, 1], series="cell-profiles",
                   c=point_colors, s=12, edgecolors="white", linewidths=.35,
                   alpha=.93, zorder=4)
        ax.set_xlim(*xlim); ax.set_ylim(*ylim)
        ax.set_xticks([-2, 0, 2, 4, 6]); ax.set_yticks([-2, 0, 2, 4])
        ax.set_xlabel(f"PC 1 ({variance[0]*100:.1f}%)")
        ax.set_ylabel(f"PC 2 ({variance[1]*100:.1f}%)")
        ax.set_aspect("equal", adjustable="box")
        fx.despine(ax)
        direction_legend(ax, figure_y=.124)
        fig.text(.96, .975, f"{frequency} Hz", fontsize=6, ha="right", va="top", color=MUTED)
        name = f"14-response-geometry-{frequency:02d}hz"
        pub.save(fig, name, title=f"Response geometry at {frequency} Hz",
                 sources=["responses.json"], morph_group="frequency-response-geometry",
                 state=dict(temporalFrequencyHz=frequency),
                 description="Actual 143-cell directional-response profiles projected into one PCA basis fitted jointly across all five temporal frequencies. Colors identify each cell's preferred direction pooled across frequencies; these colors, cell ordering, axes, marker styles and source identities remain fixed across 1, 4 and 15 Hz variants. Grey contours show the same pooled 715-point density in every state. Each SVG has one vector point series, permitting genuine native Data Morph rather than a crossfade.",
                 analysis=shared)


def dynamics(pub: Publisher, traces, responses):
    raw = np.asarray(traces["mean_trial_trace_pct"], dtype=float)
    smooth = gaussian_filter1d(raw, 1.5, axis=-1, mode="nearest")
    baseline = smooth[:, :, :30].mean(axis=(0, 2))
    scale = np.maximum(smooth.std(axis=(0, 2)), 1e-9)
    standardized = (smooth - baseline[None, :, None]) / scale[None, :, None]
    mean_response = np.asarray(responses["mean_response_pct"], dtype=float)[:, 1, :]
    preferred = np.argmax(mean_response, axis=0)
    strongest_trace = smooth[preferred, np.arange(143), :]
    latency = np.argmax(strongest_trace[:, 30:90], axis=-1)
    order = np.lexsort((latency, preferred))
    gap = 6
    matrix = np.full((143, 8 * 120 + 7 * gap), np.nan)
    for direction in range(8):
        start = direction * (120 + gap)
        matrix[:, start:start+120] = standardized[direction, order]

    fig, ax = plt.subplots(figsize=(3.5, 2.85), layout="none")
    fig.subplots_adjust(left=.135, right=.89, bottom=.19, top=.88)
    cmap = fx.DIVERGING.copy()
    cmap.set_bad("white")
    image = ax.imshow(matrix, aspect="auto", interpolation="nearest", origin="upper",
                      extent=(0, matrix.shape[1], 143, 0), cmap=cmap, vmin=-2.5, vmax=2.5)
    fp.tag(image, role="x-response-heatmap", series="direction-response-blocks")
    ax.set_yticks([1, 36, 72, 108, 143])
    ax.set_ylabel("Cell rank")
    ax.set_xticks([d*(120+gap)+60 for d in range(8)], [f"{d*45}°" for d in range(8)])
    ax.set_xlabel("Motion direction")
    ax.tick_params(axis="x", length=0, pad=5)
    ax.tick_params(axis="y", length=2, pad=3)
    for spine in ax.spines.values():
        spine.set_visible(False)
    # Shared cell ordering is visibly partitioned by each cell's preferred direction.
    # The left color strip is categorical, never a second functional measurement.
    counts = np.bincount(preferred, minlength=8)
    boundaries = np.r_[0, np.cumsum(counts)]
    for i, (begin, end) in enumerate(zip(boundaries[:-1], boundaries[1:])):
        strip = Rectangle((-20, begin), 8, end-begin, color=DIRECTION_COLORS[i],
                          clip_on=False, linewidth=0)
        ax.add_patch(strip)
        fp.tag(strip, role="x-cell-preference-group", series=f"preferred-{i*45}")
        if end < 143:
            ax.axhline(end, color="white", linewidth=.45, alpha=.9)
    # Draw stimulus windows above each block. No lines obscure the response matrix.
    for direction in range(8):
        start = direction*(120+gap)
        ax.plot([start+30, start+90], [-4, -4], color=DIRECTION_COLORS[direction],
                linewidth=1.6, solid_capstyle="butt", clip_on=False)
    # A one-axis scale key: manually drawn in data coordinates, outside the data.
    # A conventional pyplot colorbar would introduce a second matplotlib axis.
    key_x, key_width = matrix.shape[1] + 25, 12
    key_y0, key_y1 = 26, 114
    bounds = np.linspace(key_y0, key_y1, 129)
    rects = [((key_x, bounds[i]), (key_x+key_width, bounds[i]),
              (key_x+key_width, bounds[i+1]), (key_x, bounds[i+1])) for i in range(128)]
    key = PolyCollection(rects, facecolors=cmap(np.linspace(1, 0, 128)),
                         edgecolors="none", clip_on=False)
    ax.add_collection(key)
    fp.tag(key, role="x-response-color-key", series="response-scale")
    for y, label in ((key_y0, "+2.5"), ((key_y0+key_y1)/2, "0"), (key_y1, "−2.5")):
        ax.text(key_x+key_width+7, y, label, ha="left", va="center", fontsize=5,
                color=MUTED, clip_on=False)
    ax.text(key_x+key_width/2, key_y0-10, "SD", fontsize=5, ha="center", va="bottom", clip_on=False)
    ax.set_xlim(0, matrix.shape[1]); ax.set_ylim(143, 0)
    # The same 120 precise source frames appear in all eight blocks.
    fig.text(.135, .96, "120 frames per direction", fontsize=5, color=MUTED, va="top")
    fig.text(.89, .96, "143 cells · 2 Hz", fontsize=5, color=MUTED, va="top", ha="right")
    pub.save(fig, "15-population-response-atlas", title="Population response dynamics across eight directions",
             sources=["traces.json", "responses.json"],
             description="One continuous 143-row response atlas with eight consecutive motion-direction blocks. Every block contains the same cells in the same order and the same 120 source frames (−30 to +89 relative to onset). Cells are grouped by their preferred direction at 2 Hz, then ordered by peak-response latency within their preferred condition. The thin left strip identifies those preference groups; colored bars above each block indicate the 60 stimulus frames. Values are Gaussian-smoothed at sigma 1.5 frames, baseline-subtracted and divided by each cell's standard deviation pooled across all eight traces. Color saturates at ±2.5 SD; no cell or measurement is removed.",
             analysis=dict(cellSpecimenIds=traces["cell_specimen_ids"],
                           displayedCellSpecimenIds=np.asarray(traces["cell_specimen_ids"])[order].tolist(),
                           cellOrder=order.tolist(), groupCounts=counts.tolist(),
                           preferredDirectionDeg=(preferred*45).tolist(), peakFrameWithinStimulus=latency.tolist(),
                           smoothingSigmaFrames=1.5, baseline=baseline.tolist(), perCellScale=scale.tolist(),
                           colorRange=[-2.5, 2.5], sourceFrames=traces["sample_frames_relative_to_onset"]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--family", choices=("all", "13", "14", "15"), default="all")
    args = parser.parse_args()
    pub = Publisher(args.project.resolve())
    responses = json.loads((pub.data / "responses.json").read_text())
    traces = json.loads((pub.data / "traces.json").read_text())
    assert responses["cell_specimen_ids"] == traces["cell_specimen_ids"]
    assert len(responses["cell_specimen_ids"]) == 143
    if args.family in ("all", "13"):
        trajectory(pub, traces)
    if args.family in ("all", "14"):
        geometry(pub, responses)
    if args.family in ("all", "15"):
        dynamics(pub, traces, responses)


if __name__ == "__main__":
    main()
