# Pine Hollow fps: a steady 30 on a hot phone, with headroom (mini plan)

**State:** `open` 2026-10-30. Written by wildshard-v's subagent for wildshard-new, which hands the rows to lanes and
marks them. Jake, ~12:15 Cancun: *"can you make a mini plan from Pinewood about how to get the FPS way the fuck better?
Use a sub agent to make that mini plan."* (ask E514). His QA earlier today (QC4): *"Pinewood works but its frame rate fps
is 50% worse"*, *"Pine wood is bad fps."* The bar is **way** better, not legacy parity: a steady 30 on a phone that
throttles ~2x within minutes (G896: phones run at 30). G933 keeps LEGACY until Jake QAs this. The builder is autonomous
(G872); every row that can change what the player sees is Opus (G848) and lands with a before / after capture (G844,
G858). Nothing here is dynamic resolution or a lower render scale (2x stays).

## Where the frame goes today (measured)

Live `899682f-mvv72pov` (SHARDFILE; LEGACY on `14dd10d-mvv7k9qd`, the deploy that followed, where a second SHARDFILE run read the same costs),
Chromium, CPU 4x, "iPhone 16 Pro", phone tier, 2x, muted, through `scripts/browser-lane.sh`. Each pose: 4 s settle, a
clean 3 s work meter, then a 4 s attribution window with every draw, the shadow pass, each composer pass and each
system timed, then cost floors (one thing skipped at a time, clean meter). A CDP profile at P1. Scratch harness:
`tmp/wildshard-v-pine-fps-plan/budget.mjs` + `probe.js` (git-ignored; built on QC4's `tmp/wildshard-v-pine-qc4/run.mjs`).
The Mac was shared with 2–3 other probes, so absolute work drifts ±1.5 ms between sessions (QC4's quieter matched
session read SHARDFILE 21.0 / 19.2 / 21.1 / 22.2 ms, LEGACY 14.1 / 13.6 / 14.1 / 15.4 at P1–P4). Floors under ~1 ms are
inside that noise; the attributed ms are the steadier read.

| Pose | SHARDFILE work p50 / p95 (update + render) | LEGACY | Draws SF / LG | Shadow draws SF / LG |
|---|---|---|---|---|
| P1 spawn (0, −235) N | 17.9 / 20.0 (5.1 + 12.8); 18.9 / 21.3 on the next deploy | 13.5 / 15.2 (4.2 + 9.1) | 162 / 90 | 29 / 8 |
| P2 gate road (0, −200) N | 17.8 / 19.7 (4.9 + 12.6) | 13.6 / 15.8 (QC4) | 168 / 91 | 30 / — |
| P3 crossroads (0, −28) N | 21.1 / 23.3 (QC4; this session 23.8 under load) | 14.1 / 16.2 (QC4) | 166 / 92 | 32 / — |
| P4 crossroads, look W | 21.7 / 25.4 (5.4 + 16.2) | 15.0 / 17.3 (4.1 + 10.8) | 189 / 122 | 30 / 14 |
| Walking the gate road (−200 → −55) | 17.6 / 20.3 (5.3 + 12.1) | 12.4 / 14.1 (3.9 + 8.5) | 156 / 89 | 25 / — |

## The budget at P1 (ms per frame, Chromium 4x)

"Attributed" is the line item's own time with the probes on (they add ~0.4 ms to the frame). "Floor" is what skipping
it saved on a clean meter (P1, then P4 where it differs). The target column adds up to ≤ 12 ms.

| Line item | SHARDFILE today | LEGACY | Floor if skipped | Target | Row |
|---|---|---|---|---|---|
| **Whole frame, work p50** | **17.9–21.0** | **13.5–14.1** | | **≤ 12** (p95 ≤ 16) | all |
| **Update (systems)** | **5.1** (5.4 at P4) | **4.2** | | **≤ 3.2** | |
| `engine.creatures.update` (animals' think, pose, motor) | 0.8–1.1 (P3 1.8, P4 1.5) | 1.1 (P4 1.4) | P4 −2.0 update | ≤ 0.5 | PF6 |
| `main.equipment` (held crossbow, viewmodel) | 0.6–0.85 | 0.36 | | ≤ 0.2 | PF6 |
| `elites` (rule loop + every elite's AssemblyScript `tick`, idle ones too) | 0.5–0.73 | 0.14 | | ≤ 0.1 | PF5 |
| `main.world` | 0.38–0.47 | 0.18 | | ≤ 0.15 | PF5 |
| `shard.pine.weather` | 0.29–0.41 | 0.05 | | ≤ 0.05 | PF6 |
| `player.step` + `physics.step` | 0.47 + 0.37 | 0.59 + 0.42 | | same | — |
| HUD, quest, input, movers, the other ~60 systems | ~1.4 | ~1.1 | | ≤ 1.0 | PF5 |
| GC (profile self time) | 0.42 | | | ≤ 0.1 | PF5 |
| **Render (CPU side of the draw)** | **12.8** (16.2 at P4) | **9.1** (10.8) | | **≤ 8.8** | |
| Trees: 34 main + 18 shadow draws, one InstancedMesh per variant × LOD × part (since `7727599482`) | 2.3 | 1.3 (4 + 3 draws, BatchedMesh) | −2.2…−3.1 (P4 −4.1) | 4 + 3 draws, ≤ 0.9 | PF1 |
| Node-material per-draw hook: ~80 `beforeDraw` calls a frame for 61 node draws | 1.8 | 0 | −2.0…−2.4 (P4 −2.4…−3.4) | about half after PF1; 0 after PF10 | PF1, PF10 |
| Shadow pass, 1 cascade 1024² to 60 m: 29 draws (trees 18, boulders 6) | 2.6 incl. its walk | 1.8 (8 draws) | −1.1…−1.5 (P4 −2.8) | ≤ 10 draws, ≤ 0.8 | PF1–PF3 |
| Crags and props: crag-cliff 6 node draws, boulders 6 + 6, pine-crags 3 + 1, logs 1 + 1, stumps 1 + 1, P4 barrels / crates / buckets 8 | ~0.8 (P4 ~1.1) | ~0.65 (1 + 1 each) | P4 crag-cliff −1.8, barrels −2.0 | ≤ 0.3 | PF2 |
| Viewmodel: crossbow 11 + hands / sleeves 4 draws, all `MeshPhysicalMaterial` with CSM | 0.6–0.9 | 0.54 (same rig) | noise to −1.8 | ≤ 0.35 | PF4 |
| Animals: 9–13 `MeshPhysicalMaterial` draws + herd shadow | 0.6–0.8 (P4 1.0) | 0.55–0.64 | P4 −2.2 | ≤ 0.3 | PF7 |
| Scene walk: `updateMatrixWorld` over 4,395 objects, 4,256 auto; `animals` holds **3,550** (bones of every rig, **28 visible**) | 1.1 (profile, incl.) | same shape (4,256 / 4,211) | | ≤ 0.3 | PF8 |
| Costly single draws: `interact-lit` 1 + 1 (0.35–0.40), `pine-wildlife` 2 (0.25), sky dome, waterfall, beaver pool | ~1.0 | ~0.6 | | ≤ 0.5 | PF9 |
| Grass carpet (1 instanced draw, 317 k triangles) | 0.13 | 0.22 | | same (GPU check only) | PF11 |
| Terrain, ground, water, sprites, points, lines, the rest | ~1.8 | ~1.6 | | ~1.6 | — |
| Post: one `EffectPass`, 9 effects (CPU) | 0.42 | 0.37 | | same (GPU halved by FC9) | — |
| Programs / `useProgram` / `uniform*` calls a frame | 117 / 86 / 1,098 | 103 / 65 / 757 | | ≤ 100 / ≤ 60 / ≤ 750 | PF10 |

Not a cost here: streaming (no hitch on Pine, `tmp/wildshard-v-nine-plan/streaming.md`), texture uploads (same in both
modes, QC4), audio (0.02 ms), the minimap and HUD DOM (done in FC4 / FC14), post on the GPU (FC9: Pine −52 %).

## Batched trees: Jake's call (recommended: yes, now)

Legacy Pine draws its whole forest as 4 `BatchedMesh` draws + 3 shadow draws (`Forest.buildBatched`), and runs that way
on Jake's iPhone whenever he plays legacy Pine. SHARDFILE Pine draws 34 + 18, because `7727599482` (10-21) routed
every graph (node) look off the batched path in `place.ts:812-815` and `Forest.ts:95`. That commit cited E271 / E272,
but those ban **facade** multi-draw (Nine's facades, the WebContent kills, `docs/audits/nine-dragon-mobile-multidraw.md`),
not the forest. What actually broke on 10-21 was a compile: on the grid the cell prefix landed above the batched shader's
`#extension GL_ANGLE_multi_draw` line. Graph looks on existing non-facade batches were supported on purpose
(`50006f90de` + `3ba0f81545`, 10-14; ENGINE.md: "facade multi-draw remains prohibited"). The facade stays instanced and
`scripts/test-facade-instancing.mjs` keeps guarding it. RENDERING.md says a risky batching change ships default-off
behind a Debug row until a physical-device reading backs it. Legacy Pine is that reading for this exact forest, so the
recommendation is on by default, with the instanced path kept as a Debug fallback until Jake's QA, then deleted (E451).

## Rows

All readings: P1–P4 + the gate-road walk, SHARDFILE vs LEGACY in one session, Chromium 4x and Playwright WebKit (Mac),
"iPhone 16 Pro", phone tier, 2x, muted, with the scratch harness above (or QC4's). Numbers go in the commit message
(G506). A look-changing row carries a golden-vs-after capture from the same camera (G844 / G858). Identical captures need
no board. Heavy proofs (Simulator, frame floor) run at the milestones only.

| Row | What | Fix / done when | Lane | Size |
|---|---|---|---|---|
| PF1 | **Batched trees back** (Jake's call above) | Graph looks may ride a non-facade `BatchedMesh` again: `place.ts`'s batched draw and `Forest`'s `path` stop refusing graph looks; the grid's cell prefix goes after every `#extension` line; `no-graph-batches.test.ts` becomes "a graph look batches, a facade never does"; Debug row **Pine trees: batched / instanced** (Developer), default per Jake's answer. Done: P1 trees 4 main + 3 shadow draws (from 34 + 18); P1 draws 162 → ≤ 125; node `beforeDraw` ~80 → ≤ 45 a frame; work p50 −2.0 ms at P1, −3.0 at P4; 0 `program not valid` over a grid walk into Pine and a standalone load; captures identical to today at P1–P4 (else a G844 board); `test-facade-instancing` green | Opus · **done** (sp-o3): f80d6d5271 cell clip keeps a batch's #extension first (grid entry into Pine: 0 shader errors); 9b649a9b01 graph batches split by draw flags; 2d114c8cbd batched levels honour their scale; 8a59427b63 Batched default + board [pf1-graph-batches](../../../art/pine-hollow/pf1-graph-batches/board.jpg) (G952 pick, recommend B). Spawn: 121 draws (from 165; legacy 89), trees 4 batch draws (from 62); batched vs instanced 1.9 % pixels vs 1.1 % run-to-run; facade guard PASS ×3 | M |
| PF2 | **Crags and props on the same path** | The world-scene batch and `place`'s batched rows take graph looks too (crag-cliff coarse tiles, pine-crags, mossy boulders, logs, stumps, the cabin yard's barrels / crates / buckets): one batch per material per tile, as LEGACY. Done: P1 crag-cliff 6 → 1, boulders 6 + 6 → 1 + 1; P4 barrels / crates / buckets 8 → ≤ 3; work −0.5 ms at P1, −1.0 at P4; captures identical | Opus · **done** (sp-o3) 5326499f61: the world-scene batch is one BatchedMesh again (multi-draw, Graph batches row), world-scene `batched` rows batch through place. Pine spawn 121 → 109 draws (all-instanced 165, legacy 89); batched vs instanced 1.5 % pixels inside the run-to-run floor; grid entry 0 shader errors; facade guard PASS ×3 | S |
| PF3 | **Shadow pass on a budget** | After PF1 / PF2 the cascade draws ~10 casters. Then a static-caster cache: terrain, trees, crags and buildings render into a cached depth target that is redrawn only when the cascade snaps or the sun moves; animals, the player and held gear draw on top every frame (the half of FC8 / FC13 that never shipped; FC13's "Idle frames" row only helps standing still). Behind a Debug row until a Simulator reading shows no swim or stutter, then on (G912 precedent). Done: shadow pass CPU ≤ 0.8 ms at P1–P4 and on the walk (from 2.6–3.8); no visible swim on a turn and a walk clip | Opus · **done, bar met at P1 / P2, open at P3 / P4** (pine-frame). a233db98cf + 57e5ad1481: Pine's phone cascade redraws every 2nd drawn frame (`shadowEvery`; a held map keeps its matrix: static shadows exact, sway / animals step at 15 Hz); board [pf3-shadow-cadence](../../../art/pine-hollow/pf3-shadow-cadence/board.jpg). Matched A/B, one build, median of 3 (Chromium 4x; the board's label ms were 1 s live readings): TSL shadow ms P1–P4 1.76 / 1.69 / 1.91 / 2.53 → 0.89 / 0.89 / 1.01 / 1.51, work −0.4 ms mean of 12 pairs. be099881ad: GLSL graph batches kept the far tree level's castShadow (classic branch); now keyed by flags like TSL (mill shadow trees 54 → 17, the far-hill GLSL diff gone). 9d3794ee90: batches get a depth kind (stock depth material re-ran getProgram ~7× a pass; 0.38 → 0.09 ms). 96c91e9eda: wide low-poly casters split (the 355 m boundary ring drew every redraw). HEAD 1de32de (GLSL default) at the cadence: shadow **0.80 / 0.76 / 0.97 / 1.15 ms**, work p50 14.0 / 13.4 / 13.1 / 16.3. A P4 redraw is 1.98 ms: walk 0.30, batch culling 0.18, forest wind depth 0.54 (3 draws), proxies 0.11 (9). Tried, no gain: dropping copied depth maps (three never re-keys a program on map presence). Found: the zipline landing is placed twice (`.coarse` site + timbers landmark, both drawn, main and shadow). Lead from PF10's program audit (sp-o5, not built): two shadow depth programs sample a map without alpha-testing (customDepthMaterial casters, `shadowMaterialOwnership.ts`); depth ignores the map then, so they could share the texture-less programs (~−2 programs, exact) | M |
| PF4 | **Viewmodel draws** | The crossbow's static parts merged per material (11 → ≤ 6: wood, iron, prod, leather, cord, brass; the animated prod / string / bolt stay apart), hands + sleeves 4 → 2. Same materials, same look. Done: viewmodel ≤ 8 draws; its attributed render ≤ 0.35 ms; captures identical at P1 and in an aim / fire clip **Closed (2026-10-30, sp-o5)** `bc10cee141`: the leather fore wrap + grip are one draw (−1). A cross-material family (wood / brass / iron / prod / leather as one draw) is not built: weapon skins restyle the crossbow by swapping each part's material by name, so a merged mesh would need a skin-aware rebuild for −4 draws on a bar Pine already meets. | Opus | S |
| PF5 | **Non-visual systems** | `elites`: the rule loop stays per frame, but an idle elite beyond 1.5 × its `awareR` calls its AssemblyScript `tick` on the `ai` band (10 Hz, as LEGACY's 0.14 ms); `main.world`, `quest` / `quest.kit`, `hud.combat` run on change or at 10 Hz; allocation hunt to 0 steady-state allocations a frame (GC 0.42 → ≤ 0.1 ms). No pixel changes (logic and bookkeeping only; anything that moves a body or the HUD look goes to PF6). Done: those systems sum ≤ 0.5 ms at P1–P4 (from ~1.7); update p50 ≤ 4.0 ms; elites still spawn, aggro and leash in the elite e2e | **closed, measured (G963; closing mark `a1396948e9`)**. Historical partial (2026-10-30, sp-x9; 5fbb571fc5 / 8cfbb131ca): no material frame-cost gain; verdict below. **Elites cut (2026-10-30, sp-o5, G941 rulings from clips)**: the row's 10 Hz ai band was already in effect (Pine's elite guests declare `tick: 10`); the cost was the SpawnScript fixed-step machinery per elite (decision host step, guest calls with a shared-memory rewind, staged commits, motion runner, strikes). `2f8afea667` far idle elites at 2 Hz, then `bca6ac13c7` an idle elite beyond 1.5 × `awareR` (unhit) pauses its fixed steps and holds, steering zeroed, waking before its tick when nearer, aware, engaged, leashing or hit (the 2 Hz band removed); `920f6a1f6c` exact: guest field keys memoized, the roster check once a frame, the King's wall params on change, a moving actor's site found once. Clip `tmp/sp-o5-ep8/pf5-elite-scope-clip.mp4` (scratch): the removed far drift is ~4 m in 9 s at 132 m; aware at 0.6 × and engage at 0.2 × identical before / after. Elite suites 137 / 137. Chromium 4x budget.mjs at bca6ac13c7, `update:elites` SHARDFILE vs LEGACY: P1 0.217 / 0.168, P2 0.146 / 0.101, P3 0.498 / 0.074, P4 0.331 / 0.092 ms (was 0.48–0.62); update p50 5.2 / 3.8, 4.4 / 3.2, 6.4 / 4.0, 4.7 / 4.0. ≤ 0.15 met at P2 only: at P3 / P4 idle elites stand inside 1.5 × `awareR` and step every frame. **Closed: measured (G872, wildshard-new, 2026-10-30)**: `bb68a5376f` every idle, unhit elite pauses (the far line is `awareR` itself; G941 from a crop sheet: the paused boar holds its heading, its tail still swings); `4b88f10f24` a paused elite's frame inputs wait for its wake, dusk and night read once a frame. Chromium 4x budget.mjs at 4b88f10f24, `update:elites` P1 0.210 / P2 0.179 / P3 0.127 / P4 0.194 ms (LEGACY 0.128 / 0.084 / 0.053 / 0.087): P3 meets ≤ 0.15. The rest is the King's in-sight room / breathing (SHARDFILE runs it inside `elites`; he roams ~150–230 m from every pose, in sight, so a view-range gate skips nothing there; Pine's THREE.Fog far is a placeholder 1e6), the five-entry rule loop and the focus bar. | S |
| PF6 | **Visible per-frame systems** | `engine.creatures.update`: extend FC11's distance bands to think and motor (far idle animals step at 10 Hz, bodies interpolated); `main.equipment`: sway / recoil only while it moves; `shard.pine.weather`: state at 10 Hz, uniforms per frame (LEGACY 0.05 ms). Done: creatures ≤ 0.5 ms at P1 and ≤ 0.8 at P3 / P4 (from 0.8–1.8), equipment ≤ 0.2, weather ≤ 0.05; update p50 ≤ 3.2 ms; walk clip and an animal close-up clip show no stepping (before / after) **Closed (2026-10-30, sp-o5; coordinator accepts ~0.09 / ~0.3)**: `f95804ace2` weather channel programs + herd shelter at 10 Hz (shard.pine.weather 0.154 ms: channels 0.067, rain 0.039, shelter 0.021; rain stays per frame); `cf4e344d8b` a stowed weapon freezes all its views (reverses T10 for stateful views; the holstered firearm was 0.109 of main.equipment's 0.51 ms); sp-x1's HeldPlayback reader prebind takes the held crossbow's apply. Holster / draw clip before / after: no pop, no stale spring (sp-o5 scratch, not committed). **Equipment re-measured (2026-10-30, sp-o1)**: Pine P1 / P4 eb461fe, Chromium 4x, per-item wraps: main.equipment 0.585-0.658 ms = drawn crossbow 0.35-0.44 (its 6 stateful pose views 0.21-0.24, the floor; aim scan 0.05-0.07) + stowed lever 0.11 + stowed longbow 0.09-0.10. `9164439da4` stowed weapons hold their pose (0.463-0.477 ms); G941 rejected the firearm / launcher half (lever redraw lower and darker, board `bea10ecdf1`), `608bcc949e` restores it, the engine Bow hold stays (longbow redraw matched): equipment ~0.5 ms, the crossbow pose views the floor. | Opus · **measured; exact cuts landed, bar open** (pine-frame): 4cb58a8ac6 far-herd family key memo, 34b2c50efe sleeping rigs keep their hitboxes (P4 profile: farKey 0.157 → 0.046, sync 0.298 → 0.133 ms); creatures P1 / P3 / P4 ~1.2 / 2.0 / 1.8 → 0.9 / 1.5 / 1.4 ms. Distance-band cadence measured page-side ('ai' body half from 30 m, all half; 'legacy' half past 40 m): no change beyond noise, so the 10 Hz far-body idea is dropped. What remains is per-animal pose (setFromEuler 0.13), the manager loop 0.13, decisions 0.28 and near motion, spread thin. Equipment / weather stay (channel interpreter, G960 brief) | M |
| PF7 | **Animal draws** | Phone tier on Pine: the far herd (`animalFarBatchDist`) on past the eye distance for rigs with vertex colours, eye draws folded into the body past `animalEyeDist`; same materials. Done: animals ≤ 5 draws at P1 / P4 (from 9–13); attributed ≤ 0.3 ms; captures identical **measured, not landed (2026-10-30, sp-o5)**: the knobs alone miss the bar. Animals in view at golden cams 1 / 5 / 14 are 9 / 16 / 1 rigs, almost all generated hulls (4 geometries) but ~10 coat variants, and the far herd batches per variant (each coat its own material). With `animalHullBatch` + `animalFarBatchDist` on Pine's phone row (and view pages frustum-culled by their members' sphere): cam 1 9 pages for 9 rigs, cam 5 16 → 10 draws, cam 14 1 → 1, for ~11 pages of ~5 MB GPU geometry (~55 MB). ≤ 5 needs one batch per hull geometry, the coats in one material (a texture array, a per-slot layer index): a material change, so a board. Experiment patch kept in sp-o5's scratch. **PF7b in flight (2026-10-30, sp-o5)**: engine landed `08e2f62a2a` (coat arrays, per-slot data bones, member-sphere page culling, `animalFarPageSlots`); same-instant A/B board `art/pine-hollow/pf7b-coat-families/` (12 coats incl. elites, ≤ 0.001 % px off). Slots now follow the draw ring `4208763c57` (91 → 34 MB of page geometry) and Pine's phone switch landed `41f6037981`: view animal draws 9/16/1 → **5/5/0** at cams 1/5/14, frame calls 107/116/83 → 103/107/83, coats identical. **PF7b done; PF7 done.** | Opus · **done** (2026-10-30; `08e2f62a2a`, `4208763c57`, `41f6037981`): animals 9 / 16 / 1 -> 5 / 5 / 0 draws at cams 1 / 5 / 14, 34 MB; marked by wildshard-new per the finish-fps spike | S |
| PF8 | **Scene walk** | **Closed: measured / no gain (G958, 2026-10-30, sp-x8).** Current Pine spawn at Chromium 4x: 643 non-animal auto locals; 839 effective local compositions including 196 animal compositions. The safest `place.ts` merged / instanced / batched internal-local experiment affects 18 current nodes (trees 6, crag coarse 12), 839 → 821 compositions; all 69,312 world-matrix values remain exact. Forty paired 50-walk blocks measure median **0.226 → 0.224 ms**, median paired gain approximately **0 ms**, below the ~0.1 ms continuation threshold. Six actual-source component capture pairs are pixel-identical and 22 owner/culling controls pass. Whole-composer A/A itself differs (13,097 pixels), so it is not claimed as pixel proof. Jake's coordinator ruled the frozen-node risk unjustified: **all source/test changes dropped**, public roots and moving rigs untouched, no perf gain or first-visible-rig qualification claimed. Retained raw: `tmp/sp-x8-pf8/`. | **measured / no gain; closed** | S |
| PF9 | **The costly single draws** | `interact-lit` costs 0.35–0.40 ms for 1 + 1 draws, `pine-wildlife` 0.25 ms for 2: find what each pays per draw (material refresh, morphs, per-draw uniforms) and cut it without a look change. Done: each ≤ 0.1 ms attributed; captures identical. **Guide upload slice done** `5432a07f1211` (G941/G872): two draws/shadow policies retained, shared owner 6 → 3 uploads at all four active-guide poses. The pre-existing one-pixel coarse-lookout depth tie is independently traced and accepted in that code body; no sort/tolerance fix. **Texture upload follow-up done** `f77b6e3926` (sp-x8): skip only unchanged quantized trample RG8 images, preserving the full native field/clock/live-mover state. Matched immutable `0975e63169` / `f77b6e3926` P1 census over 120 frames: **2740 → 2700 calls**, **15,781,040 → 10,538,160 B** (−33.22% texture bytes); exactly forty identical 128 KB uploads disappear. Other batch/bone upload counts stay unchanged. Maintained Metal DPR2 native-camera P1–P4: four A/A + four A/B comparisons, **0 differing RGBA pixels**; six analytical image/state/live-mover controls, types/lint pass. This is upload traffic, not a measured FPS win. **Palette / indirect-table upload slice done** `0c99d920f6` + negative controls `eb94988ca4`: matched immutable `ca2388fcea` / `0c99` P1, 120 frames, **2700 → 837 texture calls**, **10,538,160 → 4,673,088 B**; identical repeated uploads **1851 → 0**, seven changing textures retained. Native P1–P4 four A/A + four A/B comparisons are 0 RGBA pixels; 48 upload/draw/retirement controls pass. This is upload traffic only. **Per-owner CPU closed: measured (2026-10-30, sp-x9, G872 ruling)** on `b09eb3bda1`: Pine P1 Chromium Metal 4x / phone, 180 frames; SHARDFILE interact-lit 0.082 ms/frame and wildlife 0.077, both below 0.1 even including unsubmitted shadow / guide attempts. Native frame counters ran first; direct-render CPU was separate from GL / hook diagnostics. Actual GL observation has one main draw each and no shadow / guide submission at this pose; attempt counts are not native draw counts. Shared-Mac point-time, no isolated speed-gain claim. Credit the shared EP2 cuts; no new draw-source change. The current Pine policy has exact four-pose M3 A/A and A/B (`693e0d2b12`, `b09eb3bda1`). | **done** (sp-x9; G872) | S |
| PF10 | **Pine on the GLSL graph back-end** (Pine's half of FG4, `tmp/wildshard-v-nine-plan/frame-cost.md` §8) | After FG1 / FG2 land: Pine's lit graphs (forest bark / needles / twigs, crag, water, cabins, wildlife, sky) compile to classic materials with the lighting stage as a GLSL light-model patch; trees and crags then batch as plain classic materials (PF1's graph-batch path is no longer used by Pine). Done: golden-still parity per graph (≥ 40 dB PSNR, < 1 % of pixels off by > 8) or a G844 board; 0 `beforeDraw` a frame; programs ≤ 100 (from 117), `useProgram` ≤ 60, `uniform*` ≤ 750 a frame at P1; FG4's Pine bar (≤ LEGACY + 0.5 ms) **and** this plan's ≤ 12 ms | **done** `180df449c9` (2026-10-30, sp-o1 + sp-o2; G941): GLSL is the global default (Debug row and selection code deleted, E451; TSL runtime stays until NF18). Deterministic M3 TSL vs GLSL, symmetric clock pin: Pine P1-P4 43.9-55.3 dB / <= 0.27 % px > 8 (sp-o2's cabin / water / cave poses 40.6-49.8 dB). Pine 8f9abdc Chromium 4x work p50 TSL -> GLSL P1 16.5 -> 15.65, P2 16.45 -> 13.5, P3 15.85 -> 15.8, P4 18.25 -> 17.05 ms; P1 beforeDraw 34 -> 0, useProgram 66 -> 59, uniform* 713 -> 640, programs 123 -> 114 (> 100: stock / depth / viewmodel / post, EP7). Crag stand-in batched `9bfd8ce0aa` (6 part draws -> 1). **Programs accepted at 111 (G872, wildshard-new, 2026-10-30; sp-o5)**: `c145cb4f3f` the separate volumetric march warms in its own target, not the screen pass's (its sRGB twin was never bound; 112 → 111). Audit at 34aab978e8 (GLSL, cam 1; link stacks + full source diffs): 55 bound in 60 frames; the other 56 all come from the boot warm-up and are distinct states, not duplicates (rain / hearth / king / cave effects, transparent double-sided front / back pairs, the crossbow's opaque world drop beside the viewmodel's transparent copies, out-of-view fur variants plain / emissive map / overgrown, shadow depth per caster kind, HAS_NORMAL / USE_COLOR geometry splits); no material holds a warm-up-only sibling. ≤ 100 would take look or content changes or a thinner warm-up (compiles move into play as hitches). | M |
| PF11 | **closed via G1, measured** (G963; `a9cadc076b`, `f14504f650`) | The plan works the main thread; confirm the phone GPU is not next. Done: Simulator GPU process ≤ 10 % at P1–P4 (FC15's bar) with grass (317 k triangles) and needle-card overdraw as they are; if it misses, a separate row with a board, never a silent density cut **G1 measured (2026-10-30, sp-x8):** immutable `a2dc` Metal / 804×1748, both modes at P1–P4; all eight rows complete. SHARDFILE whole throughput 1.431 / 1.700 / 1.594 / 2.000 ms, CPU submission 1.131 / 1.381 / 1.269 / 1.644 ms. Full paired-pass/group/no-op/drift tables are in [Nine G1](nine-fix-mini-plan.md#g1--pf11-gpu-census-2026-10-30-sp-x8-e518). Shared-machine frozen-frame diagnostics; no new physical-phone or Simulator-process acceptance. | Codex (G1) | S |
| PF12 | **Milestone A: legacy beaten** (after PF1–PF9) | Chromium 4x: every pose and the walk ≤ 14 ms p50 / ≤ 17 ms p95 (≤ LEGACY at each); WebKit (Mac) ≤ LEGACY at each; one Simulator reading through `scripts/sim-lane.sh` (official reader, quiet window): 30 fps held at P1–P4 and on the walk, max frame ≤ 50 ms. Then Jake's phone QA of QC4 (G933) | **closed as measured miss (2026-10-31, sp-x8; G872)**. Retained earlier reading (2026-10-30, sp-o1, `a677b8636c`: GLSL default, crag stand-in batch, sp-o2's far-tree casters in): plan harness (budget.mjs), "iPhone 16 Pro", phone, 2x, muted, midday / clear, 0 page errors in 8 runs. Chromium 4x p50 / p95 ms, median of 3, LEGACY vs SHARDFILE: P1 13.9 / 15.8 vs 16.4 / 18.2; P2 13.1 / 14.2 vs 15.4 / 17.5; P3 14.2 / 15.6 vs 16.0 / 18.3; P4 19.7 / 21.8 vs **18.1 / 20.5**; walk 17.1 / 19.6 vs 18.3 / 21.1. Render is at or under LEGACY everywhere (P1 9.7 vs 9.9, P4 14.5 vs 12.2, walk 12.0 vs 11.7); the whole gap is update (+1.2 to +2.2 ms: creatures sp-x1, equipment sp-o5, elites, player.step / main.world sp-x9). WebKit 1x p50 / p95: LEGACY 4 / 5 at every pose and the walk, SHARDFILE 5-6 / 7. Simulator (frame-floor.mjs --surface=sim --quiet, official poses spawn / cabin / pond, not P1-P4 + walk): 30.3 fps held, p95 34 ms, max 34 / 34 / 36 ms (<= 50) PASS. Not built: Rapier step skipping (creatures.sync moves awake hitboxes every frame and Rapier refreshes the ray broad phase only in world.step, so a skip leaves stale hitboxes); cabin per-material merge (look trade, EP6). **Entry and walk hitches on ab792cd85f (sp-o1, warm-up bound, no clean cut; G872)**: the 82.8 ms walk frame did not recur (3 profiled walks + 2 sp-x6 harness runs: max 36-41 ms), a one-off. The first seconds after entry (2 traced entries, Chromium 4x, GL calls per frame): programs 112 from the first frame (no late compile); the 43-58 ms frames sit on post-reveal texture uploads, one texture's mips a frame: the painted horizon's day / night strips (3072x352, by design lazy after boot, HorizonMatte.load fades in ~1.5 s), the knife skin's map / AO / normal (512^2) and ~12 more 512^2 textures off the scene materials, ~8 MB over the first ~1.2 s; then 30 fps. Moving them under the loader means awaiting decode + upload before reveal (a load-path change, not an exact cut). Lead: a steady ~23 texSubImage2D (~128 KB) every frame. Simulator grid drive into Pine: interior 30.3 fps / p95 35 ms; the crossing (activate 698 ms, travel 219 ms) is G828's. **Reading (2026-10-30, sp-o5, bb68a5376f, budget.mjs Chromium 4x, median of 3, shared Mac loaded: repeats ±4 ms)**: SHARDFILE / LEGACY p50 P1 14.2 / 13.8, P2 16.7 / 11.4, P3 17.9 / 14.6, P4 18.2 / 16.9; update 5.0 / 4.1, 5.6 / 3.0, 6.3 / 4.1, 5.7 / 4.3 ms. Not met: the update side stays 1–3 ms over.  **Latest retained PF12/PF13 evidence** (`6a15be20f8`, sp-o5, `fae0b51e17`, shared Mac/peer route overlap): Chromium 4× SHARDFILE vs LEGACY p50 P1 13.5/11.7, P2 12.1/12.9, P3 13.3/13.0, P4 16.4/15.1 ms; update 4.8/4.1/4.6/5.2 vs 3.5/3.8/3.9/4.0 ms. P1/P3/P4 stay over LEGACY on diffuse update, not a GPU gap. WebKit SHARDFILE P1–P4 p50 4/4/4/5 ms. Simulator (`de4a013bc0`, `b124f46e8d`, official spawn/pond/cabin standing poses, not the authored four poses or walk): 30.3 fps held, p95 34/34/34 ms, max 34/39/34 ms, work p95 6/6/7 ms; this standing cadence passes, and WebContent CPU remains unmeasured. G872 closes the measured row without claiming legacy parity, full-route Simulator proof or a relaxed frame bar. | S |
| PF13 | **Milestone B: the bar** (after PF10) | Chromium 4x: every pose and the walk **≤ 12 ms p50 / ≤ 16 ms p95**; WebKit (Mac) ≤ 4 ms p50 at P1 (QC4: 6 today, LEGACY 4); Simulator: 30 fps held, max frame ≤ 50 ms, WebContent CPU ≤ 20 % (FC16 read Pine at 24.5 %; G929 accepted ~22 % as MF20's floor, this plan goes under it). Then Jake's phone QA, then LD5–LD10 on his word **Reading (2026-10-30, sp-o5, fae0b51e17, budget.mjs, one run each, shared Mac with a peer's route run)**: WebKit SHARDFILE p50 P1 4 / P2 4 / P3 4 / P4 5 ms: P1 ≤ 4 met. Chromium 4x SHARDFILE / LEGACY p50 P1 13.5 / 11.7, P2 12.1 / 12.9, P3 13.3 / 13.0, P4 16.4 / 15.1; SHARDFILE p95 15.7 / 14.7 / 15.3 / 18.5; update 4.8 / 4.1 / 4.6 / 5.2 vs LEGACY 3.5 / 3.8 / 3.9 / 4.0. Not met (LEGACY itself misses 12 at P2–P4 on this load); the self-time profile is flat, the gap is ~1 ms of diffuse update. GPU is not it: G1's Pine table (a9cadc076b) has SHARDFILE whole-frame at or under LEGACY (P1 −0.02, P2 +0.08, P3 −0.36, P4 −0.74 ms). Simulator (2026-10-31, sp-o5, b124f46e8d, `scripts/frame-floor.mjs --surface=sim`, iPhone 17 Pro phone tier 2×, SHARDFILE only: the tool has no LEGACY mode, and P1–P4 are budget.mjs coordinates, not authored cameras, so its own spawn / pond / cabin standing poses): 30.3 fps held at all three, p95 34 / 34 / 34 ms, max frame 34 / 39 / 34 ms (≤ 50 met), work p95 6 / 6 / 7 ms, 88 / 79 / 120 calls; PASS. WebContent CPU ≤ 20 % is not read by this tool: not measured. | Opus · **closed: measured, bar not met (2026-11-03, sp-o1; G872 / G965 / G979)**. Profile of HEAD 0d4b667666 (Chromium 4x, budget.mjs + CDP profiles, sourcemapped; WebKit; a 104 s walk-and-turn hitch trace; upload census; Developer on / off): desktop CPU is at the recorded legacy level (no hitch: 0 program links on the route, worst frame 29.9 ms at 4x / 12 ms WebKit; uploads ≤ 51 KB a frame; Developer on / off within noise), so what remains is absolute per-draw and creature cost. Ranked at P4 / cabins: `engine.creatures.update` 1.0–2.1 ms (skip floor −2.0…−2.7, diffuse: view pose, think, sync, motion), per-draw overhead (95–145 draws), shadow pass 0.8–1.6, equipment / world ~+0.3 each over legacy (G965, sp-x6 / sp-x9). Cuts landed, each exact: `bc673bfcca` a graph batch's near / far levels share one BatchedMesh (cast split by instance in the shadow pass): trees 6 → 4 main draws, legacy's count; `e0689dd87b` sorted batches skip the distance sort in shadow draws; `bd8c77708a` the crossbow's 4 cord meshes one rigid-skinned draw (viewmodel 15 → 12; vertices within 1e-6); `62c0be49ef` far-herd members gather onto earlier pages (cabins: a family on 14 + 2 / 8 + 2 slots → one page). Pine look parity proof (`proof-pine-look-parity`, base 0d4b vs bd8c, phone + desktop, six poses): pixels identical everywhere, phone north 80 → 78 calls, +1 program (the skinned cord). Quiet reading (05:25–05:37Z, base `0d4b667666` vs HEAD `62c0be49ef` interleaved base / head / base / head, Chromium 4x, "iPhone 16 Pro", phone, 2x, midday / clear, Developer; shared Mac, no optional gates): work p50 P1 / P2 / P3 / P4 / cabins C2 / walk, mean of 2: base 12.7 / 14.0 / 13.0 / 14.85 / 14.25 / 14.0, HEAD **12.8 / 12.65 / 13.25 / 14.3 / 13.95 / 12.65 ms**; HEAD p95 14.3–16.7; calls 92 / 96 / 100 / 126 / 109 → 86 / 89 / 92 / 118 / 103. WebKit (Mac) HEAD p50 4 at every pose and the walk (mean 4.0–4.5), base 4 (mean 4.2–4.5). Against legacy (deleted, G966; recorded only): legacy's paired 10-30 session read 11.7 / 12.9 / 13.0 / 15.1 ms (PF12 walk 17.1), WebKit 4 everywhere: HEAD is at or under it at P2–P4 and the walk, ~1 ms over its best P1 reading, inside legacy's own 11.7–15.1 spread; WebKit equal. Remaining gap to this row's bar: Chromium p50 0.3–2.3 ms over 12 (P4 14.3 the worst), p95 ≤ 16 met except one P4 leg at 16.7; WebKit ≤ 4 at P1 met; Simulator 30 fps held met (10-31). Not built: the hands / sleeves merge (the sleeves stretch to the elbow, so skinned normals would differ), the cabin PBR merge (PF17, texture arrays), a creature cadence change (G954 keeps it). Earlier contaminated legs (sp-x9 gates 05:14–05:22Z) are kept in `tmp/pf13-o1/cohort.log`, not used. | S |
| PF14 | **One per-draw hook, not six** (low-hanging fruit L1 from the [engine performance draft](engine-performance-mini-plan.md) §7, E515; shared with [nine-fix](nine-fix-mini-plan.md) NF21): fold the six engine bookkeeping wrappers and two `properties.get` hooks around every draw into one. | Pine P1 work p50 −1.0 ms or more at Chromium 4x against the parent build, same draws, pixel-identical at P1–P4. | **done — measured close** (2026-10-31, sp-x2; G872), shared EP2/NF21. `61e4935b2f` final Q4 LG work 12.8 → 12.9 / SF 15.0 → 14.6 ms at 129/133 draws; child wrapper/property .532/.497 and .641/.585 ms. Original .3/.1 ms and P1 matched-draw −1 ms targets are **not met**. All four poses in both modes have fresh raw-zero M3 A/A+A/B. [EP2 close-out](engine-performance-mini-plan.md#ep2-measured-close-out-2026-10-31) lists every exact cut, earlier P1/Q4 cohorts, native components and remaining dispatch lever. No further hook prototype tonight; CI10 follows. | S |
| PF15 | **Opaque draws sorted by program** (L2, E515; shared with NF22): Pine switches programs 98 times a frame for 66 programs, with 1,629 uniform calls. Measure first. | Pine P1 program switches ≤ 70 a frame; work p50 ~−0.5 ms; pixel-identical. **Closed: measured (2026-10-30, sp-o5, G872)**: Pine P1 on GLSL draws 59 switches = opaque 27 (23 programs), transparent 22 (20), shadow 8 (7), effect 2, under the bar without a sort; a sort keyed on each draw's actual program saves ~4, pixel-identical; not built (EP3, NF22). | Opus | S |
| PF16 | **Re-cull like legacy on Pine** (L5, E515; the Pine line of NF5): per-copy culling with legacy's thresholds and changed-only uploads. | Pine 360° pan at 4x: work p50 within 0.5 ms of the still hold; no instance missing at the frame edge. | Opus · **done** (2026-10-30, sp-x1, G958; EP9 on HEAD `b609e7179b`): Pine Q4 pan 17.8 ms vs 18.9 still (−1.1); buffer calls mean 9.6 / p50 9 / max 21; zero edge omissions, Forest full-turn frustum test `d60f431cc9` | S |
| PF17 | **Cabin PBR set as one material** (after Jake's QA; pine-frame's estimate) | P4's main pass draws 125 vs P3's 86: the ranger cabin in view. Its 6 textured materials (1024² ASTC 4×4 map + normal, 512² ETC2 ORM; tint and roughness / metalness scalars differ, one on the slab program) draw one each. EP7's layered map covers only the diffuse: add layered normal and ORM, per-vertex tint and roughness / metalness (flat varyings, so the numbers stay bit-exact), and merge the parts per unit at author time (cabins are frozen there). Done: the cabin's textured parts in ≤ 2 draws, captures identical at P4 and a cabin close-up, P4 work −0.4 ms or more at Chromium 4x. ~3–4 h. Not worth it: the 3 untextured opaque parts (chink, iron, char: 3 → 1, ~0.1 ms) | **closed, measured (2026-10-30, sp-o1; E518 / G872)**: on HEAD 587a960 at P4 the cabin draws 5 textured standard parts (cabin-cluster): 4 share formats (ASTC 4x4 1024^2 map + normal, ETC2 512^2 ORM; roughness 1, metalness 0) but differ in tint (f3efe7 / f9f3ec / ffffff / ede7e1), normal scale (1 / 0.8) and draw band (two hide past 183.6 m, `until`); the fifth (end grain, 17.7k tris) is an uncompressed 256^2 map with 1x1 normal / ORM, which cannot join a compressed array. An exact merge (layered map / normal / ORM, flat per-vertex tint and normal scale) can only join the 3 band-free parts: 5 -> 3 draws, ~0.07 ms at 4x; <= 2 draws and -0.4 ms need the bands merged (a visible change at 183 m) and the end grain re-baked compressed. Not built: the gain is under the noise; the 6-material estimate assumed graph parts (roof / door / stone) that are separate looks. | M |
| PF18 | **G965 exact update parity** | World / equipment / movers retain every state, pose and wake condition; each system targets recorded LEGACY + 0.05 ms. Landed 6c03a7825d / 62941932c9 improve only measured lookup/evaluator components. The three-pin native readings miss parity. Both cuts count as pixel-identical under G941: the raw strict reader failures reproduce as in-build held-view flicker. No comparator allowlist changes; full bounded G965 reading below. No native gain is claimed. | Codex (sp-x6 world; sp-x9 equipment; sp-x8 movers measured, neutral attempt rejected), parity open | S–M |
| PF19 | **Per-draw parity after the terrain merge** | ≤ 48 µs a draw at P1; identical. | **closed as measured miss (2026-10-31, sp-x8; G872)**: immutable `4fb407395b` includes the ground merge and final EP2 cuts. Metal phone 2×/CPU4× P1, 180 native pairs per mode: LEGACY/SHARDFILE pooled **78.897/79.328 µs**, medians 85/91 draws, maxima 87/93. Separate exact-map profile shows 0.985 ms/frame own hooks (~11.175 µs/profile draw), 2.948 ms other stock work, 0.861 setProgram remainder, 0.746 uniform handling, 0.498 onBeforeRender and 0.200 texture handling. No safe new exact skip remains; no runtime change or bar waiver. Shared-host CPU overlap is retained. Full method/function table: [engine performance §9](engine-performance-mini-plan.md#9-ep10--pf19-per-draw-reading-after-ep2-2026-10-31). | S |
| PF18 | **Update-system parity (E518)** | Each system at P1 targets LEGACY + 0.05 ms. **Closed as measured; parity not met (2026-10-31, sp-x9, G872 ruling)**: `b09eb3bda1`, shared-Mac Chromium Metal 4x / phone, world **0.372 vs 0.109 ms**, equipment **0.513 vs 0.228**, movers **0.091 vs absent**; HUD **0.142 vs 0.166 passes**. Exact partial cuts `693e0d2b12` and `b09eb3bda1` have four-pose M3 A/A and A/B all zero, without an isolated frame-gain claim. Six private variants rejected: publication-bank swap, entity-copy cache, flattened immutable leaves, effects-only mover math, duplicate numeric-read removal and single-port specialization. The final shared-read traversal attempt retains every live lookup/getter/lane order, but 12-leg warm actual HeldPlayback pairs were inconsistent: direct indexing CPU 380.191 -> 373.586 ms, prebound keys 417.857 -> 428.421 ms; 1,200-frame output digests equal. No structural candidate landed; mutable reads, private locals and partial-refusal publication remain unchanged. | **closed: measured, not met** (sp-x9; G872) | S–M |

### PF5 measured verdict (2026-10-30)

**Open; landed partial.** `5fbb571fc5` reuses elite observation selection, flag scratch and empty effect/strike
collections; `8cfbb131ca` compiles chapter observation reads and queries the actual flag owner, including silent
restore. No rule, guest, motion/contact, chapter clock or presentation step is deferred. Pine's guests already declare
`tick: 10`; its outer owner advances fixed-step motion/contact at 60 Hz. Batching that owner was withdrawn because it
would shift observations without reducing guest calls.

Exact parent `1550680178` (`1550680-mvvay9ea`) versus `8cfbb131ca` (`8cfbb13-mvvb02xz`), only these two commits
between them. Chromium 4x, iPhone 16 Pro portrait, phone tier, 2x, seed 357, midday/clear, muted; shared Mac, no quiet
window. Each pose: 4 s settle, separate 4 s clean and system-attribution windows. All four road arrivals are required.
LEGACY is a reference on the candidate pin; it is unchanged by these two commits.

| Chromium 4x work p50 / p95 ms | Parent SHARDFILE | Candidate SHARDFILE | LEGACY reference |
|---|---|---|---|
| P1 | 19.7 / 21.8 | 17.7 / 22.0 | 15.3 / 18.0 |
| P2 | 18.6 / 20.4 | 18.7 / 22.4 | 12.8 / 14.7 |
| P3 | 19.2 / 21.0 | 21.7 / 23.6 | 14.0 / 15.4 |
| P4 | 20.1 / 22.1 | 21.6 / 23.6 | 16.1 / 17.9 |
| Gate road | 20.1 / 26.5 | 21.2 / 24.9 | 15.1 / 18.3 |

The five targeted systems sum to **1.064–1.255 → 1.093–1.355 ms**, not ≤0.5. Elite time is approximately unchanged
(0.483–0.569 → 0.509–0.566 ms). Update p50 is **5.3–5.8 → 5.2–6.2 ms**, not ≤4.0. Untouched world/render cost
also drifts, so no causal whole-frame win is claimed. WebKit native work p50 at P1–P4 is **6/6/6/7 → 6/5/6/6 ms**
(1 ms timer resolution); the walk is 6 → 6 ms. LEGACY WebKit is 4/4/4/4 ms, walk 4 ms. Every six-leg reading
completed all four poses and four road arrivals with no page errors. Zero steady-state allocation and the GC bar
are not established.

Remaining cost is fixed-step guest/motion work plus live material/forest/building updates and quest/HUD presentation;
those visible parts remain per frame and belong with PF6. The source removes temporary bookkeeping without meeting the
row's performance bar. The original 29 elite/ABI focused cases, new atomic observation refusal, seven chapter/story
controls and six Pine/entered-presentation controls pass; root types, named lint and 7712-file ratchet pass. The
product-backed chapter suite refused stale DW/Pine products before collection; no guard was weakened. Raw readings:
`tmp/sp-x9-pf5/` (scratch). No Simulator milestone or physical-phone claim.

**Why 12 ms.** A hot iPhone runs ~2x slower than a cool one. 12 ms at Chromium 4x leaves ~24 ms hot, inside the 33 ms of
a 30 fps frame with room for a spawn, a fight or a turn. LEGACY's 14 ms becomes ~28 ms hot: it holds, but only just.
The budget table's targets add up to ~12 ms: update ≤ 3.2 + render ≤ 8.8.

**Expected savings at P1** (overlaps removed; P4 runs ~1.5x these): PF1 −2.0 (trees + half the node hook + 15 shadow
draws), PF2 −0.5, PF3 −1.2, PF4 −0.5, PF5 −1.3, PF6 −1.0, PF7 −0.4, PF8 −0.8, PF9 −0.6, then PF10 −1.0 (the
remaining node hook) and −0.4 (programs, uniforms). Total ≈ −9.7 ms: 21.0 → ~11.3 at QC4's reading, 17.9 → ~8.2 at this
session's.

## Order and dependencies

1. **PF1 first** (the biggest single cut, Jake's call), then PF2 on the same path. PF5 runs in parallel on Codex from the
   start (non-visual). PF4, PF7, PF8 and PF9 are small Opus rows that can interleave.
2. PF3 and PF6 after PF1 / PF2, so they measure the smaller caster set and the real update.
3. **PF12** (milestone A): Jake's QC4 phone QA happens here, not after FG4.
4. **PF10 depends on FG1 → FG2** of the Nine frame-cost plan (`tmp/wildshard-v-nine-plan/frame-cost.md` §8). It is Pine's
   share of FG4, not a second copy: FG4's other shards (Driftwood, Nalati, Far Reach) stay FG4's. FG3 (Nine) and FG5 are
   not needed for Pine. FG6 (delete the TSL runtime) waits for PF13. FG0 is Nine-only.
5. **PF13** (milestone B), then G933's legacy deletion on Jake's word.
6. **three r187** (E513, `tmp/wildshard-v-three-r187/`): no dependency. Its `BatchedMesh` fixes (sort corruption #34828,
   node-compatible shadows #34829, a matrix-data leak #35272) help PF1 / PF2 if r187 lands first; PF1 does not wait for it.
7. E515's engine-performance draft may add low-hanging rows that touch Pine; they join this plan as PF rows, not asks.

## Questions for Jake (each with a recommendation; option 1 is always Skip)

1. **Batched trees on Pine again?** (legacy's 4 + 3 draws instead of 34 + 18; −2 to −4 ms a frame)
   - Skip for now
   - **Yes, on by default now; the instanced path stays a Debug fallback until your phone QA, then deleted (Recommended)**:
     legacy Pine already draws this forest batched on your phone; E271 / E272 ban the facade, not trees.
   - Yes, but default-off behind a Debug row until a phone reading (RENDERING.md's default; you would have to flip it)
   - No: wait for the GLSL back-end (PF10), weeks away
2. **When do you QA Pine's fps?**
   - Skip for now
   - **At milestone A (PF12: batched trees + the cheap cuts, ≤ legacy everywhere), then again at B (≤ 12 ms) (Recommended)**
   - Only once, at milestone B
3. **The bar: ≤ 12 ms p50 / ≤ 16 ms p95 at Chromium 4x on every pose and the walk** (legacy is 14 / 16; ~24 ms on a hot phone)
   - Skip for now
   - **Yes, 12 / 16 (Recommended)**
   - Tighter: 10 / 14 (needs look trades: thinner far trees and shadows, which G928 already declined)
4. **Look trades: none are planned.** Every row keeps today's look (tree LOD distances stay, G928). If a cut misses
   pixel-identical, the builder decides from a labelled board under G872 and logs it. Keep it that way?
   - Skip for now
   - **Yes, the builder decides from boards and logs it (Recommended)**
   - No, ask me for each look trade

### G965 exact update work (2026-10-31, sp-x6 / sp-x9)

Jake reopened pixel-identical modern Pine CPU work. World is sp-x6, equipment is sp-x9; sp-x8 took over movers/canoe below. Pine LEGACY is retired by G966: the legacy 0.11 ms world / 0.23 ms equipment numbers are recorded observations, not a current paired read. The original plan budget protocol stays Chromium Metal, phone 2x, CPU 4x, seed 357, P1-P4, without ablations.

The one committed pre-deletion HEAD probe (7b0c9131b6, build 7b0c913-mvwy7bvv) retained valid P1/P2 CDP profiles. It refused a negative CDP clock delta during P3; its earlier P3 budget window remains, P4 was never reached, and the failure was not retried. Browser and preview were closed; the earlier preview-builder overlap with the peer Road turn is retained. This is a partial diagnostic, not four-pose acceptance.

| Pose | World ms | Equipment ms | physics.movers ms | pine.movers ms | Native work p50 / p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| P1 | 0.444 | 0.551 | 0.091 | 0.073 | 12.9 / 15.5 |
| P2 | 0.321 | 0.471 | 0.092 | 0.062 | 11.8 / 13.8 |
| P3 | 0.323 | 0.527 | 0.103 | 0.054 | 13.1 / 15.9 |

World samples spread over forest parameters, lighting and quest updates. paramWriters self was 0.0107 / 0.0318 sampled ms/frame at P1/P2. 6c03a7825d reuses the last owner's existing writer book, keeping every owner read, parameter write, generation invalidation and reentrant cold-book identity. Four focused suites, root types and typed lint passed; the six-process lookup component retained all 4.5 million callbacks per leg and their digest, median wall 39.536 -> 36.675 ms / CPU 41.839 -> 39.449 ms. That does not establish a native frame or FPS gain.

Mover attribution was small and diffuse: native matrix propagation / multiplication plus Rapier synchronization dominated physics.movers; pine.movers spread across publication, carry, motion and effects. Skipping fixed-step publication, native pose writes or wake behavior is not an exact cut. No mover runtime change or canonical-state cache is claimed.

Equipment 62941932c9 (sp-x9) is the separate two-path channel-source specialization on exact parent 6c03a7825d. Its 17.48% held-program component result is not 17.48% of equipment or a frame. Six fresh legs retained 27 actual held programs / 168,000 output values, 3,226 refusals and mutable/accessor traces. Its 31 focused controls, root types and typed lint passed.

The subsequent serial three-pin cohort completed at 22:37:25Z: 9cca053447 -> 6c03a7825d -> 62941932c9. Each edge differs only in its two source/test paths. All builders and the required coalesced product proof plus reserved Road reading closed before this cohort; no inter-leg build or source replacement was used. All twelve native pose readings exited zero, using the original budget protocol with CDP profiling and ablations off. Each native budget window observed 90 frames, except parent P4's 91. These are single-cohort observations with the separate instrumented system means below, not a median of repeated matched runs or an isolated FPS-gain claim. Native draw medians varied by one on several poses.

| Pose | World ms: 9cca / 6c03 / 629 | Equipment ms: 9cca / 6c03 / 629 | Native work p50 ms: 9cca / 6c03 / 629 | Native calls: 9cca / 6c03 / 629 |
| --- | ---: | ---: | ---: | ---: |
| P1 | 0.369 / 0.358 / 0.387 | 0.468 / 0.442 / 0.522 | 11.8 / 10.9 / 11.4 | 93 / 92 / 93 |
| P2 | 0.402 / 0.400 / 0.357 | 0.459 / 0.410 / 0.460 | 10.9 / 10.4 / 11.3 | 95 / 96 / 95 |
| P3 | 0.387 / 0.332 / 0.372 | 0.499 / 0.508 / 0.505 | 11.9 / 11.6 / 12.0 | 100 / 100 / 99 |
| P4 | 0.391 / 0.332 / 0.361 | 0.467 / 0.454 / 0.462 | 12.9 / 12.6 / 13.6 | 126 / 125 / 126 |

The world and equipment legacy + 0.05 ms parity bars remain open. No equipment native improvement is demonstrated. The final revision misses P4's 12 / 16 ms work bar at 13.6 / 16.3 ms. No fixed-step, wake, physics, look or budget assertion was changed; no mover cut was activated.

Both maintained held-inclusive M3 readers completed all four poses and retained strict EXIT1. Each had the same raw failures: P2 A/A one pixel at (566,516), RGBA [151,108,86,255] -> [152,108,86,255]; P4 A/B three pixels at (573,514), (572,515), (573,515), with maximum channel difference 6. These are not the old approved G941 coordinate/value pairs. Every frame included 15 actual held draws, at 804x1748. No gate, byte, tolerance or capture was changed or retried.

Offline comparison of those existing images found exact full RGBA at P1-P4 for 9cca repeat 0 versus 6c03 repeat 0, and for 6c03 repeat 2 versus 629 repeat 2. Camera/projection matrices, clock, frame, player position, draw/triangle counts and held-draw metadata all matched. Crucially, unchanged 6c03 repeat 2 versus repeat 0 reproduces the same three P4 pixels. This is source-counterpart and capture-order evidence; it does not turn either original strict reader into a pass or approve new flakes. The update-parity bars remain open. **G941 ruling (Jake via wildshard-new, 2026-10-31): both 6c03a7825d and 62941932c9 count as pixel-identical.** P4 reproduces within unchanged 6c03; P2 is an A/A difference. Record both as observed held-view flicker caused within a build, not by either cut. The raw strict EXIT1 results stay, and neither coordinate/value set enters any comparator allowlist. A recurrence elsewhere goes back to the coordinator.

Retained data: tmp/sp-x6-g965-pine/raw/head-7b0c9131b6/{row.json,ranked.json,P1.cpuprofile,P2.cpuprofile,private-maps}; native-summary.json, native-pair.json, pixels-world/reading.json, pixels-equipment/reading.json and pixel-classification.json in the same task root. All owned preview leases were released at whole exit; only sp-x9's separately joined 629 baseline remains for T4. No second profile, unchanged retry, native gain, official Simulator or phone acceptance is claimed.


#### G965 movers/canoe follow-up: neutral exact attempt (sp-x8)

**Measured, no runtime cut landed.** Reused the valid 7b0 P1/P2 maps and
samples first; no P3 clock retry or retired LEGACY build. All five mover,
physics and canoe source leaves remained byte-identical from 7b0 through
this probe. One necessary committed-HEAD preview pinned
`22d77e85c091d1a8710b435ba8d9bf31e8aab335`, build
`22d77e8-mvx6rocf`, supplied the fresh reading. Required release entries,
X6's matched codec stage and the final Pine publisher closed before its
browser started. The browser and own preview lease closed at
2026-11-01 02:13:56Z; there was no concurrent builder or timing cohort.

Original protocol: Chromium Metal, iPhone 16 Pro portrait, phone render
2x, CPU 4x, Developer/seed357, P1/P2 only, no ablations. Each native
budget window contains 90 frames; the separate valid CDP windows each
contain 152 frames. These are single baseline readings, not an A/B frame
or FPS improvement. The system means below are instrumented attribution,
separate from the native work distribution.

| Pose | physics.movers mean ms | pine.movers mean ms | Native work p50 / p95 ms |
| --- | ---: | ---: | ---: |
| P1 | 0.095 | 0.072 | 12.3 / 14.1 |
| P2 | 0.076 | 0.053 | 11.4 / 13.6 |

The canoe is the single admitted `pine.canoe` row inside `pine.movers`,
including its command, motion/effect, view and carry publication. It has
no separately measured retained clock; do not add an invented canoe cost
on top. No individual mover LEGACY clock is retained either. The old
world/equipment numbers above remain recorded observations only.

P1 sampled self-time leaders (ms/frame, sparse samples rather than new
per-function timers):

| Lane | Top five self-time items |
| --- | --- |
| physics.movers, 18 samples | sync 0.01018; pose reader 0.00915; Three updateWorldMatrix 0.00757; native translation boundary 0.00547; decompose 0.00403 |
| pine.movers, 23 samples | MoverRuntime.step 0.02656; ScriptWorld.entity 0.01394; effects.prepare 0.01040; MoverMechanic.step 0.00915; published pose 0.00407 |

P2 shifts physics self-time toward Three quaternion extraction 0.01519,
hierarchy update 0.01486 and matrix multiplication 0.00987 ms/frame;
its 15 physics / 13 canoe-lane samples do not establish a new serial
pole. Native pose writes, effects, carry and wake semantics remain work,
not permission to freeze the canoe or skip fixed steps.

**Exact matrix-cache candidate rejected.** A read-only 120-fixed-step
capture at each pose found nine followed pieces: three NPC anchors and
six cabin doors. Of 2,160 decompositions, 2,151 repeated identical input
matrices. Float64 bit receipts retain signed zero. The private candidate
still called every normal hierarchy update, active/collider check and
native pose write; it reused only finite, exactly identical matrix
outputs. All captured position/quaternion/scale bits matched. Separate
original/candidate real-Rapier controls retained full snapshots across
400 simulated frames and 880 ordinary pose writes, including independent
interleaved readers, sleep/wake, parent/frame changes, negative scale,
followRotation changes, enable/resize, plus singular/non-finite cases.

One quiet six-fresh-process kernel comparison, paired order AB/BA/AB,
replayed the actual 240-frame/nine-piece input set 100 times per leg:
216,000 helper calls. Original medians **9.274375 ms -> 9.248584 ms
(-0.278%)** are neutral. Input comparison and result copying consumed
the saved decomposition work. This is kernel wall only, excluding live
hierarchy propagation and native pose writes; it is not a system/frame
saving. The 0.437-second cohort closed at 02:22:07Z. No cache was
activated, no state/replay/pose/wake check was skipped, and the unused
off-tree implementation was deleted. With no runtime cut, no new pixel
A/B or pixel-pass claim is manufactured. G965 parity remains open.

Retained diagnostic evidence:
`tmp/sp-x8-g965-movers/raw/head-22d77e85c0/`
(`row.json`, `ranked.json`, P1/P2 profiles, exact private maps and matrix
inputs), `baseline-binding.json`, `probe-reading.json`,
`controls-{before,after}.json`, `matrix-exact.json`, `component.json`
and six `component-legs/` readings. All actual source/input/helper hashes
are bound in those readings. All owned browser/build/native CPU and
preview leases are closed; there is no next mover cohort attached.
