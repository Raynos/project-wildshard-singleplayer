# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Legacy (G882 / G883 / G885 / G891):** legacy-final 91a9eef081; Sky + Signal 3be88b3081, Nalati b592b94008, Driftwood
019fa6d0c7. **G908: Pine + Nine untouched** (no prep) until Jake's word after his final QA, likely 10-30.

**LIVE 8832a4d-mvv4kw6d (10:27 Cancun; fully green CI 41079261879, auto-shipped). Jake's 07:00 QA build was fe0ca11.** Story margins: Pine memo c510d3e794 + d91517c445, DW pose CSE 420440d2e9, Nalati pipelined replay 04615724cd.
**Open:** MF7 battery (phone), QB20 thermal (phone), CI2 / 3 / 5 / 6 / 7 / 9 / 10
remote acceptance, CI12 Nalati (x6, x8, kernels o3 / o4), CI14 pin waves. **QA recheck on HEAD (o5, 95196a14db + QB12 app switch b6b19d5095): every QB row passes, no regressions, QB16 too.** For Jake: MF13 'Refine dither' phone check (ready: Sim Nine dither-on longest loader frame 110 ms, was 2.25 s; 9165621261); QB17 zip video
tmp/sp-o3-mf15/qb17-zip-before-after.mp4.

**11:50 QA 10-30 (G932, [plan](qa-2026-10-30-mini-plan.md)):** QC2 / QC3 done; fps rows top (G933, legacy waits): QC1 Nine o5, QC4 Pine o3 when wildshard-v's boards land; x9 bisects Nine fps. Picks G928-G931 built (899682f866, 82a3076267); MF20 done; MF21 done 039d78823e: cold 79.6 -> 56.8 s; wildshard-v: the daily run's warm reading needs a >= 30 s play (4 s dwell reads 41.5 s before the install finishes). Codex lanes restarted on Jake's ask. 12:24 (wildshard-v): NF1 done; x1 NF6, x8 NF9, x9 NF20; x6 CI acceptance reads, x2 CI10. Nalati grass upload stays Opus (o3, G848: render code); Nine bisect not needed (board named the causes). Nine: NF4 kind 11, NF6, NF9, NF20 done; NF1 open (uploads after reveal 198 -> 124, bar 0; max frame 83 ms ok; Sim Explorer native peak 0.84 GB but Inspector categories 1.86 GB: which meter the 1.2 GB cap uses needs settling).
**13:10 QA build for Jake ~17:00 (aim 16:30, live by 16:45):** NT1 ring fix (o5 next), PF1 instanced default, EP9 landed e43772077d (pan = still on Nine / Pine / DW), frame-cost 2db765940f. **13:40 G943 [engine-performance](engine-performance-mini-plan.md) EP1-EP12 all start (supersedes G940):** o5 NF4 audit -> NF13 -> NF14 -> NF15 -> NF3 / NF8; o3 frame cost -> PF1 -> EP6 design; x1 EP1 -> NF10 bake, x2 EP2, x6 EP9, x8 EP10, x9 PF5. FOUNDATIONS archived (31ab084bce). 2 Opus (G853, Claude 69 %).
**Autonomous decisions (for Jake's review):**
- PF1 (o3, f80d6d5271): batched Pine trees 165 -> 119 draws, 6.0 -> 4.1 ms, but mid-distance trees draw lighter than legacy, so ceac2630cb keeps INSTANCED default for the 16:30 QA build (against G936) until batched matches legacy or a board decides (G941).

**Rules:** G704, G807, G828, G844, G848, G853, G858; no reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
