# Flux website

The public Flux website at **https://fluxsci.github.io/**, built with Quarto and maintained independently from the application.

The current review milestone includes the homepage, installation, a searchable documentation directory, and two finished guides: **Your first project** and **Projects and files**. Remaining topics link to current upstream documentation while their new editions are prepared. The installation page reflects the current public desktop release.

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
| `scripts/docs.mjs` | Shared document frame, directory, code-copy markup, and search index |
| `site/assets/styles/site.css`, `docs.css` | Shared visual system and documentation layouts |
| `site/assets/scripts/site.js`, `docs.js` | Accessible progressive interactions, search, and copy controls |
| `site/assets/media/` | Reviewed app screenshots and original plot derivatives |
| `site/demos/data-morph/` | Native Flux inline-slide player export |
| `site/install.sh` | Byte-for-byte copy of the reviewed upstream installer |
| `flux-source.json` | Exact Flux revision used for product assets and installer |
| `media/` | Provenance, refresh code, and website manuscript; never published |
| `plans/` | Internal planning; never published |
| `dist/` | Generated publication artifact; never committed |

Add a route to `scripts/routes.mjs` and `site/_quarto.yml`. The build generates route-specific canonical URLs, the sitemap, shared document navigation, and a local search index. It checks every local link and fragment, unique IDs, image descriptions, publication allowlists, asset hashes, and accidental personal paths.

## Visual material

The previous bundled example and download have been retired. The owner's separately maintained visual project supplies only authorized plot files. Refreshing assets creates an isolated temporary project with new website compositions, new slides, original captions, and an illustrative manuscript. It does not read or reuse the owner's test slides, test figure canvases, manuscript, context, or personal library; it never writes to the source project. Scientific demo data are labeled synthetic.

Normal builds use checked-in reviewed assets and need neither the author's project nor a Flux checkout. See [media/README.md](media/README.md) for the deliberate refresh workflow. Its source input hashes prove that the selected plot bytes were preserved. The interactive slides use Flux's native player. The homepage SVG inspector switches between unchanged plot states; it does not implement a replacement animation engine.

## Publish

GitHub Pages uses **GitHub Actions**, with HTTPS enforced. After `npm test` and visual review, stage explicit source paths, commit, and push `main`. The **Verify and publish website** workflow runs the same checks, uploads only `dist/`, then deploys to **https://fluxsci.github.io/**. Pull requests produce a review artifact without deploying.

The app's release and the website are separate. Publishing this website does not publish a draft Flux release. Keep the installation availability note accurate when public releases change.
