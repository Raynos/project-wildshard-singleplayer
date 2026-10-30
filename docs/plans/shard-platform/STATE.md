# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Legacy (G882 / G883 / G885 / G891):** legacy-final 91a9eef081; Sky + Signal 3be88b3081, Nalati b592b94008, Driftwood
019fa6d0c7. **G908: Pine + Nine untouched** (no prep) until Jake's word after his final QA, likely 10-30.

**LIVE 4b49fb0-mvvh0x0m (16:51 Cancun; run 41127873671 green, excludes NF10's slabs). Jake's 17:00 QA build was f7ee6c3.** In it: NT1 ring fix, NF4 kind 11, NF3 movers, NF2, EP9 culling, frame-cost 2db765940f, PF1 + PF2 batched Pine, EP8 crowd dye, QC2 / QC3. vs live 039d788 (sp-x6, Chromium 4x): Nine held 18-26 % less work, walk 17.8 -> 12.2 ms; Pine 7-19 % less, draws 155-204 -> 101-142; Pine still above its 12 / 16 ms bar; both still 3-4.6 ms above legacy. **wildshard-v: before/after table for Jake at qa-2026-10-30-mini-plan.md:22 (90dd8da938).**
**Open:** MF7 battery (phone), QB20 thermal (phone), CI2 / 3 / 5 / 6 / 7 / 9 / 10
remote acceptance, CI12 Nalati (x6, x8, kernels o3 / o4), CI14 pin waves. **QA recheck on HEAD (o5, 95196a14db + QB12 app switch b6b19d5095): every QB row passes, no regressions, QB16 too.** For Jake: MF13 'Refine dither' phone check (ready: Sim Nine dither-on longest loader frame 110 ms, was 2.25 s; 9165621261); QB17 zip video
tmp/sp-o3-mf15/qb17-zip-before-after.mp4.

**P0 16:50:** Nine can't enter on phone from 9c6a26f16d ('Missing world scene blob', suspect NF10 fa1c6212aa, x1 fixing); releases of SHAs with fa1c held until a Nine entry check passes.
**16:45 G960:** 5 Opus until 85 % Claude (77 % now): o1 NT5 / NT6, o2 PF3 / PF6, o3 NF16 + NF17 / PF10, o4 NF15, o5 EP7 -> EP6. Jake QAs Nine + Pine fps tomorrow.
**G958:** pixel-identical perf on Codex (exact capture: sp-x9's serial M3 A/A, all 10 poses exact); numbers in code bodies.
**Autonomous decisions (for Jake's review):**
- NF16 done at Nine's composite 3 -> 2 (85059ed4a7); engine display + SMAA post stay unfolded.
- EP9 kept as live (G941, board 6c23d7d7a6): its Nine P2 change restores a copy pre-EP9 wrongly culled; now matches legacy.
- EP7 Nine bar restated <= 43 programs (was 40): the last 3 are look changes on unrelated one-offs. Now 49.
- NF11 draws fixed by a resident-cell re-chunk (x1): Nine P1-P5 143-157 -> 109-116; 15/15/1/6 px z-fight order changes, closer to legacy, board 4152abcd85: B ships (G941). NF12 next.
- EP8 Nine crowd dye merge (o5, c95ce392e0, board 3eea4b0b67): B = A (only poses differ), so B ships (G941); crowd 24-26 -> 14 draws.
- PF4 -> EP7; PF8 no gain; PF3 cache skipped (one cascade, ~0.15 ms). PF1 + PF2 (batched default, board art/pine-hollow/pf1-graph-batches/): Pine spawn 165 -> 109 draws.
- NT7: old all-product checkTileBake ratchet stays + a Nine-only blocking baseline.

**Rules:** G704, G844, G848, G952, G958, G960; no reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
