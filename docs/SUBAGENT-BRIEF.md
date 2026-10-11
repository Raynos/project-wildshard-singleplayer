# Brief for subagents

Read this before writing code. It is the short version of [AGENTS.md](../AGENTS.md) for a subagent; where the two
disagree, AGENTS.md wins. Up to ten agents share **one checkout, one index and one `main`** (no worktrees, no
branches): stay inside the files your brief gives you.

## Your limits ([process/SUBAGENTS.md](process/SUBAGENTS.md))

- **One job.** Stop at **400k context, 90 min or ~200 turns**, whichever comes first: commit what is done, report
  what is left. The parent starts a fresh agent for the rest.
- **Never wait more than ~4 min** on anything (a browser lane, the model lock, a capture, CI): commit, report
  "queued: <exact command>" and end.
- No subagents or forks of your own. Don't run `~/.claude/set-label.sh` (you share the parent's pane).
- Your final report is **40 lines at most**, with the SHAs. No handoff files: the commit messages carry the detail.
- Work in the private scratch folder your brief names, and delete throwaways as soon as you have the result.

## Git ([process/GIT.md](process/GIT.md))

- Commit early and often, **only your own files**, with a pathspec: `git add <new files>`, then
  `git commit -m "…" -- <paths>`. Never `git add -A`, stash, checkout, restore or reset anything you didn't author.
- Conventional Commits subject (`type(scope): summary`, at most 50 characters), body wrapped at 72, and the trailer
  `Assisted-by: Claude Code:<model>`. No `Co-Authored-By:`. The commit-msg hook refuses anything else.
- Never `git push`: post-commit pushes for you. Strict TypeScript: no `any`, `!`, `@ts-ignore` or `as unknown as`.

## Seeing your work ([process/MACHINE.md](process/MACHINE.md))

- **No vite dev servers.** Serve a build with `scripts/serve-build.sh`, started from your scratch folder; it prints
  the URL. Stop it before you report.
- Every browser goes through `scripts/browser-lane.sh` (at most 4 machine-wide). **Mute it** (`--mute-audio`,
  `mute=1`) and **capture as the phone**: `agent-browser set device "iPhone 16 Pro"` with `touch&tier=phone`.
- Look at every screenshot you take (Read tool). Close the browser before you report.

## Where things are

- [docs/README.md](README.md): what every doc is. [ENGINE.md](ENGINE.md): the API. [SHARDS.md](SHARDS.md): how a
  shard is built. [RUNNING.md](RUNNING.md): tests and the debug URL parameters.
- Layers import downward only (engine → game → sdk → shards), with no barrels; the lint guards enforce it. Never
  disable a guard: fix the code.

## Rendering rules that bite ([process/RENDERING.md](process/RENDERING.md))

- **Every lit material goes through `sky.setupMaterial(mat)`** (`src/engine/world/skyRig.ts`): it wires the
  cascaded shadows and the fog. A material with its own `onBeforeCompile` also calls `attachFogUniforms(shader)`.
- Instance anything repeated; no facade multi-draw, ever. A risky rendering or memory change ships default-off
  behind a Debug row.
- Static things collide by registering colliders (`ctx.piece` / `app.registry.add`); after changing colliders,
  `node scripts/physics-baseline.mjs --no-build --mode=walk` must report 0 stuck.
- Variants and toggles go in pause ▸ Settings ▸ Debug, never a URL parameter.

## Quality bar ([process/JAKE.md](process/JAKE.md))

Jake plays on an iPhone in portrait, so judge everything there. Each shard keeps its own style (Driftwood low-poly
toon, Nalati painterly, Pine Hollow photoreal PBR); match the shard you're in.
