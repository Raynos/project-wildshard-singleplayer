# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Legacy (G882 / G883 / G885 / G891):** legacy-final 91a9eef081; Sky + Signal 3be88b3081, Nalati b592b94008, Driftwood
019fa6d0c7. **G908: Pine + Nine untouched** (no prep) until Jake's word after his final QA, likely 10-30.

**LIVE f7ee6c3-mvve9g0q = Jake's 17:00 QA build (15:35 Cancun; run 41118506049, all 36 required jobs + SIX green, auto-shipped).** In it: NT1 ring fix, NF4 kind 11, NF3 movers, NF2, EP9 culling, frame-cost 2db765940f, PF1 + PF2 batched Pine, EP8 crowd dye, QC2 / QC3. vs live 039d788 (sp-x6, Chromium 4x): Nine held 18-26 % less work, walk 17.8 -> 12.2 ms; Pine 7-19 % less, draws 155-204 -> 101-142; Pine still above its 12 / 16 ms bar; both still 3-4.6 ms above legacy. **wildshard-v: before/after table for Jake at qa-2026-10-30-mini-plan.md:22 (90dd8da938).**
**Open:** MF7 battery (phone), QB20 thermal (phone), CI2 / 3 / 5 / 6 / 7 / 9 / 10
remote acceptance, CI12 Nalati (x6, x8, kernels o3 / o4), CI14 pin waves. **QA recheck on HEAD (o5, 95196a14db + QB12 app switch b6b19d5095): every QB row passes, no regressions, QB16 too.** For Jake: MF13 'Refine dither' phone check (ready: Sim Nine dither-on longest loader frame 110 ms, was 2.25 s; 9165621261); QB17 zip video
tmp/sp-o3-mf15/qb17-zip-before-after.mp4.

**QA 10-30 ([plan](qa-2026-10-30-mini-plan.md)):** QC2 / QC3 done; fps rows QC1 / QC4 via the Nine / Pine / engine-performance plans.
**16:10 G958 / G959:** pixel-identical perf on Codex (x6 PF9 wildlife, x8 PF8, x1 NT2 + NF10 at 16:45, x9 NT8 + early session badd39f875); Opus on NF15 (o4), NF17 (o3), EP7 (o5). Numbers in code commit bodies; plan marks one docs commit an hour.
**Autonomous decisions (for Jake's review):**
- G953-G956: x8 deletes 5 more rows + debug-flags lint fix (4cb6f34ccc).
- EP8 Nine crowd dye merge (o5, c95ce392e0, board 3eea4b0b67): B = A (only poses differ), so B ships (G941); crowd 24-26 -> 14 draws.
- PF4 -> EP7; PF8 parked; PF3 cache skipped (one cascade, ~0.15 ms). PF1 + PF2: Pine spawn 165 -> 109 draws.
- NF2 closed at 77; EP3 / NF22 not built (needs NF13's per-draw key).
- Channel compiler dropped: the only exact 2.7x win needs new Function, which lint forbids (no-new-func); the interpreter stays, no guard exception.
- NT7 (x8): the existing all-product checkTileBake ratchet stays; NT7 adds advisory tables + a Nine-only blocking baseline. wildshard-v: did G950 mean to replace the old cap?
- PF1 batched default 8a59427b63 (board art/pine-hollow/pf1-graph-batches/, G952 note: recommend B); Pine spawn 165 -> 121 draws.

**Rules:** G704, G844, G848, G951, G952; no reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
