#!/usr/bin/env python3
"""Make a review contact sheet; does not create or edit a Flux composition."""
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.image as mpimg
import fluxplot

PLOTS = [
    ('13-population-trajectories', '13  Population trajectories'),
    ('14-response-geometry-04hz', '14  Response geometry · morph set'),
    ('15-population-response-atlas', '15  Population response atlas'),
    ('16-tuning-landscape-2hz', '16  Tuning landscape · morph set'),
    ('17-trial-response-raincloud', '17  Trial response distributions'),
    ('18-joint-tuning-surface', '18  Joint tuning surface'),
    ('19-response-architecture', '19  Response-similarity network'),
    ('20-dendritic-arbor', '20  Reconstructed neuron'),
]


def main():
    fluxplot.style.use_light()
    output = Path(__file__).resolve().parents[2] / 'exports' / 'advanced-previews'
    # This disposable review sheet is not an editable source plot or a composition.
    fig = plt.figure(figsize=(14.4, 8.0), layout='none', facecolor='white')
    for index, (stem, label) in enumerate(PLOTS):
        row, col = divmod(index, 4)
        x, y = .015 + col * .25, .525 - row * .49
        ax = fig.add_axes([x, y, .22, .415])
        ax.imshow(mpimg.imread(output / f'{stem}.png'))
        ax.set_axis_off()
        fig.text(x + .005, y + .427, label, fontsize=9, color='#343331')
    with plt.rc_context({'figure.constrained_layout.use': False}):
        fig.savefig(output / 'overview.png', dpi=180)
        fig.savefig(output / 'overview.pdf')
    plt.close(fig)
    print(output / 'overview.png')


if __name__ == '__main__':
    main()
