# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G824 (Jake): SHARD-PLATFORM archives today.** Tile T6 / T7 finish today if they can (crossings: G828);
remaining misses move to BURN-DAMAGE-LIST. NM pilot R1-R3 and RP2-RP4 move to a new parked open-plots plan
(wildshard-v, after Jake's play). Jake QAs legacy (his word starts LD5-LD8 and A1-A2 at once), M2 and T10. After the archive
commit every lane and the coordinator stop. The render tails need Opus, and Opus needs the account switch (Claude 97 %).
**Live P0s, one combined release f708fbbaea:** NM card + BootSpec (sp-x10; card QA'd on 3156eae054), Bag > MAP static
(G826, Safari PASS), boot memory-yield mitigation (a23222fbee; the freeze never reproduced on the Sim, even upgrading from an old
SW). CI green; smoke rerun after a GitHub macOS runner capacity failure (4 / 6 passed, Grid + Explorer re-running).
**G828 (Jake):** crossing-time cuts stop. T2-T4 and grid-ready Nalati close as 'not reachable in this architecture'
(Chromium cold DW 7.5, Nalati 10.4, Pine 14.7 s; sp-x6 marks), not on the damage list. Nobody drafts a one-world plan.
**G825:** sp-ci-deploy rewrites src/game/whatsNew.json now for live a3f28a795, and with every release.

**(1) LIVE a3f28a7953** until f708fbbaea ships. Damage list: [BURN-DAMAGE-LIST](../BURN-DAMAGE-LIST.md) only.

**G819-G823 marked:** H3 closed, H4 / A1 accepted misses (43114e578e); T7 open (2 DW misses, 769b2f616a); RM13 closed (G827).
T10 official floor with spawn settle (cd73c3a642): still 13 / 15 (spawn p95 41, Pine drive 42 ms; Opus).
**Counter:** true 188.5 / 209 before G819-G823's marks (sp-x8 recount, cc69600).

**Still open for wildshard-v / Jake:** Nalati herd clock (tick once per 0.1 s; recommend yes). Fewer material variants
(A / B board) and Nalati mesh quantising (recommend yes to both). Pine data-only build ahead, T7.7 (recommend yes). RM8.1e
codec pixel witness (recommend Opus). D53's 8 manual CLIs (recommend debt). Picks: D183 / D185, LD5-LD8, A1 / A2, M2 phone
step, DW -7 MB board (round-21-phone-geometry-ab).

**FYI Jake:** Pine white ground / teal tree cards (D189) and the slow-link Pine crossing (D190 / D196) are fixed and live.
**M2:** Sim cold 7.37 s pass, warm 8.44 s miss (an intermittent Safari ~975 ms hold before SW dispatch, not app code).
**Explorer-after-play fixed:** Nalati 94 / 94 (f4000a3f59 frame-wait cap); Nine 60 / 60 (the harness's agent-browser Escape
key flood, 222c87942b).
**Opus (needs the morning account switch; Claude 97 %):** Pine drive (T10), Nalati / Pine cold render tails, T7 GPU
footprint, D154, D197 render half, RM8.1e witness.

**Rules:** G704. G807. G818. G819-G823. No reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
