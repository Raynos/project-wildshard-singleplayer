# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-12 21:40Z. G345 SPRINT (Jake, `34527bde0`): Signal Dunes + Sky Reach to 80/20 by ~09:30Z.** Quick checks +
push gate only; frame floor / Simulator / soak / boards / quiet windows paused. Lanes: `lanes/README.md` (sprint table).

**80/20 (custom / legacy, `scripts/shard-platform.mjs`; ≤ 20 % = done)**

| Shard | 21:40Z → 23:20Z (metric `f36d2a239`, authored `baked.ts` now counted) | Target lines |
|---|---|---|
| Signal Dunes | 70.7 % → **61.3 %** (2526 / 4122) | ≤ 824 |
| Sky Reach | 78.4 % → **63.9 %** (4329 / 6777) | ≤ 1355 |
| Nine | 69.5 % | — (graph rollout blocked) |

**Fleet:** Codex sp-x7 push/deploy, sp-x6 Signal baked ground; sp-x1/x4/x5 PARKED (Codex 9 %). Opus: Sky A sp-o29, rig-loader verify sp-o33, looks sp-o31 (grid ocean clip + hero r4 entered), G348 tail sp-o34.

**LOOKS LINE (Jake: "I don't want to forget this main hero thing and the near look and feel"):** a dedicated Opus subagent always carries G342 near tier → G343/G344 hero round 4 (above Driftwood/Nalati/Pine, 1x lens, square + landscape) → the pick ships via G341.

**Live:** `957b05e6-mv5vop4l`; **origin `c67a6fff9` (00:23Z, +80 commits, gate green)**, release unpinned (`0b40f6939`); Signal-load P0 caught pre-ship (`54603cb17`); Linux ring-mean.bin red → sp-x6. Reds: `red-green.md`.

**Paused:** frame floor (desktop Pine p95 33.4; Simulator Driftwood 59, Pine 58,
Sky 37, Nalati 36; fixes `38ea143c5`, `512bb3d16`, `dc4dfb106` unproven; task clock `99b0866c0`), SF22 assembled routes, SF57 re-entry, SF67.

**G342 near tier:** behind Debug Look ▸ Neighbour detail (A default). **Round 3 for your board: `art/near-tier/round-3/` (`f8803fd16`)**: four road views (Driftwood, Pine, Nalati, template) + hero, A/B, iPhone + desktop; dense near ground (own L1/L0 resample, splat, normals; ≤ 8.5 MB/cell, `7d6b3c0b4`); B now owns its cell (`05ca8c4ae`); G348: shard-declared placeholder data + SDK bakers + `wildshard build` placeholders for any terrain shardfile (`c21f24156`, `677bd1cf1`); grid prefers a shardfile's own `near` row (`8e2ac510c`); placeholder rows no longer break hybrid play (`7aa781064`); proof `progress/shard-platform/g348-near-row/`. First-party products still build `--no-placeholders` (safe to flip; held for Jake's near board). **Hero round 4 board, RE-SHOT ENTERED: `art/main-menu-hero/round-4/board.jpg` (`eb43b9f4c`), recommend SQ-DW-a + LS-DW-c** (above Driftwood, its runtime entered; entered-cell horizon bug fixed `d9a4a5a6d`/`d9505eb48`, proof `entered-fix-before-after.jpg`). Not wired; SQ-c/LS-c ship until Jake picks.

**For wildshard-v:** G344 interim hero SHIPPED in code `9422ff1d1`: SQ-c square band on portrait (full width), LS-c full-bleed on landscape (next release). Nine graph rollout needs one physical-iPhone reading (`graphMaterials`).

**Coordinator call:** bosses exempt from the phone 150 m animal shrink (Roc could vanish mid-fight; sp-o39).

**Jake open picks:** `docs/reviews/shard-platform-open-picks.md`.
