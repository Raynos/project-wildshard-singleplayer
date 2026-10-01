# E357 Z3 round 2 — a fresh agent rebuilds a new shard from the docs (11 §Z3 step 4)

This brief is the whole of what you get (clean room, 11 §Z3 step 1). You never saw the plan's conversation.

## Your job
Build a **small real shard** under the slug and ask given in your prompt, from these sources only:
- `docs/SHARDS.md` (how to write a shard) and `src/shards/_template/` (copy it);
- `docs/ENGINE.md` (the public API of `#engine`, `#engine/data`, `#engine/retry`, `#game`, `#kit`);
- `AGENTS.md` (the repo rules).

The concept is already picked by Jake (Jake is the person who owns the game). Read it in your ask file
(`docs/tasks/asks/<id>.md`, the "picked" Status line and its concept section), and match the look on the board the
first run made (its path is in your prompt). That board is the only thing you take from the earlier run.

**You start over.** A first run built this shard and hit API gaps; the engine has been fixed since. Replace the whole
`src/shards/<slug>/` folder with your own build (delete the old files in your first commit). Don't read the old
files: build from the docs, so the docs are what gets tested.

The shard needs (11 §Z3 step 3): its own look (`LookStrategy`), at least one custom weapon, one creature with its own
brain, one quest step, budgets, strings, a README; `status: 'experimental'`; the baseline HUD only (map new verbs onto
existing controls).

## The rules that make this run count
- **Zero engine edits.** Change nothing under `src/engine`, `src/game`, `src/kit`, `lint`, `.github` or `scripts`, and no
  generated file, except your own `src/shards/<slug>/ktx2.generated.ts` and `lint/shard-words.generated.json`'s entry
  for your slug (write it with `pnpm gen --shard=<slug>`; if that flag doesn't exist yet, write an API gap and update only your slug's entry by hand). Your commits carry **no** `E357-Lead` trailer; the
  commit-msg lock check holds you to your folder, your tests, your art and asset folders and `docs/tasks/asks/**`.
- **An API gap is not a hack.** If you need something the public API doesn't offer or the docs don't explain, stop
  and write it under `## API gaps (round 2)` in your ask file: what you needed, where you looked, what you'd want.
  Don't work around it with an undocumented field. Then carry on with what you can build.
- Check on a clean export of HEAD (the shared working tree carries other agents' WIP): typecheck, lint, the tests, and
  a phone boot of your slug (`node scripts/parity.mjs --export=<full sha> --lane=m5 --shards=<slug> --tiers=phone
  --only=fingerprint+poses`), `boot.errors` empty.
- **Budgets are generated data, not yours to invent.** Keep `src/shards/<slug>/budgets.ts`'s `BUDGET_CEILINGS` import
  and `ceilings` field and `budgetCeilings.ts` as HEAD has them; `pnpm gen --shard=<slug>` regenerates your slug's
  derived budget record. A measured GPU-memory change is the lead's to approve: say so in your report.
- **Camera poses are degrees.** `manifest.dev.poses` takes `eye` / `feet` plus `yaw` / `pitch` in degrees
  (ENGINE §6); the parity harness and board captures read them from there.
- A portrait board for Jake at `art/<slug>/round-3-rebuild/board-<sha>.jpg`: four iPhone 390 × 844 phone-tier frames
  (spawn, the weapon, the creature, the quest), JPEG under 500 KB, captured through `scripts/browser-lane.sh` from a
  served build (`scripts/serve-build.sh` from your scratchpad; keep the preview alive while you capture).
- Commit with a pathspec, never `git add -A`. Don't push: the lead pushes. Keep a `## Handoff (<date> <time>, Z3 round 2)` section in your ask file current at every commit.
- Never run `~/.claude/set-label.sh`. Stop at 400k context, 90 min or ~200 turns; report ≤ 40 lines: commits, the
  board path, and every API gap (or "zero gaps").
