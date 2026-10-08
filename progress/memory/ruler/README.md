# The native ruler, fixed: readings before the census (E435, ruler lane)

2026-10-08, ruler builder (Opus). The grid-base lane (`c2d910073`, [../grid-base/README.md](../grid-base/README.md)) showed
that [g227-budget/native.mjs](../g227-budget/native.mjs) inflated its own readings: each pose ran the in-page census (a
scene, texture and buffer walk) after its kernel footprint samples, WebKit kept the 50–300 MB that walk allocated, and the
next pose's reading carried it.

## The fix

`native.mjs --census=final` (the default): every pose takes its three settled footprint samples first, then a light GL
total (the GL tracker's per-context sums; no scene walk, no per-resource rows), and the full census runs once, after the
last pose's reading. `--census=none` skips it, `--census=every` is the old order (for comparison with old receipts only).
New route mode `standalone-pine` boots `?chunk=pine-hollow` and reads its spawn and the grid-base centre pose with the same
sampler, so grid and standalone compare like for like. `census-regression.mjs` checks the order and the light read.
[summary.py](summary.py) tabulates a runs folder (attempt / valid / failure counts, median [min–max]).

Readings: pending (queued through `scripts/sim-lane.sh` on a clean `serve-build.sh --head` preview).

Plan-State: unchanged
