# Mega build: every lane builds, nothing waits (G768, G769)

**State:** `open` 2026-10-27 ~01:30 Cancun. Written by wildshard-v's subagent from `.git/push.log`, the commit
ledger and the live mini plans. Coordinator: wildshard-new. Switch-offs: sp-x7 alone. The MB rows are not counted
in the plan %; they only unblock the counted rows. Picks for Jake are in §7.

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
Pre-commit is 5 s. Main may be red. Nobody waits for a push, a check slot, a preview, a quiet window or a pick.
Breakage goes on the damage list (§5) and is fixed after the plan, unless it stops lanes building.
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
| MB6 | **Pre-commit hard 5 s.** `scripts/precommit-inputs.mjs:114-131` and `:199-200`: the CF1 related walk (vitest + tsc, 60 s cap in `precommit-related.mjs:21`) is switched off. Anything past the 5 s deadline lands the commit (the defer path already exists). The commit lock in `scripts/commit.sh` stays (one shared index). | sp-x7 | `.git/commit-times.jsonl` work time (lock wait excluded) p90 ≤ 6 s |
| MB7 | **No waits before landing.** G746 (all affected test groups before landing) is suspended. No product builds, parity previews, related walks, soaks or Simulator readings before a landing (already in `lanes/common.md` rule 3). The check-slot pool and the heavy-lane `build` lease are not used to land; a generator row may build its own shard once as part of its work (Q7). | sp-x7 (scripts), wildshard-new (brief) | No lane brief or script asks for a pre-land proof |
| MB8 | **Stop gate work.** No `fix(gates)` / `feat(gates)` / `fix(commit)` / `feat(ci)` commits except sp-x7's MB1–MB7 deletions. Uncommitted gate edits in the tree (`scripts/gate-related-tests.mjs`, `scripts/ci-bisect.py`, `test/test_push_loop.py` …) are dropped by their owner, not landed. sp-x2 returns to its rows. | wildshard-new | `git log` after MB7 shows no other gate commits |
| MB9 | **No lane waits or sits finished.** Commits stay local; the push loop publishes them, and no lane watches it. Each lane holds two assigned counted rows (now + next, §4). Finishing one, it starts the next in the same turn; with none left it takes the top unclaimed row of its type in `lanes/ready-queue.md` and says so in one line. The coordinator answers every report with the next row in the same turn. | wildshard-new, every lane | Hourly herdr sweep: no lane idle > 10 min |
| MB10 | **Rebalanced lanes.** Put §4 into `lanes/ready-queue.md`'s lane table, replacing the old lane plans. | wildshard-new | Table matches §4 |
| MB11 | **Row marks same hour.** A landed row is marked done in its plan within the hour (G767) so `plan_pct.py` moves. Night Market pilot and grid-crossing get real status cells (they show "carried"). | every lane; wildshard-new reads `plan_pct.py` hourly | Counter shows no "carried" plan |
| MB12 | **One damage list** (§5), kept in STATE.md. | sp-x7 adds; wildshard-new trims | Every known break is on it with its first bad SHA |

## 4. Who builds what

Opus = graphical, Codex = not graphical. Rows in order; the first is "now". Open counted rows today: ~100. Of
those, ~25 are tooling rows that §7 Q1 moves after the plan, and 7 wait on Jake's legacy word (LD4 runs at
the end; LD5–LD8, A1, A2 wait). That leaves ~68 rows for 10 building lanes plus sp-x7 (Q8).

| Lane | Rows, in order | Plans |
|---|---|---|
| sp-o1 | GR8 Pine generators (claimed 00:53) → GR7 Driftwood → T11 far landmarks in the coarse ring | generators, tiles |
| sp-o2 | RM5 trim sheets → RM11 near view + far proxy → RM9 gate landmark → RM14 shared kit → R1/RP3 five new ideas (rows + cells) → RP2 per idea → R3/RP4 delete hologram | NM remaster, NM pilot, open plots |
| sp-o3 | L18/I1 tier filter (finish) → Nalati grid-ready (last of 10) → I4 phone textures (G738 picked) → I3 quantised meshopt → C5 composer diet | loading, grid-ready, iPhone, core memory |
| sp-o4 | S1 shared programs + parallel compile → grid-crossing T1 render side (keep and pre-build programs) → H10 boot shader text → H1 per-draw program changes → J7 node-material spike | loading, crossing, JS heap, JS payload |
| sp-o5 | T3 graphical ranges → T7 crossings by tiles (render half) → G1 loading glitch frame → T5 Developer overlay → RM12 per-dome fixes → H3 spawn-critical home first | tiles, loading, NM remaster |
| sp-x1 | GR5 Far Reach (37 jobs left) → GR3 close-out mark → GR9 small shards + shared bakes → GR10 runtime reads sections → GR11 app tables to virtual modules | generators |
| sp-x6 | GR6 Nalati (38 jobs left) → B5 Nalati/Pine/DW binaries → B4 Nine binaries → GR12 delete `generate.mjs` → TS T1 generated JSON out → oxlint R4 → TS T4 (from sp-x8) | generators, no-binaries, TS, oxlint |
| sp-x2 | C4 template holder → C3 title diet → C6 estimator → I5 packs (finish) → I8 page assets → T8 every shard on tiles → H6 release decoded transport → H3 checkpoint on change | core memory, iPhone, tiles, JS heap |
| sp-x8 | grid-crossing T1 / G743 scheduling → T2 tile residency host → T6 creatures by tile → T7 Codex half → G1 heap guard → H2 → H4 → H5 → T10 (end) | crossing, tiles, JS heap |
| sp-x9 | L16 acceptance → I6 cache headers → I7 audio → I9 phone prefetch → I10 persist → J6 SW warm list → J9 → J10 guard → I12 guard → I11 → A1 ring-first → P2 → H4 home CPU | loading, iPhone, JS payload |
| sp-x7 | MB1–MB7, MB12 → then (Q8) H7 → H8 → H9 → H11 → I2 tail → LD4 Explorer parity (end) | gate, JS heap, legacy |
| end | C2 WebKit reading, RM12 Simulator reading, M2 cold/warm reading, T10 soak: one official quiet window each, after every other row; then Jake's iPhone check (G558) | milestone |

**Built on the recommended option (never paused; Jake's pick steers later):**
- C5 composer diet: the lighter targets become the default if the capture matches; no Debug row (G669).
- R1/RP3 + RP2 + R3/RP4 open-plot rollout: built now from the Night Market kit, before Jake's pilot play.
- T5: the Developer overlay only; the "3 × 3 / 5 × 5 / whole" Debug row is dropped (G669, and G747 deletes the
  whole-shard path anyway).
- G681 Night Market road B: built as planned; Jake plays it when it lands.
- RM1 dome targets: plan agent finishes with `codex image_gen` (not a lane).

**Honest finish.** Tonight's rate was 0.19 rows per lane-hour, mostly waiting. With MB1–MB9 in, expect
~0.4–0.5: about 45–60 rows by Tue 27 Oct 20:00 Cancun, so ~80–85 % on the counter, not 100 %. What misses:
the generator tail (~176 producer jobs left in GR5–GR8 at ~1–2 jobs per lane-hour, then GR9–GR12) runs to
Thu 29 Oct; the JS heap Codex rows (12, started tonight) run into Wed 28 Oct; the milestone readings and Jake's
phone check come last. Legacy LD5–LD8, A1 and A2 wait for his word.

## 5. Damage list (fix after the plan)

It lives in `docs/plans/shard-platform/STATE.md` under "Damage list", one line each: **what broke · first bad SHA
· owner after the plan**. On it: every red CI test, every boot-smoke leg that fails, the stuck deploy, every
check MB1–MB7 switched off, flakes, and budget or ratchet overruns that landed. Not on it: a break that stops lanes
building (types fail on main, the app won't build or boot). That one is fixed at once by whoever broke it (G674).

Already on it: main red since `a49bb564ce` (boot-dist-transfer, title-shell-graph); official quiet floor 11/15
(`3694a487bc`); CF2 title/grid flakes.

## 6. Deal with the damage later (after the plan, not now)

- Turn main green: fix forward every damage-list red, oldest first, owner = the lane that broke it (G754).
- Release: the newest green main ships through the normal deploy (`.github/deploy-pin.json`), then Jake's phone.
- Decide which switched-off checks come back. Default: the 45 s push gate and 5 s pre-commit stay (G768); CF1,
  the red hold, the ci-subset step and fail-closed inputs stay deleted unless Jake asks.
- The tooling rows Q1 moves here: green-main GM1, GM4–GM7; ci-flow CF2–CF5; shared-waits SW3, SW9, SW13; gen
  speed G1–G10; TS T5, T6; generators GS4, GS5 (GS4 adds a pre-commit step with no 5 s cap, which G768 forbids).
- Jake's own after-plan work (tiny repo, git history, worktrees) is out of scope here.

## 7. Questions for Jake

Option 1 of each is "Skip for now" when asked.

| # | Question | Options | Recommended, and why |
|---|---|---|---|
| Q1 | Move the ~25 tooling rows (list in §6) off the count, to after the plan? | Move them after · Keep them counted, sp-x7 builds them after MB rows | **Move them after.** G769 says no lane touches tooling; they are gate and CI work, and they hold the % down. |
| Q2 | How red can main get before a lane must stop? | Only when main can't typecheck, build or boot · Also when CI test count rises past N · Never | **Only when main can't typecheck, build or boot.** Red tests don't stop building; a broken build stops everyone. |
| Q3 | Deploys frozen until the plan is done? | Frozen; live stays on 59a595ab10 · sp-x7 fixes the two reds now so deploys resume | **Frozen.** Fixing CI now costs a lane-hour and new reds land every hour anyway. |
| Q4 | What stays in pre-commit (5 s)? | Storage + typed lint of staged files · Nothing · Keep CF1 too | **Storage + typed lint of staged files.** Both fit in 5 s and catch the costly mistakes (big blobs, type errors). |
| Q5 | Opus checks before landing graphical work? | None; one Chromium capture of HEAD after landing · A preview before landing · None at all | **None before; one capture after landing.** Keeps the look honest without a wait; G769 bans pre-land previews. |
| Q6 | Build the pick-blocked rows on the recommended option (§4: C5, open-plot rollout, T5 without its Debug row, road B)? | Build all four · Build only C5 and road B | **Build all four.** Never pause lanes; your pick steers them when it comes. |
| Q7 | May a generator row build its own shard once (one heavy-lane slot) to prove its bytes? | Yes, its own shard only · No builds at all | **Yes, own shard only.** Converting a generator blind risks broken products in every later row. |
| Q8 | After MB1–MB7 (~2–3 h), does sp-x7 build counted rows? | Yes, small Codex rows · No, releases and reds only (G485) | **Yes.** Deploys are frozen and main may be red, so sp-x7 has no release work; one more building lane. |
| Q9 | Add Codex lanes for the overloaded non-graphical side (JS heap, iPhone, loading)? Codex is at 41 % weekly. | +2 Codex (7 Codex) · +1 · No, stay at 5 + 5 | **+2 Codex.** sp-x2, sp-x8 and sp-x9 hold ~30 rows between them; that is the queue that misses tomorrow. |
| Q10 | A row whose "done when" needs a Simulator or phone reading (RM12, C2, T10, M2, I12 budgets): mark it done on a Chromium reading, with the official readings once at the end? | Done on Chromium; Sim at the end · Wait for the Sim reading per row | **Done on Chromium.** Per-row Sim readings need the quiet lock, which stops every lane. |
| Q11 | GR11 (app tables to virtual modules, nothing generated under `src/`) and GS1–GS3 (commit generated source files) do the same job two ways. Keep one? | GR11 only; GS1–GS5 dropped · GS only; GR11 dropped · Keep both | **GR11 only.** It is the redesign you picked (option A); dropping GS saves five rows and a pre-commit step. |
| Q12 | JS heap: build the H rows straight away, with the G1 heap guard last instead of first? | Guard last · Guard first, as planned | **Guard last.** The guard is a measuring tool; the savings are in H1–H11, and the guard only locks them in. |
| Q13 | Legacy deletion (LD5–LD8, A1, A2: 6 rows) waits for your word. When? | Your next play counts as QA wave 2; word after it · Word now, no QA · Keep waiting | **Next play is wave 2, then your word.** It keeps your LEGACY A/B check without a separate phone chore. |
| Q14 | Night Market and open-plot boards: batch them to your first message each morning (G766) and keep building, or do you want boards as they land? | Morning batch · As they land | **Morning batch.** Lanes never wait on a board either way, and one batch is fewer interruptions. |
