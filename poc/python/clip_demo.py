"""Upload a 6 s looping animation (a bouncing bar) and exit; the display keeps playing it.
usage: python clip_demo.py <name> [base_url]        (base_url defaults to the hosted simulator)
"""
import sys, colorsys
from gbsim import WebDisplay, Color

name = sys.argv[1]
d = WebDisplay(name, *sys.argv[2:3])
FPS, SECS = 30, 6
frames = []
for t in range(FPS * SECS):
    f = d.makeframe()
    pos = t % 32
    row = pos if pos < 16 else 32 - pos            # bounce 0..16..0
    for c in range(f.ncols()):
        h = (c / f.ncols() + t / (FPS * SECS)) % 1.0
        r, g, b = colorsys.hsv_to_rgb(h, 1, 1)
        f[row][c] = Color(r * 255, g * 255, b * 255)
    frames.append(f)
ok = d.upload_clip(frames, fps=FPS)
print("uploaded" if ok else "failed", f"{len(frames)} frames @ {FPS} fps to", name)
