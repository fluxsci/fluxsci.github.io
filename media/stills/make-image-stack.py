"""Build the illustrative fluorescence movie for the Flux image guide and tour."""
import argparse

import fluxplot as fp
import numpy as np
from scipy.ndimage import gaussian_filter


def make_stack(output):
    rng = np.random.default_rng(9472)
    side, depth, frames = 320, 11, 18
    yy, xx = np.mgrid[:side, :side]
    labels = np.zeros((side, side), dtype=np.uint16)
    centers = []
    while len(centers) < 54:
        x, y = rng.uniform(12, side - 12, 2)
        if all(np.hypot(x - px, y - py) > 25 for px, py, _ in centers):
            centers.append((x, y, rng.uniform(2, depth - 3)))

    fields = np.zeros((len(centers), 2, side, side), dtype=np.float32)
    for index, (x, y, _) in enumerate(centers):
        theta = rng.uniform(0, np.pi)
        dx, dy = xx - x, yy - y
        major = dx * np.cos(theta) + dy * np.sin(theta)
        minor = dy * np.cos(theta) - dx * np.sin(theta)
        length = rng.uniform(7, 13)
        radius = np.hypot(major / length, minor / rng.uniform(3.6, 7))
        polar = np.arctan2(minor, major)
        radius *= 1 + .13 * np.cos(3 * polar + theta) + .08 * np.sin(5 * polar)
        labels[radius < .86] = index + 1
        fields[index, 0] = np.exp(-((radius - .94) / .20) ** 2) * rng.uniform(900, 1650)
        fields[index, 1] = np.exp(-radius ** 2 * 2) * rng.uniform(700, 1850)

        # Tapered, branching filaments are blurred by the same optical kernel as the somata.
        filaments = np.zeros_like(xx, dtype=np.float32)
        for branch in range(3):
            angle = theta + branch * 2 * np.pi / 3 + rng.normal(0, .3)
            r = np.linspace(6, rng.uniform(17, 37), 96)
            bend = angle + rng.uniform(-.60, .60) * np.sin(r / 12)
            cx = np.rint(x + r * np.cos(bend)).astype(int)
            cy = np.rint(y + r * np.sin(bend)).astype(int)
            valid = (cx >= 0) & (cx < side) & (cy >= 0) & (cy < side)
            np.maximum.at(filaments, (cy[valid], cx[valid]), (1150 * np.exp(-r / 23))[valid])
        fields[index, 0] += gaussian_filter(filaments, .85) * 2.1

    weights = np.exp(-((np.arange(depth)[:, None] - np.array(centers)[None, :, 2]) / 2.7) ** 2)
    times = np.arange(frames)[:, None]
    offsets = rng.uniform(1, frames, len(centers))
    response = .65 + 1.1 * np.exp(-((times - offsets) / 2.2) ** 2)
    planes = fields.reshape(len(centers), 2, -1)
    stack = np.empty((frames, 2, depth, side, side), dtype=np.uint16)
    structure = (weights @ planes[:, 0]).reshape(depth, side, side)
    haze = gaussian_filter(rng.random((side, side)), 4) * 90
    for t in range(frames):
        signal = ((weights * response[t]) @ planes[:, 1]).reshape(depth, side, side)
        pixels = np.stack([structure, signal]) + haze + rng.normal(0, 19, (2, depth, side, side))
        stack[t] = pixels.clip(0).astype(np.uint16)

    image = fp.fluximg(
        stack, dims=("t", "c", "z", "y", "x"), dt=.5, pixel_size=.37,
        coords={"z": np.arange(depth) * .8},
        channels=[
            {"name": "Membrane", "color": "#43e4cd", "range": [62, 1250]},
            {"name": "Signal", "color": "#f265c2", "range": [63, 1750]},
        ],
        default_index={"z": 5, "t": 6}, name="Cells in motion",
        meta={"description": "Illustrative fluorescence stack, generated from artificial cells."},
    )
    image.add_labels("cells", labels, name="Cell outlines", color="#f1c774", visible=False)
    image.save(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", help="Path to the output .fluximg bundle")
    args = parser.parse_args()
    make_stack(args.output)
