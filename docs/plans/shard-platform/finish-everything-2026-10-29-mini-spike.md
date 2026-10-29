# Finish everything by 14:00: SHARD-PLATFORM and every attached mini plan (G872, G824, G845)

**State:** `open` 2026-10-29 ~10:05 Cancun. Spike by a wildshard-v subagent for the builder (coordinator `wildshard-new`:
Opus sp-o3 / sp-o4 / sp-o5, Codex sp-x1 / x2 / x6 / x9 / x10, sp-ci-deploy). Read at HEAD `542dbf5819`. Archives with
SHARD-PLATFORM (CO8). Jake, 10-29: every lane sat idle 04:15–10:00 on "standby, left for Jake" while counted rows were
open. He wants SHARD-PLATFORM done **today, by ~14:00 Cancun**, so he can start the repo-size / git-history plan:
*"If it's good enough, it's good enough. I just want it to be done."*

## 0. Rule one: the builder is autonomous (G872)

**The builder never waits for Jake, for a pick, or for anything else.** Where a row needs a pick, it takes the recommended
answer in §3, lands it, and logs it in STATE.md under **"Autonomous decisions (for Jake's review)"** (row, choice, why,
SHA). Jake reviews those later with wildshard-v; an overturned one becomes a new row. "Standby", "left for Jake" and
"PICK pending" are banned words. The only thing that waits is an action the rules reserve to Jake's own word, and today
G871 already gives that word for the legacy deletion (§3, L2 is the one exception, and it has a default too).

## 1. Where it stands (verified against git log, HEAD `542dbf5819`)

| Plan | Open on paper | True state |
|---|---|---|
| nine-regressions 10-28 | none | **14 / 14 done** (NR16 `2f92beda2c`). Archive now. |
| far-reach-regressions 10-28 | FR5 | **FR5 landed `cdeb31eabb`** (rays from the painted sun, G869); FR6 kept (G870). Mark and archive. |
| qa-fixes 10-28 | QF1, QF10, QF17.B2, QF20 | QF16 done `9bd28aed2e` (marked); QF20 / 23 / 24 are tone gaps moved to D205 / D203 / D206 (G868): marks only. QF1, QF10, B2 are real. |
| phone-loading 10-28 | PL2, PL5, PL15 | PL2 / PL5 landed partial `374710f132` (marked `542dbf5819`); PL15 decided A (STATE, x2 deleting B). Plus the **new 10-29 finding** (§2 PL17–PL19). |
| legacy-deletion | LD5–LD10 | Gated only by G871 (a clean 144-camera rerun on Nine / Pine). x9 has the chain prepared. LD4's six coverage-gap rows are uncounted. |
| close-out | CO1–CO5, CO7, CO8 | CO6 done. CO2: grid-ready cell still reads `9 of 10`. CO3 / CO4: the 12 archives landed; asks E461 / E500 / E503 / E504 still `in flight`. CO5 is the counter. CO7 = LD5–LD10. CO8 = the archive. |
| build-speed | none | Archived (`project/archive/2026-10-28-build-speed.md`); the counter's `carry` mode only. |
| tooling-perf/lint-speed | LS2–LS7 | All source landed (LS1, LS8, LS9 done); LS2–LS5 miss their timing bars, LS6 / LS7 landed partial. Accept and archive. (The shared working copy of this file is a stale older copy: patch from HEAD.) |

**Today's phone-loading run on live `a8a440cfa`** (`tmp/phone-loading/2026-10-29T14-54-57-207Z-a8a440cfa-mvtfufto/`):
cold **55.7 s**, warm **39.8 s** (the compare flags warm +44.5 %, Home +2.62 s). Step **"Spawn program links" waits
13.06 s cold and 13.42 s warm**: `SPAWN_LINK_MS = 12000` in `src/game/session/settlePrograms.ts` (`3337f2894e`,
`a896209120`) is paid in full on every throttled entry (PL1 already saw 13.25 / 13.13 s on 10-28). Without it cold is
~42.6 s, warm ~26.4 s. The script also logs **217 "Request accounting: Invalid native request sizes"** errors:
`scripts/phone-loading/network.ts:47` throws on a negative or missing `responseHeadersSize` (blob:, worker-served,
cached), so `requestAccounting.complete` is false on every run.

## 2. Output 1: the 4-hour schedule

Hours (Cancun): **H1 10:15–11:15 · H2 11:15–12:15 · H3 12:15–13:15 · H4 13:15–14:00.** Cut-offs: look / bug rows
**12:15**; LD9 / LD10 **13:30**; the CO8 archive commit **13:45**; every lane stopped **14:00**.

### Rows (order inside each lane is top to bottom)

| Row | What | Lane | Size | Done when | If it misses its cut-off |
|---|---|---|---|---|---|
| **PL17** (new, top) | Spawn links stop paying the 12 s budget: cap the spawn-view link wait at 3 s (L-P1); the in-play warm-up links the rest (G815) | **done** `6e205ffcfa` + `fb6f43a80e` (sp-o5): 2 s presented (~2.9 s wall at 10x); phone preset spawn 3.43 / 3.04 s cold / warm (live 13.1 / 13.4), WebKit 1.27 / 1.61 s, no WebKit gap > 1 s | S | `pnpm phone-loading --preset phone --flow grid` on a `--head` preview: "Spawn program links" ≤ 3.5 s cold and warm; WebKit unthrottled settle unchanged; no frame gap > 1 s in the first 4 s of play on WebKit | 12:15: land whatever cap measured best, log it |
| **PL18** (new, top) | Request accounting counts a missing / negative native size as `unknown`, never an error | sp-x1 | XS | the same flow logs 0 `request.sizes` errors; unknown sizes are counted by reason in the JSON | accept, BURN row |
| **PL19** (new) | Re-run the flow after PL17 and PL15 land, Chromium cold / warm + `--webkit`; update the plan's table | sp-x1 | S | one numbers line in phone-loading; any step still ≥ 1 s slower than 10-28 is a dated BURN row (L-P5) | accept the last reading |
| **G871 rerun** | Fresh 144-camera golden rerun (`art/legacy-goldens/compare/capture.mjs`) on HEAD; verdict by G868: tone gaps match, missing geometry on Nine / Pine gates | sp-o5 | M | board + verdict line in STATE and the commit by **11:15** | if a gap: §2 "if the rerun is not clean" |
| LD5 | Remove the LEGACY button, Debug row, legacy entry mode (developer UI: Opus, G848) | sp-o3 | S | SHARD SELECT shows one ENTER WORLD; tag `legacy-final` exists first | must land |
| LD6 + LD7 | Delete the folders in three pair commits (Sky + Signal, Driftwood + Pine, Nalati + Nine), each with its legacy-only engine / game code | sp-x9 | M | gates green per commit; nothing left whose only importer was legacy | must land |
| LD8 | Retire `legacy-shards.json` / `.mjs`, `LEGACY_SHARDS`, the exemptions and synthetic tests | sp-x2 | S | `git grep legacy-shards` finds nothing | must land |
| LD9 | One client-plan boot (`ShardPlugin`, hybrid plumbing; ~700 lines), prepared from H2, lands after LD8 | sp-x10 | L | no `ShardPlugin` subclass outside the game; boot smoke + physics walk 0 stuck (L-L4) | 13:30: dated BURN row (L-L3) |
| LD10 | Second-wave orphan sweep and ENGINE.md sections, prepared from H3, lands after LD9 | sp-x6 | M | the graph lists no orphan except kept tools | 13:30: dated BURN row |
| G859 goldens | The clean rerun's 24 board-camera SHARDFILE frames committed as `art/shardfile-goldens/` (JPEG ≤ 250 KB each) | sp-o5 | S | 24 labelled frames committed with the source SHA (L-L5) | skip, log |
| Spot check | After LD6's last pair: camera 1 of each shard on HEAD vs the rerun shows no change | sp-o5 | S | one labelled 6-panel sheet, 0 page errors | accept |
| QF10 | Blurred top band after the reveal: find and remove the overlay | sp-o4 | 3 h | sharp first frame after reveal, both engines, labelled crops | 12:15: dated BURN row with the crops (L-Q2) |
| CO1 check | The release build loads Driftwood from the title without a hang, Chromium + WebKit iPhone, cold and warm | sp-o4 | S | one reading in the commit; build id in STATE | accept the CI boot smoke |
| PL15 | A main thread; delete the worker path and its Debug row (decided, STATE) | sp-x2 | S | row and worker module gone (`git grep`); focused tests pass | must land (it is a deletion) |
| PL2 / PL5 | Close as accepted partial: status cell starts `done (accepted partial, G872)` so the counter reads it | sp-x10 | XS | counter shows phone-loading 16 / 16 once PL15 and PL17–19 land | — |
| LS2–LS7 | Close as accepted partials with their measured numbers; archive lint-speed (patch from HEAD) | sp-x10 | XS | `project/archive/2026-10-29-lint-speed.md`; TOOLING-PERF links it | — |
| QF17.B2 | Close at 26 / 22 section-pack GETs (from 140) as an accepted miss, like G856 | sp-x6 | XS | status `done (accepted miss, G872)` | — |
| QF1 | One 10-run freeze repro on HEAD (`tmp/loading-freeze/`), both engines (L-Q1) | sp-x6 | S | 0 stalls of 10 each → `done`; any stall → `superseded by QF2.T1–T8 + B5`, stall reading in a dated BURN row | 12:15: the superseded mark |
| tag | `legacy-final` on the last commit with legacy, via the API, before LD5 | sp-ci-deploy | XS | the tag on origin | must land |
| CO1 release | `gh workflow run deploy` at ~12:15 on the newest green main (FR5, PL17, PL15, QF10 if landed); WHAT'S NEW refreshed | sp-ci-deploy | S | live build id in STATE | the hourly deploy carries it |
| push / reds | Push loop through the LD chain; fix-forward reds to their owner in 15 min | sp-ci-deploy | — | origin/main == the CO8 archive SHA at 13:50 | — |
| Marks (one commit) | QF16, QF20 → `folded into BURN-DAMAGE-LIST D205`, QF23 / QF24 → D203 / D206, FR5 `done cdeb31eabb`; archive Nine + Far Reach plans; CO2 cell `**10 of 10** (Nalati closed unreachable, G828)`; D179 / D181 `superseded by G821 / G828`; CO3 verified; CO4 asks closed; CO5 by status words (L-C1) | wildshard-new | S | counter at HEAD lists only rows in flight | — |
| CO8 | Archive SHARD-PLATFORM: SHARD-PLATFORM.md, everything in `docs/plans/shard-platform/` (decisions, STATE, close-out, qa-fixes, phone-loading, legacy-deletion, this spike, rows, lanes, reviews) to `project/archive/2026-10-29-shard-platform*`; live links fixed | wildshard-new | M | one commit by 13:45; then every lane and the coordinator stop (G845) | none: it ships at 13:45 with whatever is moved |

**Count:** 26 rows. Opus 7 (o3: PL17, LD5 · o4: QF10, CO1 check · o5: rerun, goldens, spot check). Codex 12 (x1: PL18,
PL19 · x2: PL15, LD8 · x6: QF17.B2, QF1, LD10 · x9: LD6 + LD7 · x10: PL2 / PL5, LS2–LS7, LD9). CI 3. Coordinator 2 (+ the
STATE log).

### Who does what, hour by hour

| Lane | H1 10:15–11:15 | H2 11:15–12:15 | H3 12:15–13:15 | H4 13:15–14:00 |
|---|---|---|---|---|
| sp-o3 | PL17 (cap, measure, land) | LD5 the moment the tag exists | help QF10 or gap fixes (§ below) | own tmp, stop |
| sp-o4 | QF10 | QF10 (cut-off 12:15) | CO1 check on the release build | own tmp, stop |
| sp-o5 | G871 rerun + verdict by 11:15 | G859 goldens; gap fix if any | spot check after LD6 pair 3 | own tmp, stop |
| sp-x1 | PL18 | PL19 baseline as PL17 lands | PL19 final run, numbers | own tmp, stop |
| sp-x2 | PL15 deletion | LD8 prepared | LD8 lands after pair 3 | land / delete own edits, stop |
| sp-x6 | QF17.B2 mark, QF1 repro | QF1 mark; LD10 prepared | LD10 prepared on LD9's tree | LD10 lands by 13:30 or BURN |
| sp-x9 | LD6 / LD7 chain final prep | pair 1 + 2 land | pair 3 lands | red fixes, stop |
| sp-x10 | PL2 / PL5 marks, lint-speed archive | LD9 prepared | LD9 lands after LD8 | by 13:30 or BURN; stop |
| sp-ci-deploy | push loop; tag at go | CO1 release ~12:15 | push the chain | push CO8; confirm origin/main; stop |
| wildshard-new | the marks commit; STATE rewritten (no "Jake's word" lines) | log decisions | BURN moves for missed rows | CO8 at 13:45; stop |

**If the rerun is not clean (missing geometry on Nine or Pine):** sp-o5 names each gap in STATE at 11:15; sp-o3 and
sp-o4 each take one (Opus, G848) and fix it by 12:30. The Codex lanes keep preparing LD6–LD10 meanwhile (never paused).
If a gap is still open at 12:30, LD5–LD10 do not land (that is Jake's reserved word, L-L2): they move to
BURN-DAMAGE-LIST as one dated item, and CO8 still ships at 13:45.

### Operating rules (so no lane idles again)

1. **A lane whose queue empties takes the next row in its column, then any row above still open in another lane's
   column it can do (Codex never a visual one).** With none left, it verifies another lane's done-when on the shared HEAD
   preview, or cleans its own `./tmp` and stops at 14:00. It never reports "standby".
2. **A pick it thinks it needs:** take §3's recommended answer, land, log in STATE's "Autonomous decisions" (row, choice,
   why, SHA). Never ask, never wait (G872). A pick not in §3 gets the option that closes the row soonest and changes
   the least the player sees.
3. **Marks the same hour:** the commit that lands a row also writes its plan cell, status word first (`done <SHA>`,
   `done (accepted partial, G872)`, `folded into BURN-DAMAGE-LIST D2xx`), so `open_rows.py --rev HEAD` reads it.
4. **Archive in the same commit as the last row:** Nine and Far Reach in the marks commit; lint-speed with LS2–LS7;
   everything else in CO8.
5. **A missed cut-off is not a wait:** the row moves to BURN-DAMAGE-LIST as a dated item (D208 on, 2026-10-29, its
   numbers and its done-when copied whole, patched from HEAD) and the plan cell says `folded into BURN-DAMAGE-LIST D2xx`.
6. Rules that still hold: no reverts (G674), no new Debug rows (G669), no new automation (G585), Opus-only visuals
   (G848), three Opus lanes (usage ~28 %, G853), `commit.sh` only, never herdr wildshard-v, lanes never wait on a push.

### End state and the stop

13:30 the last row has landed or moved · 13:45 the CO8 archive commit · `scripts/push-main.sh` · each lane lands or
deletes its own uncommitted edits, deletes its own `./tmp/<lane>*` dirs by exact path (MT2), stops its previews with
`serve-build.sh stop <port>`, then stops · 14:00 herdr shows every lane released; the coordinator stops last (G845)
until Jake's retro.

## 3. Output 2: the questions (one decision each; the builder takes the recommendation if Jake skips, G872)

Only **L2** is reserved to Jake's own word; G871 already gives it for a clean rerun. **X1–X4** start parked plans, which
also needs his word; their default is "not sent", and none blocks 14:00. Everything else is a logged autonomous decision.

**Legacy deletion**

| # | Closes | Question | Recommended | Alternatives | If skipped |
|---|---|---|---|---|---|
| L1 | LD5–LD10 (start) | Can the builder run G871's 144-camera rerun itself and judge it by G868, instead of waiting for wildshard-v's board? | Yes | wait for wildshard-v | sp-o5 runs it at 10:15; whichever board lands first counts |
| L2 | LD5–LD10 | If Nine or Pine still misses geometry at 12:30, delete legacy anyway, gaps as dated BURN rows? | Yes (goldens + `legacy-final` keep the record, G852) | keep legacy until fixed | **reserved:** no deletion; LD5–LD10 become one dated BURN item; CO8 ships |
| L3 | LD9, LD10 | Not landed by 13:30: move to BURN-DAMAGE-LIST as dated rows? | Yes (no player effect) | hold the archive ~4–8 h | moved |
| L4 | LD9 | Done-when "one Chromium walk per shard" read as boot smoke + `physics-baseline --mode=walk` 0 stuck? | Yes | six hand walks | yes |
| L5 | G859 | Is this wave good: the clean rerun's 24 SHARDFILE frames become `art/shardfile-goldens/` today? | Yes | keep LEGACY goldens as the reference | committed, logged |
| L6 | LD4-DW…SD | Close LD4's six Node coverage gaps as accepted (CO6 sheets + the rerun are the parity evidence)? | Yes | build native-registration capture (~1 d) | closed |

**Phone loading**

| # | Closes | Question | Recommended | Alternatives | If skipped |
|---|---|---|---|---|---|
| P1 | PL17 | Spawn-link wait: cap at 3 s and link the rest in play? | 3 s cap | keep 12 s (a throttle artefact); end on 500 ms with no new link | 3 s |
| P2 | PL18 | Count native requests with no size as `unknown`, not an error? | Yes | drop request accounting | yes |
| P3 | PL2 | Accept: cold Home −5.5 s met, read-wait 1.94 s vs ≤ 1 s, Sim unmeasured? | Accept | another pass (~0.5 d) | accepted |
| P4 | PL5 | Accept: warm Home −0.1 s on the fresh pin vs −2 s, Sim unmeasured? | Accept | another pass (~0.5 d) | accepted |
| P5 | PL19 | Steps still ≥ 1 s slower than 10-28 after PL17 (warm Home +2.6 s): dated BURN rows, not fixed today? | Yes | fix today | BURN rows |
| P6 | PL rows | Chromium 10x + WebKit unthrottled readings are the done reading; no Simulator runs today? | Yes | Sim pair per row (+1–2 h) | yes |

**QA fixes and close-out**

| # | Closes | Question | Recommended | Alternatives | If skipped |
|---|---|---|---|---|---|
| Q1 | QF1 | One 10-run repro: 0 stalls → done; any stall → superseded by QF2.T1–T8 + B5, reading to BURN? | Yes | build the per-attempt stall limit (0.5 d) | yes |
| Q2 | QF10 | Blurred top not found by 12:15: dated BURN row with the crops? | Yes | hold the archive | BURN row |
| Q3 | QF17.B2 | Accept 26 / 22 section-pack GETs (from 140, target ~10), like G856? | Accept | cut the far-metadata reads (~0.5 d) | accepted |
| Q4 | QF20, QF23, QF24 | Mark folded into D205 / D203 / D206 (G868)? | Yes | — | marked |
| Q5 | CO1 | One release at ~12:15 (FR5, PL17, PL15, QF10 if in), the archive rides the hourly deploy? | Yes | one release after CO8 only | yes |
| C1 | CO5 | The counter reads true from fixed status words; nobody edits wildshard-v's `tmp/plan-pct` script? | Yes | the builder edits the script | yes |
| C2 | CO4 | Close asks E461, E500, E503, E504 as done (their plans are archived)? | Yes | — | closed |
| C3 | CO8 | Archive every file under `docs/plans/shard-platform/` with SHARD-PLATFORM, live links fixed? | Yes | keep contracts / design-system live in `docs/` | archived |
| C4 | CO8 | At the stop each lane lands or deletes its own uncommitted edits, so the tree is clean for the history work? | Yes | leave the tree as is | yes |

**Nine, Far Reach, lint-speed**

| # | Closes | Question | Recommended | Alternatives | If skipped |
|---|---|---|---|---|---|
| N1 | Nine plan | Accept the residuals (NR7 view-F sway, NR8 A-down tassel, NR14 root ink strokes, NR16 B-back tile tone) and archive? | Accept | dated BURN rows | accepted |
| F1 | FR5 | Done on its round-43 board (standalone fixed, grid unchanged), no new grid board? | Yes | a new two-engine board (~1 h Opus) | yes |
| T1 | LS2–LS7 | Accept the measured partials (fast lint 4.38 s vs 2.5–4; typed 18.7 s vs 17; cold types 9.28 s vs 8) and archive lint-speed? | Accept | keep it live under TOOLING-PERF | archived |

**Codex proposal leftovers** (`tmp/codex-work-top10-2026-10-28.md`; the top 10 are done per STATE except MT2, which
becomes each lane's stop step)

| # | Item | Question | Recommended | Alternatives | If skipped |
|---|---|---|---|---|---|
| X1 | TP5 | Speed up the five slowest test files today? | No: after the retro (parked TOOLING-PERF) | send now | not sent |
| X2 | MT1 | Move 35 scripts' `os.tmpdir()` into `./tmp` today? | No: after the retro | send now | not sent |
| X3 | DA1 | Stop deploying hidden source maps (~19 MiB a deploy) today? | No: after the retro (no deploy change during the archive) | send now | not sent |
| X4 | PF1 | Cut idle JS allocation on Template and Blender (D107)? | No: after the retro | send now | not sent |

**Already decided by the builder (for review with wildshard-v):** D183 = B (tiles win) · D185 = keep UASTC, drop the
astc6 copies · PL15 = A, worker path and row deleted · PL16 row kept default off · D53 CLIs kept as debt · Pine pond
keeps SHARDFILE · G99 isles kept · Pine drive (D12 14 / 15) accepted by G815.

## 4. Then: the repo-size / git-history plan

It is [REPO-WEIGHT](../REPO-WEIGHT.md) (E436): guards built (RW1, RW7, RW8); the classification, store, downsizer, bulk
upload and move (RW2–RW6) change no history; the rewrite (RW9–RW12, `git filter-repo`, force-push, every checkout
re-cloned) runs only on Jake's go (his Q3 answer was "yes, once", after the move; Q4 refs and Q5 are still open). This
spike does not change it. **Before a rewrite can start, SHARD-PLATFORM must leave:**

1. The CO8 archive commit on `origin/main`, with nothing committed locally and unpushed.
2. Every lane and the coordinator stopped (G845), no browser, preview, Simulator or model lock held, no lane process alive.
3. A clean shared tree: today ~45 tracked files carry uncommitted edits (`src/format/*`, `src/sdk/*`, `lint/*`, stale
   copies of `project/archive/*`) plus untracked baked GLBs; their owners land or delete them (C4). A re-clone loses them.
4. No refs, branches, worktrees or stashes made by this plan; `legacy-final` is the one new tag (RW10 decides refs).
5. `./tmp` is not in git: copy anything still wanted (the plan counter `tmp/plan-pct/`, today's phone-loading JSON)
   before a re-clone; everything else is deleted by its owner at the stop.
