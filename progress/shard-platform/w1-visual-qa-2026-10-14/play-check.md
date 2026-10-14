# W1 play check: Signal's boss storm, Sky's updraft and the Storm Roc (2026-10-14)

Lane sp-o163 (Opus, visual QA by real play) for the SHARD-PLATFORM coordinator. This covers the three things the
[visual QA](README.md) listed under "Couldn't capture". This time each was reached by playing, with no phase forcing.
The bar is G415: no graphical glitches, graphically similar, no major regressions.

- **Before:** `a345b6d6b` (build `a345b6d-mv7j9qbf`). **After:** `0e626fb74` (HEAD, build `0e626fb-mv7j8o95`). The
  after build includes e80c843d5, 2d89aec29, a6f4eff1c, 8e0c6b74f, 8786ea8b9 and 3b3ad2419.
- Both builds came from `scripts/serve-build.sh --rev` / `--head`. One muted Chromium ran through
  `scripts/browser-lane.sh` with one "iPhone 16 Pro" context per build (portrait, `touch&tier=phone`), Developer on,
  harness pins and `Math.random` pinned. The same script ran on both builds side by side.
- **Inputs:** taps on the touch HUD's own buttons (LOCK, ATTACK / SWING, GUST, HOVER) and the keyboard's W for the
  board. The probe's `pose` was used only to place the player at the start (the tower, the windmill isle's rim, the
  crown). The Signal fire was lit with the tower fire's own `light()`, the quest's last step, which summons the
  Matriarch. Every phase change came from damage dealt in play.

## Verdict: no findings

All three were reached on both builds and look the same. There were no page errors on either build. The console showed
the same THREE warnings as before (the `toNonIndexed` and `Clock` deprecation warnings and the TSL `irradiance`
rename), and nothing new.

| Item | Reached? | Before | After | Pairs |
|---|---|---|---|---|
| Signal: the Matriarch's storm in a real whip fight | yes, both builds | Phase II after 87 s of light cracks, at 396 hp | Phase II after 72 s, at 396 hp | `pc1`, `pc2` |
| Sky: an updraft ride on the board | yes, both builds | y 30.5 → 44.5 m in 4.7 s, lands on the high step | the same, within 0.2 m at every sample | `pc3`–`pc6` |
| Sky: the Storm Roc in flight, its hit flash and phase 2 | yes, both builds | Phase 2 ("Walls of gale") at 277 hp | the same | `pc7`–`pc10` |

### 1. Signal: the Matriarch's storm (e80c843d5, 2d89aec29)

- She was summoned from the tower and fought from the basin's north rim with taps on LOCK and ATTACK. Each dive that
  came in within reach took 18–36 hp. At 66 % health she went into phase II on both builds, and `weather.storm` eased
  to 1.0 over about 2.5 s.
- **The storm shows on both builds.** The scene has both shell spheres (46 m and 22 m, render order 10) and both are
  visible. On screen, the dusty red-maroon sand streaks race across the dusk sky, with her silhouette inside them, in
  the same way on both builds (`pc1`). A 10-frame sequence about 1.8 s apart shows the streaks moving with no flicker,
  no pop and no missing shell (`pc2`).
- So the earlier report that a forced `enterPhase(1)` showed no storm came from the forcing, not from tonight's move:
  the storm only appears in a real fight.

### 2. Sky: the updraft ride (a6f4eff1c, 8e0c6b74f, 8786ea8b9)

- The board went out from the HOVER button and W was held from the windmill isle's rim up the ramp. The lift is
  identical on both builds: 30.5 → 32.7 → 35.7 → 38.6 → 41.6 → 44.1 m at the same half-second samples, then the
  landing on the high step (`pc3`, `pc4`). The shared impulse kernel lifts exactly as before.
- **The wind streaks and leaves on the GPU:** the updraft's `far.updraft.streaks` (24) and `far.updraft.leaves` (14)
  are drawn on both builds. Before, they were instanced meshes; after, they are effect-field meshes with 24 and 14
  instances. Seen from the ramp's foot, both builds show the thin, pale streaks spiralling round the column and moving
  from frame to frame, at about the same density (`pc5`, and the crop sequence `pc6`).

### 3. Sky: the Storm Roc (3b3ad2419)

- The fight was on the crown with taps on LOCK, SWING and now and then GUST. The Roc stoops from the storm on both
  builds. It looks the same in flight: the banded pale front, the dark-tipped wings and the yellow talons (`pc7`).
- **The hit flash:** a frame taken about 0.1 s after a 16 hp fan hit (the Roc right at the camera) shows the same
  pale, washed-out flash on both builds (`pc8`).
- **Phase 2, "Walls of gale":** both builds show the caption, the Roc hovering at wall height, and the pale
  translucent gale-wall sheet sweeping through with the red damage vignette (`pc9`).

## Notes (not findings)

- **Off the crown's rim:** first posed 4 m inside the crown's rim, the player was knocked over the edge by the dives
  and gale walls on both builds. They fell to the clouds and came back at Sunrest's spawn, and the Roc followed them out
  of the arena with its boss bar still up. It is the same on both builds and was caused by where the player stood.
  Posed 7 m further in, the fight stayed on the crown.
- **The Roc overhead:** when it banks right over the player it reads as a pale, flat disc with a dark hollow in the
  middle (its underside seen edge-on). It is the same on both builds, so it is old (`pc10`).
- **The gale wall's look:** it is a plain, flat, pale rectangle on both builds. The [README](README.md)'s F4, a pale
  cyan-white sheet at the road socket's lip, might be worth checking against this wall's material or the updraft glass.
  This is only a lead; nothing here ties them together.
- The fights' timings differ by a few seconds between builds (when dives came in reach, and the drift rays' phase).
  That is timing only.

## Images

| File | What |
|---|---|
| `pc1-signal-storm-pair.jpg` | The Matriarch's phase II storm, locked on, before and after |
| `pc2-signal-storm-sequence.jpg` | The storm phase, 5 frames about 1.8 s apart on each build |
| `pc3-sky-updraft-sequence.jpg` | The updraft ride, 7 frames about 0.9 s apart on each build |
| `pc4-sky-updraft-mid-pair.jpg` | Halfway up the updraft, at t ≈ 2.7 s |
| `pc5-sky-updraft-column-pair.jpg` | The updraft column and its streaks, seen from the ramp's foot |
| `pc6-sky-updraft-streaks-crop.jpg` | A crop over the ramp, 4 frames 0.25 s apart on each build (the streaks moving) |
| `pc7-sky-roc-flight-pair.jpg` | The Storm Roc stooping in phase 1 |
| `pc8-sky-roc-hit-pair.jpg` | The Roc's hit flash about 0.1 s after a fan hit |
| `pc9-sky-roc-gale-wall-pair.jpg` | Phase 2: a gale wall hits the player |
| `pc10-sky-roc-overhead-both.jpg` | The Roc banking overhead: the same on both builds (a note) |
