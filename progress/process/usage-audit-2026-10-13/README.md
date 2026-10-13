# 12 h usage and wall-clock audit (2026-10-12 09:42 → 21:44 local)

Read-only. Jake: *"I'm still really worried about how to make building this plan more token efficient, use less
usage, go faster wall clock time … getting the push green, getting the push off the machine, so important … trim and
cull and keep things simple, KISS, DRY."*

**Sources:** every Claude transcript in the window (75 sessions: the coordinator `6d7cc37d`, its 66 subagents, the plan
agent `81cffee4`, 7 small mains), with usage deduplicated per message id; 8 Codex rollouts (`token_count` deltas inside
the window, weekly-limit %); `git log` (440 commits); origin's reflog; `.git/auto-push.log` + `.git/auto-push/*.log`;
`.git/push-timings.jsonl`, `.git/gate-timings.jsonl`, `.git/commit-hook-times.jsonl`; `red-green.md`; STATE.md.
**Activity ran 14:54 → 21:44 local (6.8 h); the machine sat idle 10:17 → 14:54.** So these are 6.8 h numbers.
Dollars are API-equivalent at Opus list rates ($5 in · $6.25 cache write · $0.50 cache read · $25 out per M), only
to rank the sinks against each other.

## The numbers

| | Claude | Codex |
|---|---|---|
| Tokens | 2,198 M cache read · 23 M cache write · 5.5 M out · ~0 fresh | 576 M input (98.5 % cached) · 1.7 M out |
| Cost / limit | ≈ $1,381 API-equivalent; **cache read is 80 %** of it | weekly limit **82 % → 93 %** (11 points in 6.8 h) |
| By lane | coordinator **$321 (23 %)** · 66 Opus subagents **$980 (71 %)** · plan agent $72 (5 %) · misc $30 | sp-x6 28 % · **sp-x7 (push lane) 27 %** · two build lanes 17 % + 16 % · sp-x1 10 % |

| Wall clock | Measured | 10-09 baseline / target |
|---|---|---|
| Commit → origin | **median 51 min, p90 129 min, max 161 min**; 46 commits not on origin now (oldest 51 min) | 6.2 / 15.6 min → ≤ 2 / ≤ 5 |
| Auto-push runs | 45 started: **3 green, 23 red, 19 superseded or killed**; 17 origin updates in all (most by hand-run `push-main.sh`, 2 green prefixes) | — |
| Push-lock time | **275 min on red runs**, 25 min on green | — |
| Origin frozen | 15:41 → 18:05 (**2 h 24 min**), 21:01 → now | — |
| Gate (35 runs) | **17 green**; median wall **492 s**, max 668 s; **23 of 35 ran the full vitest** | G359: ≤ 120 s |
| Commit hooks | 510 runs, median 0.3 s, p90 7 s, 22 min in all, 34 refusals | fine |

## Ranked findings

### 1. The push is a local, serial, whole-suite gate on a tip that ten writers move; it is red most of the time

- **Measured:** 23 of 26 decided auto-push runs red; 275 min of push-lock time burnt on reds; commit → origin median
  51 min (8× worse than 10-09). Codex sp-x7, whose only job is the push, is 27 % of Codex spend (154 M tokens, 858
  turns); sp-x6 (28 %) spent much of its day on gate reds too (red-green rows).
- **Why it is red** (23 auto-push reds plus ~35 red-green rows dated in the window):
  - **Committed derived outputs went stale (~14 rows; the biggest class):** physics `*.baked.json`, spots, maps, map
    stamps. A lane changes a shared input (`worldHost.mjs`, `bakedWorld`, `placeholder.ts`, `director.ts`) and the bake
    of *another* shard goes stale. 98 commits in the window touch baked files. Each bake step costs 1–2 s in the gate.
  - **Exact-value tests (~8 rows):** byte totals (`expected 55075024 to be 51835024`, with a `// G345: +115,200 …`
    comment per change), closure counts (`44 > 43`), "keys the exact confined deckCaps closure", viewmodel snapshots,
    canonical-run tick counts. They pin how the code is shaped, so every refactor in this plan breaks them.
  - **Receipt ceremony (8 runs):** "a generated measurement rose and needs the coordinator's receipt": 5 reds in
    6 min (21:28–21:35) as auto-push retried the same refusal on every new commit.
  - **Push-time regeneration in a temp export failed (3)**, lint (~5), exports/docs (~4), harness/infra (~6).
- **Why it is slow:** vitest is **365 s median of a 492 s gate (74 %)**. "Related since vitest last passed" means one
  red makes every following gate a full suite, the full suite goes red again, and so on: 23 of 35 gates ran full. The
  rest of the critical path is ~125 s (shardfiles 28 s, oxlint 27 s, navmesh 17 s, geometry 12 s, x64-digests 11 s,
  voxel-AO 10 s, webkit 8 s, vite 7 s). **The 2-minute cap (G359) cannot be met while the push runs vitest at all.**
- **Head-of-line blocking:** pushes batch 14–220 commits ("220 ahead"). One red commit holds everyone's work, and the
  green prefix rescued only 2 runs.

**The KISS fix: CI is the gate; the push leaves the machine at once.**
1. Pre-push keeps only what fits in ≤ 2 min: typecheck of the changed layers, oxlint of the changed files, and the
   ≤ 1 s commit checks of G358 (already at commit). **No vitest, no bakes, no regeneration, no receipts at push.**
2. The full suite, the bakes check and the builds run in CI, as they already do. **Production is already protected:**
   the deploy ships only a CI-green, smoke-green exact SHA (`deploy-pin.json`), so a red `main` never reaches players.
3. A red CI pings the committer's lane, which fixes forward (they own it, as today). Auto-push never retries a red
   whose cause hasn't changed.
4. Delete what that makes dead: push-time regeneration and its `chore(gen)` commits, green-prefix bisection, the
   `generated-approval.json` receipt (G349 already made debt shrink-only: fail the commit, don't stall the push), the
   quiet window, and the push lane.
- If Jake wants `main` never red: push to `origin/incoming` with no gate and let a CI job fast-forward `main` when the
  suite passes (a merge queue). It also gets the push off the machine, but it is new plumbing; step 1–4 is simpler.
- **Saving:** commit → origin from 51 min to ~2 min; ~5 h of push-lock and gate CPU per 7 h off an 18-core machine
  that already runs at load 40–120; most of sp-x7's 27 % and much of sp-x6's 28 % of Codex.

### 2. Committed bakes go stale because nobody regenerates them at commit

- **Measured:** ~14 red rows, 98 baked-file commits, recapture commits by other lanes ("official Node recapture", "all-native
  recapture").
- **Fix (G358 in spirit):** the pre-commit hook re-runs the bake of every shard whose bake inputs the commit touches
  (physics, spots and map bakes take 1–2 s each in the gate's own timings) and adds the outputs to the same commit; or build them in CI / Vercel and stop
  committing the cheap ones. The "freshness" class of red then cannot happen.
- **Saving:** ~40 % of push reds; the recapture commits and the lane turns spent finding the stale shard.

### 3. Exact-value tests turn every refactor into a red

- **Measured:** ~8 red rows; each costs a lane a diagnosis, a proof that the game is unchanged ("0 px different"), a
  re-accept commit and a red-green row.
- **Fix:** replace exact byte totals, closure counts and code-shape snapshots with bounds (≤ the cap) or behaviour
  checks; delete the ones that only prove "the code is shaped as it was".
- **Saving:** ~25 % of push reds.

### 4. The coordinator's context is never trimmed

- **Measured:** 1,252 turns, average context ~470 k, peak **966 k**; 584 M cache-read tokens = **$321, 23 % of
  Claude**. It relays: 292 SendMessage, 63 Agent spawns, 111 commit commands, 14 STATE rewrites by heredoc, 14 `set-label.sh`
  calls (the rule says headline, not progress log).
- **Fix:** restart (or /compact) from STATE.md at ~200 k; lanes report ≤ 10 lines and land their own commits; the
  coordinator writes STATE at milestones, not every landing.
- **Saving:** ~60 % of its cost (~$190 per 7 h) and faster turns.

### 5. Lanes poll, capture and re-test in the shared tree

- **Measured:** 66 subagents (Opus), 27.8 wall-h, 15.7 h inside tool calls: **captures 5.2 h (677 calls), polling
  4.6 h (293 `until`/`sleep`/`index.lock` loops)**, vitest 1.6 h (423 calls), commits 1.2 h (267 calls, ~16 s each,
  index-lock waits). Every poll turn re-reads a ~190 k context.
- **Fix:** the hook that refuses `until … sleep` / `sleep N` loops (proposed 10-09, never enforced); waits go through
  `scripts/proof-run.sh` (it pings when done) or Monitor. One capture per proof, not re-shoots.
- **Saving:** ~360 turns (≈ 70 M cache read, ~$35) and ~4.6 lane-hours per 7 h.

### 6. Duplicate work: one board, six lanes

- **Measured:** the main-menu hero board ran through **6 lanes** (hero round 3, round 4, "verify near tier + hero r4",
  "ocean clip + hero r4 entered", "hero round 4 re-shoot" at $52, "square 1×-FOV hero"): **$127, 9 % of Claude**, still
  waiting on Jake's pick. The looks verifications ran three times ("Verify rig loader looks", "Verify plugin-host
  looks", "Looks lane 2: verify").
- **Fix:** one owner per board (the plan agent makes pick boards, per the existing rule); a board is shot once per
  round and re-shot only after Jake's note.
- **Saving:** ~$100 per 7 h.

### 7. Bookkeeping is a third of all commits

- **Measured:** of 440 commits: **STATE.md 51** (7.5 an hour, for a ≤ 3 KB file), **red-green.md 46**, `chore(gen)`
  regeneration bot **31**, `chore(git): record sweep-guard bypasses` **20**, plan file 18 = **~166 (38 %)**. Each one
  holds the index, runs the hooks, starts an auto-push and costs a coordinator or lane turn.
- **Fix:** STATE at most hourly or per milestone; the red log is written by the pusher into `.git/` (it already has
  every fact), not by hand; the sweep ledger and generated outputs leave git (finding 1 deletes `chore(gen)`).
- **Saving:** ~140 commits per 12 h, with their pushes, and ~100 coordinator turns.

### 8. The fleet is bigger than the rule and partly idle

- **Measured:** up to **6 concurrent Opus subagents** (AGENTS.md: 3 per session; the SHARD-PLATFORM exception is 5) plus
  5 Codex lanes; 2 subagents passed the 400 k cap (439 k, 432 k) and 15 passed 300 k. One Codex lane sat idle **4.4 h
  of 6.8 h** (gaps over 5 min), sp-x1 1.7 h of 4.0 h. Every extra lane adds shared-input collisions, which are the
  reds of finding 2.
- **Fix:** 3 Opus + 2 Codex until the push is green; lanes end at ~250 k context; close idle Codex panes.
- **Saving:** ~30 % of tokens (estimate) and fewer cross-lane reds.

Smaller, not ranked: the plan agent waited 3.3 h on 10 AskUserQuestion calls (Jake's time, not waste) at a 785 k peak
context ($65); the docs a lane opens are large (SHARD-PLATFORM.md 396 KB; at least 368 mentions in subagent transcripts,
mostly by `grep`/`sed` ranges, which is fine).

## Top 8 cuts

| # | Cut | Saving per ~7 h of work |
|---|---|---|
| 1 | **CI is the gate:** pre-push ≤ 2 min (typecheck + changed-file lint), no vitest / bakes / regeneration / receipts at push; red CI pings the committer | commit → origin 51 → ~2 min; ~5 h of push-lock / gate CPU; most of the push lane (27 % of Codex) |
| 2 | **Bakes regenerate at commit** for the shards whose inputs changed (or build in CI) | ~40 % of reds; the recapture commits |
| 3 | **Bounds, not exact values**, in byte / closure / snapshot tests | ~25 % of reds |
| 4 | **Coordinator restarts from STATE at ~200 k**; no relaying; STATE per milestone | ~$190 (60 % of the coordinator) |
| 5 | **No polling** (enforce the hook; proof-run or Monitor only) | ~360 turns, ~4.6 lane-h |
| 6 | **One owner per board**; no re-shoots without a note from Jake | ~$100 (hero board alone was $127) |
| 7 | **Delete ceremony commits:** STATE hourly, red log by the pusher in `.git/`, no `chore(gen)` / sweep-ledger commits | ~140 commits / 12 h |
| 8 | **3 Opus + 2 Codex** until push is green; close idle panes; lanes end at ~250 k | ~30 % of tokens (estimate) |

## Questions for Jake

1. **Can CI be the gate, with `main` allowed to go red for minutes while production keeps shipping only CI-green
   SHAs?** Recommend **yes** (cut 1). The alternative, a merge queue to an `incoming` branch, keeps `main` always green
   but adds plumbing.
2. **Do committed bakes regenerate at commit time for the shards whose inputs changed?** Recommend **yes**; the
   expensive bakes (navmesh, voxel AO) stay committed and checked in CI.
3. **May lanes turn exact byte / closure / snapshot tests into bounds or delete them?** Recommend **yes**, keeping
   tests that check behaviour (a fight finishes, a shard reaches ready).
4. **Shrink the fleet to 3 Opus + 2 Codex until a week of green pushes?** Recommend **yes**; the push lane closes once
   cut 1 lands.
