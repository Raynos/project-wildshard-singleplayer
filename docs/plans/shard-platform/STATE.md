# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Job (G585):** keep lanes on the top open row, delete process rather than add it. Order (G589): Pine/DW grid-ready
pass + latch → crossing T1–T6 (G580/G581) → Nine → Nalati → the rest (G575/G576). Rows: lanes/ready-queue.md.

**Census:** G572 MET (G589; ruler at 6bf8c2a6e5: DW 0, Pine 0, no product failures); _template, ink-cel 0. Nalati
4,159 (charged 3,131), Nine 1,519 (405); open-plots 19 stays.

**Live:** 16a7101baa (14:02Z). CI reds fixed: template order 73c6b75110, ruler 1aa987d01a, port shares 6bf8c2a6e5.

**Crossing:** T2/T4/T5/T6 default-off (Developer 'Grid shader warm-up'). T1 warm neighbour default-off; quiet Sim ON
1,597/1,517 vs OFF 1,494/1,414 MB, blocked 0/0, p95 35/34 ms; warm Sky 3.8 s. Cold Pine ~17 s with budget; three
stage cuts failed the whole-wait gate (3-5 s noise even quiet). G579 (< 5 s) not met.

**Lanes (G590 full steam, 5 Opus + 4 Codex + sp-x7):** sp-o1 + sp-o5 O28 Nine graphical; sp-o3 O27 Nalati graphical;
sp-o2 warm neighbour + budget default-on, Debug row deleted; sp-o4 Pine frame-gate (999.9 ms); sp-x1 DW grid-ready
(harness route fix) + Pine re-latch; sp-x6 cold Pine; sp-x8 Nine non-graphical + flip; sp-x9 Nalati mounted book + cuts.

**Tooling:** push loop + watchdog in pane sp-tools. Commit: scripts/commit.sh (or --patch for shared files).

**Rules:** G492; never herdr wildshard-v; no net-0 moves or relabels (G571); G573; G561.

**For wildshard-v:**
(1) G589 pass (sp-x1, 0f9781148f): Pine memory passes (181.5 MB), oneFrameLooks FAILS (max frames 999.9/266.6/
116.8 ms). DW not latched: harness bug, gridFloorPlans returns outward+return but the driver takes plans[0].
(2) Ruler: 1aa987d01a stops counting runtime/productSections.generated.d.ts as authored. Re-run on 1aa987d01a+
before committing a refresh (95b658af85 wrote empty port shares; 6bf8c2a6e5 restored them). Open: a check-slot
out/ had Nalati/Nine runtime.entry with files [] ('missing output runtime entry'); build mode or 173ec6a6ee, unconfirmed.
(3) RECOMMEND default-on after Jake's phone check: 'Grid shader warm-up' = budget (cold Sky 12.1 -> 5.5 s, Pine
30.0 -> 16.9 s) and T1 warm neighbour (+103 MB).
(4) Round-36 far variants for your board: fc3338f4fd, art/grid/round-36-far-variants/.
