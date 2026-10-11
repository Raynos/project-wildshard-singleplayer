# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-10 19:50 CT.** Councils done. Part A only. **Route: the shardfile design system (G319, `design-system.md`).** Now phase 0 = SF79 (DS0.1–0.5, with SF76–SF78); then SF80 authoring core; then SF81–85 in parallel; ports resume Signal → Sky → Nine → Driftwood → Pine → Nalati. G312–G318 folded into SF76–SF78 (`4390474a9`).

**Milestones**
- **M1:** done.
- **M2:**
  - **SF22 desktop:** PASS (`d393dc95b`).
  - **SF22 Safari:** install PASS; **0 draw compiles** (was 46); cadence FAIL (p95 49): the gaps are main-thread waits (165 ms with 5 ms frame work), not rendering (`9c3b969c2`); desktop warm task 51 ms > 50; Nine cell entry 191 ms on the Simulator (sp-x5).
  - **Memory:** G269.
- **M3:** **0 of 6 at 80/20** under Jake's measure.

**Live:** origin/main = HEAD (`c528d9b63`, 19:44); backlog landed (`acb850d96`).

**G298 done:** all six shards' bakers in their own `generators/` (only the shared `bake-sky.mjs` HDRI baker stays in scripts/). **G292:** shared cache + runner (`3ab406c30`, `d1469f93f`), every shard's producers declared and Darwin-exact (Nalati physics after `8b144a8d0`), witness checkpoints on the cache (`298d0b856`), **their 15 payloads (9.2 MB) out of git** (`91a3d7cba`).

**80/20 (G291 + G294, `2218a5937`, report-only):** custom = shard runtime TS + one-user game/SDK TS, over the frozen legacy TS.

| Shard | Custom / legacy |
|---|---|
| Nine | 53.6 % |
| Sky | 74.2 % |
| Signal | 79.7 % |
| Nalati | 95.4 % |
| Driftwood | 97.7 % |
| Pine | 100.1 % |

**Lanes (Jake G329: 0 Opus, Codex only; the 3 running Opus lanes finish their current item, then stop; graphical rows wait for Opus)**

| Lane | Work |
|---|---|
| op-hitch45 | finishing: buildPacing A/B, then stops |
| op-hitch48 | done: Sim census fix (`9fca2b6ce`); frame-cap patch handed to sp-x2 |
| op-hitch49 | done: Pine leg rigs sliced (`050505dcc`); Signal activate handed to sp-x2 |
| sp-x1 | DS0.1 Nalati + Sky move-back · Nalati witness |
| sp-x2 | DS0.1 Pine leftovers · Signal 117 ms activate frame · then the frame-cap patch |
| sp-x4 | DS0.1 Driftwood + Signal move-back (legacy imports: copy, never move) |
| sp-x5 | DS0.2 game plugin/* · DS0.3 guards · SF77 metric |
| sp-x6 | DS0.4 scripts → shards · then SF80 non-visual rows |

**Jake picks landed:** G321/G322/G324/G325/G326 (all six public cards shardfile)/G327/G328.

**Follow-up:** fresh SDK install needs npm `@loaders.gl/worker-utils@4.5.4` (else pin core 4.5.3).

**Decisions:** G290–G328 in the plan; `design-system.md` is the route.

**Jake (open picks; details `docs/reviews/shard-platform-open-picks.md`):**
- SF63 Driftwood shadows Tight: `art/sf63/round-1-driftwood-shadows/board-ab.jpg`
- Sky isles fixed vs random: `progress/shard-platform/sky36/isles-board.jpg` (recommend D, fixed)
- SF59 fixture looks: `progress/shard-platform/sf59/tsl-spike-desktop.jpg`, `sf59-pastel/`
- G260 Blender: `art/blender-template/round-2-look/board.jpg`, `round-3-filled/board.jpg`
