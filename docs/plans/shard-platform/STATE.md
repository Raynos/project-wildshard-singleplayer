# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Job (G585):** keep every lane on the top open row, answer lanes within minutes, delete process rather than add it.
Order: live reds + G578/G587/G588 → Driftwood/Pine zero (G570–G573, G571 rules, G572 done bar) → grid crossing
T1–T6 (G580/G581) → Nine → Nalati. Rows: lanes/ready-queue.md.

**Official census (sp-x8, 493cca22b0 + f1d3ff1e8e stub rule):** Pine 51 (0 local, 51 platform-charged Pine-only
exports; sp-o4 converting the last 30 graphical), Driftwood 174 (83 local), Nalati 4,250, Nine ~1,600. Both Pine and
Driftwood shard folders now hold NO runtime TS except shard.config.ts (Pine 4f9f4cf879, DW eeb30486f1). G572 done
bar = also no platform charges left against them.

**Live:** 00e5d7721d (05:43Z), PINNED (c1adc78eb8): it carries T3's default activation, which the quiet A/B showed
slows Sky->Pine by ~20 s (all retained templates evicted). Floor for the next release: 2c8e05dd64 (T3 default-off);
sp-x7 releases the first green candidate containing it. T1 warm neighbour default-off (028a898d22, 0.02 s crossing
when dwelling), Sim memory/fps reading pending. O18 per-visit leaks fixed (heap 303 -> 217 MB).

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
