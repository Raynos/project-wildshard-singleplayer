# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Job (G585):** keep every lane on the top open row, answer lanes within minutes, delete process rather than add it.
Order: live reds + G578 → Driftwood/Pine zero (G570–G573, G571 rules, G572 done bar) → grid crossing T1–T6
(G580/G581) → Nine → Nalati → the rest (G575/G576 5x5 visuals). Rows: lanes/ready-queue.md.

**Census (10-22 ~07:00):** Driftwood, Pine, _template, ink-cel 0. Nalati 4,159 (charged 3,131), Nine 1,519 (405);
open-plots 19 stays. Tonight: X42 shared course f2990e3008, X45 elite binding 0e6f6067d9, dead-code sweeps (sp-x8 src +
scripts net -2,480 in 16 families; sp-x9 shard folders -15 counted).

**Live:** c201ea5749; 1e24b843b9 releasing (sp-x7). Template cold-order red fixed 73c6b75110.

**Crossing:** T2/T4/T5/T6 done default-off (Developer 'Grid shader warm-up'). T1 warm neighbour default-off;
with pre-emption (bed6aa9cdc), page scope (58fcd22019) and source retirement (b1bd53db8b) the quiet Sim pair reads ON
1,597/1,517 vs OFF 1,494/1,414 MB (load/play), blocked 0/0, p95 35/34 ms; warm Sky crossing 3.8 s. T3 retention
is a net loss (templates evicted), default-off. G579 (< 5 s) not met.

**Lanes:** Claude AND Codex at 95 % of the week (resets Sun 12:00 / Tue 27th ~01:30). All lanes stopped clean
except sp-x7 (release) and sp-x1's last quiet prefetch pair; watchdog nudges nobody (a1aacfeeeb). Open when quota
returns: O27, O28, G576 (Opus); crossing G579 (cold Pine ~17 s with budget; three stage cuts failed the whole-wait gate:
noise 3-5 s even quiet), Nalati full flip (needs O27 + mounted book), Nine envelope 29.

**Tooling (G582/G585):** push loop + lane watchdog only, in herdr pane sp-tools (scripts/sp-tools.sh). main CI: one
running + newest pending. Commit: scripts/commit.sh "msg" -- <files>, or --patch <file> for shared files (D9).
HOST-BAR G571 lines: backticked engine/game/sdk/format paths ARE selectors. One coordinator docs commit an hour.

**Rules:** G492 no mid-task re-briefs; never herdr wildshard-v; no net-0 moves or relabels (G571);
G571 credit never erases a reviewed G520 chargeback without real change; legacy copies stay (G573); G561 holds.

**For wildshard-v:** (00) Ruler blocker 'output omits authored runtime files' (DW/Pine) FIXED in 1aa987d01a: no runtime file
was dropped; the ruler counted the gitignored runtime/productSections.generated.d.ts (bake-section-schemas) as authored.
On the check slot's built out/, Nalati/Nine read 'missing output runtime entry' with HEAD's reader too (likely a stale
out/; rebuild before measuring). Nine 9.9 MB custom sections noted, report-only. (0) ZB/ZC/ZD done (DW/Pine 0/0/0); WASM H0b-H6 landed earlier. (1) RECOMMEND default-on, after Jake's phone check, of 'Grid shader warm-up' = budget (sp-x6 cold
A/B at 886712c946: Sky wait 12.1 -> 5.5 s, Pine 30.0 -> 16.9 s) and T1 warm neighbour (+103 MB; warm Sky 3.8 s). (2) Round-36 far variants for your board: fc3338f4fd,
art/grid/round-36-far-variants/ (60 labelled JPEGs). Grey = shipped haze; haze off shows the 14 open plots
as bare ground (holograms not in the far proxy). 60 fps.
