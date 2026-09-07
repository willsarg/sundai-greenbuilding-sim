# Rendering principles

Decided by Will, 2026-09-07.

1. **Realism is a contract only for the display.** The 17x9 window grid and the
   tower it sits on must match the real Green Building: proportions, what is
   lit, what is hidden (e.g. the Memorial Drive tree line covering the bottom
   two rows from the Esplanade, behind the "Real tree line" toggle).
2. **Everything outside the grid is artistic.** The Great Dome, the skyline,
   trees, water, sky, and lighting may be more handsome than true if that makes
   a better picture. Reference photos inform them; they do not bind them.
3. **Every view must be a distinct camera.** A view that only adds a wedge to
   an elevation is not a view. Angled views foreshorten the faces and converge
   the edges like a real two-point perspective.
4. **State lives in the URL.** `?view=...&real=1` reproduces what a link shows.

References used for any of this are listed in `IMAGE_SOURCES.md`.

## River-view geography

Horizontal placement in both river views comes from real coordinates, sizes stay
artistic. Camera assumed on the Esplanade due south of the tower at
42.3550, -71.0893, lens 50 degrees wide. Coordinates from OpenStreetMap
(Nominatim, 2026-09-07).

| Landmark | lat, lon | bearing vs tower | frame x |
| --- | --- | --- | --- |
| Green Building (54) | 42.36032, -71.08934 | 0 | .50 |
| Great Dome (10) | 42.35969, -71.09198 | -22.7 | .05 |
| Stata Center (32) | 42.36154, -71.09067 | -8.5 | .33 |
| Hayden Library (14) | 42.35904, -71.08949 | -1.6 | .47 |
| Kendall Square | 42.36261, -71.08761 | +9.7 | .69 |
| Walker Memorial (50) | 42.35936, -71.08830 | +10.0 | .70 |
| Wiesner (E15) | 42.36081, -71.08761 | +12.5 | .75 |
| Media Lab (E14) | 42.36043, -71.08730 | +15.6 | .81 |
| Sailing Pavilion | 42.35851, -71.08779 | +18.1 | .86 |
