# Finish line: every SHARD-PLATFORM mini plan to 100 % (G769)

Written 2026-10-27 01:00 Cancun by a wildshard-v subagent, read at HEAD `60be37a2f2`. Counter:
`python3 -I tmp/plan-pct/plan_pct.py . --rev HEAD` reads **158.5 / 257 = 62 %**. How lanes stop waiting (gates, quiet
lock, pre-land checks) is in [mega-build-mini-plan.md](mega-build-mini-plan.md), not here. The coordinator marks rows;
this page marks nothing.

**Watch out:** the working-tree copy of `iphone-downloads-mini-plan.md` is older than HEAD. Committing the whole file
would undo the I5 / I6 / I8 / I9 / I10 marks, so patch only your own lines. (The plain counter run reads that stale copy
and shows 3 fewer rows.)

## Where we are

| Plan | Now | Path to 100 % |
|---|---|---|
| green-main | 1/8 | G768 already replaced GM2 and GM3. Fold GM4 into CF2, GM5 into CF3, GM6 into CF4, drop GM7. Leaves GM1 (XS) |
| ci-flow | 1/5 | CF3 and CF4 code has landed: mark them. CF2 = put the flaky tests in quarantine (G758). CF5 = delete the deadline check (XS) |
| custom-code-freeze | 11/13 | A1 needs LD8 and A2 needs A1: both parked until Jake's legacy word |
| js-payload | 6.5/10 | J6, J9, J10.2b, J7 (shrunk to a verdict): Codex, about half a day on one lane |
| js-heap | 0/12 | 9 Codex rows (S/M) and 2 Opus rows (H1, H10). G1 shrinks to a reading script. A row is done when its code lands |
| night-market-remaster | 10.5/15 | Mark RM0, RM9, RM11. Accept RM1 at 71/72 and RM12 on memory + fps. Build RM5.2 and RM14 |
| iphone-downloads | 3/12 | Mark I1 (= L18) and I5. Fold I2 into H3 and I11 into J6. Build I3, I4 (B), I7, I8.5 and I12 (shrunk) |
| loading-speed + loading | 32/40 | Close S1, G1 and L16 (code landed). Build H3 (shrunk), H4, A1, P2. M2 is parked for Jake |
| tile-streaming | 5.5/12 | Close T5 (G669) and T11 (G761). Shrink T2. Finish T3, T6, T7, T8, then T10's deletion. **Long pole** |
| core-memory | 4/7 | Mark C5, C6 and C3. Drop C2. C4 closes on Jake's ratchet ruling |
| grid-ready | 9/10 | Mark Nalati grid-ready (its zero landed in `27dd969127`). Crossing speed is tracked only in grid-crossing |
| grid-crossing | 5/6 | No row marks yet: write them. The last open row is G743, every crossing under 5 s (sp-x8). **Long pole** |
| shared-waits | 10/13 | Close SW3 (G768). Check SW9 (`07597bf0c1`). SW13 goes into quarantine with CF2 |
| night-market-pilot | 12/15 | Mark NM0–NM11 (SHAs below). R1, R2 and R3 duplicate RP3, RP2 and RP4: fold them. Then archive |
| legacy-deletion | 3/8 | Shrink LD4 to a Node list diff (Codex, now). LD5–LD8 are parked for Jake's word |
| remaster-open-plots | 1/4 | RP3 now (half an hour). RP2 shrunk, on the shared kit, 3 Opus lanes. RP4 after it. **Long pole** |
| gen speed (TP) | 7/9 | No marks: write the 15:00 recount's 7. Fold the other 2 into GR12 (the catalogue they tune gets deleted). Archive |
| TS quick wins (TP) | 6/7 | QW7 is closed in `20349b624a`: mark it and archive |
| TS plan (TP) | 2.5/6 | Close T5 (G768). Fold T1 into GR12. Shrink T4 to format + engine. T6 is a flag flip |
| oxlint (TP) | 4/5 | R4 waits on the GR source migration: fold it into GR12. Archive |
| no-binaries-in-json (TP) | 5/6 | GR3 retired Nine's producers, so mark B4. Fold B5 into GR6–GR8. Archive |
| generators redesign (TP) | 4.5/18 | Mark GR3. 184 catalogue jobs are left. **Long pole**: it needs the per-shard wrap (Q23) |
| build-speed CI rows | 15/16 | Close the last CI row (≤ 10 min CI, green main) under G768 |

## The path, in order

1. **Coordinator, now (15 min, one docs commit):** write every mark in "Unmarked but landed" and the closures already
   ruled (GM2/GM3 by G768, C6 by G762, T5 by G669, T11 by G761, SW3 by G768). The counter goes to about **66 %**.
2. **Jake answers the questions below in one batch.** On the recommended answers the folds and cuts take the counter to
   about **74 %** (172.5 / 233). Archive pilot, gen speed, TS quick wins, oxlint, no-binaries and build-speed CI in the
   same docs commit.
3. **sp-x7 (tooling only, small deletions, fits G769 (2)):** CF5, quarantine CF2 / GM4 / SW13, GM1, check SW9.
   ci-flow, green-main and shared-waits close by mid-morning.
4. **Codex, in parallel, as each lane finishes its current row (no interrupts, G492):**
   - sp-x9: J6, J9, J10.2b, J7.1, then I7, I8.5, I12. js-payload and iphone-downloads (Codex side) close by midday.
   - sp-x6: after GR6 (or the GR6 wrap), js-heap H2, H3, H4, H5, H7. sp-x2: after T8, js-heap H6, H8, H9, H11 and G1.
     js-heap closes in the afternoon.
   - sp-x8: G743 crossings, which is also tile-streaming T7. Grid-crossing closes only when Nalati is under 5 s.
   - sp-x1: GR5, then the generators wrap: GR7, GR9, GR10, GR12, GS1–GS3, GS5.
   - The first free lane takes loading H4, A1, P2, tile T2 (shrunk), T6, legacy LD4 (shrunk) and RP3.
5. **Opus:**
   - sp-o1: GR8 Pine (wrap), then RM14.
   - sp-o2: RM5.2, then the RP2 ideas.
   - sp-o3: I3 (DW / Nine quantised geometry) and I4 B.
   - sp-o4: js-heap H1 and H10 (render heap), after O4.4.
   - sp-o5: loading H3 (shrunk), then the T3 remainder, then RP2 ideas.
   NM remaster closes by midday and loading in the afternoon.
6. **Last:** T8 lands, then T10 deletes the whole-shard path (G747). Then RP4 deletes the hologram path, then GR12
   deletes the catalogue.

**Done by this evening (10-27):** everything except the four long poles and the rows parked for Jake.
**Will not finish today:**
- generators, even with the wrap: about a day, done 10-28. Rewritten producer by producer, 4–5 days.
- tile-streaming T7 / T8: the written estimate is 2.5–3 days, so 10-28 at the earliest.
- grid-crossing: Nalati is at 12.1 s and nobody can promise a date for under 5 s.
- remaster-open-plots RP2: 18 plots, 6–8 h on 3 Opus lanes even shrunk.
- custom-code-freeze A1 / A2 and legacy LD5–LD8: these wait for Jake's word.

## Unmarked but landed

- **night-market-pilot:**
  - NM0 `0814022f5d`
  - NM1–NM3 `9754cbfb1d`
  - NM4 `cb670026cf`
  - NM5 `1a5ffecb7c`
  - NM6 `31f2eb568b`
  - NM7 `5e67548eaf`
  - NM8 `a2e86c1204`
  - NM9 `46ab6c1366`
  - NM10 `686d604bae`
  - NM11 `def60a9ec9`
- **TS quick wins:** QW7 `20349b624a`.
- **generators:** GR3 `460196a1d7` (the final Nine scheduler job is retired; the app-table bar belongs to GR11 / GS).
- **no-binaries:** B4 closed by GR3: Nine's `paintArray` is retired and `castHook` / `lightSpill` are produced as files.
  Check its sub-rows.
- **core-memory:**
  - C5 `5d9aea7ecd` (G749 B shipped, so C5.6's pick is made)
  - C6: C6.1 and C6.3 are done and G762 closed C6.2
  - C3: the title-closure ratchet `f295f74bec` (J10.2a) refuses Three, Rapier and shard code. Check the menu script
    list once.
- **night-market-remaster:**
  - RM0 = tile-streaming T4.3, done
  - RM9: 9.1 board round 68, 9.2 done, 9.3 landed with RM6.4
  - RM11: 11.1–11.2 done
  - RM12: reading `04442c9f28` (30.3 fps, 1,117 / 1,197 MB). The draw count is Q27
- **iphone-downloads:**
  - I1 = L18, done at HEAD
  - I5: `c04922e9a7`, `1d0107c11b`, `f04f84d87a` (only I5.4's measurement is left)
- **ci-flow:** CF3 `1f76530a1d`, CF4 `eafc904ce9` (only the reading bars are left).
- **loading:** G1 `2416aec1a4` (verify only), L16 `ec2447e3fa` + `19a89ae60b` (acceptance only), S1 `c7a9b7b458`
  (shared programs on; budget reading only).
- **shared-waits:** SW9 `07597bf0c1` (check that the observer deletion is in).
- **Plans with no row marks** (the counter carries the 10-26 15:00 recount): grid-crossing T1–T6 (5 of 6) and gen
  speed G1–G10 (7). Write the marks so the % reads from the plan.

## Proposed cuts and closures

- **Code landed, only a reading left** (Q1): CF3, CF4, I5, S1, G1, L16, RM12, every js-heap H row and C2. The reading
  goes on the damage list (G769 (4)). The intent was the code change, and readings come back after the plan.
- **green-main GM2–GM7** (Q2): G768 superseded GM2 and GM3. GM4, GM5 and GM6 are CF2, CF3 and CF4 again. GM7 is a
  reading receipt (G769 (2)).
- **CF2 / GM4 / SW13 flaky tests** (Q3): done = quarantined with an owner (G758, still run, nothing deleted). The
  deterministic fixes go on the damage list.
- **SW3 and build-speed's last CI row** (Q4): both are red-window bars, and G768 accepts red main until the plan ends.
- **Pilot R1–R3 into RP3 / RP2 / RP4** (Q5): word-for-word duplicates.
- **RP2** (Q6): per idea, a style row, palette, map look and landmark on RM14's shared kit. Bespoke kits and
  billboards come later.
- **Core-memory C4** (Q7): ratchet at today's 268 / 246 MiB. 1.2 GB per shard holds with a wide margin.
- **Core-memory C2** (Q8): drop it. It is a WebKit reading of the Developer-on menu.
- **Grid-ready Nalati** (Q9): one bar, in grid-crossing.
- **Tile-streaming:**
  - T5 (Q11): G669 says no new Debug rows, and under G747 only tiles remain.
  - T11 (Q11): under G761 Pine and Nalati draw far content whole.
  - T2 (Q12): `engine/world/tileStreamer.ts` is the host. Done = the host-bar six tests on it. Moving `rings.ts` /
    `clientWorld.ts` onto it comes later.
  - T8 (Q13): only shards the grid reaches.
  - T10 (Q14): deletion now, iPhone check parked.
- **iphone-downloads:**
  - I4: B (Q15).
  - I2 and I11 (Q16): owned by H3 and J6 already.
  - I12 and J10.2b (Q17): build-time ceilings only, no boot-smoke request counting.
- **js-payload J7** (Q18): a Codex verdict with numbers, nothing ships.
- **js-heap G1** (Q19): a reading script, no exit-1 ratchet.
- **loading H3** (Q20): the spawn ring's tiles come first in the tile streamer's distance order.
- **legacy LD4** (Q22): compare the LEGACY and SHARDFILE model / set / world / arena lists in Node, with no browser lane.
- **generators** (Q23–Q24): the wrap. Fold GR11 into GS1–GS3 (G656 committed sources). Drop GS4 (pre-commit regen
  breaks the G768 5 s cap), and GS5 in CI catches staleness.
- **gen speed, TS T1 / T5, oxlint R4, no-binaries B5** (Q25–Q26): each is the same work as a GR row, or a gate G768
  removed.
- **NM remaster** (Q27): accept RM1 at 71/72 targets and RM12's 137–154 draws (ratcheted). Fold RM5.4 into the G755
  figure redo.

## Parked for Jake (the % keeps them in the total, they finish only on his word)

- **legacy-deletion LD5–LD8** and **custom-code-freeze A1–A2** (A1 needs LD8): his "delete legacy now" after his phone
  QA (G606).
- **loading M2** and **T10's iPhone check**: his phone (G558).
- **RM13**: his play of the board and walk (both sent).
- At most 7.5 rows, so 100 % of the rest reads as about **97 %** until he plays.

## Questions for Jake

Option 1 shown to you is always "Skip for now". **Rec** = recommended.

1. **Close rows whose code has landed and only a reading is left, and put the readings on the damage list?**
   (a) close them on landed code; (b) one reading per plan at the very end; (c) keep every reading.
   **Rec (a):** G769 already says land on types + lint. This closes about 10 rows now and keeps js-heap's 12 rows from
   waiting on readings.
2. **green-main: close GM2–GM7 and keep only GM1?** (a) yes; (b) keep GM6's auto-bisect.
   **Rec (a):** G768 replaced the 180 s gate. GM4–GM6 repeat ci-flow rows, and CF4 already names culprits.
3. **Flaky tests (CF2, GM4, SW13): is "quarantined with an owner" enough to call them done?**
   (a) quarantine now, fixes after the plan; (b) make each deterministic now.
   **Rec (a):** G758 allows quarantine. Five tests at about an hour each is lane time the plan needs.
4. **Close SW3 and build-speed's last CI row, since G768 accepts red main?** (a) close; (b) keep for after the plan.
   **Rec (a):** both measure red windows, and you chose speed over green until the plan is done.
5. **Fold Night Market pilot R1–R3 into remaster RP3 / RP2 / RP4 and archive the pilot?** (a) yes; (b) keep both.
   **Rec (a):** the same three jobs are counted twice.
6. **Start RP2 now, without waiting for your Night Market play, shrunk to a style row + palette + landmark per idea on
   the shared kit?** (a) start now, shrunk; (b) start now, full bespoke kit + billboards each; (c) wait for your play.
   **Rec (a):** G769 says build waiting rows on the recommended option. The shrunk version is about 6–8 h on 3 Opus
   lanes instead of 2 days.
7. **Core memory C4: Template native is 268 / 246 MiB against the 198.5 MiB cap after 20 slices.**
   (a) ratchet at today's reading and close C4; (b) one lane keeps chasing; (c) raise the cap to 250 MiB.
   **Rec (a):** the real limit is 1.2 GB per shard. An empty Three.js renderer alone measures 58 MiB.
8. **Drop core memory C2, the WebKit reading of the Developer-on menu?** (a) drop; (b) one Simulator reading.
   **Rec (a):** it is a measurement of a Developer-only path.
9. **Mark Nalati grid-ready now and track crossing time only in grid-crossing?** (a) yes; (b) wait for Nalati under 5 s.
   **Rec (a):** Nalati's zero is done (`27dd969127`), and one bar in one plan stops the same wait being counted twice.
10. **Crossings: what bar closes grid-crossing and tile T7?** (a) every crossing under 5 s, Chromium phone tier, warm;
    (b) under 5 s warm and under 8 s cold; (c) as written (warm, every neighbour).
    **Rec (b):** Pine passes and DW / Nine are about 7–9 s. Cold Nalati at 12 s is shader builds that G717 is cutting,
    and (b) makes the plan finishable this week.
11. **Close tile T5 (Debug row) and T11 (far landmarks)?** (a) close both; (b) keep T11.
    **Rec (a):** G669 bans new Debug rows, and under G761 Pine draws its far content whole.
12. **Tile T2: count `tileStreamer.ts` as the residency host and close T2 on its host-bar tests?**
    (a) yes, the rings / clientWorld migration comes after the plan; (b) as written (2 days).
    **Rec (a):** the streamer already runs entered worlds by tile (`dc240845c1`). The migration is cleanup.
13. **Tile T8: which shards must be on tiles?** (a) only shards the grid reaches; (b) all seven as written.
    **Rec (a):** tiles only matter where a player walks in from the grid, and G761 already keeps the other shards'
    far content as it is.
14. **Tile T10: delete the whole-shard path once T8 lands, with the Simulator reading after?**
    (a) yes; (b) wait for the Sim + soak pass first (G747 as written).
    **Rec (a):** with Q1 the reading goes on the damage list. Your iPhone check stays the last step.
15. **iPhone downloads I4: ship the Pine phone birds atlas as ETC1S (B, board
    `art/pine-hollow/round-37-phone-birds-etc1s/board.jpg`)?** (a) B; (b) keep A and drop the 15 MB target.
    **Rec (a):** it alone meets the target (Pine phone KTX2 about 14.9 MB). The softer feather stripes are on a far
    texture.
16. **Fold I2 into loading H3 and I11 into js-payload J6 / U1?** (a) yes; (b) keep them.
    **Rec (a):** the plan already says another plan owns each of them.
17. **Guards I12 and J10.2b: build-time ceilings only (declared phone wire, chunk gzip), without counting requests in
    the boot smoke?** (a) yes; (b) as written.
    **Rec (a):** the same refusal, and no new boot-smoke machinery (G585).
18. **js-payload J7 node-material spike:** (a) Codex byte verdict only, nothing ships; (b) drop it; (c) full Opus spike.
    **Rec (a):** 1–2 h, and the numbers stay for later.
19. **js-heap G1 guard: a reading script without the exit-1 ratchet?** (a) yes; (b) as written; (c) drop G1.
    **Rec (a):** a refusing ratchet is machinery that holds lanes (G769 (2)).
20. **Loading H3: spawn ring tiles first in the tile streamer's distance order, without the separate per-file
    measurement step?** (a) yes; (b) as written (1.5 d).
    **Rec (a):** tiles already stream by distance, so this is an order change, not a new system.
21. **Rows only your phone or word can finish (M2, the T10 iPhone check, RM13, LD5–LD8, A1–A2): keep them in the
    total, or leave them out?** (a) leave them out, so 100 % means "all the building is done"; (b) keep them in.
    **Rec (a):** you said you'd check much later. Leaving them out lets the plans archive as soon as the building is
    done.
22. **Legacy LD4: compare Explorer lists in Node instead of a browser lane, and build it now?** (a) yes; (b) at each
    shard's milestone, in a browser.
    **Rec (a):** the same diff, about 1 h, and no browser slot.
23. **Generators: wrap each shard's remaining catalogue jobs into one shard program that calls the existing producers
    in order, then delete the catalogue, with per-producer rewrites after the plan?**
    (a) wrap; (b) rewrite each producer as written (184 jobs).
    **Rec (a):** it delivers your "one program per shard, no catalogue" in about a day instead of 4–5. The cleaner
    insides come later.
24. **Generated app tables: fold GR11 (virtual modules) into GS1–GS3 (committed files) and drop GS4 (pre-commit
    regeneration)?** (a) yes, GS5 checks staleness in CI; (b) keep GS4.
    **Rec (a):** G656's committed files already decide the question, and GS4 breaks the G768 5 s pre-commit.
25. **Close the gen speed plan and fold its open rows into GR12?** (a) yes; (b) keep it.
    **Rec (a):** what is left tunes the catalogue that GR12 deletes.
26. **TS / lint plans: close T5 (G768), fold T1 and oxlint R4 into GR12, shrink T4 to format + engine, fold B5 into
    GR6–GR8?** (a) yes; (b) as written.
    **Rec (a):** each is either the same work as a GR row or a gate that G768 removed.
27. **Night Market remaster: accept RM1 at 71 of 72 targets, RM12 at 137–154 draws (ratcheted, the bar was ≤ 120),
    and fold RM5.4 into the G755 figure redo?** (a) accept all three; (b) cut draws to 120 first.
    **Rec (a):** fps (30.3) and memory (1.2 GB) pass, and the draws cost nothing visible.

## Estimate

- **Now:** 158.5 / 257 = 62 %. After marks: about 66 %. With every recommended answer: 172.5 / 233 = 74 %.
- **Left after the cuts:** about 60 rows. 7.5 are parked for Jake. About 53 are buildable, and roughly 40 of those are
  S / M.
- **Pace:** at G768 / G769 pace, about 0.35 counted rows per lane-hour across 10 lanes (the measured 0.19 included the
  push stall). The S / M rows clear by about 16:00–18:00 Cancun today.
- **Every plan except the long poles at 100 %:** this evening.
- **All plans at 100 % except the parked rows:** about 10-28 evening with Q6, Q10, Q13 and Q23 on (a). Without the
  generators wrap, about 10-31.
