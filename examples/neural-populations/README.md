# Neuronal networks flexibly encode diverse stimuli

This is the real, editable Flux project used for the website demonstration. Open this folder in Flux. It contains no private research.

- **Paper:** `paper/manuscript.qmd` is the main manuscript; `methods.qmd` explains data boundaries; `presentation.qmd` embeds all four native slides.
- **Figure:** `fig-neural-populations` is the dense eleven-panel flagship plate (anatomy, example cells, population dynamics, similarity structure and tuning statistics); `fig-neural-structure` holds six supporting panels, including a three-state Data Morph trio. Every panel and label is individually selectable.
- **Slides:** `slides/neural-populations/deck.json` contains four editable slides with native reveal steps. Plot assets are shared by ID with the Figure compositions.
- **Plots:** `plots/` contains the twelve original SVG panels, still used by the slides. [`plots/advanced/README.md`](plots/advanced/README.md) describes eight further families (twelve SVGs including two matched Data Morph sets) and the thirteen journal-style flagship panels in `plots/flagship/`, all with semantic sidecars and portable regeneration recipes. The two figures are rebuilt from those panels by `scripts/advanced/compose-flagship.sh` and `compose-structure.sh` through the Flux command line. Accepted asset copies live in `fig/assets/`.
- **Data:** `data/allen/` holds public-source records, identifiers, source files and provenance.
- **References:** `references/library.bib` contains dataset records and original project-note records. It does not claim fictional journal publications. Flux Library itself uses the user's global collection; opening this project does not import entries into that collection.
- **Context:** `Context/` describes the purpose, rules and remaining work.

## Editing

Use Paper, Figure and Slides normally. Regenerating a source plot should preserve its filename and semantic IDs; Flux can refresh its linked placements without rebuilding the composition. The Python generator under `scripts/` and its environment notes are supplied with the data/plot material.

## Refresh the website after edits

From the independent website repository, run:

```sh
node scripts/refresh-flux-assets.mjs --flux-source /path/to/pinned/flux --project /path/to/website/examples/neural-populations
```

This exports the current accepted plot assets, Figure compositions and native slides. It rebuilds derived `fig/renders/` and `slides/*/renders/` and public website exports. It does not rewrite the manuscript, compositions, deck or source plots. To accept changed plot-source files first, open the project in Flux or use its source-sync command. Re-capture app screenshots after the desired edits are saved.

Initialization uses a separate explicit `--initialize-project` flag and refuses to run when `project.json` already exists. Your edits are the source of truth.
