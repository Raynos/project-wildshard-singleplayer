# Git in a shared checkout

Linked from [AGENTS.md → Version control](../../AGENTS.md). Up to ~10 agents (parallel Claude sessions, their subagents
and Codex builders) edit **one working tree, one git index and one local `main`** at once, with no worktrees.

## The rules

- **Commit early and often** with small commits. The scheduled push loop carries committed changes through the
  local gate below (G568); CI runs the full gate on the pushed revision.
- **The gpu-gate parity jobs run nightly and at milestones, not on every push** (Jake, 2026-10-09, after the process audit `progress/process/audit-2026-10-09/`); the node checks still run per push.
- **Coverage runs nightly and at milestones, not on every push** (Jake, G287, 2026-10-09): push CI runs the 8 vitest
  shards without `--coverage`; `.github/workflows/coverage.yml` instruments them, merges and runs the coverage ratchet
  at 09:23 UTC and on `gh workflow run coverage` (DEPLOY.md).
  Historical (E357 Z4): **The per-push CI gate** stays green: the `macos-15` parity jobs for every shard and the template, and
  the node checks (layers, ratchets, contracts, the asset audit, `gen-shards --check`). Keep the nightly
  `gpu-perf` run on Jake's Mac enabled.
- **Strict means strict.** `tsconfig.json` has every strictness flag on, and `.oxlintrc.json` is type-aware with every
  category at error and zero warnings allowed. Fix the type, never the gate: no `any`, no non-null `!`, no
  `@ts-ignore` / `@ts-expect-error`, no `as unknown as`, no tsconfig `exclude`, no blanket `oxlint-disable`. A per-line
  `oxlint-disable-next-line <rule> -- <reason>` only where the rule really is wrong there.
- **Never mutate what you didn't author.** No `git stash`, `checkout`, `restore` or `git rm` on others' files; leave
  everyone's uncommitted WIP alone. Verify before you claim: `git status`, `git log origin/main..main` (empty =
  shipped), and `version.json`.
- **Commit only with `scripts/commit.sh "message" -- <files...>` (D9/G584).** It marks new files intent-to-add
  and serializes Git's shared files with one short lock. Git commits only the named files and preserves unrelated
  shared stages. Name literal files, never a directory. A named file's entire working copy is committed: agree
  with its owner if it also contains another lane's hunk. Direct commits and private-index landings are retired.
  Pre-commit runs storage policy and one native oxlint invocation for TypeScript diagnostics and typed lint on
  changed source, with a five-second checker budget. No mirror, generator, build or test runs at commit.
  Fix a refusal and retry. Message conventions and the existing lock/legacy policies remain.
- **Commits are pushed by the scheduled loop (G568, Jake, 2026-10-21).** `scripts/push-loop.py` runs every
  60 seconds. Lanes commit their green source; `scripts/push-main.sh` requests one scheduled tick when needed.
  These are temporary coordinator processes, never launchd services (G582). `scripts/sp-tools.sh start` opens
  one Herdr pane named `sp-tools` with only push and lane-watchdog processes. The watchdog nudges sp-x7 every
  15 minutes to actively check CI, smoke and live (G585); there are no CI or smoke watchers.
  `scripts/sp-tools.sh stop` stops scheduling and drains active ticks; `status` identifies its owner.
  Tool source lives in `scripts/`; disposable tool logs live in `tmp/sp-tools/`. The pane inherits the current
  tool environment without version-pinned Codex PATH entries.
  Never run `git push` or start the retired carrier/full local push gate.
- **The local push gate has a 45-second ceiling and checks committed source only.** It selects related tests
  and runs them within the budget, without repeating pre-commit types or lint. Foreign working/staged edits
  never enter the candidate; no generation, build, product or mirror job runs here. A matching verified cache
  supplies generated test inputs; missing inputs defer those tests to CI openly. **CI is the full gate**,
  including complete types, generation, build and tests. sp-x7 remains release owner and checks every 15 minutes.
- **A red commit is ejected back to its lane; the checked green prefix can still push.** The loop attributes the
  refusal, checks the prefix within the same budget, pushes that prefix and sends the owner a Herdr message beginning
  `[push-loop]`, naming the phase, offending SHA and `tmp/push-loop/current.log`. The offending commit and its suffix
  stay on local `main`; no commit, ref or history is rewritten. Fix forward and commit; the next tick retries.
  Inspect the last result in `tmp/push-loop/current.log` or `.git/push.log`: `bad` names the attributed commit and
  `tip` names the checked/pushed revision. `git log origin/main..main` shows what remains local. Repeated unknown
  refusals produce a Herdr notice after three matching failures. sp-x7 reports CI failures with the SHA and job.
  Pending binary still counts toward the storage policy's 10 MB per-push budget.

G568 replaces the former carrier, push lock, prefix retry and full local push execution described by the older tooling
notes below. Their generation, witness, storage, approval and deploy requirements remain in force; the wider Phase 2.5
rewrite still needs Jake's approval.

- **Builders commit source only (E435 SF6b).** Leave `lint/layer-edges.json`, ratchet debt counts and
  `scripts/README.md` to the serialized pusher. `lint/api-surface.json`, `docs/api/*.md` and the export index
  `docs/api/EXPORTS.md` (once ENGINE.md's appendix) are build outputs that `pnpm gen` writes, gitignored (SF74 W13, G281).
  It renders a clean committed export into a private index, retries a moved HEAD, and lands one generated commit
  before the gate. Working and staged edits from another builder stay untouched; never hand-merge these outputs.
  Shared-index alignment waits at most 30 s, reporting the holder PID and lane when identifiable. It holds Git's
  index lock only while comparing and atomically replacing unchanged generated entries; hooks run outside that lock.
  A peer's staged content, including a newly generated path, is preserved; a timeout leaves the peer lock intact.
  Write JSDoc and manual API explanations with the source. The gate checks the complete committed docs before
  Vercel filters them out, and refuses stale bytes or generated edits outside the regeneration commit.
  The pusher pushes **exactly the tip it regenerated** (`git push origin <sha>:refs/heads/main`); a commit landing
  meanwhile goes in its next loop, so the gate never sees an unregenerated tip (the "Ratchet rose: … is clean" reds).
  A regeneration commit it built is stamped in `.git/generated-verified/`, and the gate skips its duplicate check
  for that SHA only (57-107 s). When a builder tip is already current, the pusher runs the complete generated-output,
  predecessor-policy and exact-receipt check on its existing committed export before deleting it. It records that
  exact SHA separately in `.git/generated-checked/`; the gate reuses only that completed generated check, retaining
  its independent ratchet check. An absent or mismatched receipt runs the normal clean-export check.
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
  canonical `Generated-Increase` trailer. Long receipt lines use one-space continuations; the verifier rejoins their
  exact bytes before comparing rows, and still accepts historical single-line receipts. Regeneration uses the
  subject `chore(gen): refresh committed outputs` and copies its exact source commit's `Assisted-by` trailer. A source
  with no attribution produces no attribution trailer; only that regeneration's hook invocation gets `SKIP_ATTRIB=1`.
  The automation never assigns its own model to another lane's work. The receipt may also carry standing rules,
  `"standing": [{ "kind": "graph", "key": "<RegExp source>" }]`: a measured row a rule covers needs no exact entry,
  so a count that keeps moving does not stall the push; the trailers still list the exact rows. **A shard's downward
  imports (shard → engine / game / sdk / commons) are not counted at all** (Jake, G288, 2026-10-09:
  `APPROVED_DOWNWARD` in `scripts/check-graph.mjs`; their rises made ~80 regeneration commits a day): upward imports stay
  refused by the `layer` / `shard-sandbox` lint rules, one shard reaching into another by the reach check, and
  every other layer pair is still counted. Pass the coordinator's `.git/generated-approval.json` to `push-main.sh` as `GENERATED_APPROVAL_FILE`. Hard rules,
  zero-debt promotion and ambient checks stay fatal.
- **Source guards require their pinned JSON.** Pre-commit and the detached commit ratchet copy only JSON whose bytes
  match the immutable tree's generation catalogue. Missing pins refuse before lint, naming the output and job;
  run `pnpm gen` before retrying. Hooks never run producers. The detached reader clears Git-local overrides and
  loads source and dependency helpers from the requested commit; an incomplete export reports `REFUSED`, never a
  debt rise. This refusal also covers historical helpers that silently skipped missing outputs.
  An advisory rise fully covered by the coordinator's exact receipt reports `APPROVED` without a blocker ping;
  regeneration and every push gate still run. Hard rules, unknown failures and partly covered rises remain red.
- **No tree-wide destructive git, no escape:** `git restore .` / `checkout .`, a bare `git stash`, `git reset --hard`
  and `git clean -f` without paths are blocked. Name the paths you authored.
- **Keep pushes small: the storage policy** ([STORAGE.md](STORAGE.md)). `scripts/repo-size.mjs` runs in pre-commit
  (the commit's own index), in pre-push over every outgoing commit before the Vercel gate (`SKIP_VERCEL_GATE` does not
  skip it) and in CI (`.github/workflows/storage.yml`): blobs ≤ 1 MB unless exactly pinned, preview images ≤ 250 KB
  (boards 500 KB; save JPEG / WebP), no video / audio / archive / `.jsonl` / PDF / `.blend` outside `public/`, no
  generated paths, ≤ 10 MB of new binary per push and a 100 MB a week warning outside the runtime roots. Existing debt is
  grandfathered until it changes. `.gitattributes` marks binaries `-delta`.
- **WHAT'S NEW is at most 24 h stale** (E482): pre-push runs `scripts/whats-new-fresh.mjs <sha>` on every push to
  main and refuses when `src/game/whatsNew.json`'s `updated` is missing, unparseable, over 1 h ahead or over 24 h old;
  rewrite its 3–5 lines with what changed in the playable build, set `date` / `updated` to now, commit and push again.
- **Full-gate reference (G359/G363; local execution superseded by G568 above).** The former `scripts/local-gate.py`
  builds the exact pushed commit in the build mirror's `gate` slot (Vercel's tree) and runs, in order:
  `pnpm gen`; `check-graph --source-only`; the changed roots' types in the scripts / api / admin /
  drafts projects (the root project's full `tsc --noEmit` runs inside the build); oxlint on the
  changed files; **only the tests that import the changed files** (`scripts/gate-related-tests.mjs`,
  `vitest related` on 4 workers, capped at ~45 s estimated: files named after a changed source first,
  then cheapest first, the rest to CI; Jake, 2026-10-15); and `pnpm build` under the gate's own
  `push-gate` lease, so it never queues behind a lane's build. **The full suite runs in CI on every
  code push** (`deploy.yml`'s `behaviour` job), fix-forward: a transitive break the related walk
  missed shows up there; fix it like any red run. Each step's seconds print and land in
  `.git/push-gate-steps.jsonl`; a passed SHA is stamped in `.git/build-gate-g416/`. Required exact-SHA
  boot smoke retains WebKit rendering, every public shard, and the road into Signal. Production
  selects only a CI-green and smoke-green commit.
- **Source checks:** pre-commit checks the pathspec's named files and refuses if they change during the check.
  The scheduled push gate checks immutable committed candidates in disposable source snapshots, preserving the
  shared working tree and index. Missing generated test inputs follow the explicit cache-miss rule above.
- **Disk-reading tests declare their products** in `scripts/test-products.json`.
  The related-test walk retains their author-source edges; CI and batch checks
  verify/rebuild selected products with `--reuse --shard=…`. The scheduled local
  gate defers these product-reading tests to CI. Cold runtime fixtures read the
  complete outputs rather than hand-listing boot dependencies; unregistered disk scenarios refuse. Mirror sync
  retains admitted producer groups, invalidates incomplete groups for the next
  generation pass, and removes retired outputs, including ignored metadata.
- **Pushes never regenerate outputs** (G367, replacing hourly batching).
  Generated outputs belong to the commit that changes their inputs. The
  regeneration bot no longer runs in `push-main.sh`; the scheduled loop can release a checked green prefix.
- **Hooks on:** every checkout runs `git config core.hooksPath .githooks` once (the session brief warns when it's off).
  The pre-commit hook also runs the architecture guards and `scripts/asks.mjs check`; commit-msg runs the lock check and
  the legacy-shard check (no plan-State check since 2026-10-09, [ASKS.md](ASKS.md)). Its storage check (`scripts/repo-size.mjs
  --index`, [STORAGE.md](STORAGE.md)) refuses raw soak / receipt archives (`.gz` / `.br` / `.zst` / `.jsonl`,
  [MACHINE.md](MACHINE.md)) anywhere outside `public/`. Claude hooks live in `.claude/settings.json` and take effect on restart.
- **Never open a shared file for writing before you've read it.** `open(p, 'w').write(f(open(p).read()))` truncates
  first and reads nothing: it emptied 16 files once (src/main.ts with others' WIP, lost) and wiped the ASKS table once.
  Read into a variable, check it is non-empty, then write. Append with `>>` or Edit, never `>` onto a shared file.
- **Kill only what you started, by PID.** Never `pkill -f vite` / `pkill -f chrome`: it takes down every agent's
  servers and browsers. Note `$!` when you start something, or `lsof -ti tcp:<port>` and check `ps -o args=` first.

## Recipes and traps

- **Ask ids:** use the path `scripts/ask-new.sh` prints (`f=$(scripts/ask-new.sh "…")`). Never predict the next number:
  parallel sessions claim ids in the same second. Claim in the main checkout, never in a worktree behind main (E105
  was handed out twice that way).
- **A clean tree needs `node scripts/gen.mjs`** before raw `tsc` / `oxlint`: `src/**/*.generated.*` is gitignored and
  CI's `pnpm run typecheck` / `lint` run `pnpm gen` first. Never export: run it in the build mirror,
  `node scripts/build-mirror.mjs run HEAD [--slot name] -- <cmd>` (HEAD without art/progress/sources, ~0.9 GB once,
  synced file by file; generated files persist between runs).
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
- **No worktrees, feature branches or landings by default** (Jake, 2026-10-15). Everyone, subagents included, commits
  to `main` in this checkout. A worktree is only for an exceptional case Jake approves: under `./tmp`, removed when
  done, never pushed. Exact-commit checks use the build mirror (`node scripts/build-mirror.mjs run <rev> -- <cmd>`).
- **New npm deps:** `pnpm install --frozen-lockfile --prefer-offline --config.enable-global-virtual-store=false` in the
  checkout first, or the gate refuses the push.
- **Deleting a branch** (`git branch -d`) is blocked for agents by dcg. Check it is merged, prune its worktree, and hand
  Jake the one-line `! git branch -d …` command.
