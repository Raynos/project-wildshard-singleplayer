# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-11 17:35 CT.** Councils done. Part A only. **Route: the shardfile design system (G319, `design-system.md`).** Now phase 0 = SF79 (DS0.1–0.5, with SF76–SF78); then SF80 authoring core; then SF81–85 in parallel; ports resume Signal → Sky → Nine → Driftwood → Pine → Nalati. G312–G318 folded into SF76–SF78 (`4390474a9`).

**Milestones**
- **M1:** done.
- **M2:**
  - **SF22 desktop:** PASS (`d393dc95b`).
  - **SF22 Safari:** install PASS; **0 draw compiles** (was 46); cadence FAIL (p95 49): the gaps are main-thread waits (165 ms with 5 ms frame work), not rendering (`9c3b969c2`); Nine cell entry 191 ms on the Simulator (sp-x5).
  - **Memory:** G269.
- **Frame floor (`c66b5b324`, clean):** every max gate passes. Desktop: only Pine short travel p95 33.3 (gate 17.5). Simulator p95 over 35: Driftwood 59, Pine 58, Signal 52, Sky 37, Nalati 36. Cell arrival waits remain for Driftwood, Pine and Nine.
- **M3:** **0 of 6 at 80/20** under Jake's measure.

**Live:** queue green, 99 commits reached origin at `8b9ff3e58`; production `1d378b7ba-mv49rdxs` until the next release. **sp-x7 = gate/CI/deploy lane (G330).**

**Queue:** `open-x-queue.md` (open engineering, 10-11 sweep). **Red → green (G330):** `red-green.md` (5 reds fixed 10-11).

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
| sp-x7 | gate/CI/deploy (G330) · E476 pusher messages · SF74 tails |
| sp-tidy | git tidy (G331): commit the backlog in small commits; .gitignore junk |
| sp-x2 | Nalati cold arrival 0 s (`8d8ae2711`) · every cell's arrival readiness |
| sp-x4 | ports at non-graphical floor (Driftwood, Nalati) · OS-F8 · SF22 Safari cadence |
| sp-x5 | OS-F1/F2/F10 done · one-shot run 2 · then SF82 BR-1/2/4/5 |
| sp-x6 | OS-F3–F7, F9 done · SF87/G320 + G292 clean room |

**Jake picks landed:** G321/G322/G324/G325/G326/G327/G328.

**Follow-up:** fresh SDK install needs npm `@loaders.gl/worker-utils@4.5.4` (else pin core 4.5.3).

**Decisions:** G290–G330 in the plan.

**Jake (open picks; details `docs/reviews/shard-platform-open-picks.md`):**
- SF63 Driftwood shadows Tight: `art/sf63/round-1-driftwood-shadows/board-ab.jpg`
- Sky isles fixed vs random: `progress/shard-platform/sky36/isles-board.jpg` (recommend D, fixed)
- SF59 fixture looks: `progress/shard-platform/sf59/tsl-spike-desktop.jpg`, `sf59-pastel/`
- G260 Blender: `art/blender-template/round-2-look/board.jpg`, `round-3-filled/board.jpg`
