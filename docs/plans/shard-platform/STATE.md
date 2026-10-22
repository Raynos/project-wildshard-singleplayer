# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Job (G585):** keep every lane on the top open row, answer lanes within minutes, delete process rather than add it.
Order: live reds + G578/G587/G588 → Driftwood/Pine zero (G570–G573, G571 rules, G572 done bar) → grid crossing
T1–T6 (G580/G581) → Nine → Nalati. Rows: lanes/ready-queue.md.

**Official census (sp-x8, 3bd0b9fc7c, all-product reuse):** Pine 223 custom (44 local, 179 platform-charged;
C5 112, C1 47, C9 47; 75 listed view), Driftwood 397 (269 local, 128 charged; C1 197, C9 159, C6 29). Was Pine 578,
Driftwood 702 at 1e063584e2 this evening. Nalati 4,248, Nine 1,797 unchanged. Plan % refresh pending.

**Live:** 38ebc2777b. The products-build red ('Missing instrumentation', DW v2 bridge wasm admitted as v1 since
f300bd6826) is FIXED in 2d1ca6dc80 (sp-x8, full all-shard build green); c2bd2b6164's CI is the first run carrying
it. Next release: >= 2d1ca6dc80 (carries the Nalati road fix 8f0b1d39f1, G578, G587, G588, 4db6393278).

**Lanes (G574: 3 Opus):** sp-o2 T1 warm neighbour (probes unblocked); sp-o4 T1 bindings done bar the neighbour
day clock, then Nine (split with sp-o5); sp-o5 T2+T5 landed default-off (Pine crossing 68.5 -> ~43 s Chromium 4x),
now Nine looks/world. Codex: sp-x1 T3 landed (db4edc7e1b, c824249f5e, 9925dd99ee), measuring; sp-x6 DW audio done
(02d9a7cf57), bridge two-stage construction next; sp-x8 QX + Pine quest.views cut; sp-x9 H13: 17/19 authored AS
dual-admitted, v0 directors next; sp-x7 release owner (c2bd2b6164 CI green, exact smoke running).

**Tooling (G582/G585):** push loop + lane watchdog only, in herdr pane sp-tools. main CI: one running + newest
pending. Commit: scripts/commit.sh "msg" -- <files>, or --patch <file> for shared files (D9). HOST-BAR G571 lines:
backticked engine/game/sdk/format paths ARE selectors (prose unbackticked). One coordinator docs commit an hour.

**Rules:** G492 no mid-task re-briefs; G569 watchdog; never herdr wildshard-v; no net-0 moves or relabels (G571);
G571 credit never erases a reviewed G520 chargeback without real change; legacy copies stay (G573); G561 holds.

**For wildshard-v:** Crossing T2+T5 landed default-off (Developer row 'Grid shader warm-up'); Chromium phone 4x Pine 68.5/72.2 -> 53.9/44.2 s; sp-o5 recommends the 'bigger build budget' option for default-on once a device reading backs it (Sim still fails the 200 ms floor in all three, baseline included). G586 host sits in game/models (product/fixed draws are game-layer, E405), not engine. TRAMPLE_GLSL is live (forestPage.ts), so its 30 stay charged (G572). DW sections were 61/58
(red), folded back to 58 in 41045b7161. G550 captures wait behind the zero rows (G577).
