# Reviewed product media

Normal builds use checked-in screenshots, native player exports, fonts and figure images. No application checkout, private project or personal configuration is read during a normal build.

## Inputs and boundaries

`flux-source.json` pins the reviewed Flux revision. The visual source is supplied explicitly with `--project`: the `MASTER_DEMO_FluxProj` folder inside the owner's confirmed `flux_demo_master` directory. Local paths are never published.

`media/showcase.mjs` reads the two selected authored figures and their accepted `fig/assets` files. The plots, layout, labels, view settings and accepted asset bytes are preserved; figure titles and captions are supplied for the website. It does not read existing test decks, other manuscripts, context or a personal library. It checks the original figure inputs again after preparing the copy. Linked source paths are redirected to the copied assets, so capture never follows external research paths.

The isolated `.cache/visual-project/` is an internal capture fixture. The stage adds an original manuscript and a small demonstration bibliography to its copy. The source includes real public recordings, calculated examples and illustrative values, identified on the website's visual credits page. No source project files are changed.

## Refreshing stills

Build the production app from a clean Flux checkout at the reviewed revision, with locked Node
dependencies installed. Prepare the two authored figures from the October 2026 master whose
files match `project.plotInputHashes` in `media/native-assets.json`:

```sh
node scripts/refresh-flux-assets.mjs --flux-source /path/to/flux --project /path/to/october/MASTER_DEMO_FluxProj
node media/stills/plates.mjs
```

The first command prepares `.cache/visual-project` and renders both figures in Flux. The second
rasterizes those native exports for the website at 2× display density.

Use a separate private display and debugging port. From the website root, start the stage in one
terminal and capture from another. This example uses the reviewed visual project:

```sh
node media/pitch/stage.mjs --flux-source /path/to/flux --project .cache/visual-project \
  --width 1500 --height 950 --scale 2 --display 157 --port 9537 \
  --take media/stills/prepare-showcase.mjs
node media/stills/capture.mjs --app /path/to/flux --group workspaces --display 157 --port 9537
```

Pass `--display` to the capture command once per stage to size its window. Set `FLUX_XVFB` to
your Xvfb executable if needed. On Linux systems where Xvfb's NVIDIA EGL vendor crashes,
set `__EGL_VENDOR_LIBRARY_FILENAMES=/usr/share/glvnd/egl_vendor.d/50_mesa.json`. If inotify's
watch limit is reached, set `CHOKIDAR_USEPOLLING=true` for the private stage.

| Capture group | Project | Stage setup |
|---|---|---|
| `workspaces`, `properties`, `xray`, `comments` | `.cache/visual-project` | `--take media/stills/prepare-showcase.mjs` installs the demonstration manuscript. |
| `metadata` | `.cache/visual-project` | Enable WebGL2 for the native Figure-Meta proof. The stage adds distinct panel captions to its copy. |
| `reading` | `.cache/visual-project` | `--take media/stills/prepare-library.mjs` installs a demonstration bibliography and public CC BY PDFs into the stage's isolated home. |
| `slides` | `.cache/film-slides/motion` | `--take media/stills/prepare-motion.mjs` selects the four approved Plots in Motion slides from the player export fixture. |
| `features`, `techniques` | `.cache/visual-project` | `--take media/stills/prepare-features.mjs` loads the tutorial plots, dissections and teaching deck below. |
| `images` | A standalone Fluorescence stack project | Place the generated image on Figure 2 and enable native WebGL2. |

The illustrative fluorescence stack comes from `media/stills/make-image-stack.py` and
requires NumPy, SciPy and a fluxplot build supporting `fluximg`. Generate the bundle under
`plots/` of a new fixture. Use `flux create-figure --id fluorescence --width 650 --height 620`,
then `flux place-image fluorescence /path/to/cells-in-motion.fluximg --x 110 --y 80 --width 430
--view '{"furniture":{"scalebar":{},"channelLabels":{}}}'` in that project. On a private Xvfb stage,
Electron can supply WebGL2 via `--extra '--ignore-gpu-blocklist --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader'`.

Each capture runs actual Flux on an isolated copy and drives the app using its keyboard and pointer.
Inspect every image in `.cache/review/stills/` before installing it. Pass the reviewed group
directories to `node media/stills/install.mjs`. This installs the site assets, lossless screenshot
masters and source metadata. Stop the private stages when finished. Run `npm test` after
installation. `node scripts/generate-social-card.mjs` rasterizes the website-owned social preview.

## Live slides

The homepage combines four slides from the current master’s `plots_in_motion` deck and two
slides from the October launch film. The guides use six film examples. `media/film-slides.mjs`
selects the authored examples and records their player titles, credits and alt text.

Prepare the Flux checkout at `slidePlayer.revision` in `flux-source.json`, install its locked
dependencies, and apply any patches listed in that pin. Then export from the current master:

```sh
node scripts/refresh-slides.mjs --flux-source /path/to/flux-player --project /path/to/MASTER_DEMO_FluxProj
```

The exporter refreshes the native runtime for every slide. It reads the previously reviewed
film payloads and guide posters from the website’s Git history and verifies their hashes.
Supply `--film-project /path/to/october/MASTER_DEMO_FluxProj` to export from the original film
decks instead. Add `--review` to export
the animated slides in the supplied project decks into `.cache/slides-review/`.

`media/slides.json` records the runtime revision, the motion deck input hashes, the film sources,
and hashes for the homepage player and its per-slide compressed payloads (`site/demos/slides/`), guide players and stills
(`site/demos/studies/`), the homepage poster and the bundled runtime license notices. Each
slide keeps its own theme and styles. The website hides the player’s authoring notes.

## Documentation examples and close-ups

Prepare the teaching deck and tutorial plots before staging the guide captures:

```sh
node scripts/refresh-docs-demos.mjs --flux-source /path/to/flux
cd /path/to/fluxplot
uv run python /path/to/site/media/docs-plots/make_docs_plots.py /path/to/site/.cache/review/docs-plots
```

The first command uses Flux's alignment operations to draw the four Animator timing diagrams into
`site/demos/techniques/` and leaves the capture deck in `.cache/docs-techniques/`. In
`.cache/review/dissections/atlas/`, use the showcase's `rose.svg` and `profiles.svg` as
`preferred-directions.svg` and `direction-profiles.svg`. Add an illustrative
`_stats/direction_counts.csv` and `observations.txt` with a `#check` tag. The stage copies
those assets into the project before launch.

`media/docs-plots/make_docs_plots.py` also draws the explicitly synthetic examples for the
plotting guides. `media/docs-plots.json` records their hashes. Short guide recordings and their
poster frames are tracked separately in `media/docs-clips.json`.

Review playback, small screens, reduced motion, keyboard controls and light/dark surroundings.
Normal builds audit the manifests without reading any capture fixture or starting Flux.

## Licenses and credit

Runtime dependency licenses are under `site/assets/licenses/`; Gelasio's SIL OFL notice is in `site/assets/fonts/OFL.txt`. Scientific assets retain their own source terms. The website's visual credits page identifies Allen Institute, MICrONS, FermiSurfer and Crystallography Open Database sources and distinguishes measured, computed and illustrative content. Website licensing does not relicense source datasets.

## Part explorer plot

`media/explorer/make_explorer.py` draws a small synthetic fluxbox with fluxplot (run it from a
fluxplot checkout: `uv run python media/explorer/make_explorer.py <outdir>`), and
`media/explorer/build_explorer.py <outdir> <website root>` turns the saved bundle into
`site/assets/media/docs/explorer-fluxbox.svg` (viewBox only, matplotlib's global style rule
removed) plus a compact JSON description of the manifest's parts tree. That JSON is embedded in
`site/docs/semantic-plots.qmd` and `site/index.qmd`, where `site/assets/scripts/explorer.js`
lets a reader hover any named part. The values are synthetic and say so on the page.
