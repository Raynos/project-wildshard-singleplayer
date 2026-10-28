# Close-out spike: archive every SHARD-PLATFORM plan except legacy (G824)

**State:** `open` 2026-10-28 ~13:50 Cancun. Written by wildshard-v. Coordinator: wildshard-new.

Jake, 2026-10-28 ~13:48: *"I want you to come up with a new mini spike plan to get all the fucking plans closed and
archived except the ones blocking on me ... we can't delete the legacy yet. I don't know what else. You have to tell me
what else I'm blocking on."*

## Where it stands (counter, origin/main, frozen denominator 209)

**190 / 209 rows = 91 %; 89 % by effort (1,004 / 1,132 lane-h).** Already archived: js-payload, js-heap,
night-market-remaster, green-main, ci-flow, generators (plus gen speed, oxlint, no-binaries, core-memory, TS quick wins).

| Plan | Rows | What is left | How it closes |
|---|---|---|---|
| iphone-downloads | 12 / 12 | nothing | archive now |
| grid-crossing | 5 / 5 | nothing (G828) | archive now |
| loading + loading-speed | 39 / 40 | M2 | Jake's phone QA closed it (G831): mark, archive |
| shared-waits | 12 / 13 | SW13 | done `9872fc12a0` (G788); fix the mark, archive |
| grid-ready | 9 / 10 | Nalati | closed by G828 (not reachable in this architecture): mark, archive |
| build-speed CI | 15 / 16 | the last CI row | closed by G809 on the first green run: mark, archive |
| tile-streaming | 10 / 12 | T6, T7, T10 | T10's phone check passed (G832). T6 / T7 cut until 18:00, then move to BURN-DAMAGE-LIST (G824) |
| night-market-pilot | 12 / 15 | R1–R3 | Jake passed Night Market (G827); R1–R3 move to OPEN-PLOTS (G824): archive |
| remaster-open-plots | 1 / 4 | RP2–RP4 | move to OPEN-PLOTS (G824, G829): archive |
| open-plots (hologram) | all done | nothing | archive |
| mega-build | process rows | nothing to build | archive (its rules live in G768–G805) |
| finish-line.md | a page | nothing | archive with the plan |
| **legacy-deletion** | 4 / 8 | LD5–LD8 | **blocked on Jake** |
| **custom-code-freeze** | 11 / 13 | A1–A2 (after LD8) | **blocked on Jake** |

## What waits on Jake

1. **LEGACY vs SHARDFILE, shard by shard**, then his "delete legacy now" (LD5–LD8, then A1–A2). He has no time to
   play every shard twice. Row CO6 offers a board instead: an agent captures each shard both ways from the same
   cameras and he skims one sheet.
2. **Switching to the second Claude account.** Opus is stopped at 97 % (G818). The water, the blurred top, the pier and
   the reveal-before-shaders fixes are render work.
3. **Starting the parked plans, on his word, after the archive:** OPEN-PLOTS (OP1 lanterns first), BURN-DAMAGE-LIST.
   The one-world plan is his to write (G828).

Nothing else waits on him.

## Rows

| Row | What | Owner | Done when |
|---|---|---|---|
| CO1 | **Ship the QA fix release** found in Jake's 10-28 phone QA: service-worker stall limits (G830: page reload, stylesheet, `shard.json`, map code), the loading screen painted on tap, the update screen's reload step animated, steps under 500 ms grouped, the hold toggle on the loading screen, the water regression, the blurred top, the minimap tile labels off, the pier and far stand-ins, reveal after the spawn shaders link, the Props 23.7 s check | two Codex lanes + Opus after the account switch; sp-ci-deploy releases | one immediate deploy; Chromium + WebKit iPhone runs load Driftwood without a hang; build id to Jake |
| CO2 | **Marks**: M2 (G831), SW13, grid-ready Nalati (G828), build-speed CI (G809), T10 phone check (G832), the NM pilot Jake check (G827) | wildshard-new | the counter reads them |
| CO3 | **Moves**: NM pilot R1–R3 and remaster RP2–RP4 into OPEN-PLOTS (copy each done-when whole); T6 / T7 to BURN-DAMAGE-LIST at 18:00 with their numbers if not met; pop-in and far content (G832), the Sky · lighting 16.6 s step (G831) | wildshard-new | no row lost; each source row says where it went |
| CO4 | **Archive** every finished mini plan to `project/archive/2026-10-28-<name>.md`, links fixed in SHARD-PLATFORM.md | wildshard-new | only legacy-deletion and custom-code-freeze stay live |
| CO5 | **Legacy as its own parked plan**: move legacy-deletion and custom-code-freeze A1–A2 into `docs/plans/LEGACY-DELETION.md` (parked, starts on Jake's "delete legacy now"), so SHARD-PLATFORM can archive (G824) | wildshard-new | SHARD-PLATFORM has no open row |
| CO6 | **LEGACY vs SHARDFILE board** (if Jake picks it): every shard entered both ways from the same 4 cameras, phone portrait, labelled, one sheet per shard, plus LD4's Node list gaps (Nine registrations, Far Reach POIs) | one Codex lane (captures) | one board batch to Jake; his word deletes legacy |
| CO7 | **Archive SHARD-PLATFORM** with decisions.md and STATE.md, then stop every lane and the builder (G824) | wildshard-new, then wildshard-v | the archive commit; herdr shows the lanes released |

Order: CO1 and CO2 now, in parallel; CO3 at 18:00; CO4–CO5 once CO2–CO3 land; CO7 last. CO6 only on Jake's pick.
