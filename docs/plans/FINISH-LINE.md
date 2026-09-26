# Plan: finish line (E108): from a pile of pieces to a finished-feeling game

**State:** `draft` 2026-09-24. Written from the E108 audit (whole game, Driftwood, engineering, engines). The four reports are in `docs/design/audit-e108/`. **Jake has approved none of the rows below.** The plan waits on his go: first on the freeze (F0), then on the rows.

## Read this first

Jake's question (E108): *"We have a lot of pieces but something is missing. Something is still giving a lot of chaos. How do we get it more polished, less buggy, closer to finished?"*

Four read-only audits on build `f86b4c3` gave the same answer from four directions.

- **The engine is fine.**
  - The static checks hold: strict TS, oxlint, 0 import cycles, 398 tests green, and CI green on 97% of runs.
  - No free engine beats three.js + Rapier for this game. Babylon 9 comes closest, and it would still mean a rewrite.
- **What is missing is a finish line.** Three things are absent:
  - **A definition of "done" per shard.** Driftwood's story ends with no "shard complete". Nothing links the shards.
  - **A gate that plays the game.** Every gate is static, so regressions are found on Jake's iPhone.
  - **A rule that stops new systems** from landing before the old ones are tuned.
- **The chaos is visible in the numbers:**
  - `src/` grew from 11.5k to 90.7k lines in 7 days.
  - 869 commits in those 7 days; 31% only update asks or docs, and 17% are fixes.
  - `main.ts` was edited 116 times.
  - 158 shard `if` branches in 40 files.
  - ~123 URL flags.
  - Every "locked-in" pick still ships its losing variant.
  - Nalati landed as a second copy of the audio, quest, grass, sky and water systems.
  - Pine Hollow's +23k-line merge is next, and touches 57 shared files.
- **The player feels it.** Scores out of 10:

  | Shard | Score | Main reason |
  |---|---|---|
  | Driftwood | 6.5 | Beautiful, but its fights are unfair |
  | Nalati | 5 | Wide, not yet tuned |
  | Pine Hollow (main) | 3 | The 17 September tech demo, running at 18–38 fps |

  Every shard shows dev chrome: "LOCAL BUILD · UNUPLOADED", an fps readout, and loading timings.

**No agent builds, "quickly tries" or partly lands a row until Jake names it.**

## F0 — the freeze (a decision, not a build)

| Row | What | Why |
|---|---|---|
| F0.1 | **A 2-week stabilisation phase.** Only bug fixes, deletions, gates and the rows below land. No new shard, weapon, creature, system or Look Lab variant. | New systems land faster than old ones get tuned. |
| F0.2 | **At most 3–4 lanes, each with its own folders.** One integrator owns `main.ts`, `Game.ts`, `ChunkDef.ts`, `Audio.ts` and the touch UI. | Ten agents editing the same hot files is the root of most collisions. |
| F0.3 | **No more mega-merges.** Pine Hollow lands *after* S3 (shard modules), in slices, or stays parked. | Nalati landed as a parallel game; Pine Hollow would add a third. |
| F0.4 | **Less bookkeeping.** An ask's status changes in the same commit as its code, and CI writes the build id. | 31% of commits are status updates. |

## S — the safety net (engineering)

| Row | What | Effort |
|---|---|---|
| S1 | **A golden-path play test that gates every deploy.** For each shard, desktop and touch: boot with 0 page errors, a scripted 20 s walk (0 stuck), a swing and a shot, a pause and resume, p95 frame time within budget, and a screenshot kept as evidence. It is built from `nalati-boot-check.mjs`, `physics-baseline.mjs` and `bench-load.mjs`. The boot + no-errors part runs on GitHub; the full run runs on the Mac before a push, serialised by the push lock. | M |
| S2 | **Error reports and fault isolation.** `window.onerror` and unhandled rejections are sent to `api/` with build, shard, tier, stack and position, and a digest appears in the session brief. In the game loop, a system that throws is switched off and the frame keeps rendering, instead of freezing (`Game.ts:363-370`). | S |
| S3 | *(Detailed plan: [GAME-NORMALIZATION.md](GAME-NORMALIZATION.md), E127, which proposes landing Pine Hollow **before** the refactor, reversing F0.3.)* **Shard modules (ENGINE-FIT E5).** `src/chunks/<shard>/index.ts` exports config, build, fauna, kit, audio, quest and hooks, loaded by dynamic import. Goal: 0 shard branches outside `src/chunks/`. It also splits the 931 KB gz `main.js` per shard. | L |
| S4 | **Delete the losing variants.** Lighting standard, HDRI sky, cinematic post, look v1, Kuwahara, matte off, and the new `?boat=v1`. WebGPU is either deleted or parked on a branch. **(Done 2026-09-25, E184: `src/gpu/` deleted, WebGL only.)** The ~123 URL flags go into one typed dev-only registry of about 25. | S–M |
| S5 | **Input actions (ENGINE-FIT E4).** One layer with contexts (walk / ride / menu / dialog), a 100–150 ms input buffer for every action, ~100 ms coyote time, gamepad support and rebinding. It replaces the listeners spread across 26+ files. | M |
| S6 | **Tests where the bugs are.** Node tests for the boss, elite, quest and weather state machines, AnimalManager AI and weapon timing (all at 0–5% today). | M |
| S7 | **Budgets that run.** `bench:ci` runs nightly, the baseline is re-set after the freeze, and CI commits `latest.md`. The committed table dates from 09-18. | S |

## P — player mode (every shard, a day's work)

| Row | What | Effort |
|---|---|---|
| P1 | **Dev chrome only behind `?dev`.** This covers the fps/calls/tris readout, the chunk panel ("LOCAL BUILD · UNUPLOADED"), the build tag, the boundary gates (the likely cause of E36), the loading timings, and the Debug and Review sections in Settings. Loading steps get player words named after the shard, with no Pine Hollow steps on Driftwood. | S |
| P2 | **Hide Pine Hollow from the picker** until its remaster lands, or label it "Tech preview" and put it last. | S |
| P3 | **One onboarding card per shard.** A control hint shows the first time each control matters: move, jump, attack, lock, dodge, interact. | S–M |

## D — Driftwood to 9/10 (the first finished shard)

| Row | What | Effort |
|---|---|---|
| D1 | **One set of fight rules for every enemy.** An enemy faces you, telegraphs, and at most 2 attack at once. Boars circle back instead of fleeing (`AnimalManager.ts` ~644/675/727). An arrow at the screen edge warns of an attacker off screen. | M |
| D2 | **Damage and placement pass.** Cap any single hit at ~20% of your health: the bear goes from 45 to 20, the sailor from 18 to 14. Rule: you survive 5 hits from any common enemy. Move the brown bear off the wreck path (`driftwood-isle.ts:207`). Make the wreck-hold fight readable: the camera stays out of the planks and nothing hits you through beams. | S |
| D3 | **The first three minutes.** A shorter pier walk, or arriving by boat. One practice crab on the sand path. Wendell turns to face you. The sword is lowered at rest (`SwordMoves.ts` REST) and put away during dialogue. | S–M |
| D4 | **Death and restart.** A 1.2 s fade, a "Killed by a brown bear" card, and a restart at the last place you discovered, not at the pier (`main.ts:769`). | S |
| D5 | **The HUD on desktop.** Pop-ups stack under the quest chip, not under the minimap. The map labels stop overlapping, and the map draws paths and structures (E105). M always opens the Map. Tracer bolts is hidden in sword games. | S |
| D6 | **A "shard complete" screen** after the reward view: time played, achievements, credits, and "try Nalati next". | S |
| D7 | **A reason to wander.** Gulls lead you to places you haven't found (V-M3). The map shows sea glass found and missing, and which places are discovered. | M |

## N — Nalati: tune, don't add

| Row | What | Effort |
|---|---|---|
| N-a | **Hide the world edge from mid-map.** At the kurgans (`x=-106 z=100`) you can see a flat plane with a seam and cyan posts. This goes beyond N23, which covers only the camp side. Also fix the untextured slabs and black spruce cut-outs on the east edge (`x=209`). | M |
| N-b | **The "elite nearby" banner only near the lair.** Today it shows for Aqbars at the camp and at Eagle Rock. | S |
| N-c | **The same fight rules as D1–D2.** Wolves take you from 100 to 4 health in about 8 s. | S |
| N-d | **One chapter polished end to end as the golden path.** No new Nalati systems until it's done. | M |

## M — one game, not three demos (after F0 ends)

| Row | What | Effort |
|---|---|---|
| M1 | **Continue, and a shard map with progress on the title screen.** | M |
| M2 | **Titles and trophies that carry across shards.** Finishing one shard's story lights up the next. | M |
| M3 | **One controls and HUD spec for every shard.** Same verbs, same buttons, the weapon strip everywhere, one phone layout. | M |

## Docs to fix (found by the audit; not built here)

- **Pine Hollow is described as the whole game.** `README.md`, `docs/SUBAGENT-BRIEF.md` and `docs/SHARDS.md` still describe "a pine forest, three cabins, a crossbow".
- **`docs/RUNNING.md` still says `vercel deploy`.**
- **`docs/AAA-PLAN.md` claims Pine Hollow runs at 60 fps.**
- **Ask D38 says day/night is not built.** It is, and it runs by default (`src/world/DayNight.ts`).

## Engine verdict (for the record)

- **Stay on three.js r186 + Rapier. No engine switch, no R3F or Threlte rewrite, no Godot/Bevy/Needle.**
- **ENGINE-FIT status now:**

  | Row | Status |
  |---|---|
  | E1 registry | built |
  | E2 phases | half built |
  | E3 CharacterMotor | built |
  | E4 input | still needed → S5 |
  | E5 shard modules | the most important, and skipped → S3 |

- **Adopt:** three-mesh-bvh (melee and camera queries, behind `src/physics/query.ts`), Playwright as a gate (S1), and three's Inspector and the Needle Inspector as dev tools.
- **Later:** koota (crowds) and three.quarks (effects).
- **Avoid:** Howler, and chasing WebGPU for its own sake.
- Full comparison: `docs/design/audit-e108/engines.md`.
