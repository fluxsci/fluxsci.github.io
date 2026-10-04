# Reviewed product media

Normal builds use checked-in screenshots, native player exports, fonts and figure images. No application checkout, private project or personal configuration is read during a normal build.

## Inputs and boundaries

`flux-source.json` pins the reviewed Flux revision. The visual source is supplied explicitly with `--project`: the `MASTER_DEMO_FluxProj` folder inside the owner's confirmed `flux_demo_master` directory. Local paths are never published.

`media/showcase.mjs` reads the two selected authored figures and their accepted `fig/assets` files. The plots, layout, labels, view settings and accepted asset bytes are preserved; figure titles and captions are supplied for the website. It does not read existing test decks, other manuscripts, context or a personal library. It checks the original figure inputs again after preparing the copy. Linked source paths are redirected to the copied assets, so capture never follows external research paths.

The isolated `.cache/visual-project/` contains three original website slides, an original manuscript and a small demonstration bibliography. It is neither a bundled editable example nor a published download. The source includes real public recordings, calculated examples and illustrative values, identified on the website's visual credits page. No source project files are changed.

## Refresh

Prepare a clean Flux checkout at the pinned revision with locked Node dependencies installed. Start that checkout's development server on port 1420. From the website root:

```sh
node scripts/refresh-flux-assets.mjs --flux-source /path/to/pinned/flux --project /path/to/MASTER_DEMO_FluxProj
node scripts/capture-media.mjs --flux-source /path/to/pinned/flux
npm test
```

Set `FLUX_CHROME` to a Chrome/Chromium executable if Brave is not installed, and `FLUX_URL` if the app preview uses another port. Stop servers you started when finished.

The screenshot script mirrors the isolated project through the real application's in-memory FileBridge. It seeds a demonstration Library and an original manuscript PDF without accessing a personal library. Screenshots show unmodified Flux UI at 2× display density; manifest dimensions describe the viewport. Figure plates come from the native figure renderer, with native 3D posters.

Review all five workspaces, plot editing, both plates and every step of the three slides. The player uses native `mountSlideEmbed` and the native 3D host. Website code loads the player, selects a slide, preserves manual progress, resizes its frame and pauses it offscreen. Flux owns rendering, animation and transforms.

`media/native-assets.json` records product and source input hashes and published runtime hashes. `media/screenshots.json` records capture conditions and image hashes. `media/installer.json` records the reviewed installer's exact bytes. `media/documentation.json` records the revisions used to write the guides and API reference.

## Documentation examples and close-ups

`media/techniques.mjs` authors six original geometric studies: entrance effects, Change, Ghost,
Become, easing and emphasis. They use no owner slides or research data. The native Flux player
renders and plays each example; the timeline comparison diagrams use Flux's own alignment
operations to calculate their before-and-after positions.

```sh
node scripts/refresh-docs-demos.mjs --flux-source /path/to/pinned/flux
node scripts/capture-docs.mjs --flux-source /path/to/pinned/flux
```

The first command exports posters and a shared player to `site/demos/techniques/`, records their
hashes in `media/docs-demos.json`, and saves the capture deck under `.cache/docs-techniques/`.
The second needs the isolated visual project from the earlier refresh and the Flux development
server. It captures the X-ray, property menu and Animator in the native in-memory fixture,
recording image dimensions and hashes in `media/docs-screenshots.json`.

Review all six examples during playback and at rest, plus all four alignment diagrams. Check
mobile sizing, reduced motion, keyboard controls, no-script posters and light/dark document
surroundings. The browser suite covers these interactions. Normal builds audit both manifests
without reading the source project or starting Flux.

## Licenses and credit

Runtime dependency licenses are under `site/assets/licenses/`; Gelasio's SIL OFL notice is in `site/assets/fonts/OFL.txt`. Scientific assets retain their own source terms. The website's visual credits page identifies Allen Institute, MICrONS, FermiSurfer and Crystallography Open Database sources and distinguishes measured, computed and illustrative content. Website licensing does not relicense source datasets.
