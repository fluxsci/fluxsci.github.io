# Flux public website

This is the independent Quarto website for Flux, intended for the GitHub repository
`fluxsci/fluxsci.github.io` and `https://fluxsci.github.io/`.

- Current scope is the complete public website and documentation, approved after the first
  review milestone. Keep guides clear and concise, link detailed reference, and publish no empty pages.
- `site/` is public Quarto source; `plans/` and `media/` are internal; `dist/` is generated.
- Visual source plots come from the owner-authorized external project passed explicitly to
  refresh tools. Preserve plot bytes and the owner's authored figure layouts. The selected
  materials and neuroscience compositions in MASTER_DEMO_FluxProj are authorized showcase
  material. Never reuse its test slides, manuscript instructions, personal context, or library.
  Create new website slides, captions and writing in the isolated temporary capture project.
  Credit public data sources accurately; distinguish measured, computed and illustrative material.
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
