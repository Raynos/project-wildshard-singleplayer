# grid-base: why Pine costs ~425 MB more in the grid than standalone (E435, SF47-g follow-up)

2026-10-08, grid-base builder (Opus). Source: a clean export of `5234da7b8` (build `5234da7-mv02j9ih`), phone tier, 2×,
Developer ON, Memory saver ON, Auto textures, muted. Decimal MB. **No game code changed in this lane.** The finding is
mostly about the ruler, and a cut can't be priced until the ruler is fixed.

## 1. Most of the "page overhead" comes from the native ruler's own census

`g227-budget/native.mjs` reads the kernel footprint at a pose, then evaluates `snapshotExpression` in the page. That
expression walks the scene and every texture and buffer, labels the GL census and builds the residency report. The walk
allocates **175–300 MB of WebContent at home and 50–180 MB at Pine entry**, and WebKit keeps it. The next pose's
"settled" reading starts from that level. Here is the per-phase trace of the game's WebContent pid (`jump.py`; *pre* is
the settled reading 6–9 s into the phase, before the census; *end* is the phase's last sample, after the census and vmmap):

| Run | Home pre → end | Pine entry pre → end | Pine centre pre (the reported number) |
|---|---|---|---:|
| sf47 `8cfe4cc67` cold-01 | 518 → 739 | 764 → 904 | **904** |
| sf47 cold-02 | 563 → 824 | 777 → 887 | **885** |
| sf47 cold-03 | 539 → 832 | 757 → 872 | **870** |
| this lane `5234da7` cold-01 | 541 → 842 | 797 → 849 | **847** |
| this lane cold-02 | 555 → 728 | 717 → 895 | **893** |

In **5/5 runs, Pine centre's reading equals the entry's post-census level to within 2 MB**. The SF47 grid figure
(1,116 MB = 885 WC + 231 GL) therefore carries every earlier census's residue. The standalone protocol it was compared
with (`sim-memory.mjs` on the Simulator plus GL from Chromium) runs no in-page census. **The 425 MB isn't a like-for-like
difference.** The pre-census entry reading (757–797 WC, about 990–1,030 with GL) is also inflated by the home census,
because the road leg only partly reuses the freed pages.

The corrected ruler is [native-final.mjs](native-final.mjs): the same route and samples, with the census only at the
final pose (`G227_CENSUS_AT`, default `pine-hollow-centre`). Three cold runs on the same build are queued behind another
lane's Simulator lease. Run them with
`NATIVE=progress/memory/grid-base/native-final.mjs`, through `scripts/browser-lane.sh scripts/sim-lane.sh run wildshard-iphone node $NATIVE <base> <out> <dist> pine-centre on`,
on a `serve-build.sh --head` preview, and compare with `arms.py`. Until that table exists, no grid-vs-standalone overhead
figure is trustworthy. That includes SF47-g's "Pine is 116 MB over".

## 2. What the grid really keeps over standalone (Chromium, after a forced GC)

Source: [chromium-5234da7/](chromium-5234da7/) (`drive.mjs` run through `browser-lane.sh`, iPhone 16 Pro, muted, a
`plain.html` copy with no harness instrumentation). Three forced GCs per pose, then `Runtime.getHeapUsage` and the SF64
ledger `__wildshard.memory()`. Heap snapshots were taken at both centres (kept out of git: 323 MB and 237 MB).

| Pose | JS heap | Ledger RAM | Ledger GPU |
|---|---:|---:|---:|
| Grid home (Driftwood) | 69.3 | 138.1 | 179.5 |
| Grid Pine entry | 128.2 | 227.7 | 232.3 |
| **Grid Pine centre** | **129.6** | **260.6** | 230.1 |
| **Standalone Pine centre** | **88.0** | **211.6** | 257.4 |

**The live grid-only retention is about 90 MB (+41.6 MB of JS heap, +49 MB of ledger RAM), not 425.** The top owners
are below (`ledger-diff.txt`; Pine's own content is labelled `grid.world:` / `runtime:` in the grid and `level` / `engine` standalone, so
those rows mostly cancel):

| # | Owner (grid minus standalone, RAM) | MB | What holds it |
|---|---|---:|---|
| 1 | Rapier linear memory (`engine/physics` wasm) | +22.4 | 35.4 vs 13.1. Driftwood, road and seam colliders grew it at home, and wasm memory never shrinks |
| 2 | Retired Driftwood world: `grid.world:driftwood-isle` | +21.7 | see the retainers below |
| 3 | Driftwood models: palms 3.6, bushes 2.6, rocks 2.2, trailside 1.4, pier / jetty / cove / lookout 1.5 | +11.3 | the same retainers |
| 4 | `engine/loadRigFile` (Driftwood's captain atlas ImageBitmap, 4.2) | +4.7 | the rig parse is kept after upload |
| — | JS heap (objects) | +41.6 | road, seams, signs, catalogue, the frozen home's world graph |

The GPU side of the retired Driftwood world is freed (0 MB), so only its CPU copies stay. Retainer paths in the grid
heap snapshot (`driftwood-retainers.txt`, `ret3.py`):
- **The page's world is Driftwood's world.** `window.__wildshard` → `combat` getter closure → `world.bushes.mesh` and
  `world.ocean.mesh` keep geometry arrays. The borrowed home's world object lives as long as the page, so every array it
  references stays in RAM after the "frozen" home's GPU buffers go. That covers bushes, ocean and similar fields.
- A module-level `WeakMap` keyed by a placed mesh → `{ geometry }` (shore boulders and the island meshes, 9.5 MB). Its
  key mesh is still reachable, so the entry lives.
- The ground-cover `WeakMap` → `cover.group` → InstancedMesh `instanceMatrix` (6.1 MB).
- The `__ws_prefetch.stop` closure → its context's WeakMap → `builtMesh.geometry` (1.3 MB, the SF57 pattern).

## 3. Cuts this points at (not landed: no trustworthy ruler to prove them on)

1. **Fix the ruler first** (`native-final.mjs`, or move the census out of process the way standalone does). This is a
   measurement change only, and it is the largest single item: ~100–180 MB at Pine centre.
2. Release a frozen home's CPU geometry when it retires (≈33 MB RAM): drop the world fields above, or rebuild Driftwood
   on return instead of re-uploading. This is a design call, because the frozen home re-uploads from these arrays today.
3. Rapier wasm (+22 MB) can only be avoided by never growing it: a fresh physics world per resident, or sizing the home's
   colliders smaller. Freeing after the fact does nothing, because wasm memory never shrinks.
4. In-cell presentation (billboards 13.1, signs 6.6, junctions 5.6, screens 7.0 MB GPU) stays visible from Pine,
   because open-plot-nw is in view, so not allocating it inside the cell saves nothing at this pose.

Plan-State: unchanged.
