# Pine minimap fix validation (E435)

**Minimap fix PASS; overall floor FAIL.** Unprofiled desktop Pine entry on
`581ac20ee97789257c18a34815838be4c6a9884b`, containing fix
`511be233025a84fd026f168b0476715a761dbeb4`. The minimap source blob in the
timing pin exactly matches the pixel-oracle fixture. Developer ON,
DEVSERVER catalogue, build pacing ON, Auto fps, unchanged render scale 2x.
No CPU/GPU profiler or GL observer. Complete in 95.4 seconds, zero errors.

| Pine phase | p95 ms | Max ms | Verdict |
| --- | ---: | ---: | --- |
| Short travel | 33.4 | 49.9 | FAIL p95 |
| Whole drive and builds | 16.8 | 83.4 | PASS |
| Entry interior | 16.7 | 16.8 | PASS |

The 166.7 ms diagnostic `play` spike is gone. Every observed Pine frame
is below the 100 ms desktop max gate; only one frame exceeds 50 ms,
83.4 ms during `afterPlay`. No `play` frame exceeds 50 ms. This closes
the hidden minimap repaint fix, while short-travel p95 remains open at
33.4 ms against 17.5 ms. Frame work p95 there is 4.4 ms; grid CPU p95
0.8 ms, and Pine's active systems have not started.

The real browser pixel oracle compares the baseline and fixed Minimap
classes as iPhone 16 Pro. Painted and baked ground each run at base
opacity 0.25, 1 and the default, after a hidden dirty update; terrain,
features, fog, overlays, marks, animal dots and player arrow are retained.
All six cases compare 746496 RGBA bytes each: **zero bytes differ**,
4478976 bytes total, zero browser errors. This is widget pixel parity on
deterministic fixtures, not a full-game visual parity claim.

Owned timing preview and both browsers are closed. Quiet was released
at 23:20:12.472Z and the explicit release sent to the coordinator and all
waiting lanes. The previous full milestone remains FAIL, including its
Simulator reds. [Scalar receipt](summary.json).
