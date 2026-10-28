# Infinite Wildshard loading: mini plan (G619)

**2026-10-27 rulings:** S1, G1 and L16 have landed code; each closes when the plan's one reading at the end passes, no
per-row readings (G780). H3 is an order change: the spawn ring's tiles go first in the tile streamer's order, with no
per-file measuring step (G794). M2 is Jake's phone check and stays in the % (G779); the official Simulator reading runs
once at the end (G777).

**Jake's picks (G622):** D1 a 3 s reveal any touch skips · D2 superseded by G626: the home shard streams by its 8 × 8 baked tiles, spawn tile + ring first, the rest nearest-first (H3 = spawn view first by tiles) · D3 home first, neighbour placeholders (far proxies) for the descent · D4 no frame over 100 ms after controls.

Jake, 2026-10-22 (G619): players start **inside their home region (Driftwood), made faster**, not on the road. Target
**tap → controls under 5 s warm and under 15 s cold** on the Simulator / phone tier, every step budgeted, measured with
the same recording before and after. Grid loading stays in-world after the loader (G578). G618's five fixes are the
first rows.

**"Controls"** = the first frame where a stick or tap moves the player (today: the reveal's end, `__wsReveal.endedMs`).
**Baseline** = round 40 Simulator recording on live ec4ca6f85 (`art/grid/round-40-sim-grid-entry/`), iPhone 17 Pro
Simulator Safari, Developer on: cold 35.8 s, warm 18.6 s tap → controls. About twenty loading commits have landed since (to abc3e8ff16)
(listed in the budget's last column); none has been measured on the Simulator yet, so row M1 re-baselines first.

## 1. The budget (seconds, tap → controls)

| # | Step (loader row) | Warm budget | Warm today | Cold budget | Cold today | Landed since ec4ca6f85 that should already move it |
|---|---|---:|---:|---:|---:|---|
| 1 | Tap → loader painted | 0.2 | 0.1 (Sim); phone: visible freeze | 0.2 | 0.1 (Sim) | b0aa47b827 (page routes before the 3.2 MB game graph) |
| 2 | 1 · Application modules | 0.3 | 0.44 | 0.5 | 0.47 | b0aa47b827 |
| 3 | 2–8 · admission, region world, renderer, HUD, gameplay | 0.3 | 0.28 | 0.6 | 0.55 | none |
| 4 | 9 · World assembly (25 cells, 96 seams, road) | 0.6 | 2.8 | 1.0 | 1.9 | 675c5e83c3 (baked edges), 5932b6eca5 (road beside steps), 8a8facb65e (no prefetch on the cache queue) |
| 5 | 10 · Title art · explore | 0 | 0.01 (phone 13.8, one 10.8 s frame) | 0 | 0.01 | 99f142d942 (skipped in grid mode), dd590b3552 |
| 6 | 12 · Home region (Driftwood) | 1.5 | 4.8 | 8.0 | 22.1 | 8a8facb65e (prefetch after play), 968a93abe6 (no page re-hash), 27ca9a9f42 + 380be0bbfa (warm-ups leave shaders), 0c16f57471 |
| 7 | Gaps + pass-2 steps (13–15) | 0.2 | 0.58 | 0.4 | 1.25 | none |
| 8 | 16 · Shaders (161 programs) | 0.8 | 2.1 | 1.0 | 2.0 | e4b4e1a847 (drawn only), 6c4b4e33e0 + 92bba7c1ba + ae8ed1fd6a (node-build reuse on); c862a20fa4 (shared programs, default off) |
| 9 | 17–19 · First frame, audio, 250 ms fade | 0.4 | 0.4 | 0.5 | 0.35 | 2416aec1a4 (no broken frame; canvas hidden until the reveal draws) |
| 10 | Reveal → controls | 0.5 | 7.0 (path 7.0, rings 2.3) | 0.5 | 7.0 (rings 3.4) | none |
| | **Total** | **4.8** | **18.6** | **12.7 (+2.3 margin)** | **35.8** | |

Reading: warm is the reveal (7.0 s fixed, `reveal.ts:53` `PATH_S = 7`) plus the home region, assembly and shaders.
Cold is the home region (22.1 s, with "4 in flight": `worldScenes.ts:168-172` reads placements in windows of 4, each
waiting for the slowest, beside the grid prefetch's 434 cache writes on the same serial worker queue). Warm assembly
(2.8 s) was slower than cold (1.9 s) because the warm prefetch's ~4,000 cache checks queued ahead of its edge reads.
Chromium 4x warm on HEAD: tap → play 13.0 s region start (STATE), 4.7–5.0 s road start (so ~8 s of that is the home
region and its shaders).

## 2. Rows

Lanes: one Opus lane (graphical: what the first frame and the reveal show) and two Codex lanes (engineering).
Slices land on Chromium 4x quick checks; the Simulator recording (M1) runs per wave (milestone), the iPhone once at
the end (G558). Numbers go in commit messages (G506), no receipts.

| Row | What | Code (HEAD) | Saves warm / cold | Lane | Size | Done when (re-recorded) | Deps |
|---|---|---|---|---|---|---|---|
| **M1 — done `dd2f3010a1`** | The recording as a script: commit the round 40 driver (`drive.mjs`, `board.py`) as `scripts/sim-grid-entry.mjs`; served build (`serve-build.sh --rev`) or live; cold reset + warm; 3 runs, medians; logs tap → loader paint (video), each step, loader end, reveal start, controls, worst frame, and a broken-frame check (frame diff against the loader / world). Re-baseline HEAD first. | scratch `sim-grid-entry/drive.mjs`; `scripts/sim-lane.sh` | 0 | Codex | 0.5 d | HEAD baseline cold / warm committed in its message | none |
| **X1 — done `abc3e8ff16`** | Jake picked the home start: the 'Start of play' Debug row and the road-start branch are deleted (E451) | — | 0 | — | — | done | — |
| **C1 — done `9336ce0d6e`, `3bceedea2a`** | G618 (3): cache reads never wait behind writes: the worker's one `tail` queue becomes a read lane plus a low-priority write lane (pins still precede their puts); cold first-play bytes build from the network response, the cache put follows off the critical path | `engine/boot/contentCache.worker.ts:29-41`, `contentCache.ts` | 0.5–1 / 2–5 | Codex | 0.5 d | warm Home region ≤ 3.5 s, cold ≤ 15 s | M1 |
| **H2 — done `000dee773d`** | Home reads issued up front: one bounded pool (~16) over the home load's declared file list at section admission, replacing placement windows of 4 and the serial catalogue / weld / recipe / packet awaits | `game/shardfile/worldScenes.ts:100`, `:136`, `:165-172`, `:205`, `:213` | 0.5–1 / 4–8 | Codex | 1 d | cold Home region ≤ 10 s | C1 |
| **H3 — open: 4.107 s warm against 1.5 s; 4.572 s cold against 8 s (G807 reading `73f31036ee`, source `bccae5dc23`)** | Spawn-critical home first (D2, G794), order only: existing terrain/collision foundation, arrival tile, clipped ring, then unchanged entryways before broad render demand. No new bytes or per-file measuring phase; preserve the pier/spawn contents in their declared tiles | `shardfile/tileContent.ts`; existing `grid/liveSession.ts` foundation | 1–2 / 4–8 | Codex | 1.5 d | warm Home region ≤ 1.5 s, cold ≤ 8 s; no pop-in in the reveal / spawn view | H2, D2 |
| **H3.1 — done (G807 source slice `469841245c`; own `9d6f78f19d` Chromium4× cold/warm controls/movement/errors0; parent timing OPEN)** | Request and finish the spawn tile/ring before broad coarse coverage, preserving parent-first reads, full coverage readiness and retirement. Touched game/test types + named typed lint pass under G769; Far-fallback handover is implemented in H3.2; Parent H3 timing remains open. | `shardfile/tileContent.ts` | — | Codex | bounded slice | source ordering only; H3 full acceptance remains open | H2 |
| **H3.2 — done (G807 source slice `efce5d5324`; own `9d6f78f19d` Chromium4× cold/warm controls/movement/errors0; parent timing OPEN)** | Require the spawn ring and declared entryways before entry; continue distant coarse/coverage pins on the existing scheduler while retaining the admitted, child-masked far root. Hide that root only when complete replacement is ready. Missing far fallback and standalone callers retain full coverage readiness. Retirement cancels every pin; no extra scheduler. | `tileContent.ts`, `cellCover.ts`, `grid/session.ts` | — | Codex | bounded slice | touched game/test types + named typed lint pass; already-landed support at `efce5d5324`; no further H3 budget work; own Chromium9d6f78f19d completed; parent timing open | H3.1 |
| **H4 — open: 4.107 s warm against 1.5 s / 4.572 s cold against 8 s (G807 reading `73f31036ee`, source `bccae5dc23`); private shared RGB admission retains all public mutable/frozen-caller refusals; all recorded byte/cadence/control/road checks pass this visit (prior D193/D194 retained); prior own `caa68e9598` Home4.034warm/4.564cold retained; warm detailed-update gap1.033s exceeds1s (D194), no isolated total gain; exact per-ledger module publication cuts sampled accounting CPU 75.6→19.5 ms (declarations 44.5→9.5, URL 38.4→8.6), with no isolated total Home gain over fresh `79b87951a5` 4.328 / 4.486. Original touch/HUD/gameplayReady/movement/road exit-return/errors0 and clear portraits retained. Prior `4cbd731a4f` 4.837 / 4.534, `ee2f1e07d5` 3.796 / 4.391, `94c5660f35` 4.181 / 4.794 and `3a6daff48e` 3.806 / 4.410 retained; no isolated total gain claimed. Private RGB arrays 24660→1701, with original charges. Removed triangle bulk-copy trial had no kernel gain; its oracles remain; compact metadata runs retain every original triangle/corner check; sp-x8 resumed H4 Own critical-path trace `10ec26a930` Home4.005warm/4.274cold; early-whole trial `dc15fcb5a7`/`846b0135cf`, read `1d05f482b0`, Home4.049warm/4.505cold: library join389→18ms and assembly935→555ms, offset by looks170→262ms/scenes739→1020ms; no Home gain, trial withdrawn. Actual figure/template/publication/loan guards remain.** | Home region CPU after C1/H2: profile the warm step (Chromium 4x + Sim) and cut the top three (2,102 colliders, validators, parses) | `engine/models/colliders.ts`, `engine/physics/pieces.ts`, `shardfile/product.ts` / `productCost.ts` | 0.5–1 / 0.5–1 | Codex | 1 d | warm Home region budget met with H3 | C1, H2 |
| **H4.1 — done (G807 source slice `f47b40c9bf`; own `9d6f78f19d` Chromium4× cold/warm controls/movement/errors0; parent timing OPEN)** | Install the exact platform strip collision set in cooperative loading slices before publishing GridSession; synchronous callers retain the prior path. Scope retirement fences every slice, no collision shape/count/order change. Remaining H4: parser/validator CPU cuts and budget measurements. | `grid/session.ts` | — | Codex | bounded slice | touched game/test types + named lint pass; own Chromium9d6f78f19d completed; parent H4 timing open | C1, H2 |
| **H4.2 — done (G807 source slice `65f396768e`; own `9d6f78f19d` Chromium4× cold/warm controls/movement/errors0; parent timing OPEN)** | Use the final regional preparation hook once: it already settles sky, patches every completed material and installs composition. Avoid the redundant full-scene material sweep immediately before it; retain the world-only hook when no final hook exists. Original rendezvous/retirement/refusal controls remain, plus a typed fallback fixture. | `grid/regionalRuntime.ts` | — | Codex | bounded slice | touched game/test types + named typed lint pass; own Chromium9d6f78f19d completed; parent H4 timing open | H4.1 |
| **H4.3 — in flight (reading at plan end, G780), sp-o4: `d09f772361` + `41edbfdd9b`** | The warm step's top three on Chromium 4x (`60be37a2f2`, 4.11 s): (1) the road system 1.07 s, ring-first in A1.2 `d09f772361`; (2) the world-scenes section parsed four times an entry (~186 ms valibot): `parseWorldScenes` keeps each admitted section object's parse (this commit; its readers are read-only); the product preflight's three calls take different objects, left; (3) the strip trimesh colliders, 155 ms, stay whole and sliced (H4.1 `f47b40c9bf`): deferring the outer ones saves ~0.1 s and needs a physics walk, which waits for a buildable main | H4's warm 1.5 s budget still needs H3 (spawn-critical home first) |
| **H4.4 — census (2026-10-27, sp-o4), no cut left in this lane** | What remains of the warm Home region after A1.2 and H4.3, from a Chromium 4x warm profile of `60be37a2f2` (4.24 s; newer SHAs fail the generation stage, D42), road system excluded: (1) strips + seam geometry ~0.87 s, sp-x8's A1 seam phases (in flight); (2) strip trimesh colliders 0.22 s, sliced by H4.1, deferring the outer ring needs a physics walk on a buildable main; (3) product admission ~0.27 s across the home and its neighbours, spread thin: the owned-index walk + clone + hash 0.10 s, three preflights 0.07 s (different objects), tier selection 0.06 s (its two runs differ: the second reads posed-library assets fetched after the first), world-scenes parse 0.04 s (memo landed). No single cut above ~40 ms outside admission's security checks; H4's warm 1.5 s budget rests on A1's seams and H3 | sp-x8 A1, H3 |
| **A1 — open: 0.792 s warm against 0.6 s; 0.846 s cold against 1.0 s (G807 reading `73f31036ee`, source `bccae5dc23`); count-only road preflight retains exact counts/read order/pauses and original LOD golden; sampled preflight64→36ms, no total timing gain; grouped seam split preserves complete channels/indices; sampled seam CPU 68→55 ms, no isolated total gain; numeric guard leaves, private admitted headers/channels and compact triangle runs preserve complete byte/refusal controls; no total timing gain claimed; outer sign worker `7f0c44f74e` qualified in one original phone4x Pine drive (errors0, no main glyph/RG8 paint); drive p95 50.1 ms stays open on sp-o3 retained-world eviction** | Ring-first assembly (D3): before controls only the home and its 8 neighbours' seams, road and far proxies; the outer 16 cells' seams and the phone's 4 near views build in play (in-world, G578); `ringsReady` no longer gates controls | `game/grid/session.ts:309-356` | 1–2 / 0.5–1 | Codex | 1 d | World assembly ≤ 0.6 s warm, ≤ 1.0 s cold | M1, D3 |
| **A1.1 — done (G807 source slice `3c35e29ff7`; own `9d6f78f19d` Chromium4× cold/warm controls/movement/errors0; parent timing OPEN)** | Defer neighbour product admission and the four phone near views until the existing entered boundary; keep far proxies and home tiles available under the loader. Required home preparation is unchanged. Remaining A1: defer outer-16 seam/road construction with collision readiness preserved. | `grid/session.ts`, `session/play.ts` | — | Codex | bounded slice | touched game/test types + named typed lint pass; own Chromium9d6f78f19d completed; parent A1 timing open | M1, D3 |
| **A1.2 — done (this commit; 2026-10-27, sp-o4)** | Render side: the road system builds ring-first. `installPlatformRoadSliced` takes a `within` predicate; GridSession.create builds the home and its eight neighbours' strips and road pieces (within 1.5 pitches of the home cell, the void floor and rail once) before controls, and the outer sixteen cells' once play has begun (`backgroundReady`), in the same scope, slice budget and admission; the two builds join as one road (readouts summed, roots, horizon and overlay light shared). Colliders stay whole. Chromium 4x warm Home region profile at `60be37a2f2`: 4.11 s, of it the road system 1.07 s inclusive (`roadLookPlatform`), ~64 % of it outer-ring cells. Landed on types + lint (G769); a Chromium capture follows (G797) |
| **A1.3 — in flight (reading at plan end; source `46547f8e95`)** | Generate only home-ring seam origins before controls; generate the complementary outer set after backgroundReady or a real distant demand. Retain full neighbour inputs/certification, one flat-fallback choice, exact supplemental native bytes, live recovery sockets and complete regional duplicate colliders. Distant entry and road recovery await outer native readiness; outer road shares that promise. | `sim/strips.ts`, `grid/session.ts`, `grid/liveSession.ts`, `session/finish.ts` | — | sp-x8 | bounded slice | touched engine/game types + lint pass; no runtime or physics qualification under G769 | A1.2 |
| **A1.4 — in flight (reading at plan end); source `982ec20ff4`, sp-x8** | Remove private seam-writer temporary position/index tuples, mapped quad arrays and discarded face-feature records. Keep exact vertex order/arithmetic, colours, winding, final feature intervals and certification; no scheduling or collider change. | `engine/sim/seamGeometry.ts` | unmeasured | sp-x8 | bounded slice | engine/test types, typed lint and scoped ratchet pass; no parity or runtime reading under G769 | A1.3 |
| **P2 — done (source: `bbb262a091`, `21c5ed6dcf`, `1c29026e5a`, `d7e60ec8b8`; timing unqualified)** | G618 (4) rest: pass-2 steps declared up front (fixed step total); product admission pass 2 (0.49 s, 5 schemas) starts during Home region with cached validators; the 0.46 s cold gap after Home region named and removed | `engine/boot/timeline.ts:77-91`; `finish.ts:41-55` | 0.4 / 0.8 | Codex | 0.5 d | rows 13–15 + gaps ≤ 0.2 s warm, 0.4 s cold; step total never grows; source audit confirms fixed pass-2 rows, schema cache, shared loader slices and named road wait; no new wall-time gain claimed under G769 | M1 |
| **S1 — closed as a miss (coordinator, 2026-10-27): Shaders 1.6 s cold / 1.5 s warm against 1.0 / 0.8 on `9738809b3f` (D150, D176)**; was open (plan-end timing miss below); source: code `c7a9b7b458` landed (shared programs on); was in flight (2026-10-27, sp-o4): shared programs on by default since `c7a9b7b458`; M1 Sim on `3a17943f8e` Shaders 5.3 s cold / 2.7 s warm (90 programs), First frame 4.6 / 3.9 s: the step is mostly TSL node builds (main-thread JS, so an overlap with Home region buys little); its cut is grid-ready G717.O4.4 (shared lighting functions), then M1 again. M1 on `aefc7917b4` (after O4.4a/b; other lanes' commits too, one run each, no causal claim): Shaders 4.2 s cold / 1.1 s warm, First frame 4.3 / 0.33 s, controls 18.1 / 11.5 s (from 19.7 / 16.6); M1 on `60be37a2f2` after all of O4.4 (one run each, other lanes' commits too): Shaders 2.97 s cold / 0.94 s warm, First frame 3.48 / 0.25 s, controls 15.6 / 10.1 s; damage list: warm 0.94 > 0.8 s, cold ~2 s of first-time Metal compile over warm** S1 profile (2026-10-27, sp-o3, `8f42a7bcdf`, sp-x9's loading reader, grid boot, phone): Shaders 2.8 s cold / 2.3 s warm (93 programs); TSL node builds 48 / 2,052 ms cold, 46 / 1,584 ms warm. None is a reuse: 33-35 are the first of their key and 13 have no graph shape (7 shadow-depth variants at 5-11 ms; graph looks on the arms, gulls and four skinned creatures at 28-58 ms). Shapes do not repeat at the boot, and the boot already warms only the spawn view (drawnOnly). Each reading is a fresh page that rebuilds every unique program, so the remaining lever looked like a persistent node-build cache across loads. Measured before building it (sp-o3, `4907548a84`, nothing landed): with the census pin, 56 / 56 Driftwood boot builds read shared scene nodes (camera matrices, render and object groups, light nodes) and most make 28-132 nodes of their own in setup, so no build restores from stored code and uniform positions; a hit still runs three's setup, and three registers uniforms only while generating code. Builder stages at 4x (57 builds, 3,148 ms): setup 1,555 ms (54 %), analyze 470 (16 %), generate 828 (29 %), so a code cache could skip at most ~29 % (~0.45 s of the 2.3 s warm step, bar 0.8). The lever with room is setup: the per-build light and shadow nodes (G717.O4.x). S1 open (coordinator, 2026-10-27): no cache; sp-o3 cuts the node-setup hotspots (D150). Cut 1 `d9d909d1e6`: the PMREM environment lookup (three's textureCubeUV, no layout: 47 % of setup nodes) as layout functions; Driftwood spawn setup nodes 153,818 -> 79,249 over 65 builds (-48 %), spawn look unchanged (differences only on moving parts). Re-read on `d9d909d1e6` (one run each, Chromium phone, load ~17, no causal claim): Shaders 1.8 s cold / 1.5 s warm (93 programs; was 2.8 / 2.3 on `8f42a7bcdf`), First frame 2.3 / 0.47 s. Still over 1.0 / 0.8. Cut 2 `9046fffcbd`: the graph lighting stage's sun term as one shared layout function (it lowered again per directional light, each cascade, per build); setup nodes 79,249 -> 71,916 (cuts 1+2: -53 %), 4x stages setup 687 / analyze 204 / codegen 421 ms over 63 builds (were 1,555 / 470 / 828 over 57), look unchanged. Re-read on `9046fffcbd`: Shaders 1.7 s cold / 1.5 s warm (93 programs), First frame 2.5 / 0.48 s. The reader runs at 4x CPU, so node builds are still most of the step; no remaining setup family is over ~14 %. Deferral `141ea5f018` (coordinator: the boot builds what the spawn view draws, the rest after control nearest-first): the boot's drawnOnly leaves the exterior variants and material families to the after-control warm-up, which links nearest-first. Read on `9738809b3f`: Shaders 1.6 s cold / 1.5 s warm, 83 programs (93 before), First frame adds the same 11; programs 113 -> 102 in all; 10 s after control at 4x 56.0 fps avg, p95 34.1 ms, max 154 ms (39.5 / 36.6 / 252 on `9046fffcbd`). Still over 1.0 / 0.8: 14 graph-material programs the spawn view never draws still link before control, from the home entry's complete root inventory (Game.ts warmEnteredRoots: prepareSceneRoots with exterior variants, not drawn-only), sp-o4's boot branch. Corrected: Census on `9738809b3f` with a full turn at the spawn pose: 68 of the 87 programs built before control draw (firstFrame's E153 warm turns build every direction so a first turn never links; no-pop-in keeps them); only ~3 graph materials and 4 small scene programs are never drawn, and placing the camera at spawn before Shaders changed nothing (the turns build the union). The home entry's roots are not a source (it runs before the composer exists). The remaining cost is per program: node setup is about half cut; analysis, codegen and link remain (D176). | Shaders: shared programs (c862a20fa4) on by default after verify; the first frame's programs start compiling (parallel compile) as soon as the spawn view's materials exist, inside Home region | `finish.ts:64-76`; `engine/render/precompile.ts` | 0.8–1.2 / 0.6–1 | Opus | 1 d | Shaders ≤ 0.8 s warm, 1.0 s cold; frames match | M1 |
| **S2 — folded into O4.4 (coordinator, 2026-10-27): O3.1 proved the per-shape pack non-portable (each build reads 20–40 shared scene nodes); three already keeps a layout function's code per renderer, which O4.4 uses** | Warm shader cache: keep each graph's generated code by its graph-shape key (`nodeBuildReuse` key) in the content cache; a warm entry skips the TSL builds | `engine/render/nodes/nodeBuildReuse.ts`, `render/graph/compile.ts` | 0.5–1 / 0 | Codex | 1.5 d | warm Shaders ≤ 0.5 s | S1 |
| **G1 — done (2026-10-27, six Chromium handoffs below): code `2416aec1a4` landed; the plan's one end reading verifies it (G780)** | G618 (5) glitch frame: the reveal now hides the HUD and canvas at install and shows the canvas on the first gated frame (the frame gate stays shut ~0.4 s after the loader until the home is gameplay ready, so the canvas showed the warm-up draws). Verify only; the ~0.4 s closed-gate wait is folded into R1 | `reveal.ts`, `play.ts` | 0 (quality) | Opus | verify | no broken frame in 3 cold + 3 warm M1 recordings | M1 |
| **R1 — done `dddad396cb`** | The reveal per D1 (G622: 3 s, any touch skips; reveal → controls on a touch 0 ms, same event): shorter path, and input live from loader end (a stick or tap takes over); controls no longer wait for `ringsReady` / the road (soft walls hold what is not ready) | `reveal.ts:53`, `:77`, `:127-136`; `finish.ts:116-119` | 6.5 / 6.5 | Opus | 0.5 d | reveal → controls ≤ 0.5 s | D1, G1 (same file, same lane) |
| **T1 — done `96c34b4f33`** (checked on `f9fe8360c5`, Chromium iPhone 16 Pro phone tier 4× CPU, 3 taps: loader on the tapped page 70 / 73 / 96 ms, the next page's own shell 132 / 132 / 151 ms, one blank frame at the document swap; the Simulator reading is M1's) | Tap freeze on the phone: the tap does a full navigation (`travel`); paint the pressed card and the loader shell on the tap, before navigation; check `pageShell` paints before module evaluation | `grid/pageEntry.ts:36-47`; `grid/pageShell.ts`; `index.html` | 0 Sim / 1–3 phone | Codex | 0.5 d | loader visible ≤ 0.2 s after tap in the Sim video (phone at M2) | M1 |
| **M2** (Jake's phone, stays in the %, G779; official Simulator reading once at the end, G777) | Final check: M1 cold + warm on HEAD meets both budgets; then Jake's iPhone check (G558), the only phone step | — | — | coordinator | — | Sim warm < 5 s, cold < 15 s; Jake's word on the phone | all |

Order: M1 first (it also verifies G1); wave 1 = C1, H2, P2, T1, R1 (after D1), S1; wave 2 = H3 (after D2), A1 (after D3), H4, S2.
Expected after wave 1: warm ~6–7 s, cold ~14–18 s. After wave 2: inside both budgets, cold with the least margin
(it depends on H3's critical-set size and the Simulator's network).

## 3. Decisions for Jake (option 1 is Skip when asked)

- **D1 · The sky-down reveal (G98, 7 s fixed).** At 7 s it alone exceeds the warm budget. (a) Keep 7 s, first-ever
  entry only; returning entries land at the eye. (b) **1.5 s descent, controls live from the first frame (any touch
  takes over).** (c) No reveal: the loader fades to the player's eye. Recommend **(b)**.
- **D2 · Driftwood in the first seconds.** (a) Everything before controls (today). (b) **The spawn view and ~150 m
  around it before controls; the rest of the island builds in play within ~10 s, never in view.** (c) Lower detail
  everywhere first, upgraded in place. Recommend **(b)**: full detail where you look, no visible upgrade.
- **D3 · Neighbours at controls.** (a) All 25 cells' seams and the phone's 4 near views before controls (today).
  (b) **Home + 8 ring before controls; outer 16 and near views fill in over the first ~5 s of play** (far, in-world).
  Recommend **(b)**; G607's render-everything stays, just after controls.
- **D4 · Hitches after controls.** Moving work after controls costs frames. (a) No frame over 100 ms in the first 10 s
  (slower entry). (b) **Worst frame ≤ 250 ms in the first 10 s (today 167–217 ms on Chromium 4x).** Recommend **(b)**.

## 4. Estimate

At today's lane count (5 Opus + 5 Codex, mostly on Nalati and CI speed), with **1 Opus + 2 Codex** on this plan:
M1 half a day; wave 1 about 1.5 days; wave 2 about 2 days; **about 4 lane-days, ~2–3 calendar days**, then
Jake's phone check. Warm < 5 s is likely (the reveal is 6.5 s of the 13.6 s gap); cold < 15 s is the riskier half and
hinges on C1 + H2 + H3 together.

### L18 implementation slices (G734, sp-x8 L18.1; sp-x2 L18.2–4)

| Slice | Work | Status |
|---|---|---|
| L18.1 | Typed tier selection before transport and download declaration; matching boot reserve; preserve exact admission, offline re-entry and tier changes. At most one hour. | done (2026-10-24, sp-x8) |
| L18.2 | Explorer, comparison and simulation inputs on demand with real progress; retain each synchronous gameplay reader. | done (2026-10-25, sp-x2): cheap safe cuts `37709250b2` + progress `218118499e`; live assembly and whole-library readers remain synchronous. Further geometry deferral is unsafe; target not met. |
| L18.2a | Trace named-file readers and progress before changing the entry bank. | done (2026-10-25, sp-x2 audit): assembly JSON has a live quest-composition reader and stays admitted. Explorer choices already read selected geometry on demand, but entry still fetches it; model readiness/compare images need G729 progress before further deferral. |
| L18.2b | Drop manifest-only product image copies; live authored URL readers stay unchanged. Protect map/card/host, critical and dependency uses; preserve the descriptor and verified late reads/offline refusal. At most one hour. | done (this code commit): checked DW phone entry 81,240,976 B /314 → 78,344,952 B /299; desktop 93,697,134 B /314 → 90,801,110 B /299 (−2,896,024 B /15 each). Declared blob content, not observed network or time. Exact receipt retains image pixel/wire reserve without fetching duplicate bodies. Focused tests, touched-layer types and typed lint pass. G729 UI progress is still open; no new lazy UI path here. |
| L18.2c | Existing Model Explorer and Compare loads show a spinner and completed preparation counts; stale/closed views cannot be painted by earlier work. At most one hour. | done (this code commit): model/card readiness and comparison-picker/pair decodes drive real task counts, with visible live failures and silent retired-owner cancellation. Engine/test declarations and touched typed lint pass; focused lifecycle/decode cases retained. Entry bytes/files unchanged (0 B /0 files); this is the G729 prerequisite, not an additional deferral or performance claim. |
| L18.3 | Lighter foliage, rocks and protos; variant sheet for Jake before any appearance change. | in flight (2026-10-26, sp-o3; slices L18.3b–e below). Was waits-Opus (2026-10-25, coordinator call): DW remains 78,344,952 B /299 declared phone files, above the ~19.05 MB target. Three largest live GLBs: meshopt raw 16,770,480 → 10,343,748 B, but gzip-9 delivery 5,806,920 → 8,653,016 B (+49%); rejected. Whole-library geometry has live readers, so tile deferral is unsafe. No geometry write; engineering stops here. |
| L18.3b | Rock batches (shore, small) keep exact float32 positions but ship normals as normalized Int8 and colours as normalized Uint16 through the GLB writer's `nativeAttributes` path (the intake restores typed channels): about −45 % raw per vertex; pixel diff against today. At most one hour. | done (e2cac37ae6, sp-o3): shore 6,468,052 → 3,773,580 B, small 4,498,140 → 2,624,464 B (−4.57 MB declared); pixel parity on landed previews (only animation differs; normal shading error < 2/255). |
| L18.3c | The same storage for the foliage batches (palms, hibiscus, reef; `_SWAY` as half floats). At most one hour. | done (7d327e5a88, sp-o3): phone hibiscus 5,000,360 → 3,296,328 B, palms 5,072,980 → 4,122,144 B, reef 1,973,032 → 1,603,440 B (−3.03 MB declared; desktop −6.44 MB); island band identical on landed previews. |
| L18.3d | `world/island/protos.glb` (72 indexed meshes) on the same typed storage. At most one hour. | done (sp-o3, after sp-x1 4870a346fc moved the prototypes to a build-time product outside src): protos.glb 5,302,068 → 2,568,340 B (−2.73 MB declared); exact 8-bit colour + AO, Int8 normals, 16-bit indices. |
| L18.3e | Only if declared bytes stay far above target: fewer-triangle foliage / rocks / protos as a labelled variant sheet for Jake before any appearance change. | done for foliage + rocks on the recommended option (G769; 2026-10-27, sp-o3): phone-tier-only meshoptimizer simplification through @wildshard/sdk/bake/simplifier, desktop untouched. Foliage 0af15f154b (+ red-fix 2896dc0d85): palms 0.08 m, hibiscus/reef 0.1 m; flat toon colours from the nearest source face; phone 9.02 -> 5.38 MB. Rocks 8d1751970e: 5 cm, smooth channels kept, emitted as owned build bytes (rockPhoneProgram.ts, never under src); phone 6.40 -> 2.96 MB. Total -7.08 MB declared. (The earlier storage-only try, a 16-bit grid, gave no brotli wire gain and was not landed.) Protos measured, no cut: simplifying every prototype (islandProtos simplifiedProto, ratio 0) moves protos.glb only 2,568,340 -> 2,563,324 B even at 2 % error (the Blender props are already minimal, their vertices split by AO colour), so no tiered protos file. Board: BEFORE shots taken (pre-cut preview); the AFTER shots and the labelled board art/driftwood-isle/round-20-phone-decimation/ follow once a HEAD preview builds (main currently red on Far Reach / Nalati catalogue, other lanes). |
| L18.3a | World construction reads only `cells[TIER]`; use that same typed choice in admission and compiler totals. Shared/critical/dependency refs still retain either bank. | done (this code commit): phone 84,464,908 B /315 files → 81,240,976 B /314; desktop 96,907,800 B /315 → 93,697,134 B /314. Exact checked production inventory, declared blob content only; no measured network or loading gain. 75 focused cases, format types and scoped typed lint pass. |
| L18.4 | Verify production compression of GLB and BIN responses. | done (2026-10-25, sp-x2): production Driftwood GLB `07cd00fb…` (210,048 B content) and BIN `13fd9051…` (138,228 B) both return HTTP 200 / `Content-Encoding: br` with `Accept-Encoding: gzip, br`; index also Brotli. No server/config change or byte delta. |

## The update pill (Jake, 2026-10-23 09:33, iPhone screenshot on ab93dccfe: *"Pressing the updating button takes forever. I just expected to refresh the page. I don't know why refreshing the page takes so long."*)

The original report described a static "UPDATING…" and a cold-start-length refresh. The current pill
(`src/engine/ui/Update.ts`) paints progress before adopting an installed worker; with none waiting it reloads immediately.
The worker carries unchanged content-addressed packs and installs only the entry shell/static graph. The follow-up below
checks the current larger build gap rather than assuming every unchanged pack downloads again.

| Row | What | Owner | Done when |
|---|---|---|---|
| U1 | **done `d9d068ce7f` (sp-x2 current-build followup; prior sp-x9 proof `f30e0be71c`).** Native Simulator `ff45b6a24` → `f30e0be71c`: adopt 1 ms, reload → inline 471 ms, inline → ready 287 ms, ready → paint 54 ms (813 ms total). Pre-tap install + stale-art inspection 396,522 response-body bytes; update 733,249 (diagnostic injected/uncompressed HTML included). Stale/new 11-thumb decks and 12 unique images valid: the reported 13-card blank state did not reproduce. Template after update 4,365 ms; admission 1,252 ms, max 16 in flight; the phone's 7.3 s / 39-file wait did not reproduce. Measure one tap → title on the new build on the Simulator from a build several deploys old: adopt wait, reload, worker install, boot-pack bytes re-downloaded vs unchanged; include G733 stale `ff45b6a24` / mixed shell-and-assets blank-art reproduction | Codex | the wait is split into its parts, numbers in the commit |
| U2 | **done `d9d068ce7f` (verified unchanged-image alias repair), existing runtime verified at `f30e0be71c`.** Exact U1 update paints the new title at 813 ms (<5 s). Real worker-source regression proves unchanged pack carry/reuse without a fetch and only the changed URL reads; real update-pill regression proves no waiting worker means immediate reload, preserving shard intent. No extra runtime cut warranted. Fix the biggest part: unchanged packs keep their URLs across builds (content-hashed, so only changed packs download), the adopt wait drops when no worker is waiting, the worker's install never blocks the reload | Codex | tap → title ≤ 5 s on the Simulator after a typical deploy |
| U3 | **folded into U4.** The pill keeps showing progress (bytes or steps) instead of a static "UPDATING…" | Codex | no static label for more than 1 s |
| U4 | **done `5716145112`, current-build followup `d9d068ce7f`.** Renderer-free progress `748b5541d2` + handoff proof `f5bb8cec35`; public enablement `5716145112`. Native Simulator old `748b5541d2` → new `f5bb8cec35`: 2,873 ms tap → new title, 15 real phase/completed-file changes, longest gap 253 ms, errors 0. Video shows the modal through reload; new-document state restores before the title. WebKit supplied no transfer sizes here: file steps move and unknown bytes stay explicit, with no elapsed-clock credit. **Update progress screen (G715, E502):** full-screen loading-style modal, real found/download/install/reload phases; an already-installed pack says ready; folds U3 in | Codex | actual progress changes at least every second until the new title; native old-build capture passed |
| L16 | **done (2026-10-27, G777 Chromium hero 96–167 ms; native PWA not claimed): code `ec2447e3fa` + `19a89ae60b` landed; the plan's one end reading is its acceptance (G780); was in flight (sp-x9), source slice done `ec2447e3fa` + `19a89ae60b`:** first-document hero/boat and handoff are shipped; only final inset cold-PWA acceptance remains. Prior native capture paints the hero at ~0.58 s with no post-hero blank; the rounded Springboard expansion remains explicit, not a zero-black claim. **Launch black screen (G716, live regression, first):** a cold home-screen launch shows black ~7 s before the title. Bisect when the instant hero stopped painting (`title-first` hides the first-paint panel until the title's JS runs), fix forward; then paint the title hero + a boat progress bar inline from `index.html` (no bundle) until the title mounts | Codex | Simulator cold PWA launch paints the hero within ~0.5 s and never shows black; the regression commit named in the fix |
| G733 | **done (2026-10-25, sp-x9), badge fix `94ef588da9`.** Shared `1138f0564c` phone WebKit: at 1.002 s the hero/card and all 11 thumbnails paint, all seven badges fit; 12 image URLs valid. Native Developer-on cold PWA also has all 11 thumbs at 1 s. No image culprit claimed; Jake's stale 13-card blank state carries into U1. | Codex | shared-preview badge acceptance passed; U1 source-aged stale-shell check did not reproduce blank art |
| L17 | **done (2026-10-25, sp-x9), `2511ddea95` + `f30e0be71c`.** Exact `f30e0be71c` phone-tier SHARDFILE / LEGACY / Infinite holds reach 100/100 with frozen rows, visible 48 px PLAY and zero faults; PLAY → ready 644 / 1,223 / 1,124 ms. Off auto-enters (2,087 ms). **Hold at loading screen (G732):** Settings ▸ Developer toggle; when on, a finished load (shard, shardfile, LEGACY, Infinite Wildshard) stays on the completed loading screen with all steps and timings, and a PLAY button over it enters | Codex | toggle on: every entry stops at 100 % with PLAY; toggle off: unchanged auto-enter; phone-tier capture |

| U4 slice (≤ 1 h each) | Scope | Status |
|---|---|---|
| U4.1 | Renderer-free modal, real completed receipts, validated session handoff and retry; Developer-only until acceptance | done (2026-10-25, sp-x9) |
| U4.2 | Old-build Simulator tap, per-second progress capture and public enablement | done (2026-10-25, sp-x9): 2,873 ms / 15 changes / 253 ms longest gap / errors 0 |

### Current-build update follow-up (G715, sp-x2)

Prior U1/U2/U4 results above remain valid historical measurements. Recheck the larger build gap before any new runtime change.

| Slice (≤ 1 h) | Scope | Status |
|---|---|---|
| U1.3 | One ff45b6a24 → current pinned build Simulator visit; split install/adopt/reload/title, inspect stale/new art and Template admission. | done (2026-10-25, sp-x2): `ff45b6a24` → `07f473ffb8`, tap → title **720 ms** = adopt 1 + reload → inline 391 + inline → ready 291 + paint 37. Worker installing → installed 48 ms before tap; activation spans 385 ms after tap and overlaps reload, not additive. Application errors 0; stale/new 12 unique image URLs valid (11-thumb deck); blank art not reproduced. 101 cache URLs retained, no legacy pack URL requested. Update response bodies 733,156 B: 281,152 identical, 43,559 changed, 408,445 unknown/new; diagnostic HTML is injected/uncompressed, local telemetry 404 is separate. No cache-hit inference from missing requests. |
| U2.2 | Preserve verified plain image aliases during static-cache migration; unchanged pack URLs and immediate reload remain unchanged. | done (this code commit): U1 found the same 280,723 B title hero downloaded again because migration kept only its verified `?v=hash` key while the inline title reads its plain URL. Keep both verified aliases in the current content-named cache; real shipped-worker regression proves zero fetches for either, while changed/removed images still refuse carry. This avoids the identified body in that fixture; no post-fix native timing/byte claim. Engine/test types, typed lint and 22 focused cases pass. |
| U4.3 | Review current loading-style progress against actual phase/receipt evidence; preserve prior native handoff proof, fix a demonstrated gap only. | done (2026-10-25, sp-x2): Update/UpdateProgress/styles/sw boot code unchanged since the earlier 2,873 ms /15 changes /253 ms native proof except public enablement `5716145112`. Current direct reload, real receipt counts, handoff/retry/unknown-byte and worker install regressions pass; no new modal code or duplicate native recording. |

**Template wait named:** current post-update Template is 3,547 ms tap → ready, with admission 981 ms. The `Parsing shard descriptor` label persists while `readProductInput` resolves the descriptor sections: `resolveOutputDescriptor` launches 39 section reads together. Its verified-read and worker waits are nested, giving the observed **39 files /78 waits**, not 78 transports or one 7.3 s JSON parse. The creatures label appeared at document +1,158 ms and the next snapshot was `Checking visited product` at +1,258 ms; the reported 7.3 s stall did not reproduce. Immutable assets then use the separate 16-read admission pool. No concurrency/deadline change.


### H3 order-only source (2026-10-27, sp-x9)

Source: `52e5052165`.

**In flight (reading at plan end, G780).** G794 adds no measurement phase,
asset, mesh, collider or product byte. Existing home terrain/native collision
foundation still precedes tile publication. The arrival tile (terrain then
its ordinary props, including the pier where declared) now finishes before
the rest of its clipped eight-tile ring. The identical mandatory entryway
set follows. Broad render-ring demand begins only after those critical
reads, so it cannot compete ahead of the spawn view during admission.
Parent-first coarse coverage, far fallback, native collision readiness,
scope cancellation and all existing ownership/disposal remain intact.

The approach-order fixture retains exact equality of the complete original
critical tile set, adding the centre/ring order distinction. Touched types,
typed lint and candidate-path ratchet pass; full `pnpm lint:ratchet` refuses
an existing stale Pine discovery allowance. No baseline mutation, test,
build, preview or per-row reading was run under G769. No no-pop-in or
loading-time acceptance is claimed before the plan-end reading.
sp-x8 confirmed no active hunk in these assembly paths; its newer T4/T7
and entryway-prepin changes remain in HEAD and are preserved.


### A1 ring-first release (2026-10-27, sp-x9)

Source: `0dc3a7d61c`.

**In flight (reading at plan end, G780).** Consume the existing inner/outer
native-seam split (`46547f8e95`): the home and its eight neighbours' seams
and road remain the initial construction set. Before controls, far catalogue
demand and far-size declaration reads are limited to that same clipped 3x3
ring. Background release invalidates the existing catalogue revision once,
so the unchanged outer cells become eligible in the ordinary scheduler.

The page's old `hud.entered` signal was true before the reveal finished.
Latch the background release only after home readiness and reveal release
on an unpaused play frame. Outer seams/road, outer far declarations,
neighbour admission and the phone's existing four near views then run in
play. A later pause does not re-close or evict the already-open ring.
No loading barrier waits on outer cells or near views. `ringsReady` remains
observational; the reveal's existing timed/touch release is unchanged.
All source bytes, native collision sets, crossing readiness walls, far/near
budgets and scope disposal stay intact. No new fallback or gate is added.

Touched source types/lint and exact candidate-path ratchet pass. Full
ratchet still refuses the existing stale Pine discovery allowance. G769:
no tests, browser, build or per-row reading. The World assembly budget and
no-pop-in acceptance remain for the one plan-end reading. Shared assembly
hunks were agreed with sp-x8; its separate liveSession metadata-import
barrier change is untouched. H3 source is `52e5052165`.


### H4 home CPU source (2026-10-27, sp-x9)

Source: `a7176fd513`.

**In flight (reading at plan end, G780).** Address the three named cost
families without removing physical content or weakening admission:

- Colliders: reuse one temporary repeated-box descriptor per Physics owner;
  every native collider is still created. Reset translation/groups/rotation
  on each use. Rapier retains each shape object, so give every collider a
  distinct Cuboid shape even when the descriptor is reused. Remove the
  temporary singleton array per non-stair row. Kinematic bodies, stair
  expansion, collider ownership/materials, active updates and disposal stay.
- Validators: retain only the most recent collider grammar, comparing an
  owned snapshot of all surface-policy values. Changed policies rebuild it;
  kinds, required surfaces, strict shape fields, finite values, bounds and
  geometry ownership are still checked for every call. Never cache rows.
- Parses: the cost projection reuses only its most recent hash-identified
  weld parse/validation for repeated aliases/leaves. It does not retain a
  growing parsed wire bank or cache across admissions. Descriptor and cost
  reads reuse stateless UTF-8 decoders. Source hashes, receipts, visited-state
  compatibility, asset verification, every quality branch and complete cost
  accounting still run. The existing 8 ms pacing uses diagnosticNow rather
  than forbidden raw timing; its clock and budget are unchanged.

Source controls cover rotated-to-unrotated boxes, distinct mutable native
shapes, native count/pose/material ownership, fresh parsed collider rows,
changed surface policies and malformed values. Native fixture bytes come
from the lockfile-pinned Rapier package, not an untracked public payload.
Touched source/fixture types, typed lint and exact candidate-path ratchet
pass. Full `pnpm lint:ratchet` still refuses the existing missing Pine
discovery allowance. No tests, physics walk, product, preview, browser or
Simulator reading was run under G769. No CPU gain or collision acceptance
is claimed until the plan-end reading. The home entry uses these same
existing owners; liveSession's shared T4 import-overlap hunk is untouched.

H3 order source: `52e5052165`. A1 ring-first release: `0dc3a7d61c`.

## Plan-end Chromium reading — 2026-10-27 (G777/G780)

One 3-cold/3-warm cohort on shared `5f1eadb19e` / `5f1eadb-mvql4kya`:
muted iPhone 16 Pro, 402x874 CSS px, DPR 3, requested phone render scale 2x,
Chromium Metal, CPU 4x. Each pair has a fresh browser/context for cold;
warm retains that context's actual content/worker caches. Real title →
Infinite Wildshard enters Driftwood; reveal, frame gate, visible touch
controls and normal movement all pass, six visits/errors 0. This predates
Pine D97 and skips Nine; neither is qualified by this cohort.

| Run / visit | Tap → usable controls s | Home s | World assembly s | Shaders s | First frame s | Actual stage wire B |
|---|---:|---:|---:|---:|---:|---:|
| 1 cold | 16.300 | 5.766 | 1.601 | 2.269 | 1.657 | 71,059,606 |
| 1 warm | 13.612 | 5.449 | 1.396 | 1.833 | 0.549 | 496,698 |
| 2 cold | 14.033 | 5.257 | 1.474 | 2.010 | 0.528 | 71,038,639 |
| 2 warm | 15.026 | 5.679 | 1.505 | 2.203 | 0.635 | 496,698 |
| 3 cold | 15.009 | 5.804 | 1.514 | 2.063 | 0.611 | 71,059,606 |
| 3 warm | 14.460 | 5.540 | 1.640 | 1.906 | 0.643 | 496,698 |

H3 stays open: cold meets 8 s, warm misses 1.5 s. H4 stays open with H3.
The home row reports 1,174 colliders. Within that row's actual CPU-profile
window, sampled inclusive collider/physics stacks cost 254–299 ms cold /
268–283 ms warm, validators 305–371 / 336–378 ms, and parse stacks
275–389 / 319–375 ms. These categories overlap and cannot be summed;
GC, idle, native/program and other work remain explicitly unassigned.
A1 stays open: all assembly visits miss 1.0 s cold / 0.6 s warm.
S1 stays open: all shader visits miss 1.0 s cold / 0.8 s warm.
No causal gain is attributed to an individual source slice.

The byte-preserving observer sees 76,087,848–76,092,585 body B
(76,345,649–76,350,414 including actual response headers) by cold
controls, including title and background traffic. The table's stage wire
counts end at first-ready, a narrower boundary. Warm stage traffic is
496,698 B, not zero. The scratch warm before-control accumulator included
the preceding cold visit; it is rejected, not reported as warm-only bytes.
The page-only CDP counter cannot replace it: service-worker traffic is
outside that target. Thus a full warm-only all-traffic control-bound total
is unqualified; neither body/wire units nor cache hits are inferred.

G1's six recordings show the loader covering preparation, then the normal
pier/spawn view and usable HUD: no exposed warm-up draw at the reviewed
handoffs. Continuous screencast counts are 469/438, 459/479, 502/470
(cold/warm; no truncation). An all-frame solid-screen scan finds zero
post-hero solid black/white frames; one initial warm navigation frame is
white before its first hero. L16's first document hero is captured by
96–167 ms (cold 96/114/167 ms, warm 109/102/109 ms), with no later blank.
G1 and L16 meet the Chromium qualification allowed by G777. This does not
claim an iOS Springboard/home-screen PWA reading or a native-memory pass.

The initial instrumentation visit reached controls but refused during an
obsolete reveal-overlay touch / late screencast acknowledgement. It remains
separate in `loading-1`; only the cause-fixed scratch reader's six completed
visits count. No app source, cap, frame gate or movement assertion changed.
Raw rows, full films and CPU profiles are in
`tmp/sp-x9-plan-end/loading-qualified-{1,2,3}/grid/{cold,warm}/`;
`loading-cpu.json` retains source attribution. Browser/preview uses released.

### H4 immutable plan admission reuse (2026-10-27)

D108's warm home profile identifies repeated parseClientPlan validation in
runtimeClientPhase (19.719ms sampled, besides preparation/tier projections).
Hybrid preparation and its world, bindings, kit and play phases now capture
one fully admitted, detached immutable client plan per product object.
The first capture retains every schema, required-section, file, ownership
and island preflight check. Arbitrary mutable input still uses the original
admitClientPlan boundary; replacement products require fresh admission.
No phase order, feature, visual or frame-budget change. Touched types and
typed lint pass; H4 remains open for its row-only shared-preview reading.

### H4 row-only result after admission reuse (2026-10-27)

`8a0728329d` is contained in shared `cfef1c4658` / `cfef1c4-mvqnc3n0`.
One cold/warm real-grid pair, muted iPhone16Pro402x874 Chromium CPU4x,
retains reveal/controls/movement and errors0. Home is4.972s cold/6.670s
warm with1,174 colliders. Warm still exceeds H3/H4's1.5s bar; H4 remains
open and no whole-home gain is claimed. Other changes are in this shared pin.
The former repeated runtimeClientPhase admission stack has no sampled warm
cost after immutable per-product reuse. Remaining named validation includes
worldScenes tier projection20.952ms, placement15.974ms, creature looks15.392ms;
these samples are inclusive and not the entire6.670s wall interval.
Retain original failed bars and avoid inferring savings from sampling zeros.
Only H4 is regraded; S1 stays with sp-o4. Raw home rows/CPU profiles:
`tmp/sp-x9-miss-fixes/h4-after/grid/{cold,warm}/`, mapped warm stacks
`h4-after-validation-stacks.json`. No caps or validators are removed.

### H4 covered historical inventory (2026-10-27)

One warm home profile on shared67c0ccf600/build67c0ccf-mvqor9tm is
5.8396s (1,038colliders), still above1.5s. Product admission is1.3579s,
world assembly1.3455s and world scenes0.9304s; these elapsed spans overlap
and are not summed. Foundation is0.4235s. Source-mapped samples include
123.027ms plain-JSON walks and100.704ms section-load self CPU. Reader
getClientRects costs102.841ms and is excluded from production attribution.
World/parked/compile owners retain their named hunks; initial home has no
entered-stage preparation receipt. Raw:tmp/sp-x9-h4-follow/baseline.

This source cut reuses historical section/schema values only when every
historical path/hash/size is covered by the exact current verified inventory
and the current build-verified root is still private to this admission.
It avoids a second cache transfer/JSON parse for identical visited sections.
Historical grammar, state compatibility, hashes, complete current reads and
durable publication checks stay. Exposed roots and differing inventories
keep the original complete historical reader. Touched types/typed lint and
scoped ratchet pass. H4 remains open for a containing shared-preview re-read.

### H4 after historical reuse; road allocation cut (2026-10-27)

Source4907548a84 re-read on shared4907548a84/build4907548-mvqpcspz:
one cold seed plus one profiled warm grid entry, original controls/movement,
errors0. Warm home7.2559s with1,038colliders, admission1.5714s,
foundation0.5601s, scenes1.0773s, world assembly1.6986s. All named wall
spans grow; no whole-home gain is claimed. The new post-landing duplicate
read control passes, and section-load self CPU is no longer a top45 frame.
H4 remains open against1.5s. Raw:tmp/sp-x9-h4-follow/after-lineage.

Road construction during home has408.721ms inclusive sampled CPU (before:
259.153ms). cullPlanSteps has238.320ms inclusive/116.801ms self; clipped
attribute reads71.552ms and per-vertex LOD helper65.123ms self. These are
nested and must not be summed. This follow-on removes per-triangle iterator
pairs and per-vertex helper closures, and uses indexed attribute reads.
The triangle/index/LOD order, edge predicates, sphere bounds, slice batches
and collision inputs are unchanged. Existing complete road hash oracle stays
031db7363e523059eae3c0b34803ce11cb29fc7b4500641427f2c4e2f9fb3d0f.
Touched game types, typed lint and scoped ratchet pass. Row-only read follows
on a containing shared preview; H4 stays open, no allocator gain claimed yet.

### H4 road row-only result (2026-10-27)

`1ff6fd569f` is read on shared1ff6fd569f/build1ff6fd5-mvqpjc3x,
one cold seed plus one warm home profile, same muted phone/4x protocol.
Warm home5.1683s (prior7.2559s), same1,038colliders, controls/movement
pass, errors0. Original complete road golden and allocation counts pass
2cases after landing; the duplicate historical read control also passes.
Road inclusive sampled CPU271.582ms versus408.721ms on the preceding
pin; cullPlanSteps153.946ms versus238.320ms. Other costs also fall, so
these shared-pin numbers do not isolate a causal whole-home gain.

H4 remains open against1.5s. Remaining top spans are product admission
1.0962s, world assembly1.1633s, scenes0.8494s, native foundation0.3857s;
wrappers overlap. X2 owns active I2 controlFiles/completeCache transport,
x1 owns the new worldAssembly repeated-admission cut and scene admission.
The warm-home miss/protocol was routed to those actual owners/coordinator;
no duplicate transport, world, compile or parked-draw edit is made here.
The first empty-world native step stays before control; deferring its cost
would not establish a construction reduction. Touched source types, typed
lint and scoped ratchet remain green. Both source commits are on origin.
Raw:tmp/sp-x9-h4-follow/after-road and cpu-after-road.json. Browser closed,
owned preview use released; follow-up H4 reads consume coherent owned cuts.

### H4 native foundation overlap (2026-10-27)

The last qualified warm home foundation is385.700ms on1ff6fd569f.
Its restricted CPU profile (tmp/sp-x9-h4-follow/cpu-foundation.json) finds
63.076ms in the new-world native physics step, further native setup, and
roughly45ms navigation reconstruction. These samples are not disjoint wall
spans. Nothing physical is skipped or pushed past control.

The already-budgeted, bodyless destination shell now initializes alongside
product-backed navigation/look reads. A scoped look starts its required
material preparation when it resolves, before waiting for navigation.
Every task drains before failure/teardown; navigation/look failure retains
precedence and resident owns successful shell/look resources. A guarded
heightfield binding stays unavailable until the original frame binds.
All original required ground, lattice sampling, colliders, install, terrain,
forest, and pre-control gates remain. No renderer/frame/API cap changes.

Touched game and fixture types, typed lint and scoped ratchet pass. Initial
wide types hit foreign untracked cubeUVSample mid-edit; owner correction
then makes game tsc-b pass. H4 remains open until one containing shared read
also includes x2 admission573a3bebd7 and x1 assemblyae65879548.

### H4 combined foundation read (2026-10-27)

One cold seed plus one warm phone/4x grid entry on shared
`cef103c325` / `cef103c-mvqqh8k0`, containing admission573a3bebd7,
assemblyae65879548 and foundationcef103c325. Both statuspassed/errors0,
normal reveal/controls/movement and1,038colliders retained. Six scoped
navigation/look-preparation ownership, drainage and retirement controls pass
8.88s after source landing.

Home6.5185s cold/6.9473s warm. Native foundation0.4998/0.5415s;
previous qualified warm was0.3857s. Warm admission1.3510s,
world assembly1.5442s and scenes1.1144s also grow. These spans overlap;
this is a shared pin without quiet, and no isolated or whole-home gain is
claimed. H4 stays open against1.5s, with the original bar unchanged.
Detail gap1,326.2ms cold/578.5ms warm is retained, not hidden.

Raw:tmp/sp-x9-foundation/combined-read/grid/{cold,warm}/grid.json plus
warm CPU profile; protocol remains the existing warm-home reader. The reader
initially queued behind four valid browser leases, then completed naturally.
No reader/browser remains; owned shared preview:4409 was released with
serve-build.sh stop after the coordinator's slot request. No repeat queued.

### H4 initial-home duplicate preparation census (G804)

In flight (sp-x9). Current shared02f234b950 cold/warm grid pair:
Home5983.7/5059.1ms versus8000/1500; assembly976.9/1165.6ms
versus1000/600. Both control/movement paths pass/errors0. The pair
is not quiet and is a fresh cost ranking, not an isolated gain claim.
Warm home includes304ms road geometry/culling,182ms product admission,
and active construction/render preparation. Exact cached/new native
program identities must be counted before removing the second warm.

Add a Developer-only16-slot scalar precompile census over the existing
native program object identities; it retains no program, material or
scene handle and changes no shader job, budget or first-use fence.
Next: count the drawn-only page pass following warmEnteredFrame, then
reuse only already-prepared identities for the same actual composer.
Proof requested by Jake: one cold and one warm DW-home capture before
and after, plus the original warm Home row. First-frame checks remain.
Engine types, touched typed lint and scoped ratchet pass.
