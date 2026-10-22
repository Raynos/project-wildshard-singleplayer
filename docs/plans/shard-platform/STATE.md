# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Job (G585):** keep every lane on the top open row, answer lanes within minutes, delete process rather than add it.
Order: live reds + G578 → Driftwood/Pine zero (G570–G573, G571 rules, G572 done bar) → grid crossing T1–T6
(G580/G581) → Nine → Nalati → the rest (G575/G576 5x5 visuals). Rows: lanes/ready-queue.md.

**Census (sp-x8, 3559bb535e):** Driftwood G572 ZERO (custom/local/platform 0). Pine 9 left, all
engine/models/geometrySources (registerPackedGeometrySource 7 + PackedGeometryImports 2); sp-x9 deletes them by moving
Pine's finishes/trophy wall to the direct engine GeometryPack reader (the spruce pattern). Both shard folders hold only
shard.config.ts. Nalati ~4,250, Nine ~1,600.

**Live:** 00e5d7721d, PINNED (c1adc78eb8; carries T3 default-on, ~20 s slower Sky->Pine). Floor for the next release
is 2c8e05dd64 (T3 default-off); 96b965a60f has full CI green and its exact smoke is running; sp-x7 releases + unpins.

**Crossing:** T2/T4/T5/T6 done default-off (Developer 'Grid shader warm-up'). T1 warm neighbour default-off
(028a898d22 … cca5595ca7): Sim peak 1,768 vs 1,551 MB, drive max 125 ms, so sp-o2 is adding preemption. T3 retention
is a net loss (templates evicted), default-off. O18 per-visit leaks fixed (heap 303 -> 217 MB). G579 (< 5 s) not met.

**Lanes (G574: 3 Opus):** sp-o2 T1 preemption; sp-o4 G575 round-36 far-variant captures, then G576; sp-o5 Nine
drawnInto boxes. Codex: sp-x1 Nine play activation (HeldClaims + portal host); sp-x8 Nalati compiled-entry migration
(host, schema, held.mounted group first); sp-x6 Nalati-side groups of that migration (world group first; elite charges
stay, audit 10-22); sp-x9 population-bake cut, then Pine 9 -> 0; sp-x7 release. Nalati graphical owners that block
the state flip are row O27 (next free Opus lane).

**Tooling (G582/G585):** push loop + lane watchdog only, in herdr pane sp-tools (scripts/sp-tools.sh). main CI: one
running + newest pending. Commit: scripts/commit.sh "msg" -- <files>, or --patch <file> for shared files (D9).
HOST-BAR G571 lines: backticked engine/game/sdk/format paths ARE selectors. One coordinator docs commit an hour.

**Rules:** G492 no mid-task re-briefs; G569 watchdog; never herdr wildshard-v; no net-0 moves or relabels (G571);
G571 credit never erases a reviewed G520 chargeback without real change; legacy copies stay (G573); G561 holds.

**For wildshard-v:** Driftwood is at the G572 done bar; Pine is 9 lines from it (one geometry-source host). The T1
warm neighbour costs ~220 MB peak on the Sim, so it stays off until preemption lands and a reading backs it.
