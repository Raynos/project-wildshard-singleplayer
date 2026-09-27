---
name: prepare-to-exit
description: User-invoked Wildshard session checkpoint. Commit only owned paths, verify the clean exported HEAD, push through the lock, confirm deployment, update ask and plan ledgers, and close browsers before reporting. Do not invoke automatically.
---

# Prepare to exit in Codex

Use this only when the user asks to prepare to exit or checkpoint the session. `AGENTS.md` is the source of truth; this is the Codex adapter for `.claude/skills/prepare-to-exit/SKILL.md`.

1. List the paths you authored and inspect their diffs and the shared index. Commit only your paths with `git commit -m "..." -- <paths>`; `git add` only new files. A shared file containing another agent's uncommitted changes needs that agent's release or an isolated private-index commit. Do not sweep the shared index or mutate others' work.
2. Before each push, run `tsc --noEmit`, `oxlint`, `node scripts/check-css.mjs`, and `vite build` on a **clean export of HEAD**, as `AGENTS.md` requires. The pre-push hook also checks Vercel's filtered tree and tests. Fix a red HEAD before pushing.
3. Push using `scripts/push-main.sh`. Wait for the deploy workflow, confirm `git log origin/main..main` is empty, and check production `version.json` for a build containing your commit.
4. Update each ask file's `**Status:**` and evidence, each live plan's State line, and queue any unfinished work in an open ask or live plan. Preserve unrelated staged and uncommitted files.
5. Close browser sessions and emulators you opened. Report commits, clean-export gates, CI and build id, ask states, remaining work, and whether your own work is safe to leave.

Codex can use the same repository scripts and Git hooks as Claude. Claude's terminal label, session memory path, and mandatory BYE/OOPS banner are specific to its original skill; they are not part of this adapter.
