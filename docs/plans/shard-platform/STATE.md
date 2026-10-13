# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 04:45Z. G345 sprint: Signal + Sky to 80/20 by ~09:30Z.** Review picks G349–G352: queue Part D.

| Shard (per-export G294) | 21:40Z → 04:30Z | Target | Tiles / private bins |
|---|---|---|---|
| Signal Dunes | 70.7 % → **47.9 %** | ≤ 824 lines | **80 / 0** ✔ |
| Sky Reach | 78.4 % → **54.4 %** | ≤ 1355 lines | 0 (island tiles: sp-o65) / **0** ✔ |

**Signal meets Jake's port bar (tiles + 0 private binaries)**; Sky has 0 private binaries, tiles pending. Physics from authored rows (G350, `e6f5078d8`, `3ed995b80`), navigation as format rows (`c9f6e59be`); content-gate issue left: "trusted runtime owns simulation". Game exports 104 (from 328); `plugin/` 20 → 14.
**CI red since 02:01Z, prod stale (`957b05e6`): sp-x7 fixes first** (Jake `9699623e2`). Push: debt shrink-only at commit; generated files + native/maps made at commit (`9c57a9808`), never at push; local gate ≤ 2 min; pre-commit warm ~10 s, cold 15 s open (sp-x5). Never stop the line.

**Fleet (4 Opus + 3 Codex):** Codex sp-x7 CI/push, sp-x6 navigation, sp-x5 bench-max. Opus sp-o65 Sky island tiles, sp-o75 looks (all 9 shards now have near views, `17279180a`), sp-o76 G350 Nine/Driftwood, sp-o79 lash/tassel bakes + Sky one-shard exports. Weapons → shared rows: no honest two-user cut (sp-o78; design §4.5 keeps lash and cone as trusted one-user families).

**For wildshard-v, Jake ask (S2 blocked, sp-o77):** SF59 graphs can't keep the fire look today: always fogged and alpha-only (fire needs fog off, additive/premultiplied, depthWrite off, depth bias, point embers, view billboards); graphs only compile from shardfile `look.materials`; and **Graph materials is default-off pending a physical-iPhone reading**, so the GLSL stays as fallback (no cut). Recommend: approve an **SF59 effect-state row** (users Signal fire + Sky wind) and accept the Simulator + desktop frame-floor reading (or one normal playtest with Debug ▸ Graph materials on) to default it on.

**Hero NE-b SHIPPED** (`bcaa12ff3`, G383); sp-o75 re-shoots NE-b with all nine near (`art/main-menu-hero/round-6b/`). Signal ground switch parked (`5449941c9`).

**Calls for Jake (2026-10-13; reverse any):**
1. Bosses never shrink on phone (`30dc4c9ae`).
2. Missing Sky models stand undrawn, no stand-ins (`d5267c284`).
3. Metric per-export (`ddf5c4dea`).
4. New SDK export `./bake` (`6d2161e6f`).
5. Plugin folds into existing modules (SDK callers block internalising).
6. `terrain.bin` → session-installed ground loader; glows drape on generated old heights (`5cfc5674b`).
7. Sky tiles = island prop tiles its runtime draws, no fake tiles (`28439b8ee`).
8. Commons 0 packs; plan desk: SF26/DS1.6 done-when → "first two-real-shard pack (G355)".
9. Physics rows no recipe can compute are authored literally (`data/physicsRows.json`, G350).
10. Signal navmesh kept byte-identical (739 polys) from the recipe's old height lattice, not rebaked.

Paused: frame floor, SF22, SF57, SF67.
