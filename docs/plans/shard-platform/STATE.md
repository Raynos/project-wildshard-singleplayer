# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 04:45Z. G345 sprint: Signal + Sky to 80/20 by ~09:30Z.** Review picks G349–G352: queue Part D.

| Shard (per-export G294) | 21:40Z → 04:30Z | Target | Tiles / private bins |
|---|---|---|---|
| Signal Dunes | 70.7 % → **47.9 %** | ≤ 824 lines | **80 / 0** ✔ |
| Sky Reach | 78.4 % → **54.0 %** | ≤ 1355 lines | **11 / 0** ✔ (`fd1b0a9a4`) |

**Signal and Sky both meet Jake's port bar (tiles + 0 private binaries).** Physics from authored rows (G350, `e6f5078d8`, `3ed995b80`), navigation as format rows (`c9f6e59be`); content-gate issue left: "trusted runtime owns simulation". `plugin/` 20 → 14.
**BOTH PROOFS GREEN on `b7656034b`** (CI 38350364280 + exact boot smoke 38351115302, road→Signal incl.); release deferred for newer CI-green `13cb4d105` (smoke pending); prod still `957b05e6`. Push: debt shrink-only at commit; generated files + native/maps made at commit (`9c57a9808`), never at push; local gate ≤ 2 min; pre-commit warm ~10 s, cold 15 s open (sp-x5). Never stop the line.

**Fleet (Jake G384): 4 Opus + 6 Codex.** Codex: sp-x7 pusher (push, CI, deploys); sp-x5 bench-max; sp-x6 SF59 effect-state groundwork (S2); sp-x4 Pine port via `bake(scene)` → tiles; sp-x1 Driftwood port; sp-x8 Nine port. Opus: sp-o81 looks, sp-o82 G350 tail (King, Nalati), sp-o83 Sky island tiles + sweep. Weapons: no honest cut (sp-o78).

**For wildshard-v, Jake ask (G350 Nalati places):** its bake reaches 22k lines of engine code for 4.2 MB of geometry. **Port** to authored generators (big) or **freeze** the bins + rows as authored inputs (cheap, not regenerable). Recommend port later; the bridge stays meanwhile.

**For wildshard-v, Jake ask (S2):** sp-x6 is building an additive SF59 effect-state block (fog off, additive/premultiplied, depth bias, points, billboards; old graphs unchanged). Still Jake's: **Graph materials default-off pending a physical-iPhone reading**, so the GLSL stays as fallback (no cut). Recommend accepting the Simulator + desktop frame-floor reading (or one normal playtest with Debug ▸ Graph materials on).

**Hero NE-b SHIPPED, re-shot with all nine near** (`77529adfb`, G383; call: shipped the re-shoot Jake asked for). **For wildshard-v:** near round 5 boards `art/near-tier/round-5/` (A/B/C, 4 road views). Signal ground switch parked.

**Calls for Jake (2026-10-13; reverse any):**
1. Bosses never shrink on phone (`30dc4c9ae`).
6. `terrain.bin` → session-installed ground loader (`5cfc5674b`).
7. Sky tiles = island prop tiles its runtime draws, no fake tiles (`28439b8ee`).
8. Commons 0 packs; plan desk: SF26/DS1.6 done-when → "first two-real-shard pack (G355)".
9. Physics rows no recipe can compute are authored literally (`data/physicsRows.json`, G350).
10. Signal navmesh kept byte-identical (739 polys) from the recipe's old height lattice, not rebaked.

Paused: frame floor, SF22, SF57, SF67.