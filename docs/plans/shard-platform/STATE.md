# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI 0 → (3) grid / frame floor → extras.

**(1) LIVE 0b1ca136e9 (01:31Z), ~5 h behind main; hourly newest-CI-green + six exact legs (sp-x7, G705). Overnight
release reds all fixed forward (render e80c55ee25+e9e5c444eb, culprit ccc4402e4e; Nine eeaba38309; Sunscar e3cf01d738;
sharp 525d33a1b4; title e6648e888f; required-entry starvation 1138f0564c). 0ce626a8f5 passed CI + all six legs, but both
releases failed the native atlas build: fixed ab8f12c943 (sp-x6). 653f0abe85 (has ab8) passed CI + six legs;
release 40172820573 dispatched ~07:30Z. G723.2b edge stall contained 653f0abe85 (warm-ahead off in prod). CF2 screenshot flake open.

**(2) NALATI 0 done (27dd969127).** HOST-AUDIT (G679) parked until every mini plan finishes. Legacy waits (G606).

**(3) Frame floor: G717 verdict ae146afe1d (sp-x8): 48/48 latches after sp-x6's look fixes 60f2ba740c; quiet Sim 12/15.**
Quiet misses -> sp-x1: Nalati whole max 287 ms (unattributed), Pine whole p95 45, DW spawn 37. Looks fixed (ms): NM 300->150,
Signal 267->117, Nalati 300->200, Sky 233->183, Alien 217->50, Thin Ice 250->50. G717.3 two-world memory
open. Native 1,312 MB playing. Edge waits Nalati 12.0 / Nine 11.4 / DW 5.7 s: sp-x8 G723 warm-ahead
(cancel fix ff66c28901), <= 2 residents (kept + incoming) under a guard (loading <= 1.8 GB, 1.2 GB/shard, else retire first).
L18.1 8b74db3d22: DW 107 -> 84 MB (L18.2-4: sp-x2).

**Memory (G682: menu <= 148.5, Template <= 198.5 MiB):** f4465ac4ab menu 165, select 169, Template 317, Template2 305.
G713: close structurally: lazy-load code (Codex, sp-x9 after QW7) + lighter post RT chain (Opus variant sheet, Tue).

**For wildshard-v (G711):** effort-% follows once lanes split L/XL rows (<= 1 h slices). Rows: GR3 9, GR4 19, T3
293 / 1,039, T4 format 5.5 MB (< 2). DONE: G720 cb756b79df (cap b8cf2c73da; in cell 7.4 s), G721 22248f9b6a+49af17b6b6
(cap 0993a458aa), G719 dcd3379372 (caps a74b837aa0, art/grid/g719-world-map/; NM twice = G700/RP3), G722 191aee7b15
(board 95d25c95da), G724+G725 d8598ec213 (re-entry 17.7 ms, no panel/static, one world). L16 DONE on 0dd7ce4722: hero 0.48 s, painted to the title (was 1.43 s blank; culprit 9108429270); the
0.32 s black is iOS's launch zoom before the native splash, outside the page.
Hero retake 0dd7ce4722: art/main-menu-hero/round-5-retake/board.jpg; Nalati aerial terrain FIXED 0ce626a8f5 (board
art/main-menu-hero/round-6-nalati-terrain/); G630 still needs Nine far proxy + Sunscar glow (Opus). Now: sp-x9 G733 -> L17 -> U1; sp-x2 T4; sp-x6 NM RM1-RM3.
**Blocked on Jake:** LEGACY phone QA, memory budget call, road B pilot play, hero board. **On Opus:** G713 post RT sheet,
G685 look row, NM RM4+, U2 occupied parents, G630 Nine far + Sunscar glow, T3/T6 visual.

**Lanes:** Claude weekly 99 %: 0 Opus (G605); 5 Codex + sp-x7 (Codex weekly reset: 1 %).

**Rules:** G704 (<= ~20 files/move commit, one big move: T3). G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
