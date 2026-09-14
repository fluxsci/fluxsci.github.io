#!/usr/bin/env python3
"""Original Flux website figures from public Allen Institute data.

Usage (requires numpy, scipy, matplotlib, fluxplot):
    python scripts/generate-plots.py --project /path/to/neural-populations
    python scripts/generate-plots.py --data-dir data/allen --output plots

No research data are synthesized. All statistics are descriptive transformations of the
retrieved measurements. Anatomy and functional cohorts are deliberately kept separate.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import warnings
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection, PolyCollection
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.lines import Line2D
from scipy import stats
from scipy.cluster.hierarchy import linkage, leaves_list
from scipy.spatial.distance import squareform
from scipy.sparse.csgraph import connected_components
import fluxplot as fp

COLORS = dict(ink="#1b2838", navy="#315c80", teal="#26857d", orange="#cc8249", plum="#895d86", gray="#8d969b", light="#e4e9e9", rule="#c5ced1", background="#ffffff")
PALETTE = [COLORS[x] for x in ("navy", "teal", "orange", "plum")]
CMAP = LinearSegmentedColormap.from_list("flux-neural-response", ["#f5f6f2", "#c1dbd2", "#4e9e98", "#295c73", "#202f4b"])
DIVERGING = LinearSegmentedColormap.from_list("flux-neural-correlation", ["#a75c65", "#f5f4ef", "#287b8c"])
plt.rcParams.update({
    "font.family": "Arial", "font.size": 7.2, "axes.labelsize": 7.2,
    "axes.titlesize": 8.2, "axes.titleweight": "normal", "axes.titlepad": 10,
    "axes.linewidth": .55, "axes.edgecolor": COLORS["gray"],
    "axes.labelcolor": COLORS["ink"], "text.color": COLORS["ink"],
    "xtick.color": COLORS["gray"], "ytick.color": COLORS["gray"],
    "xtick.labelcolor": COLORS["ink"], "ytick.labelcolor": COLORS["ink"],
    "xtick.labelsize": 6.2, "ytick.labelsize": 6.2,
    "xtick.major.size": 2.5, "ytick.major.size": 2.5,
    "xtick.major.width": .5, "ytick.major.width": .5,
    "xtick.major.pad": 3, "ytick.major.pad": 3,
    "axes.spines.top": False, "axes.spines.right": False,
    "grid.color": COLORS["light"], "grid.linewidth": .45,
    "legend.fontsize": 6.2, "legend.frameon": False,
    "lines.linewidth": 1.3, "figure.facecolor": "white", "axes.facecolor": "white",
    "savefig.facecolor": "white", "svg.fonttype": "none", "svg.hashsalt": "flux-neural-original-v1",
})


def panel(title, size=(3.2, 2.55), projection=None):
    fig, ax = plt.subplots(figsize=size, subplot_kw={"projection": projection} if projection else {})
    fig.subplots_adjust(left=.18, right=.96, top=.82, bottom=.22)
    ax.set_title(title, loc="left", pad=10)
    return fig, ax


def note(fig, text, x=.18):
    fig.text(x, .055, text, fontsize=5.6, color=COLORS["gray"], va="bottom")


def load_obj(path):
    vertices, faces = [], []
    with open(path) as handle:
        for line in handle:
            if line.startswith("v "):
                vertices.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("f "):
                ids = [int(x.split('/')[0]) - 1 for x in line.split()[1:]]
                for j in range(1, len(ids)-1):
                    faces.append([ids[0], ids[j], ids[j+1]])
    return np.asarray(vertices), np.asarray(faces, dtype=int)


def project_mesh(vertices, faces):
    # Allen CCF coordinates: anterior-posterior, dorsal-ventral, left-right.
    # This oblique dorsal projection displays anatomical geometry, never a statistical map.
    p = np.column_stack([vertices[:, 2] - 5700, -(vertices[:, 0] - 6600), -(vertices[:, 1] - 3700)]) / 1000
    a = np.deg2rad(20)
    b = np.deg2rad(28)
    rz = np.array([[np.cos(a), -np.sin(a), 0], [np.sin(a), np.cos(a), 0], [0, 0, 1]])
    rx = np.array([[1, 0, 0], [0, np.cos(b), -np.sin(b)], [0, np.sin(b), np.cos(b)]])
    p = p @ rz.T @ rx.T
    tri = p[faces]
    normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    lens = np.linalg.norm(normals, axis=1)
    normals /= np.maximum(lens[:, None], 1e-9)
    order = np.argsort(tri[:, :, 2].mean(axis=1))
    illumination = .82 + .18 * np.abs(normals @ np.array([-.2, .3, .9327]))
    return tri[order, :, :2], illumination[order]


class Publisher:
    def __init__(self, output, data):
        self.output, self.data, self.records = output, data, []
        output.mkdir(parents=True, exist_ok=True)

    def save(self, fig, name, title, source_files, description, *, group="functional", main=True):
        path = self.output / f"{name}.svg"
        result = fp.save(fig, str(path), raster_dpi=400, raster_threshold=800,
                         recipe={"script": os.path.relpath(Path(__file__).resolve(), self.output),
                                 "params": {}, "inputs": [str(self.data / f) for f in source_files]})
        # Recipes ship with the example, so retain content hashes and versions while
        # replacing machine-specific interpreter and absolute paths with portable ones.
        recipe_path = path.with_suffix('.recipe.json')
        recipe = json.loads(recipe_path.read_text())
        recipe.update(command='python3', cwd='..',
                      args=['scripts/generate-plots.py', '--project', '.'],
                      script={'path': 'scripts/generate-plots.py'})
        for item in recipe.get('inputs', []):
            item['path'] = 'data/allen/' + Path(item['path']).name
        recipe_path.write_text(json.dumps(recipe, indent=2) + '\n')
        preview_dir = self.output.parent / 'exports' / 'plot-previews'
        preview_dir.mkdir(parents=True, exist_ok=True)
        fig.savefig(preview_dir / f'{name}.png', dpi=180)
        w, h = fig.get_size_inches()
        m = json.loads(path.with_suffix('.fluxplot.json').read_text())
        self.records.append(dict(id=name, title=title, file=path.name, manifest=path.with_suffix('.fluxplot.json').name,
                                 widthIn=float(w), heightIn=float(h), widthPx=float(w*96), heightPx=float(h*96),
                                 description=description, cohort=group, flagship=main,
                                 series=[s['id'] for s in m.get('series', [])],
                                 buildOrder=m.get('build', {}).get('order', [])))
        plt.close(fig)
        (self.output / "inventory.json").write_text(json.dumps({"panels": self.records}, indent=2) + '\n')
        print(f"Wrote {path.name}", flush=True)


def anatomy(pub):
    fig, ax = panel("Visual areas in the mouse brain")
    ax.set_position([.08, .18, .86, .65]); ax.set_axis_off()
    mesh_specs = [(997, "brain-envelope", "#d8dedf"), (385, "primary-visual-area", "#a3c7c4"), (409, "lateral-visual-area", COLORS['teal'])]
    for structure, name, color in mesh_specs:
        vertices, faces = load_obj(pub.data / f"ccf-2017-{structure}.obj")
        triangles, illumination = project_mesh(vertices, faces)
        base = np.array(matplotlib.colors.to_rgb(color))
        facecolors = np.clip(base[None, :] * illumination[:, None], 0, 1)
        artist = PolyCollection(triangles, facecolors=facecolors, edgecolors="none", linewidths=0, antialiased=False)
        ax.add_collection(artist)
        fp.tag(artist, role="x-brain-surface", series=name)
    ax.autoscale_view(); ax.set_aspect('equal')
    handles = [Line2D([], [], marker='s', linestyle='none', markersize=4, markerfacecolor=c, markeredgecolor='none', label=t)
               for c, t in [(COLORS['teal'], 'VISl · recorded area'), ('#a3c7c4', 'VISp · anatomical context')]]
    ax.legend(handles=handles, loc='upper center', bbox_to_anchor=(.5, .03), ncol=1, handletextpad=.5, labelspacing=.5)
    fig.text(.08, .018, 'Allen CCFv3 · oblique dorsal view', fontsize=5.3, color=COLORS['gray'])
    pub.save(fig, '01-brain-regions', 'Visual areas in the mouse brain',
             [f'ccf-2017-{n}.obj' for n, _, _ in mesh_specs],
             'Actual Allen CCF2017 surface geometry. VISl is the functional recording target; VISp is anatomical context. No functional measurement is projected onto the mesh.', group='Allen CCF2017 atlas')

    fig, ax = panel("Cellular architecture")
    ax.set_position([.06, .19, .91, .64]); ax.set_axis_off()
    specs = [(480114344, 'Rorb', COLORS['orange']), (464198958, 'Sst', COLORS['teal']), (464212183, 'Sst', COLORS['plum'])]
    for i, (cell_id, label, color) in enumerate(specs):
        swc = np.loadtxt(pub.data / f'cell-{cell_id}.swc', comments='#')
        by_id = {int(r[0]): r for r in swc}
        soma = swc[swc[:, 1] == 1][0, 2:5]
        segments = []
        for r in swc:
            parent = by_id.get(int(r[6]))
            if parent is None: continue
            a = r[2:4] - soma[:2]; b = parent[2:4] - soma[:2]
            segments.append([a + [i*650, 0], b + [i*650, 0]])
        col = LineCollection(segments, colors=color, linewidths=.43, alpha=.8)
        ax.add_collection(col); fp.tag(col, role='x-neuron-morphology', series=f'cell-{cell_id}')
        fp.scatter(ax, [i*650], [0], series=f'cell-{cell_id}-soma', s=7, c=color, edgecolors='none')
        ax.text(i*650, -360, label, ha='center', va='top', fontsize=6.8, color=color)
        ax.text(i*650, -425, str(cell_id), ha='center', va='top', fontsize=4.8, color=COLORS['gray'])
    ax.autoscale_view(); ax.set_aspect('equal')
    x0, x1 = ax.get_xlim(); y0, y1 = ax.get_ylim()
    fp.line(ax, [x0+30, x0+130], [y0+20, y0+20], series='scale-100um', color=COLORS['ink'], linewidth=1.3)
    ax.text(x0+80, y0+60, '100 μm', ha='center', fontsize=5.7)
    note(fig, "Allen Cell Types · separate specimens, not the imaged cells", x=.06)
    pub.save(fig, '02-neuron-morphology', 'Cellular architecture', [f'cell-{n}.swc' for n, _, _ in specs],
             'Three actual SWC reconstructions, at a shared scale. These anatomical specimens are independent of the functional imaging cohort.', group='Allen Cell Types anatomical specimens')


def functional(pub):
    source = json.loads((pub.data / 'responses.json').read_text())
    response = np.asarray(source['mean_response_pct'], dtype=float)
    sem = np.asarray(source['sem_response_pct'], dtype=float)
    ids = np.asarray(source['cell_specimen_ids'])
    directions = np.asarray(source['directions_deg'])
    frequencies = np.asarray(source['temporal_frequencies_hz'])
    n = len(ids)
    positive = np.maximum(np.nan_to_num(response), 0)
    # Best temporal frequency is selected by the mean positive response across directions.
    # This descriptive convention is used consistently below and recorded in the captions.
    best_tf = np.argmax(positive.mean(axis=0), axis=0)
    tuning = positive[:, best_tf, np.arange(n)]
    raw_tuning = response[:, best_tf, np.arange(n)]
    tuning_sem = sem[:, best_tf, np.arange(n)]
    pref = np.argmax(tuning, axis=0)
    peak = tuning.max(axis=0)
    theta = np.deg2rad(directions)
    denom = np.maximum(tuning.sum(axis=0), 1e-12)
    dsi = np.abs(np.sum(tuning * np.exp(1j*theta[:, None]), axis=0)) / denom
    osi = np.abs(np.sum(tuning * np.exp(2j*theta[:, None]), axis=0)) / denom
    direction_colors = ['#315c80', '#588fa8', '#26857d', '#86a390', '#c5ab79', '#cc8249', '#895d86', '#63658b']
    examples = []
    for preferred in [0, 2, 4, 6]:
        possible = np.flatnonzero((pref == preferred) & (peak > np.quantile(peak, .45)))
        if not len(possible): possible = np.flatnonzero(pref == preferred)
        if not len(possible): possible = np.argsort(peak)[-15:]
        chosen = possible[np.argmax(osi[possible] * np.sqrt(np.maximum(peak[possible], 0)))]
        if chosen not in examples: examples.append(int(chosen))
    for cell in np.argsort(peak)[::-1]:
        if len(examples) >= 4: break
        if cell not in examples: examples.append(int(cell))
    matrix = np.nan_to_num(response.transpose(2, 0, 1).reshape(n, -1))
    centered = matrix - matrix.mean(axis=1, keepdims=True)
    z = centered / np.maximum(matrix.std(axis=1, keepdims=True), 1e-6)
    pca_input = z - z.mean(axis=0, keepdims=True)
    u, singular, vt = np.linalg.svd(pca_input, full_matrices=False)
    scores = u[:, :2] * singular[:2]
    # Resolve SVD sign ambiguity deterministically from each loading's largest element.
    for c in range(2):
        if vt[c, np.argmax(np.abs(vt[c]))] < 0: scores[:, c] *= -1
    variance = singular**2 / np.sum(singular**2)
    correlation = np.nan_to_num(np.asarray(source['signal_correlation'], float))
    correlation = np.clip((correlation + correlation.T)/2, -1, 1)
    np.fill_diagonal(correlation, 1)
    distance = np.maximum(0, 1 - correlation)
    order = leaves_list(linkage(squareform(distance, checks=False), method='average'))
    order_tuning = np.lexsort((-peak, pref))

    fig, ax = panel('A population of tuning profiles')
    fig.subplots_adjust(left=.17, right=.82, top=.81, bottom=.24)
    img = fp.heatmap(ax, z[order_tuning], series='cell-responses', include_values=True,
                     cmap=CMAP, vmin=-1.5, vmax=2.5, aspect='auto', interpolation='nearest')
    ax.set_xticks(np.arange(8)*5 + 2, [str(d) for d in directions])
    ax.set_yticks([0, 49, 99, n-1], ['1', '50', '100', str(n)])
    ax.set_xlabel('Drift direction (°)'); ax.set_ylabel('Cells, ordered by preference')
    cax = fig.add_axes([.86, .31, .025, .38])
    cb = fp.colorbar(img, cax=cax, label='Within-cell z score', ticks=[-1, 0, 1, 2])
    cb.ax.tick_params(labelsize=5.5, width=.4, length=2)
    cb.set_label('Within-cell z score', fontsize=6)
    for spine in ax.spines.values(): spine.set_visible(False)
    note(fig, f'{n} cells × 40 conditions · five frequencies per direction', x=.08)
    pub.save(fig, '03-response-heatmap', 'A population of tuning profiles', ['responses.json'],
             'Actual direction-by-frequency mean calcium responses, z-scored within each cell. All 143 cells and 40 conditions are shown. Color range -1.5 to2.5 z; saturation is display clipping only.')

    fig, ax = panel('Direction tuning, cell by cell', projection='polar')
    ax.set_position([.13, .22, .65, .58]); ax.set_title('Direction tuning, cell by cell', loc='left', pad=20)
    ax.spines['polar'].set_linewidth(.5); ax.spines['polar'].set_color(COLORS['rule'])
    ax.grid(True); ax.set_theta_zero_location('E'); ax.set_theta_direction(1)
    for i, cell in enumerate(examples):
        values = tuning[:, cell] / max(peak[cell], 1e-12)
        fp.line(ax, np.r_[theta, theta[0]], np.r_[values, values[0]], series=f'cell-{ids[cell]}-tuning', color=PALETTE[i], marker='o', markersize=2, linewidth=1.2, label=str(ids[cell])[-4:])
    ax.set_ylim(0, 1.12); ax.set_yticks([.5, 1]); ax.set_yticklabels(['.5', '1'], fontsize=5)
    ax.set_xticks(theta[::2], ['0°', '90°', '180°', '270°']); ax.tick_params(axis='x', labelsize=6)
    ax.legend(title='Cell ID suffix', title_fontsize=5.5, loc='center left', bbox_to_anchor=(1.09, .48), handlelength=1.3, labelspacing=.7)
    note(fig, 'Positive response / cell peak · best mean-response frequency', x=.05)
    pub.save(fig, '04-tuning-curves', 'Direction tuning, cell by cell', ['responses.json'],
             f'Four selected measured cells {ids[examples].tolist()}; curves show nonnegative mean responses normalized by the cell peak at its best mean-response temporal frequency. Cell selection favors clear responses at four different preferred directions.')

    fig, ax = panel('A network of response similarity')
    ax.set_position([.08, .18, .84, .64]); ax.set_axis_off()
    upper = np.triu(correlation, 1)
    all_edges = np.argwhere(upper >= .50)
    graph = correlation >= .50
    np.fill_diagonal(graph, False)
    _, components = connected_components(graph)
    largest = np.argmax(np.bincount(components))
    visible_cells = np.flatnonzero(components == largest)
    is_visible = np.isin(np.arange(n), visible_cells)
    edge_indices = all_edges[is_visible[all_edges[:, 0]] & is_visible[all_edges[:, 1]]]
    # The largest connected component is explicitly labeled; every retained edge is real.
    # A force-directed layout encodes no anatomical position.
    # Deterministic Fruchterman–Reingold layout. Randomness positions marks only;
    # every node, edge and edge weight still comes from the retrieved measurements.
    rng_layout = np.random.default_rng(47)
    count = len(visible_cells)
    xy_visible = rng_layout.normal(0, .3, (count, 2))
    adjacency = correlation[np.ix_(visible_cells, visible_cells)]
    adjacency = np.where(adjacency >= .50, adjacency, 0)
    np.fill_diagonal(adjacency, 0)
    k = np.sqrt(1 / count)
    for iteration in range(240):
        delta = xy_visible[:, None, :] - xy_visible[None, :, :]
        distance = np.maximum(np.sqrt(np.sum(delta**2, axis=2)), .005)
        force = np.sum(delta * (k*k/distance**2 - adjacency*distance/k)[:, :, None], axis=1)
        norm = np.maximum(np.linalg.norm(force, axis=1), 1e-10)
        temperature = .075 * (1 - iteration/240)
        xy_visible += force / norm[:, None] * np.minimum(norm, temperature)[:, None]
        xy_visible -= xy_visible.mean(axis=0)
    xy_visible /= np.max(np.abs(xy_visible))
    xy = np.zeros((n, 2)); xy[visible_cells] = xy_visible
    layout_name = 'force-directed'
    if len(edge_indices):
        lines = LineCollection(xy[edge_indices], color=COLORS['gray'], linewidths=.5, alpha=.28)
        ax.add_collection(lines); fp.tag(lines, role='x-similarity-edges', series='signal-correlation-edges')
    for direction in range(8):
        cells = np.flatnonzero((pref == direction) & is_visible)
        fp.scatter(ax, xy[cells, 0], xy[cells, 1], series=f'direction-{directions[direction]}-cells', s=9+11*osi[cells], color=direction_colors[direction], edgecolors='white', linewidths=.25, zorder=3)
    ax.autoscale_view(); ax.margins(.08); ax.set_aspect('equal')
    handles = [Line2D([], [], marker='o', linestyle='none', markersize=3,
                      markerfacecolor=direction_colors[i], markeredgewidth=0,
                      label=f'{int(d)}°') for i, d in enumerate(directions)]
    fig.legend(handles=handles, loc='lower center', bbox_to_anchor=(.5, .06), ncol=8,
               fontsize=4.5, handlelength=.5, handletextpad=.3, columnspacing=.7)
    fig.text(.05, .025, f'Largest component: {count}/{n} cells · {len(edge_indices)} edges · r ≥ 0.50', fontsize=5.2, color=COLORS['gray'])
    pub.save(fig, '05-response-network', 'A network of response similarity', ['responses.json'],
             f'The largest connected component contains {count} of {n} measured cells and {len(edge_indices)} edges at signal correlation ≥0.50. Other components and isolated cells are omitted from this view. Colors encode preferred drift direction. Layout is {layout_name}; this is not anatomical connectivity.')

    fig, ax = panel('Selectivity varies across cells')
    bins = np.linspace(0, 1, 13)
    for data, name, color, label in [(osi, 'orientation-selectivity', COLORS['teal'], 'Orientation'), (dsi, 'direction-selectivity', COLORS['navy'], 'Direction')]:
        fp.hist(ax, data, series=name, bins=bins, include_values=True, density=True, color=color, alpha=.17, linewidth=0)
        grid = np.linspace(0, 1, 200)
        density = stats.gaussian_kde(data)(grid)
        fp.line(ax, grid, density, series=f'{name}-density', color=color, label=label)
    ax.set_xlim(0, 1); ax.set_xlabel('Circular selectivity'); ax.set_ylabel('Density'); ax.legend(loc='upper right', handlelength=1.5)
    ax.set_yticks([0, 1, 2, 3]); ax.set_ylim(bottom=0)
    note(fig, 'Positive-response vector strength · one value per cell', x=.10)
    pub.save(fig, '06-selectivity-distribution', 'Selectivity varies across cells', ['responses.json'],
             'Derived circular orientation and direction vector strengths using nonnegative direction means at each cell’s best mean-response temporal frequency. KDEs are descriptive smoothers; histogram values are retained. These are not the SDK OSI/DSI indices.')

    fig, ax = panel('Frequency changes the response')
    pair = np.stack([response[:, 0, :].mean(axis=0), response[:, 3, :].mean(axis=0)])
    lines = LineCollection([[(0, a), (1, b)] for a, b in pair.T], colors=COLORS['gray'], alpha=.19, linewidths=.4)
    ax.add_collection(lines); fp.tag(lines, role='x-paired-responses', series='within-cell-pairs')
    rng = np.random.default_rng(20260914)
    for pos, vals, name, color in [(0, pair[0], 'one-hz', COLORS['navy']), (1, pair[1], 'eight-hz', COLORS['orange'])]:
        jitter = rng.uniform(-.09, .09, n)
        fp.scatter(ax, pos+jitter, vals, series=name, s=6, color=color, alpha=.7, edgecolors='white', linewidths=.15)
        q1, med, q3 = np.quantile(vals, [.25, .5, .75])
        fp.line(ax, [pos, pos], [q1, q3], series=f'{name}-iqr', color=COLORS['ink'], linewidth=2.6)
        fp.scatter(ax, [pos], [med], series=f'{name}-median', s=14, color='white', edgecolors=COLORS['ink'], linewidths=.7, zorder=5)
    ax.set_yscale('symlog', linthresh=1); ax.set_xlim(-.35, 1.35); ax.set_xticks([0, 1], ['1 Hz', '8 Hz'])
    ax.set_ylabel('Mean ΔF/F (%)'); ax.set_xlabel('Temporal frequency')
    ax.set_yticks([-10, -1, 0, 1, 10, 100]); ax.set_yticklabels(['−10', '−1', '0', '1', '10', '100'])
    note(fig, 'Paired cells · direction mean · symmetric-log y axis', x=.10)
    pub.save(fig, '07-paired-responses', 'Frequency changes the response', ['responses.json'],
             'Every cell’s actual direction-averaged response at 1 and 8 Hz, connected within cell. Deterministic horizontal jitter separates marks only. Black bars show IQR, white dots median; symmetric log axis has linear region±1%. No significance test is implied.')

    fig, ax = panel('Population response geometry')
    fig.subplots_adjust(bottom=.29)
    for direction in range(8):
        cells = np.flatnonzero(pref == direction)
        fp.scatter(ax, scores[cells, 0], scores[cells, 1], series=f'direction-{directions[direction]}-scores', s=10, c=direction_colors[direction], edgecolors='white', linewidths=.3, alpha=.88)
    fp.reference_line(ax, x=0, name='pc1-zero', color=COLORS['light'], linewidth=.6, zorder=0)
    fp.reference_line(ax, y=0, name='pc2-zero', color=COLORS['light'], linewidth=.6, zorder=0)
    ax.set_xlabel(f'PC 1 ({variance[0]*100:.1f}%)'); ax.set_ylabel(f'PC 2 ({variance[1]*100:.1f}%)')
    ax.locator_params(nbins=4)
    handles = [Line2D([], [], marker='o', linestyle='none', markersize=3,
                      markerfacecolor=direction_colors[i], markeredgewidth=0,
                      label=f'{int(d)}°') for i, d in enumerate(directions)]
    fig.legend(handles=handles, loc='lower center', bbox_to_anchor=(.5, .07), ncol=8,
               fontsize=4.5, handlelength=.5, handletextpad=.3, columnspacing=.7)
    fig.text(.08, .022, 'Within-cell standardized tuning · color: preferred direction', fontsize=5.2, color=COLORS['gray'])
    pub.save(fig, '08-population-pca', 'Population response geometry', ['responses.json'],
             'PCA of143cells×40conditionmeans after within-cell z-scoring and feature centering. Axes report explained variance. Colors encode the same preferred drift direction as the network; distances summarize tuning profile similarity.')

    fig, ax = panel('Shared stimulus preferences')
    fig.subplots_adjust(left=.17, right=.81, top=.81, bottom=.23)
    img = fp.heatmap(ax, correlation[np.ix_(order, order)], series='signal-correlation', include_values=True, cmap=DIVERGING, vmin=-1, vmax=1, interpolation='nearest', aspect='equal')
    ax.set_xticks([0, 49, 99, n-1], ['1', '50', '100', str(n)]); ax.set_yticks([0, 49, 99, n-1], ['1', '50', '100', str(n)])
    ax.set_xlabel('Cells, similarity ordered'); ax.set_ylabel('Cells, similarity ordered')
    cax = fig.add_axes([.86, .32, .025, .36]); cb = fp.colorbar(img, cax=cax, label='Signal r', ticks=[-1, 0, 1]); cb.ax.tick_params(labelsize=6, width=.4, length=2); cb.set_label('Signal r', fontsize=6)
    for spine in ax.spines.values(): spine.set_visible(False)
    note(fig, 'Allen signal correlation · average-linkage cell ordering', x=.07)
    pub.save(fig, '09-response-correlation', 'Shared stimulus preferences', ['responses.json'],
             'Allen SDK signal correlation matrix, symmetrized against numericalprecision and ordered by average-linkage clustering of1−r. All 143 cells retained.', main=False)

    traces = json.loads((pub.data / 'traces.json').read_text())
    values = np.asarray(traces['mean_trial_trace_pct'], dtype=float)
    frames = np.asarray(traces['sample_frames_relative_to_onset'])
    fig, ax = panel('Responses unfold in time')
    shade = ax.axvspan(0, 60, color=COLORS['light'], alpha=.55, linewidth=0, zorder=0)
    fp.tag(shade, role='highlight-region', name='grating-presentation')
    for i, cell in enumerate(examples):
        direction = int(np.argmax(positive[:, 1, cell]))
        trace = values[direction, cell]
        normalized = trace / max(np.max(np.abs(trace)), 1e-8)
        fp.line(ax, frames, normalized + (3-i)*1.4, series=f'cell-{ids[cell]}-trace', color=PALETTE[i], linewidth=1)
    ax.set_yticks([0, 1.4, 2.8, 4.2], [str(ids[cell])[-4:] for cell in examples[::-1]])
    ax.set_xlim(-30, 89); ax.set_xticks([-30, 0, 30, 60, 90]); ax.set_ylim(-.55, 5.4)
    ax.set_xlabel('Frames relative to grating onset'); ax.set_ylabel('Cell ID suffix · normalized, offset')
    ax.spines['left'].set_visible(False); ax.tick_params(axis='y', length=0)
    note(fig, 'Actual trial means at 2 Hz · shaded: 60 stimulus frames', x=.07)
    pub.save(fig, '10-response-traces', 'Responses unfold in time', ['traces.json', 'responses.json'],
             'Actual trial-averaged calcium traces for four measured cells at 2 Hz and each cell’s best direction at 2 Hz. Each trace is divided by its own absolute peak and offset only for display. Frame-based timing avoids assuming an exact acquisition rate.', main=False)

    fig, ax = panel('Tuning across temporal scales')
    by_frequency = []
    for frequency in range(len(frequencies)):
        data = positive[:, frequency, :]
        metric = np.abs(np.sum(data*np.exp(2j*theta[:, None]), axis=0))/np.maximum(data.sum(axis=0),1e-12)
        by_frequency.append(metric)
        violin = fp.violin(ax, metric, series=f'frequency-{frequencies[frequency]:g}', positions=[frequency], widths=.65, showmeans=False, showmedians=True, showextrema=False, include_values=True)
        for body in violin['bodies']: body.set_facecolor(COLORS['teal']); body.set_alpha(.2); body.set_edgecolor(COLORS['teal']); body.set_linewidth(.4)
        violin['cmedians'].set_color(COLORS['teal']); violin['cmedians'].set_linewidth(1.3)
        jitter = rng.uniform(-.14, .14, n)
        fp.scatter(ax, frequency+jitter, metric, series=f'frequency-{frequencies[frequency]:g}-cells', s=2.5, color=COLORS['navy'], alpha=.30, edgecolors='none')
    ax.set_xticks(range(5), [f'{f:g}' for f in frequencies]); ax.set_ylim(0, 1.05); ax.set_yticks([0, .5, 1])
    ax.set_xlabel('Temporal frequency (Hz)'); ax.set_ylabel('Circular orientation selectivity')
    note(fig, f'{n} cells per frequency · lines: medians', x=.10)
    pub.save(fig, '11-frequency-selectivity', 'Tuning across temporal scales', ['responses.json'],
             'Circular orientation vector strength derived independently at each of five measured temporal frequencies. Nonnegative mean responses define the direction weights; all 143 cells retained. Violin density and jitter are visual summaries.', main=False)

    fig, ax = panel('A compact response space')
    components = np.arange(1, 11)
    fp.bar(ax, components, variance[:10]*100, series='component-variance', color=COLORS['navy'], width=.66, linewidth=0)
    ax.set_xlabel('Principal component'); ax.set_ylabel('Explained variance (%)')
    ax.set_xticks([1, 2, 4, 6, 8, 10]); ax.set_xlim(.35,10.7); ax.set_ylim(0, max(variance[:10]*100)*1.18)
    ax2=ax.twinx(); ax2.spines['right'].set_visible(True); ax2.spines['right'].set_color(COLORS['orange']); ax2.spines['top'].set_visible(False)
    fp.line(ax2, components, np.cumsum(variance[:10])*100, series='cumulative-variance', color=COLORS['orange'], marker='o', markersize=2.6)
    ax2.set_ylim(0,100);ax2.set_yticks([0,50,100]);ax2.set_ylabel('Cumulative (%)',color=COLORS['orange'],fontsize=6.5);ax2.tick_params(axis='y',colors=COLORS['orange'],labelsize=6)
    fig.subplots_adjust(right=.80)
    note(fig, 'Same standardized response matrix as the PCA projection', x=.07)
    pub.save(fig, '12-variance-spectrum', 'A compact response space', ['responses.json'],
             'Variance spectrum from the same full SVD used in the populationPCA. Bars show variance per component, line cumulative variance; first 10 of 40 components shown.', main=False)

    summary = dict(experimentId=source['experiment_id'], region=source['region'], cellCount=n,
                   exampleCellIds=ids[examples].tolist(), pcaExplainedVariance=variance[:10].tolist(),
                   graphEdgeCount=int(len(edge_indices)), graphShownCellCount=int(count), graphAllCellCount=n, graphSelection='largest connected component', graphThreshold=.5,
                   preferredDirectionCounts={str(int(d)):int(np.sum(pref==i)) for i,d in enumerate(directions)},
                   description='Original descriptive analysis of public Allen measurements. No synthetic responses or claims of anatomical connectivity.')
    (pub.output / 'analysis-summary.json').write_text(json.dumps(summary, indent=2)+'\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path)
    parser.add_argument('--data-dir', type=Path)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--anatomy-only', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    default_project = root if (root / 'data' / 'allen').is_dir() else root / 'examples' / 'neural-populations'
    project = args.project or default_project
    data = args.data_dir or project / 'data' / 'allen'
    output = args.output or project / 'plots'
    pub = Publisher(output.resolve(), data.resolve())
    anatomy(pub)
    if not args.anatomy_only:
        functional(pub)


if __name__ == '__main__':
    main()
