# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Phase (G533):** 0 live green; 1 DONE: C8, C3, C7 locked at 0; 2 DW/Pine phase A free cuts; 3 C6 items + chargeback cuts; 4 DW/Pine phase B quest host; 5 DW phase C + Template 2 restyle; 6 Nalati/Nine toward 5 % + phase D; Opus lanes in parallel: M2 grid-readiness + 5x5 (SF88a-f); 7 Jake's mobile runs at M2 6/6; 8 wrap-up. M2 6/10 latched + 15/15 plots (21af61480b; GR3 target met: Template 1/2, Pastel, Ink, Signal, Sky); official ruler refresh at 21af running (sp-x1); G561 no readiness on 4 main shards till zero; LOADING PLAN DONE: Phase 1 + O2-O6 accepted (phone 19.5/20.4 s). M2 memory (native, KTX2 pin, of 1200 MB playing / 1800 loading): Sky 990, Signal 899, DW 845, Nine 1177, Pine 879/1023, Nalati 971/1090: ALL SIX PASS. G551 DW/Pine to zero first; phase B finish: Pine C5 748->75, DW C5 227->30; X5 ACCEPTED at e3a7990c5b (sp-x8: QA+QB, 823 tests, native replay byte-identical, both first frames, old saves): C5 Pine 586 -> 161, DW 227 -> 120; totals Pine ~801, DW 992 (sp-o5 Z9 24d00f9c66); G566 barrels 03f391aa59: DW C5 120 -> 142 (+22 DW-only installer); 5x5 (G526): SF88a-e, g done; SF88f M2 count + soak. G548 PASS (folded into BUILD-SPEED).

**Live:** f66a4309e (22:33Z): QA+QB, X5, G566, Pastel 0. Sim sweep 6f78ae7dc2: standalone + plots 60 fps (worst 53 ms); grid corner worst 191 ms (sp-o2); p95 36-51 ms Pine/Nine drive (G561).

**Tooling:** BUILD-SPEED; push loop LIVE (53e0880f4f green, 44 s). G567: goal 0 %; plan = 60 % M3 + 40 % M2: 78.6 % (M3 90.92 %, M2 6/10).

**Rules:** lanes/common.md; G569 watchdog nudges idle Opus + Codex lanes (48894c561c; delivery to Claude panes verified 16:38; restarts reset the 3 min clock; sp-x7 exempt 6f78ae7dc2); G551 rows above Z; G570 rows ZA-ZG; G571 every DW/Pine line to data/AS, one-user hosts OK (areas 23d821c360); G572: TRAMPLE_GLSL is LIVE (forestPage.ts:22 via Pine hybrid.ts:29), not legacy-only; its 30 stay charged; WASM-HOST: sp-x9 (H0b done, H1-H6), sp-o4 (H0, H9). G574: Opus = sp-o4, sp-o5, sp-o2; sp-o1/sp-o3 stop after their task.

**Lanes:** self-pull Z rows (ready-queue.md); G565 done.

**Zero:** Pastel Plain 732 -> 0 (sp-o1, 2ebb5ed64c). Template 1 1,001 -> 21, Blender 109 -> 0 (sp-x1, 0cb86c21f8), Ink -285, no shard TS left (sp-o3 dc81033ce0).

**For wildshard-v:** G579 audit input (sp-x1): the 14.6 s stall is afterPlay warm-up: warmEnteredFrame -> beforeWarm/postPreparation -> precompileLevel -> parked/offscreen first draws (regionalRuntime.ts ~350, Game.ts ~810), one program per frame; sp-x1's counts rank cuts. G573 applied: legacy copies stay (patches deleted, G0 dropped); G561 stays until each shard is done; H0 runs now on Mac/Chromium/Sim (sp-o4), never waits on Jake's phone; memory trim becomes a data row (sp-x1); generators and .d.json.ts stubs are not custom runtime TS. G566 AS body ops landed (61473f3bb1). G550 hero: art/grid/round-35-hero-retake/ (5a410d548f); holo fade: sp-o2 captures A-E (850/1200/1600/2200 m/none) into art/grid/round-36-holo-fade/.

