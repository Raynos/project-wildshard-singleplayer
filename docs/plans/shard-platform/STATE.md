# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 07:45Z. G345 sprint: Signal + Sky to 80/20 by ~09:30Z.** Review picks G349–G352: queue Part D.

| Shard (per-export G294) | 21:40Z → 07:45Z | Target | Tiles / private bins |
|---|---|---|---|
| Signal Dunes | 70.7 % → **45.6 %** | ≤ 824 lines | **80 / 0** ✔ |
| Sky Reach | 78.4 % → **53.5 %** | ≤ 1355 lines | **11 / 0** ✔ (`fd1b0a9a4`) |

**Signal and Sky both meet Jake's port bar (tiles + 0 private binaries).** Physics from authored rows (G350, `e6f5078d8`, `3ed995b80`), navigation as format rows (`c9f6e59be`); content-gate issue left: "trusted runtime owns simulation". `plugin/` 20 → 14.
**LIVE `35e6c10ba-mv6a7k7z` (06:10Z)**: first release since 957b05e6; ships the NE-b hero (re-shot with all nine near), Signal fire A, navigation rows (both shards 0 private binaries), authored physics. Sky island tiles (`fd1b0a9a4`) go out in the next release.

**Fleet (G384): 4 Opus + 6 Codex.** Codex: sp-x7 pusher; sp-x5 bench-max; sp-x6 query-only terrain form; sp-x4 Pine port; sp-x1 Driftwood port; sp-x8 Nine port (Linux proof via sp-x7). Opus: sp-o90 cleanup, sp-o92 sound/desktop regression bisect, sp-o93 frame-floor milestone measure. Weapons / S1: no honest cut.

**For wildshard-v, Jake ask (G350 Nalati places):** its bake reaches 22k lines of engine code for 4.2 MB of geometry. **Port** to authored generators (big) or **freeze** the bins + rows as authored inputs (cheap, not regenerable). Recommend port later; the bridge stays meanwhile.

**For wildshard-v, Jake ask (S2):** sp-x6 is building an additive SF59 effect-state block (fog off, additive/premultiplied, depth bias, points, billboards; old graphs unchanged). Still Jake's: **Graph materials default-off pending a physical-iPhone reading**, so the GLSL stays as fallback (no cut). Recommend accepting the Simulator + desktop frame-floor reading (or one normal playtest with Debug ▸ Graph materials on).

**Hero NE-b SHIPPED, re-shot all-near** (`77529adfb`, G383). **For wildshard-v:** near round 6 boards `art/near-tier/round-6/` (A/B/C; ridges kept `2d4b6b8a0`); tile-built near views keep their tiles' materials (`7a3735a3c`). Signal ground: shared presentation client (`7e4ee3740`).

**Calls for Jake (2026-10-13; reverse any):**
6. `terrain.bin` → session-installed ground loader (`5cfc5674b`).
7. Sky tiles = island prop tiles its runtime draws, no fake tiles (`28439b8ee`).
8. Commons 0 packs; plan desk: SF26/DS1.6 done-when → "first two-real-shard pack (G355)".
9. Physics rows no recipe can compute are authored literally (`data/physicsRows.json`, G350).
10. Signal navmesh kept byte-identical (739 polys) from the recipe's old height lattice, not rebaked.
11. Terrain `form:'query'` (sampling only, 0 render tiles; collider derives from sampling; WSTR alias header+heights+splat, byte-exact) for Nalati (sp-x6).
12. Pine cabins: one Scene bake as a shape library; live owners unchanged (`5e4c9f9d5`).

Paused: frame floor, SF22, SF57, SF67.