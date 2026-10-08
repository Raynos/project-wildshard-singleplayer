# rt3-crossing: the crossing wait, the camera inside the loading card, the cold start parked at "Weapons · HUD"

Playtest round 3 (`art/playtest/round-3-2026-10-08/`) items (2), (4) and the grid part of (7). Chromium, iPhone 16 Pro,
muted, Developer on, phone tier, 2×, **4× CPU throttle**, built from a clean export of `5b86b0eb8` (before) and the same
export plus this change (after). Route: Driftwood → Pine → Nalati → Sky Reach → Driftwood (re-entry), driven through the
real fixed-step road hover (`scripts/frame-floor-grid.mjs`'s route runner), sampled at 10 Hz with every frame gap and
long task (`crossings.mjs`; `analyze.py` reads `result.json`).

## (4) The camera inside the loading card: fixed

- **Why it came back:** `f3bf8c0cd` (SF18b) kept an *opened* cell's screen in LOADING while its entered hooks finish. The
  screen's placement still assumed a closed cell (24 m inside the soft wall, facing the road, 2× near scale), so once the
  wall opened the traveller walked through the panel and the camera sat inside it for the hooks' whole 5–14 s.
- **Fix (`src/game/grid/cellScreen.ts`):** a cell the traveller's feet are inside never wears a screen. The screen is the
  face of a closed cell seen from the road; past the wall you see the world.
- **Test that would have caught it** (`test/grid-cell-screen.test.ts`, the sweep): the feet go from the road through the
  soft wall into a cell that stays LOADING; every visible panel must keep the feet > 8 m on its front side (a trailing
  camera is on the road side too), and the entered cell must show none. It fails on `5b86b0eb8`.
- **Measured:** rows (10 Hz) with the traveller inside the target cell *and* its screen up:

| crossing | before run 1 | before run 2 | after |
| --- | ---: | ---: | ---: |
| Driftwood → Pine | 0 | 114 (11.4 s) | 0 |
| Pine → Nalati | 40 (4.0 s) | 0 | 0 |
| Nalati → Sky Reach | 0 | 26 (2.6 s) | 0 |
| Sky Reach → Driftwood | 0 | 19 (1.9 s) | 0 |

## (7) The cold grid start parked at "Weapons · HUD": found, freeze cut

- **What it waits for:** not weapons. The label is the last boot step; the work is `GridSession.create` →
  `generatePlatform`, the 40 road strips' seam lattices (`seamLattice` / `seamError`), built in **one main-thread task of
  9.9–11.8 s at 4× CPU** (CPU profile: 10.3 s of a 13.9 s window), then the road look install (`installPlatformRoad`,
  `roadLookPlatform` / `roadCull`, ~2.3 s).
- **Fix:** `generatePlatformSliced` (`src/engine/sim/strips.ts`): the same generator, strip for strip, with a paint
  between slices (`yieldGridAdmission`); `create` builds the strips sliced and hands them to the constructor.
  `generatePlatform` is unchanged (same output; a test pins sliced = whole).

| cold grid start (4× CPU) | before | after |
| --- | ---: | ---: |
| click → control | 23.9 s | 24.1 s |
| longest main-thread task | 9 883 ms (11 831 ms in a second run) | 3 023 ms |
| long tasks > 100 ms in the step | 2 | 16 (strips ~1 s each, the road look 3.0 s) |

The total is unchanged: the work is the same, it no longer freezes the page. Left: the 3.0 s task is the road look
install in the constructor, and a heavy strip is still one ~1 s task at 4× (a strip never splits).

## (2) The crossing wait: measured, not cut

Wait = from the feet 8 m from the target cell's edge to gameplay ready inside. Phases: the world build (admission and
`create`, which starts at the ~7.4 m readiness reach), the commit, the walk to the interior, and the entered hooks.

| crossing (4× CPU) | wait before (run 1 / 2) | wait after | longest freeze before | longest freeze after | owner of the wait |
| --- | ---: | ---: | ---: | ---: | --- |
| Driftwood → Pine | 16.9 / 17.1 s | 16.6 s | 517 ms | 517 ms | hooks 13.5 s: world 4.8, afterKit 2.6, play 1.3, afterPlay (warm) 4.2 |
| Pine → Nalati | 13.6 / 14.2 s | 13.5 s | 2 117 ms | 2 083 ms | hooks 10.2 s: world 7.7 (outcrops paint 1.5 s, world build 1.25 s tasks) |
| Nalati → Sky Reach | 6.7 / 15.9 s | 8.7 s | 5 233 / 6 916 ms | 4 350 ms | world 4.3–5.6 s; the freeze is a **synchronous program link** |
| Sky Reach → Driftwood | 7.1 / 8.8 s | 7.2 s | 800 ms | 783 ms | world 3.5–4.1 s |

- Every crossing spends 0.3–2.9 s building the world at the wall, ~1 s walking in, and the rest in the entered hooks,
  which only start at the interior (`HybridRuntimeSession.enter` on the interior event).
- **The Sky Reach freeze** (6.9 s at 4× in the profiled run, Safari's 1.8 s): the first composer frame after gameplay
  ready, `WorldRenderPass` → `renderBufferDirect` → three's `getUniforms` → `getProgramInfoLog`, i.e. a program that
  `warmEnteredFrame` did not compile, linked synchronously.
- What would cut the wait (not done here; each is in files other lanes are editing, or shard code): start the entered
  hooks at the commit instead of the interior (~1 s); slice Nalati's world build (`outcrops.ts`, `world/index.ts`);
  find the Sky Reach program the entered-frame warm misses; Pine's 4.2 s `afterPlay` warm.

## Files

- `crossings.mjs` (the drive), `analyze.py` (the table), `coldprobe.mjs` (the cold start, with a CPU profile),
  `prof.mjs` (a CPU profile's longest tasks through the build's source maps).
- `before*.json` / `after.json`: the drives, rows thinned to 2 Hz; `*.txt`: `analyze.py`'s read of each.
- `cold-before.json` / `cold-after.json`: the cold start's step line and long tasks.

## Proof (after = `5b86b0eb8` + this change)

- Full vitest on a clean export (generated files regenerated inside it): **939 files, 5 401 tests passed**.
- Boot smoke (`scripts/parity/boot-smoke.mjs`, including grid mode's E463 spawn-overhead check): standalone Driftwood
  PASS 10.6 s, standalone Pine PASS 12.8 s, grid PASS 15.7 s, 0 faults.
- WebKit smoke (`scripts/webkit-render-smoke.mjs`): held items pass; it fails on the Driftwood minimap (27 % / 31 % of
  the disc, min 42 %) **identically on the before build** (round 3's #6, not this change).
- `scripts/physics-baseline.mjs --no-build --mode=walk`: 63 legs, **0 stuck**, 0 grid failures.
- Crossing drives: 0 page errors before and after. Typecheck (`tsc --noEmit`, `tsc -b tsconfig.layers.json`), oxlint on
  the changed files, shard-coupling, ratchet and the pre-commit hook on the private index pass. Layer edges and the
  ratchet are unchanged; the API surface gains one documented function (`generatePlatformSliced`).
