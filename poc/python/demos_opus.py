"""Designed by Claude Opus (2026-09-11). Two extra Sundai demos for the Green Building display (17 rows x 9 cols, row 0 = top).

Conventions match make_demos.py: each function returns (frames, fps) and holds a whole
number of animation cycles so the clip loops seamlessly.
Run:  PYTHONPATH=<poc/python> python3 -c "import opus; ..."
"""
import math

from make_demos import Frame, Color, brand, sprite, SUNDAE, SUNDAE_TOP, CRITTERS

ROWS, COLS = 17, 9


def _put(f, r, c, col, k=1.0):
    """Additive-max paint: keeps the brightest contribution per channel."""
    if not (0 <= r < ROWS and 0 <= c < COLS):
        return
    old = f[r][c]
    f[r][c] = Color(max(old.r, col.r * k), max(old.g, col.g * k), max(old.b, col.b * k))


# Lowest lit sprite row per column -> where a melt drip leaves the cup.
_CUP_BOTTOM = {}
for _r, _c in SUNDAE:
    _CUP_BOTTOM[_c] = max(_r, _CUP_BOTTOM.get(_c, _r))


def melt():
    """The sundae melts: the scoop sinks, drips run down the cup and pool at the base, then it re-freezes.

    Sprite sits at rows 1..11 so rows 12..16 are drip + puddle space. 144-frame cycle at 24 fps.
    """
    n, top = 144, 0
    # Two droplets per column, each doing a whole number of falls per cycle -> seamless.
    streams = []
    for c in range(COLS):
        if c not in _CUP_BOTTOM:
            continue                               # the art leaves the outer columns dark
        start = _CUP_BOTTOM[c] + top + 1           # first row below the cup in this column
        dist = ROWS - start                        # rows of travel down to the floor
        if dist <= 0:
            continue
        cycles = 2 if dist > 8 else 5              # long edge runs are slower than the short centre ones
        for k in range(2):
            streams.append((c, start, dist, cycles, k * 0.5 + 0.07 * c))

    frames = []
    for t in range(n):
        f = Frame()
        # p: 0 = frozen solid, 1 = fully melted. Smooth triangle wave -> seamless, no rewind pop.
        p = 0.5 - 0.5 * math.cos(2 * math.pi * t / n)
        edge = p * 7.6                             # how far the scoop (sprite rows 0..6) has sunk

        # --- the puddle on the plaza floor
        level = p * 3.4
        for rr in range(ROWS - 1, ROWS - 1 - math.ceil(level), -1):
            depth = (ROWS - 1 - rr)
            k = min(1.0, level - depth)
            wob = 0.82 + 0.18 * math.sin(2 * math.pi * 5 * t / n + rr * 1.7)
            for c in range(COLS):
                sway = 1.0 if k > 0.95 else max(0.25, 0.5 + 0.5 * math.sin(2 * math.pi * 7 * t / n + c * 0.9))
                _put(f, rr, c, brand(0.52 + 0.13 * depth + 0.02 * c), k * wob * sway)

        # --- drips falling down the outside of the cup
        for c, start, dist, cycles, ph in streams:
            u = (t / n * cycles + ph) % 1.0
            r = start + u * dist
            alpha = 0.10 + 0.90 * p                # heavy drip at peak melt, a trickle when frozen
            if r < ROWS - level:                   # absorbed once it reaches the puddle
                _put(f, int(r), c, brand(0.45 + 0.25 * u), alpha)
                _put(f, int(r) - 1, c, brand(0.35), alpha * 0.35)   # short tail

        # --- the sundae itself, eroding from the top down
        for r, c in SUNDAE:
            if r < edge - 1:
                continue                            # this row of scoop has melted away
            g = brand(0.10 + 0.085 * r)
            if r < edge:                            # the row the melt line is eating: fades as it passes
                _put(f, r + top, c, g, max(0.0, 1.0 - (edge - r)))
            else:
                _put(f, r + top, c, g, 1.0)
                if r < edge + 1:                    # hot melt line glows (only while actually melting)
                    _put(f, r + top, c, Color(255, 235, 150), 0.9 * p * (1.0 - (r - edge)))
        frames.append(f)
    return frames, 24


def cherry():
    """A cherry drops into the sundae and the splash ripples out across the whole facade.

    Ghost sundae stays lit at low level; two expanding rings wash over it. 72-frame cycle at 24 fps.
    """
    n, fps = 72, 24
    fall, impact_r, impact_c = 18, 6, 4             # cherry lands on the ice cream surface
    frames = []
    for t in range(n):
        f = Frame()
        # --- ghost sundae, always there
        for r, c in SUNDAE:
            _put(f, r + SUNDAE_TOP, c, brand((r + SUNDAE_TOP) / ROWS), 0.16)

        if t < fall:
            # accelerating drop down the centre column, with a short trail
            r = impact_r * (t / (fall - 1)) ** 2
            for j, k in enumerate((1.0, 0.4, 0.15)):
                _put(f, int(r) - j, impact_c, Color(237, 117, 175), k)
        else:
            age = t - fall
            amp = max(0.0, 1.0 - age / 66.0) ** 1.2
            # cherry sinks into the scoop and flashes white on impact
            _put(f, impact_r + min(2, age // 6), impact_c, Color(237, 117, 175), 0.35 + 0.65 * amp)
            if age < 3:
                for dr, dc in ((0, 0), (0, 1), (0, -1), (-1, 0), (1, 0)):
                    _put(f, impact_r + dr, impact_c + dc, Color(255, 250, 230), 1.0 - age / 3.0)
            for r in range(ROWS):
                for c in range(COLS):
                    dr, dc = (r - impact_r) * 0.72, c - impact_c
                    d = math.hypot(dr, dc)
                    g = 0.0
                    for lag, w in ((0, 1.0), (13, 0.55)):     # a big ring and a smaller echo
                        rad = (age - lag) * 0.30
                        if rad >= 0:
                            g = max(g, w * math.exp(-((d - rad) / 1.15) ** 2))
                    if g > 0.02:
                        _put(f, r, c, brand(max(0.0, 1.0 - d / 8.6)), g * amp)
        frames.append(f)
    return frames, fps


DEMOS = [
    ("sundai-melt", "Melting sundae",
     "The sundae melts down the tower, drips pooling on the plaza, then re-freezes.", melt),
    ("sundai-cherry", "Cherry drop",
     "A cherry falls into the sundae and splashes brand-coloured ripples across the facade.", cherry),
]
