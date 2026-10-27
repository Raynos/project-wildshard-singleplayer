# Mega build: every lane builds, nothing waits (G768, G769)

**State:** `open` 2026-10-27, all questions answered (G770–G802, §6). Written ~01:30 Cancun by wildshard-v's
subagent from `.git/push.log`, the commit ledger and the live mini plans. Coordinator: wildshard-new. Switch-offs:
sp-ci-deploy alone (G802 replaced sp-x7). The MB rows are not counted in the plan %; they only unblock the counted rows.

Jake, 2026-10-27 ~01:00: *"Finish all the mini plans by tomorrow, whatever the fuck it takes. Mega build. Go fast
as fuck. And then deal with the damage later."*

## 1. Why it broke

- **The push gate refused almost everything.** Since 18:00: 72 working ticks, 51 red, 7 held by the red hold,
  2 split, only 12 pushed. 17 more ticks did nothing because the quiet lock paused them.
- **One rule caused most reds.** 40 of the 51 were `fast-lint` / `unverified-inputs`: the fail-closed rule (G752)
  refused whenever any peer had dirty input files in the shared tree. With 11 lanes in one tree, that is always.
- **The gate grew to its 180 s cap.** It ran a CI test subset locally (`ci-subset`); the last ticks took 179 s,
  and one died on a truncated JSON control record.
- **No push for 1 h 40 min** (23:03 → 00:43). Lanes waited for their commits to publish: sp-x8 75 min,
  sp-x1 56 min.
- **Codex fixed the gate instead of building.** 26 of 34 Codex commits 22:48–00:48 were gate plumbing
  (`fix(gates)`, `feat(gates)`, `fix(commit)`, `feat(ci)`), mostly sp-x2 and sp-x7. Not one counted row.
- **Lanes sat finished.** sp-o1, sp-o2 and sp-o3 had nothing assigned for 20–30 min. sp-o3 was also held by the
  quiet lock (an official Simulator reading) and by a row waiting on a pick.
- **Landing cost too much.** Opus lanes built all 24 products (G746), ran parity previews and related walks
  before each landing; pre-commit's related walk (CF1) runs up to 60 s, not 5.
- **Result:** ~0.19 counted rows per lane-hour. 157 of 257 rows (61 %). Main CI red since the 23:03 push
  (`test/boot-dist-transfer.test.ts`, `test/title-shell-graph.test.ts`), so the deploy is stuck too.

## 2. The rule until every mini plan is done

Land on types + lint of what you touched. The push gate is 45 s and lets everything through that it can't finish.
Pre-commit is 5 s (storage + typed lint of staged files, G772; GS4's table regen is the one exception, G798). Main
may be red and nothing stops a lane (G771). Nobody waits for a push, a check slot, a preview, a quiet window or a
pick. A generator row may build its own shard once (G773); Opus takes one Chromium capture after landing graphical
work (G797). Breakage goes on the damage list (§5) and is fixed after the plan, unless it stops lanes building.
Legacy deletion still waits for Jake's word: nobody touches LD5–LD8, A1 or A2.

## 3. Rows

Line numbers are at HEAD `4490895123`. Turn things off; don't rewrite them. Tests of deleted code go in the same
commit (`test/test_push_loop.py`, `scripts/test_sim_quiet.py`).

| Row | What | Owner | Done when |
|---|---|---|---|
| MB1 | **Push gate 45 s, fails open.** `scripts/push-loop.py:18` `PUSH_GATE_SECONDS = 180` → 45. `refuse_budget` (`:164-173`) and the `rc == 124` path (`:213-214`) stop refusing: an unfinished step is handed to CI and the batch pushes. Delete the split path (`:368-394`, `push-batch.json`, `scripts/push_batch.py`). A step that finishes and finds a real error still ejects the commit (`:215-220`). | sp-x7 | Every tick in `push.log` ≤ 50 s; no `budget` or `split` status |
| MB2 | **No `unverified-inputs` refusal.** `push-loop.py:205-211`: `DEFERRED TO CI` output becomes "hand to CI, carry on", not a red. The deferred-blob ledgers (`:37-56`, `push-deferred-*.json`) stop being read. | sp-x7 | No `unverified-inputs` in `push.log` |
| MB3 | **Delete the `ci-subset` step.** `push-loop.py:160-161` (step name) and `:230-240`; delete `scripts/push-ci-subset.mjs`, `push-subset-jobs.mjs`, `push-subset-mirror.mjs` (+ `.d.mts`), `push-deferred-ci.mjs`, `push_handoff.py` and the handoff upload (`:428-441`) with their tests. CI runs the tests. | sp-x7 | No `ci-subset` in `push.log`; files gone |
| MB4 | **No red hold.** Delete `push-loop.py:19-20`, `fix_prefix` (`:26-34`), the `held` / `main-red-no-fix` block (`:344-357`) and the red-prefix lines (`:362`, `:401-402`); delete `scripts/push_red_hold.py`. | sp-x7 | No `held` status while main is red |
| MB5 | **Quiet never pauses pushes or lanes.** Delete `push-loop.py:302-313` (the `quiet` early return). In `docs/process/MACHINE.md:370-373` the "read and edit only" pause applies to the Simulator only. No official quiet readings until the plan's last milestone (M2, T10, RM12 run once, at the end). | sp-x7 | No `quiet` ticks; no lane waits on `.git/quiet` |
| MB6 | **Pre-commit hard 5 s.** `scripts/precommit-inputs.mjs:114-131` and `:199-200`: the CF1 related walk (vitest + tsc, 60 s cap in `precommit-related.mjs:21`) is switched off. Anything past the 5 s deadline lands the commit (the defer path already exists). The commit lock in `scripts/commit.sh` stays (one shared index). | sp-x7, now sp-ci-deploy (G802) | `.git/commit-times.jsonl` work time (lock wait excluded) p90 ≤ 6 s; storage + typed lint of staged files stay (G772) |
| MB7 | **No waits before landing.** G746 (all affected test groups before landing) is suspended. No product builds, parity previews, related walks, soaks or Simulator readings before a landing (already in `lanes/common.md` rule 3). The check-slot pool and the heavy-lane `build` lease are not used to land; a generator row may build its own shard once as part of its work (G773). | sp-x7 (scripts), wildshard-new (brief) | No lane brief or script asks for a pre-land proof |
| MB8 | **Stop gate work.** No `fix(gates)` / `feat(gates)` / `fix(commit)` / `feat(ci)` commits except sp-x7's MB1–MB7 deletions. Uncommitted gate edits in the tree (`scripts/gate-related-tests.mjs`, `scripts/ci-bisect.py`, `test/test_push_loop.py` …) are dropped by their owner, not landed. sp-x2 returns to its rows. | wildshard-new | `git log` after MB7 shows no other gate commits |
| MB9 | **No lane waits or sits finished.** Commits stay local; the push loop publishes them, and no lane watches it. Each lane holds two assigned counted rows (now + next, §4). Finishing one, it starts the next in the same turn; with none left it takes the top unclaimed row of its type in `lanes/ready-queue.md` and says so in one line. The coordinator answers every report with the next row in the same turn. | wildshard-new, every lane | Hourly herdr sweep: no lane idle > 10 min |
| MB10 | **Rebalanced lanes.** Put §4 into `lanes/ready-queue.md`'s lane table, replacing the old lane plans. | wildshard-new | Table matches §4 |
| MB11 | **Row marks same hour.** A landed row is marked done in its plan within the hour (G767) so `plan_pct.py` moves. Night Market pilot and grid-crossing get real status cells (they show "carried"). | every lane; wildshard-new reads `plan_pct.py` hourly | Counter shows no "carried" plan |
| MB12 | **One damage list** (§5), only in [BURN-DAMAGE-LIST.md](../BURN-DAMAGE-LIST.md), never STATE.md (G800). | sp-ci-deploy adds (G802); wildshard-new trims | Every known break is on it with its first bad SHA |

## 4. Who builds what (after Jake's answers)

The live lane table is `lanes/ready-queue.md` (MB10); it, not this page, says what each lane holds now. What the
answers changed:

- **sp-ci-deploy** (G802; replaced sp-x7): main CI green and the hourly deploy only, no plan rows (G771). It fixes
  reds itself or asks the breaking lane, and fixes the two main reds (boot-dist-transfer, title-shell-graph) first so
  the hourly deploy resumes. It also finishes the
  MB1–MB7 switch-offs it inherited from sp-x7.
- **6 building Codex lanes** (G776): sp-x10 joined; JS heap, iPhone downloads and loading get the extra hands.
- **Tooling rows last** (G770): green-main GM1, ci-flow CF2–CF5, shared-waits SW3 / SW9 / SW13, build-speed's CI row
  (G789) and generators GS4 / GS5 stay counted and are built after every other counted row.
- **Parked, not built** (G774): Night Market pilot R1–R3 and remaster-open-plots RP2–RP4. After Jake plays Night
  Market, wildshard-v writes the plan for the other 18 plots with him.
- **Built as written** (no shrink): tile T2 with the rings / clientWorld migration, T5 with its Debug row (G775), T8
  on all seven shards, T10 the moment T8 lands (G790); the generators rewritten producer by producer, no wrap (G783);
  js-heap G1 heap guard first, exit-1 (G778); GS1–GS5 with GS4 (G798).
- **Shrunk or cut:** C2 dropped, C4 ratcheted (G781, core-memory archived); J7 spike dropped (G793); loading H3 is an
  order change (G794); I12 / J10.2b are build-time ceilings (G792); LD4 is a Node list compare, built now (G795);
  green-main GM2–GM7 closed (G787); gen speed, oxlint and no-binaries folded into the generators rows and archived
  (G796).
- **End of the plan:** one reading per plan (G780) and the official Simulator readings once each, RM12, T10, M2, I12
  (G777); then Jake's iPhone check (G558). Jake-only rows (LD5–LD8, A1, A2, M2, the T10 iPhone check, RM13) stay in
  the % (G779).

**Estimate.** The pick-blocked shrinks the old estimate assumed mostly went the other way (G783, G790, G775), so the
long poles grew: generators 4–5 days producer by producer (to about 10-31), tile T2 / T8 / T10 about 2.5–3 days (10-29
to 10-30), crossings until Nalati is under 5 s warm / 8 s cold (no date). Everything else is S / M work that clears in
about a day at the G768 pace. Parking RP2–RP4 and R1–R3 takes about 2 days of Opus work off the queue.

## 5. Damage list

Its only home is [BURN-DAMAGE-LIST.md](../BURN-DAMAGE-LIST.md) (G800), never STATE.md: every red CI test, failing
boot-smoke leg, stuck deploy, check MB1–MB7 switched off, flaky test, deferred reading and landed budget overrun, with
its first bad SHA, until it is fixed and marked. A break that stops lanes building (types fail on main, the app won't
build or boot) is not listed; whoever broke it fixes it at once (G674). Burning it down after SHARD-PLATFORM is that
plan's job.

## 6. Questions Jake answered (2026-10-27 ~01:50–02:20 Cancun)

| # | Question | Answer |
|---|---|---|
| Q1 | Move the ~25 tooling rows off the count? | **G770**: keep them counted, built last |
| Q2 | How red can main get before a lane must stop? | **G771**: nothing stops lanes; sp-ci-deploy fixes or routes reds |
| Q3 | Deploys frozen until the plan is done? | **G771**: no; sp-ci-deploy fixes the two reds now so the hourly deploy resumes |
| Q4 | What stays in pre-commit (5 s)? | **G772**: storage + typed lint of staged files; CF1 off (GS4 regen is the one exception, G798) |
| Q5 | Opus checks before landing graphical work? | **G797**: none before; one Chromium capture after landing |
| Q6 | Build the pick-blocked rows on the recommended option? | **G774** parks the open-plot rollout; **G775** builds T5 as written; C5 closed (G749 B) |
| Q7 | May a generator row build its own shard once? | **G773**: yes, one heavy-lane slot, its own shard only |
| Q8 | Does sp-x7 build counted rows after MB1–MB7? | **G771**: no; CI green + deploys only (now sp-ci-deploy, G802) |
| Q9 | More Codex lanes? | **G776**: +1 (6 building + sp-ci-deploy) |
| Q10 | Rows needing a Simulator or phone reading? | **G777**: done on a Chromium reading; official readings once at the end |
| Q11 | GR11 or GS1–GS5? | **G798**: GS1–GS5 as written, GS4 included; GR11 dropped; **G799**: no Vite plugins or virtual modules |
| Q12 | Heap guard last? | **G778**: first, as planned, exit-1 ratchet |
| Q13 | Legacy deletion: when? | **G779**: rows stay in the %; still only on Jake's word after his QA |
| Q14 | Boards as they land or in a morning batch? | **G779** / G766: morning batch |
