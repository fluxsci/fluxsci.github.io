# Public data behind the Flux neural-population demo

This folder contains actual public Allen Institute measurements and anatomical geometry.
The surrounding manuscript, scientific story, figure composition, and animations are
original demonstration material. They are not a new research report. No paper prose,
published figures, or figures traced from papers are included.

## Functional measurements

Source: [Allen Brain Observatory, Visual Coding 2-photon](https://brain-map.org/our-research/circuits-behavior/visual-coding),
experiment **501940850**, container **511510688**, acquired 2016-02-16. The recorded
population contains **143 cells** in **VISl (lateral visual area)**, at an imaging depth
of 175 µm. The selected stimulus set contains eight motion directions and five temporal
frequencies. It includes **628 trials**, counting blank sweeps.

The upstream [analysis HDF5](https://api.brain-map.org/api/v2/well_known_file_download/515078316)
is 84.7 MB. It remains in a temporary acquisition cache, outside the project. This folder
keeps compact, portable extractions instead. The original arrays are already processed
calcium-imaging responses; they are not raw spike recordings.

| File | Contents |
| --- | --- |
| `responses.json` | Mean and SEM response arrays, direction × temporal frequency × cell (8 × 5 × 143); signal correlation; representational similarity; published analysis metrics. |
| `trials.json` | Stimulus metadata and mean cell response for each of 628 trials. All 143 cell IDs retain a common ordering. |
| `traces.json` | Trial-average response traces at 2 Hz, direction × cell × sample (8 × 143 × 120). |
| `cell-metrics.csv` | A spreadsheet-friendly table of cell IDs, preferred-condition indices, and response metrics. |
| `experiment-metadata.json` | The public API's experiment and specimen metadata. |

Responses use the source analysis's fluorescence-change percentage relative to the
pre-stimulus baseline. `sem_response_pct` retains the source's standard error across
trials. The final upstream array channel is running speed; the exporter removes it from
the cell axes and retains it separately in the trial table. The source's blank-condition
column is omitted from the 8 × 5 response grid and remains identifiable in the trial table.

Directions are **0, 45, 90, 135, 180, 225, 270, and 315 degrees**. Temporal frequencies are
**1, 2, 4, 8, and 15 Hz**. Motion direction spans 360 degrees; it should not be confused
with undirected orientation. Each trace keeps 30 samples before stimulus onset, 60 during
the stimulus, and 30 afterward. The optional seconds axis uses a nominal 30 Hz sampling
rate; the sample-frame axis is the precise indexing preserved here.

Finite numbers are rounded to six decimal places. Missing or nonfinite source values
become JSON `null`. The source's selectivity metrics can contain out-of-range values;
the files retain them. Plot-specific filtering, clipping, normalization, correlations,
embeddings, or statistics must be described by the figure-generation recipe. A response
similarity network describes similarity; it is not measured anatomical connectivity.

## Anatomical context

The meshes are unchanged public [Allen Mouse Common Coordinate Framework](https://download.alleninstitute.org/informatics-archive/current-release/mouse_ccf/)
2017 annotation OBJ files:

| File | Structure |
| --- | --- |
| `ccf-2017-997.obj` | Whole-brain/root mesh |
| `ccf-2017-315.obj` | Isocortex |
| `ccf-2017-385.obj` | Primary visual area, VISp |
| `ccf-2017-409.obj` | Lateral visual area, VISl |

The three SWC files come from the [Allen Cell Types Database](https://celltypes.brain-map.org/):
specimens **464212183**, **464198958**, and **480114344**. Their coordinates, radii, and
branch topology remain unchanged. They provide anatomical context from independent
specimens; they are not reconstructions of the 143 functionally recorded cells. The public
metadata and precise file-download URLs are retained alongside them.

## Attribution and reuse

**Data and anatomical models: Allen Institute for Brain Science.**

These resources use the [Allen Institute Terms of Use](https://alleninstitute.org/legal/terms-of-use)
and [Citation Policy](https://alleninstitute.org/legal/citation-policy). The default terms
permit noncommercial use with attribution; they are **not a blanket CC BY license**.
The website and Flux source-code licenses do not relicense these third-party data.
Keep source credit and links on each web page displaying data-derived visuals. Consult
the terms before repurposing these assets for a commercial product. No Allen endorsement
is implied.

`provenance.json` records source URLs, identifiers, file sizes, and SHA-256 hashes.
`sources.bib` provides dataset references for the demonstration manuscript without
importing wording from research papers.

## Reproduce or verify

From this Flux project's root folder, create a Python 3.12+ environment. Dependencies are
needed only for refreshing data; opening and editing the bundled project does not require
Python.

```sh
python3.12 -m venv .venv
.venv/bin/pip install -r scripts/requirements-data.txt
.venv/bin/python scripts/fetch-data.py --verify
.venv/bin/python scripts/fetch-data.py --output /path/to/a/new/data-folder
```

The website repository also provides the identical exporter as
`scripts/fetch-neural-data.py`, with its default path set to this bundled project.

The first command verifies the checked-in data without network access. The second fetches
the pinned upstream files, verifies their hashes, and exports the compact plotting inputs.
An upstream file that exceeds 100 MB or has changed checksum is rejected. Existing raw
files with unexpected hashes are preserved rather than overwritten. No FluxConfig or
personal research files are read.
