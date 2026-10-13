# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 08:05Z. G345 sprint: Signal + Sky to 80/20 by ~09:30Z.** Review picks G349–G352: queue Part D.

| Shard (per-export G294) | 21:40Z → 07:45Z | Target | Tiles / private bins |
|---|---|---|---|
| Signal Dunes | 70.7 % → **45.6 %** | ≤ 824 lines | **80 / 0** ✔ |
| Sky Reach | 78.4 % → **53.5 %** | ≤ 1355 lines | **11 / 0** ✔ (`fd1b0a9a4`) |

**Signal and Sky both meet Jake's port bar (tiles + 0 private binaries).** Authored physics (G350), navigation rows; gate issue left: "trusted runtime owns simulation". `plugin/` 20 → 14. Nine: Linux proof exact (385/385), landing.
**LIVE `2f7cc5e25-mv6dko3t` (07:44Z)**: Sky island tiles, NE-b hero, fire A, nav rows, authored physics. Desktop frame floor at `fea49ae28` RED (worst 133–267 ms): sp-o93. CI `595a7bded` red: author-closure terrain keys (sp-x6).

**Fleet (G384): 4 Opus + 6 Codex.** Codex: sp-x7 pusher; sp-x5 bench-max; sp-x6 SF87 clean room; sp-x4 Pine; sp-x1 Driftwood; sp-x8 Nine. Opus: sp-o93 frame floor, sp-o95 Nalati query terrain, sp-o96 Sky world → baked, sp-o97 sound diffs.

**For wildshard-v, Jake ask (G350 Nalati places):** bake runs 22k engine lines for 4.2 MB. **Port** to authored generators (big) or **freeze** the bins + rows as authored inputs (cheap, not regenerable). Recommend port later; bridge stays.

**For wildshard-v, Jake ask (S2):** Graph materials stay default-off pending a physical-iPhone reading, so the GLSL stays as fallback (no cut). Recommend accepting the Simulator + desktop frame-floor reading (or one playtest with Debug ▸ Graph materials on).

**For wildshard-v:** near boards `art/near-tier/round-6/` (A/B/C). Hero NE-b shipped (`77529adfb`).

**Calls for Jake (2026-10-13; reverse any):**
6–7. Session ground loader; Sky tiles = island prop tiles.
8. Commons 0 packs; SF26/DS1.6 done-when → first two-shard pack (G355).
9. Physics rows no recipe computes are authored literally (G350).
10. Signal navmesh kept byte-identical (739 polys), not rebaked.
11. Terrain `form:'query'`: sampling only, 0 render tiles (`8be4e615d`); bake helper `269813a80`.
12. Pine cabins: one Scene bake as a shape library; live owners unchanged (`5e4c9f9d5`).
13. Optional `props.wholeLibrary` binds Nine's library GLBs, not 348 rebucketed subsets (`b43d310c2`).
14. Tile subsets may declare ≤ 1 m edge overhang (Pine creek bank 0.98 m); no vertex clamp.
15. Nine authoring uses portable math (Linux = Mac); collider delta ≤ 9e-16, look exact.
16. Driftwood boat hull equation shared by generator + live (`world/boatFrame.ts`), not a cut.
17. Debug rows 7 → 4; DEVSERVER-only grid cell row deleted without a pick.
18. Node bake host with a filesystem fetch reports online (bytes still verified).

Paused: SF22, SF57, SF67.
