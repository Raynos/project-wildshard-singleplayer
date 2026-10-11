# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-11 06:55 CT.** Councils done. Part A only. **Route: the shardfile design system (G319, `design-system.md`).** Now phase 0 = SF79 (DS0.1–0.5, with SF76–SF78); then SF80 authoring core; then SF81–85 in parallel; ports resume Signal → Sky → Nine → Driftwood → Pine → Nalati. G312–G318 folded into SF76–SF78 (`4390474a9`).

**Milestones**
- **M1:** done.
- **M2:**
  - **SF22 desktop:** PASS (`d393dc95b`).
  - **SF22 Safari:** install PASS; **0 draw compiles** (was 46); cadence FAIL (p95 49): the gaps are main-thread waits (165 ms with 5 ms frame work), not rendering (`9c3b969c2`); Nine cell entry 191 ms on the Simulator (sp-x5).
  - **Memory:** G269.
- **Frame floor:** desktop all routes pass (return 100 ms on the line); Simulator travel/spawn/drive pass at ≤35 p95; open: outbound 277 ms, Nalati 19.7 s cold wait.
- **M3:** **0 of 6 at 80/20** under Jake's measure.

**Live:** origin moving again (07:07 CT); push CI and deploy pending (prod c24dd65af). **sp-x7 = gate/CI/deploy lane (G330).**

**Red → green (G330):** row-data export `255dd529c` → `b4a36e751`; Linux Nine physics `669511341` and Nalati places `27b0d8da1` → `baa8a3165` (sp-x4); layers TS6307 `baa8a3165` → `0f0fa888d` (sp-x7); Signal TS4023 `e16d4119e` → `2ce849ed3` (sp-x4); admin-deploy `0e9cb9801`/`b34239411` → `e8574fbb8` (sp-x7).

**G292:** shared cache + runner (`3ab406c30`, `d1469f93f`), every shard's producers declared and Darwin-exact, witness checkpoints on the cache (`298d0b856`), **their 15 payloads (9.2 MB) out of git** (`91a3d7cba`).

**80/20 (G291 + G294, `2218a5937`, report-only):** custom = shard runtime TS + one-user game/SDK TS, over the frozen legacy TS.

| Shard | Custom / legacy |
|---|---|
| Nine | 53.6 % |
| Sky | 74.2 % |
| Signal | 79.7 % |
| Nalati | 95.4 % |
| Driftwood | 97.7 % |
| Pine | 100.1 % |

**Lanes (0 Opus, G329; graphical rows wait for Opus)**

| Lane | Work |
|---|---|
| sp-x1 | frame floor: milestone rerun on HEAD (gate job handed to sp-x7) |
| sp-x7 | push queue + GitHub CI + daily deploy green, standing first responder |
| sp-x2 | Sim drive Nalati/Sky 35 PASS (`368a54202`) · Nalati cold-arrival wait 19.7 s |
| sp-x4 | DS1.5, SF83, SF84 X done (Template horse/anchors = Opus) · port Signal to 80/20 |
| sp-x5 | DS1.6 packs (figures wait: KTX2) · SF82 BR-1–5 landed, BR tail |
| sp-x6 | SF81 done · SF85 X done (WP-4 = Opus) · port Sky to 80/20 |

**Jake picks landed:** G321/G322/G324/G325/G326/G327/G328.

**Follow-up:** fresh SDK install needs npm `@loaders.gl/worker-utils@4.5.4` (else pin core 4.5.3).

**Decisions:** G290–G330 in the plan.

**Jake (open picks; details `docs/reviews/shard-platform-open-picks.md`):**
- SF63 Driftwood shadows Tight: `art/sf63/round-1-driftwood-shadows/board-ab.jpg`
- Sky isles fixed vs random: `progress/shard-platform/sky36/isles-board.jpg` (recommend D, fixed)
- SF59 fixture looks: `progress/shard-platform/sf59/tsl-spike-desktop.jpg`, `sf59-pastel/`
- G260 Blender: `art/blender-template/round-2-look/board.jpg`, `round-3-filled/board.jpg`
