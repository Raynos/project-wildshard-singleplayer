# Grid crossing under 5 seconds: mini plan (G579, G580)

**State:** `active` 2026-10-27 — G782: the plan (and tile-streaming T7) closes when every crossing is under 5 s warm
and under 8 s cold; grid-ready's Nalati row waits for the same bar (G784). G743: one Codex lane on crossings. Row
marks written 2026-10-27 from git: T1, T5, T6 landed; T2–T4 in flight (reading at plan end); T3 source reuse is wired below.

Jake, 2026-10-21 ~18:05 Cancun: *"we need to be able to go from shard to shard in the infinite wild shard, and this needs to
be fast … sub 5 seconds … The whole thing is dead if you can't go from shard to shard fast."* With G578: a cell's load
never leaves the 3D world.

## What the audit measured (plan agent's subagent, live f66a4309e, Chromium as iPhone 16 Pro, phone tier, 4x CPU)

Every crossing **tears the source shard down and builds the destination from nothing**, and that build only starts past
the road midpoint, after the source has retired. The player stands at the cell wall the whole time.

| Crossing | Held at the wall | Terrain + physics | World | Equipment + creatures | Gameplay | Shader warm-up |
|---|---|---|---|---|---|---|
| Pine → Sky, first | 13.6 s | 0.66 | 7.75 | 0.47 | 0.75 | 5.38 |
| Pine → Sky, warm | 9.8 s | 0.37 | 4.59 | 0.27 | 0.57 | 5.43 |
| Sky → Pine, warm | 30.5 s | 1.48 | 13.90 | 2.58 | 2.35 | 11.58 |
| Padding cell | 0 s (built ahead on the road) | | | | | ~1.6 |

- Saving the source takes 1–9 ms: saved state is not the cost. Jake's '14.6 s Gameplay and saved state' is most likely
  the shader warm-up under a wrong label (`cellLoading.ts`).
- During a 15 s Sky build only ~24 % of CPU time is building; ~30 % idle, ~31 % drawing the waiting view.
- A cheap re-activate path for a still-loaded shard exists (`hybrid.ts:441-452`, 5–12 ms) but is never used, because
  leaving always retires the shard (`liveSession.ts:396`); only one shard world may exist (`live.ts:301-302`, `:577`);
  the build starts past the road midpoint (`live.ts:439`).

## Rows

| Row | What | Saves | Effort |
|---|---|---|---|
| **T1 — superseded by tile T7 (`d27bab4e35`, `17a5b1a5c0`, `7a06597f33`)** (warm neighbour and warm-up on by default; `2888459ba9` + `594723dace` warm one bounded neighbour) | **Warm neighbour** (architecture): two shard worlds at once. Build the approached cell fully (warm-up included) while the player is still in the source, and keep the last cell loaded on leave (retire by the existing cold-dwell rule, `retireColdRegions`, not on leave). A crossing becomes the 5–12 ms re-activate. Lifts the one-world rule (`live.ts:301-302`, `:577`); starts the existing build-ahead (`hybrid.ts:413`, `liveSession.ts:749`) earlier. Memory is judged per shard (G556); the page total's only limit is not crashing | 10–30 s; the only route to seamless | ~1 week |
| **T1.R — done (`b7d6c8b728`; requested Nalati warm/budget reading below)** | One complete last isolated world remains on the road for30s with its full original charge, strict1.2GB per-shard headroom, scoped expiry and pressure eviction. A different destination retires it before allocating. Prepared returns hold the original world through commit/cancel; failed disposal keeps the full charge. X8 T7 input work and O1 program ownership remain intact. Types/lint/scoped ratchet and64 post-land lifecycle/T7/program cases pass. | ONE exactb7d Nalati return33.3ms, errors0; same root/163geometries/186materials/material-program keys, only38.5ms activation, no repeated construction/GPU-preparation spans. Budget ruler max716351998B <1200000000B; native whole-page readings are distinct, not per-shard/iPhone qualification. Cold23.3689s still misses8s, so parent G782 remains open. | bounded slice |
| **T2 — in flight (2026-10-27, sp-o4): keep `eff7b0da12`, warm neighbour `dce1dd8ca2`; G782 safe keep of node builds `8a832edf7b` (code + positions, bounded LRU); sky-cycle floor `7e8b320c92` + kept-miss counters `5951f7c014`; approach builds stay bound across the entry's new sky PMREM when they read no environment `d10303ddee`; a PMREM swap rebinds a lit program `244b830de7`; kept builds read the PMREM by role `12f0b06fbd`, released kinds by node type `7153a723e8`. Sky-cycle on `4ec5a15eaf` (Chromium phone, before `12f0b06fbd`): re-entries repeat nearly every key (Sky 72/72, 71/71; DW 57/64), keep served 0 (refused 66 released, 41 environment), 0 frames > 50 ms after the first visits; held uniforms `b44acd038e`. Plan-end sky-cycle on `db62fede6c` (Chromium phone, DW -> Sky -> DW x3, PASS, `tmp/o4cpu/rm-end2/ff/db62fede6-42578-1793102216281.json`): only the first Sky entry has long frames (8, max 133 ms), every later leg max ≤ 33.5 ms; re-entries still repeat nearly every key (Sky 71/71, 70/70; DW 56/63); the keep serves 17 by the third return and refuses no environment, the rest 'released' build-made samplers and references (TextureNode<Texture> 74, ReferenceNode 19, UniformNode<Vector2> 2), weak by design; open: next cut a kept build that holds those and dies with their texture's dispose)** G780 reading `5f1eadb19e`: G782 open; exact three cold/warm runs and causes below. | **Keep and pre-build shaders**: keep compiled programs for shared and recently visited materials across retirement; compile the destination's set on the road with parallel shader compile; more than one program per frame while held (`precompile.ts:691`, `Game.ts:839-920`) | 3–8 s | 2–3 days |
| **T2.1 — in flight (reading at plan end); source `e3d0cd2b7e`, sp-x8** | Slice registered offscreen caster submissions with the parked budget instead of drawing an entire pass in one frame. Preserve all original unique caster keys, shadow/target formats, restoration and final readiness; every batch pauses after flags are restored. Live WebKit stays at one caster/frame. No change to sp-o3 hidden-LOD selection or shader frontend reuse. Engine/test types, named typed lint and scoped ratchet pass; full ratchet exposes independent shared baseline debt. New cancellation/restoration controls remain unexecuted under G769. | unmeasured | bounded slice |
| **T2.2 — in flight (reading at plan end); source `2d45387032`, sp-x8** | Prepare missing ordinary static geometry spheres with the existing exact incremental scanner before parked native draws. Yield at the existing 6 ms live CPU budget; owner cancellation stops before another scan or draw. Dynamic/skinned/morph/custom/GPU-only geometry retains its native path, and changed attributes abandon partial scans. No pipeline selection, material, buffer, transform, memory-cap or drawn-frame-fence change. Types/lint/scoped ratchet pass; exact-result/cancellation controls are unexecuted under G769. | unmeasured | bounded slice |
| **T2.3 — in flight (reading at plan end); source `9de0e1d38f`, sp-x8** | Slice the native whole-instance sphere union before parked draws: stock static instance matrices, original order/arithmetic, 512 instances per CPU step under the existing 6 ms budget. Publish only on completion; owner cancellation or changed count/matrix/bounds abandons the partial result. Shared/dynamic/custom/missing-base-bounds paths stay native; late usage, morph and accessor changes abandon the scan. Engine/test types, typed lint and scoped ratchet pass; exact native-sphere/cancellation controls unexecuted under G769. | unmeasured | bounded slice |
| **T2.4 — in flight (reading completed, G782 misses open); source `bca5361f7c`, sp-x8** | Pace one fresh exact geometry/material/program binding per live WebKit frame; matching ordinary mesh/instance copies share up to8 submissions under256KiB of fresh buffers (formerly1 draw/4MiB). Preserve all original draws/order, oversized-alone behavior, custom callback/skin/morph isolation, restored flags, cancellation and completed-frame fences. Engine/test types, typed lint and scoped ratchet pass; post-land13 focused controls pass. | One cold/warm pair each on containing325740f3a5: Pine37.417/31.585s (parked13.996/14.119s,422/430draws; entry p95/max66.7/199.9cold,66.6/166.7warm); DW22.346/14.349s (parked6.304/5.631s,150/169draws;83.3/183.4cold,50/133.3warm). All complete/errors0. No isolated overall gain; both8/5s bars remain missed. Raw tmp/sp-x8-g782-cuts/binding-{pine-hollow,driftwood-isle}; further parked-loop work belongs sp-o1. | bounded slice |
| **T3 — in flight (G782 reading completed; misses open); fixed geometry `72a8a79861`, whole partitions `c824249f5e`, GLB templates `db4edc7e1b`; scope-local buffered reuse `f81e1a3c38`; initial wiring `b416ed805e` corrected there** G780 reading `5f1eadb19e`: G782 open; exact three cold/warm runs and causes below. | **Cache world-scene builds** per shard (fixed content): keep built geometry and instance buffers, or build them in a worker, instead of rebuilding per entry (Sky's world scenes; Pine's props 2.7–3.8 s, grass 0.9 s). Repeated buffered draws share one geometry construction per live scope, product, descriptor/binary addresses and tier. Each call makes fresh roots/material bindings; scopes release their leases on retirement. Historical cross-visit default wiring measured zero hits and slower Pine re-entry (`2c8e05dd64`); G782.Sky3 explicitly opts fixed buffered worlds into charged, pressure-evictable revisit retention at the coordinator's request. Initial `b416ed805e` default-cache wiring is corrected before any reading; explicit reusable APIs remain opt-in. No memory cap change; G782.Sky3 names the explicit buffered revisit lifetime. Types/lint and scoped ratchet clean; full ratchet stops on existing D37 before counting. Cold/warm timing remains unqualified | 3–6 s | 2–4 days |
| **T3.2 — in flight (reading at plan end); source `b119e863ed`, sp-x8** | Validate aligned ordinary scene-buffer words without a temporary full binary copy. Construction still detaches and validates its own storage; shared/unaligned intake keeps its snapshot-copy path. Do not cache validation views or change numeric/file refusals. Touched types, typed lint and scoped ratchet pass; source-mutation, signed-zero and unaligned/shared controls added but unexecuted under G769. | unmeasured | bounded slice |
| **T3.3 — in flight (reading at plan end); source `a23e270c29`, sp-x8** | Scan decoded Float32 words and triangle indices with direct loops instead of per-word callbacks. Keep all finite, triangle-count and vertex-range refusals, detached construction storage and original source order. Game/test types, typed lint and scoped ratchet pass; full ratchet remains red on shared baseline mismatches. No timing credit before the plan-end reading. | unmeasured | bounded slice |
| **T3.4 — in flight (reading at plan end); source `83e39f6a75`, sp-x8** | Overlap independent named scene-buffer reads in batches of four rather than serialising each binary. Verify all names first, drain every started batch before propagating refusal, retain source order and publish only the complete validated row. No lease, admission, cache or numeric weakening. Game/test and scoped fixture types, typed lint and scoped ratchet pass; bounded-read/refusal controls added but unexecuted under G769. | unmeasured | bounded slice |
| **T3.5 — in flight (reading at plan end); source `3863a876da`, sp-x8** | Start verified owned-geometry segments with their primary GLB, retaining exact segment order and draining every started read before propagating a refusal. Recheck the construction owner before decode so abandoned approaches do not decode useless geometry. No cache/lifetime/cap change. Game/test and fixture types, typed lint and scoped ratchet pass; read-order/drain controls added but unexecuted under G769. | unmeasured | bounded slice |
| **T3.6 — in flight (reading at plan end); source `d1bc50bbf3`, sp-x8** | Read model and bake declarations in bounded batches of four; retain authored publication order and complete all model publication before bakes may borrow their materials. Every started read settles before validation failure propagates. Keep exact original descriptor guards and caches. Game/test and fixture types, typed lint and scoped ratchet pass; bounded-order controls added but unexecuted under G769. | unmeasured | bounded slice |
| **T3.7 / A1.4 — in flight (reading at plan end); source `982ec20ff4`, sp-x8** | Remove temporary vertex/index tuples and mapped face-index arrays from the private native seam writer. Box faces no longer allocate six feature records only to splice them away; retain the same final box interval. Vertex order, arithmetic, colour words, winding, final features and certification are unchanged. Engine/test types, typed lint and scoped ratchet pass; no pre-landing parity/readings under G769. | unmeasured | bounded slice |
| **T3.8 — in flight (reading at plan end); source `8f19119026`, sp-x8** | Reuse private position/Euler/quaternion/scale scratch while composing each fresh authored pose matrix. Capture all numeric inputs before scratch writes, preserving accessor order/reentrancy and native float operations; no matrix/vector owner escapes. Engine/test types, typed lint and scoped ratchet pass; exact-word/independent-matrix/reentrant-input controls added but unexecuted under G769. | unmeasured | bounded slice |
| **T3.9 — in flight (reading at plan end); source `2f6dd6eb60`, sp-x8** | Convert authored poses in 32-copy CPU chunks under the existing shared budget, before placement begins. Coarse landmark placement now uses the same ordered `placeSteps` generator through `placeSliced`, retaining complete construction before publication, original draw/collider/cull rules and owner checks across pauses. The barrier fixture waits for its actual reached slice instead of eight incidental microtasks; all original retirement/contact/registration assertions remain. Game/test types, typed lint and scoped ratchet pass; controls unexecuted under G769. | unmeasured | bounded slice |
| **T3.10 — in flight (reading at plan end); source `f28204046d`, sp-x8** | Overlap independent specimen-byte admission and model/bake source declarations before world construction. Drain both inputs before refusal, preserve specimen-first error precedence and revalidate the resident/read owner before recipes or allocation. All original schema and file guards remain. Game/test types, typed lint and scoped ratchet pass; no pre-landing tests/readings under G769. | unmeasured | bounded slice |
| **T3.11 — in flight (reading at plan end); source `3ed1058909`, sp-x8** | Index already-validated owned/whole/pool model names and placement/specimen keys locally during admission. Replace repeated linear membership/find scans while preserving accepted name sets, mapped restrictions, duplicate/schema guards and exact refusal messages. No cross-build cache or resource lifetime change. Game/test types, typed lint and scoped ratchet pass; no pre-landing tests/readings under G769. | unmeasured | bounded slice |
| **T3.12 — in flight (reading at plan end); source `222e6120f2`, sp-x8** | Slice awaited resident frozen-graph hydration between ordered native material/node/cull units under the existing CPU budget. Keep the synchronous specimen API on the same construction generator; complete graph admission still precedes allocation. Retirement or a failed pause closes the generator and removes partial owned publications; assembly resolves only after the full graph. Game/test and fixture types, typed lint and scoped ratchet pass; ordered-publication/retirement controls added but unexecuted under G769. | unmeasured | bounded slice |
| **T3.13 — in flight (reading at plan end); source `191c0ca578`, sp-x8** | Read unique frozen specimen graph descriptors in bounded groups of four before ordered admission. Preserve first-seen file identity, inline graph order, native schema/service refusals and authored error precedence. Drain every started group before failure; no later group or scene allocation starts after refusal. Game/test and fixture types, typed lint and scoped ratchet pass; bounded-start/order/drain controls added but unexecuted under G769. | unmeasured | bounded slice |
| **T3.14 — in flight (reading at plan end); source `41ee8a8fea`, sp-x8** | Compute merged static-dressing bounds through the existing exact geometry-bounds steps under the caller's CPU budget. The box scan is shared with the sphere centre; native transformed vertices, radius, box, draw state and publication order remain. Close abandoned merge generators and dispose their unpublished transformed/merged storage without freeing borrowed source geometry. Engine/test types, typed lint and scoped ratchet pass; exact-native-bounds and rejected-pause cleanup controls added but unexecuted under G769. | unmeasured | bounded slice |
| **T4 — in flight (G782 reading completed; misses open): source `0222ea0cbd`, `2888459ba9`; G782 warm <5 s / cold <8 s not requalified** G780 reading `5f1eadb19e`: G782 open; exact three cold/warm runs and causes below. | **Start the build when the source edge is crossed** toward one destination, not at the road midpoint (`live.ts:439`) | ~1 s hover, ~5 s walking | 0.5 day |
| **T4.1 — in flight (reading at plan end); source `363e6f5256`, sp-x8** | Let a verified tiled destination prepare its entry ring during runtime-module import on a real approach heading. Only a bounded render capability is available early: product/runtime readiness stays pending, and no regional constructor or traveller transfer occurs. Preserve one speculative render owner, distance/redirect aborts and actual-demand fences. Game/test types, typed lint and scoped ratchet pass; new delayed-module/readiness controls are unexecuted under G769. | unmeasured | bounded slice |
| **T4.2 — in flight (reading at plan end); source `5846592231`, sp-x8** | Overlap product-backed regional navigation and look loading after GPU registration/product lending, before native frame construction. Drain both inputs, preserve navigation-first error precedence and own a successful look immediately; retirement disposes late looks. No early physics, frame, shader or readiness publication. Game/test types, typed lint and scoped ratchet pass; overlap/drain/retirement controls added but unexecuted under G769. | unmeasured | bounded slice |
| **T4.3 — in flight (reading at plan end); source `2e64616127`, sp-x8** | Complete T4.1 at the real producer: metadata no longer eagerly awaits the compiled entry before returning its retained importer. `LiveGridHost` still awaits that importer before product readiness; only verified render capability is available during the import. Fresh construction still imports before creating its owner. Game/test types, typed lint and scoped ratchet pass; actual-source metadata/fresh/refusal controls added but unexecuted under G769. | unmeasured | bounded slice |
| **T4.4 — in flight (reading at plan end); source `c5af78362e`, sp-x8** | Give the single verified render approach the existing destination read priority during its finite tile-preparation task. Release the hold in `finally` when work settles, including abort/refusal; a completed pin keeps no priority. In-flight transport is not interrupted, and no constructor, residency or readiness fence changes. Game/test types, typed lint and scoped ratchet pass; finite-hold/drained-abort controls added but unexecuted under G769. | unmeasured | bounded slice |
| **G782.P1 — in flight (reading completed; G782 misses open); source `126cf532b0`, sp-x8** | Forest ground input scheduling: overlap its independent verified appearance, placement JSON and exact native geometry reads in the existing scope. Drain every started read, retain appearance/layout/schema/geometry refusal order, and reject retirement before publishing or using completed geometry. Original placement admission slices, counts, meshes, materials and final readiness stay unchanged. | Game/test types, named typed lint and scoped ratchet pass; full ratchet reports unrelated generator debt. All5 post-land start-order/drain/retirement controls pass. Containing b79 Pine forest-page8.094/5.487s cold/warm, crossing40.832/30.451s; no isolated gain. O2 reports containing c0db/held CPU964 Pine27.87/23.83s, forest-page7.26/6.19s; dominant parked gain belongs other cuts. The next profiled pair belongs O2; no duplicate reading. | bounded slice |
| **T4.5 — in flight (reading completed, G782 misses open); source `8bb73bf165`, sp-x8** | Shared assembly/forest readiness uses the verified resident crossing point for critical tile admission and coarse-ring centring, without unrelated authored spawn/exits. Standalone construction retains spawn plus declared entryways. Preserve required-tile failure, retirement, later content and follower ownership. Buffered driver unchanged. Types/typed lint/scoped ratchet pass; post-land23cases/2suites pass. | One original cold/warm Pine pair on containingb79fe6a53c (includes126cf +0cea +67c0):40.832/30.451s, both miss8/5s. Errors0/skipped0/context intact. Props1.850/1.478s; forest-page8.094/5.487s. Native/JS long-frame attribution is not isolated; no overall gain claim. Full affected reading below. | bounded slice |
| **T4.6 — in flight (reading completed; G782 misses open); source `86683bcaa0` + `83e085769e`, sp-x8** | Actual preparing crossings with an in-world screen apply a125m live-frame range. Nearby bounded meshes, road, sky and unknown/custom/skinned/morph draws stay live3D. Synchronously restore every flag before all preparation renders; disable on settling or disposal. No camera, readiness, shader or native-face fence changes. Engine/game/test types, typed lint and scoped ratchet pass;6 post-land controls pass. Private range iteration avoids a steady-frame Set iterator in the following receipt commit. | One original Nalati83 cold/warm pair completes/errors0, skipped0/context intact:29.736/20.684s, both miss8/5s; no demonstrated gain versus325 cold27.685–32.390/warm19.569–21.301s. Compile5.558/3.407s; shader/composer7.405/4.438s; parked218/218draws7.302/7.231s. Drive p95/max50.1/233.3cold,50/166.7warm. Large black rectangles in both entered portraits routed CI; visual acceptance unqualified. Full reading below. | bounded slice |
| **T4.7 — in flight (reading completed; G782 misses open); source `4c1ff71e1a`, sp-x8** | Cheap held cached compile jobs share the existing24ms native frame budget only after their acquired programs/blocks are resolved, target preparation is retained and no native/unknown work joined that slice. New programs, side/custom/slow units, program caps, retirement and final link/upload fences remain. Target disposal invalidates its receipt. | Engine/game types, exact typed lint and scoped ratchet pass; engine-test compiler has only3 peer parked-receipt diagnostics routed O1. Full ratchet retains foreign shard debt. All39 post-land cached/native-face/variant controls pass. Exact4c Nalati24.652cold/16.216warm s, both miss8/5s/errors0; compile4.7465/2.1846s, cached1of487/243of489jobs. No isolated gain from the intervening shared source. Full reading below. | bounded slice |
| **T4.8 — in flight (affected reading complete; G782 misses open); source `5ea8b843ab`, sp-x8** | Profile read/decode waits on current e6f/held72ms DW. Fuse quantized-position normalization and matrix multiplication into one pass, keeping the intermediate Float32 rounding. Three still transforms every normal/tangent and recomputes the original bounds; channel order, versions, private copies, parser serial slot, memory/read caps and runtime fences stay unchanged. | Baseline profiled DW16.285cold/11.583warm s/errors0: observed fetch-overlap union74.2/13.6ms, not critical-path read time. Owned intake736/822ms contains202/254ms owned decode, including134/194ms dequantization; main-loop5.351/4.120s corroborates O2. No network-priority change justified. Engine/test types, named typed lint and scoped ratchet pass after X10 typing repair2b818; all11 post-land byte/bounds/storage/parser queue controls pass. Post-cut2b preview refuses invalid boot file; containing0d4c/2f6 passes names then refuses missing/ambiguous shardSelection root before0browser samples. Canonical G782-Sky-boot-root belongs X9. After defining boot repair on shared b3b7b0bcd3:17.837cold/11.500warm s/errors0; cold sampled dequantization91ms vs134ms, warm cache removes useful decoder comparison. X1 revisit/O2 pacing/O3 node changes also present; no isolated decoder or overall timing gain. Strict guards retained. | bounded slice |
| **T4.9 — in flight (affected reading complete; G782 misses open); source `34465197ba`, sp-x8** | At a real source-edge exit toward one named destination, borrow the originally admitted tier transport at held priority. One charged ProductInputs loan, max4 reads; cancellation drains the batch and stops its suffix before a redirected loan starts. Keep the loan through actual construction, which shares its Map; priority/bytes release after drain. Stationary/teleported/ambiguous poses never invent a destination; retreat/redirect/disposal cancels. No regional constructor, physics, readiness or resident-count change. | Game/test plus scoped fixture types, exact typed lint and scoped ratchet checked; literal ratchet attempted. Post-land68 cases pass across the helper, original neighbour controls and ProductInputs; includes11 new source-exit/drain/hash/borrow controls. Initial neighbour collection lacked the test config Rapier alias; corrected config passes51 cases. O2 owns loop pacing; X6 owns last-cell retention, both peer hunks excluded. Containingb7 original unprofiled pair17.338cold/12.202warm s/errors0; input acquisition188/177ms finishes1.5s before request both. World6.714/4.095s, shaders4.513/3.115s, parked3.493/2.829s still dominate. Pin also includes X6 retention; no isolated or overall gain,8/5 bar stays open. Own browser/borrower closed.  Coordinator-requested latest-HEAD read/decode pair on53eb161742 is blocked before0browser samples by shared Far Reach phone-wire refusal34105274>33955475B; producer routing sp-ci-deploy. Prior b7 timing is retained, not relabelled as current. | bounded slice |
| **G782.S1 — in flight (sp-x10; ff0592f33c +3a5ac955e9 +a242807706; reading completed, G782 misses open)** | Sky entry resource intake: bounded static buffered chunks join the existing generic TileContent render ring, with the union of every authored LOD sphere transformed into cell space; follow-up resolves plain-mesh and LOD translations explicitly through the buffered group once. Each buffered field registers an owned TileDriver child and entered-only follow even without assembly/forest features; assembly/forest drivers cannot double-attach it. Out-of-ring draw objects detach before shader/parked preparation; geometry, materials, all LOD bands and authored draw order remain owned unchanged. Missing bounds and uncullable rows stay whole; Explorer construction remains whole. Preserve scope retirement, shared edge ownership, leases, budgets and readiness. Exact six baseline rows: tmp/sp-x8-g782-cuts/sky-span-table.json, parked465 draws/15.5–15.7s. Added transformed-edge/order/retired-scope fixtures; touched types, named typed lint and staged ratchet. No test/product build before landing. | One original cold/warm pair on a242807706 (devserver; includes sp-x8 bca5361f7c, no isolated gain):22.468/19.764s request→commit, both timing FAIL against8/5s. Ready/current Sky, errors0, skipped0, contextLost false. Entry p95/max cold33.4/100ms, warm33.4/66.7ms; parked407draws/13.327–13.346s vs historical465/15.5–15.7s. Owned loading274.13/274.06MB, playing267.75MB; process totals informational. Exact tmp/sp-x10-d12/sky-ring-pair/receipt.json and sky-ring-summary.json. Actual cold entry/departure/warm return verified; browser and preview use released. Parent G782 stays open Latest shared guard-green productionb3b7b0bcd3 original pair (contains both cuts plus Sky5):12.197cold/7.102warm s still FAIL8/5; world3.127/1.505s, native.foundation1.348/1.386s. Ready/current Sky, page/transport/skipped0/contextLostfalse, frame p95/max33.4/166.6cold and33.4/66.8warm pass. Exact tmp/sp-x10-d12/sky-atlas-pair/receipt.json; cold0priorworld/departure/warm1priorworld, browser/preview released. Source/mode changed; no isolated gain. See Sky5 for complete spans. Latest original production32e pair10.2466cold/0.0356warm s: cold FAIL8s/warm PASS5s via peer last-cell retention, no warm rebuild. Sky6 holds complete spans/frames; no isolated gain. Latest repaired HEAD973 pair11.0156cold/6.0990warm s both FAIL8/5, warm rebuilds; Sky6 has spans/frames and warm visual refusal. Latest3bc original pair11.2007cold/0.0336warm s: cold FAIL8, retained-warm PASS5/no rebuild; Sky7 has actual spans and caveats. | bounded slice |
| **G782.S2 — in flight (sp-x10; ef1a361445; reading completed, G782 misses open)** | Snapshot the real requested world feet minus destination origin as an optional cell-local entryPoint. Bind it to the regional resident before construction; non-crossing callers retain authored spawn. Regional presentation and bounded buffered fields use that same approach. Buffered intake requires the actual existing render ring (5x5 clipped at cell edges), rather than spawn plus unrelated entryways; the same scoped TileDriver follows afterward. No scene/physics content, caps, T3/T4 leases, readiness or parked submission fences change. Touched types, named typed lint and staged ratchet; no tests/product build before landing. | One original cold/warm pair on ef1a361445 (devserver; intervening shared source, no isolated gain):17.750/12.949s request→commit, both timing FAIL against8/5s. Ready/current Sky, errors0, skipped0, contextLost false; entry p95/max33.4/133.4ms cold,33.4/83.3ms warm. Parked217draws/6.996s both; compile2.832/1.686s; world3.895/1.266s. Owned loading272.70MB both, playing271.92/267.75MB; process totals informational. Exact tmp/sp-x10-d12/sky-entry-pair/receipt.json and sky-entry-summary.json. Cold entry/departure/warm return verified; browser and preview use released. Remaining parked cost routed sp-x8, scene intake sp-x1, shader prep sp-o4; parent G782 stays open Latest shared guard-green productionb3b7b0bcd3 original pair (contains both cuts plus Sky5):12.197cold/7.102warm s still FAIL8/5; world3.127/1.505s, native.foundation1.348/1.386s. Ready/current Sky, page/transport/skipped0/contextLostfalse, frame p95/max33.4/166.6cold and33.4/66.8warm pass. Exact tmp/sp-x10-d12/sky-atlas-pair/receipt.json; cold0priorworld/departure/warm1priorworld, browser/preview released. Source/mode changed; no isolated gain. See Sky5 for complete spans. Latest original production32e pair10.2466cold/0.0356warm s: cold FAIL8s/warm PASS5s via peer last-cell retention, no warm rebuild. Sky6 holds complete spans/frames; no isolated gain. Latest repaired HEAD973 pair11.0156cold/6.0990warm s both FAIL8/5, warm rebuilds; Sky6 has spans/frames and warm visual refusal. Latest3bc original pair11.2007cold/0.0336warm s: cold FAIL8, retained-warm PASS5/no rebuild; Sky7 has actual spans and caveats. | bounded slice |
| **G782.S3 — in flight (2026-10-27, sp-x1; source `89985f7664`; included in e067 cold/warm reading; misses open)** | DW scene-intake admission: keep full ordered recipe/placement validation, exact bytes, all geometry/material/collider records and owner cancellation. Replace unconditional per-row task yields with one existing8ms/shared-frame WorkSlice across the two metadata admission loops; fence retirement on every row and retain due-frame pacing. Generic host, no shard branch or rendering/parked-draw change. X8 corrected the aggregate world-hook attribution: native.foundation296.5/223.1ms is separate; actual largest unstarted scene span1447/1293ms cold/warm on5f1 pair1, placement admission43.1ms cold. X10 released library/placement hunks; buffered driver unchanged. | Game types and named typed lint pass; required ratchet attempted. No tests/product/browser run for this source slice, no isolated crossing gain or G782 pass claimed. | bounded slice |
| **G782.S4 — in flight (2026-10-27, sp-x1; source `e067e8ce05`; reading complete, G782 misses open)** | DW owned-library intake: preserve four-model verified read-ahead, template keys/leases, decode order and private mutable copies. Replace unconditional per-model task hops with the existing8ms/shared-frame WorkSlice, keeping retirement fences on every model and the unchanged library boundary pause. Warm template hits no longer force a task solely for one cheap lease. Free library intake coordinated with x8/x10; buffered drivers, shader/parked work and forest paths unchanged. | Game types and named typed lint pass; required ratchet attempted (foreign missing vite/pwa-plugin.ts). One original phone4x cold/warm pair on e067 completes/errors0:25.067/15.550s request→commit, both timing FAIL; entry p95/max66.8/183.3ms cold,50.1/116.7ms warm. Scene3.663/1.393s, owned library2.972/1.026s, compile6.882/4.163s, parked4.999/5.635s. No isolated gain or quiet qualification; full receipt below. | bounded slice |
| **G782.S5 — in flight (2026-10-27, sp-x1; source `0c907c46d6`; reading complete, G782 misses open)** | Carry the existing four-file owned-model read-ahead window across library boundaries. First files of the next library overlap the preceding library decode; ordered admission/decode/publication, completed-template keys, independent copies and four-file bound remain. Drain started speculative reads on every exit. Generic intake only; no buffered factory, shader, parked draw or cache-lifetime edit. | Game types and named typed lint pass; required ratchet attempted, foreign shard import growth remains. One original phone4x cold/warm pair on0c907c46d6: 20.047/13.251s request→commit against8/5s; entry p95/max 66.6/183.4ms/50.0/116.6ms cold/warm. Scene2.179/1.152s, owned library1.665/0.715s (foliage0.215/0.172s), compile5.709/3.022s, parked4.800/5.366s. Raw tmp/sp-x1-dw-ahead/pair/receipt.json; one non-quiet observation with intervening shared changes, no isolated gain claimed. Browser/preview cleanup exits0. | bounded slice |
| **G782.S6 — in flight (2026-10-27, sp-x1; source `ae65879548`; reading complete, G782 misses open)** | Assembly metadata admission: reuse the private parsed snapshot for the initial semantic checks in construct and for root/loan validation in lend. This removes one full redundant schema traversal in each invocation. Public admit and native-prelude admission retain their original boundaries; no cache spans calls or mutable caller input. Ordered stages, checkpoint progress, owner fences, loans and GPU release are unchanged. Measured assembly:construct1.029/0.222s cold/warm includes library wait0.626/0.022s; those overlapping spans are not CPU samples. | Game types and named typed lint pass; required ratchet attempted, foreign shard import growth remains. Post-landing focused assembly/construction guards39cases/2suites pass28.81s. One original phone4x cold/warm pair onae65879548: 16.493/12.150s request→commit against8/5s; entry p95/max 50.1/116.7ms/50.0/100.0ms cold/warm. Assembly construction0.718/0.244s, scene2.246/1.069s, owned library1.657/0.608s (foliage0.209/0.174s), compile4.490/3.396s, parked4.032/4.238s. Raw tmp/sp-x1-dw-admission/pair/receipt.json; one non-quiet observation with intervening shared changes, no isolated gain claimed. Browser/preview cleanup exits0. | bounded slice |
| **G782.S7 — in flight (2026-10-27, sp-x1; source `6ab803377c`; reading complete, G782 misses open)** | Island-library input overlap: read the immutable groups document during resolved figure admission, then publish inventory at its original ordered cursor. Keep figure-owner serialization, geometry intake and all ownership/lifetime policy unchanged. A figure refusal wins and drains the started inventory read; failed metadata remains retryable. This cuts transport serialization inside measured assembly:library0.626s cold/0.022s warm; it does not claim that whole span is avoidable CPU. | Game/fixture types and typed lint pass; required ratchet attempted. Post-landing resolved-library guards11cases pass10.47s, including overlap and refusal/drain controls; One original phone4x cold/warm pair on6ab803377c: 17.403/13.050s request→commit against8/5s; entry p95/max 66.7/183.4ms/50.0/116.6ms cold/warm. Assembly construction0.752/0.334s, scene1.450/1.542s, owned library1.089/0.960s (foliage0.143/0.228s), compile4.546/3.028s, parked4.905/4.099s. Raw tmp/sp-x1-dw-inventory/pair/receipt.json; one non-quiet observation with intervening shared changes, no isolated gain claimed. Browser/preview cleanup exits0. | bounded slice |
| **G782.S8 — in flight (2026-10-27, sp-x1; source `0e90efb49b`; reading complete, timing/cadence miss remains open)** | Opt resident owned-geometry construction into the existing charged, idle, pressure-evictable revisit cache. Completed templates survive region retirement; returned worlds still receive independent mutable copies and new owner leases. Content/tier/segments/alias order plus retention policy key the cache; capture policy before awaited transport. Read-ahead uses the same resident key and skips cached files. Default readers still retire their templates normally. No parser/read pacing, asset policy/cap, scene-buffer, draw object, material, collider or scheduling change. X8 confirms this exact ownership split. Targets the largest free scene/library span: scene1.450/1.542s, owned library1.089/0.960s cold/warm on6ab803. | Game/fixture types and typed lint pass; required ratchet attempted (foreign shard import growth). Geometry-cache/revisit guards17cases/2suites pass15.17s, including default eviction, recycled-sim independent charges, private copies, idle/live pressure and policy isolation/capture. One original phone4x cold/warm pair on60708bbe56 (contains source0e90efb49b): 16.751/10.752s request→commit versus8/5s; entry p95/max50.0/183.4ms/33.4/99.9ms. Assembly construction1.239/0.312s, scene2.993/0.569s, owned library2.445/0.003s, compile3.311/2.212s, parked3.437/3.267s. timing/cadence miss remains open. Both entries ready/current Driftwood, errors0; browser/preview release0. One non-quiet observation with intervening shared changes, no isolated gain claimed. Retain initial0e90 title refusal and shared2f6 bank refusal; source-qualified by x9 b3, then one DEVSERVER60708 preview for the original grid identity. Raw tmp/sp-x1-dw-revisit-final/pair/receipt.json; page-cache charges below. | bounded slice |
| **G782.S9 — in flight (2026-10-27, sp-x1; source `61885a0631`; reading complete, timing/cadence miss remains open)** | Baked-family pose construction uses one private position/quaternion/scale scratch per family, preserving original Matrix4.compose arithmetic and every per-copy matrix/colour. Current DW phone plan16families/11534copies: temporary transform objects34602→48. Exact old scalar constructor retained as test oracle for float64 matrix words, signed zero, input/order/defaults, duplicate-index independence and later calls. No decoder/read, cache policy, native geometry, culling, collider, draw or scheduling change. X8 releases baked construction. | Game/scoped fixture types and named typed lint pass; required ratchet attempted (foreign shard import growth). Post-landing original-word/private-copy guards2cases pass8.16s. One full native-table parity kernel11534copies retains matrix/colour word hashd1d8b541822df3b889fddeb1195ee8e724cd70481900f2e7dfc17b3d60e22f67; temporary transform objects34602→48. One original phone4x cold/warm pair on61885a0631 (contains source61885a0631): 15.852/15.966s request→commit versus8/5s; entry p95/max50.0/116.7ms/49.9/149.9ms. Assembly construction1.040/0.468s, scene2.804/2.807s, owned library2.233/1.830s, baked0.919/1.824s, compile3.229/3.093s, parked3.359/2.834s. timing/cadence miss remains open. Both entries ready/current Driftwood, errors0; browser/preview release0. One non-quiet observation with intervening shared changes, no isolated gain claimed. Raw tmp/sp-x1-dw-baked-poses/pair/receipt.json; modeled page charges below. No whole baked span attributed to pose CPU. | bounded slice |
| **G782.S10 — in flight (2026-10-27, sp-x1; source `965ae4042e`; reading complete, timing/cadence miss remains open)** | Largest unowned DW cold span: parked draws3.359s/142objects on61885 (a615 reading). Bounded first-fit upload packing within64 ordinary opaque objects; hooks/special draw kinds preserve their cursor. Re-run the original material/binding/byte/draw-cap planner with fresh pipeline accounting and use the candidate only for strictly fewer slices. Never skip a drawable by a family key; exact warm receipts/disposal remain. Oversized uploads stay alone, every submitted slice still waits for a completed frame, and WebKit live/held/desktop caps remain unchanged. O1 explicitly releases this path; node signatures/reads/decodes/retention remain with owners. | Engine/scoped fixture types and named typed lint pass; required ratchet attempted (foreign shard growth). All12 parked receipt/cap controls pass9.39s, including full draw/frame/byte coverage, oversized-alone, hook/transparent barriers and independent distinct-program/tie planning. One original phone4x cold/warm pair on965ae4042e (contains source965ae4042e): 16.487/10.234s request→commit versus8/5s; entry p95/max50.1/150.0ms/33.4/100.0ms. Assembly construction1.316/0.309s, scene2.373/1.569s, owned library1.728/0.899s, baked1.383/0.850s, compile4.064/2.099s, parked2.128/1.967s; planned slices64→62/62→59 cold/warm, drawn142/161. timing/cadence miss remains open. Both entries ready/current Driftwood, errors0; browser/preview release0. One non-quiet observation with intervening shared changes, no isolated gain claimed. Raw tmp/sp-x1-dw-parked-pack/pair/receipt.json. No node signature, decoder/read, retained-world or cap change. | bounded slice |
| **G782.Sky3 — in flight (sp-x10;47140a2a2d +5b615f7a3d; reading completed, G782 misses open)** | Explicit T3 revisit reuse of fixed buffered world geometry under the existing asset budget. Independently charged CPU/GPU from birth prevents recycled-sim-ID coverage; idle storage is pressure-evictable, active leases protected, disposal invalidates keys. Exact content/tier/count/policy keys; fresh root/LOD/mesh/material bindings. Fixtures cover warm identity/signed zero, repeated sim IDs, covered-alias refusal, pressure eviction/rebuild and key separation; types/lint/ratchet pass, fixtures unexecuted under G769. | One original cold/warm pair on8f42a7bcdf:15.035/12.936s request→commit, both FAIL8/5s. Ready/current Sky; errors/skipped/contextLost0. Frame p95/max33.4/116.6ms cold,33.4/50.1ms warm. Actual buffer trace cold1miss/warm1hit, build37.5/25.1ms: mechanism proven, small span and no isolated speed claim. World2.382/1.013s; parked217draws/7.002–6.996s; shaders-and-composer2.898/2.259s. Owned loading272.70MB/playing271.92MB; whole-page commons95.45MB both, not attributed to this cache. Raw tmp/sp-x10-d12/sky-reuse-pair/receipt.json and sky-reuse-summary.json; original cold entry/departure/warm return verified; browser/preview released. | bounded slice |
| **G782.Sky4 — in flight (sp-x10; source8091d4ca62; original reading complete)** | Overlap at most4 painted-model read/parse tasks in the generic model library paced path. The default rig parser still serializes native decode and shares its existing8ms WorkSlice; caller pauses remain in original row order and count. Stop admitting suffix rows if a pause refuses, then drain all started reads before rejecting/releasing input ownership. Missing-row/source errors and cache publication remain original. Current8f42 Sky cold library1653ms includes heroes1443.5ms; warm heroes0.7ms. Add actual-library fixtures for initial4-read overlap, all6 original pauses/atlas/channel identity, and cancellation drain/no suffix. Touched types, named typed lint and staged ratchet; fixtures unexecuted under G769. | Exact8091d4ca62 original cold/warm12.217/7.484s still FAIL8/5s; world2.854/0.844s, cold library1.874s/heroes1.593s (prior1.444s), so this read-overlap gain is unproved. Parked217draws3.398/2.465s and compile2.394/1.864s reflect combined renderer source. Original ready/current, errors/skipped/contextLost0; p95/max33.4/116.6 cold,33.4/50 warm. Owned loading272.70/272.34MB, playing267.75MB. Raw tmp/sp-x10-d12/sky-painted-pair/receipt.json; browser/preview released. Parent G782 remains open | bounded slice |
| **G782.Sky5 — in flight (sp-x10; sourceeb90b506c0; strict engine fix2b818c95c5; original reading complete; parent timing open)** | Generic atlas-only intake for separately prepared geometry: static GLBs keep native scene/primitive order, image/material/sampler/UV transforms and the shared serial8ms parser budget while skipping unused source mesh decode. Animated/skinned/morph/instanced/Draco or non-triangle documents retain original full intake. Native-parser fixtures cover first-map order, reused mesh node tags, actual sampler/UV transforms and animated fallback; types/lint/ratchet only per G769. No geometry, draw, material, residency, cap or shader changes. | Targets cold Sky heroes1.593s on8091d4ca62. First pinnedeb90 preview refused title closure before browser (3,657,124 raw/1,130,997 gzip B); boot fixcf053a2cde already landed. Shared2b818c95c5 refused boot file-name grammar (sp-x8 build4412; boot fix2f6ec005df). Shared2f6ec005df then refused ambiguous src/shardSelection.ts root (sp-x9 build4406,41.00s); routed to sp-x9, no unchanged retry. All original refusals retained. Guard-green productionb3b7b0bcd3 original phone4x/DPR2 cold/warm12.197/7.102s still FAIL8/5s. World3.127/1.505s; cold heroes0.980s versus prior1.593s, with intervening source/mode changes and no isolated gain. Warm buffers hit (build15.1ms). Parked217draws2.665/1.833s, shaders/composer3.596/1.601s, compile2.125/1.198s. Ready/current Sky, page/transport errors0, skipped0/contextLostfalse; frame p95/max33.4/166.6ms cold,33.4/66.8ms warm. Owned loading272.704MB/playing271.924MB both. Cold prior worlds0, actual departure then warm prior1; no profiler/GLobserver, nonquiet observation. Raw tmp/sp-x10-d12/sky-atlas-pair/receipt.json; browser and shared preview use released. Actual engine tsc-b passes after narrow bracket fix. | bounded slice |
| **G782.Sky6 — in flight (2026-10-27, sp-x10; source32e7641949; original reading complete; cold miss open)** | Native foundation checkpoints: cheap completed stages share the existing local/page CPU slice; a spent local or shared-frame budget keeps the injected pause. Retirement is checked before/after every checkpoint; original nav/look/shell overlap, ordered ground/collider/terrain/forest installation and readiness remain. X8/X9 confirmed this seam free. Five controls cover cheap/spent/shared budget, retired owners, draining pauses and original refusal propagation; actual game/scoped types, typed lint and staged ratchet pass, controls unexecuted under G769. | Restricted cb333 phone4x CPU diagnostic: native.foundation1413/1566ms elapsed; idle627/645ms, Game.loop358ms cold, direct regionalWorld frames54/43ms inclusive (not disjoint totals). Ground plan parse is only9/6ms; no duplicate-parser/collision change justified. Cut task handoffs for cheap stages under the same budget. Profile is not a qualification pair; tmp/sp-x10-d12/sky-foundation-cpu.json and sky-foundation-profile/receipt.json; browser/shared use released. One original production32e7641949 phone4x/DPR2 pair:10.2466cold/0.0356warm s, cold FAIL8s/warm PASS5s. Cold world2.624s, scenes2.526s, native.foundation1.289s, library1.521s (heroes0.982s), compile2.026s, shaders/composer3.464s, parked217draws1.807s. Warm re-enters the retained last-built cell (peer b7d6c8b728): no new world/foundation/shader/parked build; do not report old cumulative preparation as new warm work. Actual cold0priorworld/departure/warm1priorworld; ready/current Sky, page/transport/console errors0, skipped0/contextLostfalse. Entry p95/max33.4/116.7ms cold and33.4/33.5ms warm pass. Owned loading272703920/271976004B, playing271923818B both; process totals informational. Exact tmp/sp-x10-d12/sky-foundation-after-pair/receipt.json and sky-foundation-after-summary.json; browser/preview released. Combined renderer/retention changes prevent isolated checkpoint gain; cold timing remains open. Latest original shared production9738809b3f pair:11.0156cold/6.0990warm s both FAIL8/5; warm actually rebuilds. World2.856/1.472s, foundation1.355/1.325s, cold heroes0.880s/warm0; shaders/composer3.693/1.271s, compile2.229/0.893s, parked217draws1.859/1.399s. Ready/current Sky, page/transport/console errors0, skipped0/contextLostfalse; frame p95/max33.4/83.4cold and33.4/33.5warm pass. Owned loading272867606B/playing272087504B both. Fresh browser cold0priorworld/departure/warm1; no profiler/GLobserver, nonquiet. Exact tmp/sp-x10-d12/sky-repaired-pair/receipt.json, sky-repaired-summary.json; browser/shared use released. Warm portrait becomes dark/noisy versus clear same-pair cold and32e warm: visual acceptance open/routed O3, defining visual SHA unproved. Intervening shared changes; no isolated checkpoint gain. | bounded slice |
| **G782.Sky7 — in flight (2026-10-27, sp-x10; source3bc5238032; original reading complete, cold miss open)** | Overlap verified presentation collider/material input with existing nav/look/native-shell and ground setup. Materials remain private under the same resident; look/scene/tile bindings and library reservation stay at the original presentation cursor. Capture rejection immediately; earlier native/ground failures win and drain started inputs before owner teardown. Preserve cef103 overlap, exact ground/collision order, all guards and shared CPU/read budgets. Add Developer-only input/wait spans for attribution. Actual game types, named typed lint and scoped staged ratchet pass; no pre-land build/test/browser. | Targets remaining foundation1.355/1.325s on973, not a native CPU claim. One original production3bc5238032 phone4x/DPR2 pair:11.2007cold/0.0336warm s, cold FAIL8/warm PASS5 through last-cell retention. Cold presentation inputs172.9ms, original handoff wait0ms: overlap completed, but total foundation1.3566s and world3.0903s show no overall gain. Cold scene3.0035s, compile2.1286s (361jobs), shaders/composer3.6351s, parked217draws1.9985s. Warm performs only activation32.1ms; old cumulative preparation is not new warm work. Actual cold0priorworld/departure/warm1priorworld; ready/current Sky, page/transport/console errors0, skipped0/contextLostfalse. Frame p95/max33.4/116.6cold and33.4/33.5warm pass. Owned loading272706272/271978356B, playing271926170B both. Nonquiet, no profiler/GLobserver; combined code-pack/render/retention changes prevent isolated timing gain. Exact tmp/sp-x10-d12/sky-presentation-pair/receipt.json and sky-presentation-summary.json; browser/shared use released. Retained warm portrait is clear, which does not qualify the973 rebuilt-warm dark/noisy refusal; that remains routed separately. Cold G782 remains open. Shader/composer, parked submission and peer worldScenes hunks untouched. | bounded slice |
| **T5 — done `c2bd2b6164`** | A bigger per-frame build budget while held at the wall (`framePacing.ts:68`, `workSlice.ts:19`); no gain in Chromium at 60 fps, may matter on the phone at 30 fps | unproven | 0.5 day |
| **T6 — done `e04f9682da`** | Honest labels: the warm-up is reported as warm-up, not 'Gameplay and saved state' (`cellLoading.ts`) | — | 0.5 h |

T2 + T3 + T4 bring Pine → Sky from ~11 s to ~5 s. Pine (~32 s) and sub-5 s everywhere need **T1**. Order: T4 and T6 at
once (small), T2 and T3 in parallel, T1 as the main row from now. **Done when** every crossing into every neighbour
cell is under 5 s warm and under 8 s cold in Chromium at phone tier (G782; was: warm only, under 5 s), measured with the
audit's harness (handed to the builder).

T7 source boundary (2026-10-27, sp-x8; `379647e12b` + `e5f73af853`): declared tiled destinations prepare only the approached entry render ring on the road. Their regional constructor waits for actual crossing demand; opaque/non-tiled callers keep the previous constructor path. Entry admission, two-resident accounting and every readiness fence remain. Cold/warm G782 timings are still unqualified; one reading remains at the plan end.

G780 end-reading attempt (2026-10-27, sp-x8): pinned `46cbe1f4076905ff8d82d482ba11b5be5334d853` production preview refused generation after 25.67 s: `Missing map world geometry cascade/mooringLines`, `tmp/serve/failed-20261027-021509-4407.log:391`. This is D47 (`c7a57488e4`, sp-x10), routed with the exact log to sp-x10 and sp-ci-deploy. Zero browser/native samples; no cold/warm or frame-floor verdict. The rows stay in flight (reading at plan end), blocked on that producer prerequisite; Nalati stays behind the G782 bar. No repeated build, Simulator visit or guard change.

Cause-fixed G780 build (2026-10-27, sp-x8): pinned `8422baac07cf35e13af8dd23bf504117351540f7` contains D47 fix `15f149539c`; its actual map and normal generation pass. Product admission then refuses new Nine coarse L1 costs from `82ac81812d` (sp-o5, G748.6): tile/1/1/1 compressed 530,372 B, 10,160 triangles, 17 draws against 200,000 / 10,000 / 2. Exact log `tmp/serve/failed-20261027-022131-4407.log:901`; 66.12 s, zero browser samples. Routed the producer to sp-o5 and sp-ci-deploy; no allowance change, source patch or repeated build. The single cold/warm reading remains blocked; no G782 or frame-floor acceptance.

T7.2 render-first approach (2026-10-27, sp-x8; source `eb322baa11`): neighbour tile admission exposes a private render-ready boundary after verified materials and tile offer, before life-script and panel admission finishes. Render-only entry pins may start there; entered-data preparation still awaits the original full admission, including input cleanup. Failures remain observed, no simulation/readiness/cap is published early. Game/test types, typed lint and scoped ratchet pass; cold/warm timing is unqualified, in flight (reading at plan end).

T7.3 approach-pin retarget (2026-10-27, sp-x8; source `7bdee7d1ad`), in flight (reading at plan end): a destination-local entry tile is part of the speculative render-pin identity. A sideways/diagonal approach crossing that tile boundary aborts its old pin before acquiring the replacement; movement inside one tile reuses it. No regional constructor, residency allowance or readiness rule changes. Game/test types, typed lint and scoped ratchet pass; quantized-retarget controls added but unexecuted under G769; timings unqualified.

T7.4 critical entryway prepin (source `7e6ab09316`), superseded by T7.10 (`e38c4ef905`): neighbour prediction now pins only the approached local ring. The original full critical-entryway requirement stays on actual entry.

T7.5 tile caster CPU (2026-10-27, sp-x8; source `3cfa15a0ff`), in flight (reading at plan end): scan missing ordinary static geometry boxes in exact incremental steps under the existing construction budget before tile shadow classification. Preserve native world-box arithmetic, traversal order and every floor/glow/caster rule; custom, shared and dynamic sources retain native bounds. Owner/mutation fences abandon partial scans. Game/test and fixture types, typed lint and scoped ratchet pass; native-box/shadow controls added but unexecuted under G769. No G782 gain claimed.

T7.6 tile transport batches (2026-10-27, sp-x8; source `e6bf0d6b4e`), in flight (reading at plan end): overlap independently verified terrain, props and additional-file reads in batches of four. Keep lease acquisition first, drain each started batch before refusal, retain terrain-before-props construction and recheck the tile owner before allocation. No readiness/publication or byte-budget weakening. Game/test and fixture types, typed lint and scoped ratchet pass; bounded-read/drain controls added but unexecuted under G769. Cold/warm timing unqualified.

G780 end-reading build (2026-10-27, sp-x8): observed pin `06fece602c882d98dcffce9cd98f2ce2318ca8fa` passes the repaired Pine closures, then refuses Far Reach phone wire 34,546,324 B against 33,800,000 B after 62.60 s (`tmp/serve/failed-20261027-041552-4407.log`). Zero browser samples. D76 records x1's exact inventory attribution: coarse L1 props from `60535f5995` (sp-o5) plus owned vane/rest pools; the named pools alone fit. Producer reduction is routed to sp-o5, with no cap change or unchanged retry. T2/T3/T4/T7 remain in flight; G782 cold/warm timings and frame floor are unqualified.

Next cause-fixed G780 preview (2026-10-27, sp-x8): observed pin `222e6120f2940de8c851c121e203a24765710d48` contains D76 fix `61ea0216c8` and passes Far Reach phone wire. Normal generation tail then refuses Nalati manifest binding `./data/navigation.generated.json` after 65.69 s (`tmp/serve/failed-20261027-042541-4407.log:330`). Routed to the Nalati producer owner; zero browser samples, no G782 or frame-floor verdict. No handwritten output, guard change or unchanged retry.

G780 current producer boundary (2026-10-27, sp-x8): the next preview pin `a818b83e2817b7b9ef098e918a2034dbae4ee9e0` contains all T3.12–T3.14 and T4.4 source plus D80 fix `f3f374bd1d`. It passes the Far Reach wire and Nalati navigation boundaries, then refuses Pine phone wire 104,750,343 B against 91,700,000 B after 57.87 s (`tmp/serve/failed-20261027-044053-4407.log:625`). This is the already-recorded D82, assigned to sp-o3; sp-o1 forwarded the exact frozen reading. Zero browser samples. No cold/warm or frame-floor acceptance, extra capture, cap change or unchanged retry; T2/T3/T4/T7 remain in flight until the producer permits the plan-end reading.

T7 source-end candidate (2026-10-27, sp-x8): `96cf4467ca46152a047c1e0cd75ae4adfe57114e` contains render-only neighbours `d27bab4e35`, requested-entry installation `17a5b1a5c0`, departed-world retirement `7a06597f33` and local-ring pins `e38c4ef905`. D82 now has its producer fix; this preview stops instead at Nalati config Node/compiler imports after 3.70 s (`tmp/serve/failed-20261027-050933-4407.log:21`). Defining capability repair routed to sp-x6, zero browser samples. T2/T3/T4/T7 stay in flight; no cold/warm, frame or memory acceptance.

T7 follow-on build (2026-10-27, sp-x8): exact `0a00371960dfc8556e40734eadcf201506d382c9` passes the original config import guard, then stops at Nalati `_os.platform is not a function` in 3.88 s (`tmp/serve/failed-20261027-051135-4407.log:23`). This is D89 (`84f8c96ab8`, sp-x6 weather compiler dependency), routed without a source/guard waiver. Zero browser samples, no remaining owned preview or build, no unchanged retry. All timing and frame rows remain unqualified.

Plan-end producer continuation (2026-10-27, sp-x8): exact `05f36994af3abdba6cf24434be062b2feba1c364` includes weather parser fix `44f066b767`. D89 passes and all six products build. Final wire census refuses Nalati 95,433,261 B against 89,713,980 B (delta 5,719,281 B); all other five shards pass their wire ceilings. Build exits1 after 58.53 s (`tmp/serve/failed-20261027-051828-4407.log`). This is existing D92; per-file tier/content attribution routed to sp-x6. No ceiling change, unchanged retry or browser/Sim samples. T7 and G782 cold/warm/frame/memory qualification remain in flight.

T7.13 / D85 pin stability (2026-10-27, sp-x8), in flight (reading at plan end), source `8343e669f8`: the actual retained focus after migration is49pass/3fail; the three strict pin cases expose stationary proximity fallback repeatedly choosing the departed home. Preserve the verified render owner until an explicit heading or the distance fence replaces it, and exclude the departed cell from wall-only fallback. Constructor, readiness, pin retarget/abort and source retirement rules stay unchanged. Original ownership assertions remain unchanged; current game/test types, named typed lint and scoped ratchet pass. Repository-wide ratchet still reports independent shared count drift. Post-landing focused recovery follows.

Current T7 source task is built in `d27bab4e35` (render-only neighbours/four-product cap deletion), `17a5b1a5c0` (requested-entry installation), `7a06597f33` (departed-world retirement/stale-request fences) and `e38c4ef905` (local ring pins). No whole-world warmAhead/installAhead or paired-world budget port remains in live/liveSession/hybrid. Sp-o4 owns the disjoint T2 shader-prebuild seam. Per the coordinator G780 call, no further per-slice previews: D92 is fixed `fffc90950a`, and the one plan-end cold/warm Chromium reading runs only when every row is built and the coordinator calls it. Timing/frame/memory acceptance remains in flight.

D85 pose-only continuation (2026-10-27, sp-x8), source `3070a9a067`: `8343e669f8` fixes departed-home selection, reaching50pass/2fail of52. Retaining a cell identity must also retain its exact pin: stationary/teleported samples cannot reproject it to another local tile. Only a genuine named moving/boulevard approach may retarget the held owner; distance release and actual crossing authority remain unchanged. Both strict redirect assertions and the real diagonal-retarget control remain unchanged. Types, typed lint and scoped ratchet pass; post-landing focus follows. No preview or timing reading is queued.

D85 closed (2026-10-27, sp-x8): `4dbf4b1160` migrates every retained oracle; `8343e669f8` prevents departed-home pin theft, and `3070a9a067` prevents pose-only retarget. The same isolated real-Rapier retained group now passes52/52cases in3.81s (48warm-neighbour +4cardinal; tmp/sp-x8-g717/t7-retained-final-verdict.log). The strict pin order/abort assertions and genuine diagonal retarget remain unchanged; stale-frame, source retirement, failed-disposal charging and original refusal identity controls all pass. Root app setup separately refuses missing FarReach discovery; no global-suite pass is claimed. Types, typed lint and scoped ratchet pass. T7 source is built; G780 timing/frame/memory acceptance stays in flight. The coordinator latest call authorizes one waiting HEAD preview/reading after `fc3adf7d8e`; no per-slice retries are queued.

Called HEAD preview (2026-10-27, sp-x8): exact `efcc132fd740ced2ce34cab4b24b447fbfdf6c89` includes the complete D85 source fix and T7 deletion slices. All six products and phone-wire ceilings pass (Nalati93.53/96.25 MB). Generation tail then refuses Pine manifest generator-spawn binding after28.88s (`tmp/serve/failed-20261027-053643-4407.log`, authored-manifest.mjs:116). This is D58, already fixed forward by later `d1308217c1`, not a T7 assertion failure. Zero browser/Sim samples, no ready server or owned build remains. No second preview/retry queued; the one G780 timing/frame/memory reading remains at plan end on the coordinator call.

## G780 / G782 plan-end reading — 5f1eadb19e (2026-10-27, sp-x8)

Driftwood/Sky build `5f1eadb-mvql4kya`; Pine/Nalati use the separately identified current shared repair preview. Three independent fresh-browser cold/warm pairs per destination, in DW → Sky → Pine → Nalati order. Each cold browser starts from admitted Template2 road recovery; its target has not constructed a world. Warm is a completed first entry, real road departure and re-entry in the same browser, retaining its caches/programs. This differs from the older shared-document “warm” cohort that did not deliberately prime every destination.

Pine/Nalati use D97-fixed pin `bc0c7cf54f8529d6923584e4f57d0fa79dca66c2`; their prior refused cold entries on5f1 and invalid warm priming remain retained separately.

iPhone16Pro, phone tier, live clock, CPU4x, render DPR2, muted, Metal; maintained held-input road plans and all route/readiness/visibility witnesses. Existing drawn-frame, hook, preparation-stage and residency probes only; profiler/GL observer/forced GC off. Detailed process dumps occur outside timed windows. Other permitted lane browsers overlapped; these are containing-build readings, with no isolated source-gain or native Safari claim. Request → commit uses actual commitEnd − requestedAt (activation is retained separately).

| Destination | Cold runs 1 / 2 / 3 (s) | Warm runs 1 / 2 / 3 (s) | Pass cold <8 / warm <5 | Worst entry p95 / max (ms) |
|---|---:|---:|---:|---:|
| Driftwood | 16.482 / 15.518 / 17.170 | 13.534 / 13.384 / 16.067 | 0/3 / 0/3 | 50.1 / 316.7 |
| Sky Reach | 24.668 / 24.946 / 26.716 | 20.366 / 22.767 / 22.297 | 0/3 / 0/3 | 33.4 / 200.0 |
| Pine | 35.665 / 36.115 / 35.845 | blocked / blocked / blocked | 0/3 / 0/3 | 50.1 / 183.4 |
| Nalati | blocked / blocked / blocked | blocked / blocked / blocked | 0/3 / 0/3 | blocked |

All misses stay open. T2, T3, T4 and tile T7 retain their landed source, with G782 acceptance open. Grid-ready remains9/10 under G784; Nalati stays open until its own cold and warm bar passes. These timings do not undo existing independent readiness latches.

Long-frame provenance below groups measured entry-drive intervals >100ms by overlapping completed/current runtime hooks; between-hooks intervals remain unattributed. These windows identify ownership for follow-up, not a sampled native/JavaScript stack or a uniquely established breaking commit. Where fewer than three long-frame categories exist, every observed category is listed rather than inventing another cause. The three largest non-wrapper preparation spans are elapsed envelopes, include yielded/drawn-frame waits, and must not be added to overlapping stage totals.

| Destination / mode | Three largest non-wrapper preparation spans (worst observed s) | Top three long-frame windows: count / max ms |
|---|---|---|
| Driftwood cold | parked-draws 5.638; compile 4.189; world 3.988 | between hooks / not attributed: 10 / 166.7; driftwood-isle:activate: 1 / 316.7; driftwood-isle:afterPlay: 1 / 116.7 |
| Driftwood warm | parked-draws 5.637; world 4.043; compile 3.606 | driftwood-isle:world: 3 / 150.0; driftwood-isle:afterKit: 1 / 100.1 |
| Sky Reach cold | parked-draws 15.707; world 3.226; compile 2.916 | between hooks / not attributed: 3 / 200.0; far-reach:world: 1 / 116.7 |
| Sky Reach warm | parked-draws 15.496; compile 2.479; world 1.414 | none >100ms |
| Pine cold | parked-draws 14.648; world 7.294; compile 5.111 | between hooks / not attributed: 4 / 183.4; pine-hollow:world: 4 / 150.1; pine-hollow:afterPlay: 4 / 116.8 |
| Pine warm | runtime blocked | no qualified drive (runtime refused) |
| Nalati cold | runtime blocked | no qualified drive (runtime refused) |
| Nalati warm | runtime blocked | no qualified drive (runtime refused) |

Scheduling finding: the observed iPhone16Pro user agent takes the existing WebKit branch in `Game.warmEnteredStages`: `LIVE_PARKED_BUDGET` permits one drawable per completed game frame even while held (source `1a9e7dc761`). Sky records465 parked drawables in15.531s cold and15.494s warm in pair2 (~33.3ms per drawable). This directly explains the parked-draw elapsed floor on this protocol; it is not evidence that every interval is a CPU or native long task, and no claim is made that this commit alone introduced every crossing miss.

Runtime refusals: old-pin Pine cold1/2 are D97, diagnosed and source-fixed by `bc0c7cf54f` (the chapter page still named the all-zero lead artifact); those failed entries cannot prime warm visits. Repaired-pin Pine warm visits refuse after cold succeeded: D103, `Disposed asset still acquired: renderer:shadow:<uuid>` during source retirement, then `Unready live frame preparation`; sp-o4 owns the shadow ledger boundary. The original guards remain intact. D106: Nalati cold visits on both pins refuse during the world hook with `Failed to fetch`. Sp-o1 proved the defining cause on5f1: `4a5a2ed0cd` (sp-o5) ships `models/cover-{phone,desktop}.bin` raw while the books still declare lane-deflated packs. `specimenCatalogue.ts:393` → `decodeLaneBytes` → `deflate.ts:28` passes raw data to `DecompressionStream`, which throws TypeError “Failed to fetch”. There is no failed request or asset404; the empty passive ledger is consistent. Producer repair is routed to sp-o5. No failed case receives a synthetic request-to-commit time.

Raw paired witnesses and compact strict summary remain at `tmp/sp-x8-g782/`; all samples bind the exact full pin. No timeout, budget, resident guard, pixel, collision, readiness or source fence changed. No repeat/Sim visit is used to turn a miss into a pass.

### D103 single defining repair pair (separate from the three-run cohort)

Shared source `db62fede6c` (full exact pin verified by the runner): cold 33.317s, warm 32.415s request→commit. Both complete/errors0, currentPine/gameplayReady, issues empty including cleanup. Entry p95/max cold 50.1/150.0ms, warm 50.0/150.0ms. The strict shadow-ledger failure is qualified fixed in this actual visit; both G782 timing gates still fail. This is one source-fix pair, not three new warm passes, and it does not replace the original refused observations.

Independent T7/S3.7 retirement reader on5f1 refused both Resident and Tiles home seeds at the unchanged120s allowance before any held-input leg or before/after census. `tmp/sp-x2/tile-plan-reading/reading-5f1/reading.json` and `run-ready.log`; no0ms/0MB or eviction qualification. T7/S3.7 stays open.

## Nalati repaired-runtime G782 reading — 325740f3a5

Sp-o1's three original fresh-browser cold/warm pairs (same maintained x8 protocol,
phone4x/iPhone16Pro/DPR2/muted, profiler and GL observer off) all complete with
errors0. Cold request→commit27.685/29.912/32.390s; warm19.569/20.783/21.301s.
All six miss G7828s cold/5s warm; G784 remains open. This containing pin includes
c4ddbdb2cf, b8e3c244f4 and325740f3a5; the earlier runtime refusals remain retained.
Parked218draws cost7.231–7.516s every visit; shaders-and-composer3.852–7.746s,
including compile2.856–5.745s. Worst drive p95/max66.6/316.6ms; no sampled
CPU/native long-frame attribution is claimed. Shader/composer belongs sp-o3,
parked-loop sp-o1; these nested spans cannot be added. Raw source receipts were
tmp/sp-o1/nalati-g782/pair-{1,2,3}/receipt.json, consumed into compact
validated tmp/sp-x8-g782-cuts/nalati-325-summary.json before owner cleanup.
Grid-ready's matching G784 receipt is bf21ff8727; no duplicate visits.

## G782 DW owned-library cut reading — e067e8ce05

Exactly one original cold/warm pair ran on committed
`e067e8ce0540047686b6c999fb86125687ffc8e2`, including S3 admission slicing.
The pinned devserver preview builds successfully (153.21s, all products;
product step80s, app25s). The original phone4x/iPhone16Pro/DPR2/muted
Chromium route starts in a fresh browser at Template2, never having
constructed DW; warm requires completed cold entry and actual departure
in that same browser. No profiler, forced GC, Network bodies, extra
observer or second pair. The reading is non-quiet; no isolated source
speedup or physical-device claim follows.

| DW visit | Request→commit s | Entry p95 / max ms | Scene / library s | Compile / parked s | Owned loading / playing MB |
|---|---:|---:|---:|---:|---:|
| Cold | 25.067 | 66.8 /183.3 | 3.663 /2.972 | 6.882 /4.999 | 304.802 /297.036 |
| Warm | 15.550 | 50.1 /116.7 | 1.393 /1.026 | 4.163 /5.635 | 304.802 /297.036 |

Both visits finish current/ready DW with errors0, skipped0, contextLost
false; unchanged8s cold/5s warm timing bars FAIL. Entry max stays below
200ms but p95 exceeds35ms, so the cadence gate also fails. The native
foundation is605.1/459.0ms; the world hook is8.454/3.154s, an aggregate
phase wall span, not sampled CPU. Library detail cold/warm: cargo188.3/
117.6ms, native specimens32.2/6.0ms, reef345.9/64.6ms, rocks236.5/334.6ms,
foliage1702.9/281.5ms and cascade464.6/221.6ms. Placement admission81.1/
64.6ms. The warm completedPreparation buffer retains old cold whole
spans; they are not relabelled fresh warm work.

Raw `tmp/sp-x1-dw-library/pair/receipt.json`; scalar summary
`tmp/sp-x1-dw-library/summary.json`. Existing x8 post-bca baseline22.346/
14.349s predates both S3/S4 and other intervening shared changes. Current
values do not establish a gain or sole regression cause. Parked/shader
work remains with its owners; forest input overlap remains x8. The
largest remaining input observation is cold owned-foliage1.703s, a
library wall span requiring read/decode separation before CPU attribution.
G782 and T3 remain open. No timer, threshold, content, cache-lifetime,
lease, collider or readiness policy changes. Original reader exits0;
all browser resources close and preview4410 is released (exit0), with no
repeat queued.

Forest input126cf532b0 affected Pine read (2026-10-27): all5 input controls
pass, but the single unchanged cold/warm protocol on containing126cf refuses
cold in parked-draws after the unchanged30000ms bound. No cold commit was
recorded; warm correctly refuses unprimed. Exact raw
`tmp/sp-x8-g782-cuts/ground-pine-hollow/receipt.json`; no timing or forest gain
claimed. O1 owns the parked-loop cause:490e215711 grouped several slices in one
6ms JS budget but backed up native first-pipeline work;0cea9b55cc restores one
slice per completed frame while retaining exact receipt skips. The next affected
Pine pair must contain8bb73bf165 +0cea9b55cc. Browser and4406 use released.

## Pine scheduling containing-build reading — b79fe6a53c

One unchanged cold/warm pair, phone4x/iPhone16Pro/DPR2/muted, current live
clock and actual road departure/re-entry. This pin contains126cf532b0 ground
input overlap,8bb73bf165 arrival selection,0cea9b55cc parked stall repair,
and67c0ccf600 shader work plus peer changes. Both complete/errors0; no isolated
per-commit gain or native Safari claim. Browser and own4406 borrower released.
Raw tmp/sp-x8-g782-cuts/arrival-pine-hollow/receipt.json; compact
arrival-summary.json alongside it.

| Visit | Request→commit (s) | World forest-page / props (s) | Compile / shader-composer (s) | Parked draws (s / units) | Drive p95 / max (ms) |
|---|---:|---:|---:|---:|---:|
| Cold |40.832|8.094 /1.850|4.449 /6.609|19.519 /417|66.7 /449.9|
| Warm |30.451|5.487 /1.478|2.975 /4.693|15.505 /421|50.1 /133.4|

Both G782 bars remain missed. O1's0cea closes the runtime parked-stall refusal;
the original failed126cf visits remain retained. O1 owns the parked pipeline
family cut; O3 shader/composer, X1 scene/library intake. Cold top measured
long-frame windows: afterPlay21/max449.9ms; between hooks3/max216.6ms;
world2/max150ms. Warm: afterPlay10/max133.4ms; world1/max133.3ms;
between hooks2/max133.3ms. These are hook-window provenance, not sampled CPU
or native attribution. Parked and shader envelopes dominate; nested spans cannot
be summed. T2/T3/T4/T7 and grid-ready G784 remain open against8s cold/5s warm.


G782.S5 reading (2026-10-27, sp-x1): pinned `0c907c46d6db15256950f681be8666b69c31d866`, one original cold entry, actual road departure and warm return in the same fresh browser. One original phone4x cold/warm pair on0c907c46d6: 20.047/13.251s request→commit against8/5s; entry p95/max 66.6/183.4ms/50.0/116.6ms cold/warm. Scene2.179/1.152s, owned library1.665/0.715s (foliage0.215/0.172s), compile5.709/3.022s, parked4.800/5.366s. Raw tmp/sp-x1-dw-ahead/pair/receipt.json; one non-quiet observation with intervening shared changes, no isolated gain claimed. Browser/preview cleanup exits0. Readiness/error/skip/context records: `[[true, "driftwood-isle", true, 0, false], [true, "driftwood-isle", true, 0, false]]` / errors `[[], []]`. Owned memory: cold loading304802230B/playing297036442B; warm loading304802230B/playing297036442B; browser/renderer/GPU process totals remain informational. Previous e067 pair25.067/15.550s predates this source and other shared changes; this is no matched causal comparison. Original timing/cadence/content/cancellation thresholds unchanged. Scalar summary `tmp/sp-x1-dw-ahead/summary.json`; preview/reading statuses0 and release0 in `run.json`.

## Held-frame range Nalati reading — 83e085769e

One original cold/warm pair, phone4x/iPhone16Pro/DPR2/muted/live clock, actual
cold entry plus road departure/re-entry. No profiler, GL observer or forced GC.
Both complete/errors0, skipped0, context intact. Cold29.736s; warm20.684s;
G7828s/5s remains missed. This containing build predates O1'se580168ca6
pipeline-family slice fix; no duplicate read of that later cut is substituted.
No isolated overall gain versus the three325 repaired-runtime pairs.

Cold compile5.558s, link1.197s, shader/composer7.405s; warm3.407/0.400/4.438s.
Parked218draws cost7.302/7.231s. These nested envelopes cannot be summed.
Cold drive p95/max50.1/233.3ms; warm50/166.7ms. Cold long-frame windows:
between hooks9/max233.3ms, world2/max150ms, play3/max116.7ms. Warm only
one observed category: afterKit1/max166.7ms. Hooks identify phase windows,
not a sampled native/CPU cause. No frame-floor pass is claimed.

Raw tmp/sp-x8-g782-cuts/held-nalati/receipt.json and portrait JPEGs; compact
held-summary.json alongside it. Both entered portraits have large opaque black
rectangles; cause/first bad SHA is unestablished, observed83 includes range,
material-twin and producer changes. Exact images were inspected and routed to
sp-ci-deploy for attribution; zero runtime errors does not qualify those pixels.
Browser and own4411 borrower closed. O2 owns held CPU budget/pacing next;
O1 parked pipeline-family slicing. The Game main-render mask has no unlanded
hunk and neither owner touches its synchronous restoration boundary.

### G782 parked-draws cut (sp-o1, 2026-10-27)

wildshard-new gave sp-o1 the parked-draws long pole (`src/engine/render/parkedDraws.ts`). One cold/warm pair per reading, sp-x8's `pair.mjs` protocol (iPhone 16 Pro phone, CPU 4×, DPR 2, muted, profiler and GL observer off), each on a shared preview pinned to the cut; request → commit, parked-draws elapsed.

| Cut | Pin | Nalati parked cold / warm | Nalati crossing cold / warm | Pine parked cold / warm | Pine crossing cold / warm |
|---|---|---|---|---|---|
| before (`325740f3a5`, three pairs) | `325740f3a5` | 7.23–7.52 / 7.23 s | 27.685–32.390 / 19.569–21.301 s | 14 s (sp-x8) | — |
| `490e215711` slices share a frame under 6 ms CPU; exact warmed-pipeline receipt skips re-draws | `de0f91141e` | 7.38 / 7.23 s | 29.584 / 20.398 s | stalled past 30 s (sp-x8, `126cf532b0`) | — |
| `0cea9b55cc` red-fix: one slice per completed frame again (the receipt stays) | `b79fe6a53c` (sp-x8) | — | — | 19.519 / 15.505 s | 40.832 / 30.451 s |
| `1440fb14df` a built native pipeline is not a new material | `1440fb14df` | 8.33 / 7.55 s | 25.231 / 19.098 s | 18.35 / 15.92 s | 38.600 / 31.984 s |
| `e580168ca6` a fresh binding over a built pipeline is not a first use | `e580168ca6` | 5.11 / 4.80 s | 24.220 / 17.216 s | 10.32 / 10.42 s | 28.831 / 28.268 s |

Every visit from `1440fb14df` on is complete with 0 errors; none meets the bar. Cause, from CDP counter breakpoints on `1440fb14df`: 241 parked slices a Nalati visit, 240 of one drawable. The iPhone 16 Pro profile's Safari user agent takes the WebKit branch (`LIVE_PARKED_BUDGET`, `newBindings: 1`, as the phone does), and each crossing rebuilds its world, so every drawable is a fresh exact geometry × material binding (and the exact receipt never matches a warm visit). The main thread sat idle: the warm entry profile charges ~1.5 s of CPU to the parked warm, the rest is one completed frame per slice. `e580168ca6` lets a binding all of whose materials have a built (or, earlier in the warm, planned) native pipeline (the renderer's program id × program shape × vertex layout × draw state × lighting / target) pace as a copy, still bounded by 256 KiB of new buffers, 8 drawables and one slice per completed frame; a new program still opens a slice. Pacing only, never a skip.

What remains, counters on `e580168ca6` (Nalati, both visits): 160 slices, 135 of one drawable; 74 of those are a drawable with over 256 KiB of new buffers (the WebKit live upload cap: one a frame, ~2.4 s); the others are skins (36 in Nalati), drawables with per-object callbacks or custom depth (outside the pacing) and the cold visit's new pipelines. Next parked levers: skinned meshes into the pipeline pacing (their bone texture is the only per-object upload); the 256 KiB live upload cap is the WebKit fence and moves only on a device reading.

| Cut | Pin | Nalati parked cold / warm | Nalati crossing cold / warm | Pine parked cold / warm | Pine crossing cold / warm |
|---|---|---|---|---|---|
| `c0008dd700` skins, points and lines pace by their built pipelines | `c0008dd700` | 4.22 / 3.87 s | 27.014 / 18.667 s | 5.50 / 5.59 s | 28.517 / 23.667 s |
| `193fae163d` draw-neutral callbacks pace as copies | `193fae163d` | — | — | 6.11 / 5.72 s | 31.600 / 26.182 s |

Skins halved Pine's parked draws (10.3 → 5.5 s). The draw-neutral marker gave Pine nothing: a classifier on `193fae163d` (CDP counter at `drawSlice`, both visits alike) finds Pine's ~96 one-drawable slices a visit almost all with default hooks. ~34 are over the 256 KiB live upload cap (D152, ~1.1 s); ~55 are pacing-eligible (programs present, default hooks) but open a slice as a new native pipeline, as many on the warm visit as the cold. The pacing keys a pipeline by the renderer's program id, and Pine's programs are released on leave and relinked on return (warm `compile` ~3 s, 627 units), so no warm pipeline is ever known. Keying by program source instead would vouch for native pipelines a fresh program object has not built (a fence weakening, not taken). The next parked lever is upstream: programs kept across visits (stable ids), which the pacing then reads as built; that is the compile / keep row (sp-o3).

Kept programs (wildshard-new: keep programs across visits, sp-o1): a counter probe on `c385b4fa31` found T2's `createProgramKeeper` already keeps Pine's programs (it pinned 167 / 203 live programs, under its 512 cap; all 168 cold program ids live on the warm return, link 0.67 → 0.33 s). What missed was the parked pacing key, which carried the scene's visible lights; `d99dc72ced` keys a native pipeline by program id, blend / depth / colour-write state, draw shape, vertex layout, draw state and target formats (the program id names lighting, fog, environment mode, tone mapping and shadow type). One Pine pair on `d99dc72ced`: cold 31.195 s (parked 5.55, compile 3.58, link 0.71), warm 23.117 s (parked 4.65, compile 1.75, link 0.47); complete, 0 errors, both over the bar. Warm parked fell ~0.9 s (about half the new-pipeline slices); the rest are slices over the 256 KiB live upload cap (D152) and programs the return links anew (35 warm-only program ids on `c385b4fa31`).

Pine cold (sp-o1, wildshard-new: Pine's cold crossing). Profile of the cold entry on `cb333defe3` (34.17 s): world hook 14.0 s (forest page 9.7 s: `forest.scenes` 4.96 s of which 2.0 s idle and ~130 ms of scene code; library intake 2.73 s, crags 1.53 s; `runtime.props` 2.06 s), afterPlay 13.2 s (shaders-and-composer 7.1, sp-o3; parked draws 5.5, sp-x1). `8cb38dd728` starts each owned scene model's read and decode up to four models ahead (taken in order). One Pine pair on `1d848bdfff`: cold 29.08 s (world hook 11.55, afterPlay 10.53, parked 3.49, shaders 6.70), warm 0.03 s (sp-x6's retention); library intake 2.73 → 1.69 s, crags 1.53 → 0.69 s, while the spans before it grew in that build (placement admission 0.14 → 0.89, native foundation 1.37 → 1.72; other commits or noise, one pair). What remains of Pine's world build is pacing-bound, not code-bound: `runtime.props` is 2.49 s with 1.14 s idle and ~100 ms of tile and placement code, and every span shows the same shape: a held entry's build gets at most min(budget, interval / 4, BUILD_FRAME_MS / 2) of each ~33 ms frame (`framePacing.frameBudgetSpent`), so each `buildYield` step costs about a frame. The next lever is the held-entry duty cycle (framePacing, sp-x8's scheduling), worth more than further per-span pipelining (~0.3-0.5 s each).


G782.S6 reading (2026-10-27, sp-x1): pinned `ae6587954819b7bd916b1e6e77875ff5b749e7b7`, one original cold entry, actual road departure and warm return in the same fresh browser. One original phone4x cold/warm pair onae65879548: 16.493/12.150s request→commit against8/5s; entry p95/max 50.1/116.7ms/50.0/100.0ms cold/warm. Assembly construction0.718/0.244s, scene2.246/1.069s, owned library1.657/0.608s (foliage0.209/0.174s), compile4.490/3.396s, parked4.032/4.238s. Raw tmp/sp-x1-dw-admission/pair/receipt.json; one non-quiet observation with intervening shared changes, no isolated gain claimed. Browser/preview cleanup exits0. Readiness/error/skip/context records: `[[true, "driftwood-isle", true, 0, false], [true, "driftwood-isle", true, 0, false]]` / errors `[[], []]`. Owned memory: cold loading304802230B/playing297036442B; warm loading304802230B/playing297036442B; browser/renderer/GPU process totals remain informational. Previous0c907 pair20.047/13.251s predates this source and other shared changes; this is no matched causal comparison. Post-landing focused assembly/construction guards39cases/2suites pass28.81s. Original timing/cadence/content/cancellation thresholds unchanged. Scalar summary `tmp/sp-x1-dw-admission/summary.json`; preview/reading statuses0 and release0 in `run.json`.

## Held-frame mask same-pin visual diagnostic

Two original Nalati cold entries on83e085769e093170068dc305c2b568e51af78fbc,
phone4x/DPR2/iPhone16Pro/muted, complete with errors0. The ON run exercised
the real mask813 times and hid up to55 meshes; the local, uncommitted browser
patch bypassed only FrameDrawRanges.draw (OFF746 active calls, zero hidden).
Both labelled entered portraits show the same opaque black rectangles. The
mask is ruled out for D154; first bad source remains unestablished, CI owns
attribution. Images and receipts: tmp/sp-x8-g782-cuts/held-ab-{on,off}/.
These are visual diagnostics, not additional crossing acceptance readings.
Both browsers and the owned4411 borrower closed; evidence sent to CI.

## Held cached compile scheduling reading — 4c1ff71e1a

One original fresh-browser cold/actual-departure/warm Nalati pair on exact
4c1ff71e1a61a805bc67ea9754b5b40ee39738ee, iPhone16Pro/phone4x/DPR2/muted,
profiler and GL observer off. All entries complete/errors0, skipped0/context
intact; non-quiet shared-machine observation, not an isolated timing comparison.

| Visit | Request to commit | Compile jobs / elapsed | Cached eligible jobs / CPU elapsed | Link | Shader/composer | Parked218 draws | Drive p95 / max |
|---|---|---|---|---|---|---|---|
| cold |24.652s FAIL8s|487 /4.7465s|1 /2.1ms|1.0991s|6.4795s|4.1647s|50.1 /266.6ms|
| warm |16.216s FAIL5s|489 /2.1846s|243 /224.4ms|0.4023s|3.2120s|3.8673s|50.0 /216.7ms|

The exact cached path is active for243 warm jobs but only one cold job. Against
83's compile5.5584/3.4072s, the observed values are lower; that pin predates other
held-CPU/parked/node changes, so no isolated gain is claimed. G782/G784 stay open.
The final link/upload fences, original side/native program cap and shared24ms
native limit remain; all39 post-land controls pass (cached scheduling, native
sides and variants). Engine/game types, named typed lint and scoped ratchet pass.
Engine-test tsc has only3 foreign parked-receipt TS2532 diagnostics routed O1;
full ratchet reports existing foreign generator/shard debt, not a clean pass.

The three largest long-frame windows are cold afterPlay266.6ms, between hooks
233.4ms and world133.4ms; warm afterKit216.7ms, world116.7ms and between hooks
116.7ms. These are hook correlations, not sampled CPU/native causes; first bad
SHA for the continuing floor misses is unestablished. Entered portraits still
show D154's black rectangles. The same-pin mask ON/OFF diagnostic above excludes
that mask alone; visual acceptance stays unqualified and CI owns attribution.
Raw: tmp/sp-x8-g782-cuts/cached-nalati/receipt.json; compact cached-summary.json.
Both browser and owned4412 borrower closed. No retry or official floor pass.

### Held CPU pacing follow-up (sp-o2 report, 2026-10-27)

964645b7b1 raises only the shared held CPU frame budget to72ms; native
compile/link/upload stays24ms and parked draws retain their own fences.
O2 reports one original pair per destination on c0db1d065a: Pine27.87/23.83s,
Nalati27.03/21.25s cold/warm, complete/errors0. Pine parked5.5s versus the
older15.5–19.5s dominates that difference, so the72ms change's own gain is
unproven. Forest-page remains7.26/6.19s; O2 owns the next profiled Pine pair.

X8's source audit finds no direct waitForDrawnFrame in clientForestPage or
forestPage. Placement uses slicer/macrotask/paceYield; regional runtime steps
use pacedResolve; layout and whole geometry use workSlice. Their local task
hops still consult the shared CPU fence. Tile attachments/scene preparation
can reach native GPU pacing; geometry read-wait/decode and image reads remain
other candidates. This is a source map for the profile, not a proven cause.
No source/pacing change or duplicate browser reading was made by X8.


G782.S7 reading (2026-10-27, sp-x1): pinned `6ab803377cef0f69fecbc9946859e604aa7fd40f`, one original cold entry, actual road departure and warm return in the same fresh browser. One original phone4x cold/warm pair on6ab803377c: 17.403/13.050s request→commit against8/5s; entry p95/max 66.7/183.4ms/50.0/116.6ms cold/warm. Assembly construction0.752/0.334s, scene1.450/1.542s, owned library1.089/0.960s (foliage0.143/0.228s), compile4.546/3.028s, parked4.905/4.099s. Raw tmp/sp-x1-dw-inventory/pair/receipt.json; one non-quiet observation with intervening shared changes, no isolated gain claimed. Browser/preview cleanup exits0. Readiness/error/skip/context records: `[[true, "driftwood-isle", true, 0, false], [true, "driftwood-isle", true, 0, false]]` / errors `[[], []]`. Owned memory: cold loading304802230B/playing297036442B; warm loading304802230B/playing297036442B; browser/renderer/GPU process totals remain informational. Previousae658 pair16.493/12.150s predates this source and other shared changes; this is no matched causal comparison. Post-landing resolved-library guards11cases pass10.47s. Original timing/cadence/content/cancellation thresholds unchanged. Scalar summary `tmp/sp-x1-dw-inventory/summary.json`; preview/reading statuses0 and release0 in `run.json`.

## DW read/decode attribution — e6f5e01410 (held72ms)

One fresh-browser profiled cold/actual-departure/warm pair on exact
 e6f5e01410b19869fceb4d474d2f291d14e68c4f (contains964645b7b1),
phone4x/DPR2/iPhone16Pro/muted, no GL observer or response bodies. Both
entries complete/errors0:16.2854/11.5834s request to commit, still8/5s misses.
Profiler overhead and other active lanes prevent clean timing qualification.

Observed completed fetches overlap74.2ms cold (26 requests) and13.6ms warm
(11) of the held windows. This is a union, not summed request time and not
proof of critical-path waiting; cache/hash/worker delivery is not all network.
Whole-geometry cold batch totals:93 read waits167.9ms,93 decode calls125.9ms,
113 assemblies94.5ms,231 yield checks34.0ms; enclosing spans are not those sums.
Owned-library windows736/822ms contain201.8/253.7ms sampled owned decode,
including134.2/193.9ms in quantized position reconstruction. Held main-loop
sampled inclusive5.351/4.120s, its live draw3.018/2.504s, idle2.830/1.978s;
these nested costs cannot be added. The loop finding was sent to O2, which
owns heldDrawDeferred/Game pacing; X1 owns resident template revisit retention.

The largest identified decoder-specific CPU pass is position normalization
followed by rereading Float32 positions through a second matrix pass. T4.8
fuses those passes with explicit intermediate fround, preserving every original
native channel, normal/tangent transformation, bound and final readiness fence.
No decode concurrency, read-priority, durable-cache or memory cap is changed.
Raw profile/request receipts: tmp/sp-x8-g782-cuts/dw-reads-before/receipt.json;
source-mapped held and library CPU tables sit beside it. Browser and4412 closed.

### DW profile closure and refused post-cut reading

Source5ea8b843ab and all11 focused controls are green, including Float32 byte
identity across planar/interleaved Int16 extrema, arbitrary grid scales and
translations, every transformed normal/tangent/channel, bound and original
non-grid refusal. Actual engine+engine-test tsc-b and named typed lint pass
following X10's metadata-key repair2b818c95c5. Scoped ratchet has no increase;
full lint:ratchet still reports foreign shard/generator debt.

The original e6f profile's disjoint sampled stack categories are:

| Category | Cold ms | Warm ms |
|---|---:|---:|
| live Game loop |5351.2|4119.9|
| geometry decode |443.7|404.0|
| precompile |2595.8|1659.2|
| idle |2829.5|1977.9|
| native/program |1675.1|906.9|
| GC |128.4|115.9|
| other CPU |3260.8|2399.2|

They partition the sampled held window; enclosing ownership/scene spans above
are inclusive and cannot be added again. Geometry includes owned/native GLB
and meshopt stacks; idle is not automatically transport or decoder wait.
Whole cold reader167.9ms read waits and125.9ms decoder calls are async elapsed
sums, not sampled CPU. Network74.2/13.6ms is observed fetch overlap only.
Drive p95/max66.6/149.9ms cold,50/100ms warm; both entries errors0/skipped0,
context intact. Compile4.1129/2.5159s and parked4.4303/4.1009s dominate the
remaining readiness envelope. The generic loop finding was shared with O2;
network-priority or decoder-concurrency increases were not justified.

The requested after pair has not started: the2b818c95c5 preview completes app
emission then refuses Invalid boot module file; cause-fixed0d4c (contains2f6)
passes that grammar and then refuses Missing or ambiguous boot module root
src/shardSelection.ts. Exact logs: tmp/serve/failed-20261027-091536-4412.log
and failed-20261027-091808-4412.log. Both are zero-sample prerequisites, not
failed crossing times. X2 attributed the83dff/2f6 batching family to X9;
canonical damage G782-Sky-boot-root and CI have both logs. No guard waiver,
private emitted-root repair, repeated route or blind preview retry is queued.
One affected DW pair remains pending the defining boot-root repair.

## Nalati warm-return attribution (sp-x6, 2026-10-27)

Coordinator requested attribution of the remaining ~21s warm return after
I11. One original cold/departure/warm pair attaches to the existing shared
65359f578afa875473f22a423d3044119e2a7f88 preview, with the maintained
G782 road driver, iPhone16Pro/phone/4x/DPR2/muted. CPU profiler is ON;
GL observer is OFF. This is a diagnostic, not a new acceptance or an
isolated comparison against later source. No application source changes.

Both visits complete/errors0, skipped0/context intact. Request-to-commit
is21.5015s cold/15.6999s warm, still over8/5s; drive p95/max50/233.3ms
cold and50/166.7ms warm. The driver correctly exits1 on the retained
frame-stall checks; the timing also misses8/5s. There are **zero resource requests inside either
timed entry**, and no product-admission measure starts in the warm window.
The old cold admission measure remains in performance history; it must not
be charged to warm entry. Cold prior-world count0, warm1: this is a real
successful cold visit and departure in the same document.

| Repeated preparation | Cold | Warm |
|---|---:|---:|
| Regional foundation |1.6494s|1.0799s|
| Dressing construction |2.9345s|2.4520s|
| Within dressing: geometry / layers |0.9303/0.7150s|0.8410/0.7426s|
| Assembly / props (nested) |1.1224/1.0872s|0.6061/0.5996s|
| Shader/composer |5.5683s|3.1001s|
| Compile jobs / exact-cache hits |489/4|489/208|
| Node builds |44/548.4ms|42/435.1ms|
| Uploads / new buffer KiB |100/40539|100/40539|
| Parked viewmodels |24/0.5311s|24/0.5222s|
| Parked world draws |218/4.1330s|218/3.8669s|
| Offscreen draws |12/0.4013s|12/0.3998s|

These nested elapsed spans are not additive CPU measurements. The warm
sample charges5.362s inclusive to the ordinary Game loop, including3.032s
to native Three render and2.236s to the depth/composer path;2.887s is idle.
Those are nested sampled stacks, not GPU time. Repeated inflate is245.5ms
inclusive sampled CPU; packed geometry copy/build186.4ms; scatter pose
decode/validation168.2ms. These pure input passes recur despite cached
bytes, but cannot alone explain a15.7s return. No whole-window cache or
network theory accounts for this profile.

Source explains the repeat: T7 retires whole regional worlds on road leave
(liveSession.ts installCrossing/live.ts retire), and preparationAdmission
intentionally caches metadata only. The next create builds a fresh
regional scope/look/physics shell and SceneDressing. Its BufferGeometry,
materials and root identities differ, so GPU readiness replays the fresh
bindings:100 uploads/~39.59MiB,218 world draws,24 viewmodels and12 offscreen
draws again. Product admission and native program retention are separate
caches;208 exact compile hits do not mean the whole world stayed resident.

This keeps **T2/T3 and G782 open**. The counted next targets are immutable
decoded dressing/templates under T3's existing charged/evictable ownership,
and T2's released sampler/reference node keys and fresh binding work.
Retain the T7 retirement policy, per-shard admission, all real readiness
draws and WebKit upload cap; skipping the final GPU fence is not a fix.
The data does not justify raising that cap or keeping an uncharged world.
Later0e90 resident-template work applies to WorldScenes; this profile's
Nalati uses SceneDressing, so no gain from that later source is claimed.

The original profile/request files were under tmp/sp-x6-nalati-warm while
analysing; scalar findings live here and in the commit, not a new receipt
document. Browser and own shared-preview borrower closed after analysis.


G782.S8 reading (2026-10-27, sp-x1): source cut `0e90efb49b321c33bc1b9b4b2f561c53f11e7201`, one original phone4x/DPR2 cold entry, actual road departure and warm return on pinned `60708bbe5699d0e7934d3135a6e1ccdf1de43eb4`. One original phone4x cold/warm pair on60708bbe56 (contains source0e90efb49b): 16.751/10.752s request→commit versus8/5s; entry p95/max50.0/183.4ms/33.4/99.9ms. Assembly construction1.239/0.312s, scene2.993/0.569s, owned library2.445/0.003s, compile3.311/2.212s, parked3.437/3.267s. timing/cadence miss remains open. Both entries ready/current Driftwood, errors0; browser/preview release0. One non-quiet observation with intervening shared changes, no isolated gain claimed. Original readiness/skip/context controls: `[{"visit": "cold", "complete": true, "ready": true, "skipped": 0, "contextLost": false}, {"visit": "warm", "complete": true, "ready": true, "skipped": 0, "contextLost": false}]`. Retained memory includes the independently charged revisit backing: cold owned loading304802230B/playing297036442B, page commons-accounted59759628B, page modeled resident562.11MB/playing950.8MB; warm owned loading304802230B/playing297036442B, page commons-accounted59759628B, page modeled resident697.72MB/playing1086.56MB. All-page modeled counters include other owners and are not physical process memory or per-shard caps; CDP/browser/GPU totals remain informational. Previous6ab803 pair17.403/13.050s predates intervening shared source, so this is not a matched causal comparison. Original timing/cadence/content/cancellation thresholds unchanged. Full scalar summary tmp/sp-x1-dw-revisit-final/summary.json; original pre-browser refusals remain in tmp/sp-x1-dw-revisit/preview.log and tmp/sp-x1-dw-revisit-ready/preview.log. The production b3 preview passed unchanged title/bank guards; a separate containing60708 DEVSERVER pin was necessary to retain the established grid catalogue rather than silently switching the route to production mode.

## Source-edge transport lease (T4.9)

Metadata-only prefetch still refills no binary inputs. A named exit starts one
explicit, charged loan of the originally admitted tier's transports before the
cold readiness horizon. Four verified reads can overlap, with the same total
byte claim reserved first. Unselected tier files are absent from that saved
inventory. The constructor shares the Map; the final borrower alone may invoke
the existing durable/offline release authority. No world is built by this port.
Aborted acquisitions drain started work before another approach begins; original
refusal order remains. A Developer grid.approach.inputs span measures acquisition
only, not the time the traveller keeps its completed loan. Pixel, gameplay,
physics and native shader fences are unchanged. Reading remains unqualified.

## DW decoder affected reading and source-edge checks

One original profiled cold/departure/warm pair on shared production
b3b7b0bcd3f7787b9ce53eb8a64ab3017497e794, iPhone16Pro/phone4x/DPR2,
muted, no GL observer or response bodies. This pin contains5ea8b843ab,
X1's owned-template revisit and O2/O3 scheduling/node cuts. It predates
34465197ba: these numbers do not measure source-edge transport.

| DW metric | Cold | Warm |
|---|---:|---:|
| Request to commit |17.837s|11.500s|
| Previous profiled e6f pair |16.285s|11.583s|
| Compile |3.837s|2.294s|
| Shader/composer envelope |5.181s|3.095s|
| Parked draws |3.066s /142 draws|3.267s /161 draws|
| Owned-library window |2.558s|0.032s|
| Observed fetch overlap union |43.5ms /26 requests|7.7ms /8 requests|
| Drive p95 /max |50 /133.3ms|33.4 /116.7ms|

Both entries complete/errors0/skipped0/contextLost false; both miss the
8s cold/5s warm crossing bar. Cold owned decoder samples193.9ms versus201.8ms
before, with dequantization91.0ms versus134.2ms. This is not an isolated
comparison: other source changes and profiling coexist, and the warm library
cache removes meaningful repeated decode. No overall crossing gain is proven.
Network overlap is not critical-path read time. Main-loop pacing remains a
larger demonstrated cost than transport waits. Raw receipt and mapped profiles:
tmp/sp-x8-g782-cuts/dw-reads-after/receipt.json. Own browser/borrower closed.

Source34465197ba's independent post-land controls pass68 cases: helper5,
ProductInputs12, original neighbour51. The initial Rapier collection refusal
was solely the temporary runner alias and was corrected without source edits.
Game/test and scoped fixture types, typed lint and selected ratchet checked
before landing; full ratchet census still has foreign debt/incomplete input
coverage and is not reported green. T4.9 stays in flight pending its own
containing-pin cold/warm reading; admission/readiness/physics fences stay strict.

## Source-edge transport affected pair (T4.9, 2026-10-27)

One original cold/departure/warm pair on shared production
b7d6c8b728e9bfd9abf1c2932bf818a394b89709 (contains34465197ba and X6
last-cell retention), iPhone16Pro/phone4x/DPR2/muted, profiler/GL observer
off, no new measurement observer. Original source pin/recovery/held input,
entry/departure and warm return witnesses retained. Both complete/errors0,
skipped0/contextLost false and live issues empty. This is one combined-source
pair, not an isolated scheduling comparison, and both timing gates FAIL.

| DW metric | Cold | Warm |
|---|---:|---:|
| Request to commit |17.338s|12.202s|
| Approach input acquisition |188.0ms|176.6ms|
| Inputs completed before request |1502.8ms|1512.2ms|
| World hook |6.714s|4.095s|
| Shader/composer envelope |4.513s|3.115s|
| Compile /jobs |3.244s /331|2.344s /335|
| Link |1.037s|0.499s|
| Parked draw /units |3.493s /142|2.829s /161|
| Drive p95 /max |50 /200ms|33.5 /100ms|
| Owned loading /playing peak |304.80 /297.04MB|304.80 /297.04MB|

The input span ends before the request, confirming early verified transport
preparation. It does not prove decoder or overall crossing gain: the previous
b3 pair was profiled and measured17.837/11.500s, and intervening source differs.
The three largest preparation windows remain world, shaders and parked draws;
compile/link are nested in shaders, not additive. Their current owners received
this blocking8/5miss and exact witness, without requesting another pair.

Long-frame attribution is bounded by the existing hook witness: cold116.7ms
overlaps world and200ms is post-activate with no runtime hook; the latter's
CPU/native cause is unproven without a separate profile. Warm has no recorded
frame over100ms. These are hook overlaps, not invented exclusive CPU causes.
Cold drive frame gate fails; warm passes its frame gate, while both crossings
miss G782. No fence, frame threshold, read/hash/size guard or cap changes.

Raw: tmp/sp-x8-g782-cuts/edge-transport-reading/receipt.json and summary.json.
Browser closed; sp-x8-edge-transport released4407, retained by its existing X6
borrower. Own source files are clean. T4.9/G782 remain in flight; remaining
construction/shader/parked prerequisites are routed to X1/O3/O1 respectively.


G782.S9 reading (2026-10-27, sp-x1): source cut `61885a0631837639625a80c8267d634385e864b8`, one original phone4x/DPR2 cold entry, actual road departure and warm return on pinned `61885a0631837639625a80c8267d634385e864b8`. One original phone4x cold/warm pair on61885a0631 (contains source61885a0631): 15.852/15.966s request→commit versus8/5s; entry p95/max50.0/116.7ms/49.9/149.9ms. Assembly construction1.040/0.468s, scene2.804/2.807s, owned library2.233/1.830s, baked0.919/1.824s, compile3.229/3.093s, parked3.359/2.834s. timing/cadence miss remains open. Both entries ready/current Driftwood, errors0; browser/preview release0. One non-quiet observation with intervening shared changes, no isolated gain claimed. Original readiness/skip/context controls: `[{"visit": "cold", "complete": true, "ready": true, "skipped": 0, "contextLost": false}, {"visit": "warm", "complete": true, "ready": true, "skipped": 0, "contextLost": false}]`. Retained memory includes the independently charged revisit backing: cold owned loading304802230B/playing297036442B, page commons-accounted59759628B, page modeled resident613.27MB/playing1007.59MB; warm owned loading304802230B/playing297036442B, page commons-accounted59759628B, page modeled resident759.03MB/playing1154.62MB. All-page modeled counters include other owners and are not physical process memory or per-shard caps; CDP/browser/GPU totals remain informational. Previous60708 pair16.751/10.752s predates intervening shared source, so this is not a matched causal comparison. Original timing/cadence/content/cancellation thresholds unchanged. Full scalar summary tmp/sp-x1-dw-baked-poses/summary.json; focused original-word/private-copy guards2cases pass8.16s. Full native-table11534copy matrix/colour word hash is unchanged (d1d8b541822df3b889fddeb1195ee8e724cd70481900f2e7dfc17b3d60e22f67). Temporary transforms34602→48, with output matrices/colours still private. No culling, collider, decoder or scheduling change.

## Last-cell retention: requested Nalati reading — b7d6c8b728

One original cold/departure/warm pair on exact
b7d6c8b728e9bfd9abf1c2932bf818a394b89709. Reused the maintained G782
road protocol, muted iPhone16Pro/phone4x/DPR2, profiler/GL observer off.
Read geometry/material/program identities only after each timed drive.
The shared pinned preview built normally; no live-tree product or source
override. Driver exits0, both entries complete/errors0, skipped0/context
intact. This is Chromium, not an iPhone Safari/native-memory acceptance.

| Observation | Cold | Warm |
|---|---:|---:|
| Request to committed entry |23.3689s FAIL8s|**0.0333s PASS5s**|
| New region/scene/preparation hooks |ordinary construction|none; only activate38.5ms|
| Scene root / geometry / material identity |one root,163geometries,186materials|all exact same UUIDs|
| Retained material native program ids/cache keys |captured after entry|all exact same|
| New own GPU preparation spans in entry window |ordinary cold pipeline|none|
| Owned entered claims |215856396B|215856396B|
| Owned loading peak |222042888B|220333304B|
| Whole-drive p95 / max |50.0/183.4ms|33.4/66.8ms|

After cold leave the original sim claim remains197073318B, refs1/holds0,
needed=false. The road snapshot has27.700s left and its full per-shard
playing ruler710847179B. Warm drive starts with26.725s left and716351998B
against1200000000B (483648002B headroom). Return cancels that expiry,
reactivates the existing scope and constructs no second region. The
64 focused native lifecycle/T7/program controls pass16.77s, including
actual allocator-pressure eviction, expiry, different-entry ordering,
prepared-return cancellation and failed-disposal charge preservation.
The program keeper is initialized before pressure callbacks can need it.

The complete page program inventory changes230->244, with6 old ids absent;
therefore only the retained world material bindings are claimed unchanged,
not every background program on the page. Activation38.5ms and commit33.3ms
are different existing clocks, not additive phases. Cold runtime and frame
floor misses remain with G782's existing owners; O2 separately observes a
~0.03s retained return on containingea36b7776c and owns the cold dressing
await chain. No cold speed gain is attributed to retention.

Budget accounting and native process readings remain separate. Matched
Chromium renderer/GPU private-footprint snapshots (whole page, no forced GC):
cold before-entry900075520/670401536B; entered1500960768/1150240768B;
after-look1454953472/1176111104B. Warm before-entry1506956288/1153894400B;
entered1015486464/1144162304B; after-look984306688/1141016576B. These are
uncapped whole-page observations, not native per-shard subtraction claims.
The **strict per-shard admission ruler** and charged allocation checks pass;
this does not qualify a physical-device WebContent+GPU cap or stability soak.
No memory cap, global page admission, readiness draw or shader fence changed.

Results were analysed in tmp/sp-x6-last-cell, then folded here rather than
adding a receipt document. Browser closed; owned4407 borrower/server released.

## Requested HEAD read/decode share: collecting prerequisite

Source-edge transport34465197ba and decoder5ea8b843ab are already landed.
The requested fresh DW pair pins HEAD53eb1617420c634f2e8b81b304979afd124ada29,
including all cuts landed at request time. Its existing shared production
preview (O2/4402) was attached, not duplicated. Admission refused before any
browser launched: builder O2 reports Far Reach phone wire34105274B above its
retained33955475B ceiling. Own wrapper reports Shared preview did not complete:
tmp/sp-x8-g782-cuts/dw-head-preview.log. O2 removed its failed shared record
and builder log; the exact underlying refusal here is attributed to O2's
message, not falsely represented as an independently retained raw build log.

Suspected1655f7fd74 is a candidate only; X8 has not proven causal first bad.
Sp-ci-deploy owns producer routing. No cap/guard change or duplicate rebuild,
no browser/preview borrower remains, and no current-HEAD time/read/decode share
is invented. The b7 pair17.338/12.202s remains the last actual affected reading;
it is not this requested HEAD profile. Resume one DW pair on a cause-fixed
containing pin. The analysis separates sampled page reader/decompress/geometry
CPU and observed fetch overlap; worker/cache/native waits remain explicit
coverage limits, and an enclosing scene span is not decoder CPU.


G782.S10 reading (2026-10-27, sp-x1): source cut `965ae4042e03d2a2cd2af6228d5f904df9ae24e8`, one original phone4x/DPR2 cold entry, actual road departure and warm return on pinned `965ae4042e03d2a2cd2af6228d5f904df9ae24e8`. One original phone4x cold/warm pair on965ae4042e (contains source965ae4042e): 16.487/10.234s request→commit versus8/5s; entry p95/max50.1/150.0ms/33.4/100.0ms. Assembly construction1.316/0.309s, scene2.373/1.569s, owned library1.728/0.899s, baked1.383/0.850s, compile4.064/2.099s, parked2.128/1.967s; planned slices64→62/62→59 cold/warm, drawn142/161. timing/cadence miss remains open. Both entries ready/current Driftwood, errors0; browser/preview release0. One non-quiet observation with intervening shared changes, no isolated gain claimed. Original readiness/skip/context controls: `[{"visit": "cold", "complete": true, "ready": true, "skipped": 0, "contextLost": false}, {"visit": "warm", "complete": true, "ready": true, "skipped": 0, "contextLost": false}]`. Retained memory includes the independently charged revisit backing: cold owned loading304807846B/playing297042058B, page commons-accounted59759628B, page modeled resident614.75MB/playing1009.23MB; warm owned loading304807846B/playing297042058B, page commons-accounted59759628B, page modeled resident760.83MB/playing1156.62MB. All-page modeled counters include other owners and are not physical process memory or per-shard caps; CDP/browser/GPU totals remain informational. Previous61885 pair15.852/15.966s predates intervening shared source, so this is not a matched causal comparison. Original timing/cadence/content/cancellation thresholds unchanged. Full scalar summary tmp/sp-x1-dw-parked-pack/summary.json; all12 parked-receipt controls pass9.39s. The candidate and original plan independently admit every original first draw with unchanged material, binding, draw-count and byte caps; oversized uploads remain alone and every submitted slice waits for a completed game frame. Hooks and special draw kinds preserve their order; exact receipts still decide any skipped draw. One non-quiet combined-source observation, not isolated causal proof or final acceptance.
