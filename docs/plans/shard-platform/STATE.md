# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 02:20Z. G345 sprint: Signal + Sky to 80/20 by ~09:30Z.** Review picks G349–G352 in queue Part D.

| Shard (per-export G294, `ddf5c4dea`) | 21:40Z → 02:20Z | Target | Tiles / private bins |
|---|---|---|---|
| Signal Dunes | 70.7 % → **51.8 %** | ≤ 824 lines | 80 / 3 |
| Sky Reach | 78.4 % → **53.3 %** | ≤ 1355 lines | 0 / 2 |

**Game exports (G351):** 104 total (from 328); `plugin/` 20 → 17 (target 12–14, sp-x5).
**Ratchets (G349):** standing debt rule deleted, sweeper stopped; debt shrink-only. **Push (Jake `a44511f05`, `193a7e998`, audit `ef0eb5e04`), sp-x7:** debt refused per file at commit; local gate ≤ 2 min (changed-file typecheck/lint + affected tests), full suite/bakes in CI with fix-forward; **generated files regenerate at commit, never at push; the regen bot goes (`267504b5a`)**; no repeat retries; allowed graph counts report-only. Exact-number tests → limits.
**Next (Jake):** tiles + 0 private bins; SF81–SF85 open until runtime deleted; G350 exits.

**Fleet (Jake `267504b5a`): 4 Opus + 3 Codex**, winding down by not replacing. Codex: sp-x7 push, sp-x5 plugin trim, sp-x6 navigation row. Opus: Signal `terrain.bin` sp-o63, Sky brains + rigs sp-o64, Sky island tiles sp-o65, limit tests sp-o66 (sp-o62 finishing).
**Live:** `957b05e6`; release unpin `e6eeefc1e` (green on `de0130e95`) waits on the gate; origin `53d4b7aa0`.

**Calls for Jake (2026-10-13; reverse any):**
1. Bosses never shrink on phone (`30dc4c9ae`).
2. Signal road seam = drawn sand tint (`f54924aa3`).
4. Missing Sky models stand undrawn, no code stand-ins (`d5267c284`).
5. Metric per-export (`ddf5c4dea`).
8. Entryway proof credits Sky's lift proof to Nine (`add1035d6`).
11. Signal dusk proven by uniforms, not captures (`d9112c821`).
10. New SDK export `./bake` (`6d2161e6f`); Signal pieces stay GLBs.

13. Fan test snapshot re-accepted; game viewmodel 0 px diff (`5dc782337`).

14. Plugin trim folds effects/prompts/placeholder/loader into existing modules (SDK callers block full internalisation).

15. `terrain.bin` → session-installed engine ground loader (no debt rise). Navmesh blocked: no nav format row.

16. Rigs +2.3 MB (`38145d61d`); compression queued.

17. Sky tiles = island prop tiles its runtime draws (no fake tiles); dead local `terrain.bin` deleted (`28439b8ee`). Navigation format row for both shards' navmesh → sp-x6.

18. Commons: 0 packs (data into game, spear into the SF86 template). Plan desk: SF26/DS1.6 done-when → "first two-real-shard pack (G355)".

**Looks (Jake `90f70e28f`, `493f45cfd`):** hero NA-a SHIPPED (`8493cdba6`, cropped from round 4). Next Opus slot: near tier picks nearest cells incl. diagonals (Pine), re-shoot NA-a, near round 4 on Nalati's hills + cell edges (not shipped). Next visual slot after: **bench-max lane** (pre-commit ≤ 10 s, pre-push ≤ 2 min). Opus stays 4.

**Jake picks waiting:** 80/20 reach: **S1** quest state machines as AssemblyScript hooks / **S2** shaders as graph rows / **S3** accept ~25–30 % Signal, ~35 % Sky; recommend S1 + S3. Signal look A/B (`art/signal-look/round-1/`), recommend A. Near `art/near-tier/round-3/`; hero r4 `art/main-menu-hero/round-4/board.jpg` (recommend SQ-DW-a + LS-DW-c; LOOKS LINE, Jake: "I don't want to forget this main hero thing"). 

Paused: frame floor, SF22, SF57, SF67.
