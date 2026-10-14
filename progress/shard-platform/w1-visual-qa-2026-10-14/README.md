# W1 visual QA: Sky Reach and Signal Dunes, before and after the night port (2026-10-14)

Lane sp-o156 (Opus, visual QA) for the SHARD-PLATFORM coordinator. A read-only check of the ~106 commits that moved
Sky Reach (`far-reach`) and Signal Dunes (`sunscar-dunes`) onto the platform. The bar is G415: no graphical glitches,
graphically similar, no major regressions.

- **Before:** `a345b6d6b` (build `a345b6d-mv7gl61v`). **After:** `c0c5de864` (HEAD, build `c0c5de8-mv7gm45z`). It
  includes ce8dc45fa, the Sky flipY fix.
- Both builds came from `scripts/serve-build.sh --rev` / `--head`. Every capture was an "iPhone 16 Pro" portrait at
  `tier=phone`, muted, with Developer on and `Math.random` pinned. The same scripted poses ran on both builds, in
  parallel, through `scripts/browser-lane.sh`.
- About 150 pose pairs were captured: Sky ×4 passes, plus Memory saver on; Signal at dusk, with "day", with the
  braziers lit, and with the signal fire lit and the boss summoned; and a grid entry from the road. Every pair was
  scored for mean pixel difference and every pair that differed was looked at by eye.

## Findings

| # | Shard · view | What's wrong | Severity | Likely area |
|---|---|---|---|---|
| F1 | Sky · Sunrest meadow at 5–25 m (`f1`) | The mid-range meadow is broken into dark separate tufts with bare dark ground between them. Before, it was a continuous golden sward. Close blades (0–5 m) and the far meadow look as before. It's clearest on Sunrest's south side (8, 30, 8); the grove's close-up reads near the before. | **major** | 376313d0f, the baked meadow blades (chunk LOD, "phone's half first", near copies) |
| F2 | Sky · meadow flowers (`f2`) | The daisies, buttercups and orange wildflowers are gone. Before, they showed on every island (windmill isle, grove, Sunrest). After, not one is visible in any capture. | minor (whole feature missing) | 376313d0f, the `meadow` graph's flower path (`data/meadowLook.ts` `isFlower` / blade code unpacking) |
| F3 | Sky · Sunrest knoll toward the sun (`f3`) | A cluster of 2 m+ seed-head stalks now stands right in front of the eye on the knoll. They hide the windmill and the sun, which the before view framed. The whole meadow is also a warmer yellow than the old olive-gold. | minor | 376313d0f (new baked layout and tint) |
| F4 | Sky · entered as a grid cell from the road (`f4`) | On the road socket's lip, a pale cyan-white glowing sheet covers the deck (the bottom third of the frame; looking down, a bright band). It's the same in 3 of 3 runs on HEAD and absent in 3 of 3 runs on the before build. | **major** (on every road entry) | Something drawn at road height in Sky's frame: the cloud sea graph (2412fc6ad), the GPU wind / updraft effect field (8786ea8b9), or the islet rows (af34837fd, 7def4ee68) |

## Checked and fine (similar enough)

- **Boot and console:** both shards boot to play on both builds (Sky ~3.1 s, Signal ~2.1 s). No page errors on
  either build. The console output is the same on both: one 404 resource, three THREE deprecation warnings and the
  TSL `irradiance` rename warning.
- **Sky storm vortex (coordinator check 1):** the storm-eye ring shows the same spiral, the right way up, with
  Memory saver off and on, and it matches the before build (`n1`, `n3`).
- **Sky cumulus and cloud sea (coordinator check 2):** the right way up with Memory saver off and on, with flat
  bottoms and billowy tops (aerials, horizon, looking down), and the same as before.
- **Sky:** the spawn view, sun shafts, aerials, windmill, crown arena, Storm Roc boss bar, keeper's isle, roost,
  rope and hover bridges, updraft ramp glass, board viewmodel, War Fan swing and gust, and the rising islet
  (docked, rails and posts) all match. Tonight's grass on the crown arena is denser and shorter, which is within
  the bar.
- **Signal:** every pose is near pixel-identical (mean difference 0.0–1.3). That covers the spawn and the view
  back, caravan, tower, well, braziers, basin, both map edges, the whip idle and crack, the braziers lit (with the
  deeper dusk and fire), the signal fire lit, and the Matriarch summoned with her boss bar (`n2`).

## Notes (not findings)

- **Sleeve (coordinator check 3):** the fan's sleeve shows its hollow open end in mid-swing and mid-gust on
  `a345b6d6b` too. It's an old issue, not from tonight.
- **Drift rays:** the drift rays fly at different phases between runs, so grey low-poly ray bodies sweep through
  some frames on one build only. Animation phase only.
- **Signal "day":** the Developer `time` row (midday / night) changes nothing in Signal on either build, because
  Signal holds dusk. "Night" here is the quest's deepening dusk with the braziers lit, which matches.
- **Sky grid entry, both builds:** loading Sky from the road sat at "step 2/4 · runtime 62 %" for about 26 s at
  the socket, and on the lip the shard stays in SAFE ZONE (no fan) until the islet ride. The same on both builds.
  The islet's chains read as straight dark bars from the lip on both builds.

## Couldn't capture

- **Signal boss storm:** forcing the Matriarch into her storm phase (`script.enterPhase(1)`, `weather.storm` reaches
  1) showed no fog or blown-sand shells on either build. The storm presentation (2d89aec29, e80c843d5) is
  unverified. It needs a real fight to phase 2.
- **Sky updraft ride:** the scripted board ride fell out of the column on both builds. The updraft ramp and the
  board were checked only standing still.
- **Storm Roc in flight:** the Roc never came into frame in the arena captures on either build, though its boss bar
  showed.
