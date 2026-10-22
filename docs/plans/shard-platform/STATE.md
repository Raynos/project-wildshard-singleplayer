# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Job (G585):** keep every lane on the top open row, answer lanes within minutes, delete process rather than add it.
Order: live reds + G578/G587/G588 → Driftwood/Pine zero (G570–G573, G571 rules, G572 done bar) → grid crossing
T1–T6 (G580/G581) → Nine → Nalati. Rows: lanes/ready-queue.md.

**Official census (sp-x8, 3bd0b9fc7c, all-product reuse):** Pine 223 custom (44 local, 179 platform-charged;
C5 112, C1 47, C9 47; 75 listed view), Driftwood 397 (269 local, 128 charged; C1 197, C9 159, C6 29). Was Pine 578,
Driftwood 702 at 1e063584e2 this evening. Nalati 4,248, Nine 1,797 unchanged. Plan % refresh pending.

**Live:** see sp-x7 (00e5d7721d releasing: T3 allocator fix + Nalati keepers + all earlier live fixes). Deploy back on
newest-ci-green (d4dffa3986); guard on heads >= 03d2597f56 lifts once CI on >= 173ec6a6ee passes products.
Pine: only shard.config.ts left in src/shards/pine-hollow (4f9f4cf879 compiled page runtime); DW has 5 runtime files
left (hybrid, catalogue, roster, blobAssets, rows). T1 warm neighbour landed default-off (028a898d22): crossing wait
0.02 s when the player dwells; Simulator memory/fps reading next for default-on. T3 retention evicted under pressure.

**Lanes (G574: 3 Opus):** sp-o2 T1 warm neighbour; sp-o4 O18 per-visit memory leak; sp-o5 Nine looks/world
(-22 so far). Codex: sp-x1 Nine non-graphical + T3 A/B (T3 landed, gain unproven); sp-x6 DW world tail (bridge,
cover, gulls, shrine, audio landed; hybrid binds last); sp-x8 QX + no-TS-entry runtime (af8e6820fa) -> Pine hybrid
deletion; sp-x9 Nalati Z6 (keepers -31; kokpar chapter-view facet on the shared composition host); sp-x7 release.
Done tonight: T2, T4, T5, T6 (default-off), G586, King, H13 groundwork (19/19 scoped AS dual-admitted).

**Tooling (G582/G585):** push loop + lane watchdog only, in herdr pane sp-tools. main CI: one running + newest
pending. Commit: scripts/commit.sh "msg" -- <files>, or --patch <file> for shared files (D9). HOST-BAR G571 lines:
backticked engine/game/sdk/format paths ARE selectors (prose unbackticked). One coordinator docs commit an hour.

**Rules:** G492 no mid-task re-briefs; G569 watchdog; never herdr wildshard-v; no net-0 moves or relabels (G571);
G571 credit never erases a reviewed G520 chargeback without real change; legacy copies stay (G573); G561 holds.

**For wildshard-v:** Crossing T2+T5 landed default-off (Developer row 'Grid shader warm-up'); Chromium phone 4x Pine 68.5/72.2 -> 53.9/44.2 s; sp-o5 recommends the 'bigger build budget' option for default-on once a device reading backs it (Sim still fails the 200 ms floor in all three, baseline included). G586 host sits in game/models (product/fixed draws are game-layer, E405), not engine. TRAMPLE_GLSL is live (forestPage.ts), so its 30 stay charged (G572). DW sections were 61/58
(red), folded back to 58 in 41045b7161. G550 captures wait behind the zero rows (G577).
