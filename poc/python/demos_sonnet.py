"""Designed by Claude Sonnet (2026-09-11). Two new Sundai-branded demos, built to the same conventions as make_demos.py.

Run with:
    PYTHONPATH=poc/python python3 demos_sonnet.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from make_demos import Frame, Color, brand, sprite, SUNDAE, SUNDAE_TOP, CRITTERS


def _dim(col, k):
    return Color(col.r * k, col.g * k, col.b * k)


def melt():
    """The sundae glass sits dim and static while brand-gradient drips melt off its rim and tip,
    running down the tower and fading before they hit the floor. 36-frame cycle."""
    n = 36
    floor = Frame().nrows() - 1  # 16

    # static, dimmed glass silhouette so the bright drips read against it
    glass = {}
    for r, c in SUNDAE:
        u = r / 10.0
        glass[(r + SUNDAE_TOP, c)] = _dim(brand(u), 0.30)

    # (source col, source row, gradient t, phase offset)
    lanes = [
        (1, SUNDAE_TOP + 6, 0.05, 0),    # left end of the rim
        (7, SUNDAE_TOP + 6, 0.20, 12),   # right end of the rim
        (2, SUNDAE_TOP + 9, 0.55, 6),    # left shoulder, narrowing stem
        (6, SUNDAE_TOP + 9, 0.70, 18),   # right shoulder
        (4, SUNDAE_TOP + 12, 0.95, 24),  # tip of the glass
    ]

    frames = []
    for t in range(n):
        f = Frame()
        for (r, c), col in glass.items():
            f[r][c] = col
        for col_, start_row, u, phase in lanes:
            pos = (t + phase) % n           # frames since this drip left the glass
            row = start_row + pos
            if start_row <= row <= floor:
                bright = brand(u)
                f[row][col_] = bright
                if row - 1 >= start_row:
                    f[row - 1][col_] = _dim(bright, 0.45)
                if row - 2 >= start_row:
                    f[row - 2][col_] = _dim(bright, 0.18)
        frames.append(f)
    return frames, 15


def sprinkle_rain():
    """A scatter of brand-coloured sprinkles rains down the whole facade, like toppings falling
    onto the sundae below. Deterministic per-column timing keeps the loop seamless. 34-frame cycle."""
    n = 40
    f0 = Frame()
    rows, cols = f0.nrows(), f0.ncols()

    # 3 staggered sprinkles per column. The per-drop offset mixes in c*k so no single time
    # shift maps every column's pattern onto another column's -- avoids the whole grid visibly
    # "resetting" partway through the cycle, which a uniform offset would produce.
    drops = []
    for c in range(cols):
        for k in range(3):
            phase = (c * 7 + k * 13 + c * k) % n
            u = ((c * 5 + k * 7) % 11) / 10.0
            drops.append((c, phase, u))

    frames = []
    for t in range(n):
        f = Frame()
        for c, phase, u in drops:
            pos = (t - phase) % n            # 0..n-1; only the first `rows` frames are on-screen
            if pos < rows:
                bright = brand(u)
                f[pos][c] = bright
                if pos - 1 >= 0:
                    f[pos - 1][c] = _dim(bright, 0.35)
        frames.append(f)
    return frames, 12


DEMOS = [
    ("sundai-drips", "Sundai melt", "The sundae glass sits dim while bright gradient drips melt off its rim and tip and run down the tower.", melt),
    ("sundai-sprinkle-rain", "Sundai sprinkle rain", "Brand-coloured sprinkles rain down the whole facade like toppings falling onto the sundae.", sprinkle_rain),
]


def _ascii(frame):
    lines = []
    for r in range(frame.nrows()):
        row = frame.row(r)
        lines.append("".join("#" if (c.r, c.g, c.b) != (0, 0, 0) else "." for c in row))
    return "\n".join(lines)


if __name__ == "__main__":
    for slug, title, desc, fn in DEMOS:
        frames, fps = fn()
        print(f"{slug}: {len(frames)} frames @ {fps} fps")
        print(_ascii(frames[len(frames) // 3]))
        print()
