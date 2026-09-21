# Homepage UI refresh — 2026-09-20

## Product and media

- Updated the product pin from `4bb72d8` to published Flux main `7d90525e8ad415d9653d72143fb88325b15eaa7b`.
- Captured Paper, Figure, Slides, Library and Reader from an isolated memory copy of the canonical example using a clean checkout and its locked dependencies. Unchanged Library pixels were reverified against this revision.
- Added a native Figure property-menu capture, selecting one named bar in the preferred-direction plot. The homepage offers it through “See part editing” alongside the complete Figure view.
- Selected the network's draw-on track in Slides so its timeline and effect inspector explain the same operation.
- Rebuilt the four-slide native player, scientific plate, Paper crop, and example manuscript PDF. Brand, fonts and unchanged rendered scientific assets were verified by the refreshed provenance.
- Updated both capture and native verification to wait for Paper's image-based figure renderer instead of the old inline SVG DOM.

## Homepage review

Reviewed the full page, including the opening, all five modules, the interactive plot explorer, native slides, project download, connections, FluxConfig, AI collaboration, and closing links.

- Gave the Slides editor the full content width, with its explanatory heading and copy above it; the timeline is substantially easier to read.
- Updated Figure copy to explain X-ray and editing beside the selection; updated Slides copy to include transformations and video export.
- Clarified the example's plot count without confusing plot families and individual source SVGs.
- Kept the original logo and entrance, accepted headline, existing content structure, and integrated feature presentation.
- All 307 authored project files match their pre-refresh hashes. The authored figures, deck, manuscript, plot sources, and public-data attribution were preserved.

## Verification

- `npm test`: publication audit, four server/archive checks, and all 76 browser checks passed.
- Visual review of desktop and mobile in light and dark themes; no horizontal overflow or browser errors. The new editing-detail lightbox opens in all four configurations.
- Actual native playback shows distinct initial, intermediate, and completed heatmap frames, followed by the network-edge reveal; no runtime issues.
- Built pinned Flux and opened a disposable on-disk copy of the example through Electron: all seven native checks passed, with no renderer errors or quarantined files.
- All 13 distinct upstream GitHub links returned HTTP 200; the 12 documentation targets exist in the pinned source.
- Unrelated untracked plans and rejected logo mockups were left untouched. Internal source checkouts and review artifacts remain outside the publication allowlist.
