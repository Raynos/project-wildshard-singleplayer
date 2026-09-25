# NALATI-FINISH — land Nalati on main, then the user's picks and the leftovers

**State:** `in progress` 2026-09-25 — Nalati is on main and live; v0.3.0 at https://wildshard-v0-3-0.vercel.app (f86b4c3). Done: U1–U2, P1 (the Look Lab picks locked in), P2 (score), P3 (defaults), B6 (N23: the edge berm, ON by default, 48740dc), B7 (E136: one bake, no switch, 8630da2). Open, no owner yet: B5 (readable faces on the image-to-3D camp people), B1 (N13 riding extras), B2 (N14 look polish), B3 (audio), B4 (the pine-hollow-remaster heads-up). The user: P4 (N11, a phone reading with Low Power Mode off), U3 (delete the branch), his bug list (PAUSE ▸ FEEDBACK), his own HUD + Golden Bow fixes.

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
| U1 | Upload: `push-chunks.sh` pushes the first-parent commits to `origin/nalati-grasslands`, 10 at a time. Each chunk takes and releases the shared `.git/push.lock` so other agents' deploys go between chunks. ~539 MB of history (the old PNG mockups are in it), 277 commits, ~28 chunks. Log: `$CLAUDE_JOB_DIR/tmp/push-chunks.log` | ✅ 278 commits in ~20 min (20:00–20:20) |
| U2 | **The landing (the user's go):** (1) a herdr heads-up to every wildshard agent (the files that change; commit + push your WIP), wait for their "clear"; (2) merge `origin/main` into the branch again if it moved, run the gates, push that tip to `origin/nalati-grasslands`; (3) overlap check: the landing's files vs `git status --porcelain` in the main checkout; (4) `git update-ref refs/heads/main <tip> <old main>` (a fast-forward, atomic), write the changed files into the main checkout, `git merge-file` 3-way for any file with an agent's uncommitted hunk; (5) no new npm deps (package.json / pnpm-lock unchanged vs main); (6) `scripts/push-main.sh` (the vercel gate builds the tip), watch the run by headSha, `version.json`, a muted prod smoke test of all three shards, tell the agents it landed | ✅ the user's go ("Merge it to main approved"); main a0e4230 → b3d4e00 by fast-forward in the shared checkout (1,414 written, 75 removed, art/README.md + two generated tables 3-way merged); push-main.sh's vercel gate green; deploy run 36081745575, live b3d4e00-muga27bg; prod boot 3/3 desktop + touch, 0 errors; agents told |
| U3 | After the landing: the branch is done. The user removes the worktree (`git worktree remove ../wildshard-nalati-grasslands`; its only dirty files are build noise + scratch images) and deletes the local `nalati-grasslands` branch (and optionally `origin/nalati-grasslands`) himself (dcg blocks `git branch -D`), and the preview project `nalati-grasslands` is kept or removed (the user's call) | after U2 |

## P — the user's picks (all switchable in the build today)

| # | row | state |
|---|---|---|
| P1 | N20 — PICKED (2026-09-24): terrain shadows OFF, terrain AO + bounce OFF, model shading ON, yurts procedural, camp people image-to-3D ("Models 3D local ai model is best"). Was: the Look Lab picks after playing: terrain shadows · terrain AO + bounce · model shading · Yurts (procedural / Blender) · Camp people (procedural / Blender / image-to-3D). Then lock the picks in and remove the losing variants | ✅ locked in (2026-09-24): terrain shadows off + terrain AO / bounce off (terrainLight.ts and its receivers gone), model shading always on, yurts procedural (the Blender yurt model gone), camp people the image-to-3D models (the Blender people gone; the procedural figures stay in campPeople.ts as the rig's frame, the fallback and B5's faces); the Look Lab switches, `?tshadow` `?tao` `?modelshade` `?yurts` `?people` gone |
| P2 | N21: a take per score slot (grass / sky / snow / night / storm / king, e.g. "king 301") on https://claude.ai/artifact/EQdaQCVdG9Kjnwvs4qaQra; keep or drop the kobyz (MiniMax plays it plucked) | ✅ the user delegated ("pick the music you think is best"): the measured #1 takes stay, the kobyz stays |
| P3 | N22: confirm the parked defaults: the day glyph on Nalati only · the "DAY" word in HUD D · DODGE on D's arc · the Golden Bow's sun arrow on every full draw · AIM 2×, arms tire at 8 s · the new joke titles · the camp people's look · the Hunyuan-sourced models (for main's licence ask E101) | ✅ answered: glyph / AIM / titles / licence fine; HUD + the Golden Bow the user fixes himself later; the camp people need more work → B5 |
| P4 | N11: one real-iPhone reading with Low Power Mode off (target 30 fps, max graphics) | needs the user |

## B — leftovers an agent can build (after U2, on main)

| # | row | state |
|---|---|---|
| B1 | N13 riding extras: wolves raiding the sheep + a mounted shepherd, the horse panicking from bites / lightning, renaming the horse at the rail, reins in the hands; plus R1's not-built list (the horse following a road when you let go, a rhythm spur, a skid stop) and the look-behind limit (±170° today; the research says ±120–150°) | open |
| B2 | N14 look polish, what is still true: denser camp flowers / small rocks + painted camp clutter, bigger butterflies; the escarpment's flat grey rock patches; the meltwater ribbon climbing the glacier wall; the saddle skin repainting only the trim (the minimap label overlap is gone since N15; the blue-plastic boulders are the Look Lab's model-shading variant) | open |
| B3 | Audio: the two sounds still synth (the spear thrust, the javelin into flesh) re-rolled; more MOSS takes for the sounds that only got two; the Golden King's music verified in the browser (a unit test only so far) | open |
| B5 | The camp people need more work (the user, N22: "Camp people lol needs more work") — the five figures (since N20 the image-to-3D models are the base, no switch; the procedural figures' code stays in src/nalati/campPeople.ts): faces, proportions, clothing, animation; a mockup round first. The user after the Look Lab board (2026-09-24): the image-to-3D bodies are better "but they lack so much facial detail that they don't look like people anymore, whereas the procedural one has some very simple procedural facial details … at least I can recognize the face" → generated bodies + readable faces: the base is now the image-to-3D bodies, the procedural figures' simple readable faces are the work | open |
| B6 | N23 — the horizon seam still shows near the camp (the slab's north edge ~38 m away; the N19 blend can't haze that close). The user's pick: **hide the edge** — a natural rise along the slab edges (spruce lines, rocks, a berm; the entry roads still reach y = 0 through a cut) so the 3D end is never seen; as a Look Lab switch + a board, then the user picks | ✅ built (fcfa22d, live fcfa22d-mugg1dug): Look Lab ▸ Edge (default OFF, `?edge=1`), board progress/nalati-merge/n23/board.jpg — ✅ the user: "Edge on" → default ON (48740dc, live 48740dc-mugtkvfq); the cleanup is B7 |
| B7 | Clean up after the edge pick: make the edge bake THE bake (terrain.bin / navmesh.bin baked with the berm; drop the `.edge` variant from scripts/bake-chunk.mjs + bake-navmesh.mjs VARIANTS, `bakeVariant`, EDGE_BAKE), remove the Edge setting + menu row + `?edge`, and take EDGE_ON's conditionals down to the ON branch (8 call sites: nalati-grasslands.ts, nalatiEdge.ts, fog.ts, outcrops.ts); the boot pack stops prefetching the unused no-edge terrain.bin (~0.5 MB) | ✅ E136: terrain.bin / navmesh.bin are the berm bake (byte-identical to the old `.edge` files, which are gone), VARIANTS / `bakeVariant` / EDGE_ON / EDGE_BAKE gone (8630da2); the Edge setting, its Look lab row and `?edge` gone with the E136 settings sweep |
| B4 | A heads-up for the pine-hollow-remaster branch: its `Music.ts` / `Stems.ts` edits (339a484) meet Nalati's SteppeScore hooks | open |


## Handoff — for the next session (the user wrapped this one up, 2026-09-24)

- **Where things are:** everything is on main (the Nalati branch landed as a fast-forward, b3d4e00). The
  `wildshard-nalati-grasslands` worktree + branch are stale — work in the main checkout. The branch's copy on GitHub
  (`origin/nalati-grasslands`) can be deleted (U3).
- **In flight when this session ended:** nothing — P1's lock-in (609f424) and B6 (fcfa22d, default ON in 48740dc) landed.
- **Start here:** B5 (the image-to-3D camp people
  get readable faces — the procedural figures' simple faces are the reference, src/nalati/campPeople.ts) → B1 riding
  extras → B2 look polish → B3 audio → B4 the pine-hollow-remaster heads-up.
- **The user owes:** his bug list from playing (PAUSE ▸ FEEDBACK in the game drops them into `pnpm inbox:pull`), one
  iPhone reading with Low Power Mode off (P4 / N11), and he fixes the HUD + the Golden Bow himself later (N22).
- **Evidence + tools:** progress/nalati-merge/*, the Look Lab boards (progress/nalati-merge/look-lab/boards/),
  scripts/nalati-boot-check.mjs (all three shards, muted), scripts/nalati-chunk-views.mjs,
  scripts/nalati-ride-physics.mjs, scripts/nalati-quest-check.mjs, scripts/nalati-hud-capture.mjs.
