# Close-out spike: archive every SHARD-PLATFORM plan except legacy (G824, G834)

**State:** `open` 2026-10-28 ~14:30 Cancun. Verified and rewritten by a wildshard-v subagent from origin/main
`8c27fbd1b2` plus the three local commits waiting for the push loop (`ffad75f6e3` loading archive, `9132329eee` SW13
mark, `8ba18aced3` shared-waits reading). Coordinator: wildshard-new. Replaces the first draft (`5a13f1b083`).

Jake, 2026-10-28 ~13:48: *"I want you to come up with a new mini spike plan to get all the fucking plans closed and
archived except the ones blocking on me ... we can't delete the legacy yet. I don't know what else. You have to tell me
what else I'm blocking on."* Then G834: the legacy rows stay in SHARD-PLATFORM, so it archives only after legacy goes.

## 1. Where it stands

- **Rows: 190 / 209 = 91 % on origin/main; 192 / 209 = 92 % once the three local commits push** (loading 40 / 40,
  shared-waits 13 / 13). Counter: `python3 -I tmp/plan-pct/plan_pct.py . --rev origin/main` (denominator frozen at 209).
- **Effort: 1,004 / 1,132 lane-h = 89 %** (128 lane-h open; 50 of them are legacy LD5–LD8 + A1–A2).
- **Archived already:** green-main, ci-flow, js-payload, js-heap, night-market-remaster, generators (+ gen speed,
  oxlint, no-binaries, TS quick wins, core-memory, debug-rows, memory-strip, fail-fast, the zero plans); loading +
  loading-speed in `ffad75f6e3` (local, pushes on the next tick).
- **After CO2–CO4 the counter reads true at 194 done, 9 moved, 6 open of 209**; the 6 are LD5–LD8, A1, A2. The counter
  drops `folded into` rows from the total, so it will print 194 / 200 = 97 %; quote it as "194 + 9 moved of 209".

**Counter misreads to fix (wildshard-v, in `tmp/plan-pct/plan_pct.py`, not a repo file):**

| Misread | Why | Make it read true |
|---|---|---|
| SW13 open on origin/main | status read `done9872…` | fixed in `9132329eee`; reads 13 / 13 once pushed |
| build-speed 15 / 16 | `carry` mode: no row table, the 10-26 15:00 number forever | read its State `done` (G809) as 16 / 16 |
| grid-ready 9 / 10 | `n-of-m` reads SHARD-PLATFORM.md's cell `**9 of 10**`, not the plan | cell → `**10 of 10** (Nalati closed unreachable, G828)`; after SHARD-PLATFORM archives the cell is gone, so pin it |
| generators 16 / 17 | archived GR10 says `— folded (…)`; only `folded into` counts as a drop | let a bare `folded` drop (its archive says 16 / 16) |
| moved rows | `moved to X` matches nothing and stays open | mark them `folded into <plan> <row>` (AGENTS.md status word) |

**Shared tree, not ours to touch (list only):** `ffad75f6e3` / `9132329eee` / `8ba18aced3` are committed, not pushed.
Uncommitted: `BURN-DAMAGE-LIST.md` (working copy is −326 lines against HEAD: stale, committing it whole would delete
damage items), `tile-streaming-mini-plan.md` (+489 working, an old copy staged in the shared index), `iphone-downloads`
(I2 punctuation), `HOST-AUDIT.md`, `host-audit/custom-sections`, `project/archive/2026-10-27-js-heap.md` (staged).
Anyone landing those files patches from HEAD (`commit.sh --patch`), never the whole working copy.

## 2. Per plan

| Plan | Rows | Left | How it closes | Owner |
|---|---|---|---|---|
| loading + loading-speed | 40 / 40 | none | archived in `ffad75f6e3` (G831); just push | push loop |
| shared-waits | 13 / 13 | none | SW13 fixed `9132329eee`; archive | wildshard-new |
| iphone-downloads | 12 / 12 | none | State `finished` (G821); archive | wildshard-new |
| grid-crossing | 5 / 5 | none | State `superseded by G828`; archive | wildshard-new |
| grid-ready | 9 / 10 | Nalati | closed unreachable (G828) in the plan, not in SHARD-PLATFORM.md's cell; fix the cell, archive | wildshard-new |
| build-speed (CI) | 15 / 16 | none real | State `done` (G809); counter fix above; archive | wildshard-new |
| tile-streaming | 10 / 12 | T6½, T7, T10½ | T10 closes on G832 (iPhone passed; Sim 13 / 15 recorded as the reading). T6 / T7: lanes cut to 18:00, then each moves to BURN-DAMAGE-LIST with its numbers and its whole done-when; archive | sp-x8 (T7), sp-o3 (T6.2); wildshard-new moves |
| night-market-pilot | 12 / 15 | R1–R3 | Jake's check passed (G827). R1 → OPEN-PLOTS OP7–OP9, OP13, OP21 (the five new ideas); R2 → OP5–OP22; R3 → OP24; archive | wildshard-new |
| remaster-open-plots | 1 / 4 | RP2–RP4 | RP2 → OP5–OP22; RP3 → the cell swaps in OP7–OP21; RP4 → OP24; archive | wildshard-new |
| open-plots (hologram) | P1–P8 done | none | not counted; archive | wildshard-new |
| mega-build + finish-line | process | none | rules live in G768–G805; archive both | wildshard-new |
| legacy-deletion | 4 / 8 | LD5–LD8 | **Jake's word** after the CO6 boards; LD4's six open gap rows (LD4-DW…SD) go on those boards | Codex lanes |
| custom-code-freeze | 11 / 13 | A1, A2 | after LD8; no extra Jake input | Codex lanes |
| close-out (this) + qa-fixes | rows below | CO1–CO8 | archive with SHARD-PLATFORM (CO8) | wildshard-new |

OPEN-PLOTS already holds the replacement rows (OP1–OP24), so the moves copy nothing: each source row gets
`folded into OPEN-PLOTS OPx` and keeps its done-when beside it.

## 3. What waits on Jake

1. **LEGACY vs SHARDFILE** (blocks SHARD-PLATFORM's archive). Skim six labelled sheets (4 cameras × LEGACY · SHARDFILE
   per shard, plus LD4's list gaps) and say "delete legacy now", or name a shard that must wait. **~10–15 min**, once
   CO6 lands (~18:00 today). His word starts LD5–LD8, then A1–A2 (~12–20 h of lane time, mostly in a chain).
2. **Opus capacity** (blocks CO1's render fixes, not the archive). At 13:50 openusage read the active Claude account
   at **99 % weekly** and the other at **100 %** (18 min stale). G836 burns to 100 % and then switches, but both accounts
   look spent. Jake: say when an account resets, or let Codex take the water / blurred-top / pier / reveal fixes.
   **~1 min.**
3. **Open picks, none blocking the archive** (one question batch, ≤ 4, option 1 "Skip for now"):
   - **D185** Pine phone PBR model textures (three texture copies per GLB): board by wildshard-v. ~2 min.
   - **Night Market figures (G755 redo)**: `art/grid/round-71-night-market-figures-g755/board.jpg`, waiting since
     10-26; figures stay off until he picks. ~1 min.
   - **D179 / D181 / D183** (Nine spawn view, Pine crossing shaders, Sky warm return) are made moot by G821 and G828:
     the coordinator marks them `superseded by G821 / G828` and Jake is not asked.
4. **Start the parked plans, on his word, after the archive:** OPEN-PLOTS (G829 answered scope, style, play and the
   lantern count; **Q3 budget, Q5 repeat cells and Q7 lanes are still open**, ~2 min) and BURN-DAMAGE-LIST (its Q1–Q5:
   which switched-off checks come back, dormant gate code, the quarantine job, the Vite cut, burn first; ~3 min).
5. **The next mega plan** (one world, fast crossings, the deeper loading fixes) is his to write after a retro
   (G828, G831). Nobody drafts it.

Not his: phone checks of CO1 (his playtests are the check), the ask receipts (E461, E500, E503, E504 close with their
plans; CO4), and every row in §2 above legacy.

## 4. Rows

| Row | What | Owner | Done when |
|---|---|---|---|
| CO1 | **Ship the QA fix release** found in Jake's 10-28 phone QA: service-worker stall limits (G830: page reload, stylesheet, `shard.json`, map code), the loading screen painted on tap, the update screen's reload step animated, steps under 500 ms grouped, the hold toggle on the loading screen, the water regression, the blurred top, the minimap tile labels off, the pier and far stand-ins, reveal after the spawn shaders link, the Props 23.7 s check. Rows: [qa-fixes-2026-10-28](qa-fixes-2026-10-28-mini-plan.md) | two Codex lanes + Opus after the account switch; sp-ci-deploy releases | one immediate deploy; Chromium + WebKit iPhone runs load Driftwood without a hang; build id to Jake |
| CO2 | **Marks**: tile T10 `closed (G832)` with the 13 / 15 reading; grid-ready's SHARD-PLATFORM.md cell → `**10 of 10**` (Nalati closed, G828); build-speed counted 16 / 16; D179 / D181 / D183 `superseded by G821 / G828` | wildshard-new; wildshard-v for the counter | `plan_pct.py --rev origin/main` reads tile 10.5 / 12 (T6, T7 open until CO3), grid-ready 10 / 10, build-speed 16 / 16 |
| CO3 | **Moves**: R1–R3 and RP2–RP4 `folded into OPEN-PLOTS OPx` (now); at 18:00, T6 and T7 to BURN-DAMAGE-LIST as named items with their numbers and their whole done-when, and G832's pop-in + far-content item with his screenshots. Patch BURN-DAMAGE-LIST from HEAD | wildshard-new | no row lost; each source row names where it went; the damage list grew by 3 items, lost none |
| CO4 | **Archive** every plan in §2 above legacy to `project/archive/2026-10-28-<name>.md`, links fixed in SHARD-PLATFORM.md, the asks done (E461, E500, E503, E504) | wildshard-new | only legacy-deletion, custom-code-freeze, close-out and qa-fixes stay live in `docs/plans/shard-platform/` |
| CO5 | **Counter fixes** in `tmp/plan-pct/plan_pct.py` (§1 table) | wildshard-v | one run reads 194 done, 9 moved, 6 open of 209 |
| CO6 | **done — LEGACY vs SHARDFILE boards** (G834): every shard entered both ways from the same 4 cameras, phone portrait, labelled, one sheet per shard, plus LD4's Node list gaps (Nine registrations and POIs, Far Reach POIs, the conditional Sets) | sp-x9; [six inspected sheets](../../../art/legacy-vs-shardfile/round-1-2026-10-28/README.md), 48 captures, 0 errors | batch ready in STATE for Jake; Sky visual gap and LD4 gaps retained; deletion still needs his word |
| CO7 | **Delete legacy** on Jake's word: LD5 → LD6 in three pairs (each with its LD7 share) → LD8 → A1 → A2 | 2–3 Codex lanes | the rows' own done-whens; boot smoke green after A1 |
| CO8 | **Archive SHARD-PLATFORM** with decisions.md, STATE.md, this page and qa-fixes, then stop every lane and the builder (G824) | wildshard-new, then wildshard-v | the archive commit; herdr shows the lanes released |

Order: CO1, CO2, CO5 and CO6 now, in parallel; CO3's plot moves now and its tile moves at 18:00; CO4 once CO2–CO3
land; CO7 on Jake's word; CO8 last. (The draft's CO5, legacy as its own plan, is dropped by G834.)

## 5. Finish times (Cancun)

- **Everything archived except SHARD-PLATFORM: today ~19:30.** CO2 / CO5 take under an hour; the tile moves wait for
  18:00; one archive commit set after. The two live pages left with SHARD-PLATFORM are legacy-deletion and
  custom-code-freeze (plus this page and qa-fixes). CO1's release is separate: tonight if Opus has capacity, else when
  an account resets (§3.2).
- **SHARD-PLATFORM archived: Thursday 10-29 ~16:00–22:00**, if Jake gives his word on the CO6 boards tonight (~18:00–
  20:00). LD5–LD8 + A1–A2 are ~50 lane-h estimated but a chain (LD6's three pairs each need green gates; A1 needs a
  boot smoke and a walk per shard), so ~12–20 h of wall time. Every hour his word slips moves this one hour.
