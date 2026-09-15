# Homepage implementation review

**Date:** 2026-09-13  
**Scope:** complete homepage, independent website infrastructure, and bundled neuroscience project  
**Intended public origin:** `https://fluxsci.github.io/`

## Delivered

The custom Quarto homepage introduces Flux, its principles, all five modules, connected
workflows, the project model, FluxConfig, agent collaboration and installation. It retains
Flux's phyllotaxis mark, Gelasio typography, warm paper, near-black surfaces and quiet blue
controls. Guide links lead to existing upstream documentation; future guide routes remain
planned work.

The demonstration is now **Neuronal networks flexibly encode diverse stimuli**. Its canonical
editable project lives in `examples/neural-populations/` inside this website repository.
It includes the original manuscript and methods, twelve source plots with semantic sidecars
and portable recipes, an eight-panel flagship Figure and four-panel supporting Figure,
four native animated slides, a manuscript PDF, public datasets, bibliography and Context.
Opening the accepted project requires neither Python nor a data download.

The scientific materials use public Allen Institute observations and anatomy: 143 imaged
cells, 628 recorded trials, 40 stimulus conditions, three neuron reconstructions and CCF
surface geometry. All prose, visual designs and analysis are original. The source metadata,
identifiers, processing choices and noncommercial-use/attribution terms are bundled with the
project. Anatomical sources are explicitly independent of the functional recording; graph
edges represent response similarity. No research paper text or figure was copied.

The homepage presents refreshed real app captures across all five modules, a larger Paper
figure, and a separate 1800 × 875 flagship plate with image enlargement. Four native scenes
cover responses, anatomy, tuning and population structure. The first slide reveals heatmap
data, response-network edges and interpretation through three authored steps. Scene selection
and iframe lifecycle are website concerns; animation and rendering remain Flux's own player.
The native runtime is fetched only after the visitor requests it.

## Editable project and publication

Every build packages the canonical project into `downloads/neural-populations.zip`. The
archive has 131 files and is approximately 7.93 MiB. It is generated output, not another
editable copy. Packaging round-trips every extracted byte against source hashes and excludes
local environments, caches and history. Portable source paths and source licenses are checked.
The final published archive hash must match the verified bundle.

The source and output publication audit allows only the public homepage, 404, assets, native
demo and this explicit project download. Plans, masters, dependencies and app implementation
files stay outside the Pages artifact. The website builds from Node 22, Quarto 1.10.18 and
locked dependencies without accessing a Flux checkout. Explicit media refreshes use the
product revision pinned in `flux-source.json`, currently `4bb72d895b7879acc404ca83863cdc385982b0b5`.
Refreshes preserve authored documents, compositions, source plots and decks.

The verified artifact contains 25 approved files, approximately 11.53 MiB including the
optional project download. The download has a specific 40 MiB allowance; ordinary media retain
the 15 MiB per-file limit and the whole site retains its 150 MiB publication budget.

## Verification

- `npm test`: **48/48 browser checks**, across Chromium, Firefox, WebKit and mobile WebKit,
  plus preview-server checks and the Quarto build/publication audit.
- All four native scenes load, accept manual steps, retain progress when switching, and
  report no player issues. Reduced motion, offscreen pause, narrow 320px controls, no-JS
  fallback, metadata, appearance persistence and image-dialog focus are exercised.
- Automated WCAG AA checks pass in light and dark appearances, including the image dialog
  and branded 404. Desktop and mobile screenshots supplement these automated checks.
- App captures come from the unmodified Flux GUI opening an exact in-memory copy of the
  canonical project. Library/Reader use an isolated fixture library; personal FluxConfig
  and research were not accessed. Capture reports have no renderer errors.
- The project and a fresh extraction of the downloadable ZIP were opened through the actual
  built Electron app and real filesystem preload in an isolated native profile. Paper,
  embedded figures, both compositions and the editable slide deck load without quarantine.
- The data acquisition script re-fetched and reproduced all 13 numerical/anatomical data
  hashes. Trial-derived means agree with exported means to rounding precision. All twelve
  SVGs match their semantic manifest hashes; recipes contain no machine-specific paths.
- Figures, individual panels, plot legends, native scene endpoints, Paper and Reader output
  were visually inspected. PDF publication uses a raster derivative of the native SVG at
  2× resolution because Chromium's print path dropped nested SVG scatter markers; the
  editable project retains all original vector sources and semantic parts.

Browser/visual evidence stays under `test-results/`; the native archive-open evidence stays
under `.cache/neural-native/` so browser test cleanup cannot remove it. Capture and native
export provenance stay in `media/`.
No application implementation files changed. Browser emulation and automated accessibility
checks do not replace eventual testing of the public deployment on physical devices.

## Publication and next work

The complete local website is available at `http://127.0.0.1:1430`. As of 2026-09-14,
the independent repository is connected to `https://github.com/fluxsci/fluxsci.github.io`.
GitHub Pages is configured for GitHub Actions with HTTPS enforced. Successful verified
builds on `main` publish to `https://fluxsci.github.io/`; deployment status is recorded in
the repository's **Verify and publish website** workflow.

The original delivery measurements above describe the 2026-09-13 homepage snapshot.
The example project now also contains eight additional neuroscience plot families,
including two verified Data Morph sequences. These are available as source SVGs with
recipes and reviewed previews; they have not changed the authored homepage compositions.
Publication packaging includes their dependency lock, the manuscript's referenced figure
renders and reviewed example exports, while excluding disposable verification outputs.

The user can now edit the bundled project directly in Flux, then refresh website media using
`media/README.md`. Module showcase pages, guide migration, search and expanded tutorials
remain outside this homepage iteration. Both canonical plans now describe the repository-owned
neuroscience project and its downloadable bundle.

## 2026-09-14 — Flagship figures, entrance and the "Only in Flux" section

Delivered on the `polish/hero-figures-signature` branch:

- **Example project.** Thirteen journal-style panels (`plots/flagship/`, generated by
  `scripts/advanced/flagship.py`) replace the loose eight-panel grid: Figure 1 is an
  eleven-panel plate (1440 × 920 px) and Figure 2 pairs the Data Morph trio with single-cell
  views, both rebuilt through the Flux CLI (`compose-flagship.sh`, `compose-structure.sh`).
  The original twelve panels and the four slides are unchanged; the empty leftover Figure 3
  was removed. `flux validate` and `validate-deck` pass.
- **Media.** Renders, the native slide export and every screenshot were refreshed from the
  pinned revision; the plate is now 1800 × 1150 and the hero shows the new figure in Paper.
- **Homepage.** A one-shot entrance (the mark blooms with the app's own timing, the copy,
  screenshot and module strip rise in order, header last) that plays once per session, runs
  without JavaScript as a static page and is disabled by reduced motion; gentle reveal of
  section visuals on scroll; a new "Only in Flux" section with a browser-side semantic-plot
  explorer over the project's real `16-tuning-landscape` files (hover names parts, click
  restyles a series, switching frequency tweens the same-named points and curves and keeps
  the restyle), a three-surface diagram and a terminal block of real commands; copy updated
  for the new figure.
- **Verification.** `npm test`: 56 browser checks across Chromium, Firefox, WebKit and mobile
  WebKit, including two new tests for the entrance and the explorer, axe WCAG AA in both
  appearances, and the no-JavaScript fallback image. The project ZIP is 22.0 MB, within the
  40 MB allowance; the published site is 26.2 MB.
