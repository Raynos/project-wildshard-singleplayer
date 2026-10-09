# Signal Dunes ground-tile proof, 2026-10-08

**Keep the default off.** Grid travel and all requested collision checks pass, but the matched grid-centre ON capture has a visible straight/triangular shading boundary across the dune surface. It is absent in both OFF captures. This does not meet the requested “no visible change” condition. No production source or default was changed; the visual correction is for the rendering owner.

Pin `5b2e86cf7a2ab065017b8b842e743793231906fc`, build `5b2e86c-mv0bd57j`, one owned clean `serve-build.sh --head` preview. Muted Chromium/Metal, phone tier, Developer ON. Grid and midpoint captures use iPhone 16 Pro; the canonical physics-baseline walk uses its 390×844 / 1× viewport. These are browser collision/parity observations, not native-memory or fps measurements.

| proof | result |
|---|---|
| Grid OFF / ON, north entry → road → re-entry → road | Both visits and exits ready, no timeout or page errors in either state |
| Ground witness during grid visits | OFF 0 / 0 tiles; ON 32 / 32 tiles |
| Quest / runtime continuity | Scout quest 0→1, stays 1 after re-entry; all 13 `sunscar.home:<i>` identities; whip crack -1→0 in each visit |
| Canonical standalone walk, ON | 7/7 legs, 0 stuck, 0 air/swim/slide frames, 0 page errors; Developer=true, row=on, 48 terrain tiles verified |
| Four midpoint entries, ON, both ways | 8/8 legs, 0 stuck, 0 air/swim frames, 0 page errors |
| Four 8×15 m footprint scans | 7,680 rays at y=0; 0 raised, missing or wet samples |
| Frame floor OFF / ON | Not run: initially Simulator occupied and load 37.25; after release load 35.41 remained above 12. Commands in protocol.json |

Grid console errors are exclusively local-preview `/api/telemetry` 404s (two per full travel run, one per visual-only run), identical in both states. No product request failed. The walk uses the existing static-collision autopilot, which freezes creatures; midpoint entry walks also lift standalone horizontal bounds as the existing grid-equivalent harness specifies. No controller, route, collision tolerance or stuck assertion was altered.

## Matched visual evidence

The normal grid-run shots were about 0.9 m apart at the north approach; they cannot establish pixel parity. `MATCHED=on` adds separate visual-only fixed poses after the real entry: local (0,223) and (0,0), yaw 0, pitch -0.12, hover unchanged. OFF is repeated to measure noise. Those extra placements are **not** used as traversal proof. At the centre OFF and OFF2 feet are exactly 18.521783 m; ON is 18.504268 m (−1.7516 cm). Entry feet match exactly.

[Entry pair](pair-matched-entry.jpg) and [centre pair](pair-matched-centre.jpg): OFF | ON | absolute RGB difference ×4. Full-resolution original portrait JPEGs and pose coordinates are in `matched-{off,off2,on}/`. The centre pair shows the hard tonal edge in the ON middle panel; its underlying cause is not established by this measurement.

| pose | full-image noise mean / % pixels >8 | full-image swap mean / % pixels >8 | terrain-band noise mean / % >8 | terrain-band swap mean / % >8 |
|---|---|---|---|---|
| entry | 0.9465 / 1.5497% | 0.8292 / 0.9999% | 0.5366 / 0.0254% | 0.6558 / 0.5636% |
| centre | 0.9338 / 1.3346% | 3.6709 / 19.0916% | 1.1720 / 1.3178% | 1.6908 / 4.3856% |

Mean is absolute 8-bit RGB difference after resizing to 402×874. Terrain band is x45..339, y340..419. Diagnostics include ordinary animation/JPEG noise and the actual height difference; no numerical visual pass threshold was invented. Recompute with `python3 ../compare-grid.py .` (ImageMagick required).

## Reproduce / raw receipts

From repository root, with one pinned preview:

```sh
ROW=off scripts/browser-lane.sh node progress/shard-platform/hybrid-tiles/part2/grid-run.mjs <base> <out-off>
ROW=on scripts/browser-lane.sh node progress/shard-platform/hybrid-tiles/part2/grid-run.mjs <base> <out-on>
# Visual-only supplement, fresh context each run; repeat OFF twice:
MATCHED=on ROW=off scripts/browser-lane.sh node progress/shard-platform/hybrid-tiles/part2/grid-run.mjs <base> <matched-off>
MATCHED=on ROW=on scripts/browser-lane.sh node progress/shard-platform/hybrid-tiles/part2/grid-run.mjs <base> <matched-on>
```

The canonical walk CLI's device-save values are strings, while Developer requires a boolean. In the isolated pinned export only, `physics-harness.patch` seeds boolean `devMode:true` and adds getter-safe Developer/tile witnesses. It changes no game code or walk logic:

```sh
scripts/browser-lane.sh node scripts/physics-baseline.mjs --no-build --mode=walk --shard=sunscar-dunes --url=<base> --label=signal-tiles-on --device-save=debug.plugin.sunscar-dunes.groundTiles=on
scripts/browser-lane.sh node progress/shard-platform/sf50/entries.mjs --slug=sunscar-dunes --route=progress/shard-platform/sf50/entries-route.json --url=<base> --out=<out> --device-save=debug.plugin.sunscar-dunes.groundTiles=on
```

`physics-walk.json.gz` preserves all walk traces and explicit fixtures, with unrelated generated test-session telemetry removed. `entries-walk.json` preserves all footprint and leg observations. `grid-{off,on}/grid-run.json` are the unmodified normal-mode outputs. `summary.json` is derived, not a substitute for raw evidence. `protocol.json` records source blobs, pin, settings, skipped-floor commands and machine state. All owned browser contexts and the preview were closed after collection.
