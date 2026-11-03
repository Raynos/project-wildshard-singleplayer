# FPS census · iOS Simulator half (2026-11-03, sp-o2)

The goal: **iOS Simulator 30-60 fps at all times.** This is the Simulator half of the census; the desktop half is
sp-o1's `fps-census-desktop-2026-11-03.md`, on the same pin and the same poses.

- **Pin:** app `4255d1c67bb0e33271618917baa80ef3b7b8e4b3`, served at `:4401` (sp-o1's shared preview, leased).
- **Reader:** `scripts/frame-floor.mjs --surface=sim --quiet` (reader blob `fca2cff0`, after sp-o1's `1ea6c14007`),
  official quiet windows only, Simulator `frame-floor-iphone-17-pro` (AC96C7CA-A9AF-4509-8D89-D904022391EA), iPhone 17
  Pro portrait Safari, phone tier, 2x, 120 frames a pose.
- **Poses:** each shard's boot spawn plus sp-o1's two golden standing poses (`cameras24.json`); the grid's home spawn plus
  J1 (281.25, 1.7, -281.25: Driftwood, Nalati, Far Reach and Nine meet) and J2 (843.75, 1.7, -843.75: Nine, Desert Ruin,
  Alien Plain, Ember Forge), facing home. Far Reach is Sky Reach and Sunscar is Signal Dunes, so six shards, not eight.
  The open plots are left out: their OB8 official readings exist (sp-x8).
- **Runs:** run 1 17:02-17:10 Cancun (all seven), run 2 17:18-17:24 (Driftwood and the grid again). Run 1's first 41 s
  overlapped sp-x1's aborted browser-lane start (17:02:01-17:02:42, stopped on TERM, no reading of its own), during
  Driftwood's boot; run 2 re-read Driftwood clean and it matches run 1 to the millisecond.

p5 fps is the 5th-percentile frame rate (1000 / the p95 frame time). "Draws" is the frame's observed draw calls; the
phone draw budget (150 a frame, counting shadow, post and held passes) is the reader's, so a pose can hold 30 fps and
still fail on draws.

| Shard | Pose | Median fps | p5 fps | p95 ms | Worst frame ms | Verdict |
|---|---|---|---|---|---|---|
| Driftwood | spawn | 30.3 | 29.4 | 34 | 35 | pass |
| Driftwood | golden-01-pier | 30.3 | 29.4 | 34 | 34 | pass |
| Driftwood | golden-02-beach | 30.3 | 29.4 | 34 | 34 | draw budget 152 > 150 |
| Pine Hollow | spawn | 30.3 | 29.4 | 34 | 45 | pass |
| Pine Hollow | golden-01-gate | 30.3 | 29.4 | 34 | 34 | pass |
| Pine Hollow | golden-02-cabin | 30.3 | 29.4 | 34 | 35 | pass |
| Nalati | spawn | 30.3 | 29.4 | 34 | 34 | draw budget 205 > 150 |
| Nalati | golden-01-camp | 30.3 | 29.4 | 34 | 34 | draw budget 189 > 150 |
| Nalati | golden-02-bridge | 30.3 | 29.4 | 34 | 34 | pass |
| Nine Dragon | spawn | 30.3 | 29.4 | 34 | 34 | pass |
| Nine Dragon | golden-02-B | 30.3 | 29.4 | 34 | 34 | pass |
| Nine Dragon | golden-03-C | 30.3 | 29.4 | 34 | 34 | pass |
| Sky Reach | spawn | 30.3 | 29.4 | 34 | 34 | pass |
| Sky Reach | golden-05-windmill-isle | 30.3 | 29.4 | 34 | 36 | pass |
| Sky Reach | golden-06-roost-nest | 30.3 | 28.6 | 35 | 37 | pass |
| Signal Dunes | spawn | 30.3 | 29.4 | 34 | 34 | pass |
| Signal Dunes | golden-05-signal-tower | 30.3 | 29.4 | 34 | 34 | pass |
| Signal Dunes | golden-06-caravan | 30.3 | 29.4 | 34 | 34 | pass |
| Grid | home spawn, J1, J2 | — | — | — | — | **no reading**: entry never finished |

- **Every measured pose holds 30 fps** (the Simulator's cap): median 30.3, p95 34-35 ms against the 35 ms bar, worst
  frame 45 ms (Pine's spawn) against the 200 ms long-frame bar. None is under 30 fps. None meets the strict 33.3 ms p95,
  which the Simulator's 30 fps cadence quantises to 34 ms at every pose.
- **Three poses miss the phone draw budget, not the frame rate:** Nalati's spawn (205) and camp (189), Driftwood's beach
  (152).
- **The grid gave no reading, twice.** Both runs entered the grid and every Safari Web Inspector `Runtime.evaluate` timed
  out, about every 21 s (12 in each run), until the 240 s load deadline. Either the page's main thread blocks during the
  Simulator's grid load or the inspector link drops; the result does not say which. sp-x6's passive one-shot host stack
  sample at the first timeout (run 2) triggered only at teardown and failed (`simctl spawn … launchctl managerpid`, exit
  149), so the cause is still open. Results: `tmp/sp-o2-census/out/4255d1c67-61434-1793743318603.json` and
  `tmp/sp-o2-census/out2/4255d1c67-82979-1793744302467.json` (scratch, not committed).
