# Flux website

The public Flux website at **https://fluxsci.org/**, built with Quarto and maintained independently from the application.

The site includes a concise visual homepage, installation instructions, and 46 searchable guides and references covering all five workspaces, fluxplot, the command line, agent connections and integrations. Every documentation topic is local. The installation page reflects the current public desktop release.

## Develop and verify

Use Node **22** and Quarto **1.10.18**. The build enforces the exact Quarto version; set `QUARTO_BIN` if it is not on PATH (`~/.local/bin/quarto` is detected).

```sh
npm ci
npm run test:install
npm run build
npm run preview
```

The preview is at **http://127.0.0.1:1430**. It serves only `dist/`, with a real 404 response for unknown routes. Use `npm run preview -- --port 1431` if needed. After edits, run `npm test`: build and publication audit, server checks, then Chromium, Firefox, WebKit, and mobile browser checks.

## Content and design

| Path | Purpose |
| --- | --- |
| `site/index.qmd` | Homepage |
| `site/install/index.qmd` | Installation, companions, updates, and troubleshooting |
| `site/docs/*.qmd` | Authored guides; the directory is generated from the navigation manifest |
| `scripts/routes.mjs` | Explicit public routes and ecosystem topic navigation |
| `scripts/docs.mjs` | Shared header and footer for every page, the documentation directory, table wrappers, code-copy markup, and the search index |
| `site/assets/styles/site.css`, `docs.css` | Shared visual system and documentation layouts |
| `site/assets/scripts/site.js`, `docs.js`, `explorer.js` | Accessible progressive interactions, search, copy controls, and the semantic-plot part explorer |
| `site/assets/media/` | Reviewed app screenshots, original plot derivatives, and `docs/explorer-fluxbox.svg` (a synthetic fluxbox saved by fluxplot for the part explorer) |
| `site/assets/film/` | The homepage film: an HLS ladder of fragmented-MP4 segments (2160p, 1440p, 1080p, 720p at 60 fps), poster and captions, produced by `media/film/encode.mjs` |
| `site/demos/slides/` | The homepage player: six slides from the Flux film in Flux's native inline-slide player |
| `site/demos/studies/` | One film slide per documentation example (`<id>.html` and its still) |
| `site/demos/techniques/` | Animator timeline alignment diagrams |
| `site/install.sh` | Byte-for-byte copy of the reviewed upstream installer |
| `flux-source.json` | Exact Flux revision used for product assets and installer |
| `media/` | Provenance, refresh code, and website manuscript; never published |
| `plans/` | Internal planning; never published |
| `dist/` | Generated publication artifact; never committed |

Add a route and navigation entry to `scripts/routes.mjs`; `site/_quarto.yml` renders all documentation QMD files. The build generates route-specific canonical URLs, the sitemap, shared document navigation, and a local search index. It checks every local link and fragment, unique IDs, image descriptions, publication allowlists, asset hashes, and accidental personal paths.

## Homepage film

The film sits directly below the homepage header. Nothing streams until a visitor presses play; the poster then becomes a native `<video>`. Safari and every iOS browser play the HLS ladder natively (with AirPlay); other browsers use `site/assets/scripts/film.js`, which appends the same fragmented-MP4 segments into one MediaSource buffer (one continuous timeline) and picks the rendition that fits the player and the connection, up to 4K at 60 fps. Without JavaScript the page offers a native video element. "Watch the video" beside the install button starts the film full screen in the same click (iPhone uses its own full-screen player); without JavaScript it links down to the film.

Re-encode after replacing the master (the masters stay outside the repository; their hashes are recorded):

```sh
node media/film/encode.mjs --film /path/to/film-4k60.mp4 --audio /path/to/soundtrack-master.wav --poster-time 54
npm test
```

`media/film.json` records every published film file by size and SHA-256; the build refuses a film that differs from it. The film has its own publication budget (600 MB, beside the 150 MB site budget) and every segment stays under the 15 MB per-file limit. GitHub Pages serves up to 1 GB per site and has a soft bandwidth limit of about 100 GB a month: one full viewing costs roughly 40 MB at 720p and 150–250 MB at 4K. If traffic grows, move the same ladder to a video host or CDN and point `data-film-src` in `site/index.qmd` at the new master playlist.

## Article clips

`site/in-60-seconds/` is the pitch article: one reading column (`kind: "article"` in `scripts/routes.mjs`) with 4:3 clips of the app. It is `unlisted` (built and checked, but absent from the sitemap, search and navigation, and marked `noindex`) until it is announced.

Each clip is filmed in the real desktop app, never in a mock-up:

```sh
FLUX_XVFB=/path/to/Xvfb node media/pitch/make.mjs --flux-source /path/to/flux --project /path/to/MASTER_DEMO_FluxProj --take colormap
node media/pitch/make.mjs … --take colormap --reuse <take dir>    # new framing or encoding, same recording
```

- `media/pitch/stage.mjs` copies the project to a scratch folder, isolates HOME, and runs the production Electron build on a private X display at 4x pixel density (a 1840x1100 window, 7360x4400 pixels).
- `media/pitch/record.mjs` sizes the window to fill that display, drives the app with real input events and grabs the screen losslessly at 60 fps (the whole figure, about 18 megapixels a frame). A take is a function in `takes`; it logs the pointer's glides as formulas (an arc, a duration, a reaching ease: quick off the mark, a long soft landing, timed by distance), clicks, keys and named moments on the page clock. One 8 px square outside every camera frame carries that clock as a colour, so each grabbed frame knows its own time.
- `media/pitch/cursors.mjs` renders the pointer. The take records which of Flux's cursor images was showing at every moment (the pink arrow by default); those images, and the press frames from Flux's own `cursorFamily.ts`, are drawn at 8x. The pointer in a clip is always the app's own cursor, never a stand-in.
- `media/pitch/compose.py` renders the clip: a 4:3 camera that eases between framings (defined per take in `CAMERAS`: start on the whole figure, move in for each action, pull back when a whole panel appears), that pointer (slightly enlarged so it reads on a phone, playing the app's press on every click), a soft ring at each click, key badges, and a dissolve back to the first frame for a seamless loop. It refuses a framing with fewer real pixels than the output is wide (480 CSS px at 4x for 1920), so nothing is ever enlarged. Frames go to a lossless master first; the published files are encoded from it: 1920x1440 (H.264 High, level 5.1, BT.709, 60 fps, about 7 MB for 16 seconds), a 1280x960 copy for phones (level 4.2, about 4 MB), and the first frame as the poster.
- `media/pitch.json` records the Flux revision of every take and the bytes and SHA-256 of every output; the build refuses clips that differ. `media/pitch/review.mjs <dir>` screenshots the built page on desktop and phone with the clip playing.

On the page a clip is `<figure class="doc-clip article-clip">`: muted, looping, inline, playing only while in view, with no control bar; a click, tap, Enter or Space pauses it. Narrow screens get the 1280 source (`media="(max-width: 700px)"`), everything else the 1920 one. On a desk the clip stands wider than the text column (up to 960 px); on a phone it runs nearly edge to edge. Reduced motion keeps the still frame and the native controls. To keep interface text readable on a phone, hold a framing no wider than about 600 CSS pixels of the app while something small is being read or clicked; wider framings are for showing where things are.

## Visual material

The previous bundled example and download have been retired. The confirmed master demonstration project supplies two authored figures and their accepted assets. Their plot content and layout are preserved. Refreshing media creates an isolated copy with original captions, a new manuscript, a small demonstration bibliography, and three new slides. Existing test slides and the owner's personal configuration or library are never read.

The showcase includes public Allen Brain Observatory recordings, anatomical models, calculated fields, crystallographic records and illustrative material properties. Sources and interpretation are documented on the [visual credits page](site/docs/visual-credits.qmd).

The live slides on the homepage and in the guides are the slides from the Flux film, exported unchanged from the owner's film decks (`media/film-slides.mjs` selects them). They need slide-engine changes made after v0.2.0, so `flux-source.json` pins the slide player separately (`slidePlayer`: a public revision plus reviewed patches in `media/flux-patches/`). `media/slides.json` records their provenance.

Normal builds use reviewed, checked-in assets and need neither the source project nor a Flux checkout. See [media/README.md](media/README.md) for the deliberate refresh workflow. Input hashes and preservation checks protect the selected compositions. Interactive slides use Flux's native player, including its 3D runtime.

## Publish

GitHub Pages uses **GitHub Actions**, with HTTPS enforced. After `npm test` and visual review, stage explicit source paths, commit, and push `main`. The **Verify and publish website** workflow runs the same checks, uploads only `dist/`, then deploys to **https://fluxsci.github.io/**. Pull requests produce a review artifact without deploying.

The app's release and the website are separate. Publishing this website does not publish a draft Flux release. Keep the installation availability note accurate when public releases change.
