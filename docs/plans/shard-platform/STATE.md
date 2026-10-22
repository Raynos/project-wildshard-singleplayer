# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Job (G585):** keep every lane on the top open row, answer lanes within minutes, delete process rather than add it.
Order: live reds + G578 → Driftwood/Pine zero (G570–G573, G571 correct-way rules, G572 done bar) → grid crossing
T1–T6 (G580/G581) → Nine → Nalati. Rows: lanes/ready-queue.md (G571 area table, G580, ZH, BS21).

**Ruler (1e063584e2):** plan 79.6 % (M3 92.6, M2 6/10). Custom: Pine 578, Driftwood 702, Nalati 4,248, Nine 1,797.

**Live:** 616ea317b; 38ebc2777b release dispatched 01:19Z (sp-x7); G578 in-world loading (6f0558e460 + e04f9682da)
ships the release after. Desktop 120 fps; Sim standalone/plots 60 fps; grid misses are late program compiles (T2).
Crossing re-measure eca095167a: Pine→Sky held 12.7 s, Sky→Pine 56.5 s; under 5 s not met (T1–T3 after zero rows).

**Lanes (G574: 3 Opus):** sp-o2 Pine G571 (landmarks); sp-o4 WASM-HOST H9 users (King/pool/rope/quest views);
sp-o5 entry kind, DW activation, then G586 island-library engine host (creatures landed f1b168e089). Codex:
sp-x1 Pine page boot / Z8 (D9 + --patch landed); sp-x6 DW entry migration (ZH landed 4c1236aec9; bind-sets next);
sp-x8 QX + runtime entry (kit now unblocked, then quest.world, figures/reference, kit cards); sp-x9 WASM-HOST H13 groundwork (H0b-H6 done); sp-x7 release owner (checks CI/smoke/live every 15 min). sp-o1, sp-o3 closed.

**Tooling (G582/G585):** only the push loop + lane watchdog, in herdr pane sp-tools (scripts/sp-tools.sh; no
launchd); CI/smoke watchers deleted (sp-x1, 013a31e5c2). main CI: one running + newest pending (G582). Commit path:
scripts/commit.sh "msg" -- <files>, or --patch <file> for shared files (D9, 013a31e5c2 + 25378eb23b). No receipts, proof docs or new scripts; one coordinator docs commit an hour.

**Rules:** G492 no mid-task re-briefs; G569 watchdog nudges idle lanes (sp-x7/o1/o3 exempt); never herdr
wildshard-v; no net-0 moves or relabels (G571); legacy copies stay (G573); G561 stays until each shard is done.

**For wildshard-v:** G573 applied (legacy patches deleted, G0 dropped). TRAMPLE_GLSL is live (forestPage.ts via
Pine hybrid), so its 30 lines stay charged (G572). G550 holo/haze captures wait behind the zero rows (G577).
