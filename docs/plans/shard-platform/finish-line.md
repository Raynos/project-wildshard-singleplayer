# Finish line: every SHARD-PLATFORM mini plan to 100 % (G769)

Written 2026-10-27 01:00 Cancun by a wildshard-v subagent; **rewritten ~02:45 after Jake answered every question
(G770–G799)** and the answers were applied to the mini plans. Counter: `python3 -I tmp/plan-pct/plan_pct.py . --rev
HEAD`. How lanes stop waiting is in [mega-build-mini-plan.md](mega-build-mini-plan.md). The damage list lives only in
[BURN-DAMAGE-LIST.md](../BURN-DAMAGE-LIST.md) (G800).

**Watch out:** the working-tree copy of `iphone-downloads-mini-plan.md` (and `tile-streaming-mini-plan.md`) is older
than HEAD. Committing the whole file would undo landed marks, so patch only your own lines.

## Where we are (after the answers)

| Plan | Now | Path to 100 % |
|---|---|---|
| green-main | 1/2 | GM1 only, built last (G787, G770) |
| ci-flow | 1/5 | CF2 = quarantine with owners (G788); CF3 / CF4 close on the plan's end reading (G780); CF5. Built last |
| custom-code-freeze | 11/13 | A1 / A2 wait for Jake's legacy word; counted (G779) |
| js-payload | 7.5/10 | J6, J9, J10.2b (build-time ceiling, G792); J7.1 dropped (G793) |
| js-heap | 5/12 | G1 first, exit-1 (G778); landed H rows close on the end reading (G780); H5–H11 |
| night-market-remaster | 13.5/15 | RM1 and RM12 accepted, RM5.4 into the G755 figures (G785); RM5, RM14; RM13 is Jake's (G779) |
| iphone-downloads | 5/12 | I4 B shipped (G786); I2 / I11 stay separate (G791); I3, I7, I12 (build-time, G792) |
| loading-speed + loading | 35/40 | S1, G1, L16 close on the end reading (G780); H3 is an order change (G794); H4, A1; M2 is Jake's |
| tile-streaming | 8/12 | T2 as written (done), T5 as written (G775), T8 all seven, T10 the moment T8 lands (G790); T7 at 5 s warm / 8 s cold (G782); T11 stays open (G775). **Long pole** |
| core-memory | archived | C4 ratcheted, C2 dropped (G781); every row closed |
| grid-ready | 9/10 | Nalati waits for 5 s warm / 8 s cold (G784) |
| grid-crossing | 3/6 | T1, T5, T6 marked from git; T2 in flight; T3, T4 have no landing found. Bar: 5 s warm / 8 s cold (G782). **Long pole** |
| shared-waits | 11/13 | SW3 kept, built last (G789); SW13 = quarantine (G788) |
| night-market-pilot | 12/15, parked | R1–R3 parked (G774) |
| legacy-deletion | 3/8 | LD4 a Node list compare, now (G795); LD5–LD8 on Jake's word, counted (G779) |
| remaster-open-plots | 1/4, parked | RP2–RP4 parked (G774); a new plan for the other 18 plots after Jake plays Night Market |
| gen speed, oxlint, no-binaries | archived | Open rows folded whole into generators GR12 and GR6–GR8 (G796) |
| TS quick wins, TS plan | archived | (before this page; T1 / T6 folded into GR12) |
| generators redesign | 6.5/17 | Producer by producer, no wrap (G783); GR11 dropped; GS1–GS5 as written, GS4 / GS5 last (G798, G770). **Long pole** |
| build-speed CI row | 15/16 | Kept, built last (G789) |

Counter at the start of the rewrite: 182 / 248 = 73 %. After the answers: about 147.5 / 210 = 70 %. The % went down
because Jake kept rows the old page proposed to cut (G780 readings, SW3, T11, T2 / T8 as written), and the five
finished plans left the count when they archived.

## The path, in order

1. **Every lane, now:** counted rows only, from `lanes/ready-queue.md`; landed rows marked in their plan within the hour.
2. **Codex:** js-heap (G1 first), iPhone downloads and loading on the extra lane (G776); crossings on one lane (G743);
   generators producer by producer (sp-x1, sp-x6, sp-x10, G783); T8 then T10 (sp-x2).
3. **Opus:** graphical rows (RM5, RM14, T5, I3, H1 / H10, generators GR8 Pine); one Chromium capture after landing (G797).
4. **sp-ci-deploy:** main CI green and the hourly deploy, no plan rows (G771, G802).
5. **Last:** the tooling rows (G770); then one reading per plan (G780) and the official Simulator readings for RM12,
   T10, M2 and I12 (G777); then Jake's iPhone check (G558) and his legacy word.

**Will not finish today:** generators (4–5 days, about 10-31), tile T2 / T8 / T10 (10-29 to 10-30), crossings (no
date until Nalati is under 5 s warm / 8 s cold), and the rows only Jake can finish.

## Rows marked landed on 10-27

- night-market-pilot NM0–NM11, TS quick wins QW7, generators GR3, core-memory C3 / C5 / C6: already marked at HEAD.
- no-binaries B4 (`460196a1d7`), core-memory C1 / C7 / C5.6, grid-crossing T1 (`dce1dd8ca2`), T5 (`c2bd2b6164`),
  T6 (`e04f9682da`), gen speed G2 / G3 / G4 / G5 / G7 / G9 / G10 (SHAs on the archived rows).
- Reopened by the answers: CF3, CF4, S1, G1, L16 and js-heap H1–H4 (end reading, G780), SW3 (G789), T11 (G775).

## Questions Jake answered (all 27, plus Q24 by G798)

| # | Question | Answer |
|---|---|---|
| 1 | Close rows on landed code, readings to the damage list? | **G780**: one reading per plan, at the end |
| 2 | green-main: keep only GM1? | **G787**: yes |
| 3 | Flaky tests done once quarantined? | **G788**: yes, with a named owner; fixes on the damage list |
| 4 | Close SW3 and build-speed's last CI row? | **G789**: keep both, at the end |
| 5 | Fold pilot R1–R3 into RP3 / RP2 / RP4? | **G774**: both parked instead |
| 6 | Start RP2 now, shrunk? | **G774**: parked until Jake plays Night Market |
| 7 | Core memory C4: ratchet? | **G781**: ratchet at 268 / 246 MiB |
| 8 | Drop C2? | **G781**: dropped |
| 9 | Mark Nalati grid-ready now? | **G784**: no, it waits for the crossing bar |
| 10 | Crossing bar? | **G782**: under 5 s warm and 8 s cold |
| 11 | Close tile T5 and T11? | **G775**: T5 built as written, T11 stays open |
| 12 | Tile T2 shrunk? | **G790**: as written, with the migration |
| 13 | Tile T8: which shards? | **G790**: all seven |
| 14 | T10 delete once T8 lands? | **G790**: yes; Simulator reading at the end |
| 15 | iPhone I4: B? | **G786**: B ships |
| 16 | Fold I2 / I11? | **G791**: keep them separate |
| 17 | I12 / J10.2b build-time only? | **G792**: yes |
| 18 | J7 node-material spike? | **G793**: dropped |
| 19 | js-heap G1 as a reading script? | **G778**: no; first, exit-1 ratchet |
| 20 | Loading H3 as an order change? | **G794**: yes |
| 21 | Jake-only rows out of the total? | **G779**: they stay in |
| 22 | LD4 in Node, now? | **G795**: yes, deletes nothing |
| 23 | Generators: wrap or rewrite? | **G783**: rewrite each producer, no wrap |
| 24 | GR11 vs GS1–GS5, drop GS4? | **G798**: GS1–GS5 with GS4, GR11 dropped; **G799**: no Vite plugins |
| 25 | Close gen speed into GR12? | **G796**: yes, folded whole |
| 26 | TS / lint folds? | **G796**: T5 closed, T1 and R4 into GR12, T4 format + engine, B5 into GR6–GR8 |
| 27 | Night Market RM1 / RM12 / RM5.4? | **G785**: accept all three; RM5.4 into the G755 figure redo |
