# Flux public website

This is the independent Quarto website for Flux, intended for the GitHub repository
`fluxsci/fluxsci.github.io` and `https://fluxsci.github.io/`.

- Current scope is a polished homepage plus the infrastructure to build, test, preview and
  publish it. Do not create empty guide pages. Link to current upstream documentation until
  guide migration is implemented.
- `site/` is the public Quarto source; `plans/` is internal; `dist/` is generated output.
- The canonical editable demo lives in `examples/neural-populations/` in this repository.
  Never overwrite user edits with a scaffold. Builds package it into an audited download ZIP;
  refreshes read its actual authored figure/deck/doc files. Preserve public data attribution
  and source terms. The original narrative is illustrative; never copy paper prose or figures.
- Use real Flux screenshots and its native inline slide runtime. Never fabricate app UI or
  reproduce its animation engine. Never use personal research or the user's FluxConfig.
- Product dependency is pinned in `flux-source.json`. Ordinary site builds use reviewed,
  checked-in assets; refreshing product assets uses the pinned Flux checkout and records
  provenance. Do not silently read an arbitrary sibling app checkout during normal builds.
- Match Flux: warm paper, near-black ink, Georgia/Gelasio, quiet blue controls, the current
  phyllotaxis mark, generous whitespace, scientific content with labeled illustrative data.
- Main source is `site/index.qmd`. Theme CSS: `site/assets/styles/site.css`; browser behavior:
  `site/assets/scripts/site.js`. Use accessible native controls and respect reduced motion.
- Run the site build and meaningful browser/asset checks before delivery. Inspect desktop,
  mobile, light/dark appearance and actual slide playback. Do not publish plans, test outputs,
  node_modules, caches or source checkout material.
- Stage explicit paths. Other agents may be working in separate files. Do not discard their
  work, stage everything, or commit unrelated changes.
