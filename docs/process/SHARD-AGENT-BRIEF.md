# The shard-agent brief: Signal Dunes (shard 5) and Sky Reach (shard 6)

> **State:** in use from 2026-10-02 (Jake: "the two subagents is not the right approach anymore. They should be sibling
> Claude agents running as Claude Code CLIs"). Two top-level Claude Opus 5.5 sessions in herdr, `signal-dunes` and
> `sky-reach`, each with Remote Control on, so Jake can watch and talk to them from the Claude app. The lead is the
> herdr agent `wildshard-9`.

## Your job

Make your shard look, feel and play as well as the other four shards (Driftwood Isle, Nine Dragon Stack, Pine Hollow,
Nalati Grasslands). Jake, 2026-10-01, after playing both new shards on his iPhone:
- "they look absolutely nothing like the mock-up … an incredibly half-assed implementation … we need to do 10x 100x better";
- "I'm not asking for more content … fix the presentation and feel of the world as is, and make sure that the quest is
  planned … look at the Driftwood quest … talk to Wendell … quest icons on the mini map";
- "Choose your own art style for shard five and shard six … bonus point for matching the mock-up … it can be new and unique."

Your shard already has its full content (world, quest, boss, weapon). The work is the look, the feel, the first-person
hands and weapon, and the quest's staging, held to the other four shards' standard.

## Start here

1. Read AGENTS.md (the repo's rules) and this file.
2. Read the lead's last report for your shard (the plan's STATE.md, else `docs/tasks/asks/E374.md`'s last Handoff, now
   historical). It is where the previous builder stopped. Continue from it; never rebuild from scratch (Jake, P25).
3. Your plan: `docs/plans/SIGNAL-DUNES.md` or `docs/plans/SKY-REACH.md` (polish rows P1–P6). Your style bible:
   `docs/design/sunscar-dunes/style-bible.md` ("Last Light") or the far-reach one ("Gilded Air"). Your review:
   `docs/design/<slug>/review-2026-10-01.md`. The method: `docs/design/LOOK-LOOP.md`.
4. Look at the other four shards' captures in `art/` (their latest look-loop rounds) so you know the bar.

## How you work

- **You build it yourself, as Claude Opus.** Never use Codex / GPT-6.1 Sol to build the shard (Jake, E374). Codex
  `image_gen` (or `scripts/mockup-local.sh`) for mockups and targets is fine, and Jake authorised as many as you need.
  Local models (Hunyuan3D-2, TRELLIS.2) for 3D models, under the model lock.
- **Your lane:** `src/shards/<slug>/`, `public/assets/<slug>/`, `test/shards/<slug>/`, `art/<slug>/`,
  `docs/design/<slug>/`, `progress/<slug>/`, your plan, and your own ceiling rows in `budgets/`. The engine
  (`src/engine/`), game (`src/game/`), kit (`src/kit/`) and `scripts/` are the lead's: send it an
  **ENGINE REQUEST** and keep building something else meanwhile:
  `herdr agent prompt wildshard-9 "[from <your name>] ENGINE REQUEST: <what, why, the file and the repro>"` (no `--wait`).
  The lead builds it and replies with the SHA. You never wait idle on it.
- **Git:** shared main checkout with other agents. Pathspec commits only (`git commit -m … -- <paths>`), `git add` only
  for new files, small commits; the commit pushes itself (`scripts/auto-push.sh`; never `git push`). Never stash, checkout, restore
  or reset files you didn't write.
- **Browsers:** every Playwright run through `scripts/browser-lane.sh`; serve builds with `scripts/serve-build.sh`
  (from a scratchpad export of HEAD), never a vite dev server; close what you open. Muted.
- **No URL switches**: every variant is a `ctx.debugRow` in your shard (AGENTS.md).
- **No invented numbers** (E388, Jake: "we're fighting against magic numbers"). A cap, pass bar or threshold must come
  from a measurement, a device limit, an engine constant or a Jake decision. ΔE00 is information, not a pass bar. Your
  `gpuMB` budget ceiling is a ratchet, not the phone's limit: when your art raises it, re-record it at the measured
  value with the provenance "measured; inside the phone memory limits (1.8 GB loading / 1.0 GB Explorer)". The only
  hard memory limit is the phone's 1.8 GB loading / 1.0 GB Explorer.
- **Long waits** (a parity run, a model batch): run them with `run_in_background` and keep working.

## Every loop

1. Pick the biggest gaps against the other four shards (and your mockups), fix them, commit.
2. **Progress (E389):** on a served build of your commit, run
   `scripts/browser-lane.sh --max 20 node scripts/shard-progress.mjs --shard=<slug> --url=<served url> --sha=<sha> --label="loop <n>"`
   and commit the new `progress/<slug>/<stamp>-<sha8>/` folder (the frames, `clip.mp4`, `meta.json`). The time-lapses
   are rebuilt from those folders with `python3 scripts/shard-timelapse.py <slug>` (not committed: `.gitignore`). The
   cameras are `art/<slug>/progress/cameras.json`; keep them fixed.
3. A board per loop in `art/<slug>/round-<n>-<label>/` (JPEG, before / after / target), and a short message to the lead
   with the board path and the SHAs.
4. Report each landing to the lead over herdr with its SHAs; no Handoff section or handoff file (Jake, 2026-10-09, after the process audit `progress/process/audit-2026-10-09/`).

## Done

The lead runs **two council rounds** (`docs/process/COUNCIL.md`: a Codex seat and two Claude seats) that judge your
shard against the other four on the same views. You loop on their findings until the second round finds your shard at
their level. Jake is asleep and asked for no questions: decisions you'd want from him go to the lead (herdr) with your
recommended answer. If Jake talks to you directly over Remote Control, his word overrides this brief.

When your context gets large, commit, send the lead a full report (done / next / SHAs), and stop; the lead starts a fresh session on it.
