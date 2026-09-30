# GAME-NORMALIZATION v2 · 12 — How the work runs

## 1. Definition of ready: the council (decisions 81–83)

The plan stays `draft` until it passes the council. Jake: *"the plan is not done and ready for execution until
various independent review and auditors, including Codex … have found no holes … stabilize to being fully thought
out, fully fleshed out … no ambiguities, no laziness, no shortcuts, no holes. It needs to cover everything we've
spoken about."*

**A round**
- **Three seats, clean-room.** Each seat is a fresh agent that sees the plan folder, the index, Jake's words, the
  decision table in `docs/tasks/asks/E357.md`, the research docs and the repo. It never sees the conversation.

  | Seat | Engine | Lens |
  |---|---|---|
  | A | Codex CLI (`codex exec -m gpt-6-sol`, reasoning high; GPT 6.1 Sol is refused under Jake's ChatGPT login, decision 90) | Architecture review, plus a **scenario battery**: fixed scenarios walked step by step through the plan (§1.1) |
  | B | Claude general-purpose subagent | **Coverage and code-grounded audit**: every decision and audit finding traced to a row (checks `00-traceability.md`), every file / line / count checked against the repo, an ambiguity hunt ("etc.", "TBD", "as needed", undefined terms, rows without done-when) |
  | C | Claude general-purpose subagent | **Red-team execution battery**: what breaks mid-way. Ordering and dependencies, harness blind spots, rollback gaps, cost and time, the iPhone memory wall, the lock and the deploy pin, anything that would make an executing agent guess |

- **Findings.** Each finding is rated `must-fix` / `should-fix` / `nit` and carries a location (file §, row) and a
  proposed fix.
- **The review log.** `docs/plans/game-normalization/reviews/round-<n>.md` holds each finding verbatim, the lead's
  response (fixed in `<commit>` / rebutted: reason / needs Jake), and the seat.
- **Decisions for Jake.** A finding that needs Jake's decision goes to him through AskUserQuestion; nothing else does
  (83). He also gets one status line per round.
- **Clean.** A round is clean when no seat raises a `must-fix` or `should-fix` that the lead accepts. A rebuttal
  counts as clean only if the next round's fresh seats don't raise the same point again.
- **Stop rule:** **two clean rounds in a row** (81). Then the State line becomes `ready`, and the lead asks Jake for
  the go.

### 1.1 The scenario battery (seat A; seat C adds its own)

Each scenario is walked through the plan. A step the plan doesn't answer unambiguously is a finding.
1. Add shard 5 with a whip, a flying creature and a desert look, using only `docs/SHARDS.md` + 01-architecture.
2. Migrate Pine Hollow's LeverRifle, step by step, keeping its behaviour.
3. The Storm Titan's hit, from swing to HUD, through the new pipeline.
4. A player's first boot after F10 (saves reset), then a v2 → v3 save-shape change a month later.
5. The gate goes red at M1 on a pose diff: what happens, and who decides.
6. A bug found in Nine Dragon mid-S2: where it's fixed and when it ships (decision 53).
7. Nalati riding under the input context stack: every action, touch disc and verb slot.
8. A shard plugin throws during `shard.world` on the phone.
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
- **Reopening.** At milestone Mn, `src/shards/<slug>/` reopens to content agents. They may edit only that folder, its
  tests and its `art/` / `public/assets/` files. A CODEOWNERS-style path check (`scripts/check-lock.mjs`, in the
  pre-commit hook while the lock lasts) refuses other paths unless the commit message carries `E357-lead`.

## 3. Deploys: milestones only (decisions 32, 53)

- **At F3, production is pinned** to the build live that day (`version.json` at F3). `deploy.yml` deploys only the SHA
  in `deploy/pin` (see 03-harness-gate); main keeps moving.
- **At each milestone** (M1–M4, then Z3's shard 5 and the archive), the lead:
  1. checks the gate is green on HEAD;
  2. writes HEAD's SHA to `deploy/pin` (a commit);
  3. runs `gh workflow run deploy`;
  4. confirms `version.json` reports it;
  5. records the build id in `docs/tasks/asks/E357.md`.
- **Bug fixes land on main and ship at the next milestone** (53). No hotfix branch.
- **If the pinned build breaks on Jake's phone,** the fix still waits for the milestone, unless Jake asks for an early
  pin move. The lead then moves the pin to the newest green SHA, since every commit is parity-proven.

## 4. Lanes and subagents (decision 34, E352)

- **The lead** (the top-level session) builds in row order and owns the spine files. Those are everything under
  `src/engine/app/`, `src/engine/boot/`, `src/game/shard/`, the index files, `lint/`, `scripts/parity.mjs` and
  `deploy.yml`.
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
- **Long waits belong to the lead:** the model lock for S1.5's audio, the gate runs, deploys. They run with
  `run_in_background`, and the lead is notified when they exit.
- **Never recycle a subagent.** What is left goes to a fresh one whose brief says "read the last Handoff in E357.md,
  then continue".

## 5. Every commit

1. Parity green on the changed shard(s): `node scripts/parity.mjs --shards <changed> --tier phone,desktop`. The full
   4-shard run happens before every push.
2. Node checks green: `pnpm test` (incl. layers, ratchets, contract tests, gen-shards `--check`, the asset audit,
   check-paths, coverage).
3. A pathspec commit (`git commit -m "E357 <row>: …" -- <paths>`). The message names the row and says "parity green"
   or "board: <wave>".
4. `scripts/push-main.sh`, and the `gpu-gate` status is watched.
5. **A red result is reverted, not patched forward.** Parity red after a commit means
   `git revert <sha>` → push → re-plan the step.

## 6. Boards (decisions 4, 6, 42)

| Wave | Assembled at | Content (from the specs) | Format |
|---|---|---|---|
| Weapons | M1, with M2's ranged additions | 09-combat-ai § boards | One iPhone-portrait board image, labelled A / B, plus ≤ 10 s clips per item |
| Creatures | M2, M3 | 09-combat-ai § boards; tick rates; starter effects | Same |
| Input / HUD | X1 | 10-sweeps X1 | Same |
| Audio | M1 | Nine Dragon's ambience, score and SFX | A listening page (Artifact, MP3s, per [[artifact-audio-pages]]) |
| Look | whenever a pose differs beyond noise | the pose triptych (before / after / diff) | Board |

- A board goes to Jake with SendUserFile + AskUserQuestion. One recommended option per item.
- An OK re-baselines exactly the boarded items in the harness (`scripts/parity.mjs --accept <item ids>`, with the item
  ids recorded in the commit).

## 7. Reporting

- **The plan's State line** is rewritten (not appended) at every row finish. It names the current row, the next row,
  the milestone count and the lines deleted so far.
- **At each milestone:** the summary (what moved, lines deleted, ratchet counts, budgets), the boards, and "play it on
  your phone" (42).
- **No silent stretches:** a decision Jake owns goes to him with the tool as it comes up ([[ask-with-tool]]).

## 8. Risk register

| Risk | Where | Guard | If it hits |
|---|---|---|---|
| The big move (F6) breaks the bakers silently | F6 | F1's alias spike, `check-paths`, the non-empty glob asserts, bake byte-identity in parity | Revert F6, fix the tool, redo |
| The harness is non-deterministic (flaky) | F2 | green twice on unchanged HEAD before anything moves; re-run once, quarantine with an owner | A flaky check blocks nothing only while quarantined, max 3 days, then fixed or deleted |
| iPhone memory regression (the E271 class) | any render change | budgets + GPU bytes in the nightly perf; the physical iPhone reading at each milestone that touched render or memory | Revert to the last milestone pin; no render optimisation ships without iPhone evidence (AGENTS.md) |
| Rapier 0.21 changes walks | F12 | walk + trails 0 stuck, nav bake `--check`, an iPhone load reading | Stay on 0.20 (pin) and file an ask; the engine hides Rapier, so it's one module |
| `macos-15` runner changes (image, Chromium) | F3 | image label and Chromium version pinned; baselines recorded on the runner | Re-baseline in one commit with a board only if pixels moved |
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
| X | X1–X8 | 4–5 (parts pulled earlier) | S1–S4 |
| Z | Z1–Z4 | 2–4 (Z3 may loop) | X |
| **Total** | | **~24–33 agent-days, ~3–5 weeks of wall clock** | |

The earlier "2–4 weeks" estimate is revised up. Since then the plan gained the council, S1.5's audio, X8, the harness
detail and the Z3 loop.
