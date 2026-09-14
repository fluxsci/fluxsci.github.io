# Additional neuroscience plots

Eight new plot families, with twelve source SVGs including matched frequency states. These are independent source plots available for composition in Flux; the existing figures, slides, manuscript and website are unchanged.

Open the **neural-populations project folder** in Flux, then find these files under `plots/advanced` in the plot gallery. Keep each SVG beside its `.fluxplot.json` and `.recipe.json` sidecars. Those files preserve semantic selection, numeric data, regeneration and morph compatibility.

| Family | Visual | Source SVG / states |
| --- | --- | --- |
| 13 | Eight 3D population trajectories, stimulus boundaries and floor projections | [Population trajectories](13-population-trajectories.svg) |
| 14 | 143 cells moving through a common response space | [1 Hz](14-response-geometry-01hz.svg), [4 Hz](14-response-geometry-04hz.svg), [15 Hz](14-response-geometry-15hz.svg) — **Data Morph** |
| 15 | A dense response atlas: 143 cells × eight directions × 120 frames | [Population response atlas](15-population-response-atlas.svg) |
| 16 | Six individually identified neurons with changing direction tuning | [1 Hz](16-tuning-landscape-1hz.svg), [2 Hz](16-tuning-landscape-2hz.svg), [4 Hz](16-tuning-landscape-4hz.svg) — **Data Morph** |
| 17 | Direction-wise trial distributions, individual observations, means and bootstrap intervals | [Trial response raincloud](17-trial-response-raincloud.svg) |
| 18 | A direction/frequency response surface with measured condition points | [Joint tuning surface](18-joint-tuning-surface.svg) |
| 19 | A circular response-similarity network, grouped by preferred direction | [Response architecture](19-response-architecture.svg) |
| 20 | A reconstructed neuron, colored by path distance from the soma | [Neuron arbor](20-dendritic-arbor.svg) |

PNG and PDF previews are generated into [`exports/advanced-previews`](../../exports/advanced-previews/). [`overview.png`](../../exports/advanced-previews/overview.png) is a review contact sheet only. Each original plot is a separate compact panel, with one axis, Arial 5–6 pt text, a white background, and Fluxplot's light palette. Direction colors are consistent across plots. Legends and explanatory keys stay outside the plotted data.

## Data Morph

Start with **14** for moving cell populations and **16** for reshaping tuning curves. Use states from the same family. Their cell identities, point ordering, coordinate basis, normalizations, axes, ticks, and internal SVG definitions stay fixed across states. The animation interpolates measured coordinates. Between-frequency frames are visual transitions, not additional recordings.

See [DATA-MORPH.md](DATA-MORPH.md) for the Flux workflow and the native-player verification command. The other six families are static views; 3D surfaces, heatmaps and arbitrary network/arbor paths are not offered as native Data Morph pairs.

A [self-contained native playback preview](../../exports/advanced-previews/native-morph.html) is included among the local review exports. Open it in a browser to play either sequence. It captures the verified plot versions; rerun native verification separately after changing morph source plots.

The reviewed PNG/PDF previews, overview, and native playback preview are included in the
repository and project download. Runtime license notices accompany the playback preview
in [`licenses/`](../../exports/advanced-previews/licenses/). Transient generation reports
and other unreviewed exports remain local.

## Regenerate and edit

From the project root, with `uv` available:

```sh
uv run --project scripts/advanced python scripts/advanced/generate.py
```

This regenerates only these twelve additional plots, their sidecars and their previews. It does not accept them into existing Figure placements, change slide contents, refresh website media, or rebuild the website download.

- [`population.py`](../../scripts/advanced/population.py): families 13–15; PCA, temporal smoothing, ordering and fixed plot domains.
- [`tuning.py`](../../scripts/advanced/tuning.py): families 16–18; selected cell IDs, interpolation and trial statistics.
- [`architecture.py`](../../scripts/advanced/architecture.py): families 19–20; correlation threshold, graph layout and neuron rendering.
- [`morph_identity.py`](../../scripts/advanced/morph_identity.py): stable internal SVG references across generated morph states. Keep this step when modifying those generators.

Run an individual script with the same `uv run --project scripts/advanced python` prefix to regenerate its families. For an isolated CLI regeneration, use `flux rerun-plot plots/advanced/19-response-architecture.recipe.json --only`. The `--only` flag passes `FLUXPLOT_ONLY` to the generator; without it, the owning script regenerates all its families. The Python environment is described by [`pyproject.toml`](../../scripts/advanced/pyproject.toml) and `uv.lock`; Fluxplot is pinned to a specific public Git commit. Arial must be installed to reproduce the exact typography. No local environment or personal paths are needed in the recipes.

## Methods and provenance

All visuals are original renderings of the public Allen files already bundled in [`data/allen`](../../data/allen/). No private measurements, invented study outcomes, or copied paper artwork were added.

Families 13–19 use experiment **501940850**, with 143 recorded cells, eight drift directions and five temporal frequencies. The traces' **2 Hz denotes stimulus temporal frequency**, not recording frame rate; temporal panels use frame coordinates. PCA bases are fitted once across the relevant pooled data. The heatmap uses fixed per-cell normalization and ordering. Tuning curves and the response surface use explicitly documented interpolation of measured values; their smooth appearance does not imply extra observations. The raincloud uses all 120 eligible trials for its chosen cell and frequency.

Network edges represent measured **signal correlation ≥ 0.60**, not synapses or causal connectivity. The neuron uses independent Cell Types specimen **480114344**; its reconstruction is not one of the functionally imaged cells. Arbor color follows cumulative 3D path distance, while its displayed geometry is an x/y projection.

Detailed numerical coordinates, source hashes and transformations accompany families 13–15 in `.analysis.json` and `.notes.json` files. The remaining methods are recorded in [`tuning-inventory.json`](tuning-inventory.json) and [`architecture-inventory.json`](architecture-inventory.json). Preserve the bundled Allen provenance, attribution and noncommercial-use terms when sharing these assets.
