# Flux website — technical implementation plan

**Updated:** 2026-09-13. The separate-repository decision supersedes the original proposal to keep the public site in `flux/docs/`.

**Companion:** [Content and styling plan](content-styling-plan.md).

**Current approved implementation scope:** the polished main landing page and its build, media, testing, preview, and publishing infrastructure. The full guide and additional showcase/example pages remain later milestones.

**Implementation:** the first homepage and infrastructure are complete locally. See the
[implementation review](implementation-review.md) for delivered behavior, verification and
remaining GitHub repository setup.

## 1. Architecture and ownership

Build one custom **Quarto website in `fluxsci/fluxsci.github.io`**, published by GitHub Actions to **https://fluxsci.github.io/**. The local checkout is `~/fluxsci.github.io`. Public source lives in `site/`; the deployable artifact is `dist/`. The website has its own package manifest, lockfile, tests, assets, and publishing workflow.

The separation keeps design changes, screenshot/video history, website dependencies, and deployment configuration out of the application repository. Quarto remains the rendering foundation because `.qmd` matches Flux's existing documentation and scientific authoring. The website's composition, typography, and interactive media are custom.

| Repository | Owns |
| --- | --- |
| `fluxsci/flux` | Application, shared slide player/exporters, canonical CLI/MCP definitions, product contracts, engineering/agent instructions and product verification |
| `fluxsci/fluxsci.github.io` | Public landing page and future guide, website style/components, approved captures and example projects, generated website media/reference snapshots, website tests and publishing |

Documentation remains one authoritative copy per page. During the homepage phase, the existing guides remain in Flux and the website links to them explicitly. Migrate those pages in a later coordinated change; replace their old locations with deliberate pointers/redirects when appropriate. Do not maintain two independently editable versions of the same guide.

Application changes and public documentation changes will sometimes require paired pull requests. Record the corresponding site update with a user-facing feature change. The website records the Flux revision its examples describe; a website revision is not an application release version.

## 2. Framework decision

| Option | Assessment |
| --- | --- |
| **Custom Quarto** | Recommended: `.qmd`, scientific content, existing documentation syntax, future guide navigation/search, ordinary static output. Homepage composition uses supported raw HTML, CSS, and small scripts. |
| Astro + Starlight | Strong alternative if extensive component-driven site-shell behavior becomes essential. Native Markdown/MDX would require migration or a second Quarto pipeline. |
| Docusaurus | Mature reference/versioned-docs system, but introduces React/MDX and does not remove the need for bespoke design. |
| SvelteKit static | Familiar implementation tools and complete control, but requires assembling more of the documentation/search/navigation system. |
| Separate marketing and guide frameworks | Avoid initially: doubles shell, asset, navigation, and search integration work. |

Use documented Quarto extension points, not a framework fork or DOM surgery. The homepage can disable default Bootstrap/Quarto chrome while preserving Quarto as the source-to-static-output renderer. Future guide pages can adopt guide-specific layout metadata without imposing a documentation sidebar on the landing page. [Quarto page layouts](https://quarto.org/docs/output-formats/page-layout.html), [HTML themes](https://quarto.org/docs/output-formats/html-themes.html), [shortcodes](https://quarto.org/docs/extensions/shortcodes.html).

## 3. Source tree and boundaries

The following layout defines responsibilities; the README documents the exact implemented commands and filenames.

```text
fluxsci.github.io/
├── AGENTS.md
├── README.md
├── package.json / package-lock.json
├── .nvmrc
├── flux-source.json                 # Product repository + immutable revision
├── plans/
│   ├── technical-plan.md
│   └── content-styling-plan.md
├── site/
│   ├── _quarto.yml
│   ├── index.qmd                    # The current complete public homepage
│   ├── 404.qmd
│   ├── assets/
│   │   ├── styles/site.css
│   │   ├── scripts/site.js
│   │   ├── brand/
│   │   ├── fonts/
│   │   └── media/
│   ├── demos/neural-populations/index.html # Reviewed native Flux slides
│   └── downloads/neural-populations.zip # Generated downloadable project
├── examples/neural-populations/      # Canonical editable project + public data
├── scripts/                         # Build, serve, verify, asset refresh/capture
├── tests/                           # Website behavior and publication checks
├── .github/workflows/pages.yml
└── dist/                            # Ignored, complete deployable output
```

Keep refresh helpers, asset provenance, and capture masters outside the public `site/` tree unless explicitly offered as downloads. Never publish `plans/`, tests, node_modules, product checkout sources, personal configuration, or raw capture sessions. The build uses an explicit page/resource inventory and verifies the final artifact, since render exclusions alone do not prevent a linked source file from being copied.

The landing page links to existing installation, user documentation, and source on GitHub. It must not contain links to empty `/guide/`, module showcase, or example pages. Search across the future guide is deferred until that corpus exists; browser find and direct section navigation work immediately.

## 4. Product dependency and reproducible media

`flux-source.json` records the product repository and full commit hash. The initial pin is `4bb72d895b7879acc404ca83863cdc385982b0b5`, which includes native inline slide embeds.

Separate two workflows:

1. **Normal website build:** install the site's dependencies and render its sources with checked-in, reviewed media and native-demo output. No running Flux app, Electron installation, user configuration, or sibling repository is required.
2. **Explicit product-media refresh:** acquire or specify a checkout at the exact pinned revision, verify its identity and relevant source state, install its lockfile dependencies, generate the native runtime, and use its shared services against the canonical bundled project in `examples/neural-populations/`. GUI captures mirror its actual files into an isolated in-memory filesystem. Capture/render, inspect, and commit the resulting assets with provenance in a website change.

Do not silently use whichever Flux checkout happens to be adjacent. If a local checkout is used for development, verify the pinned commit and reject modifications to the relevant product source. A pin update, refreshed demo assets, their hashes, and changed claims belong in one reviewed site change. Checking in generated media is intentional: it makes small copy/design changes fast and keeps application dependencies out of routine deployment.

Asset provenance should include Flux revision, generator/capture script, canonical project identity, dimensions, source/license status, and content hashes. Runtime, font, and poster bytes must correspond to the same source generation. Keep an immutable input snapshot when a refresh requires user-authored fixture data.

The example project is owned by this repository and is the sole editable source for its
manuscript, twelve plots, two figures, four slides, methods, and public data. Every normal
build makes a deterministic `downloads/neural-populations.zip` from that directory and
round-trips it against source hashes. The downloadable source includes the public data and
reproduction scripts; it excludes caches, advisory locks, environments, and local history.
A specific 40 MB download allowance is separate from the 15 MB per-media limit. No Python,
Flux checkout, or external data fetch is needed to package or open accepted project assets.
Refresh commands preserve authored files and overrides; scaffolding is an explicit setup
operation. Public dataset terms and attribution travel inside the archive and are credited
on the page where derived visuals appear.

Brand assets come from the pinned Flux sources: current phyllotaxis mark, selected Flexoki colors, and approved Gelasio fonts. Copy a limited, licensed subset; do not import the entire application stylesheet or Svelte UI bundle. Website spacing/layout tokens remain site-owned.

## 5. Native slides and other media

The homepage showcases four real animated neuroscience slides, selected inside one deferred iframe. Their source is the ordinary Flux deck in `examples/neural-populations/`, with semantic plots, authored steps, and reproducible public Allen Institute data. The output must use Flux's shared `embedDocument`/`embedPlayer`/payload/poster services; do not rewrite the animation engine or translate the deck to reveal.js.

A `.flux-slide` reference identifies one slide by deck and slide IDs. Its occurrence anchor, caption, and width belong to the document. The compact player begins at step 0, advances one authored beat at a time, and keeps occurrence state independent. Published examples are snapshots; saved project changes refresh Paper, while a website update requires rebuilding its snapshot.

**Plain Quarto does not enhance `.flux-slide` attributes on its own.** Flux preparation produces the interactive HTML. For the homepage, generate a self-contained example and serve it in a same-origin, click-to-load iframe. Show a useful poster, clear activation control, aspect-ratio reservation, and explanatory caption before activation. This defers native payload/font bytes as well as player creation and protects the homepage's initial transfer budget.

Retain native Back/Next/Reset, step count, and Animation behavior, with accessible control sizes. Avoid calling compact controls “Play” if their function is to advance one step. Preserve the shared player's handling of reduced motion and in-progress steps. Stop or dispose inactive examples when hidden. If a host bridge is required, expose only narrow lifecycle operations through an explicit origin/source-checked contract; do not pretend the compact host exposes full-deck `window.fluxDeck` APIs.

A full-deck export is a different example type, useful later for complete presentation playback. Its `window.fluxDeck` API offers play ranges, seek, pause/resume, and state; its current initial focus and motion behavior require activation/focus management. Neither iframe approach is a sandbox for arbitrary uploaded code. Only repository-reviewed content is published.

Static posters include the required fonts and faithfully represent step 0. HTML preserves interactivity; PDF/Word use step 0 regardless of the editor's transient state. Provide a text explanation and a completed-state image where needed. Missing assets, unresolved parts, source-refresh problems, or layout warnings must not silently enter curated examples.

Screenshots show the actual current application using isolated demonstration state. Prefer true workspace captures and useful detail crops over composites. Never access the owner's personal library, project data, credentials, or transcripts to populate public media. Use responsive WebP/PNG output with explicit dimensions and useful alt text. Selected masters may be versioned while compact; long recordings belong in a separate archive with checksums. Short approved MP4 clips are optional after the first static/native-demo release.

## 6. Homepage implementation and future content

The homepage itself includes substantial sections for Paper, Figure, Slides, Library, and Reader, followed by project ownership, FluxConfig, agent integration, and a coherent next step. It uses the story and media assignments in the companion plan while adapting composition to real captures.

The visual direction remains Flux: warm paper, near-black framing, Georgia/Gelasio display and reading typography, quiet blue interface accents, the multicolored phyllotaxis mark, precise diagrams, fine rules, and ample whitespace. Site controls use readable sizes rather than copying dense desktop controls at their original size. Support mobile, light/dark appearance, keyboard navigation, reduced motion, and readable no-JavaScript content.

Implement one custom header/footer, semantic section navigation, accessible mobile menu, image enlargement, appearance controls, and deferred native demo activation. Keep interaction scripts small and scoped. Future guide pages will add a task sidebar, page contents, searchable references, and controlled metadata; those are not required to ship a complete homepage.

The companion's 43-page inventory is the target for later expansion, not the current implementation contract. Reserve the routes without publishing placeholders. Initial navigation uses home anchors and real upstream guides. A source-repository link must be recognizable as such.

## 7. Local development and build

Use Node 22 and a pinned Quarto release, initially **Quarto 1.10.18**. The website has its own lockfile. Keep document code execution disabled. No R, notebooks, TeX installation, or Flux app startup is required to render homepage prose.

Provide standard site commands in `package.json` for development, production build, preview, source/output checks, and browser tests. The README is authoritative for command names. A local preview binds to loopback, normally port **1430**, and reports port conflicts rather than silently taking over another server. Flux's capture/dev server remains on 1420; Lighttable stays separate on 1440.

Build sequence:

1. Validate the public page inventory, required assets, product pin, and media provenance.
2. Clean the previous output; render only approved Quarto sources into `dist/`.
3. Assemble only reviewed static resources, demo HTML, metadata and utility files.
4. Audit links, anchor targets, missing media, accidental source publication, and output size.
5. Serve that artifact for browser/interaction checks. Publish those exact bytes.

Future direct `.flux-slide` preprocessing for guide pages should operate in an allowlisted disposable staging tree. Preserve relative includes; deduplicate payloads within each page; never temporarily rewrite an author's tracked guide source. The existing Flux Node repository may accept source updates or materialize posters, so its project root must also be disposable.

## 8. GitHub Pages and deployment

The intended repository name **`fluxsci.github.io`** publishes the organization's root site at **https://fluxsci.github.io/**. It occupies the organization's one root Pages site; Flux is its primary public identity for now. Future organization navigation can be added within this same site. A dedicated `flux-docs` repository would default to `/flux-docs/`, so it is not the chosen name. [GitHub Pages site types](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Use GitHub Actions as the Pages source. The workflow installs pinned tooling, builds, checks, and uploads the verified `dist/` artifact. Only the deployment job receives `pages: write` and `id-token: write`; it depends on successful checks and targets the `github-pages` environment. Pull requests build/test but do not deploy. Use deployment concurrency to prevent overlapping production runs. This requires neither a `gh-pages` branch nor a local publish command. [Custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

The owner can create the empty GitHub repository, then the local repo can be connected and pushed and Pages configured for Actions. Until that exists, “ready” means a verified local build, working preview, and complete deployment configuration; it does not mean a public URL is live. No alternate hosting account or domain purchase is necessary.

Use canonical root URLs, a useful 404, sitemap/robots metadata, and a social preview derived from the actual Flux brand/product. A future custom domain requires changing the canonical URL and rechecking links after DNS/HTTPS setup. Roll back by reverting the website commit and rebuilding, or redeploying a retained verified artifact. Failed builds leave the prior public deployment intact.

Cloudflare Pages remains an alternative if hosted pull-request previews later become important. The initial workflow uses local preview and CI artifacts rather than introducing a second hosting account. GitHub Pages is static: no database, visitor login, app bridge access, or API backend is needed.

## 9. Verification and acceptance

Website tests live in this repository and run independently of Flux's `scripts/verify-manifest.json`. Do not register website checks in the application's pure tier or add website dependencies to its package. The existing app documentation gate remains valid until the later guide migration deliberately updates its scope.

Verify:

- Clean reproducible build from the site checkout and its pinned tooling, without a neighboring Flux checkout.
- Explicit publication inventory: no plans, engineering guides, tests, dependencies, or personal state in output. The audited example ZIP is the deliberate exception for editable source files.
- Every internal link, anchor, image, font, script, demo and utility route; real destinations for installation and user documentation.
- Desktop, tablet, narrow-phone and enlarged-text layouts; no page-wide overflow; light and dark appearance.
- Keyboard navigation, menu/focus behavior, image enlargement, accessible names, reduced motion, meaningful no-JavaScript output, and an axe accessibility pass.
- Actual native slide rendering and painted state changes, Back/Next/Reset, offline/self-contained assets, input containment, and hidden-page lifecycle.
- Chromium, Firefox and WebKit where tooling is available. Record any unexecuted platform tests; a WebKit run is not proof of every native Safari behavior.
- Readable real screenshots, appropriate scientific/data provenance, and truthful copy against the pinned product revision.

Use focused behavior checks rather than tests that duplicate CSS implementation. Inspect screenshots of the real rendered site as part of acceptance. Preserve reports/screenshots in ignored test output and retain useful CI artifacts.

Initial budgets are targets to measure against the first complete build:

| Measure | Target |
| --- | --- |
| Direct control feedback | ≤100 ms class; no artificial delay |
| Compressed initial shell, excluding deferred media | Approximately ≤300 KB |
| First-view transfer including hero/critical fonts | Aim ≤1 MB; record measured tradeoffs |
| Layout shift | CLS ≤0.1 |
| Mobile LCP on an agreed test profile | Aim ≤2.5 s; distinguish local observation from production measurement |
| Actively playing examples | One; none running invisibly |
| Published first artifact | Well below 150 MB |

These are acceptance targets, not unmeasured product claims. Changing a budget requires an explicit, measured tradeoff. Record complete HTML/demo payload sizes; deferring player mounting alone does not defer inline data bytes.

## 10. Phased delivery

**Now:** independent repository, revised plans, complete polished homepage with all five modules and system-level coverage, real screenshots, real native slide example, working local workflow, tests, metadata, 404, and Pages automation. Fine-tune that first version with the owner before expanding the site.

**Next:** use an “Insert a slide in a document” guide as the first documentation layout reference; migrate the 20 existing guides into the companion's 30-page guide, preserving important old links; add module showcase pages and worked examples progressively.

**Later:** optional recordings, broader examples, generated searchable CLI/shortcut views, guide search, release-specific documentation snapshots, and app Docs-button integration after the online guide exists. The app should eventually open `/guide/`, with a contributor preview override. Do not promise a bundled offline guide until packaging/update policies are implemented.

The original 8–14-day estimate covered an earlier, smaller full-site proposal and is superseded by this phased scope. Re-estimate later phases from the implemented homepage, measured capture effort, and accepted guide reference page.
