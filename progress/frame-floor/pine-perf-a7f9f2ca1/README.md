# Pine Hollow desktop headroom (op-pineperf, 2026-10-09)

**Commits:** `a7f9f2ca1` (n8ao pre-pass cuts + bone subtrees hidden from the render walks) and `a66975659` (near animals
whose pose did not change skip the world-matrix pass). Both are bit-identical: no Debug row, no look change.

## What the frame was spending

Probe: [`probe.mjs`](probe.mjs) (op-floor's SF69 probe, standalone Pine, desktop tier, 1440×900 @2 = 2880×1800,
Developer on). Poses: Pine's capture poses (spawn, cabin (−14, −62), pond (−56, 95)).

1. **Pine was main-thread bound, not GPU bound.** The `EXT_disjoint_timer_query_webgl2` timer on ANGLE-Metal spans the
   CPU's command encoding: a scene pass into a quarter-area target "costs" the same (cabin 8.7 → 8.1 ms), and bloom's
   "4–5 ms" was 0.2 ms of real work. Rendered back to back with a sync (`--exp=micro`, `gpuloop`), the whole composer
   takes 9.3–11.5 ms wall at spawn / pond / cabin, of which the scene pass is 6.6–8.7 ms and 5.5–7.8 ms of that is CPU.
   So the GPU has ≥ 5 ms of headroom at 2880×1800; the 16.8 ms "GPU frame" in `../2026-10-09-head/` was the timer.
2. **The render walks.** Every `renderer.render(scene)` recomputes every world matrix (~1.3 ms on Pine's ~4 300 nodes)
   and walks every visible node; n8ao's two transparency pre-passes did both twice more, the shadow cascades walk the
   graph three times, and ~3 400 of the 4 300 nodes are animal bones. The depth-free pre-pass was empty on most frames
   (PH-P2 leans it) but still cleared and depth-copied a 2880×1800 target and re-rendered the scene; n8ao's compositer
   wrote its own 41 MB target and copied it into the output.
3. **The animals' matrix pass** skipped only far, pose-frozen animals (7–13 of 167); 107–161 of the ~157 it updated a
   frame had moved nothing (not ticked by the body scheduler that frame).

## The cuts (all exact)

- `aoTransparency.ts` cut 3: each pre-pass skipped on its own when nothing would draw in it (its 1×1 stand-in).
- cut 4: the pre-pass renders skip the world-matrix walk (`scene.matrixWorldAutoUpdate` off); its one visible side
  effect, the viewmodel's depth clear following what is visible, is kept by `ViewmodelRoot.syncClearer`.
- cut 5: the compositer renders straight into the composer's output buffer (n8ao's copy is a plain texel copy); −41 MB.
- `AnimalGroup`: all-bone subtrees hidden (`visible = false`, still matrix-updated; anything attached shows its chain
  again); a near animal is skipped when every node's position / quaternion / scale (or own matrix) equals its last full
  update's.

**Pixel parity:** same-instant frozen frames (performance.now and the volumetric jitter pinned, `--exp=pixdiff`) of
n8ao's own render with PH-P2's wrapper and every bone shown vs the new path: **0 bytes differ** at Pine spawn, cabin
and pond, Driftwood spawn and Nalati spawn (2880×1800). A bisect found cut 4 first moved 221–747 bytes (the viewmodel
clear); `syncClearer` brought it to 0. The animal skip: a forced full walk right after the scene pass's matched every
animal node's `matrixWorld` (0 differing) at all three poses.

## Before / after

Same page A/B (`--exp=mineab` on a snapshot build with live switches for the cuts; the switches never landed),
quiet window (load 8–10), Developer on, 4 × 120 frames each:

| Pose | work p50 ms | work p95 ms | render CPU p50 ms | timer "GPU" ms |
|---|---|---|---|---|
| spawn | 10.75 → 7.73 | 12.25 → 8.95 | 9.53 → 6.45 | 16.9 → 15.8 |
| cabin | 13.18 → 9.10 | 14.98 → 10.15 | 11.58 → 7.55 | 20.2 → 19.3 |
| pond | 10.35 → 7.83 | 12.08 → 9.05 | 8.88 → 6.35 | 17.3 → 17.3 |

Under load (16–18): work p95 15.1 / 19.7 / 21.7 → 12.2 / 13.2 / 14.2 ms. `a66975659` on top: the scene pass's
matrix walk 1.7 → 1.1–1.3 ms (two interleaved build pairs, load ~40).

**Frame floor** (`scripts/frame-floor.mjs --surface=desktop`, quiet window 19:37–19:41, load 12 → 8 → 10; one rockhop
Blender job held the model lock, CPU only):

| Run | Shard | spawn | cabin | gate | Pass |
|---|---|---|---|---|---|
| `06e10c85a` (before) | Pine | 59.88 fps / p95 16.7 / work 12.2 | 59.88 / 16.7 / 13.7 | 59.88 / 16.7 / 12.8 | PASS |
| `a7f9f2ca1` (after) | Pine | 59.88 / 16.8 / work 9.4 | 59.88 / 16.7 / 11.5 | 59.88 / 16.7 / 8.7 | PASS |
| `a7f9f2ca1` | Driftwood | spawn 6.6, wreck 5.9, pier 6.7 work p95 | | | PASS |
| `a7f9f2ca1` | Nalati | spawn 5.3, bridge 4.9, plains 5.2 work p95 | | | PASS |

JSON: [`../a7f9f2ca1-38287-1791592657011.json`](../a7f9f2ca1-38287-1791592657011.json),
[`../06e10c85a-55737-1791592787183.json`](../06e10c85a-55737-1791592787183.json). Driftwood and Nalati are at or below
op-floor's head readings (8.6 / 7.7 / 8.6 and 6.1 / 5.1 / 5.8 ms work p95): not regressed.

## Left as found

- The remaining scene pass CPU (~6 ms at the cabin): ~1.5 ms shadow cascades (BatchedMesh per-instance culling per
  cascade), ~1.1 ms matrix walk, the rest projection and ~145 draws; Developer's gpuLabels hooks ~0.6 ms (SF64 lane).
- GPU-side candidates measured but not needed: volumetrics at half res, bloom's luminance at half res, SMAA low (each
  changes pixels; the real GPU cost is well under budget).
