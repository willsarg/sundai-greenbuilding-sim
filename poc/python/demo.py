"""Push a moving rainbow to an instance at 30 fps.  usage: python demo.py <name> [base_url]"""
import sys, time, colorsys
from gbsim import WebDisplay, Color

name = sys.argv[1]
base = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8787/api"
d = WebDisplay(name, base)
f = d.makeframe()
t = 0
while True:
    for r in range(f.nrows()):
        for c in range(f.ncols()):
            h = ((r + c) / 26 + t / 60) % 1.0
            rr, gg, bb = colorsys.hsv_to_rgb(h, 1, 1)
            f[r][c] = Color(rr * 255, gg * 255, bb * 255)
    d.send(f)
    t += 1
    time.sleep(1 / 30)
