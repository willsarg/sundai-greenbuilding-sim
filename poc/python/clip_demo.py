"""Upload a ~6 s looping animation (a bouncing bar) and exit; the display keeps playing it.
usage: python clip_demo.py <name> [base_url]        (base_url defaults to the hosted simulator)
"""
import sys, colorsys
from gbsim import Frame, Color, upload_clip

name = sys.argv[1]
base = sys.argv[2:3]
FPS, PERIOD, BOUNCES = 30, 32, 6                  # 32-frame bounce; clip = whole bounces so the loop is seamless
N = PERIOD * BOUNCES
frames = []
for t in range(N):
    f = Frame()
    pos = t % PERIOD
    row = pos if pos < 16 else PERIOD - pos        # bounce 0..16..0
    for c in range(f.ncols()):
        h = (c / f.ncols() + t / N) % 1.0
        r, g, b = colorsys.hsv_to_rgb(h, 1, 1)
        f[row][c] = Color(r * 255, g * 255, b * 255)
    frames.append(f)
ok = upload_clip(name, frames, fps=FPS, *base)
print("uploaded" if ok else "failed", f"{len(frames)} frames @ {FPS} fps to", name)
