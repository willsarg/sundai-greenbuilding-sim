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
   an elevation is not a view. (The angled river view was removed 2026-09-07:
   at 590 m the true perspective is nearly orthographic, so it added nothing.)
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

Heights (OSM `height` tags, 2026-09-07; the MIT buildings carry
`source=Massachusetts Institute of Technology - Facility Information Systems`,
verified for Building 10 and Stata; the Green Building's 90 m also matches
Wikipedia's 295 ft) and apparent size relative to the tower
(height/distance, tower = 1.00) from the same camera:

| Landmark | height m | apparent |
| --- | --- | --- |
| Green Building | 90 | 1.00 |
| Great Dome (Building 10, top of dome) | 58.03 | 0.67 |
| Stata Center | 43.1 | 0.38 |
| Hayden Library | ~20 (no OSM tag; estimate) | ~0.29 |
| Walker Memorial | 26.3 | 0.35 |
| Media Lab (E14) | 32.5 | 0.34 |
| Wiesner (E15) | 22 | 0.22 |
| Kendall: Google (18 fl) | 81.7 | 0.60 at x .78 |
| Kendall: E28 (17 fl) | 85.4 | 0.68 at x .81 |
| Kendall: E37 tower (28 fl) | 102.1 | 0.81 at x .95 |
| Sailing Pavilion | ~8 (2 levels) | ~0.13 |
