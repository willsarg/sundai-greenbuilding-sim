"""Bake the static demo clips served at /demo/<slug>.

Writes poc/site/public/demos/<slug>.bin (the simulator's binary clip format) and demos.json.
Add a demo: write a function returning (frames, fps), add it to DEMOS, rerun. Keep each clip a
whole number of its animation's cycles so the loop is seamless.
usage: python3 make_demos.py [out_dir]
"""
import colorsys, json, os, sys
from gbsim import Frame, Color, encode_clip

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "site", "public", "demos")


def hsv(h, s=1, v=1):
    r, g, b = colorsys.hsv_to_rgb(h % 1.0, s, v)
    return Color(r * 255, g * 255, b * 255)


def rainbow():
    """Diagonal rainbow scrolling down the building (same drawing as demo.py). 60-frame cycle."""
    frames = []
    for t in range(60):
        f = Frame()
        for r in range(f.nrows()):
            for c in range(f.ncols()):
                f[r][c] = hsv((r + c) / 26 + t / 60)
        frames.append(f)
    return frames, 30


def bouncing_bar():
    """A rainbow bar bouncing top to bottom (same drawing as clip_demo.py). 6 bounces of 32 frames."""
    period, bounces = 32, 6
    n = period * bounces
    frames = []
    for t in range(n):
        f = Frame()
        pos = t % period
        row = pos if pos < 16 else period - pos
        for c in range(f.ncols()):
            f[row][c] = hsv(c / f.ncols() + t / n)
        frames.append(f)
    return frames, 30


# --- Sundai brand demos. Palette from sundai_brandbook (logo gradient stops); sprites are hand-pixelled
# from the logo: a sundae cup ringed by small pixel critters.
BRAND = [(0x2C, 0xA8, 0xDE), (0xED, 0x75, 0xAF), (0xFF, 0xE6, 0x00)]   # blue -> pink -> yellow


def brand(t):
    """Brand gradient colour at t in [0,1]."""
    t = min(max(t, 0.0), 1.0) * (len(BRAND) - 1)
    i = min(int(t), len(BRAND) - 2)
    a, b = BRAND[i], BRAND[i + 1]
    k = t - i
    return Color(*(a[j] + (b[j] - a[j]) * k for j in range(3)))


def sprite(rows):
    """'#' cells of a text sprite -> list of (row, col)."""
    return [(r, c) for r, line in enumerate(rows) for c, ch in enumerate(line) if ch == "#"]


SUNDAE = sprite([
    "#########",
    "#########",
    ".#######.",
    ".#######.",
    "..#####..",
    "..#####..",
    "...###...",
    "....#....",
    "....#....",
    "...###...",
    "..#####..",
])
SUNDAE_TOP = 3                     # rows 3..13 of 17, cup centred on the tower

CRITTERS = [
    sprite(["####", "#..#", "####"]),
    sprite(["####", "####", "#..#"]),
    sprite([".##.", "####", "#..#"]),
    sprite(["#.#", "###", "#.#"]),
]


def sundae():
    """The Sundai sundae with the brand gradient flowing up through it. 90-frame cycle."""
    n = 90
    frames = []
    for t in range(n):
        f = Frame()
        for r, c in SUNDAE:
            # gradient runs top-to-bottom over the cup and cycles; wrap keeps the loop seamless
            u = ((r + SUNDAE_TOP) / 17 + t / n) % 1.0
            u = 1 - abs(2 * u - 1)        # triangle wave so blue and yellow never hard-cut
            f[r + SUNDAE_TOP][c] = brand(u)
        frames.append(f)
    return frames, 30


def critters():
    """The logo's pixel critters drift up the tower in a loose ring, each in its brand colour. 4 fps."""
    period = 34                        # rows travelled before the pattern repeats (2 x 17)
    lanes = [(0, 0, 0.0), (5, 8, 0.33), (3, 17, 0.66), (6, 25, 1.0)]   # (col, start offset, gradient t)
    frames = []
    for t in range(period):
        f = Frame()
        for (col, off, u), sp in zip(lanes, CRITTERS):
            top = (period - 1 - (t + off) % period) - 3       # rises; parks off-screen half the time
            for r, c in sp:
                rr = top + r
                if 0 <= rr < 17 and 0 <= col + c < 9:
                    f[rr][col + c] = brand(u)
        frames.append(f)
    return frames, 4


def reveal():
    """Sundae builds up one window at a time in gradient colour, holds, dims out. 12 fps."""
    order = sorted(SUNDAE, key=lambda rc: (rc[0] * 7 + rc[1] * 13) % 17)   # scattered but deterministic
    build, hold, fade = len(order), 24, 18
    frames = []
    for t in range(build + hold + fade):
        f = Frame()
        lit = order[: min(t + 1, build)]
        dim = 1.0 if t < build + hold else 1.0 - (t - build - hold + 1) / fade
        for r, c in lit:
            col = brand((r + SUNDAE_TOP) / 17)
            f[r + SUNDAE_TOP][c] = Color(col.r * dim, col.g * dim, col.b * dim)
        frames.append(f)
    return frames, 12


DEMOS = [
    ("sundai-sundae", "Sundai sundae", "The Sundai logo's sundae with the brand gradient flowing through it.", sundae),
    ("sundai-critters", "Sundai critters", "The logo's pixel critters drifting up the tower.", critters),
    ("sundai-reveal", "Sundai reveal", "The sundae builds window by window, holds, and fades.", reveal),
    ("rainbow", "Scrolling rainbow", "Every window lit, hue drifting down the tower at 30 fps.", rainbow),
    ("bouncing-bar", "Bouncing bar", "One row of colour bouncing between the top and bottom floors.", bouncing_bar),
]


# Extra demos designed by other models (see the module docstrings); they import from this module,
# so pull them in only after DEMOS exists.
def _extra():
    import demos_haiku, demos_sonnet, demos_opus
    return demos_haiku.DEMOS + demos_sonnet.DEMOS + demos_opus.DEMOS


def all_demos():
    seen, out = set(), []
    for d in DEMOS + _extra():
        assert d[0] not in seen, f"duplicate slug {d[0]}"
        seen.add(d[0]); out.append(d)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for slug, title, desc, fn in all_demos():
        frames, fps = fn()
        data = encode_clip(frames, fps)
        with open(os.path.join(OUT, f"{slug}.bin"), "wb") as fh:
            fh.write(data)
        manifest.append({"slug": slug, "title": title, "description": desc, "fps": fps, "frames": len(frames)})
        print(f"{slug}: {len(frames)} frames @ {fps} fps, {len(data)} bytes")
    with open(os.path.join(OUT, "demos.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")


if __name__ == "__main__":
    main()
