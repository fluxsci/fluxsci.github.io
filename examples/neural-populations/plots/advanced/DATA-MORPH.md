# Plots prepared for Data morph

Two plot families have matched states for Flux's native **Data morph…** control.
Their points and curves move continuously; the transitions do not substitute
faded images. These additional plots have not been placed in the project's
existing figures or decks.

| Family | Suggested sequence | What moves |
| --- | --- | --- |
| Population response geometry | [1 Hz](14-response-geometry-01hz.svg) → [4 Hz](14-response-geometry-04hz.svg) → [15 Hz](14-response-geometry-15hz.svg) | The same 143 cells move in a shared two-dimensional PCA basis. Cell order, colors, axes and the reference contours remain fixed. |
| Single-neuron tuning landscape | [1 Hz](16-tuning-landscape-1hz.svg) → [2 Hz](16-tuning-landscape-2hz.svg) → [4 Hz](16-tuning-landscape-4hz.svg) | Six cells retain their rows and colors while their measured direction responses and smooth visual guides change. Each state contains 48 measured markers and 966 guide vertices. |

The states use public Allen measurements from experiment **501940850**. The
intermediate animation frames are presentation interpolation, not additional
observations. Source identifiers, normalization and interpolation details are
recorded in the population `.analysis.json`/`.notes.json` sidecars and
`tuning-inventory.json` beside these plots.

## Use them in Flux

1. Open this project and switch to **Slide**.
2. Open the **Plot gallery** with **Alt+I** and insert the first SVG in a sequence.
3. Select the plot and choose **Data morph…** in the Animation inspector. Select
   the next SVG from the project's plot browser. It becomes the animation target
   without placing a second plot on the slide.
4. Use a duration around **1.2–1.8 seconds**. Add another step targeting the third
   state, then use **Play** or drag the timeline to inspect the transition.

Keep each SVG with its matching `.fluxplot.json` and `.recipe.json` files. Insert
the semantic SVG for animation; the PNG and PDF previews are static derivatives.

## Preserve compatibility when editing

- Keep the same cells, cell order, series names and axes creation order across
  every state. Marker identity is positional within a named series.
- Keep the same count of vertices and the same missing-value positions. Retain
  fixed axis limits, ticks, artist counts and marker shapes for these sequences.
- Use ordinary Cartesian `fluxplot.line` and `fluxplot.scatter` series with
  vector output. Tagged heatmaps, surfaces, bands, bars, polar plots and other
  unsupported series are complete-image transitions rather than Data morph.
- Run `stabilize_morph_references()` after `fluxplot.save()` for morph states, as
  the included generators already do. It keeps internal marker and clip-path
  references identical across output filenames, then updates the SVG checksum.
  Changing only `svg.hashsalt` in Matplotlib is insufficient because Fluxplot's
  exporter supplies its own filename-based salt.
- Regenerate through the included scripts rather than editing an SVG or sidecar
  by hand. The shared identity helper changes references only, never measurements
  or geometry.

## Native verification

From this project folder, with Node 22 and a Flux source checkout whose development
dependencies are installed:

```sh
node scripts/verify-advanced-morph.mjs --flux-root /path/to/flux
```

The portable sequence list is
[`scripts/advanced-morph-pairs.json`](../../scripts/advanced-morph-pairs.json).
To choose a browser executable or evidence directory, add:

```sh
node scripts/verify-advanced-morph.mjs \
  --flux-root /path/to/flux \
  --browser /path/to/chromium \
  --out /path/to/verification-output
```

The default output is the website repository's `.cache/neural-advanced/morph/`.
It contains `report.json`, twelve endpoint/midpoint PNGs, and `index.html` with a
plot selector and **Play native morph** button. Open that HTML file locally to
inspect the real Flux player. It is a verification artifact; no saved project
deck or website file is changed.

Acceptance checks the SVG checksums and semantic contracts, live marker size and
reference resolution, numerical data-space coordinates at five times per
transition, opaque intermediate frames, stable DOM nodes, chained/reverse seeks,
fresh-mount equivalence and real playback to the final state. The initial
acceptance passed **98 checks** using Flux commit
`c33280544c6398a2f4af84cfbcbbfd46f7667963` and Chrome 147.0.7727.137. This is the
current app used to verify the new plots; it does not change the website's pinned
native exporter revision, `4bb72d895b7879acc404ca83863cdc385982b0b5`.
