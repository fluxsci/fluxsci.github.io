# Project notebook

## State

The initial showcase contains two editable Figure compositions and four native slides. The first slide is embedded in the manuscript; all four are embedded in the presentation walkthrough.

## Decisions

- Population responses provide the central visual story.
- Brain and neuron surfaces provide anatomical context.
- The working title is intentionally broad and does not report an established finding.

## Open questions

- Which views should be emphasized in the final homepage?
- Which additional public recordings should be added next?

## Session log

### 2026-09-13 — Initial editable project

Created the original manuscript, composition skeleton, presentation and provenance structure for the Flux website.

### 2026-09-13 23:52 — Additional neuroscience plots and native morph sets

Added eight original neuroscience plot families (twelve SVGs including matched frequency variants) under plots/advanced. Population trajectories, response geometry, a temporal response atlas, tuning landscapes, trial rainclouds, a joint response surface, a response-similarity network and an Allen neuron reconstruction use bundled public data. Added semantic sidecars, portable uv recipes, a pinned Python environment, PNG/PDF previews, methods notes and a regeneration entry point. The response geometry and tuning families passed 98 checks in the current native Flux player, including visible markers, true numerical interpolation, reverse/chained seek and real playback. Repeated generation reproduced all twelve SVGs byte-for-byte. All 145 protected website, original plot, manuscript, figure and deck files remained byte-identical. New plots are intentionally unplaced for later selection and composition.

### 2026-09-14 22:28 — Flagship panels and dense figures

Generated thirteen journal-style panels with scripts/advanced/flagship.py (plots/flagship/21–33) and rebuilt both figures through the CLI: Figure 1 is now an eleven-panel plate and Figure 2 pairs the Data Morph trio with single-cell views. The empty leftover Figure 3 was removed. The original twelve panels and the four slides are unchanged.
