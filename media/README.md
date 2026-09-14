# Product media and the editable demonstration

The canonical project is **`examples/neural-populations/` in this repository**. Open that
folder in Flux to edit the manuscript, plots, Figure compositions and native slides. The
website's project download is packaged from this same folder; it is not a screenshot-only
fixture or a separate project that can drift out of sync.

All wording and visual compositions are original. Numerical activity data and anatomical
geometry come from the public Allen Institute resources recorded in
`examples/neural-populations/data/allen/provenance.json`. The intentionally broad manuscript
is an illustrative narrative, not a scientific publication. Anatomical context comes from
independent specimens, and a response-similarity graph is not measured synaptic connectivity.
Keep the Allen source credit and data terms with the project and every displayed derivative.

## What belongs where

- `examples/neural-populations/` — editable, portable Flux project and public-data provenance.
- `media/fixtures/neural-project.mjs` — original seed narrative and initial composition recipe.
  It is used only when deliberately initializing a new project; subsequent user edits belong
  in the actual project and are preserved.
- `site/assets/media/` — reviewed screenshot and preview outputs.
- `site/demos/neural-populations/index.html` — self-contained native-player export.
- `media/native-assets.json` and `media/screenshots.json` — exact product pin, output byte
  sizes and SHA-256 hashes. The publication check verifies these against `flux-source.json`.
- `media/masters/` — internal PNG screenshot masters; these do not publish.

A normal website build reads checked-in public outputs. It does not import an app checkout,
open a personal project or read the user's FluxConfig.

## Refresh native slides from the project

Use Node 22 and a clean checkout at the exact revision in `flux-source.json`, with its locked
dependencies installed. From this website repository:

```sh
node scripts/refresh-flux-assets.mjs --flux-source /absolute/path/to/pinned/flux
```

The default project is `examples/neural-populations/`. `--project /absolute/path/to/project`
selects another explicitly provided project. The refresh reads the current manuscript,
compositions and deck, exports the current **accepted** plot assets, and rebuilds only the
derived `fig/renders/`, `slides/*/renders/` and website export files. It does not replace the
authored manuscript, deck, composition or plot sources. If plot sources have changed, first
let Flux accept those source updates or use its source-sync command.

The four slides are real deck entries with editable text, plot placements and reveal tracks.
The first is embedded in the main manuscript; `paper/presentation.qmd` embeds all four.
The website iframe's selector switches among the same native slide snapshots. Every animation
advance is explicit. The player retains each slide's transient progress, respects reduced
motion, supports keyboard navigation and has 44-pixel controls. It reports its actual height
so the selector and wrapped native toolbar fit on narrow screens.

The iframe exposes `fluxWebsiteDemo.pause()`, `.state()` and `.selectedSlide()` for its
parent and verification. Same-origin `flux-demo-pause` messages settle active motion;
`motion-preference` messages update the native Animation control. `pagehide` preserves a
player entering the browser back/forward cache, and destroys one on an ordinary exit.
Visibility changes pause playback. No motion starts before user interaction.

The export uses Flux's shared `createSlideRepository`, `prepareSlideDocument`,
`renderSlidePosterSvg` and `mountSlideEmbed`. The thin host handles only selection, sizing
and lifecycle; it does not reproduce interpolation or animation behavior. The public poster
shows the first slide's completed state; playback begins at its initial step.

## Creating the initial project again

Initialization is deliberately separate and refuses to run if `project.json` or any other
file it would author already exists. To make an independent fresh copy, first supply its
`data/allen/` and all twelve `plots/*.svg` panels, then run:

```sh
node scripts/refresh-flux-assets.mjs --flux-source /absolute/path/to/pinned/flux \
  --project /absolute/path/to/new/project --initialize-project
```

The initializer uses Flux's shared scaffold builder, validators and Figure persistence
planner, including real schema files and the Context layer. Accepted SVG and optional semantic
sidecar copies are registered in `fig/assets/`; plots in the deck refer to the same assets by
ID. No global reference-library write is involved.

The portable data acquisition and plot-generation scripts and environment notes live inside
the example project. Rebuilding plots is independent from website export. Plot updates do not
require rebuilding or replacing the user's figure compositions.

## Capturing the actual application

Check port 1420 before starting the pinned app's dev server. Stop a server you own when done.
Run the screenshot script from this repository:

```sh
FLUX_CHROME="/absolute/path/to/chrome" node scripts/capture-media.mjs --flux-source /absolute/path/to/pinned/flux
```

It reads the bundled example project and mirrors the complete project into Flux's isolated in-memory FileBridge and opens that
project through the actual GUI. Library and Reader previews use only that isolated library;
no entry is added to the user's global FluxLib. The original manuscript also supplies the
PDF used by Reader, saved as `exports/manuscript.pdf`. Its figures are rasterized from the
native SVG at 2× resolution for reliable PDF printing; editable vectors remain in the project.
No application interface is fabricated or repainted. Capture also updates homepage image
dimensions and records screenshot hashes. Then run `npm test` to rebuild the project ZIP and
verify the complete publication artifact.

For an additional native disk-open check, run the pinned app's Electron executable against
`scripts/verify-neural-project-native.cjs`, with explicit `--flux-source` and `--project`
arguments. It opens the actual project using a disposable native profile and real preload,
then checks Paper, Figure and Slides. Its screenshots and results stay under `.cache/neural-native/` (or an explicit `--artifacts` directory).

## Licenses

Data credit: **Allen Institute for Brain Science**. The dataset terms are documented beside
the raw files and are distinct from the application or website source-code license. They are
not silently relicensed by the project download.

The native runtime includes Flux's MIT notice and the licenses of the packages present in the
bundle (`svelte` and `esm-env`, discovered from the esbuild input graph), under
`site/assets/licenses/`. Gelasio is redistributed under SIL OFL 1.1, with its notice in
`site/assets/fonts/OFL.txt`.

The example project's separate native morph review preview carries the same three runtime
notices under `exports/advanced-previews/licenses/`. Its reviewed exports are enumerated in
`scripts/project-exports.json` and committed alongside source plots; other temporary exports
are excluded from the project ZIP even when present locally.
