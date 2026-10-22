# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Job (G585):** keep every lane on the top open row, answer lanes within minutes, delete process rather than add it.
Order: live reds + G578 → Driftwood/Pine zero (G570–G573, G571 rules, G572 done bar) → grid crossing T1–T6
(G580/G581) → Nine → Nalati → the rest (G575/G576 5x5 visuals). Rows: lanes/ready-queue.md.

**Census:** Driftwood AND Pine at the G572 done bar (custom/local/platform 0): DW 3559bb535e, Pine 90ef5273ee (sp-x9
deleted engine/sdk geometrySources; finishes/trophy wall read GeometryPack directly, phone frame PASS). Both shard
folders hold only shard.config.ts. Nalati ~4,150, Nine 1,541.

**Live:** 96b965a60f (08:58Z, T3 default-off). Next ready: e60250f4f2 (CI + exact smoke green). GitHub cron skipped
06:17/08:17Z; sp-x7 dispatches by hand when a run is missed.

**Crossing:** T2/T4/T5/T6 done default-off (Developer 'Grid shader warm-up'). T1 warm neighbour default-off
+ turn pre-emption (bed6aa9cdc): Sim ON 1,768/1,848 vs OFF 1,551/1,631 MB, p95 36 vs 46 ms; over 1.8 GB, stays off. T3 retention
is a net loss (templates evicted), default-off. O18 per-visit leaks fixed (heap 303 -> 217 MB). G579 (< 5 s) not met.

**Lanes:** Opus at 0 until the Sun 12:00 weekly reset (Claude 95 %, wildshard-v 10-22 03:40): all three finished and stopped (58fcd22019, fc3338f4fd,
92bf2708c2); G576, O27, O28 wait. T1 memory (runtime, not graphics) moved to sp-x1: retire the kept source when a
build-ahead starts (tmp/t1/transit.mjs: DW 271 + Pine 154 + Far Reach 139 MB sims resident at once). Codex: sp-x1 T1 memory, then Nalati riding/audio/save (Nine metadata e09bb7bb34; Nine envelope 29, no more prep groups); sp-x8 Nalati compiled entry
(held.mounted 022089667b, weather.clock next); sp-x6 Nalati groups X41 (weather prefix 6caaf5bf48, Titan encounter
next); sp-x9 Pine final 9 (population cut bff8753aa8, Nalati -8); sp-x7 release (96b dispatched by hand: GitHub cron
skipped 06:17/08:17Z).

**Tooling (G582/G585):** push loop + lane watchdog only, in herdr pane sp-tools (scripts/sp-tools.sh). main CI: one
running + newest pending. Commit: scripts/commit.sh "msg" -- <files>, or --patch <file> for shared files (D9).
HOST-BAR G571 lines: backticked engine/game/sdk/format paths ARE selectors. One coordinator docs commit an hour.

**Rules:** G492 no mid-task re-briefs; G569 watchdog; never herdr wildshard-v; no net-0 moves or relabels (G571);
G571 credit never erases a reviewed G520 chargeback without real change; legacy copies stay (G573); G561 holds.

**For wildshard-v:** Pine at zero (90ef5273ee). G575 round-36 far-variant captures landed for your board (fc3338f4fd,
art/grid/round-36-far-variants/, 60 labelled JPEGs: holo850/1600/none x haze off/light/current + all; 3 poses x iPhone/
desktop). sp-o4's read: every cell draws (4 near + 21 far proxy); the grey is the shipped haze; with haze off the 14
open plots read as bare blue-grey ground (additive holograms are not in the far proxy). 60 fps in every variant.
