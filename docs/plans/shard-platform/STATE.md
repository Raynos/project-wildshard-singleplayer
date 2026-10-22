# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Job (G585):** keep every lane on the top open row, answer lanes within minutes, delete process rather than add it.
Order: live reds + G578 → Driftwood/Pine zero (G570–G573, G571 rules, G572 done bar) → grid crossing T1–T6
(G580/G581) → Nine → Nalati → the rest (G575/G576 5x5 visuals). Rows: lanes/ready-queue.md.

**Census (10-22 ~06:00):** Driftwood, Pine, _template (966ffb3950), ink-cel (6cde05957a, attribution) all 0. Nalati
4,176 (charged 3,136), Nine 1,522 (405); X42 shared practice course f2990e3008 (-9/-13). open-plots 19 stays.

**Live:** e60250f4f2; c201ea5749 releasing (sp-x7). CI red 6cde..ab616 (nine-practice gen input) fixed 2be37809af.

**Crossing:** T2/T4/T5/T6 done default-off (Developer 'Grid shader warm-up'). T1 warm neighbour default-off;
with pre-emption (bed6aa9cdc), page scope (58fcd22019) and source retirement (b1bd53db8b) the quiet Sim pair reads ON
1,597/1,517 vs OFF 1,494/1,414 MB (load/play), blocked 0/0, p95 35/34 ms; warm Sky crossing 3.8 s. T3 retention
is a net loss (templates evicted), default-off. G579 (< 5 s) not met.

**Lanes:** Opus 0 until the Sun 12:00 reset (O27, O28, G576 wait). Codex: sp-x1 + sp-x6 crossing G579 (sp-x1
admission/prefetch, sp-x6 forest-page geometry); landing rule: 3 alternating cold pairs, HEAD vs HEAD+patch, budget ON,
whole-wait median gain > combined spread (stage-only wins drop). sp-x9 X45 elite binding; sp-x8 G585 dead-code sweep
(7 commits, net -196) then scripts/lint. Uncounted game code lands on a src net-negative diff (tests excluded).

**Tooling (G582/G585):** push loop + lane watchdog only, in herdr pane sp-tools (scripts/sp-tools.sh). main CI: one
running + newest pending. Commit: scripts/commit.sh "msg" -- <files>, or --patch <file> for shared files (D9).
HOST-BAR G571 lines: backticked engine/game/sdk/format paths ARE selectors. One coordinator docs commit an hour.

**Rules:** G492 no mid-task re-briefs; never herdr wildshard-v; no net-0 moves or relabels (G571);
G571 credit never erases a reviewed G520 chargeback without real change; legacy copies stay (G573); G561 holds.

**For wildshard-v:** (1) RECOMMEND default-on, after Jake's phone check, of 'Grid shader warm-up' = budget (sp-x6 cold
A/B at 886712c946: Sky wait 12.1 -> 5.5 s, Pine 30.0 -> 16.9 s) and T1 warm neighbour (+103 MB; warm Sky 3.8 s). (2) Round-36 far variants for your board: fc3338f4fd,
art/grid/round-36-far-variants/ (60 labelled JPEGs). Grey = shipped haze; haze off shows the 14 open plots
as bare ground (holograms not in the far proxy). 60 fps.
