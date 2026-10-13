# Sky Reach entered-frame warm-up on the Simulator road (sp-o134, 2026-10-13, G407)

**The warm-up is already well paced. It is not what fails the Sky road travel row.** In the 120-frame travel window
of the diagnostic run, 75 frames fall inside `far-reach:afterPlay` and only 4 of them read over 35 ms (42, 61, 38 and
41 ms). The window's other slow frames are in the Sky build: 3 in `world` (53, 41, 42) and 1 in `play` (100). The
texture uploads and parked draws finish after the window ends. On `66ca64cf7` (sp-x5's keeper bake and 4 ms scope
pacing), sp-x5's two plain runs pass the Sky road (travel p95 34 / 34, drive max 73 / 86). No pacing change was
built in this lane. The one commit is the diagnostic `861f87d7d`: the warm-up's stage trace now counts new programs
per job kind and records the image bytes it uploads.

Settings: `scripts/frame-floor.mjs --shards=grid --grid-scenario=milestone --grid-routes=far-reach-road-entry
--devserver --surface=sim`, plus the standard settings (Simulator Safari on `frame-floor-iphone-17-pro`, phone tier,
2×, 30 fps cap, Developer ON, build pacing ON). Load is the 1-minute average at the start and end of each run.

| Run | SHA | Credit | Load | Sim travel p95 / p99 / max | Drive p95 / max (frames > 50 ms) | Long-frame hooks |
| --- | --- | --- | ---: | ---: | ---: | --- |
| R1 | `9645df9bf` | plain | 5.8–12.0 | **36** / 48 / 109 | 34 / 109 (9) | world 5× (max 88), play 109, activate 75, afterPlay 64, beforeWorld 61 |
| D1 | `861f87d7d` (has `66ca64cf7`) | `--gl-time --frame-timeline --task-clock` | 19.3–8.1 | **41** / 61 / 100 | 34 / 100 (6) | world 3× (max 69), play 100, activate 73, afterPlay 61 |
| sp-x5 ×2 | `66ca64cf7` | plain (relayed) | 15.6–27.8 | 34 / – / – and 34 | 34 / 73 and 86 | afterPlay 58 in run 1, none > 50 ms in run 2 |

R1's home spawn pose read p95 40 (FAIL), which belongs to sp-x7's content-cache fix (see `spawn-sim-sp-o132`). D1 is
a diagnostic run, so its timing earns no credit: the task clock and GL wrappers add main-thread work.

## Attribution (D1)

- **The travel window is mostly afterPlay.** The window ran from 38.94 s to 43.04 s. Sky's hooks were: `world`
  38.25–40.15 s, `play` 40.18–40.50 s, and `afterPlay` 40.50–44.63 s, then `activate` at 45.67 s. Its frames by hook
  were 36 in world, 1 in afterKit, 8 in play and 75 in afterPlay.
- **The warm-up's stages** (`Game.entryPreparation`): compile took 2168 ms over 359 jobs, link 433 ms (13 programs
  still pending), upload 969 ms (63 textures), and parked draws 537 ms (218 drawables), about 4.1 s in all. R1 matches
  this (2173 / 566 / 968 / 541 ms). The compile stage alone covers the rest of the window. Link, upload and parked
  draws ran after the window ended.
- **69 new programs, nearly all of them real Sky content.** By kind: 54 `scene-entered` (Sky's own materials under
  its lights), 8 `scene-other` (page content compiled under Sky's lights), 7 `family`, and 2 `shadow`. There were 0
  `previous-shadow`, 0 `exterior` and 0 `post`. Nothing deferrable stands out: fewer programs would mean fewer
  distinct Sky material variants, which is a content change.
- **Parallel shader compile is present on the Simulator.** The afterPlay GL counts include COMPLETION_STATUS polls
  (290 `getProgramParameter` calls for 69 programs, where `onFirstUse` makes 3 a program), and three only polls when
  the extension exists. The live WebKit path already issues one program per drawn frame and isolates uploads.
- **The 4 slow afterPlay frames:**
  - 40.52 s, 42 ms: the first game frame after `play`. It is a 32 ms synchronous game rAF, plus the warm-up's
    22 ms setup task (the scene walk and stand-in clones for 359 jobs) just before it. Neither is a compile.
  - 40.85 s, 61 ms: one 50 ms warm-up continuation task. A single job issued **two** programs (a MeshLambert pair
    from one array-material clone). One `getProgramParameter` then blocked for 20 ms in the same task.
  - 41.34 s, 38 ms and 41.77 s, 41 ms: 8–10 ms game rAFs, each with a 16 ms precompile slice.
- **Textures.** 63 textures moved 124,608 KiB of decoded image data (about 122 MiB with the mip estimate). The 70
  `texSubImage2D` calls took 186 ms of main-thread time. That includes 20 ImageBitmaps of 1024², at about 6.7 ms
  each. The slowest single upload was 9 ms. They batch under the 8 ms / 8 MiB live budget and produced no slow frame
  in the drive.

## What would add margin (not built: the gate passes, and it needs a full proof)

This is a rendering-side pacing change in `src/engine/render/precompile.ts` for an Opus lane. It changes no programs
and no order guarantee, and nothing is deferred to first draw:

1. **One material per job on live WebKit.** `sceneJobs` with `per = 1` still puts every wanted slot of an
   array-material mesh into one clone. Split those into one clone per material, so the `LIVE_PROGRAMS_PER_FRAME` cap
   holds for each job. This removes the two-program 50 ms task.
2. **Settle on the next drawn frame.** On a parallel-compile page, poll `isReady()` / `getUniforms()` for program N
   only after the frame that issued it has been drawn, instead of `settleOne()` in the same task. The GPU process
   then compiles behind one presented frame.
3. **Proof:** two plain Sim runs of this route (travel p95 ≤ 35, drive max ≤ 200), plus the Sim standalone floor for
   all 7 shards and the desktop floor, with no row worse. This can ship default-on, since it is pure pacing.

The rest of the window's cost is the Sky build (`world`, `play`), which sp-x5 owns. Raw JSONs stayed in scratch and
were deleted. Mac-backed Simulator Safari: no physical-iPhone claim.
