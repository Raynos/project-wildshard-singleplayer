# Pine Hollow grid road entry, desktop: PASS (sp-o100, 2026-10-13)

The Pine Hollow grid route failed the desktop frame floor in every run since
10-11 (travel p95 33.3 ms; [milestone receipt](../milestone-2026-10-13/README.md)).
It now passes. The fix is `6f634c96f`: live shader warm-ups on desktop end
their slices at 6 ms.

Settings: `scripts/frame-floor.mjs --shards=grid --surface=desktop
--grid-scenario=milestone --devserver --grid-routes=pine-hollow-road-entry
--frame-timeline`. Desktop Chromium on Metal, 1440×900 at 2×, Developer ON,
build pacing ON. No quiet window: other lanes kept running (the load average
reached 13 during the last run).

| Run | Pin | Travel p95 / max ms | Travel frames > 20 ms | Drive p95 / max ms | Interior p95 ms (work p95) |
| --- | --- | ---: | ---: | ---: | ---: |
| before | `bda180fc4` | **33.3** / 50.1 | (no timeline) | 16.8 / 50.1 | 16.7 (9.7) |
| before, profiled | `f715af5fa` | **33.3** / 50.1 | 10 / 120 | 16.8 / 66.6 | 16.7 (9.3) |
| before, GL-timed | `0c0dc723d` | **33.3** / 50 | 14 / 120 | 16.8 / 50 | 16.7 (10.7) |
| fix candidate | `3c852fcb7` | 16.8 / 33.4 | 4 / 120 | 16.8 / 49.9 | 16.8 (11.0) |
| fix candidate | `3c852fcb7` | 16.8 / 50 | 3 / 120 | 16.8 / 50 | 16.8 (8.2) |
| landed, profiled | `6f634c96f` | 16.8 / 50 | 5 / 120 | 16.8 / 50 | 16.7 (8.7) |
| HEAD after | `928d6a44e` | 16.8 / 33.4 | 4 / 120 | 16.8 / 50 | 16.7 (9.6) |

A 120-frame row fails p95 once 7 of its frames run long, so the fixed route
has a margin of 1 to 3 frames.

## Where the travel window's time went

Game work in the travel window was only 3–7 ms. The double-vsync frames
came from Pine's runtime build running between frames on the road. The
in-page task clock and a CPU profile attributed each one:

- **The entered frame's shader warm-up** (`warmEnteredFrame` → `precompileLevel`):
  5 of the 10 long frames in the profiled run. Desktop does not isolate its
  uploads, so each slice ran past the 12 ms box, which is checked only after
  each unit. The units were a six-material compile job (20–25 ms), a first link
  query (`getProgramInfoLog` 15 ms) and a 1024² upload (about 9 ms). That cost
  came on top of the frame's game work. **Fixed:** a live warm-up that does not
  isolate now uses one material per job and ends each compile, resolve and upload
  slice once it passes 6 ms.
- **Single build units that are 15 ms or more**, still present:
  - Pine's ranged kit: Crossbow hands 22 ms, then the longbow's stave and
    sleeves 18–41 ms (`nalatiArms.riderArm` and `computeVertexNormals`).
  - The first deer herd's model: `AnimalFactory.model` / loft, 23 ms.
  - The quest install with its NPC rigs: 19 + 11 ms.
  - A terrain array layer copy: `texSubImage3D` 1024², 23 ms.
  - Prop convex-hull colliders: 7–8 ms with a terrain punch.
  Each of these is atomic today. Cutting them means baking or splitting the
  builders (Pine's generator port, sp-x4) or slicing them in the engine.

## Simulator (one run, `6f634c96f`)

The Simulator is unchanged, as expected, because the WebKit path already
isolates its uploads. Travel p95 is 55 ms and the drive max is 132 ms, a FAIL.
This matches the milestone receipt's 55–62 ms. 21 of the 120 travel frames
are over 40 ms, while game work is 3–10 ms. The long frames are build
continuations after paced frame waits, of 20–68 ms each. The worst one is
Pine's `world` hook: a 60 ms synchronous `getProgramParameter` on a
ShaderMaterial. Safari profiling is needed to name the builders. That work
remains open.

A second Simulator run at `928d6a44e`, with `--safari-profile`, read travel
53 ms and drive max 101 ms, still a FAIL. Its Safari samples over the whole
drive, as a share of 4,743 (untimed, so weights only):

- The entered frame's warm-up: 9.3 %, almost all `texSubImage2D` image
  uploads.
- The grid session's update: 6.5 %.
- The cell screens: about 7 %. The once-a-second canvas re-upload of the
  loading clock was 3.7 %, painting 3 %, and rebuilding and stringifying the
  unchanged content every frame was 1.4 %. That last part is removed by
  `1682e5ec9`.
- Parked draws: 2.7 %.
- Pine's builders, each about 1 %: the kit, the herds, the quest and the
  cabins.

The next owned Simulator step is the warm-up's image uploads. Pine's desktop
images are 1024² and 2048² bitmaps. On the phone tier they go through the
8 ms `LIVE_UPLOAD_BUDGET`, one painted frame each.

[summary.json](summary.json) holds every run's Pine rows. Raw results and
profiles stayed in scratch and were deleted.
