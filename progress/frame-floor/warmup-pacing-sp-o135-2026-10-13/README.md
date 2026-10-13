# Entry warm-up pacing margin on the Simulator (sp-o135, 2026-10-13, G407)

**Not landed.** I built sp-o134's pacing spec in `src/engine/render/precompile.ts` and measured it. It showed no
measurable gain over the base it was built on, and one of its two credited Sky runs missed the travel gate (p95 36).
Under the brief, no code ships. The candidate is kept here as `candidate.patch` (against `1ad788a64`) for whoever
takes this up next.

## What the candidate does (`candidate.patch`, pure pacing, the same programs)

1. **One program per live job.** With `per` 1, `sceneJobs` gives each wanted material of an array-material mesh its
   own stand-in. Sky's road has no such mesh: the job count stayed at 359. The MeshLambert pair that sp-o134 saw is
   three's **two-pass transparent DoubleSide** compile. `prepareMaterial` issues a BackSide program and a FrontSide
   program in one `compile()` call. The candidate gives each side its own job through `CompileJob.side`. The side is
   set and restored inside the job's own synchronous task, the same way three does it. On Sky this made 372 jobs, with
   the same 71 programs (54 scene-entered, 8 scene-other, 7 family, 2 shadow).
2. **Settle on the next drawn frame.** The live slice now queries only programs issued before the drawn frame that
   released it, and it queries at the start of the slice, before it issues the next compile. Phase B waits one frame
   if the compile stage's last slice has already queried a program.
3. Focused tests (17 files, 110 tests) passed with the updated expectations. Each query now lands one frame later.

## Runs (Simulator Safari `frame-floor-iphone-17-pro`, phone tier, 2×, 30 fps cap, Developer ON, build pacing ON)

`scripts/frame-floor.mjs --shards=grid --grid-scenario=milestone --grid-routes=far-reach-road-entry --devserver
--surface=sim --rev=<sha>`. All runs are plain, and the load at the start of every run was ≤ 8.

| Run | Build | Travel p95 | Drive p95 / max (> 50 ms) | afterPlay > 50 ms | Warm-up compile / link / total |
| --- | --- | ---: | ---: | --- | ---: |
| C1-a | cand 1 `66f07ab69` (array split + next-frame settle) | **38** FAIL | 34 / 125 (14) | 8× (max 106) | 2171 / 599 (17) / 3661 ms |
| C1-b | cand 1 | 34 | 35 / 79 (5) | none | 2155 / 431 (12) / 3544 ms |
| C2-a | cand 2 `90c833f89` (+ side split) | **36** FAIL | 34 / 67 (5) | 1× 54 | 2386 / 198 (5) / 3458 ms |
| C2-b | cand 2 | 35 | 35 / 73 (4) | none | – |
| B | base `1ad788a64` | 34 | 35 / 70 (5) | 1× 52 | 2153 / 433 (13) / 3450 ms |
| sp-o134 R1 | `9645df9bf` | 36 | 34 / 109 (9) | 1× 64 | 2173 / 566 / – |

The `spawn` pose failed in most of these runs (p95 36–43), on base and candidate alike. That failure belongs to
sp-x7's content-cache fix.

**Standalone floors, candidate 2 against base `1ad788a64`:**

- Simulator, default set (all 7 shards plus the templates): every row passed on both builds, with no p95 worse.
  Nine Dragon's `well-edge` max was 85 ms on the candidate, 41 ms on a candidate rerun, and 34 ms on base. That is
  one-frame noise at most, but it never beat base.
- Desktop: every row passed on both builds, all at p95 16.7–16.8 and max 16.8. The standalone desktop boot runs
  with `per` 6, so this code does not run there.

## Reading

- On the base build the warm-up already causes no slow frames on this route. Base B had a single 52 ms afterPlay
  frame, and the frames over 50 ms are the Sky build (`world`, `play`, `activate`), which belongs to sp-x5.
- Moving the settle to the next frame shortens the link stage (433 → 198 ms, 13 → 5 programs left over). It does
  not shorten the whole warm-up (3450 → 3458 ms), and it does not move travel p95. The query now shares a slice with
  the next compile, so that slice carries both costs. C1-a's eight afterPlay frames came during parked draws (883 ms
  against 411 ms in the other runs), and they did not recur.
- The side split works as designed (one program per job), but the one 61 ms frame it targets came from sp-o134's
  diagnostic run. The plain runs never showed it.

CALL: I did not land the code, because travel p95 was 36 in one of the two candidate runs against 34 on base, with
no offsetting gain. I extended spec item 1 to two-pass side variants, since the array split alone never fires on Sky.
Raw JSONs stayed in scratch and were deleted. These are Mac-backed Simulator Safari readings and make no claim about
a physical iPhone.
