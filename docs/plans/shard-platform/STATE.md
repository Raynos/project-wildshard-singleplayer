# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI 0 → (3) grid / frame floor → extras.

**(1) LIVE 0b1ca136e9 (01:31Z), > 2 h behind main; hourly newest-CI-green + six exact legs (sp-x7, G705). All release
reds fixed forward (render e80c55ee25+e9e5c444eb, culprit ccc4402e4e; Nine eeaba38309; Sunscar e3cf01d738/52c30d3c59;
sharp 525d33a1b4; title e6648e888f). dc9ad379e9 CI full green, but its six legs FAIL boot-grid 'Signal road entry' (no 1138f0564c
starvation fix in it): sp-x2 verifies 1138 fixes it by 06:08Z; next smoke 40166109698.

**(2) NALATI 0 done (27dd969127).** HOST-AUDIT (G679) parked until every mini plan finishes. Legacy waits (G606).

**(3) Frame floor (G717 remeasure, sp-x8; all 48 latches were removed, G687's 13/15 no longer stands):** Chromium phone
cohort done: 33 of 48 latches re-earned (19 memory + 14 look passes). Unlatched: Blender/Ember/Night Market/Pastel/Signal
(starvation fixed 1138f0564c, entries PASS; re-latch pending). Worst Chromium frames: Nalati 300, Pine 267, Thin Ice 250 ms.
Edge waits Nalati 12.0 / Nine 11.4 / DW 5.7 s (G723 cuts next). Quiet Sim floor on 1138: 12/15 PASS; misses
Nalati whole p95 35 / max 287 ms, Pine whole 45/123, DW spawn 37/74. Native: 1,312 MB playing, 1,358 loading; one
resident world only (two-world state not reproduced).
L18.1 8b74db3d22: DW 107 -> 84 MB, Pine 112 -> 93 MB.

**Memory (G682 budgets: menu <= 148.5, Template <= 198.5 MiB):** f4465ac4ab menu 165 (+16), select 169 (+21), Template 317
(+119), Template2 305 (+106). Template: JS 108, page 114, GPU render targets 40.4 (look call), textures 52.
G713: close structurally: lazy-load code (Codex, sp-x9 after QW7) + lighter post RT chain (Opus variant sheet, Tue).

**For wildshard-v (G711):** effort-% follows once lanes split L/XL rows (<= 1 h slices). Rows: GR3 9, GR4 19, T3
293 / 1,039, T4 format 5.5 MB (< 2). DONE: G720 cb756b79df (cap b8cf2c73da; in cell 7.4 s), G721 22248f9b6a+49af17b6b6
(cap 0993a458aa), G719 dcd3379372 (caps a74b837aa0, art/grid/g719-world-map/; NM twice = G700/RP3), G722 191aee7b15
(board 95d25c95da), G724+G725 d8598ec213 (re-entry 17.7 ms, no panel/static, one world). L16 DONE on 0dd7ce4722: hero 0.48 s, painted to the title (was 1.43 s blank; culprit 9108429270); the
0.32 s black is iOS's launch zoom before the native splash, outside the page.
Hero retake 0dd7ce4722: art/main-menu-hero/round-5-retake/board.jpg; G630 still blocked (Nine far proxy, Sunscar glow,
Nalati aerial terrain gaps). Now: sp-x9 G733 -> L17 -> U1; sp-x2 G630 Nalati aerial audit; sp-x6 NM RM1-RM3.
**Blocked on Jake:** LEGACY phone QA, memory budget call, road B pilot play, hero board. **On Opus:** G713 post RT sheet,
G685 look row, NM RM4+, U2 occupied parents, G630 Nine far + Sunscar glow, T3/T6 visual.

**Lanes:** Claude weekly 99 %: 0 Opus (G605); 5 Codex + sp-x7 on credits (Codex resets ~07:00Z).

**Rules:** G704 (<= ~20 files/move commit, one big move: T3). G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
