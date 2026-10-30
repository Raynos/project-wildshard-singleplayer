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
| PF1 | **Batched trees back** (Jake's call above) | Graph looks may ride a non-facade `BatchedMesh` again: `place.ts`'s batched draw and `Forest`'s `path` stop refusing graph looks; the grid's cell prefix goes after every `#extension` line; `no-graph-batches.test.ts` becomes "a graph look batches, a facade never does"; Debug row **Pine trees: batched / instanced** (Developer), default per Jake's answer. Done: P1 trees 4 main + 3 shadow draws (from 34 + 18); P1 draws 162 → ≤ 125; node `beforeDraw` ~80 → ≤ 45 a frame; work p50 −2.0 ms at P1, −3.0 at P4; 0 `program not valid` over a grid walk into Pine and a standalone load; captures identical to today at P1–P4 (else a G844 board); `test-facade-instancing` green | Opus | M |
| PF2 | **Crags and props on the same path** | The world-scene batch and `place`'s batched rows take graph looks too (crag-cliff coarse tiles, pine-crags, mossy boulders, logs, stumps, the cabin yard's barrels / crates / buckets): one batch per material per tile, as LEGACY. Done: P1 crag-cliff 6 → 1, boulders 6 + 6 → 1 + 1; P4 barrels / crates / buckets 8 → ≤ 3; work −0.5 ms at P1, −1.0 at P4; captures identical | Opus | S |
| PF3 | **Shadow pass on a budget** | After PF1 / PF2 the cascade draws ~10 casters. Then a static-caster cache: terrain, trees, crags and buildings render into a cached depth target that is redrawn only when the cascade snaps or the sun moves; animals, the player and held gear draw on top every frame (the half of FC8 / FC13 that never shipped; FC13's "Idle frames" row only helps standing still). Behind a Debug row until a Simulator reading shows no swim or stutter, then on (G912 precedent). Done: shadow pass CPU ≤ 0.8 ms at P1–P4 and on the walk (from 2.6–3.8); no visible swim on a turn and a walk clip | Opus | M |
| PF4 | **Viewmodel draws** | The crossbow's static parts merged per material (11 → ≤ 6: wood, iron, prod, leather, cord, brass; the animated prod / string / bolt stay apart), hands + sleeves 4 → 2. Same materials, same look. Done: viewmodel ≤ 8 draws; its attributed render ≤ 0.35 ms; captures identical at P1 and in an aim / fire clip | Opus | S |
| PF5 | **Non-visual systems** | `elites`: the rule loop stays per frame, but an idle elite beyond 1.5 × its `awareR` calls its AssemblyScript `tick` on the `ai` band (10 Hz, as LEGACY's 0.14 ms); `main.world`, `quest` / `quest.kit`, `hud.combat` run on change or at 10 Hz; allocation hunt to 0 steady-state allocations a frame (GC 0.42 → ≤ 0.1 ms). No pixel changes (logic and bookkeeping only; anything that moves a body or the HUD look goes to PF6). Done: those systems sum ≤ 0.5 ms at P1–P4 (from ~1.7); update p50 ≤ 4.0 ms; elites still spawn, aggro and leash in the elite e2e | Codex | S |
| PF6 | **Visible per-frame systems** | `engine.creatures.update`: extend FC11's distance bands to think and motor (far idle animals step at 10 Hz, bodies interpolated); `main.equipment`: sway / recoil only while it moves; `shard.pine.weather`: state at 10 Hz, uniforms per frame (LEGACY 0.05 ms). Done: creatures ≤ 0.5 ms at P1 and ≤ 0.8 at P3 / P4 (from 0.8–1.8), equipment ≤ 0.2, weather ≤ 0.05; update p50 ≤ 3.2 ms; walk clip and an animal close-up clip show no stepping (before / after) | Opus | M |
| PF7 | **Animal draws** | Phone tier on Pine: the far herd (`animalFarBatchDist`) on past the eye distance for rigs with vertex colours, eye draws folded into the body past `animalEyeDist`; same materials. Done: animals ≤ 5 draws at P1 / P4 (from 9–13); attributed ≤ 0.3 ms; captures identical | Opus | S |
| PF8 | **Scene walk** | Hidden rigs leave the matrix walk (`animals` keeps 3,550 bone objects updated with 28 visible): a parked or culled rig gets `matrixWorldAutoUpdate = false` until it shows; static tile roots, coarse tiles, props and cabins get static matrices (`matrixAutoUpdate = false`, updated once at placement). Done: auto-updated objects 4,256 → ≤ 800 at P1; `updateMatrixWorld` ≤ 0.3 ms a frame (profile, from 1.1); captures identical; an animal walking into view poses on its first visible frame | Opus | S |
| PF9 | **The costly single draws** | `interact-lit` costs 0.35–0.40 ms for 1 + 1 draws, `pine-wildlife` 0.25 ms for 2: find what each pays per draw (material refresh, morphs, per-draw uniforms) and cut it without a look change. Done: each ≤ 0.1 ms attributed; captures identical | Opus | S |
| PF10 | **Pine on the GLSL graph back-end** (Pine's half of FG4, `tmp/wildshard-v-nine-plan/frame-cost.md` §8) | After FG1 / FG2 land: Pine's lit graphs (forest bark / needles / twigs, crag, water, cabins, wildlife, sky) compile to classic materials with the lighting stage as a GLSL light-model patch; trees and crags then batch as plain classic materials (PF1's graph-batch path is no longer used by Pine). Done: golden-still parity per graph (≥ 40 dB PSNR, < 1 % of pixels off by > 8) or a G844 board; 0 `beforeDraw` a frame; programs ≤ 100 (from 117), `useProgram` ≤ 60, `uniform*` ≤ 750 a frame at P1; FG4's Pine bar (≤ LEGACY + 0.5 ms) **and** this plan's ≤ 12 ms | Opus | M |
| PF11 | **GPU check, not a cut** | The plan works the main thread; confirm the phone GPU is not next. Done: Simulator GPU process ≤ 10 % at P1–P4 (FC15's bar) with grass (317 k triangles) and needle-card overdraw as they are; if it misses, a separate row with a board, never a silent density cut | Opus | S |
| PF12 | **Milestone A: legacy beaten** (after PF1–PF9) | Chromium 4x: every pose and the walk ≤ 14 ms p50 / ≤ 17 ms p95 (≤ LEGACY at each); WebKit (Mac) ≤ LEGACY at each; one Simulator reading through `scripts/sim-lane.sh` (official reader, quiet window): 30 fps held at P1–P4 and on the walk, max frame ≤ 50 ms. Then Jake's phone QA of QC4 (G933) | Opus | S |
| PF13 | **Milestone B: the bar** (after PF10) | Chromium 4x: every pose and the walk **≤ 12 ms p50 / ≤ 16 ms p95**; WebKit (Mac) ≤ 4 ms p50 at P1 (QC4: 6 today, LEGACY 4); Simulator: 30 fps held, max frame ≤ 50 ms, WebContent CPU ≤ 20 % (FC16 read Pine at 24.5 %; G929 accepted ~22 % as MF20's floor, this plan goes under it). Then Jake's phone QA, then LD5–LD10 on his word | Opus | S |
| PF14 | **One per-draw hook, not six** (low-hanging fruit L1 from the [engine performance draft](engine-performance-mini-plan.md) §7, E515; shared with [nine-fix](nine-fix-mini-plan.md) NF21): fold the six engine bookkeeping wrappers and two `properties.get` hooks around every draw into one. | Pine P1 work p50 −1.0 ms or more at Chromium 4x against the parent build, same draws, pixel-identical at P1–P4. | Opus | S |
| PF15 | **Opaque draws sorted by program** (L2, E515; shared with NF22): Pine switches programs 98 times a frame for 66 programs, with 1,629 uniform calls. Measure first. | Pine P1 program switches ≤ 70 a frame; work p50 ~−0.5 ms; pixel-identical. | Opus | S |
| PF16 | **Re-cull like legacy on Pine** (L5, E515; the Pine line of NF5): per-copy culling with legacy's thresholds and changed-only uploads. | Pine 360° pan at 4x: work p50 within 0.5 ms of the still hold; no instance missing at the frame edge. | Opus | S |

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
