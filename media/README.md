# Reviewed product media

Normal builds use checked-in screenshots, native player exports, fonts and figure images. No application checkout, private project or personal configuration is read during a normal build.

## Inputs and boundaries

`flux-source.json` pins the reviewed Flux revision. The visual source is supplied explicitly with `--project`: the `MASTER_DEMO_FluxProj` folder inside the owner's confirmed `flux_demo_master` directory. Local paths are never published.

`media/showcase.mjs` reads the two selected authored figures and their accepted `fig/assets` files. The plots, layout, labels, view settings and accepted asset bytes are preserved; figure titles and captions are supplied for the website. It does not read existing test decks, other manuscripts, context or a personal library. It checks the original figure inputs again after preparing the copy. Linked source paths are redirected to the copied assets, so capture never follows external research paths.

The isolated `.cache/visual-project/` contains an original manuscript and a small demonstration bibliography (and the retired website deck, used only by a full screenshot refresh). It is neither a bundled editable example nor a published download. The source includes real public recordings, calculated examples and illustrative values, identified on the website's visual credits page. No source project files are changed.

## Refresh

Prepare a clean Flux checkout at the pinned revision with locked Node dependencies installed. Start that checkout's development server on port 1420. From the website root:

```sh
node scripts/refresh-flux-assets.mjs --flux-source /path/to/pinned/flux --project /path/to/MASTER_DEMO_FluxProj
node scripts/capture-media.mjs --flux-source /path/to/pinned/flux
npm test
```

Set `FLUX_CHROME` to a Chrome/Chromium executable if Brave is not installed, and `FLUX_URL` if the app preview uses another port. Stop servers you started when finished.

The screenshot script mirrors the isolated project through the real application's in-memory FileBridge. It seeds a demonstration Library and an original manuscript PDF without accessing a personal library. Screenshots show unmodified Flux UI at 2× display density; manifest dimensions describe the viewport. Figure plates come from the native figure renderer, with native 3D posters.

Review all five workspaces, plot editing and both plates.

`media/native-assets.json` records product and source input hashes and published runtime hashes. `media/screenshots.json` records capture conditions and image hashes. `media/installer.json` records the reviewed installer's exact bytes. `media/documentation.json` records the revisions used to write the guides and API reference.

## Slides from the Flux film

The homepage player and every documentation example play slides from the launch film. They are
exported unchanged from the owner-authorized decks "Deck 6" and "Figure 11 deck" of
`MASTER_DEMO_FluxProj` (the October 2026 film copy). `media/film-slides.mjs` selects the slides,
their player titles, credits and alt text; credits follow each slide's own source notes.

The film decks need slide-engine changes made after v0.2.0 (Become pairs morph outline to outline,
transforms repaint their end state, dissolve is the default transform). `flux-source.json` therefore
pins the slide player separately: `slidePlayer.revision` is a public Flux commit and
`slidePlayer.patches` lists reviewed patches applied on top (FLUX-057: the caption letters of the
Figure 11 Become fly as in Present). Prepare that checkout, then export:

```sh
git -C /path/to/flux worktree add --detach /tmp/flux-player <slidePlayer.revision>
git -C /tmp/flux-player apply "$PWD/media/flux-patches/flux-057-glyph-handoff.patch"   # each listed patch
node scripts/refresh-slides.mjs --flux-source /tmp/flux-player --project /path/to/MASTER_DEMO_FluxProj
```

It refuses a checkout that differs from the revision plus the listed patches. Outputs:
`site/demos/slides/index.html` (homepage), `site/demos/studies/<id>.html` and `<id>.svg` (one page
and still per guide example), `site/assets/media/slide-poster.svg`, and the bundled runtime license
notices, all recorded in `media/slides.json`. Each slide keeps its own deck payload, because the
decks differ in theme. The website hides the player's authoring notes (`.flux-slide-status`); the
brain-region slide's text-to-text Become crossfades by design. Add `--review` to export every slide
of both decks to `.cache/slides-review/` for choosing new ones.

The export also writes `.cache/film-capture-project/` for the Slides workspace screenshot. With the
pinned release's development server on port 1420:

```sh
node scripts/capture-slides.mjs --flux-source /path/to/pinned/flux
```

This replaces only `slides.webp` and its entry in `media/screenshots.json`.

## Documentation examples and close-ups

`media/techniques.mjs` authors a small geometric deck. The Animator timeline diagrams use Flux's own
alignment operations on it to calculate their before-and-after positions; its slides are no longer
published.

```sh
node scripts/refresh-docs-demos.mjs --flux-source /path/to/pinned/flux
node scripts/capture-docs.mjs --flux-source /path/to/pinned/flux
```

The first command draws the four Animator timing diagrams into `site/demos/techniques/`, records
their hashes in `media/docs-demos.json`, and saves the geometric capture deck under
`.cache/docs-techniques/`. The second needs the isolated visual project from the earlier refresh and
the Flux development server. It captures the X-ray, property menu and Animator in the native
in-memory fixture, recording image dimensions and hashes in `media/docs-screenshots.json`.

Review the four alignment diagrams and, for the film slides, every documentation example during
playback and at rest. Check mobile sizing, reduced motion, keyboard controls, no-script stills and
light/dark document surroundings. The browser suite covers these interactions. Normal builds audit
every manifest without reading the source project or starting Flux.

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
