#!/usr/bin/env python3
"""Developer aid: where a take's long frame gaps fall. python3 media/pitch/gaps.py <take dir> [ms=60]
Reads the page-clock square from capture.mkv and lists gaps over the threshold as (seconds from start, ms)."""
import json, subprocess, sys
d = sys.argv[1]; limit = int(sys.argv[2]) if len(sys.argv) > 2 else 60
t = json.load(open(d + '/take.json')); S = t['window']['scale']; c = t['clock']
x, y = (c['x'] + c['size'] // 2) * S, (c['y'] + c['size'] // 2) * S
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', d + '/capture.mkv', '-vf', f'crop=1:1:{x}:{y}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
clk = [raw[i] << 16 | raw[i + 1] << 8 | raw[i + 2] for i in range(0, len(raw), 3)]
s = t['marks']['start']
print({k: round((v - s) / 1000, 2) for k, v in t['marks'].items()})
print([(round((a - s) / 1000, 2), b - a) for a, b in zip(clk, clk[1:]) if b - a > limit and a >= s])
