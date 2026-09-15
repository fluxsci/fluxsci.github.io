#!/usr/bin/env python3
"""Flagship figure panels: twelve dense, journal-style plots from the bundled Allen data.

Run from the project root with the project's environment:

    uv run --project scripts/advanced python scripts/advanced/flagship.py [--only 21,24]

Every panel is an original rendering of the public files already in ``data/allen``.
Nothing is simulated: anatomy comes from the CCF meshes and SWC reconstructions,
activity from experiment 501940850. Panels are sized in inches for a 15-inch-wide
Flux figure at 96 px/in, so they compose at natural size without rescaling. This
script writes only ``plots/flagship/`` and ``exports/flagship-previews/``.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import colors as mcolors
from matplotlib.collections import LineCollection, PolyCollection
from matplotlib.colors import LinearSegmentedColormap, to_rgb
from matplotlib.lines import Line2D
from matplotlib.patches import Arc, Circle, Ellipse, FancyArrowPatch, Polygon, Rectangle
from mpl_toolkits.mplot3d.art3d import Line3DCollection  # noqa: F401  (registers the 3D projection)
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import gaussian_filter1d
from scipy.spatial import cKDTree
from scipy.stats import gaussian_kde

import fluxplot as fp
from fluxplot import style as fx

# ---------------------------------------------------------------------------
# House style. One typographic scale for every panel, Flexoki accents, and the
# same eight-hue wheel for drift direction everywhere (the Flux mark's wheel).
# ---------------------------------------------------------------------------
fx.use_light()
INK = "#161514"
MUTED = "#6f6e69"
FAINT = "#b7b5ac"
RULE = "#dad8ce"
PAPER = "#ffffff"
DIRECTION_COLORS = [fx.FLEXOKI[k] for k in
                    ("blue", "cyan", "green", "yellow", "orange", "red", "magenta", "purple")]
DIRECTIONS = np.arange(8) * 45
CELL_TYPE_COLORS = {"Rorb": fx.FLEXOKI["orange"], "Sst": fx.FLEXOKI["purple"]}
ACTIVITY_CMAP = fx.DIVERGING.reversed()  # blue (below baseline) · white · red (above)
CORRELATION_CMAP = LinearSegmentedColormap.from_list(
    "flux-correlation", ["#205ea6", "#7fb0c9", "#f6f2e8", "#e0906f", "#a63c2f"])
EXAMPLE_CELLS = [517470610, 587375741, 517472541, 517470181]  # strong, distinct preferences at 2 Hz
plt.rcParams.update({
    "font.family": "sans-serif", "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
    "font.size": 6, "axes.labelsize": 6.2, "axes.titlesize": 6.5, "axes.titleweight": "normal",
    "axes.titlepad": 4, "axes.linewidth": 0.6, "axes.edgecolor": MUTED, "axes.labelcolor": INK,
    "axes.labelpad": 2.5, "text.color": INK, "xtick.color": MUTED, "ytick.color": MUTED,
    "xtick.labelcolor": INK, "ytick.labelcolor": INK, "xtick.labelsize": 5.4, "ytick.labelsize": 5.4,
    "xtick.major.size": 2.4, "ytick.major.size": 2.4, "xtick.major.width": 0.6, "ytick.major.width": 0.6,
    "xtick.major.pad": 2, "ytick.major.pad": 2, "axes.spines.top": False, "axes.spines.right": False,
    "legend.fontsize": 5.4, "legend.frameon": False, "legend.handlelength": 1.2,
    "lines.linewidth": 1.0, "lines.markersize": 3, "lines.solid_capstyle": "round",
    "figure.facecolor": PAPER, "axes.facecolor": PAPER, "savefig.facecolor": PAPER,
    "figure.constrained_layout.use": False, "svg.fonttype": "none",
    "svg.hashsalt": "flux-neural-flagship-v1",
})


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def note(fig, text, x=0.99, y=0.012, ha="right", size=4.8, color=MUTED):
    fig.text(x, y, text, fontsize=size, color=color, ha=ha, va="bottom")


class Publisher:
    def __init__(self, project: Path, only):
        self.project = project
        self.data = project / "data/allen"
        self.output = project / "plots/flagship"
        self.preview = project / "exports/flagship-previews"
        self.only = only
        self.output.mkdir(parents=True, exist_ok=True)
        self.preview.mkdir(parents=True, exist_ok=True)
        self.records = []
        inventory = self.output / "inventory.json"
        self.previous = {r["id"]: r for r in json.loads(inventory.read_text())["panels"]} if inventory.exists() else {}
        self._responses = None
        self._traces = None

    def wants(self, name: str) -> bool:
        return not self.only or any(name.startswith(o) for o in self.only)

    @property
    def responses(self):
        if self._responses is None:
            self._responses = json.loads((self.data / "responses.json").read_text())
        return self._responses

    @property
    def traces(self):
        if self._traces is None:
            self._traces = json.loads((self.data / "traces.json").read_text())
        return self._traces

    def keep_previous(self, name):
        if name in self.previous:
            self.records.append(self.previous[name])

    def save(self, fig, name, *, title, sources, description, raster_dpi=360, force_vectors=False):
        svg = self.output / f"{name}.svg"
        recipe = dict(script=__file__, params={}, inputs=[str(self.data / x) for x in sources])
        with plt.rc_context({"figure.constrained_layout.use": False}):
            result = fp.save(fig, str(svg), recipe=recipe, raster_dpi=raster_dpi,
                             raster_threshold=800, force_vectors=force_vectors)
        if result is None or getattr(result, "skipped", False):
            self.keep_previous(name)
            plt.close(fig)
            return
        fig.set_layout_engine("none")
        recipe_path = svg.with_suffix(".recipe.json")
        portable = json.loads(recipe_path.read_text())
        portable.update(command="uv", cwd="../..",
                        args=["run", "--project", "scripts/advanced", "python",
                              "scripts/advanced/flagship.py", "--project", "."],
                        script={"path": "scripts/advanced/flagship.py"})
        for item in portable.get("inputs", []):
            item["path"] = "data/allen/" + Path(item["path"]).name
        recipe_path.write_text(json.dumps(portable, indent=2) + "\n")
        with plt.rc_context({"figure.constrained_layout.use": False}):
            fig.savefig(self.preview / f"{name}.png", dpi=300)
        w, h = fig.get_size_inches()
        manifest = json.loads(svg.with_suffix(".fluxplot.json").read_text())
        self.records.append(dict(
            id=name, title=title, file=f"plots/flagship/{name}.svg",
            preview=f"exports/flagship-previews/{name}.png",
            widthIn=float(w), heightIn=float(h), widthPx=float(w * 96), heightPx=float(h * 96),
            description=description, sources=[f"data/allen/{x}" for x in sources],
            series=[s["id"] for s in manifest.get("series", [])],
            sha256=sha(svg), generatorSha256=sha(Path(__file__))))
        plt.close(fig)
        print(f"Wrote {name}", flush=True)

    def finish(self):
        (self.output / "inventory.json").write_text(json.dumps({
            "generator": "scripts/advanced/flagship.py", "panels": self.records,
            "attribution": "Allen Institute for Brain Science. Public Allen Brain Observatory, Cell Types and CCF data; see data/README.md and data/allen/provenance.json for terms and checksums.",
            "originality": "Every rendering, layout and wording is original demonstration material; no research-paper artwork or prose is reproduced.",
        }, indent=2) + "\n")


# ---------------------------------------------------------------------------
# Shared derived quantities (all descriptive; recorded in the inventory text)
# ---------------------------------------------------------------------------
class Mesh:
    """A triangulated OBJ surface with its own per-vertex normals for smooth shading."""

    def __init__(self, path):
        vertices, normals, faces, face_normals = [], [], [], []
        with open(path) as handle:
            for line in handle:
                if line.startswith("v "):
                    vertices.append([float(x) for x in line.split()[1:4]])
                elif line.startswith("vn "):
                    normals.append([float(x) for x in line.split()[1:4]])
                elif line.startswith("f "):
                    parts = [p.split("/") for p in line.split()[1:]]
                    ids = [int(p[0]) - 1 for p in parts]
                    nids = [int(p[-1]) - 1 if len(p) > 1 and p[-1] else -1 for p in parts]
                    for j in range(1, len(ids) - 1):
                        faces.append([ids[0], ids[j], ids[j + 1]])
                        face_normals.append([nids[0], nids[j], nids[j + 1]])
        self.vertices = np.asarray(vertices)
        self.normals = np.asarray(normals) if normals else None
        self.faces = np.asarray(faces, dtype=int)
        self.face_normals = np.asarray(face_normals, dtype=int)


def load_obj(path):
    mesh = Mesh(path)
    return mesh.vertices, mesh.faces


def view_rotation(view):
    if view == "dorsal":
        turn, pitch = np.deg2rad(35), np.deg2rad(12)
        ry = np.array([[np.cos(turn), 0, np.sin(turn)], [0, 1, 0], [-np.sin(turn), 0, np.cos(turn)]])
        rx = np.array([[1, 0, 0], [0, np.cos(pitch), -np.sin(pitch)], [0, np.sin(pitch), np.cos(pitch)]])
        return ry.T @ rx.T
    if view == "lateral":
        return np.array([[0, 1, 0], [0, 0, 1], [-1, 0, 0]]).T
    raise ValueError(view)


def ccf_to_view(vertices, view):
    """Allen CCF (x anterior→posterior, y dorsal→ventral, z left→right, µm) into a
    right-handed screen frame (x right, y up, z toward the viewer), in millimetres."""
    p = np.column_stack([vertices[:, 2] - 5700, -(vertices[:, 0] - 6600), -(vertices[:, 1] - 3700)]) / 1000
    return p @ view_rotation(view)


def normals_to_view(normals, view):
    return np.column_stack([normals[:, 2], -normals[:, 0], -normals[:, 1]]) @ view_rotation(view)


def shade(points, faces, base, *, smooth=None, light=(-0.4, 0.5, 0.75), ambient=0.46, diffuse=0.5,
          specular=0.18, shininess=30, rim=0.28, alpha=1.0):
    tri = points[faces]
    normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    normals /= np.maximum(np.linalg.norm(normals, axis=1), 1e-9)[:, None]
    facing = normals[:, 2] > 0
    if smooth is not None:
        # Per-vertex normals averaged over each face remove the triangulation banding.
        blended = smooth / np.maximum(np.linalg.norm(smooth, axis=1), 1e-9)[:, None]
        blended[np.sum(blended * normals, axis=1) < 0] *= -1
        normals = blended
    tri, normals = tri[facing], normals[facing]
    light = np.asarray(light, float)
    light /= np.linalg.norm(light)
    half = light + np.array([0, 0, 1.0])
    half /= np.linalg.norm(half)
    lambert = np.clip(normals @ light, 0, 1)
    spec = np.clip(normals @ half, 0, 1) ** shininess
    fresnel = (1 - np.clip(normals[:, 2], 0, 1)) ** 2.0
    base = np.asarray(to_rgb(base))
    rgb = base[None, :] * (ambient + diffuse * lambert)[:, None] * (1 - rim * fresnel)[:, None] + specular * spec[:, None]
    rgba = np.column_stack([np.clip(rgb, 0, 1), np.full(len(rgb), alpha)])
    order = np.argsort(tri[:, :, 2].mean(axis=1))
    return tri[order, :, :2], rgba[order], facing


def read_swc(path):
    data = np.loadtxt(path, comments="#")
    by_id = {int(r[0]): r for r in data}
    soma = data[data[:, 1] == 1][0]
    return data, by_id, soma


def circular_metrics(responses):
    """Preferred direction, peak and circular orientation/direction selectivity from
    nonnegative mean responses at each cell's best mean-response temporal frequency."""
    response = np.asarray(responses["mean_response_pct"], float)
    positive = np.maximum(np.nan_to_num(response), 0)
    best_tf = np.argmax(positive.mean(axis=0), axis=0)
    n = response.shape[2]
    tuning = positive[:, best_tf, np.arange(n)]
    pref = np.argmax(tuning, axis=0)
    peak = tuning.max(axis=0)
    theta = np.deg2rad(DIRECTIONS)
    denom = np.maximum(tuning.sum(axis=0), 1e-12)
    dsi = np.abs(np.sum(tuning * np.exp(1j * theta[:, None]), axis=0)) / denom
    osi = np.abs(np.sum(tuning * np.exp(2j * theta[:, None]), axis=0)) / denom
    return dict(tuning=tuning, pref=pref, peak=peak, osi=osi, dsi=dsi, best_tf=best_tf, positive=positive)


def direction_arrow(ax, x, y, angle_deg, length, color, lw=0.9, mutation=5):
    dx, dy = np.cos(np.deg2rad(angle_deg)) * length, np.sin(np.deg2rad(angle_deg)) * length
    arrow = FancyArrowPatch((x - dx / 2, y - dy / 2), (x + dx / 2, y + dy / 2), arrowstyle="-|>",
                            mutation_scale=mutation, lw=lw, color=color, transform=ax.transAxes, clip_on=False)
    ax.add_patch(arrow)
    return arrow


# ---------------------------------------------------------------------------
# 21 · Anatomy: a shaded whole-brain surface with the visual areas painted on.
# ---------------------------------------------------------------------------
def anatomy(pub: Publisher):
    name = "21-brain-anatomy"
    if not pub.wants(name):
        return pub.keep_previous(name)
    meshes = {k: Mesh(pub.data / f"ccf-2017-{k}.obj") for k in (997, 315, 385, 409)}
    cortex = meshes[315]
    cortex_v, cortex_f = cortex.vertices, cortex.faces
    membership = np.zeros(len(cortex_f), dtype=int)
    for code, structure in ((1, 385), (2, 409)):
        # A cortical face belongs to an area when most of its corners lie close to
        # that area's volume boundary; the vertex vote closes the coarse-mesh holes
        # a centroid test leaves behind.
        distance, _ = cKDTree(meshes[structure].vertices).query(cortex_v)
        votes = (distance[cortex_f] < 150).sum(axis=1)
        membership[votes >= 2] = code
    fig = plt.figure(figsize=(4.55, 3.35))
    main = fig.add_axes([0.0, 0.03, 0.64, 0.97])
    side = fig.add_axes([0.6, 0.4, 0.4, 0.58])
    fp.panel(main, "dorsal")
    fp.panel(side, "lateral")
    root = meshes[997]
    layers = [
        (root, np.ones(len(root.faces), bool), "brain-surface", "#ebe8de", dict(ambient=0.5, diffuse=0.42, specular=0.12, rim=0.34)),
        (cortex, membership == 0, "isocortex", "#d3dbd8", dict(ambient=0.5, diffuse=0.46, specular=0.16, rim=0.3)),
        (cortex, membership == 1, "primary-visual-area", "#7fb8b3", dict(ambient=0.55, diffuse=0.45, specular=0.2, rim=0.2)),
        (cortex, membership == 2, "lateral-visual-area", fx.FLEXOKI["cyan"], dict(ambient=0.62, diffuse=0.42, specular=0.25, rim=0.12)),
    ]
    for ax, view in ((main, "dorsal"), (side, "lateral")):
        if view == "dorsal":
            # A soft ground shadow beneath the surface gives the render depth.
            envelope = ccf_to_view(root.vertices, view)
            cx, cy = envelope[:, 0].mean(), envelope[:, 1].min() - 0.1
            rx, ry = (envelope[:, 0].max() - envelope[:, 0].min()) * 0.5, 0.6
            for grow, alpha in ((1.35, 0.035), (1.18, 0.05), (1.03, 0.06)):
                ax.add_patch(Ellipse((cx, cy), 2 * rx * grow, 2 * ry * grow, facecolor="#100f0f", alpha=alpha, linewidth=0, zorder=0))
        for mesh, mask, series, color, style in layers:
            faces = mesh.faces[mask]
            points = ccf_to_view(mesh.vertices, view)
            smooth = None
            if mesh.normals is not None and (mesh.face_normals[mask] >= 0).all():
                smooth = normals_to_view(mesh.normals, view)[mesh.face_normals[mask]].mean(axis=1)
            polys, rgba, _ = shade(points, faces, color, smooth=smooth, **style)
            if not len(polys):
                continue
            artist = PolyCollection(polys, facecolors=rgba, edgecolors="none", linewidths=0, antialiased=False)
            ax.add_collection(artist)
            fp.tag(artist, role="x-brain-surface", series=f"{view}-{series}")
        ax.autoscale_view()
        ax.set_aspect("equal")
        ax.set_axis_off()
    x0, x1 = main.get_xlim()
    y0, y1 = main.get_ylim()
    main.set_xlim(x0 - 0.35, x1 + 0.35)
    main.set_ylim(y0 - 0.75, y1 + 0.15)
    bar_x, bar_y = x0 - 0.2, y0 - 0.5
    main.plot([bar_x, bar_x + 2], [bar_y, bar_y], color=INK, lw=1.1, solid_capstyle="butt")
    main.text(bar_x + 1, bar_y + 0.14, "2 mm", ha="center", va="bottom", fontsize=5.2, color=INK)
    main.annotate("", xy=(x1 + 0.15, y1 - 0.2), xytext=(x1 + 0.15, y1 - 1.3),
                  arrowprops=dict(arrowstyle="-|>", color=MUTED, lw=0.7, mutation_scale=6))
    main.text(x1 + 0.3, y1 - 0.75, "A", fontsize=5.2, color=MUTED, va="center")
    side.text(0.04, 0.95, "lateral", transform=side.transAxes, fontsize=5.2, color=MUTED, va="top")
    handles = [Line2D([], [], marker="s", linestyle="none", markersize=4.2, markerfacecolor=c, markeredgecolor="none", label=t)
               for c, t in [(fx.FLEXOKI["cyan"], "VISl · recorded area"), ("#7fb8b3", "VISp · primary visual"), ("#d3dbd8", "Isocortex")]]
    fig.legend(handles=handles, loc="lower right", bbox_to_anchor=(0.995, 0.135), handletextpad=0.5, labelspacing=0.4, borderpad=0)
    note(fig, "Allen CCFv3 2017 surfaces · imaging plane 175 µm deep", x=0.995, y=0.025)
    pub.save(fig, name, title="Visual cortical areas in the mouse brain",
             sources=[f"ccf-2017-{k}.obj" for k in (997, 315, 385, 409)],
             description="Smooth-shaded Allen CCFv3 surfaces in an oblique dorsal view with a lateral inset. Cortical faces whose corners lie within 150 µm of the VISp or VISl volume boundary are painted with that area's colour; VISl is the recorded area. Illumination is geometric only.",
             raster_dpi=420)


# ---------------------------------------------------------------------------
# 22 · Three reconstructed neurons at a shared scale, compartments coloured.
# ---------------------------------------------------------------------------
def neurons(pub: Publisher):
    name = "22-neuron-reconstructions"
    if not pub.wants(name):
        return pub.keep_previous(name)
    specs = [(480114344, "Rorb", "L5 pyramidal · VISp", 0), (464212183, "Sst", "L5 interneuron · VISp", 1), (464198958, "Sst", "L5 interneuron · VISpor", 2)]
    fig, ax = plt.subplots(figsize=(3.7, 3.35))
    fig.subplots_adjust(left=0.01, right=0.99, bottom=0.115, top=0.99)
    gap = 415.0
    extents = []
    for cell_id, kind, caption, column in specs:
        data, by_id, soma = read_swc(pub.data / f"cell-{cell_id}.swc")
        base = np.asarray(to_rgb(CELL_TYPE_COLORS[kind]))
        # Compartments: basal dendrite saturated, apical dendrite lighter, axon a fine grey.
        tone = {2: (np.array([0.58, 0.57, 0.55]), 0.6, 0.16), 3: (base, 1.0, 0.36), 4: (base * 0.55 + 0.45, 1.0, 0.30)}
        segments, colors, widths, depth = [], [], [], []
        for r in data:
            parent = by_id.get(int(r[6]))
            if parent is None:
                continue
            kind_id = int(r[1]) if int(r[1]) in tone else 3
            color, alpha, base_width = tone[kind_id]
            a = (r[2:4] - soma[2:4]) * [1, -1] + [column * gap, 0]
            b = (parent[2:4] - soma[2:4]) * [1, -1] + [column * gap, 0]
            segments.append([a, b])
            colors.append((*color, alpha))
            widths.append(min(1.6, base_width + 0.42 * np.sqrt(max(r[5], 0.05))))
            depth.append(r[4])
        order = np.argsort(depth)
        col = LineCollection(np.asarray(segments)[order], colors=np.asarray(colors)[order],
                             linewidths=np.asarray(widths)[order], capstyle="round", joinstyle="round")
        ax.add_collection(col)
        fp.tag(col, role="x-neuron-morphology", series=f"cell-{cell_id}")
        radius = max(float(soma[5]), 4.0)
        body = Circle((column * gap, 0), radius * 1.15, facecolor=base * 0.85, edgecolor=PAPER, linewidth=0.5, zorder=5)
        ax.add_patch(body)
        fp.tag(body, role="x-soma", series=f"cell-{cell_id}-soma")
        extents.append(np.asarray(segments).reshape(-1, 2))
        ax.text(column * gap, -330, kind, ha="center", va="top", fontsize=6.4, color=CELL_TYPE_COLORS[kind], fontweight="bold")
        ax.text(column * gap, -382, caption, ha="center", va="top", fontsize=4.9, color=MUTED)
        ax.text(column * gap, -425, str(cell_id), ha="center", va="top", fontsize=4.4, color=FAINT)
    pts = np.vstack(extents)
    ax.set_xlim(pts[:, 0].min() - 40, pts[:, 0].max() + 40)
    ax.set_ylim(-460, pts[:, 1].max() + 20)
    ax.set_aspect("equal")
    ax.set_axis_off()
    x0, y0 = pts[:, 0].max() - 160, -300
    ax.plot([x0, x0 + 200], [y0, y0], color=INK, lw=1.1, solid_capstyle="butt")
    ax.text(x0 + 100, y0 + 14, "200 µm", ha="center", va="bottom", fontsize=5.2, color=INK)
    apical = np.asarray(to_rgb(fx.FLEXOKI["orange"])) * 0.55 + 0.45
    handles = [Line2D([], [], color=c, lw=w, label=t) for c, w, t in
               [(fx.FLEXOKI["orange"], 1.4, "basal dendrite"), (apical, 1.2, "apical dendrite"), ("#8d8c89", 0.7, "axon")]]
    fig.legend(handles=handles, loc="lower left", bbox_to_anchor=(0.01, 0.005), ncol=3, columnspacing=1.0, handletextpad=0.5, borderpad=0)
    note(fig, "Allen Cell Types · independent specimens", x=0.99, y=0.012)
    pub.save(fig, name, title="Reconstructed neurons from the visual cortex",
             sources=[f"cell-{c}.swc" for c, *_ in specs],
             description="Three actual SWC reconstructions drawn at one scale, pia upward, with basal and apical dendrites and axon distinguished; line width follows recorded radius. These Cell Types specimens are independent of the imaged population.",
             raster_dpi=420)


# ---------------------------------------------------------------------------
# 23 · Population response atlas: 143 cells × eight directions × 120 frames.
# ---------------------------------------------------------------------------
def atlas(pub: Publisher):
    name = "23-population-atlas"
    if not pub.wants(name):
        return pub.keep_previous(name)
    raw = np.asarray(pub.traces["mean_trial_trace_pct"], float)
    smooth = gaussian_filter1d(raw, 1.5, axis=-1, mode="nearest")
    baseline = smooth[:, :, :30].mean(axis=(0, 2))
    scale = np.maximum(smooth.std(axis=(0, 2)), 1e-9)
    z = (smooth - baseline[None, :, None]) / scale[None, :, None]
    two_hz = np.asarray(pub.responses["mean_response_pct"], float)[:, 1, :]
    preferred = np.argmax(two_hz, axis=0)
    latency = np.argmax(smooth[preferred, np.arange(143), 30:90], axis=-1)
    order = np.lexsort((latency, preferred))
    gap = 5
    width = 8 * 120 + 7 * gap
    matrix = np.full((143, width), np.nan)
    for d in range(8):
        matrix[:, d * (120 + gap):d * (120 + gap) + 120] = z[d, order]
    fig, ax = plt.subplots(figsize=(6.0, 3.35))
    fig.subplots_adjust(left=0.065, right=0.945, bottom=0.13, top=0.905)
    cmap = ACTIVITY_CMAP.copy()
    cmap.set_bad(PAPER)
    image = fp.heatmap(ax, matrix, series="direction-response-blocks", cmap=cmap, vmin=-2.5, vmax=2.5,
                       aspect="auto", interpolation="nearest", origin="upper", extent=(0, width, 143, 0))
    ax.set_yticks([])
    ax.set_ylabel("143 cells, grouped by preferred direction", labelpad=9)
    ax.set_xticks([d * (120 + gap) + 60 for d in range(8)], [f"{d * 45}°" for d in range(8)])
    ax.set_xlabel("Drift direction")
    ax.tick_params(axis="x", length=0, pad=4)
    ax.tick_params(axis="y", length=2, pad=2)
    for spine in ax.spines.values():
        spine.set_visible(False)
    counts = np.bincount(preferred, minlength=8)
    bounds = np.r_[0, np.cumsum(counts)]
    for i, (begin, end) in enumerate(zip(bounds[:-1], bounds[1:])):
        strip = Rectangle((-13, begin), 8, end - begin, color=DIRECTION_COLORS[i], clip_on=False, linewidth=0)
        ax.add_patch(strip)
        fp.tag(strip, role="x-cell-preference-group", series=f"preferred-{i * 45}")
        if 0 < end < 143:
            ax.axhline(end, color=PAPER, linewidth=0.5)
    for d in range(8):
        start = d * (120 + gap)
        bar, = ax.plot([start + 30, start + 90], [-3.5, -3.5], color=DIRECTION_COLORS[d], linewidth=1.8, solid_capstyle="butt", clip_on=False)
        fp.tag(bar, role="x-stimulus-window", series=f"stimulus-{d * 45}")
    ax.set_xlim(0, width)
    ax.set_ylim(143, 0)
    cax = fig.add_axes([0.957, 0.34, 0.013, 0.34])
    bar = fp.colorbar(image, cax=cax, name="response", label="Response (s.d.)", ticks=[-2, 0, 2])
    bar.ax.tick_params(labelsize=5, width=0.5, length=2, pad=1.5)
    bar.set_label("")
    bar.outline.set_visible(False)
    fig.text(0.9635, 0.70, "s.d.", fontsize=5, color=MUTED, ha="center", va="bottom")
    fig.text(0.075, 0.955, "Bars: 2 s grating · trial-averaged ΔF/F, baseline-subtracted and scaled per cell", fontsize=5, color=MUTED, va="top")
    fig.text(0.945, 0.955, "143 cells · 2 Hz · 120 frames per direction", fontsize=5, color=MUTED, va="top", ha="right")
    pub.save(fig, name, title="Population response dynamics across eight directions",
             sources=["traces.json", "responses.json"],
             description="One 143-row response atlas with eight consecutive drift-direction blocks of the same 120 source frames (−30 to +89 relative to onset). Cells are grouped by preferred direction at 2 Hz and ordered by peak latency in the preferred block. Traces are Gaussian-smoothed (σ 1.5 frames), baseline-subtracted and divided by each cell's pooled standard deviation; colour saturates at ±2.5 s.d.",
             raster_dpi=300)


# ---------------------------------------------------------------------------
# 24 · Example cells: eight-direction trace gallery with tuning roses.
# ---------------------------------------------------------------------------
def gallery(pub: Publisher):
    name = "24-example-cells"
    if not pub.wants(name):
        return pub.keep_previous(name)
    ids = list(pub.responses["cell_specimen_ids"])
    raw = np.asarray(pub.traces["mean_trial_trace_pct"], float)
    frames = np.asarray(pub.traces["sample_frames_relative_to_onset"], float)
    two_hz = np.asarray(pub.responses["mean_response_pct"], float)[:, 1, :]
    fig = plt.figure(figsize=(6.0, 3.0))
    left, right, top, bottom = 0.09, 0.995, 0.885, 0.075
    rows = len(EXAMPLE_CELLS)
    trace_w = (right - left) * 0.80 / 8
    rose_w = (right - left) - 8 * trace_w
    row_h = (top - bottom) / rows
    for r, cell_id in enumerate(EXAMPLE_CELLS):
        cell = ids.index(cell_id)
        traces = gaussian_filter1d(raw[:, cell, :], 1.0, axis=-1, mode="nearest")
        base = traces[:, :30].mean()
        top_value = max(float((traces - base).max()), 1.0)
        y = top - (r + 1) * row_h
        for d in range(8):
            ax = fig.add_axes([left + d * trace_w, y + 0.012, trace_w * 0.94, row_h - 0.022])
            fp.panel(ax, f"cell-{cell_id}-direction-{d * 45}")
            window = ax.axvspan(0, 60, color="#f1efe6", linewidth=0, zorder=0)
            fp.tag(window, role="highlight-region", name=f"stimulus-{d * 45}")
            fp.line(ax, frames, traces[d] - base, series=f"cell-{cell_id}-direction-{d * 45}",
                    color=DIRECTION_COLORS[d], linewidth=0.85)
            ax.set_xlim(-30, 89)
            ax.set_ylim(-0.18 * top_value, 1.08 * top_value)
            ax.set_axis_off()
        rose = fig.add_axes([right - rose_w * 0.94, y + 0.01, rose_w * 0.92, row_h - 0.018], projection="polar")
        fp.panel(rose, f"cell-{cell_id}-tuning")
        values = np.maximum(two_hz[:, cell], 0)
        values = values / max(values.max(), 1e-9)
        theta = np.deg2rad(DIRECTIONS)
        preferred = int(np.argmax(values))
        # A periodic shape-preserving interpolation closes the rose between the
        # eight measured directions; the measured means stay as the point series.
        dense_theta = np.linspace(0, 2 * np.pi, 73)
        dense = PchipInterpolator(np.deg2rad(np.r_[DIRECTIONS, 360]), np.r_[values, values[0]])(dense_theta)
        dense = np.clip(dense, 0, None)
        shape = Polygon(np.column_stack([dense_theta, dense]), closed=True, facecolor=DIRECTION_COLORS[preferred], alpha=0.22, edgecolor="none", zorder=1)
        rose.add_patch(shape)
        fp.tag(shape, role="x-tuning-area", series=f"cell-{cell_id}-tuning-area")
        fp.line(rose, dense_theta, dense, series=f"cell-{cell_id}-tuning-guide", color=DIRECTION_COLORS[preferred], linewidth=0.7, zorder=2)
        fp.scatter(rose, theta, values, series=f"cell-{cell_id}-tuning", s=5, color=INK, edgecolors="none", zorder=4)
        fp.scatter(rose, [theta[preferred]], [values[preferred]], series=f"cell-{cell_id}-preferred",
                   s=11, color=DIRECTION_COLORS[preferred], edgecolors=PAPER, linewidths=0.4, zorder=5)
        rose.set_ylim(0, 1.15)
        rose.set_xticks([])
        rose.set_yticks([])
        rose.spines["polar"].set_color(RULE)
        rose.spines["polar"].set_linewidth(0.5)
        rose.grid(False)
        fig.text(left - 0.008, y + row_h / 2, f"{str(cell_id)[-4:]}", fontsize=5.4, color=INK, ha="right", va="center", fontweight="bold")
        fig.text(left - 0.008, y + row_h / 2 - 0.045, f"{top_value:.0f}%", fontsize=4.6, color=MUTED, ha="right", va="center")
    for d in range(8):
        hx = left + d * trace_w + trace_w * 0.47
        header = fig.add_axes([hx - 0.02, top + 0.005, 0.04, 0.085])
        header.set_axis_off()
        header.set_xlim(0, 1)
        header.set_ylim(0, 1)
        direction_arrow(header, 0.5, 0.5, d * 45, 0.7, DIRECTION_COLORS[d], lw=0.9, mutation=5)
    fig.text(right - rose_w * 0.48, top + 0.045, "tuning", fontsize=5, color=MUTED, ha="center", va="center")
    fig.text(left - 0.008, top + 0.045, "cell", fontsize=5, color=MUTED, ha="right", va="center")
    # One scale key for the whole gallery: 1 s of frames and the row's own peak.
    key = fig.add_axes([left, bottom - 0.06, trace_w * 0.94, 0.05])
    key.set_axis_off()
    key.set_xlim(-30, 89)
    key.set_ylim(0, 1)
    key.plot([0, 30], [0.75, 0.75], color=INK, lw=0.9, solid_capstyle="butt")
    key.text(15, 0.15, "1 s", fontsize=4.8, color=INK, ha="center", va="bottom")
    fig.text(left + trace_w * 1.1, bottom - 0.04, "shaded: 2 s grating · trace height = peak ΔF/F (left)", fontsize=4.8, color=MUTED, va="center")
    pub.save(fig, name, title="Example cells across eight drift directions",
             sources=["traces.json", "responses.json"],
             description="Four measured cells with strong, distinct direction preferences at 2 Hz. Each row shows the trial-averaged ΔF/F trace for every drift direction (lightly smoothed, baseline-subtracted, one vertical scale per row) and a polar rose of the cell's nonnegative mean responses; the coloured point marks its preferred direction.",
             force_vectors=True)


# ---------------------------------------------------------------------------
# 25 · Population trajectories in a shared three-dimensional PCA basis.
# ---------------------------------------------------------------------------
def trajectories(pub: Publisher):
    name = "25-population-trajectories"
    if not pub.wants(name):
        return pub.keep_previous(name)
    raw = np.asarray(pub.traces["mean_trial_trace_pct"], float)
    smooth = gaussian_filter1d(raw, 2.5, axis=-1, mode="nearest")
    baseline = smooth[:, :, :30].mean(axis=(0, 2))
    scale = np.maximum(smooth.std(axis=(0, 2)), 1e-9)
    standardized = (smooth - baseline[None, :, None]) / scale[None, :, None]
    observations = standardized.transpose(0, 2, 1).reshape(-1, 143)
    center = observations.mean(axis=0)
    _, singular, vectors = np.linalg.svd(observations - center, full_matrices=False)
    basis = vectors[:3].copy()
    for row in basis:
        row *= 1 if row[np.argmax(np.abs(row))] >= 0 else -1
    scores = ((observations - center) @ basis.T).reshape(8, 120, 3)
    explained = singular[:3] ** 2 / np.sum(singular ** 2)
    fig = plt.figure(figsize=(3.0, 3.0))
    ax = fig.add_axes([-0.02, 0.04, 0.94, 0.98], projection="3d")
    ax.view_init(elev=27, azim=-49)
    ax.set_proj_type("ortho")
    ax.set_box_aspect((1.25, 1.0, 0.8), zoom=1.06)
    minima, maxima = scores.min(axis=(0, 1)), scores.max(axis=(0, 1))
    span = maxima - minima
    limits = np.column_stack([minima - 0.08 * span, maxima + 0.08 * span])
    for axis, bounds, text in zip((ax.xaxis, ax.yaxis, ax.zaxis), limits,
                                  [f"PC {i + 1} · {x * 100:.0f}%" for i, x in enumerate(explained)]):
        axis.set_pane_color((1, 1, 1, 0))
        axis.line.set_color(RULE)
        axis.line.set_linewidth(0.6)
        axis._axinfo["grid"].update(color=mcolors.to_rgba(RULE, 0.7), linewidth=0.35)
        axis._axinfo["tick"].update(inward_factor=0.0, outward_factor=0.1)
        axis.set_ticks([-10, 0, 10] if bounds[0] < -9 or bounds[1] > 9 else [-5, 0, 5])
        axis.set_tick_params(labelsize=4.8, pad=-2, colors=MUTED)
        axis.set_label_text(text, fontsize=5.4)
        axis.labelpad = -3
    ax.set_xlim(*limits[0])
    ax.set_ylim(*limits[1])
    ax.set_zlim(*limits[2])
    for d, color in enumerate(DIRECTION_COLORS):
        pts = scores[d]
        shadow, = ax.plot(pts[:, 0], pts[:, 1], np.full(120, limits[2, 0]), color=color, linewidth=0.55, alpha=0.14, zorder=1)
        fp.tag(shadow, role="x-trajectory-projection", series=f"direction-{d * 45}-projection")
        before, = ax.plot(*pts[:31].T, color=color, linewidth=0.6, alpha=0.3, zorder=2)
        after, = ax.plot(*pts[89:].T, color=color, linewidth=0.6, alpha=0.4, zorder=2)
        fp.tag(before, role="x-population-trajectory", series=f"direction-{d * 45}-baseline")
        fp.tag(after, role="x-population-trajectory", series=f"direction-{d * 45}-recovery")
        active, = ax.plot(*pts[30:91].T, color=color, linewidth=1.35, solid_capstyle="round", zorder=4)
        fp.tag(active, role="x-population-trajectory", series=f"direction-{d * 45}-stimulus")
        onset = ax.scatter(*pts[30], color=color, edgecolors=PAPER, linewidths=0.4, s=13, depthshade=False, zorder=6)
        offset = ax.scatter(*pts[90], color=color, edgecolors=PAPER, linewidths=0.35, marker="s", s=10, depthshade=False, zorder=6)
        fp.tag(onset, role="x-stimulus-onset", series=f"direction-{d * 45}-onset")
        fp.tag(offset, role="x-stimulus-offset", series=f"direction-{d * 45}-offset")
    ax.set_zlabel("")
    fig.text(0.955, 0.6, f"PC 3 · {explained[2] * 100:.0f}%", rotation=90, fontsize=5.4, ha="center", va="center")
    fig.text(0.02, 0.02, "● onset   ■ offset   faint: pre-stimulus and recovery", fontsize=4.8, color=MUTED, va="bottom")
    fig.text(0.975, 0.02, "143 cells · 2 Hz", fontsize=4.8, color=MUTED, va="bottom", ha="right")
    pub.save(fig, name, title="Population trajectories during directional stimulation",
             sources=["traces.json"],
             description="Eight population trajectories in one three-dimensional PCA basis fitted to all 960 population states (smoothed σ 2.5 frames; each cell centred on its pooled baseline and scaled by its pooled standard deviation). Saturated lines are the 60 stimulus frames; circles and squares mark onset and offset; floor projections indicate geometry only.",
             force_vectors=True)


# ---------------------------------------------------------------------------
# 26 · Signal-correlation matrix sorted by preferred direction.
# ---------------------------------------------------------------------------
def similarity(pub: Publisher):
    name = "26-similarity-matrix"
    if not pub.wants(name):
        return pub.keep_previous(name)
    metrics = circular_metrics(pub.responses)
    corr = np.nan_to_num(np.asarray(pub.responses["signal_correlation"], float))
    corr = np.clip((corr + corr.T) / 2, -1, 1)
    np.fill_diagonal(corr, 1)
    theta = np.deg2rad(DIRECTIONS)
    angle = np.angle(np.sum(metrics["tuning"] * np.exp(1j * theta[:, None]), axis=0))
    order = np.lexsort((angle, metrics["pref"]))
    fig, ax = plt.subplots(figsize=(2.7, 3.0))
    fig.subplots_adjust(left=0.1, right=0.975, bottom=0.2, top=0.885)
    image = fp.heatmap(ax, corr[np.ix_(order, order)], series="signal-correlation", cmap=CORRELATION_CMAP,
                       vmin=-0.8, vmax=0.8, interpolation="nearest", aspect="equal", extent=(0, 143, 143, 0))
    counts = np.bincount(metrics["pref"], minlength=8)
    bounds = np.r_[0, np.cumsum(counts)]
    for i, (begin, end) in enumerate(zip(bounds[:-1], bounds[1:])):
        left = Rectangle((-8.5, begin), 5.5, end - begin, color=DIRECTION_COLORS[i], clip_on=False, linewidth=0)
        top = Rectangle((begin, -8.5), end - begin, 5.5, color=DIRECTION_COLORS[i], clip_on=False, linewidth=0)
        ax.add_patch(left)
        ax.add_patch(top)
        fp.tag(left, role="x-preference-group", series=f"rows-preferred-{i * 45}")
        fp.tag(top, role="x-preference-group", series=f"columns-preferred-{i * 45}")
    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_xlabel("143 cells, sorted by preferred direction", labelpad=4)
    cax = fig.add_axes([0.3, 0.085, 0.42, 0.026])
    bar = fp.colorbar(image, cax=cax, name="signal-correlation", label="Signal correlation (r)",
                      orientation="horizontal", ticks=[-0.8, -0.4, 0, 0.4, 0.8])
    bar.ax.tick_params(labelsize=5, width=0.5, length=2, pad=1.5)
    bar.set_label("Signal correlation (r)", fontsize=5.2, labelpad=2)
    bar.outline.set_visible(False)
    fig.text(0.1, 0.99, "Allen SDK signal correlation · 40 conditions", fontsize=5, color=MUTED, va="top")
    pub.save(fig, name, title="Shared stimulus preferences across the population",
             sources=["responses.json"],
             description="Allen SDK signal-correlation matrix for all 143 cells, symmetrized and ordered by preferred direction (colour strips) and then by circular response angle within each group. Diagonal blocks show cells with shared tuning; nothing here is anatomical connectivity.",
             raster_dpi=300)


# ---------------------------------------------------------------------------
# 27 · Circular response-similarity network.
# ---------------------------------------------------------------------------
def network(pub: Publisher):
    name = "27-similarity-network"
    if not pub.wants(name):
        return pub.keep_previous(name)
    metrics = circular_metrics(pub.responses)
    corr = np.nan_to_num(np.asarray(pub.responses["signal_correlation"], float))
    pref, peak = metrics["pref"], metrics["peak"]
    theta = np.deg2rad(DIRECTIONS)
    angle = np.angle(np.sum(metrics["tuning"] * np.exp(1j * theta[:, None]), axis=0))
    ordering = np.lexsort((angle, pref))
    n = len(ordering)
    sector_gap = 0.05
    span = (2 * np.pi - 8 * sector_gap) / n
    xy = np.zeros((n, 2))
    groups = []
    cursor = np.pi / 2
    for direction in range(8):
        group = [int(i) for i in ordering if pref[i] == direction]
        begin = cursor
        for i in group:
            a = cursor - span / 2
            xy[i] = [np.cos(a), np.sin(a)]
            cursor -= span
        groups.append((direction, begin, cursor, group))
        cursor -= sector_gap
    edges = [(i, j, float(corr[i, j])) for i in range(n) for j in range(i + 1, n) if corr[i, j] >= 0.6]
    edges.sort(key=lambda e: e[2])
    t = np.linspace(0, 1, 32)[:, None]
    curves, edge_colors, widths = [], [], []
    for i, j, r in edges:
        p0, p3 = xy[i] * 0.965, xy[j] * 0.965
        radial = 0.6 if pref[i] == pref[j] else 0.14
        p1, p2 = p0 * radial, p3 * radial
        curves.append((1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3)
        color = np.mean([to_rgb(DIRECTION_COLORS[pref[i]]), to_rgb(DIRECTION_COLORS[pref[j]])], axis=0)
        edge_colors.append((*color, 0.28 + 0.4 * (r - 0.6) / 0.4))
        widths.append(0.2 + 0.45 * (r - 0.6) / 0.4)
    fig, ax = plt.subplots(figsize=(2.7, 3.0))
    fig.subplots_adjust(left=0.03, right=0.97, top=0.965, bottom=0.11)
    links = LineCollection(curves, colors=edge_colors, linewidths=widths, capstyle="round")
    ax.add_collection(links)
    fp.tag(links, role="x-response-similarity", series="measured-response-links")
    sizes = 3 + 12 * np.sqrt(np.minimum(peak, np.quantile(peak, 0.95)) / np.quantile(peak, 0.95))
    for direction, start, end, group in groups:
        if not group:
            continue
        fp.scatter(ax, xy[group, 0], xy[group, 1], series=f"preference-{direction * 45}", s=sizes[group],
                   color=DIRECTION_COLORS[direction], edgecolors=PAPER, linewidths=0.3, zorder=5)
        arc = Arc((0, 0), 2.14, 2.14, theta1=np.rad2deg(end), theta2=np.rad2deg(start),
                  edgecolor=DIRECTION_COLORS[direction], linewidth=2.0, capstyle="butt")
        ax.add_patch(arc)
        fp.tag(arc, role="x-preference-sector", series=f"sector-{direction * 45}")
        a = (start + end) / 2
        ax.text(1.2 * np.cos(a), 1.2 * np.sin(a), f"{direction * 45}°", fontsize=5, color=DIRECTION_COLORS[direction], ha="center", va="center")
    ax.set_aspect("equal")
    ax.set_xlim(-1.3, 1.3)
    ax.set_ylim(-1.3, 1.3)
    ax.set_axis_off()
    fig.text(0.04, 0.03, f"{n} cells · {len(edges)} links with r ≥ 0.6", fontsize=5, color=INK, va="bottom")
    fig.text(0.96, 0.03, "node area: √peak response", fontsize=4.8, color=MUTED, va="bottom", ha="right")
    pub.save(fig, name, title="Circular response-similarity network",
             sources=["responses.json"],
             description="All 143 cells on a ring grouped by preferred drift direction; every pair with signal correlation ≥ 0.60 is linked, brighter and thicker for stronger correlation. Node area follows the square root of peak response (95th-percentile winsorized). Links summarize response similarity, not synapses.",
             force_vectors=True)


# ---------------------------------------------------------------------------
# 28 · Response geometry: the population in a two-dimensional PCA view.
# ---------------------------------------------------------------------------
def geometry(pub: Publisher):
    name = "28-response-geometry"
    if not pub.wants(name):
        return pub.keep_previous(name)
    metrics = circular_metrics(pub.responses)
    response = np.nan_to_num(np.asarray(pub.responses["mean_response_pct"], float))
    matrix = response.transpose(2, 0, 1).reshape(143, -1)
    z = (matrix - matrix.mean(axis=1, keepdims=True)) / np.maximum(matrix.std(axis=1, keepdims=True), 1e-6)
    centered = z - z.mean(axis=0, keepdims=True)
    u, singular, vt = np.linalg.svd(centered, full_matrices=False)
    scores = u[:, :2] * singular[:2]
    for c in range(2):
        if vt[c, np.argmax(np.abs(vt[c]))] < 0:
            scores[:, c] *= -1
    variance = singular ** 2 / np.sum(singular ** 2)
    fig, ax = plt.subplots(figsize=(3.3, 2.45))
    fig.subplots_adjust(left=0.14, right=0.975, bottom=0.17, top=0.93)
    xs, ys = scores[:, 0], scores[:, 1]
    pad = 0.6
    gx, gy = np.meshgrid(np.linspace(xs.min() - pad, xs.max() + pad, 140), np.linspace(ys.min() - pad, ys.max() + pad, 140))
    density = gaussian_kde(scores.T, bw_method=0.35)(np.vstack([gx.ravel(), gy.ravel()])).reshape(gx.shape)
    sorted_density = np.sort(density.ravel())[::-1]
    mass = np.cumsum(sorted_density) / sorted_density.sum()
    levels = np.sort([sorted_density[np.searchsorted(mass, x)] for x in (0.4, 0.7, 0.9)])
    ax.contourf(gx, gy, density, levels=[levels[0], levels[1], levels[2], density.max() * 1.01], colors=["#f5f3ea", "#ece9dc", "#e2dece"], zorder=0)
    ax.contour(gx, gy, density, levels=levels, colors=[FAINT], linewidths=0.4, zorder=1)
    for d in range(8):
        cells = np.flatnonzero(metrics["pref"] == d)
        fp.scatter(ax, xs[cells], ys[cells], series=f"direction-{d * 45}-cells", s=9, color=DIRECTION_COLORS[d],
                   edgecolors=PAPER, linewidths=0.3, alpha=0.95, zorder=3)
    ax.axhline(0, color=RULE, linewidth=0.5, zorder=0)
    ax.axvline(0, color=RULE, linewidth=0.5, zorder=0)
    ax.set_xlabel(f"PC 1 ({variance[0] * 100:.1f}%)")
    ax.set_ylabel(f"PC 2 ({variance[1] * 100:.1f}%)")
    ax.locator_params(nbins=4)
    fx.despine(ax)
    fig.text(0.975, 0.955, "one point per cell · 40 conditions", fontsize=4.8, color=MUTED, ha="right", va="top")
    pub.save(fig, name, title="Population response geometry",
             sources=["responses.json"],
             description="PCA of the 143 × 40 matrix of condition means after within-cell standardization and feature centring. Points are cells coloured by preferred direction; shaded contours enclose 40, 70 and 90% of the kernel-density mass and are a visual guide only.",
             force_vectors=True)


# ---------------------------------------------------------------------------
# 29 · Direction key shared by every panel.
# ---------------------------------------------------------------------------
def direction_key(pub: Publisher):
    name = "29-direction-key"
    if not pub.wants(name):
        return pub.keep_previous(name)
    fig = plt.figure(figsize=(1.05, 1.05))
    ax = fig.add_axes([0.14, 0.12, 0.72, 0.72], projection="polar")
    theta = np.deg2rad(DIRECTIONS)
    bars = fp.bar(ax, theta, np.full(8, 0.32), series="direction-wheel", bottom=0.68,
                  width=np.deg2rad(45) * 0.86, color=DIRECTION_COLORS, linewidth=0)
    ax.set_ylim(0, 1.0)
    ax.set_xticks([])
    ax.set_yticks([])
    ax.spines["polar"].set_visible(False)
    ax.grid(False)
    for d in range(8):
        direction_arrow(ax, 0.5 + 0.26 * np.cos(theta[d]), 0.5 + 0.26 * np.sin(theta[d]), d * 45, 0.16, DIRECTION_COLORS[d], lw=0.8, mutation=4)
    for angle, text in ((0, "0°"), (90, "90°"), (180, "180°"), (270, "270°")):
        x, y = 0.5 + 0.62 * np.cos(np.deg2rad(angle)), 0.5 + 0.62 * np.sin(np.deg2rad(angle))
        fig.text(x, y, text, fontsize=4.8, color=MUTED, ha="center", va="center")
    fig.text(0.5, 0.01, "drift direction", fontsize=4.8, color=MUTED, ha="center", va="bottom")
    pub.save(fig, name, title="Drift-direction colour key",
             sources=["responses.json"],
             description="The eight-hue wheel used for drift direction throughout the figure: 0° to 315° in 45° steps, with arrows showing the direction of motion.",
             force_vectors=True)


# ---------------------------------------------------------------------------
# 30 · Orientation versus direction selectivity with marginal distributions.
# ---------------------------------------------------------------------------
def selectivity(pub: Publisher):
    name = "30-selectivity"
    if not pub.wants(name):
        return pub.keep_previous(name)
    metrics = circular_metrics(pub.responses)
    osi, dsi, pref, peak = metrics["osi"], metrics["dsi"], metrics["pref"], metrics["peak"]
    fig = plt.figure(figsize=(3.3, 2.45))
    main = fig.add_axes([0.14, 0.17, 0.64, 0.62])
    top = fig.add_axes([0.14, 0.80, 0.64, 0.15], sharex=main)
    right = fig.add_axes([0.79, 0.17, 0.18, 0.62], sharey=main)
    fp.panel(main, "joint")
    fp.panel(top, "orientation")
    fp.panel(right, "direction")
    sizes = 4 + 16 * np.sqrt(np.minimum(peak, np.quantile(peak, 0.95)) / np.quantile(peak, 0.95))
    for d in range(8):
        cells = np.flatnonzero(pref == d)
        fp.scatter(main, osi[cells], dsi[cells], series=f"direction-{d * 45}-cells", s=sizes[cells],
                   color=DIRECTION_COLORS[d], edgecolors=PAPER, linewidths=0.3, alpha=0.92, zorder=3)
    main.plot([0, 1], [0, 1], color=RULE, linewidth=0.5, zorder=0)
    main.set_xlim(0, 1)
    main.set_ylim(0, 1)
    main.set_xticks([0, 0.5, 1])
    main.set_yticks([0, 0.5, 1])
    main.set_xlabel("Orientation selectivity")
    main.set_ylabel("Direction selectivity")
    fx.despine(main)
    bins = np.linspace(0, 1, 16)
    fp.hist(top, osi, series="orientation-selectivity", bins=bins, color=fx.FLEXOKI["cyan"], alpha=0.75, linewidth=0)
    fp.hist(right, dsi, series="direction-selectivity", bins=bins, color=fx.FLEXOKI["blue"], alpha=0.75, linewidth=0, orientation="horizontal")
    for side in (top, right):
        side.set_axis_off()
    fig.text(0.14, 0.975, "circular vector strengths · one point per cell · area: √peak", fontsize=4.8, color=MUTED, va="top")
    pub.save(fig, name, title="Orientation versus direction selectivity",
             sources=["responses.json"],
             description="Circular orientation and direction vector strengths for all 143 cells from nonnegative direction means at each cell's best mean-response temporal frequency (not the SDK OSI/DSI). Marginal histograms use 15 equal bins; point colour is preferred direction, point area the square root of the peak response.",
             force_vectors=True)


# ---------------------------------------------------------------------------
# 31 · Temporal-frequency tuning at each cell's preferred direction.
# ---------------------------------------------------------------------------
def frequency(pub: Publisher):
    name = "31-frequency-tuning"
    if not pub.wants(name):
        return pub.keep_previous(name)
    metrics = circular_metrics(pub.responses)
    positive = metrics["positive"]
    frequencies = np.asarray(pub.responses["temporal_frequencies_hz"], float)
    pref = metrics["pref"]
    curves = positive[pref, :, np.arange(143)]  # cells × frequencies
    peak = curves.max(axis=1)
    keep = peak > np.quantile(peak, 0.25)
    normalized = curves[keep] / peak[keep, None]
    x = np.log2(frequencies)
    fig, ax = plt.subplots(figsize=(3.3, 2.45))
    fig.subplots_adjust(left=0.14, right=0.975, bottom=0.17, top=0.9)
    q10, q25, q75, q90 = np.quantile(normalized, [0.1, 0.25, 0.75, 0.9], axis=0)
    fp.area(ax, x, q10, q90, series="cells-10-90-percentile", color="#e6e4d9", alpha=0.8, linewidth=0)
    fp.area(ax, x, q25, q75, series="cells-interquartile", color="#cfcbbd", alpha=0.85, linewidth=0)
    mean = normalized.mean(axis=0)
    sem = normalized.std(axis=0, ddof=1) / np.sqrt(len(normalized))
    band = fp.area(ax, x, mean - sem, mean + sem, series="population-sem", color=fx.FLEXOKI["cyan"], alpha=0.28, linewidth=0)
    fp.line(ax, x, mean, series="population-mean", color=fx.FLEXOKI["cyan"], linewidth=1.4, marker="o", markersize=3.2, markeredgecolor=PAPER, markeredgewidth=0.4)
    preferred_tf = np.argmax(curves[keep], axis=1)
    counts = np.bincount(preferred_tf, minlength=5) / keep.sum()
    bars = fp.bar(ax, x, counts * 0.35, series="preferred-frequency-share", bottom=-0.02, width=0.22, color="#9f9d96", linewidth=0, alpha=0.9)
    ax.set_xticks(x, [f"{f:g}" for f in frequencies])
    ax.set_yticks([0, 0.5, 1])
    ax.set_ylim(-0.02, 1.05)
    ax.set_xlim(x[0] - 0.35, x[-1] + 0.35)
    ax.set_xlabel("Temporal frequency (Hz)")
    ax.set_ylabel("Response / peak")
    fx.despine(ax)
    ax.text(x[-1] + 0.3, 0.05, "bars: share of cells\npreferring each frequency", fontsize=4.6, color=MUTED, ha="right", va="bottom")
    ax.text(x[0] - 0.25, 0.97, "bands: 10–90% and\ninterquartile range", fontsize=4.6, color=MUTED, ha="left", va="top")
    fig.text(0.14, 0.965, f"{keep.sum()} responsive cells at their preferred direction · mean ± s.e.m.", fontsize=4.8, color=MUTED, va="top")
    pub.save(fig, name, title="Temporal-frequency tuning",
             sources=["responses.json"],
             description="Nonnegative mean responses across the five temporal frequencies at each cell's preferred direction, divided by the cell's peak. Faint lines are the individual cells above the 25th percentile of peak response; the line and band are the population mean ± s.e.m.; grey bars give the share of those cells whose peak lies at each frequency.",
             force_vectors=True)


# ---------------------------------------------------------------------------
# 32 · Distribution of preferred directions.
# ---------------------------------------------------------------------------
def preferences(pub: Publisher):
    name = "32-preferred-directions"
    if not pub.wants(name):
        return pub.keep_previous(name)
    metrics = circular_metrics(pub.responses)
    counts = np.bincount(metrics["pref"], minlength=8)
    theta = np.deg2rad(DIRECTIONS)
    fig = plt.figure(figsize=(2.9, 2.45))
    ax = fig.add_axes([0.2, 0.09, 0.6, 0.78], projection="polar")
    fp.bar(ax, theta, counts, series="preferred-direction-count", width=np.deg2rad(45) * 0.82,
           color=DIRECTION_COLORS, linewidth=0, alpha=0.95, bottom=0)
    ax.set_ylim(0, counts.max() * 1.22)
    ax.set_xticks(theta[::2], ["0°", "90°", "180°", "270°"])
    ax.tick_params(axis="x", labelsize=5.2, pad=-1)
    ax.set_yticks([10, 20, 30])
    ax.set_yticklabels([])
    ax.grid(color=RULE, linewidth=0.45)
    ax.spines["polar"].set_visible(False)
    for angle, count in zip(theta, counts):
        ax.text(angle, count + counts.max() * 0.1, str(int(count)), fontsize=5, color=INK, ha="center", va="center")
    fig.text(0.03, 0.965, "cells per preferred direction", fontsize=5, color=MUTED, ha="left", va="top")
    fig.text(0.03, 0.02, f"n = {counts.sum()} · rings every 10 cells", fontsize=4.8, color=MUTED, ha="left", va="bottom")
    pub.save(fig, name, title="Distribution of preferred directions",
             sources=["responses.json"],
             description="Number of cells preferring each of the eight drift directions (nonnegative mean response at the best mean-response temporal frequency). Rings mark 10, 20 and 30 cells.",
             force_vectors=True)


# ---------------------------------------------------------------------------
# 33 · Orientation selectivity at each temporal frequency (supporting figure).
# ---------------------------------------------------------------------------
def frequency_selectivity(pub: Publisher):
    name = "33-frequency-selectivity"
    if not pub.wants(name):
        return pub.keep_previous(name)
    positive = np.maximum(np.nan_to_num(np.asarray(pub.responses["mean_response_pct"], float)), 0)
    frequencies = np.asarray(pub.responses["temporal_frequencies_hz"], float)
    theta = np.deg2rad(DIRECTIONS)
    rng = np.random.default_rng(20260914)
    fig, ax = plt.subplots(figsize=(3.3, 3.3))
    fig.subplots_adjust(left=0.15, right=0.975, bottom=0.135, top=0.93)
    for f, hz in enumerate(frequencies):
        data = positive[:, f, :]
        metric = np.abs(np.sum(data * np.exp(2j * theta[:, None]), axis=0)) / np.maximum(data.sum(axis=0), 1e-12)
        violin = fp.violin(ax, metric, series=f"frequency-{hz:g}", positions=[f], widths=0.72, showmeans=False,
                           showmedians=True, showextrema=False, include_values=True)
        for body in violin["bodies"]:
            body.set_facecolor(fx.FLEXOKI["cyan"])
            body.set_alpha(0.18)
            body.set_edgecolor(fx.FLEXOKI["cyan"])
            body.set_linewidth(0.5)
        violin["cmedians"].set_color(fx.FLEXOKI["cyan"])
        violin["cmedians"].set_linewidth(1.4)
        fp.scatter(ax, f + rng.uniform(-0.16, 0.16, len(metric)), metric, series=f"frequency-{hz:g}-cells",
                   s=3.2, color=fx.FLEXOKI["blue"], alpha=0.35, edgecolors="none", zorder=3)
    ax.set_xticks(range(5), [f"{f:g}" for f in frequencies])
    ax.set_ylim(0, 1.05)
    ax.set_yticks([0, 0.5, 1])
    ax.set_xlabel("Temporal frequency (Hz)")
    ax.set_ylabel("Circular orientation selectivity")
    fx.despine(ax)
    fig.text(0.15, 0.975, "143 cells at every frequency · lines: medians · violins: kernel density", fontsize=4.8, color=MUTED, va="top")
    pub.save(fig, name, title="Orientation selectivity across temporal frequency",
             sources=["responses.json"],
             description="Circular orientation vector strength computed independently at each of the five measured temporal frequencies from nonnegative direction means; every cell appears at every frequency. Violin outlines are kernel-density summaries and the horizontal lines are medians.",
             force_vectors=True)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
PANELS = [anatomy, neurons, atlas, gallery, trajectories, similarity, network, geometry, direction_key,
          selectivity, frequency, preferences, frequency_selectivity]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--only", type=str, default=os.environ.get("FLUXPLOT_ONLY", ""))
    args = parser.parse_args()
    only = [x.strip() for x in args.only.split(",") if x.strip()]
    pub = Publisher(args.project.resolve(), only)
    for panel in PANELS:
        panel(pub)
    pub.finish()


if __name__ == "__main__":
    main()
