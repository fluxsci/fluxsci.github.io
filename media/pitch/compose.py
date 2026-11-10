#!/usr/bin/env python3
"""Compose a pitch-article clip from one recorded take.

    python3 media/pitch/compose.py <take dir> --out <clip.mp4> [--small <clip-1280.mp4>] --poster <poster.webp> [--width 1920] [--sheet <png>] [--frames <dir>]
    python3 media/pitch/compose.py <take dir> --encode-only --out … [--small …]     (re-encode the existing master)

Input: <take dir>/capture.mkv (lossless grab of the stage region at device pixels), take.json
(the pointer's glides, clicks, keys, named moments, on-screen boxes) from record.mjs, and
cursors.json (the app's own cursor images) from cursors.mjs.

Each output frame is one moment on the page clock: the grabbed frame the app was showing
then, seen through a camera (a 4:3 crop that eases between framings, resampled with Lanczos so
a move never lands on a half pixel), with the pointer, click rings and key badges drawn on
top from the logged input. The pointer is Flux's own cursor: the image the app was showing at
that moment, and on every click the app's own press frames; its position comes from the same
formula that drove the real mouse, so it is exact at every frame. The last frames dissolve into
the first so the clip loops without a jump.

Resolution: the stage is grabbed at 4 device pixels per CSS pixel, so any framing at least
(output width / 4) CSS pixels wide is resampled DOWN from real pixels; nothing is ever
enlarged. A framing narrower than that is refused.

The composed frames are first written losslessly (<take dir>/master.mkv); the published files
are encoded from that master: the full-size clip, and optionally a 1280-wide one for phones
(a third of the bytes, still at least the pixels of a phone screen).
"""
import argparse, json, math, os, subprocess
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
FPS = 60
ASPECT = 4 / 3


def minimum_jerk(s):
    s = min(1.0, max(0.0, s))
    return s * s * s * (10 + s * (-15 + 6 * s))


def reach(s):
    """The pointer's timing along a glide; must match `ease` in record.mjs."""
    s = min(1.0, max(0.0, s))
    return minimum_jerk(1 - (1 - s) ** 1.6)


# ---- framings ------------------------------------------------------------------------------
def frame(x0, x1, *, cy=None, top=None, bottom=None, within=None):
    """A 4:3 camera frame spanning x0..x1, placed vertically by its centre, top or bottom, then
    slid to stay inside `within`. Returned as (centre x, centre y, width)."""
    w = x1 - x0
    h = w / ASPECT
    y = cy - h / 2 if cy is not None else top if top is not None else bottom - h
    if within:
        x0 = min(max(x0, within["x"]), within["x"] + within["w"] - w)
        y = min(max(y, within["y"]), within["y"] + within["h"] - h)
    return (x0 + w / 2, y + h / 2, w)


def camera_colormap(take):
    """The whole figure; in to the panel and the place its menu opens; closer on the row being
    used; out for the whole colour-scale editor; in on the palettes beside the plot; tight on
    the result; back out to the figure."""
    b, m = take["boxes"], take["marks"]
    plot, est = b["plot"], b["establish"]
    right, mid = plot["x"] + plot["w"] + 22, plot["y"] + plot["h"] / 2
    floor = take["window"]["height"] - 2
    whole = frame(est["x"], est["x"] + est["w"], top=est["y"])
    menu = frame(b["menu"]["x"] - 18, right, bottom=floor, within=est)
    edit = frame(b["edit"]["x"] - 8, right, cy=mid, within=est)
    editor = frame(b["editor"]["x"] - 18, right, bottom=floor, within=est)
    # from the collection tabs down to the foot of the plot
    tabs_top, tabs_height = b["tab"]["y"] - 24, plot["y"] + plot["h"] + 20 - (b["tab"]["y"] - 24)
    tabs = frame(right - max(tabs_height * ASPECT, right - (b["palette"]["x"] - 14)), right, top=tabs_top, within=est)
    swatch = frame(b["rows"]["managua"]["x"] - 12, right, cy=mid, within=est)
    panel = frame(plot["x"] + plot["w"] / 2 - 240, plot["x"] + plot["w"] / 2 + 240, top=plot["y"] - 32, within=est)
    return [
        (m["start"], whole),
        (m["start"] + 450, whole), (m["start"] + 1650, menu),
        (m["menu"] + 500, menu), (m["menu"] + 1250, edit),
        (m["editor"] + 20, edit), (m["editor"] + 820, editor),
        (m["editor"] + 950, editor), (m["editor"] + 1700, tabs),
        (m["tab"] + 200, tabs), (m["tab"] + 950, swatch),
        (m["close"] + 60, swatch), (m["close"] + 960, panel),
        (m["reveal"], panel), (m["reveal"] + 1250, whole),
        (m["end"], whole),
    ]


CAMERAS = {"colormap": camera_colormap}


def camera_at(keys, t):
    if t <= keys[0][0]:
        return keys[0][1]
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t <= t1:
            e = minimum_jerk((t - t0) / (t1 - t0)) if t1 > t0 else 1.0
            # centre moves linearly, width geometrically: a zoom that feels even
            return (a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e, a[2] * (b[2] / a[2]) ** e)
    return keys[-1][1]


def pointer_at(take, t):
    """Where the pointer is at page time t: on the arc of the glide in progress, else at rest."""
    x, y = take["rest"]["x"], take["rest"]["y"]
    for g in take["glides"]:
        if t < g["t0"]:
            break
        e = reach((t - g["t0"]) / g["ms"])
        u = 1 - e
        x = u * u * g["from"]["x"] + 2 * u * e * g["mid"]["x"] + e * e * g["to"]["x"]
        y = u * u * g["from"]["y"] + 2 * u * e * g["mid"]["y"] + e * e * g["to"]["y"]
    return x, y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("take")
    ap.add_argument("--out", required=True)
    ap.add_argument("--poster")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--sheet")
    ap.add_argument("--frames", help="directory for a few full-size review frames")
    ap.add_argument("--small", help="also encode a 1280-wide clip to this path")
    ap.add_argument("--crf", default="17")
    ap.add_argument("--small-crf", default="18")
    ap.add_argument("--encode-only", action="store_true")
    args = ap.parse_args()

    master = os.path.join(args.take, "master.mkv")
    if args.encode_only:
        return encode(master, args)
    take = json.load(open(os.path.join(args.take, "take.json")))
    S, region = take["window"]["scale"], take["region"]
    NW = args.width
    NH = int(round(NW / ASPECT / 2)) * 2
    W, H = region["w"] * S, region["h"] * S
    marks = take["marks"]
    keys = CAMERAS[take["take"]](take)
    t_start, t_end = marks["start"], marks["end"]
    total = int(round((t_end - t_start) / 1000 * FPS))
    fade = int(0.45 * FPS)

    clock = take["clock"]
    for (t0, _), (t1, _) in zip(keys, keys[1:]):
        assert t1 >= t0, f"camera keys out of order: {t0 - t_start:.0f} then {t1 - t_start:.0f} ms"
    for _, (cx, cy, w) in keys:
        h = w / ASPECT
        assert w * S >= NW - 0.5, f"a {w:.0f} px framing has only {w * S:.0f} real pixels across; the output needs {NW}"
        assert cx - w / 2 >= region["x"] + clock["x"] + clock["size"] or cy - h / 2 >= region["y"] + clock["y"] + clock["size"], "camera frame shows the clock square"
        assert cx - w / 2 >= region["x"] and cy - h / 2 >= region["y"] and cx + w / 2 <= region["x"] + region["w"] + 0.01 and cy + h / 2 <= region["y"] + region["h"] + 0.01, "camera frame leaves the grabbed region"

    # Flux's cursor images, padded so a sub-pixel shift never samples outside the sprite.
    PAD = 16
    def sprite(entry):
        src = Image.open(os.path.join(args.take, entry["file"])).convert("RGBA")
        padded = Image.new("RGBA", (src.width + 2 * PAD, src.height + 2 * PAD), (0, 0, 0, 0))
        padded.paste(src, (PAD, PAD))
        return {**entry, "padded": padded}
    cursors = json.load(open(os.path.join(args.take, "cursors.json")))
    shown = [sprite(e) if "file" in e else None for e in cursors["images"]]
    arrow = cursors["arrow"]
    press_frames = [sprite(e) for e in cursors["press"]["frames"]]
    press_down, press_up = cursors["press"]["returnMs"] * 0.45, cursors["press"]["returnMs"]
    timeline = take["pointer"]["timeline"]
    def shown_at(t):
        index = timeline[0][1]
        for when, i in timeline:
            if when > t:
                break
            index = i
        return index
    badges = {k: Image.open(os.path.join(HERE, f"overlays/key-{k}.png")).convert("RGBA") for k in ("f", "esc")}
    unit = NW / 1080.0  # overlay sizes are designed on a frame 1080 wide

    decoder = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", os.path.join(args.take, "capture.mkv"), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, bufsize=1 << 24)
    frame_bytes = W * H * 3
    probe = ((clock["y"] + clock["size"] // 2) * S * W + (clock["x"] + clock["size"] // 2) * S) * 3

    def grabbed():
        buf = decoder.stdout.read(frame_bytes)
        if len(buf) < frame_bytes:
            return None
        return (buf[probe] << 16 | buf[probe + 1] << 8 | buf[probe + 2], buf)

    encoder = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{NW}x{NH}", "-r", str(FPS), "-i", "-",
        "-c:v", "libx264rgb", "-preset", "ultrafast", "-qp", "0", "-threads", "32", master], stdin=subprocess.PIPE)

    current, upcoming = grabbed(), grabbed()
    clocks, used = [current[0]], 0
    base_key, base = None, None
    first, sheet, written = None, [], 0
    clock_t = lambda t: int(round(t)) & 0xFFFFFF

    for n in range(total):
        t = t_start + n * 1000.0 / FPS
        while upcoming is not None and upcoming[0] <= clock_t(t):
            current, upcoming = upcoming, grabbed()
            clocks.append(current[0])
        cx, cy, w = camera_at(keys, t)
        h = w / ASPECT
        left, top = cx - w / 2, cy - h / 2
        box = ((left - region["x"]) * S, (top - region["y"]) * S, (left + w - region["x"]) * S, (top + h - region["y"]) * S)
        key = (current[0], tuple(round(v, 3) for v in box))
        if key != base_key:
            base = Image.frombuffer("RGB", (W, H), current[1], "raw", "RGB", 0, 1).resize((NW, NH), Image.LANCZOS, box=box)
            base_key = key
            used += 1
        out = base.copy()
        to_out = lambda x, y: ((x - left) * NW / w, (y - top) * NH / h)

        # click rings, in the pointer's pink
        for c in take["clicks"]:
            age = t - c["down"]
            if 0 <= age < 460:
                u = age / 460
                x, y = to_out(c["x"], c["y"])
                r = (9 + 30 * (1 - (1 - u) ** 3)) * unit
                alpha = int(150 * (1 - u) ** 1.6)
                q, m = 3, int(r + 8 * unit)
                ring = Image.new("L", (2 * m * q, 2 * m * q), 0)
                ImageDraw.Draw(ring).ellipse([(m - r) * q, (m - r) * q, (m + r) * q, (m + r) * q], outline=255, width=max(1, int(3.2 * unit * q)))
                ring = ring.resize((2 * m, 2 * m), Image.LANCZOS).point(lambda v: v * alpha // 255)
                out.paste((255, 96, 252), (int(round(x)) - m, int(round(y)) - m), ring)

        # key badges, lower right over the empty canvas
        pressed = [k for k in take["keys"] if k["down"] <= t]
        for kpress in pressed[-1:]:
            age = t - kpress["down"]
            if age < 900:
                badge = badges[kpress["label"].lower()]
                appear, vanish = minimum_jerk(age / 90), 1 - minimum_jerk((age - 560) / 340)
                held = age < (kpress["up"] - kpress["down"]) + 60
                bw = int(badge.width / 4 * 1.45 * unit)
                bh = int(badge.height / 4 * 1.45 * unit)
                b = badge.resize((bw, bh), Image.LANCZOS)
                alpha = min(appear, vanish)
                if alpha < 1:
                    b.putalpha(b.getchannel("A").point(lambda v: int(v * alpha)))
                out.paste(b, (int(NW * 0.80 - bw / 2), int(NH * 0.905 - bh / 2 + (4 * unit if held else 0) + (1 - appear) * 10 * unit)), b)

        # pointer: the image the app showed, and on a click the app's own press (a fast dip, a
        # held pose, a quiet return: the timing of cursor/cursorPress.ts)
        px, py = pointer_at(take, t)
        x, y = to_out(px, py)
        index, amount = shown_at(t), 0.0
        for c in take["clicks"]:
            if c["down"] <= t < c["up"]:
                u = min(1.0, (t - c["down"]) / press_down)
                amount = 0.18 + 0.82 * (1 - (1 - u) ** 3)
            elif c["up"] <= t < c["up"] + press_up:
                amount = (1 - (t - c["up"]) / press_up) ** 3
        cur = shown[index] if shown[index] else shown[arrow]
        if amount > 0 and (index == arrow or shown[index] is None):
            cur = press_frames[round(amount * (len(press_frames) - 1))]
        # Drawn a little larger than life so it reads on a phone, growing gently with the zoom:
        # 1.3x its true size when 640 px of the app span the frame.
        sc = 1.3 * math.sqrt((NW / w) * (NW / 640.0))
        ks = cur["scale"] / sc
        sx, sy = x - cur["hotspot"][0] * sc, y - cur["hotspot"][1] * sc
        ix, iy = math.floor(sx), math.floor(sy)
        cw, ch = int(cur["width"] * sc) + 3, int(cur["height"] * sc) + 3
        if ix < NW and iy < NH and ix + cw > 0 and iy + ch > 0:
            padded = cur["padded"]
            bx, by = PAD - (sx - ix) * ks, PAD - (sy - iy) * ks
            drawn = padded.resize((cw, ch), Image.LANCZOS, box=(bx, by, min(padded.width, bx + cw * ks), min(padded.height, by + ch * ks)))
            out.paste(drawn, (ix, iy), drawn)

        if first is None:
            first = out.copy()
        if n >= total - fade:
            out = Image.blend(out, first, minimum_jerk((n - (total - fade) + 1) / fade))
        encoder.stdin.write(out.tobytes())
        written += 1
        if args.sheet and n % 30 == 0:
            sheet.append(out.resize((384, 288), Image.LANCZOS))
        if args.frames and n % 75 == 40:
            os.makedirs(args.frames, exist_ok=True)
            out.save(os.path.join(args.frames, f"f{n:04d}.png"))

    encoder.stdin.close()
    encoder.wait()
    decoder.kill()
    if args.poster:
        first.save(args.poster, quality=92, method=6)
    if args.sheet:
        cols = 5
        rows = (len(sheet) + cols - 1) // cols
        page = Image.new("RGB", (cols * 388, rows * 292), "white")
        for i, im in enumerate(sheet):
            page.paste(im, ((i % cols) * 388 + 2, (i // cols) * 292 + 2))
        page.save(args.sheet)
    steps = [b - a for a, b in zip(clocks, clocks[1:])]
    late = sum(1 for s in steps if s > 25)
    narrowest = min(w for _, (_, _, w) in keys)
    print(f"{written} frames ({written / FPS:.2f} s) at {NW}x{NH}; tightest framing {narrowest:.0f} px = {narrowest * S:.0f} real pixels across; {len(clocks)} distinct app frames, {late} gaps over 25 ms (longest {max(steps)} ms)")
    encode(master, args)


def encode(master, args):
    """The published files, from the lossless master: H.264 High, 4:2:0, BT.709, 60 fps. Level 5.1
    for the full-size clip (the 4K30 class), 4.2 for the phone one; a keyframe every 2 s."""
    def h264(out, crf, level, scale=""):
        os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
        subprocess.run([
            "ffmpeg", "-y", "-loglevel", "error", "-i", master,
            "-vf", f"{scale}scale=in_range=full:out_range=tv:out_color_matrix=bt709:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p",
            "-c:v", "libx264", "-preset", "veryslow", "-crf", crf, "-profile:v", "high", "-level:v", level, "-g", str(FPS * 2),
            "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
            "-movflags", "+faststart", "-an", out], check=True)
        print(f"{out}: {os.path.getsize(out) / 1e6:.2f} MB (crf {crf})")
    h264(args.out, args.crf, "5.1")
    if args.small:
        h264(args.small, args.small_crf, "4.2", "scale=1280:-2:flags=lanczos,")


if __name__ == "__main__":
    main()
