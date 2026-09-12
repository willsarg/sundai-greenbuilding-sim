"""Designed by Claude Haiku (2026-09-11). Two new Sundai animations for the Green Building window display."""
from make_demos import Frame, Color, brand, sprite, SUNDAE, SUNDAE_TOP, CRITTERS


def sundae_glow():
    """Pulsing gradient halo expands and contracts around the sundae. 60-frame cycle."""
    n = 60
    frames = []

    # Precompute center of sundae
    r_vals = [r for r, c in SUNDAE]
    c_vals = [c for r, c in SUNDAE]
    center_r = SUNDAE_TOP + (min(r_vals) + max(r_vals)) // 2
    center_c = (min(c_vals) + max(c_vals)) // 2

    for t in range(n):
        f = Frame()
        phase = t / n  # 0 to 1

        # Main sundae core (constant)
        for r, c in SUNDAE:
            f[r + SUNDAE_TOP][c] = brand(0.3)

        # Expanding halo: rings of color at varying distances
        for r in range(f.nrows()):
            for c in range(f.ncols()):
                # Manhattan distance from center
                dist = abs(r - center_r) + abs(c - center_c)

                # Ring effect: bright at certain distances, dims elsewhere
                # Phase controls which ring is brightest
                brightness_dist = (dist - phase * 8) % 8
                if 0 <= brightness_dist < 2:
                    intensity = 1.0 - brightness_dist / 2.0
                    hue_t = (dist / 12.0 + phase) % 1.0
                    col = brand(hue_t)
                    f[r][c] = Color(col.r * intensity, col.g * intensity, col.b * intensity)

        frames.append(f)
    return frames, 30


def critter_arch():
    """Four critters bounce across the building in arcing parabolic paths. 80-frame cycle."""
    n = 80
    frames = []

    # Calculate center of the sundae sprite on the grid
    r_vals = [r for r, c in SUNDAE]
    center_r = SUNDAE_TOP + (min(r_vals) + max(r_vals)) // 2

    # Define starting columns and color indices for each critter
    # (start_col, end_col, color_index, time_offset)
    arcs = [
        (0, 8, 0.0, 0),      # arc from left to right
        (8, 0, 0.33, 20),    # arc from right to left
        (2, 7, 0.66, 40),    # arc from left-center to right
        (6, 1, 1.0, 60),     # arc from right-center to left
    ]

    for t in range(n):
        f = Frame()

        for start_col, end_col, color_idx, offset in arcs:
            phase = ((t - offset) / n) % 1.0

            if -0.1 < phase < 1.1:  # Active during this phase (with overflow for smooth entry/exit)
                # Parabolic arc: x moves linearly, y follows parabola
                progress = max(0, min(1, phase))

                # Horizontal position
                col_pos = start_col + (end_col - start_col) * progress
                c = int(col_pos) % 9

                # Vertical arc (parabola: highest at midpoint)
                arc_height = 4 * progress * (1 - progress)  # Peaks at progress=0.5
                r = int(center_r - arc_height * 6)

                # Pick a critter sprite (cycle through 4)
                critter_idx = int(color_idx * 4) % 4
                sp = CRITTERS[critter_idx]

                # Draw critter at this position
                for dr, dc in sp:
                    rr = r + dr
                    cc = c + dc
                    if 0 <= rr < f.nrows() and 0 <= cc < f.ncols():
                        f[rr][cc] = brand(color_idx)

        frames.append(f)
    return frames, 30


DEMOS = [
    ("sundai-glow", "Sundai glow", "Expanding rings of gradient light pulse outward from the sundae core, creating a shimmering halo effect.", sundae_glow),
    ("sundai-arch", "Sundai arch", "Four critters bounce across the building in arcing parabolic paths, crossing and passing each other.", critter_arch),
]
