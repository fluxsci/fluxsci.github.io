# Flux website

A custom Quarto website for [Flux](https://github.com/fluxsci/flux), maintained separately
from the application. The first version is the public homepage: a staged entrance built on
the phyllotaxis mark and five connecting strands, a manual preview of all five real application
workspaces, a semantic-plot explorer integrated into Figure, an eleven-panel flagship
neuroscience figure composed from the bundled project's thirty-three plots, and four
native interactive slides. The public guide
stays in the application repository until its planned migration; there are no unfinished
guide pages here.

Repository: **[`fluxsci/fluxsci.github.io`](https://github.com/fluxsci/fluxsci.github.io)**  
Website: **<https://fluxsci.github.io/>**

## Local development

Install Node **22** (`nvm use`) and [Quarto **1.10.18**](https://github.com/quarto-dev/quarto-cli/releases/tag/v1.10.18).
The build checks the exact Quarto version. If Quarto is not on your PATH, set
`QUARTO_BIN=/absolute/path/to/quarto`; `~/.local/bin/quarto` is also detected.

```sh
nvm use
npm ci
npm run test:install
npm run build
npm run preview
```

Open **http://127.0.0.1:1430**. `npm run preview` serves only the verified `dist/` directory,
with a real 404 response for unknown routes. It binds to localhost and refuses a busy port.
Use `npm run preview -- --port 1431` (or `PORT=1431 npm run preview`) if needed.

For editing with Quarto's live reload:

```sh
npm run dev
```

The live preview also uses localhost port 1430. Stop one preview before starting the other.
After changes, run `npm test` to produce and verify the actual publication artifact.

## Source and output

| Path | Purpose |
| --- | --- |
| `site/index.qmd` | Homepage content and semantic markup |
| `site/assets/styles/site.css` | Flux visual system and responsive layouts |
| `site/assets/scripts/site.js` | Navigation, theme, media viewing and demo behavior |
| `site/assets/media/` | Reviewed, publishable screenshots and slide poster; `xray/` holds the three plot files the semantic-plot explorer reads |
| `site/assets/brand/`, `site/assets/fonts/` | Flux mark, sharing image and licensed fonts |
| `site/demos/` | Static exports from the native Flux slide runtime |
| `site/_quarto.yml` | Explicit public page list, metadata and asset configuration |
| `site/404.qmd` | Branded missing-page response |
| `flux-source.json` | Exact Flux product revision used for refreshed assets |
| `examples/neural-populations/` | Complete editable Flux project, public data, plot recipes and original manuscript |
| `media/` | Media provenance and refresh helpers; never published |
| `site/downloads/` | Generated project ZIP; recreated from the bundled project at build time |
| `plans/` | Technical and content/styling plans; never published |
| `scripts/` | Build, audit, preview and optional asset generation tools; `project-exports.json` lists reviewed project derivatives |
| `tests/` | Publication behavior and browser verification |
| `dist/` | Generated, verified publication artifact; never committed |

Normal builds **do not read a Flux checkout**, execute application code, or require Electron.
Approved media and native slide exports are checked in. Application updates only affect the
website when its product pin and assets are deliberately refreshed and reviewed.

`node scripts/generate-social-card.mjs` regenerates the 1200 × 630 sharing image from
local Flux typography and the phyllotaxis mark. It uses the website's Playwright browser;
no image service or Flux checkout is needed.

The source and output checks use explicit allowlists. Adding a public route requires updating
`site/_quarto.yml`, the approved route list in `scripts/check.mjs`, and the sitemap generator
in `scripts/build.mjs`. Plans, personal paths, source maps and unexpected generated files cannot silently enter
the Pages artifact. The one deliberate source download is the audited project ZIP; its
contents are read only from `examples/neural-populations/`, with local caches and runtime locks excluded.
The advanced plotting environment's `uv.lock` is retained. Reviewed derivatives are listed in
`scripts/project-exports.json`: manuscript figures/PDF, plot PNG/PDF previews, the review
overview, and the native morph playback preview with its runtime licenses. These files have
explicit Git ignore exceptions, so clean CI and local builds package the same material.
Other files under `exports/` or `fig/renders/` remain local and are omitted from the ZIP.
Native assets and screenshots are also verified against their source revision and SHA-256
provenance in `media/native-assets.json` and `media/screenshots.json`.
The [media refresh guide](media/README.md) documents the optional pinned Flux checkout,
isolated fixture, native export and screenshot capture commands. These tools are separate
from `npm run build` and the publication workflow.

## The editable example project

Everything behind the neuroscience demonstration lives in
[`examples/neural-populations/`](examples/neural-populations/README.md). In Flux, choose
**Open project** and select that directory (the folder containing `project.json`). It includes
an original manuscript, thirty-seven source SVGs (thirty-three plot families, including the
thirteen journal-style flagship panels), two editable figure compositions rebuilt through the
Flux CLI, four animated slides, public datasets, source notes, and regeneration scripts. No separate example repository
or folder under a maintainer's home directory is required.

The homepage's **Download the Flux project** link supplies that same directory as a ZIP.
Every build recreates the archive deterministically, verifies its extracted bytes against
the canonical project, and checks the published archive hash. The ZIP is generated output,
not a second editable copy. Opening the unzipped project does not require Python or a data
connection; Python is only needed to regenerate its source plots.

Edit this canonical project in Flux, then follow [the media refresh guide](media/README.md)
to update the screenshots and native website slides. Ordinary website builds preserve your
manuscript, compositions, plot overrides, and deck edits; they never run the initializer or
regenerate scientific content. The example's public data and derived visualizations retain
the source terms documented inside the project.

## Verification

```sh
npm run build          # Quarto render plus source/output and local-link audit
npm run check          # Audit source and an existing dist/
npm test              # Build, preview-server checks, all browser projects
npm run test:browser  # Browser checks against the current dist/
```

Playwright covers Chromium, Firefox, WebKit and an iPhone-size WebKit viewport. Browser
checks exercise navigation, loaded images, responsive layout, theme and controls, slide
playback, accessibility and the 404 page. Failures retain screenshots and traces in
`test-results/` and an HTML report in `playwright-report/`. External links are kept explicit;
the build verifies local targets without depending on third-party network availability.

The native slide demonstration is trusted content generated from the pinned Flux source.
It runs in an isolated document, is loaded on request, and uses Flux's actual player. Do not
replace its engine with website animation code or put unreviewed user HTML into that iframe.

## GitHub Pages deployment

The repository's Pages source is configured as **GitHub Actions**, with HTTPS enforced.
The `origin` remote is `https://github.com/fluxsci/fluxsci.github.io.git`. After reviewing
changes and passing `npm test`, commit explicit source paths and push `main`:

```sh
git push origin main
```

Follow **Actions → Verify and publish website** for the build and deployment status.
The workflow can also be run manually from that page. Successful deployment publishes
**https://fluxsci.github.io/** through the `github-pages` environment.

The workflow installs the pinned tools, builds, runs the full verification suite, and uploads
only `dist/`. Pull requests get a downloadable site artifact and verification results;
they do not deploy. Successful `main` builds deploy through GitHub's Pages artifact workflow.
The build job has read-only repository access. Only the deployment job can write Pages and
request its deployment identity. There are no deploy keys or repository-write tokens.

A custom domain can be added later by updating Pages DNS/settings, `website.site-url`,
`site/robots.txt`, and the canonical URL/sitemap checks together. Keep a single canonical
origin; do not duplicate the public guide across the website and app repositories.

## Design and scope

The [technical plan](plans/technical-plan.md) covers repository ownership, the static build,
the pinned product interface, publishing and future guide migration. The
[content and styling plan](plans/content-styling-plan.md) defines page scope, media and Flux's
visual conventions. The homepage implementation is the first complete design milestone.
The [implementation review](plans/implementation-review.md) records the delivered first
version, browser and visual checks, and the remaining publication setup.

Public screenshots show our bundled neuroscience example. Its prose and visual designs are
original; the numerical and anatomical sources are public Allen Institute data with their
own noncommercial-use and attribution terms. See the project data README. Captures use an
isolated memory copy of this project, never a personal library or `FluxConfig`. Third-party
font licensing is retained in `site/assets/fonts/OFL.txt`.
