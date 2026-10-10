# op-frame22: the grid cell composite lands (SF63 / G158, E435, 2026-10-10)

Successor of op-frame21 (`progress/shard-platform/frame21/README.md`). Its local candidate `1b7f4c8ad` lands on main with
one fix, still behind the default-off row pause > Settings > Debug > Look > **Grid cell own composite**
(`gridCellComposite`, reload, reviewBy 2026-12-30).

**Tests.** A clean export of HEAD `001a193bf` plus the candidate ran every test its changed files reach
(`vitest related`, 734 files, 3,937 tests): one failure, `test/shards/sunscar-dunes/headless-runtime.test.ts`
("restores mid-fight and mid-respawn continuation exactly"), a 20 s timeout under the full run; alone it passes all 7
tests in 12 s. op-frame21's red gate (14 files / 20 tests, log lost) did not reproduce on a quiet machine. The Sky,
Nine and Pine witness checkpoints are input-only stale (their `.snap.gz` payloads re-record byte-identical): the pusher
re-records the manifests (GIT.md).

**"Loading Sky Reach" after the cell was ready: a frozen frame, not a loading card.** With the row on, Sky Reach's
composite was a second `ToneMappingEffect` (NEUTRAL) in the page's colour pass, beside the shell's own. Both include
three's tone-mapping chunk, so the merged fragment shader failed to compile (`'toneMappingExposure' : redefinition`,
then `useProgram: program not valid` every frame) and the canvas kept the last image drawn before the composite was
placed: the road view of Sky Reach's G217 cell screen at step 3 / 4 (first run, on the candidate build `da1ce25`: 267
console errors in B, none in A, the same in all three B shots at 0 / 4 / 15 s). Fix: Sky Reach's display is its own `SkyNeutralToneEffect` (`src/shards/far-reach/look/neutralTone.ts`,
three's Khronos PBR Neutral curve at exposure 1, no chunk), and the frame owner now refuses any composite display that
includes the chunk (`GridFrame.composite`, a warning instead of a dead frame; `test/grid-cell-composite.test.ts`).
After the fix the B shot draws Sky Reach with its NEUTRAL curve and no shader error: `sky-reach-ab-fixed.jpg`
(muted iPhone 16 Pro portrait, phone tier 2x, the north dock 4 s after ready; `sky-loading.mjs`, `sheet.py`; readout
`sky-loading.json` from the fixed build `d823261`).

**Floors with the row ON (Nine Dragon in the grid).** `scripts/frame-floor.mjs` gained a generic cell route:
`--devserver` builds its pinned preview in DEVSERVER mode (whose grid holds the DEVSERVER-only cells, Nine Dragon at
(+1, −1)), and `--grid-scenario=cell --grid-cell=<slug> [--grid-cell-pose=x,y,z,yawDeg[,pitchDeg]]` enters that cell from
the road at its home-side edge (one road seed, then held input; the leg ends once the cell is entered and ready, since
Nine's deck portals to Lantern Square), measures travel and the interior, then a pose in the cell's local frame
(`gridFloorPlans(…, 'cell', { cell })`, `test/frame-floor-grid.test.ts`). Measured build `d823261` (85bc9fefb's composite
content), Nine's pose = its spawn frame (0.95, 125, 7.5, yaw −12°), 120 frames per row:

| surface, row | home spawn | crossroads | deck | Nine interior (entry) | Nine city pose | entry travel |
|---|---|---|---|---|---|---|
| desktop, ON | 59.88 / 16.7 | 59.88 / 16.7 | north 59.88 / 16.7 | 59.88 / 16.7 | **59.88 / 16.8 PASS** | 59.88 / p95 33.4 |
| desktop, off | 59.88 / 16.8 | 59.88 / 16.8 | north 59.88 / 16.7 | 59.88 / 16.7 | 59.88 / 16.7 | 59.88 / p95 33.4 |
| Simulator, ON | 30.30 / 34 | 30.30 / 34 | east 30.30 / 34 | 30.30 / 34 | **30.30 / 34 PASS** | 11.6 / p95 191 |
| Simulator, off | 30.30 / 40 | 30.30 / 43 | north 30.30 / 36 | 27.8 / 56 | 28.6 / 52 | 11.4 / p95 194 |

(median fps / p95 ms; floors ≥ 60 desktop and ≥ 30 Simulator, p95 ≤ 17.5 / 35 ms.) With the row on, Nine's interior
and city hold both floors. The entry travel row misses on both surfaces with the row off as well (the cell's entry
and portal hitch, not the composite); the Simulator row-off run fell on a loaded machine (load average 17-26, push
gates running) and is noise. Results: `progress/frame-floor/d82326179-{38392,48647,55237,66043}-*.json`.
