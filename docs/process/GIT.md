# Git in a shared checkout

Linked from [AGENTS.md → Version control](../../AGENTS.md). Up to ~10 agents (parallel Claude sessions, their subagents
and Codex builders) edit **one working tree, one git index and one local `main`** at once, with no worktrees.

## The rules

- **Commit early and often** with small commits; the commit pushes itself (below). Before you push, HEAD
  must pass the CI gates on a clean export of the tree (`tsc --noEmit`, `oxlint`, `node scripts/check-css.mjs`,
  `vite build`), not just the files you touched. The pre-push gate does this for you (below).
- **The gpu-gate parity jobs run nightly and at milestones, not on every push** (Jake, 2026-10-09, after the process audit `progress/process/audit-2026-10-09/`); the node checks still run per push.
  Historical (E357 Z4): **The per-push CI gate** stays green: the `macos-15` parity jobs for every shard and the template, and
  the node checks (layers, ratchets, contracts, the asset audit, `gen-shards --check`, coverage). Keep the nightly
  `gpu-perf` run on Jake's Mac enabled.
- **Strict means strict.** `tsconfig.json` has every strictness flag on, and `.oxlintrc.json` is type-aware with every
  category at error and zero warnings allowed. Fix the type, never the gate: no `any`, no non-null `!`, no
  `@ts-ignore` / `@ts-expect-error`, no `as unknown as`, no tsconfig `exclude`, no blanket `oxlint-disable`. A per-line
  `oxlint-disable-next-line <rule> -- <reason>` only where the rule really is wrong there.
- **Never mutate what you didn't author.** No `git stash`, `checkout`, `restore` or `git rm` on others' files; leave
  everyone's uncommitted WIP alone. Verify before you claim: `git status`, `git log origin/main..main` (empty =
  shipped), and `version.json`.
- **Commit with a pathspec, never from the shared index.** `.claude/hooks/guard-git-add-all.sh` enforces it:
  - an edit to a tracked file is never staged; commit it directly with `git commit -m "…" -- path/a path/b`;
  - `git add` only a **new** file, then the same pathspec commit;
  - blocked: `git add -A` / `.` / `-u`, `git add <tracked file>`, `git commit -a`, and any `git commit` without
    `-- <paths>`. Rare escape: `SKIP_SWEEPGUARD=1`; every use lands in `project/sweepguard-ledger.md`.
  - A pathspec commit takes the **whole file**. If the file also carries another agent's uncommitted hunk, wait for
    them, or commit only your hunks through a private index (`.claude/skills/prepare-to-exit/SKILL.md` step 1).
- **Pushes are automatic** (SF74 W14, 2026-10-09: commit → origin was p90 54 min because nobody ran the pusher).
  `.githooks/post-commit` records the commit's herdr pane in `.git/commit-lanes.jsonl` and starts `scripts/auto-push.sh`
  detached: single-instance, it waits 10 s to batch a burst, waits out `.git/quiet` (the coordinator's measurement
  windows), then runs `scripts/push-main.sh` queued behind any push in flight (`PUSH_WAIT=1`), with
  `.git/generated-approval.json` as `GENERATED_APPROVAL_FILE` when the coordinator keeps one. A red push is not retried
  on the same tip: it pings each lane whose commit is in the red range once (the coordinator when none is known, or for
  a missing approval receipt) and waits for the next commit. Log `.git/auto-push.log`, each run's output in
  `.git/auto-push/`; off switch `touch .git/auto-push.off`. Commits that never ran post-commit (a private-index
  `update-ref` landing) go up with the next commit, or run `scripts/push-main.sh` yourself.
- **Push with `scripts/push-main.sh`, never `git push`** (enforced by `.claude/hooks/guard-bash-safety.sh`). It takes
  `.git/push.lock`. If another push holds the lock, your commits stay local and it exits 0: that push re-checks
  `origin/main..main` before it lets go, so it carries yours. Rare escape: `SKIP_PUSHLOCK=1`. `push-main.sh` and
  `vercel-tree-gate.sh` run from a private snapshot copy, so editing them mid-push can't break the live push; still
  copy gate edits in only when `pgrep -f vercel-tree-gate` is empty.
- **Builders commit source only (E435 SF6b).** Leave `lint/layer-edges.json`, ratchet debt counts and
  `scripts/README.md` to the serialized pusher. `lint/api-surface.json`, `docs/api/*.md` and the export index
  `docs/api/EXPORTS.md` (once ENGINE.md's appendix) are build outputs that `pnpm gen` writes, gitignored (SF74 W13, G281).
  It renders a clean committed export into a private index, retries a moved HEAD, and lands one generated commit
  before the gate. Working and staged edits from another builder stay untouched; never hand-merge these outputs.
  Write JSDoc and manual API explanations with the source. The gate checks the complete committed docs before
  Vercel filters them out, and refuses stale bytes or generated edits outside the regeneration commit.
  The pusher pushes **exactly the tip it regenerated** (`git push origin <sha>:refs/heads/main`); a commit landing
  meanwhile goes in its next loop, so the gate never sees an unregenerated tip (the "Ratchet rose: … is clean" reds).
  A regeneration commit it built is stamped in `.git/generated-verified/`, and the gate skips its duplicate check
  for that SHA only (57-107 s); every other tip is still checked.
- **Witness input hashes are the pusher's too.** `scripts/witness-manifests.mjs` re-records every stale
  `test/proof/<slug>/checkpoints/manifest.json` with its real recorder on the same clean export, beside the generators
  (~12–18 s, hidden behind them; verified triples cached in `.git/witness-verified/`), and puts the new `inputs` in the
  regeneration commit only when every payload and recorded outcome is byte-identical. Any other byte fails the push,
  naming the shard and payload: a behaviour change rebakes on purpose (`run.mjs checkpoints`) with its source.
  Pre-commit refuses a builder's input-only manifest refresh; a locally stale `fresh` test is the pusher's to fix.
  The same holds for committed bakes that record their input hashes (`scripts/bake-input-hashes.mjs`, SF74 W22: the King
  collision bake): the pusher re-runs the bake on the clean export and commits new hashes only when nothing else changed.
- **Policy is source, never generated.** Ratchet allow lists, budgets and Debug-row caps require the coordinator's
  reviewed source commit. SF2 `lint/shard-coupling.json` and historical allowances remain shrink-only. Debt and
  graph reductions regenerate automatically; increases warn in pre-commit and require the coordinator's exact
  receipt at push: `GENERATED_APPROVAL_FILE=<absolute-json-file> scripts/push-main.sh`. The JSON contains
  `approver: "wildshard-new"` and the exact `increases` list printed by the runner; it refuses absent, duplicate,
  extra or stale entries. The generated commit records `Generated-Source`, `Generated-Approver` and each
  canonical `Generated-Increase` trailer. The receipt may also carry standing rules,
  `"standing": [{ "kind": "graph", "key": "<RegExp source>" }]` (e.g. a shard's downward imports): a measured row a rule
  covers needs no exact entry, so a count that keeps moving (811 → 813 → 816) does not stall the push; the trailers
  still list the exact rows. The auto-pusher passes the coordinator's `.git/generated-approval.json`. Hard rules,
  zero-debt promotion and ambient checks stay fatal.
- **No tree-wide destructive git, no escape:** `git restore .` / `checkout .`, a bare `git stash`, `git reset --hard`
  and `git clean -f` without paths are blocked. Name the paths you authored.
- **Keep pushes small.** `.githooks/pre-commit` refuses a `progress/` image over 500 KB (save JPEG / WebP) and any
  `.blend`. `.gitattributes` marks binaries `-delta`.
- **The pre-push gate builds what Vercel builds.** `.githooks/pre-push` runs `scripts/vercel-tree-gate.sh` on the tip
  you push (stamped per commit, so a passed SHA never reruns); `push-main.sh` runs it before it opens the `git push`, so the hook only finds the stamp (SF74 W20: GitHub dropped the idle SSH session after a 385 s gate): only the files `.vercelignore` lets through, then
  check-css, typecheck, oxlint, the ratchet, the audits, bake-check, vitest, liveness and vite build, **in parallel**,
  each printing its own wall time. Jake's budget is **≤ 2 min for the whole push** (E454: ~65 s for the gate plus
  ~17 s for the regeneration on 2026-10-07); a step that pushes it over moves to CI, never silently away. It refuses
  the push when `.vercelignore` would drop anything under `src/`, `public/`, `api/` or `scripts/`; anchor every
  `.vercelignore` line with `/` (E41). A red gate is yours to fix before the push. Rare escape: `SKIP_VERCEL_GATE=1`.
  **Gate cache** (`scripts/gate-cache.mjs`, state in `.git/gate-cache/`): bake-check and the node audits skip when every
  file they read last time (traced by `scripts/gate-trace.mjs`) is byte-identical, and vitest runs `vitest related` on
  the files changed since its last green gate, plus every test whose text (or a test fixture's) names a changed file:
  spawned scripts and fixtures sit outside vite's import graph (SF74 W12). Timings land in `.git/gate-timings.jsonl` and
  `.git/push-timings.jsonl`. Every 8th gate, 6 h after the last full one, a package / config /
  test-setup change, a deleted module and `GATE_FULL=1` run everything; CI always does (2026-10-09: 277 s → 57 s).
- **Hooks on:** every checkout runs `git config core.hooksPath .githooks` once (the session brief warns when it's off).
  The pre-commit hook also runs the architecture guards and `scripts/asks.mjs check`; commit-msg runs the lock check and
  the legacy-shard check (no plan-State check since 2026-10-09, [ASKS.md](ASKS.md)). The pre-commit hook refuses new raw
  soak / receipt archives under `progress/` (`.gz` / `.br` / `.zst` / `.jsonl`, [MACHINE.md](MACHINE.md)). Claude hooks live in `.claude/settings.json` and take effect on restart.
- **Never open a shared file for writing before you've read it.** `open(p, 'w').write(f(open(p).read()))` truncates
  first and reads nothing: it emptied 16 files once (src/main.ts with others' WIP, lost) and wiped the ASKS table once.
  Read into a variable, check it is non-empty, then write. Append with `>>` or Edit, never `>` onto a shared file.
- **Kill only what you started, by PID.** Never `pkill -f vite` / `pkill -f chrome`: it takes down every agent's
  servers and browsers. Note `$!` when you start something, or `lsof -ti tcp:<port>` and check `ps -o args=` first.

## Recipes and traps

- **Ask ids:** use the path `scripts/ask-new.sh` prints (`f=$(scripts/ask-new.sh "…")`). Never predict the next number:
  parallel sessions claim ids in the same second. Claim in the main checkout, never in a worktree behind main (E105
  was handed out twice that way).
- **A clean export needs `node scripts/gen.mjs`** before raw `tsc` / `oxlint`: `src/**/*.generated.*` is gitignored and
  CI's `pnpm run typecheck` / `lint` run `pnpm gen` first. Export with
  `git archive HEAD -- . ':!art' ':!progress' ':!sources'` (~0.7 GB, not 3.3 GB).
- **CI-only node checks:** `pnpm test`'s check-paths, audit-assets, check-model-sources and webgpu-inventory don't run
  in the pre-push gate (its tree drops paths they read). After moving fixtures or editing an allowlist, run
  `node scripts/check-paths.mjs` yourself.
- **Your CI run:** with ~10 agents pushing, `gh run list --limit 1` is often someone else's run, and a newer push
  cancels the pending run of an older one. Pick yours by `headSha`
  (`gh run list --json databaseId,headSha -q '.[]|select(.headSha|startswith("<sha>"))'`); if it was cancelled, check
  `git merge-base --is-ancestor <yours> <live sha>`.
- **`pnpm add`** dies with `ERR_PNPM_UNEXPECTED_VIRTUAL_STORE`. Don't reinstall (everyone shares `node_modules`): use
  `pnpm add <pkg> --config.enable-global-virtual-store=false`, then pathspec-commit `package.json` + `pnpm-lock.yaml`
  after checking `git diff HEAD` shows only your lines.
- **After a private-index commit** (`GIT_INDEX_FILE=… read-tree` → `commit-tree` → `update-ref`), the shared index still
  holds the old blobs and reads as a staged revert. For each committed path not staged by someone else:
  `git update-index --cacheinfo 100644,$(git rev-parse HEAD:<path>),<path>`. Then write HEAD's copy of each path
  you landed, so a stale disk copy can't revert it in someone's later pathspec commit.
- **Feature worktrees never push.** A worktree is local development; the main checkout lands it. A playable preview of
  a branch deploys a clean export to its **own** Vercel project, never the main one.
- **Landing a worktree or a subagent's branch:**
  1. `git worktree add --detach <scratch>/landN <main tip>` → `git cherry-pick <merge-base>..<branch>` → gate.
  2. `git update-ref refs/heads/main NEW OLD` (atomic: it refuses if main moved). Write only the changed files from
     NEW, `git merge-file` 3-way for files with someone's uncommitted hunk, then `git reset NEW -- <paths>`.
  3. `scripts/push-main.sh`. A big binary landing goes up first to a side branch
     (`SKIP_PUSHLOCK=1 git push origin <sha>:refs/heads/<x>-upload`), then the main push sends almost nothing.
  4. New npm deps: `pnpm install --frozen-lockfile --prefer-offline --config.enable-global-virtual-store=false` in the
     main checkout first, or the gate refuses the push.
  - Never chain `cd <worktree>` with `;` after a fallible step: when the add fails, the rest runs in the main checkout.
    Use `&&` or `git -C`.
- **Deleting a branch** (`git branch -d`) is blocked for agents by dcg. Check it is merged, prune its worktree, and hand
  Jake the one-line `! git branch -d …` command.
