#!/usr/bin/env bash
# Rebuild Figure 1 (fig-neural-populations) from the flagship panels through the
# Flux CLI, so the composition is written by Flux's own persistence core.
#
#   cd /path/to/neural-populations
#   FLUX_CLI="flux" scripts/advanced/compose-flagship.sh
#
# Layout is a dense three-row journal plate on a 1440 × 920 px frame (15 × 9.6 in
# at 96 px/in). Every panel lands at its natural physical size; positions are the
# only authored numbers. Re-run after regenerating plots/flagship/*.svg, or use
# `flux sync-figure fig-neural-populations` to refresh panels in place.
set -euo pipefail
cd "$(dirname "$0")/../.."
export FLUX_PROJECT="$PWD" FLUX_CLIENT="${FLUX_CLIENT:-agent}"
FLUX_CLI="${FLUX_CLI:-flux}"
FIG=fig-neural-populations

echo "Clearing the previous composition of $FIG"
OLD=$(python3 -c "
import json
c=json.load(open('fig/canvases/canvas-1.json'))
for f in c['figures']:
    if f['id']=='$FIG':
        print(' '.join(e['id'] for e in f['elements']))
")
# shellcheck disable=SC2086  # element ids never contain spaces
if [ -n "$OLD" ]; then $FLUX_CLI delete-element $OLD; fi
$FLUX_CLI set-figure-layout "$FIG" --x 0 --y 0 --width 1440 --height 920 --background '#ffffff'

# panel  plot                                  x        y        letter
panels=(
  "21-brain-anatomy            15.4    15.4   a"
  "22-neuron-reconstructions   470.4   15.4   b"
  "23-population-atlas         844.8   15.4   c"
  "24-example-cells            15.4    358.1  d"
  "25-population-trajectories  604.8   358.1  e"
  "26-similarity-matrix        894.7   358.1  f"
  "27-similarity-network       1165.4  358.1  g"
  "28-response-geometry        15.4    667.2  h"
  "30-selectivity              347.5   667.2  i"
  "31-frequency-tuning         679.7   667.2  j"
  "32-preferred-directions     1011.8  667.2  k"
  "29-direction-key            1307.5  676.8  -"
)
for entry in "${panels[@]}"; do
  read -r plot x y letter <<<"$entry"
  $FLUX_CLI add-panel "$FIG" "plots/flagship/$plot.svg" --x "$x" --y "$y"
  if [ "$letter" != "-" ]; then
    $FLUX_CLI add-fig-text "$FIG" "$letter" --panel-label --x "$(python3 -c "print($x-3)")" --y "$(python3 -c "print($y-5)")" \
      --size-pt 10 --weight 700 --font Arial --color '#161514' --sizing auto
  fi
done

$FLUX_CLI set-caption "$FIG" "Neuronal populations flexibly encode diverse stimuli. An original demonstration composed from public Allen Institute data; anatomy and recordings come from separate specimens, and the graph links are response similarities, not synapses. **a**, Visual cortical areas on the Allen CCFv3 brain surface in an oblique dorsal view (inset, lateral view); VISl is the recorded area. **b**, Reconstructed neurons from the Allen Cell Types Database at one scale, pia upward. **c**, Trial-averaged, per-cell standardized responses of all 143 cells to eight drift directions at 2 Hz, grouped by preferred direction and ordered by response latency. **d**, Four example cells: trial-averaged ΔF/F for every direction (shaded, 2 s grating; one vertical scale per row) and their polar tuning, with the preferred direction marked. **e**, Population trajectories in one three-dimensional PCA basis; saturated segments are stimulus frames, circles onset and squares offset. **f**, Signal-correlation matrix ordered by preferred direction. **g**, Cells arranged by preferred direction with links for pairs whose signal correlation is at least 0.6. **h**, PCA of the standardized condition means; contours enclose 40, 70 and 90% of the density. **i**, Circular orientation versus direction selectivity with marginal distributions. **j**, Temporal-frequency tuning at each cell's preferred direction (mean ± s.e.m.; bands, 10–90% and interquartile ranges; bars, share of cells preferring each frequency). **k**, Number of cells preferring each direction. Colours throughout follow the drift-direction key."
echo "Composed $FIG"
