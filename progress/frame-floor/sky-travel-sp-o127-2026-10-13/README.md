# Sky Reach grid travel: attribution (sp-o127, 2026-10-13, G406 / C1)

**Simulator travel is borderline: 34–44 ms across four runs, gate 35. The worst frame always
passes, at 67–101 ms.** Desktop passes (travel 16.8 / max 50.1). The cost is CPU: Sky builds
on the road in atomic units, and the travel window catches the end of that build. Steady
rendering and texture uploads are not the cause. Nothing was changed in this lane.

Settings: `scripts/frame-floor.mjs --shards=grid --grid-scenario=milestone
--grid-routes=far-reach-road-entry --devserver`, plus the standard settings (Simulator Safari on
`frame-floor-iphone-17-pro`, phone tier, 2×, 30 fps cap, Developer ON, build pacing ON).
The load average was 3–7.

| Run | SHA | Credit | Sim travel p95 / max | Sim drive max (frames > 50 ms) |
| --- | --- | --- | ---: | ---: |
| R1 | `06df3c4c4` | plain | **39** / 97 | 97 (6) |
| D1 | `3797f3f84` | `--gl-time --task-clock` (diagnostic) | **44** / 101 | 101 (7) |
| D2 | `a9f12672e` | `--safari-profile` (diagnostic) | 34 / 95 | 98 (6) |
| R2 | `adb48b6a0` | plain | 34 / 67 | 76 (5) |

In R1 the desktop read travel 16.8 / max 50.1, with one `afterPlay` frame of 50 ms. In R2 the
Simulator's standing `spawn` pose read p95 37. That pose is the home grid spawn, not Sky.

## Where the travel frames go

The travel window is 120 frames, starting one second into the drive. In D1 it ran from
37.44 s to 41.62 s, and it overlaps the hooks that build Sky:

- **Steady per-frame cost is low.** Game work p95 is 7–8 ms and `platform.grid` is 3 ms. The
  interior p95 is 34. Each frame draws 60 calls and 174k triangles.
- **Paced build tasks of 24–31 ms.** In D1's task clock, three `framePacing` MessageChannel
  tasks ran back to back: 31, 26 and 24 ms at 37.41–37.51 s. Each frame then took about 40 ms
  with its 5–9 ms rAF. These are atomic units of `buildWorld`, past the 4.17 ms pacing budget.
  The Safari profile names the work inside the world build:
  - `world/build.ts:115`, 108 samples, including `world/meshes.ts:29`, 68.
  - `runtime/looks/modelIntake.ts` `hdGeometry`, 50 samples. It dequantizes meshopt attributes
    one component at a time and recomputes normals on every visit.
  - `world/skyIsleHd.ts:40`, 35.
  - `world/shapes.ts:72` and `:58`, 40. These are `fitGeometry` runs.
  - `world/trees.ts:25`, 15.
  - `world/crown.ts`, 12.

  These are C1's runtime fits.
- **The `far-reach:play` task runs 67–101 ms in every run, with no GL calls.** Most of it is
  `installQuest`, then the keeper NPC: `game/plugin/geometry.ts` `pivotNpcParts` and
  `partition` (lines 1172–1230). That code de-indexes the model and fills four parts by
  `number[].push` over every attribute, one component at a time, then recomputes normals.
- **Precompile timeouts of 13–21 ms** ran at 38.1–38.4 s.
- **Image uploads.** These mostly landed before the window: the panorama (4128×758) took 15 ms
  as one `texSubImage2D`, and two 1024² images in one frame took 11–14 ms. On the Simulator,
  the KTX2 probe sends the HD GLBs to the images path as well.
- **A per-frame save read.** The quest reward's `unpaid()` is polled by the UI `when` each
  frame (`game/plugin/ui.ts:559`). Each call runs `bindRuntimeState.read` →
  `slot.status` + `slot.read` + `migrateLogicalState` (valibot) and took 169 samples over
  the drive. It is small per frame, but it never stops.

Raw results and profiles stayed in scratch and were deleted. Mac-backed Simulator Safari:
no physical-iPhone claim.
