# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-09 15:20 CT.** Councils done (11 rounds). Part A only; S1–S22 not started.

**Milestones:**
- **M1:** done (re-board SF16 at HEAD).
- **M2:** open. SF57 must re-qualify on the G270 layout and SF22 gates must pass formally; then G269, Jake's three phone runs.
- **M3:** open. 1 of 7 at 80/20 (Template 1, 90.4 %).

**80/20 (share · runtime/ceiling · compatible):**

| Shard | Share | Runtime / ceiling | Compatible |
|---|---|---|---|
| Signal Dunes | 20.9 % | 806/965 | ✓ |
| Sky Reach | 9.6 % | 1288/1377 | ✓ |
| Pine | 3.1 % | 5317/4339 | ✗ |
| Driftwood | 1.0 % | 5868/3753 | ✗ |
| Nalati | 0.4 % | 9583/6618 | ✗ |
| Nine Dragon | 0.2 % | 722/5033 | ✗ |
| Blender Template (8th, not counted) | 97.2 % | — | — |

**Live:** production **1c74e431-mv1exih9** (2026-10-09 20:23 UTC) carries G258 public Pine/Nalati/Sky, G266 Signal tiles-only, G270 public grid, G271 saver off, the shadow fix. Deploy unstuck: W0 `46397ef46` committed (no duplicate full test for a CI-green pin; pushing now); deploys stay hourly. **SF74 pipeline is owned by the plan agent's sf74-speed lane;** no coordinator lane is on pipeline work now (op-pipeline, op-witness and op-process are finished; their commits are listed in wall-clock-plan.md).

**Lanes (5 Codex + 5 Opus):**
- **sp-x1:** Nalati SF72.
- **sp-x2:** Pine SF72.
- **sp-x4:** Driftwood SF72.
- **sp-x5:** deploy → delete the shadow-bias row (Jake: keep new) → SF57 re-soak on G270 → SF22 gates.
- **sp-x6:** blender-template card facade + far-deck seams.
- **op-floor:** fps on HEAD, all shards and grids.
- **op-loading:** SF67, no task > 100 ms.
- **op-memdbg:** SF64 panel/report (< 10 % unattributed not reachable this session).
- **op-process:** G273–G275 CI and hook cuts.
- **op-bfill:** fill the Blender cell per G220 (Jake), board + video.

**Unowned, next as slots free:**
- **SF72:** Signal (~3.5k view lines to bake, Opus), Sky (~4.5k, Opus), Nine Dragon (ledger, Jian, gates, portal rides; Codex).
- **Systems rows (Codex):** SF36 weapon rows (2 kit subclasses left); SF34 player modes; SF24 directors as the only path; SF27 brains (Pine/Nalati/Nine); SF26 commons packs (G259); SF66 map inside the shardfile.
- **Opus:** SF28 panels (26 DOM files, E332); SF59/SF63 post and per-shard look; SF16 re-board; SF17b void wall + art check.
- **Small:** frame-floor.mjs refuses Signal's Developer-off entry.
- **Orphaned WIP:** untracked src/engine/ui/memoryPanel.ts + s_memory_debug_* strings (superseded by 8ecc29759): owner should drop.

**Jake:**
- **Done:** pier ramps, Signal tiles, shadow new, public 3×3.
- **Pending:**
  - G269 phone runs (+ the KTX2 phone verdict);
  - G260 Blender board;
  - confirm G120/G123/SF48 boards are moot.

The for-Jake page (docs/reviews/shard-platform-for-jake.md) is stale since 10-04.
