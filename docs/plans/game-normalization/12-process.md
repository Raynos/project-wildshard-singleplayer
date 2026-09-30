# GAME-NORMALIZATION v2 · 12 — How the work runs

## 1. Definition of ready: the council (decisions 81–83, 92–93)

The plan stays `draft` until it passes the council. Jake: *"the plan is not done and ready for execution until
various independent review and auditors, including Codex … have found no holes … stabilize to being fully thought
out, fully fleshed out … no ambiguities, no laziness, no shortcuts, no holes. It needs to cover everything we've
spoken about."*

**The protocol** (decisions 81–83, 92–93). It is built so that rounds converge rather than circle.

1. **A frozen ledger.** Settled means Jake's decisions in `docs/tasks/asks/E357.md` (1–93 and the ′ revisions) plus
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

## 2. The lock (decisions 33, 52)

- **From F0 until the plan is archived, no other agent works in the repo.** F0 adds this AGENTS.md section:

  > **E357 lock (from <date>).** GAME-NORMALIZATION v2 is being built. Only its lead session (and the subagents it
  > spawns) commits. Shard folders reopen one at a time at their milestones (listed in the plan's State line); the
  > engine, game and kit stay locked until the plan is archived. If you are not the E357 lead, stop and ask Jake.

- The session brief prints the lock line and the reopened folders.
- **The lock check (R1-09).** `scripts/check-lock.mjs`, built in F0 (02 F0 step 5), runs as the **`commit-msg`** hook
  (a pre-commit hook runs before the message exists). The lead's commits, and those of the subagents it spawns, carry
  the trailer **`E357-Lead: yes`** and pass. Any other commit may touch only a reopened shard's allowlist; anything
  else is refused, path by path. The reopened slugs, with the extra asset folders each manifest declares, live in
  `.github/lock.json`, which each milestone commit edits.
- **Reopening.** At milestone Mn, `src/shards/<slug>/` reopens to content agents. The reopened-shard allowlist
  (R1-09): `src/shards/<slug>/**`, `test/shards/<slug>/**`, `test/parity/baselines/*/<slug>.*` (its baselines,
  below), `art/<slug>/**`, `public/assets/<slug>/**` and the asset folders its manifest declares,
  `scripts/blender/<slug>/**`, and `docs/tasks/asks/**`. Generated files are never committed (they are built at build
  and test time, 02 F9; R1-11), so a content commit never needs one.
- **A reopened shard's lane owns its baselines (R1-12).** A content commit re-records its own shard's baselines in the
  same commit (`parity --rebaseline=<slug>`, 03 §8 case 6), and every other shard must stay identical in that run (the
  cross-shard proof). The lead's engine commits keep every shard identical except boarded items.

## 3. Deploys: milestones only (decisions 32, 53)

- **At F3.1, production is pinned** to the build live that day (`version.json` when F3.1 lands; milestone `M0`,
  `gate: "grandfathered"`). `deploy.yml` and `ota-promote.yml` deploy only the SHA in **`.github/deploy-pin.json`**
  (03-harness-gate §13; 13-lead-resolutions G7); main keeps moving.
- **At each milestone** (M1–M4, then Z3's shard 5 and the archive), the flow is (R1-15; 03 §13.4):
  1. the gate is green on HEAD (dispatched with the offline boot check, 03 §11.1);
  2. the boards go to Jake, with clips and images from the harness's capture of HEAD;
  3. Jake OKs the board items (`parity --accept`), or they're fixed or reverted, so nothing is pending;
  4. the pin moves to HEAD: `node scripts/deploy-pin.mjs set <HEAD sha> --milestone M<n> --go "<where Jake OKed>"`,
     which refuses a SHA without a green `gpu-gate`, while a board item is pending (R1-13) or while `gpu-perf/memory`
     is red (R1-53); the lead commits `.github/deploy-pin.json` alone, runs `gh workflow run deploy`, confirms
     `version.json` reports it, and records the build id in `docs/tasks/asks/E357.md`;
  5. Jake plays it live;
  6. **Jake's go starts the next shard.** The go is not a ship gate.
- **Playing before the pin moves.** If Jake wants to play the candidate first, the lead deploys it as a Vercel
  **preview** deployment (`vercel deploy --prebuilt` from a clean export, which keeps `/api`; 03 §13.4), never with
  `scripts/release-url.sh` (static `dist/` only, no `/api`) (R1-15).
- **Bug fixes land on main and ship at the next milestone** (53). No hotfix branch.
- **If the pinned build breaks on Jake's phone,** the fix still waits for the milestone, unless Jake asks for an early
  pin move. The lead then moves the pin to the newest green SHA, since every commit is parity-proven.

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
  10. Commits carry the trailer `E357-Lead: yes` (§2; R1-09). Parity per commit is only the phone lane for its own
      shard (< 4 min, §5; R1-10); the all-shards run before the push is the lead's.
- **Long waits belong to the lead:** the model lock for S1.5's audio, the gate runs, deploys. They run with
  `run_in_background`, and the lead is notified when they exit.
- **Never recycle a subagent.** What is left goes to a fresh one whose brief says "read the last Handoff in E357.md,
  then continue".

## 5. Every commit

1. Node checks green: `pnpm test` (incl. layers, ratchets, contract tests, gen-shards `--check`, the asset audit,
   check-paths, coverage).
2. A pathspec commit (`git commit -m "E357 <row>: …" -- <paths>`), with the trailer `E357-Lead: yes` in its trailer
   block (§2; R1-09). The message names the row and says "parity green" or "board: <wave>".
3. **One per-commit parity command (R1-10),** on that local commit: `node scripts/parity.mjs --export=HEAD
   --shards=<changed> --tiers=phone` against the lane's baselines (`<changed>` = the shards the commit touches, `all`
   for an engine / game / kit commit; 03 §1). A subagent runs it for its own shard only (< 4 min); anything longer is
   "queued: <command>" for the lead (AGENTS.md).
4. **Before every push:** `node scripts/parity.mjs --export=HEAD --shards=all --tiers=phone,desktop` green, then
   `scripts/push-main.sh`, and the `gpu-gate` status is watched.
5. **A change waiting for a board is pending, not red (R1-13).** The commit that makes a visible change for a wave
   board adds its entry to `docs/plans/game-normalization/reviews/pending.json` (03 §8): its fields then show yellow
   (allowed) until Jake OKs the item (`parity --accept=<ids>`) or it is reverted.
6. **A red result is reverted, not patched forward.** Parity red after a commit means
   `git revert <sha>` → push → re-plan the step. The one exception is F6 after F8 has started: a break the move caused
   is fixed forward, with a test, citing F6 (02 F6; R1-54).

## 6. Boards (decisions 4, 6, 42)

| Wave | Assembled at | Content (from the specs) | Format |
|---|---|---|---|
| Weapons | M1, with M2's ranged additions | 09-combat-ai § boards | One iPhone-portrait board image, labelled A / B, plus ≤ 10 s clips per item |
| Creatures | M2, M3, M4 | 09-combat-ai § boards; decision 85's tick bands (M2); starter effects; the big crab at 14 and the crab / monkey / sailor bands (M4) | Same |
| Input / HUD | X1 | 10-sweeps X1 | Same |
| Audio | M1 | Nine Dragon's ambience, score and SFX | A listening page (Artifact, MP3s, per [[artifact-audio-pages]]) |
| Look | M4, X9, and whenever a pose differs beyond noise | the Drowned Captain on the shared BossBar (decision 91, S4.2; 13-lead-resolutions 07/08#9, G21); the title deck's read-only Wildshard summary strip, A / B (X9, decision 76; 13-lead-resolutions G10); the pose triptych (before / after / diff) | Board |

- A board goes to Jake with SendUserFile + AskUserQuestion. One recommended option per item.
- An OK re-baselines exactly the boarded items in the harness (R1-13): `node scripts/parity.mjs --accept=<ids>
  --export=HEAD`, where the ids are the entries of `docs/plans/game-normalization/reviews/pending.json` (03 §8), recorded
  in the commit. A "no" reverts the change and removes its entry. The pin can't move while any entry is pending.

## 7. Reporting

- **The plan's State line** is rewritten (not appended) at every row finish. It names the current row, the next row,
  the milestone count and the lines deleted so far.
- **At each milestone:** the summary (what moved, lines deleted, ratchet counts, budgets) and the boards; after the pin
  moves, "play it on your phone" (42), and Jake's go starts the next shard (§3; R1-15).
- **M1's summary also states:** the one-time 2.7 MB re-download of Pine Hollow's phone-pack part that F1 causes (the
  bakers' `hash` fields re-stamp once when F1 takes their own source out of the hash, 02 F1 step 7; R1-20;
  13-lead-resolutions 04#5), and Nine Dragon's load cap (its F2 baseline rounded up to the next second,
  13-lead-resolutions 05/06#7) for Jake to confirm.
- **No silent stretches:** a decision Jake owns goes to him with the tool as it comes up ([[ask-with-tool]]).

## 8. Risk register

| Risk | Where | Guard | If it hits |
|---|---|---|---|
| The big move (F6) breaks the bakers silently | F6 | F1's alias spike, `check-paths`, the non-empty glob asserts, bake byte-identity in parity | Revert F6, fix the tool, redo, until F8 starts; after that, fix forward with a test citing F6 (R1-54) |
| The harness is non-deterministic (flaky) | F2 | green twice on unchanged HEAD before anything moves; re-run once, quarantine with an owner | A flaky check blocks nothing only while quarantined, max 3 days (03 §12), then fixed, or deleted only with a replacement check covering the same field (R1-36) |
| iPhone memory regression (the E271 class) | any render change | budgets + GPU bytes in the nightly perf; the nightly Simulator memory run and soak bot (03 §14.1–§14.2: regression checks, not phone evidence); the physical iPhone reading at each milestone that touched render or memory | **Memory red stops the line** (R1-53): the next commit fixes or reverts, and the pin can't move while `gpu-perf/memory` is red (03 §14.1). A pinned build that breaks on the phone goes back with `deploy-pin.mjs rollback <sha>` to any earlier pin, M0 included (R1-16; past F10 the old build can't read the v2 saves, which decision 13 accepts and the rollback states). No render optimisation ships without iPhone evidence (AGENTS.md) |
| Rapier 0.21 changes walks | F12 | walk + trails 0 stuck, nav bake `--check`, an iPhone load reading at M1 | 0 stuck but `end` / `maxY` beyond the band: the lead inspects the legs and trails; a pure numeric drift is re-baselined with a note (decision 89); a new stuck or a fall reverts F12 and files an ask (R1-52; 03 §8 case 5). The engine hides Rapier, so it's one module |
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
