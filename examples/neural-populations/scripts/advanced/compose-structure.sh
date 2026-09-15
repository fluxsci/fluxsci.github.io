#!/usr/bin/env bash
# Rebuild Figure 2 (fig-neural-structure) from the advanced plot families through
# the Flux CLI: the Data Morph trio (14), the reconstructed neuron (20), the
# tuning landscape (16), the joint tuning surface (18), the trial raincloud (17)
# and frequency-wise selectivity (33) on a 1440 × 710 px frame.
#
#   cd /path/to/neural-populations
#   FLUX_CLI="flux" scripts/advanced/compose-structure.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
export FLUX_PROJECT="$PWD" FLUX_CLIENT="${FLUX_CLIENT:-agent}"
FLUX_CLI="${FLUX_CLI:-flux}"
FIG=fig-neural-structure

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
$FLUX_CLI set-figure-layout "$FIG" --x 1500 --y 0 --width 1440 --height 710 --background '#ffffff'

# panel  plot                                       x        y        letter
panels=(
  "advanced/14-response-geometry-01hz    15.4    15.4   a"
  "advanced/14-response-geometry-04hz    299.5   15.4   -"
  "advanced/14-response-geometry-15hz    583.7   15.4   -"
  "advanced/20-dendritic-arbor           883.2   15.4   b"
  "flagship/29-direction-key             1267.2  28.8   -"
  "advanced/16-tuning-landscape-2hz      15.4    370.6  c"
  "advanced/18-joint-tuning-surface      364.8   370.6  d"
  "advanced/17-trial-response-raincloud  720.0   370.6  e"
  "flagship/33-frequency-selectivity    1075.2  370.6  f"
)
for entry in "${panels[@]}"; do
  read -r plot x y letter <<<"$entry"
  $FLUX_CLI add-panel "$FIG" "plots/$plot.svg" --x "$x" --y "$y"
  if [ "$letter" != "-" ]; then
    $FLUX_CLI add-fig-text "$FIG" "$letter" --panel-label --x "$(python3 -c "print($x-3)")" --y "$(python3 -c "print($y-5)")" \
      --size-pt 10 --weight 700 --font Arial --color '#161514' --sizing auto
  fi
done

$FLUX_CLI set-caption "$FIG" "Response structure across temporal frequency and within single cells. Original views of the same public recordings and an independent anatomical specimen. **a**, All 143 cells in one PCA basis of their direction profiles at 1, 4 and 15 Hz; colours, ordering and axes are fixed across the three states, which form a Data Morph sequence in Flux. **b**, A reconstructed VISp neuron coloured by path distance from the soma. **c**, Direction tuning of six identified cells at 2 Hz (points, measured means; curves, shape-preserving guides). **d**, Joint direction and temporal-frequency tuning of one cell; black points are the 40 measured conditions. **e**, Trial-by-trial responses of one cell by drift direction, with means and bootstrap 95% intervals. **f**, Circular orientation selectivity at each temporal frequency for all cells (lines, medians)."
echo "Composed $FIG"
