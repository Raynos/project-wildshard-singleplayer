# Engine-fit audit (ask E45) — shared brief

The user (Jake) asks: Wildshard is a mobile-first (portrait phone, touch) first-person action RPG built on
**raw three.js 0.186 + TypeScript + Vite**, strict tsc + type-aware oxlint, shipped to web (Vercel) and
Capacitor native shells. Two shards are being worked hard right now:

- **Driftwood Isle** — `/Users/raynos/projects/games/wildshard-singleplayer` (main; ~10 agents edit it live)
- **Nalati Grasslands** — `/Users/raynos/projects/games/wildshard-nalati-grasslands` (a worktree/branch, horse
  riding, steppe, nomad camp)
- A **Rapier physics** branch is being built in `/Users/raynos/projects/games/wildshard-physics`
  (plan: `project/archive/2026-09-23-physics.md` there — Rapier 3D, committed, both shards, navmesh, capped ragdolls).

Question: (a) should we move onto a real game engine layered on three.js (Rogue Engine, Needle Engine,
enable3d, GDevelop, A-Frame, others), or (b) keep three.js + Rapier and borrow 1–5 *components* (ideas or
libraries) that those engines provide?

Constraints that matter for the answer:
- Code is written almost entirely by coding agents (Claude / codex), code-first, TypeScript, no visual editor
  in the loop. Many agents in parallel on one tree.
- Phone performance and load time are hard budgets (LOAD-PERF / PLAY-PERF plans archived in `project/archive/`,
  `bench.budget.json`). 60 fps target.
- There is a large existing codebase — a migration cost is real.

RULES: **read-only** in all three repos. Do not edit, stage, commit, stash or checkout anything. Do not open
browsers. Write your findings ONLY to the output file named in your prompt (in this scratchpad folder).
Be concrete: cite `path:line`, file sizes (lines), and name specific systems. Keep the output file under
~250 lines, dense, no filler.
