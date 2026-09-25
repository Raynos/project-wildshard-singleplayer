# NALATI-FINISH — land Nalati on main, then the user's picks and the leftovers

**State:** `blocked` 2026-09-24 — U1 uploading (origin/nalati-grasslands, 10 commits a chunk). U2, the landing (fast-forward main + the deploy), waits on the user's go. P1–P4 wait on the user's picks. B1–B4 are open for an agent after the landing.

The mini plan for everything left after [NALATI-MERGE](../../project/archive/2026-09-24-nalati-merge.md) (archived
2026-09-24, every row built on the `nalati-grasslands` branch). The asks: N10, N11, N13, N14, N20, N21, N22.

## U — land it on main (N10)

The user's way (2026-09-24): no squash. Main **fast-forwards** onto the branch, and the push goes up **10 commits at a
time** ("push 10 commits at a time … I know the upload speed sucks here"). The branch already contains origin/main
(last merged at 87739fb), so main can fast-forward. The older branch commits aren't descendants of main, though. They
can't go to main one chunk at a time, so the chunks go to a branch ref (`origin/nalati-grasslands`, which doesn't
deploy). The final fast-forward of main then sends almost nothing.

| # | row | state |
|---|---|---|
| U1 | Upload: `push-chunks.sh` pushes the first-parent commits to `origin/nalati-grasslands`, 10 at a time. Each chunk takes and releases the shared `.git/push.lock` so other agents' deploys go between chunks. ~539 MB of history (the old PNG mockups are in it), 277 commits, ~28 chunks. Log: `$CLAUDE_JOB_DIR/tmp/push-chunks.log` | 🔨 uploading |
| U2 | **The landing (the user's go):** (1) a herdr heads-up to every wildshard agent (the files that change; commit + push your WIP), wait for their "clear"; (2) merge `origin/main` into the branch again if it moved, run the gates, push that tip to `origin/nalati-grasslands`; (3) overlap check: the landing's files vs `git status --porcelain` in the main checkout; (4) `git update-ref refs/heads/main <tip> <old main>` (a fast-forward, atomic), write the changed files into the main checkout, `git merge-file` 3-way for any file with an agent's uncommitted hunk; (5) no new npm deps (package.json / pnpm-lock unchanged vs main); (6) `scripts/push-main.sh` (the vercel gate builds the tip), watch the run by headSha, `version.json`, a muted prod smoke test of all three shards, tell the agents it landed | waits on the user |
| U3 | After the landing: the branch is done. The local `nalati-grasslands` branch is deleted by the user (dcg blocks `git branch -D`), and the preview project `nalati-grasslands` is kept or removed (the user's call) | after U2 |

## P — the user's picks (all switchable in the build today)

| # | row | state |
|---|---|---|
| P1 | N20: the Look Lab picks after playing: terrain shadows · terrain AO + bounce · model shading · Yurts (procedural / Blender) · Camp people (procedural / Blender / image-to-3D). Then lock the picks in and remove the losing variants | needs pick |
| P2 | N21: a take per score slot (grass / sky / snow / night / storm / king, e.g. "king 301") on https://claude.ai/artifact/EQdaQCVdG9Kjnwvs4qaQra; keep or drop the kobyz (MiniMax plays it plucked) | needs pick |
| P3 | N22: confirm the parked defaults: the day glyph on Nalati only · the "DAY" word in HUD D · DODGE on D's arc · the Golden Bow's sun arrow on every full draw · AIM 2×, arms tire at 8 s · the new joke titles · the camp people's look · the Hunyuan-sourced models (for main's licence ask E101) | needs pick |
| P4 | N11: one real-iPhone reading with Low Power Mode off (target 30 fps, max graphics) | needs the user |

## B — leftovers an agent can build (after U2, on main)

| # | row | state |
|---|---|---|
| B1 | N13 riding extras: wolves raiding the sheep + a mounted shepherd, the horse panicking from bites / lightning, renaming the horse at the rail, reins in the hands; plus R1's not-built list (the horse following a road when you let go, a rhythm spur, a skid stop) and the look-behind limit (±170° today; the research says ±120–150°) | open |
| B2 | N14 look polish, what is still true: denser camp flowers / small rocks + painted camp clutter, bigger butterflies; the escarpment's flat grey rock patches; the meltwater ribbon climbing the glacier wall; the saddle skin repainting only the trim (the minimap label overlap is gone since N15; the blue-plastic boulders are the Look Lab's model-shading variant) | open |
| B3 | Audio: the two sounds still synth (the spear thrust, the javelin into flesh) re-rolled; more MOSS takes for the sounds that only got two; the Golden King's music verified in the browser (a unit test only so far) | open |
| B4 | A heads-up for the pine-hollow-remaster branch: its `Music.ts` / `Stems.ts` edits (339a484) meet Nalati's SteppeScore hooks | open |
