# GAME-NORMALIZATION v2 · 12 — How the work runs

## 0. The autonomous build (decisions 101–108, Jake, 2026-09-30) — wins over §3–§6 where they differ

- **The lead builds the whole plan without stopping** (101, 102). At a milestone Jake gets the summary, the boards and
  a playable build, but nothing waits for his reply. Each board item takes its recommended option and is logged in
  [13](13-lead-resolutions.md); the lead runs `--accept` itself. A rejection Jake sends later becomes a fix row.
- **The pin moves by itself** at each milestone (103) once `gpu-gate` is green, the `gpu-perf/memory` run passes and
  nothing is pending; the lead tells Jake.
- **Parity runs in batches, by the lead only** (104): per row step or per subagent wave, and the full run before a push;
  never per commit. Subagents only build (TypeScript) and run checks under ~5 s (`tsc`, `oxlint`, one focused vitest
  file). A red batch is bisected and the bad commit reverted. Parallel test runs are scripts in parallel Chromiums from
  the lead, not subagents.
- **Lanes** (105, 107): no 3-subagent cap (the hook allows 20 while `.github/lock.json` is locked), but each subagent is
  short (one job, small context, few turns), never waits on anything, is never recycled or forked. Codex CLI
  (GPT 6.1 Sol) agents in herdr panes take suitable jobs. The browser lane is 8 under the lock. The lead stops, commits
  and pushes when 10 % of the weekly quota is left.
- **Builders** (109, Jake's blessing): Codex CLI (GPT 6.1 Sol) sibling agents in herdr panes (the herdr skill) and Opus 5.5
  subagents, round-robin by the weekly usage left on each side (`openusage`: `providers.claude` / `providers.codex`
  `.resources.weekly.remaining`). **Graphics, three.js, GPU and visual work → Opus 5.5; the engine, the refactors and all
  other TypeScript → GPT 6.1 Sol.** Each side stops at 10 % left (107). A Sol pane gets the same brief template (§4)
  and the same caps; its commits carry `E357-Lead: yes`.
- **Z3 builds two shards** (106) by two fresh agents in parallel: shard 5 desert + whip (+ a flying creature, a quest
  step), shard 6 the agent's choice.
- **A gap the plan doesn't cover** (108): the lead picks the option most faithful to E127 / E357, logs it in 13 with its
  revert path, and keeps going.

## 1. Definition of ready: the council (decisions 81–83, 92–93)

The plan stays `draft` until it passes the council. Jake: *"the plan is not done and ready for execution until
various independent review and auditors, including Codex … have found no holes … stabilize to being fully thought
out, fully fleshed out … no ambiguities, no laziness, no shortcuts, no holes. It needs to cover everything we've
spoken about."*

**The protocol** (decisions 81–83, 92–93). It is built so that rounds converge rather than circle.

1. **A frozen ledger.** Settled means Jake's decisions in `docs/tasks/asks/E357.md` (1–100 and the ′ revisions) plus
   the lead's resolutions in [13](13-lead-resolutions.md). A reviewer may reopen a settled item only with **new
   evidence** that it is wrong against the code or contradicts another settled item, never on preference. Without
   that, the finding is closed as `settled` on sight.
2. **One bar.** A finding counts only if an executing agent would **fail, do the wrong thing, or have to guess**, and
   it must carry a location (file §, row), evidence (file:line or a quote) and a concrete fix.
   - `must-fix`: execution fails or is wrong, or a decision is violated.
   - `should-fix`: a gap or ambiguity the executor would guess at.
   - `nit`: wording, style or taste. Nits never block.
   The lead verifies every finding against the repo before accepting it.
3. **One register across rounds.** [reviews/register.md](reviews/register.md) gives every finding a stable ID and a
   status (fixed + commit / rejected + reason / settled / escalated). Every round's seats get the register and the
   ledger; these are the plan's own record, not the conversation, so the seats stay clean-room. A finding that
   matches a closed row without new evidence is auto-closed.
4. **The surface shrinks.**
   - Round 1 reviews everything.
   - From round 2, a round reviews (a) the **diff since the last round**: did each fix land, and did it break
     anything nearby; and (b) **the battery**.
   - A finding outside the diff counts only if it's must-fix with evidence.
5. **A fixed battery that only grows.** [reviews/battery.md](reviews/battery.md) holds the scenarios (§1.1), and
   every round walks all of them, pass or fail per step. The pass count may never fall. A seat may add a scenario
   that covers something none does, and it stays forever, like a regression test.
6. **Machines check the mechanical things.** `node scripts/plan-lint.mjs` runs before every round and after every
   fix:
   - vague words;
   - every decision traced in 00;
   - retired names;
   - dead `src/` paths;
   - broken links;
   - every index row specced.
   A round starts only on a clean lint.
7. **Minimal fixes.** Each edit cites a register ID and touches only what the finding names; no section rewrites.
   After each round, plan-lint and the traceability matrix re-run as the regression guard.
8. **Convergence or stop.**
   - The accepted must-fix plus should-fix count must **fall strictly** each round. If it doesn't, or a round
     re-raises closed rows, the loop stops and the open rows go to Jake as decisions.
   - **At most 4 rounds** (93).
   - **Two clean rounds in a row** make the plan `ready`. A round is clean when it has zero accepted must-fix and
     zero accepted should-fix.
   - After 4 rounds, what's still open goes to Jake, one recommended answer each, and the plan is `ready` after his
     answers.
   - **After round 4 (decision 100):** its count didn't fall, so one **check pass** follows: one Codex seat checks only
     that R4-01…R4-18 landed in every file that carries their pattern and contradict nothing, with no new scenarios and,
     outside the fixes, must-fix only (`reviews/round-5-check.md`). What it finds is fixed, then the plan is `ready`.

**The seats** (3 per round, decision 82), each a fresh agent every round (never a resumed one):

| Seat | Engine | Lens |
|---|---|---|
| A | Codex CLI (`codex exec`, GPT 6.1 Sol, reasoning high; decision 90′; Codex ≥ 0.159.2) | Architecture review + the scenario battery |
| B | Claude general-purpose subagent | Coverage + code-grounded audit: 00-traceability against the ledger, claims (file / line / count) checked against the repo, undefined terms, rows without done-when |
| C | Claude general-purpose subagent | Red-team execution: ordering and dependencies, harness blind spots, rollback gaps, cost and time, the iPhone memory wall, the lock and the deploy pin, and anything that would make an executor guess; it may add battery scenarios |

**Round outputs.**
- Each seat writes `reviews/round-<n>-seat-<A|B|C>.md` (a findings table plus the battery results; its last line is
  the verdict).
- The lead merges the findings into the register, fixes or rejects each one, updates the round summary table, and
  re-runs plan-lint.
- A decision that is Jake's goes to him through AskUserQuestion; nothing else does (83). He gets one status line per
  round.

### 1.1 The scenario battery (in reviews/battery.md; seat A walks it, seat C may add to it)

Each scenario is walked through the plan. A step the plan doesn't answer unambiguously is a finding.
1. Add shard 5 with a whip, a flying creature and a desert look, using only `docs/SHARDS.md` + 01-architecture.
2. Migrate Pine Hollow's LeverRifle, step by step, keeping its behaviour.
3. The Storm Titan's hit, from swing to HUD, through the new pipeline.
4. A player's first boot after F10 (saves reset), then a v2 → v3 save-shape change a month later.
5. The gate goes red at M1 on a pose diff: what happens, and who decides.
6. A bug found in Nine Dragon mid-S2: where it's fixed and when it ships (decision 53).
7. Nalati riding under the input context stack: every action, touch disc and verb slot.
8. A shard plugin throws during `level.world` on the phone.
9. Unload a shard in-page (the leak test) with Nalati's weather running.
10. Jake wants a new Debug toggle mid-refactor.
11. The Drowned Captain onto the boss runtime with his fight unchanged: prove it.
12. A future seamless travel from Driftwood to Pine Hollow: what exists and what's missing.
13. A later netcode layer: which state is already separate.
14. The iPhone memory wall at M3 (Nalati over 1.8 GB loading).
15. Rapier 0.21 changes a walk result.

Seat C added 16–23 in rounds 1 and 2: a gate red only on the slower runner, F6's codemod half-applied, a content agent
in a reopened shard while the lead changes an API it uses, Jake's "no" at a milestone, a red nightly memory run, a
lane's baselines racing a lead commit on the shared `main`, the M2 accept / revert / pin loop, and the first
clean-export builds after F9. In round 3 it added 24–26: a pending field changed again before the milestone, a
lane's terrain and tree-card edit against the bakers, and the sound log over timer-driven ambience.
[reviews/battery.md](reviews/battery.md) holds every scenario with its pass record.

## 2. The lock (decisions 33, 52)

- **From F0 until the plan is archived, no other agent works in the repo.** F0 adds this AGENTS.md section:

  > **E357 lock (from <date>).** GAME-NORMALIZATION v2 is being built. Only its lead session (and the subagents it
  > spawns) commits. Shard folders reopen one at a time at their milestones (listed in the plan's State line); the
  > engine, game and kit stay locked until the plan is archived. If you are not the E357 lead, stop and ask Jake.

- The session brief prints the lock line and the reopened folders.
- **The lock check (R1-09).** `scripts/check-lock.mjs`, built in F0 (02 F0 step 5), runs as the **`commit-msg`** hook
  (a pre-commit hook runs before the message exists). The lead's commits, and those of the subagents it spawns, carry
  the trailer **`E357-Lead: yes`** and pass; Z3's agent is the one subagent without it (§4 item 10; R2-12). Any other
  commit may touch only a reopened shard's allowlist; anything else is refused, path by path. The reopened slugs, with
  the extra asset folders each manifest declares in `assetGlobs` (R3-09), live in `.github/lock.json`. On Jake's go at
  a milestone, the lead commits `lock.json` alone, adding that shard; before Z3's agent starts, the lead commits its
  new slug the same way, with the default asset globs for a new shard, since it has no manifest yet (02 F0 step 5;
  R2-12, R3-06, C2-24).
- **Reopening.** At milestone Mn, `src/shards/<slug>/` reopens to content agents, inside **the reopened-shard
  allowlist, defined once in 02 F0 step 5** (R1-09, R2-19): the shard's own folders, its baselines, its bakes, the
  asset folders its manifest's `assetGlobs` names, and the line-scoped shared files (`scripts/blender/targets.json`,
  `art/README.md` and the KTX2 bake list and cache), checked hunk by hunk. This file copies none of it. Generated files
  are never committed (they are built at build and test time, 02 F9; R1-11), except a shard's KTX2 table, which its
  lane commits when the shard has one (R2-04, R3-08).
- **A reopened shard's lane owns its baselines (R1-12).** After a content commit, the lane re-records its own
  shard's baselines on that commit's SHA (`node scripts/parity.mjs --rebaseline=<slug> --export=<sha>`, 03 §8 case 6)
  and commits them as a follow-up commit naming the SHA, never an amend (R2-25); every other shard must stay
  identical in that run (the cross-shard proof). Until that follow-up lands the shard is **`lane-pending`** (R3-12;
  03 §1): other runs show it yellow, not red, and nothing is pushed. The lead's engine commits keep every shard
  identical except boarded items.

## 3. Deploys: milestones only (decisions 32, 53)

- **At F3.1, production is pinned** to the build live that day (`version.json` when F3.1 lands; milestone `M0`,
  `gate: "grandfathered"`). `deploy.yml` and `ota-promote.yml` deploy only the SHA in **`.github/deploy-pin.json`**
  (03-harness-gate §13; 13-lead-resolutions G7); main keeps moving.
- **At each milestone** (M1–M4, then Z3's shard 5 and the archive), the flow is (R1-15; 03 §13.4):
  1. the gate is green on the candidate SHA (dispatched with the offline boot check, 03 §11.1);
  2. the boards go to Jake, with clips and images from the harness's capture of that SHA;
  3. Jake OKs the board items, or they're reverted, or fixed and boarded again. The reverts and fixes land first, and a fix he asked for
     goes back to him for an OK (R4-13; 03 §8 pending step 5); then, last and only for his OKs, `node scripts/parity.mjs --accept=<ids> --export=<the newest sha>` re-records them with 3 runs (R2-18,
     R3-14; 03 §8), so nothing is pending;
  4. the pin moves to **the newest `gpu-gate`-green SHA after step 3** (R2-27): step 3's accept, fix and revert
     commits included, and after an accept the commit that lands the runner's bootstrap artifacts; only when that
     SHA's `pending.json` is empty, and only with a `gpu-perf/memory` reading of that SHA or a runtime-equal ancestor
     (R4-15; 03 §13.2: `nightly.sh --memory-only --sha=<sha>` when there is none). `node scripts/deploy-pin.mjs set <sha> --milestone M<n> --go "<where Jake OKed>"`
     refuses a SHA without a green `gpu-gate`, a SHA with a pending entry (R1-13, R2-28), a SHA a shard was only
     bootstrap-recorded on, and a SHA without a `gpu-perf/memory` `success` of its own or of a runtime-equal
     ancestor (R1-53, R4-15). The lead commits
     `.github/deploy-pin.json` alone, runs `gh workflow run deploy`, confirms `version.json` reports it, and records the
     build id in `docs/tasks/asks/E357.md`;
  5. Jake plays it live, with the milestone's checklist (05–08 §9). **No checklist has a physical-iPhone reading
     (decision 98, R3-11′).** The memory evidence is the nightly Simulator memory run (03 §14.1: every shard's
     WebContent footprint against 1.8 GB loading / 1.0 GB in world, decimal; decision 31) plus the budgets (03 §2.5).
     Over a limit means **stop the line** (§8; R1-53): the pin doesn't move (`set` refuses a SHA without its own
     `gpu-perf/memory` `success`, step 4), and the next commit fixes or reverts. The risk this accepts is stated in §8;
  6. **Jake's go starts the next shard.** The go is not a ship gate. **On a "no" (R2-29),** the next shard phase
     waits: Jake's reasons become rows of this milestone, each fixed, gated, boarded if it is visible, and then
     "M<n>: go?" is asked again (the flow repeats from step 1). The pinned build stays live unless it is broken on his
     phone; then it is rolled back (R1-16).
- **Playing before the pin moves.** If Jake wants to play the candidate first, the lead deploys it as a Vercel
  **preview** deployment (`vercel deploy --prebuilt` from a clean export, which keeps `/api`; 03 §13.4), with the
  checkout's `.vercel/project.json` copied into the export before `vercel pull`, as `deploy.yml` does (R2-34), never
  with `scripts/release-url.sh` (static `dist/` only, no `/api`) (R1-15).
- **Bug fixes land on main and ship at the next milestone** (53). No hotfix branch.
- **If the pinned build breaks on Jake's phone,** the fix still waits for the milestone, unless Jake asks for an early
  pin move. **An early pin move (R2-28)** goes only to a `gpu-gate`-green SHA whose own `pending.json` is empty, which
  is usually the last green SHA before the phase's first pending entry; `set` keeps refusing while anything is pending
  at the target SHA. When the fix landed after that entry, the lead asks Jake (one recommended option) to board the
  pending items early or to wait for the milestone (03 §13.4).

## 4. Lanes and subagents (decision 34, E352)

- **The lead** (the top-level session) builds in row order and owns the spine files. Those are everything under
  `src/engine/app/`, `src/engine/boot/`, `src/game/shard/`, the composition root (`src/entry.ts`, `src/main.ts`), the index
  files, `lint/`, `scripts/parity.mjs`, `.github/deploy-pin.json`, `.github/lock.json` and `deploy.yml`.
- **Up to 3 subagents at once,** each one job, on disjoint files:
  - Good jobs: a weapon family, the audio engine, one shard's file move, one X5 item, one spec rewrite.
  - Never a spine file, and never two subagents on one shard folder.
- **The brief template** (every subagent):
  1. The job, and its row in the plan.
  2. The files it owns.
  3. The files it must not touch.
  4. Done-when (the row's).
  5. The caps: "stop at 400k context, 90 min or ~200 turns, whichever first. Commit what is done, update your
     Handoff, report what is left".
  6. A Handoff section in `docs/tasks/asks/E357.md` from the first commit on (Done, Next, Owns, Learned, Done when).
  7. Report ≤ 40 lines.
  8. No `set-label.sh`.
  9. Waits over ~4 min become "queued: <command>" for the lead.
  10. Commits carry the trailer `E357-Lead: yes` (§2; R1-09), **except Z3's agent** (11 Z3; R2-12): it commits
      without the trailer, so the lock check holds it to the new slug's allowlist (02 F0 step 5), which the lead has
      committed into `lock.json` before starting it. Its proposals go to `art/<new-slug>/round-1-proposals/` and its
      API gaps to its ask file (`docs/tasks/asks/<id>.md`), both inside that allowlist. Parity per commit is only the
      phone lane for its own shard (< 4 min, §5; R1-10); the all-shards run before the push is the lead's.
- **Long waits belong to the lead:** the model lock for S1.5's audio, the gate runs, deploys. They run with
  `run_in_background`, and the lead is notified when they exit.
- **Never recycle a subagent.** What is left goes to a fresh one whose brief says "read the last Handoff in E357.md,
  then continue".

## 5. Every commit

1. Node checks green: `pnpm test` (incl. layers, ratchets, contract tests, gen-shards `--check` as the generator's
   determinism check, the asset audit, check-paths, coverage).
2. A pathspec commit (`git commit -m "E357 <row>: …" -- <paths>`), with the trailer `E357-Lead: yes` in its trailer
   block (§2; R1-09), and its SHA captured in the same shell command (`… && sha=$(git rev-parse HEAD)`; R2-25): up to
   3 subagents and the reopened lanes commit to the same local `main`, so `HEAD` can move before the run starts. The
   message names the row and says "parity green" or "board: <wave>". **No `git commit --amend` under the lock**
   (R2-25): anything recorded on a commit (baselines, a pending entry's `expect`) lands in a follow-up commit whose
   message names the SHA it was recorded on.
3. **One per-commit parity command (R1-10),** on that SHA: `node scripts/parity.mjs --export=<sha>
   --shards=<changed> --tiers=phone` against the lane's baselines (`<changed>` = the shards the commit touches, `all`
   for an engine / game / kit commit; 03 §1). A subagent runs it for its own shard only (< 4 min); anything longer is
   "queued: <command>" for the lead (AGENTS.md).
4. **Before every push:** `node scripts/parity.mjs --export=<the newest local sha> --shards=all
   --tiers=phone,desktop` green, then `scripts/push-main.sh`, and the `gpu-gate` status is watched. A commit and its
   follow-up baseline or pending commit go up in the same push. **Nothing is pushed while that run shows a shard
   `lane-pending`** (R3-12; 03 §1): a reopened lane's content commit is on main and its follow-up baseline commit
   isn't yet. That run shows the shard yellow, not red (only its class D thresholds can be red), and the push waits
   for the follow-up (≤ 25 min, 03 §10).
5. **A change waiting for a board is pending, not red (R1-13, R2-18, R3-14; 03 §8).** The commit that makes a visible
   change for a wave board adds its entries to `docs/plans/game-normalization/reviews/pending.json` with `"expect":
   null`, and its message names their fields: those fields show yellow (allowed) and are not compared. Its per-commit
   run is `node scripts/parity.mjs --pending-fill=<ids> --export=<sha>`, which fills each entry's `expect` per tier
   (`"<tier>/<field path>"`) from that SHA's m5 run and runs the commit's other shards' per-commit check too; every
   other field must be green, and a newly red field joins an entry only if the commit's message names it (otherwise
   it is red). `pending.json` lands in a follow-up commit naming the SHA. From then on the m5 lane compares those
   fields with `expect`, within the field's band: off it, red. A later commit that changes an already-pending field
   refills its `expect` the same way, in its own follow-up, with a note in the entry. At the milestone, reverts and
   fixes land first; then, only after Jake's OK and last, `node scripts/parity.mjs --accept=<ids> --export=<the newest
   sha>` re-records them with 3 runs and removes the entries; a "no" reverts the change and its entries.
6. **A red result is reverted, not patched forward.** Parity red after a commit means
   `git revert <sha>` → push → re-plan the step. The one exception is F6 after F8 has started: a break the move caused
   is fixed forward, with a test, citing F6 (02 F6; R1-54). **A red that may come from a lane's window is attributed
   first (R3-12):** a class D red on a `lane-pending` shard, or a red on another shard in a lane's cross-shard proof,
   is re-run on the lane's parent commit (`--export=<C^> --shards=<that shard>`) before anything is reverted; only the
   commit that turned it red is reverted (03 §1).

## 6. Boards (decisions 4, 6, 42)

| Wave | Assembled at | Content (from the specs) | Format |
|---|---|---|---|
| Weapons | M1, with M2's ranged additions | 09-combat-ai § boards | One iPhone-portrait board image, labelled A / B, plus ≤ 10 s clips per item |
| Creatures | M2, M3, M4 | 09-combat-ai § boards; decision 85's tick bands (M2); starter effects; the big crab at 14 and the crab / monkey / sailor bands (M4) | Same |
| Input / HUD | X1 | 10-sweeps X1 | Same |
| Audio | M1 | Nine Dragon's ambience, score and SFX | A listening page (Artifact, MP3s, per [[artifact-audio-pages]]) |
| Look | M4, X9, and whenever a pose differs beyond noise | the Drowned Captain on the shared BossBar (decision 91, S4.2; 13-lead-resolutions 07/08#9, G21); the title deck's read-only Wildshard summary strip, A / B (X9, decision 76; 13-lead-resolutions G10); the pose triptych (before / after / diff) | Board |

- A board goes to Jake with SendUserFile + AskUserQuestion. One recommended option per item.
- An OK re-baselines exactly the boarded items in the harness (R1-13, R2-18), and only after it: `node
  scripts/parity.mjs --accept=<ids> --export=<sha>`, where the ids are the entries of
  `docs/plans/game-normalization/reviews/pending.json` (03 §8) and `<sha>` the newest SHA, whose build shows the
  items. It runs last, after the milestone's reverts and fixes, and records with 3 runs (R3-14); the re-recorded
  baselines and the emptied entries land in one accept commit naming that SHA (§5). A "no" reverts the change and
  removes its entries. The pin can't move to a SHA with any pending entry (§3).

## 7. Reporting

- **The plan's State line** is rewritten (not appended) at every row finish. It names the current row, the next row,
  the milestone count and the lines deleted so far.
- **At each milestone:** the summary (what moved, lines deleted, ratchet counts, budgets) and the boards; after the pin
  moves, "play it on your phone" (42), and Jake's go starts the next shard (§3; R1-15).
- **M1's summary also states:** the one-time 2.7 MB re-download of Pine Hollow's phone-pack part that F1 causes (the
  bakers' `hash` fields re-stamp once when F1 makes each the sha of its output bytes, 02 F1 step 7; R1-20, R3-07;
  13-lead-resolutions 04#5), and Nine Dragon's load cap (its F2 baseline rounded up to the next second,
  13-lead-resolutions 05/06#7) for Jake to confirm.
- **No silent stretches:** a decision Jake owns goes to him with the tool as it comes up ([[ask-with-tool]]).

## 8. Risk register

| Risk | Where | Guard | If it hits |
|---|---|---|---|
| The big move (F6) breaks the bakers silently | F6 | F1's alias spike, `check-paths`, the non-empty glob asserts, bake byte-identity (every baker bakes in full and compares its output bytes, and `bake-check.mjs` in `pnpm test` fails a stale bake; F6's done-when runs it to identical bytes; 02 F1 step 7, R3-07) | Revert F6, fix the tool, redo, until F8 starts; after that, fix forward with a test citing F6 (R1-54) |
| The harness is non-deterministic (flaky) | F2 | green twice on unchanged HEAD before anything moves; re-run once, quarantine with an owner | A flaky check blocks nothing only while quarantined, max 3 days (03 §12), then fixed, or deleted only with a replacement check covering the same field (R1-36) |
| iPhone memory regression (the E271 class) | any render change | budgets + GPU bytes in the nightly perf; **the nightly Simulator memory run** (03 §14.1: every shard's WebContent footprint against 1.8 GB loading / 1.0 GB in world, decimal; decision 31) and the soak bot (03 §14.2). With the budgets, that run is the plan's memory gate: **no physical-iPhone reading anywhere**, at a milestone or for F12 (decision 98, R3-11′; F12 uses a Simulator load reading, 02 F12 step 5). An intended increase is a boarded item whose OK re-baselines the nightly (03 §14.1; C3-15) | **Memory red stops the line** (R1-53): over a limit, or > 10 % above the previous night without an open pending entry for it, the pin doesn't move (`set` refuses while `gpu-perf/memory` is red, 03 §13.2) and the next commit fixes or reverts the cause. A pinned build that breaks on the phone goes back with `deploy-pin.mjs rollback <sha>` to any earlier pin, M0 included (R1-16; past F10 the old build can't read the v2 saves, so progress resets a second time, which decision 95 accepts and the rollback states). **The accepted risk (decision 98):** the Simulator runs on the Mac's memory and GPU (it read ~0.75 GB where the phone read 1.054, E271 / E272), so an iPhone-only memory death, as the multi-draw crash was, can reach Jake's phone undetected; nothing in the plan takes a reading that would catch it first. A render optimisation that AGENTS.md's E271 rule says needs physical-device evidence (MW12) is not in this plan: it waits until after it (index §8) |
| Rapier 0.21 changes walks | F12 | walk + trails 0 stuck, nav bake `--check`, a Simulator load reading of Nine Dragon and Pine Hollow at M1 (02 F12 step 5; R3-11′) | 0 stuck but `end` / `maxY` beyond the band: the lead inspects the legs and trails; a pure numeric drift is re-baselined with a note (decision 89); a new stuck or a fall reverts F12 and files an ask (R1-52; 03 §8 case 5). The engine hides Rapier, so it's one module |
| iOS evicts the home-screen app's saves (storage not persisted) | F10 | `app.saves.persist()` on a home-screen launch, covered by `test/saves-persist.test.ts`; export / import in Settings (02 F10 step 8). Whether iOS grants it is not checked: the home-screen install can't be driven headless and decision 98 rules out a phone reading (R4-17) | Jake's progress resets; he can restore an export. The lead adds a Simulator home-screen check if a UI-tap tool lands on the Mac |
| `macos-15` runner changes (image, Chromium) | F3.2 | image label and Chromium version pinned; baselines recorded on the runner | Re-baseline in one commit with a board only if pixels moved |
| A profile can't express a weapon's old behaviour | S1–S3 | parity trajectory / timing tests per weapon | The family gains the field (a bug in the family, decision 12′), never the weapon converges |
| The scope creeps (new features mid-refactor) | any | the lock; the plan's rows are the only work | New ideas become asks; a draft plan marked "Jake approved none" ([[park-unapproved-ideas]]) |
| Cost (E352) | every subagent | caps in every brief, ≤ 3 live, no recycling, long waits on the lead | The lead builds alone for the rest of the phase |
| Jake's phone stays on an old build for long | between milestones | a milestone about weekly; Jake may ask for an early pin move | §3 |

## 9. Estimate and order

| Phase | Rows | Agent-days (est.) | Depends on |
|---|---|---|---|
| Council | review rounds until 2 clean | 1–2 | this folder |
| F | F0–F12 | 4–5 | the go |
| S1 | Nine Dragon | 3–4 | F |
| S2 | Pine Hollow | 4–5 | S1 (families, pipeline, scope) |
| S3 | Nalati | 3–4 | S2 (AI runtime, weather, elites) |
| S4 | Driftwood | 3–4 | S3 (audio engine) |
| X | X1–X9 | 5–6 (parts pulled earlier) | S1–S4 |
| Z | Z1–Z4 | 2–4 (Z3 may loop) | X |
| **Total** | | **~25–34 agent-days, ~3–5 weeks of wall clock** | |

The earlier "2–4 weeks" estimate is revised up. Since then the plan gained the council, S1.5's audio, X8, the harness
detail and the Z3 loop, and then the gap closure (13-lead-resolutions G1–G21): X9, the chunk check and iOS 27 re-test
(X3), tier selection (X7), flag hygiene (X8), and the nightly's Simulator memory run and soak bot (F3.2, 03 §14).
