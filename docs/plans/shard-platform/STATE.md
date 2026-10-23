# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading (U, L9-L15),
TOOLING-PERF (G668/G670/G671), Night Market wow (NM7-NM11), tile streaming, no-binaries.

**(1) LIVE ff45b6a24d (~5 h behind).** OPEN: HEAD won't build: Nalati's shardfile is 100,583 of json.ts's 100,000-node
budget (3d1de4c40d raw colliders + N1b tiles). No cap change: sp-x9's CSE 3498b2d821 (-192) landed; sp-o1 moves the
16 L1 tile rows into a named bundle-root blob packed as 4 quad GLBs (~-500). The grid-hang fix 9ee919dc14 waits for a
buildable HEAD and an exact grid smoke leg before release. Fixed since 16:00: grid hang cause 8a97034b97, NM bounds +
entry footprint (07b38cc8d4, ccd7eddc5c), K4 gen closure (0881f637ef), tile-guard sweep (dce09cf54f), docs command
(cf27a3f9a7), DR16 test (21a07284bc). No reverts (G674).

**(2) Nalati.** Titan + G667 listed, weather ported. Left: the entry (R15c/R15d) plus pick 1 below.

**(3) Grid / frame floor.** 5x5 everywhere, T6, T11, T8 bake check (805c19a26b, 606 debt metrics shrink-only).
Ring prelink e5a834d4ba and draw-wrapper cuts (d1c54e304d, fa08d819fb) await a green HEAD build to measure.
DW walk 0.78 m: stale 10-07 expectations, not a regression. Update pill 9.5 s → 1.56 s (Sim); L9-L11 Sim timing pending.

**Done today:** G672 settings burn-down DR1-DR19. Guardrails: SW7, staged-import guard (fedbba4eb5), H1 pre-commit
1.0-2.3 s, G2/G3/G4/G5/G9/G1 gen, C4/C5/C6/P1/P3/V1/V3/H3/H4/K4/L4, S3 24 of 31 repeat-reds green. NM7 light + NM8
water/paving + NM9 density + geometry trim (f7c6f3a79f).

**For wildshard-v (Jake picks needed):**
1. Nalati's remaining one-user code (stealth controller + rows, riding world-frame loans, elite/titan/night frame
   adapters, signal → HUD effect adapter ~25): (a) HOST-AUDIT like G667 (recommended), (b) second shard, (c) charged.
2. Signal Dunes quest-end deep dusk unchanged since 10-10 (key light 5 %): keep or lighten?
   art/grid/round-54-explorer-dark/board-explorer-fix.jpg.
3. Push gate: SW8 (gate median 109 s → ~1.3-5.5 s; tests/lint/types stay in CI) vs P4. Recommended SW8.
4. Machine: swap near full. Idle non-lane Claude sessions since 10-20/10-22 (pids 5785, 8113, 9033, 94906, 95877, 8537).

**Lanes:** Claude weekly 69 %; at 70 % sp-o1 stops after it lands the Nalati unblock (2 Opus: sp-o3, sp-o4).

**Rules:** G605. G620 fix forward in 30 min, NO reverts (G674). No new Debug rows (G669). Guardrails G670. No one-user
credit without a case pick (G571/G667); never herdr wildshard-v.
