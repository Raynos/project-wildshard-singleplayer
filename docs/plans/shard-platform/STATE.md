# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Job (G585):** keep lanes on the top open row, delete process rather than add it. Order (G589): Pine/DW grid-ready
pass + latch → crossing T1–T6 (G580/G581) → Nine → Nalati → the rest (G575/G576). Rows: lanes/ready-queue.md.

**Census:** G572 MET (G589; ruler at 6bf8c2a6e5: DW 0, Pine 0, no product failures); _template, ink-cel 0. Nalati
4,159 (charged 3,131), Nine 1,519 (405); open-plots 19 stays.

**Live:** 16a7101baa (14:02Z). CI reds fixed: template order 73c6b75110, ruler 1aa987d01a, port shares 6bf8c2a6e5.

**Crossing:** T2/T4/T5/T6 default-off (Developer 'Grid shader warm-up'). T1 warm neighbour default-off; quiet Sim ON
1,597/1,517 vs OFF 1,494/1,414 MB, blocked 0/0, p95 35/34 ms; warm Sky 3.8 s. Cold Pine ~17 s with budget; three
stage cuts failed the whole-wait gate (3-5 s noise even quiet). G579 (< 5 s) not met.

**G597 STOP-RULE (Jake 10:25):** Jake picks WASM vs host per Nine/Nalati/C1/C5/C6 item; no new host, reshape or
HOST-BAR listing lands before his pick; data/AS/generator/bake/dead-code rows continue.

**Lanes (G596 zero first; G590 full steam):** Nine: sp-o1 (D1b spill/bounds, then NA), sp-o5 (view-lane
uniforms/camera/specimen), sp-x8 ND flip. Nalati: sp-o3 O27/N1b/N5c, sp-o2 LG after crossing default-on, sp-x9 C6
(N6a/N6b/LF), sp-x1 C5 (N5a/N5b) after the Pine/DW grid-ready latch, sp-x6 N1e then LB. sp-o4 E2 (GLSL memory first).
N1a open for the next free Opus. HOST-AUDIT (later): G594 ruler/host items; sp-x8: 74ffcac600 posed loader is a real
second user, 96b965a60f overbroad (Pine figure/socket vs DW kit-figure are different branches).

**Tooling:** push loop + watchdog in pane sp-tools. Commit: scripts/commit.sh (or --patch for shared files).

**Rules:** G492; never herdr wildshard-v; no net-0 moves or relabels (G571); G573; G561.

**For wildshard-v:**
(1) E2 (sp-o4 06673968b0): Nine graph composite renderer +22..31 MB, GPU +22..25 MB, heap flat, 60 fps both, sections
+57.6 KB, so Nine's section ceiling rises ~60 KB in the port commit (G438). Nalati's 117 lines first. Veto -> revert.
(2) Grid-ready memory latched for Pine 181.5 MB and DW 300.9 MB (495bc1d918); looks miss 200 ms: Pine 316.7 ms
(activation: uploads ~130, composition ~80, clip ~41, hooks ~34), DW 250.1 ms. Readiness after Nine/Nalati.
(3) Host picks for Jake (G597): game/riding/seatedFigure (sp-o3 487c74c60c, self-scored 2-6 Y); fd674f4d4b
timedEncounters (nightView moved, your flagged pattern); sp-x6's N1e terrain-channel host (unlanded, +51).
(4) G587 part 1 already live (745567649a, checked fresh). Ruler: 1aa987d01a; 6bf8c2a6e5 restored port shares.
(5) RECOMMEND default-on after Jake's phone check: budget warm-up (cold Sky 12.1 -> 5.5 s) and T1 (+103 MB); sp-o2
is landing it per G590.
