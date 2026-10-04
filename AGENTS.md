# Flux public website

This is the independent Quarto website for Flux, intended for the GitHub repository
`fluxsci/fluxsci.github.io` and `https://fluxsci.github.io/`.

- Current scope is the homepage, installation, and documentation migration. The first review
  milestone has two finished guides and a complete topic directory; remaining topics link to
  current upstream guides. Do not publish empty guide pages.
- `site/` is public Quarto source; `plans/` and `media/` are internal; `dist/` is generated.
- Visual source plots come from the owner-authorized external project passed explicitly to
  refresh tools. Preserve plot bytes. Never reuse its test slides, test figure canvases,
  manuscript instructions, personal context, or library. Create original website slides,
  captions and illustrative writing in the isolated temporary capture project.
- Use real Flux screenshots and its native inline slide runtime. Never fabricate app UI or
  reproduce its animation engine. Never read the user's FluxConfig.
- Product dependency is pinned in `flux-source.json`. Ordinary site builds use reviewed,
  checked-in assets; refreshing product assets uses the pinned Flux checkout and records
  provenance. Do not silently read an arbitrary sibling app checkout during normal builds.
- Match Flux: warm paper, near-black ink, Georgia/Gelasio, quiet blue controls, the current
  phyllotaxis mark, generous whitespace, scientific content with labeled illustrative data.
- Homepage source is `site/index.qmd`; guides are `site/docs/`, installation is `site/install/`.
  Routes and navigation live in `scripts/routes.mjs`. Theme CSS: `site/assets/styles/site.css`; browser behavior:
  `site/assets/scripts/site.js`. Use accessible native controls and respect reduced motion.
- Run the site build and meaningful browser/asset checks before delivery. Inspect desktop,
  mobile, light/dark appearance and actual slide playback. Do not publish plans, test outputs,
  node_modules, caches or source checkout material.
- Stage explicit paths. Other agents may be working in separate files. Do not discard their
  work, stage everything, or commit unrelated changes.
