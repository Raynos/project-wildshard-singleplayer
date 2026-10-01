# E357 builder brief — common rules (every subagent and Codex pane)

You are one builder of **GAME-NORMALIZATION v2** (ask E357), the repo-wide refactor of the Wildshard game into
engine / game / kit / shards. The lead session (Claude, herdr agent `wildshard-9`) owns the plan and gave you **one job**
(your job brief names it). Do it, commit it, report, and end.

## Read first (only what your job needs)
- `AGENTS.md` (repo rules: pathspec commits, no `git add -A`, no stash/checkout/restore of other files, push rules).
- `docs/plans/GAME-NORMALIZATION.md` (the index) — skim §2 for the target, then your row.
- `docs/plans/game-normalization/02-foundations.md` (or the spec file your brief names) — **your row's section in full**.
- `docs/plans/game-normalization/12-process.md` §0 — the autonomous-build overrides (decisions 101–109).
- `docs/plans/game-normalization/13-lead-resolutions.md` wins over a stale passage elsewhere; grep it for your row id.

## Overrides that win over the specs (decisions 101–109)
- **No parity runs, no browser runs** unless your job brief explicitly allows one smoke run. Parity and every slow test
  belong to the lead, in batches (decision 104). You run only fast checks: `pnpm exec tsc --noEmit -p .` (~1 s),
  `pnpm exec oxlint <your files>` (~1 s), and focused `pnpm exec vitest run <your test files>`.
- **`docs/tasks/asks/E357.md` is append-only from HEAD** (three handoffs were lost to stale copies on 2026-10-01): commit
  it only as HEAD's blob plus your own section's lines (a private index), never the working-tree copy wholesale.
- **Parity runs go straight to `node scripts/parity.mjs …`** (P1, a166dd8b): it takes a browser-lane slot per browser itself.
  Drop any `scripts/browser-lane.sh --max N` prefix a job brief shows; an outer wrapper wastes a slot and can stall a full lane.
  Since ca907933 the default clock is the proven fast driver (P1: full record 36 m → 6 m); `--clock=raf` only to compare
  with a capture taken on the old clock. Compares still show `/api/telemetry` 404s in `boot.errors` (no backend on the preview).
- Where a spec says "the per-commit parity run", skip it and write `Parity: queued for the lead` in the commit message.
- P1 clock: fast is the proven default; `--clock=raf` explicitly selects native pacing for diagnosis. Compare uses one run; milestone records use three concurrent runs.
- Where a spec needs a long run (a browser capture, a bake in a GPU page, a model job, a CI dispatch), don't wait for it:
  commit what is done and report `queued: <exact command>`. The lead runs it.

## Commits (the shared tree: other builders are editing the same checkout right now)
- Commit **only your own files**, by pathspec: `git commit -m "<msg>" -- <paths>`; `git add <new file>` first for a new file.
  Never `git add -A`, `.`, `-u`, never `git commit -a`, never `git stash` / `checkout` / `restore` / `reset`.
- Before committing a file another builder may also touch (e.g. `package.json`, `src/main.ts`), run `git diff -- <file>`:
  if it shows hunks you didn't write, wait 2 minutes and look again; never commit someone else's hunk.
- Every commit message: `E357 <row>: <what>` + a blank line + body, ending with exactly this trailer block:
  ```
  Co-Authored-By: <your model> <noreply@…>
  E357-Lead: yes
  ```
  (the `commit-msg` hook `scripts/check-lock.mjs` refuses a commit without `E357-Lead: yes`).
- **Don't push.** The lead pushes (`scripts/push-main.sh`) after its batch run.
- Strictness: no `any`, no `!`, no `@ts-ignore`, no `as unknown as`; fix the type, never the gate (AGENTS.md).
- Before your last commit, `pnpm exec tsc --noEmit -p .` must exit 0 for the whole tree, and `pnpm exec oxlint` on
  every file you touched must report 0.

## Caps
- One job. Stop at ~90 minutes or ~200 turns, whichever comes first: commit what is done, write the handoff, report.
- Never wait on anything over ~4 minutes; report it as `queued: <command>` instead.

## Handoff and report
- On your first commit, append your own section to `docs/tasks/asks/E357.md`:
  `## Handoff (<date> <time>, <row> — <your agent name>)` with **Done** (commit SHAs + one line each, what is verified),
  **Next** (the exact next step, or `queued: <command>`), **Owns** (your files), **Learned** (gotchas), **Done when**.
  Update it at every commit. Never edit another section. `E357.md` is the one shared file where committing another
  builder's appended (uncommitted) section along with yours is fine: sections are append-only and never conflict.
- Your **final message** (≤ 40 lines): what landed (SHAs), what is verified, what is left, any `queued:` commands, and
  every place you had to guess (the lead logs it in 13).
