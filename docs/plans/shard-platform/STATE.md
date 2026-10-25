# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI 0 → (3) grid / frame floor → extras.

**(1) LIVE f4b17bcb5a (15:27Z); ba3a6f08bf (grid cache-write fix 73b894e5c9) releasing 16:10Z. Hourly releases (sp-x7,
G705). CF2 title-capture stall: Chromium title tracing 59f9c74145 awaits the next CI occurrence; programShare warning
on the Nine title with sp-x9. No open CI red.

**(2) NALATI 0 done (27dd969127).** HOST-AUDIT (G679) parked until every mini plan finishes. Legacy waits (G606).

**(3) Frame floor: G717 verdict ae146afe1d (sp-x8): 48/48 latches after sp-x6's look fixes 60f2ba740c; quiet Sim 13/15 on a4b6.**
Quiet misses -> sp-x1: DW spawn p95 42 / max 49, Pine whole 44/90 (Nalati whole now PASS 34/128). Looks fixed (ms): NM 300->150,
Signal 267->117, Nalati 300->200, Sky 233->183, Alien 217->50, Thin Ice 250->50. G717.3 two-world memory
PASS on 9dc10c2d58: DW + Nalati 1.056 GB upper envelope (< 1.8 GB). Native 1,312 MB playing. Edges on 903cc6901d: Nalati 11.6 / Nine 8.7 / DW 8.1 / Pine 2.6 s (< 5 s open; world + afterPlay dominate): sp-x8 G723 warm-ahead
(cancel fix ff66c28901), <= 2 residents (kept + incoming) under a guard (loading <= 1.8 GB, 1.2 GB/shard, else retire first).
L18: DW declared 107 -> 78.3 MB (8b74db3d22, 8515b8049f, 37709250b2); brotli on; rest is lighter assets (Opus).

**Memory (G682: menu <= 148.5, Template <= 198.5 MiB):** f4465ac4ab menu 165, select 169, Template 317, Template2 305.
G713: close structurally: lazy-load code (js-payload J1-J10, sp-x2) + lighter post RT chain (Opus variant sheet, Tue).

**For wildshard-v (G711):** Rows: GR3 9, GR4 19, T3 293 / 1,039, T4 format 5.5 MB (< 2). DONE: G720 cb756b79df (cap b8cf2c73da; in cell 7.4 s), G721 22248f9b6a+49af17b6b6
(cap 0993a458aa), G719 dcd3379372 (caps a74b837aa0; NM twice = G700/RP3), G722 191aee7b15
(board 95d25c95da), G724+G725 d8598ec213 (re-entry 17.7 ms, no panel/static, one world). L16 0dd7ce4722: hero
0.48 s (was 1.43 s blank); the 0.32 s black is iOS's launch zoom, outside the page.
Hero retake 0dd7ce4722: art/main-menu-hero/round-5-retake/board.jpg; Nalati aerial terrain FIXED 0ce626a8f5 (board
art/main-menu-hero/round-6-nalati-terrain/); G630 still needs Nine far proxy + Sunscar glow (Opus). Now: sp-x9 G733 -> L17; sp-x2 J5 then tile T4 (G730: J6-J10 after extras); sp-x8 TS T3; sp-x6 NM RM2; sp-x1 G717 quiet misses.
**Blocked on Jake:** LEGACY phone QA, road B pilot play, hero board. **On Opus:** G713 post RT sheet,
G685 look row, NM RM4+, U2 occupied parents, L18.3 lighter DW assets, G630 Nine far + Sunscar glow, T3/T6 visual.

**Lanes:** Claude weekly 100 %: 0 Opus until Tue 13:00 (G605); standing queues sent (SW10), lanes run their plans without
the coordinator; 5 Codex + sp-x7 (Codex weekly 17 %).

**Rules:** G704 (<= ~20 files/move commit, one big move: T3). G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
