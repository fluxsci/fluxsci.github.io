# Flux website

The public Flux website at **https://fluxsci.github.io/**, built with Quarto and maintained independently from the application.

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
| `site/demos/data-morph/` | Native Flux inline-slide player export |
| `site/demos/techniques/` | Six native teaching slides and timeline alignment diagrams |
| `site/install.sh` | Byte-for-byte copy of the reviewed upstream installer |
| `flux-source.json` | Exact Flux revision used for product assets and installer |
| `media/` | Provenance, refresh code, and website manuscript; never published |
| `plans/` | Internal planning; never published |
| `dist/` | Generated publication artifact; never committed |

Add a route and navigation entry to `scripts/routes.mjs`; `site/_quarto.yml` renders all documentation QMD files. The build generates route-specific canonical URLs, the sitemap, shared document navigation, and a local search index. It checks every local link and fragment, unique IDs, image descriptions, publication allowlists, asset hashes, and accidental personal paths.

## Visual material

The previous bundled example and download have been retired. The confirmed master demonstration project supplies two authored figures and their accepted assets. Their plot content and layout are preserved. Refreshing media creates an isolated copy with original captions, a new manuscript, a small demonstration bibliography, and three new slides. Existing test slides and the owner's personal configuration or library are never read.

The showcase includes public Allen Brain Observatory recordings, anatomical models, calculated fields, crystallographic records and illustrative material properties. Sources and interpretation are documented on the [visual credits page](site/docs/visual-credits.qmd).

Normal builds use reviewed, checked-in assets and need neither the source project nor a Flux checkout. See [media/README.md](media/README.md) for the deliberate refresh workflow. Input hashes and preservation checks protect the selected compositions. Interactive slides use Flux's native player, including its 3D runtime.

## Publish

GitHub Pages uses **GitHub Actions**, with HTTPS enforced. After `npm test` and visual review, stage explicit source paths, commit, and push `main`. The **Verify and publish website** workflow runs the same checks, uploads only `dist/`, then deploys to **https://fluxsci.github.io/**. Pull requests produce a review artifact without deploying.

The app's release and the website are separate. Publishing this website does not publish a draft Flux release. Keep the installation availability note accurate when public releases change.
