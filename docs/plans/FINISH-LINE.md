# Plan: finish line (E108): from a pile of pieces to a finished-feeling game

**State:** `in progress` 2026-10-03 — Jake approved in the E423 grill, buildable and unowned: N-a (hide the kurgan and east edges), N-b (verify the elite banner, fix or close), N-c (Driftwood's fight rules for the wolves), M1 (CONTINUE + a shard map on the title; mockups first), M3 (the controls audit), S9 (the SSIM limit from recorded noise, later), S10 (the rig gates' remaining small tolerances, from E388) and PK1–PK5 (EF9 worker pool, EF3 pools, TP18 per-shard assets, BatchedMesh → instancing where it measures better, the desktop help chip). S8 stays "later"; N-d and M2 dropped. Earlier rows: S1, S3, S5–S7 went into GAME-NORMALIZATION (archived); D1–D4, D7 and P3 were built as DRIFTWOOD-TOP10 (archived); S2, S4, P1, D5, D6 are done; P2 is moot.

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
| F0.1 | *(Never declared.)* **A 2-week stabilisation phase.** Only bug fixes, deletions, gates and the rows below land. No new shard, weapon, creature, system or Look Lab variant. | New systems land faster than old ones get tuned. |
| F0.2 | **At most 3–4 lanes, each with its own folders.** One integrator owns `main.ts`, `Game.ts`, `ChunkDef.ts`, `Audio.ts` and the touch UI. | Ten agents editing the same hot files is the root of most collisions. |
| F0.3 | *(Reversed: Jake picked Pine Hollow first, GAME-NORMALIZATION §9 Q1; it landed `18b3d6be`.)* **No more mega-merges.** Pine Hollow lands *after* S3 (shard modules), in slices, or stays parked. | Nalati landed as a parallel game; Pine Hollow would add a third. |
| F0.4 | **Less bookkeeping.** An ask's status changes in the same commit as its code, and CI writes the build id. | 31% of commits are status updates. |

## S — the safety net (engineering)

| Row | What | Effort |
|---|---|---|
| S1 | *(Not built. Manual pieces exist: `scripts/scorecard.mjs` `d977b223`, `pnpm test:gpu-boot`. The permanent gate is GAME-NORMALIZATION N9.)* **A golden-path play test that gates every deploy.** For each shard, desktop and touch: boot with 0 page errors, a scripted 20 s walk (0 stuck), a swing and a shot, a pause and resume, p95 frame time within budget, and a screenshot kept as evidence. It is built from `nalati-boot-check.mjs`, `physics-baseline.mjs` and `bench-load.mjs`. The boot + no-errors part runs on GitHub; the full run runs on the Mac before a push, serialised by the push lock. | M |
| S2 | **(Done 2026-09-25, E133, live `96aa76e-mugvnre5`; Sentry since E237, crash reports that survive a reload E259.)** **Error reports and fault isolation.** `window.onerror` and unhandled rejections are sent to `api/` with build, shard, tier, stack and position, and a digest appears in the session brief. In the game loop, a system that throws is switched off and the frame keeps rendering, instead of freezing (`Game.ts:363-370`). | S |
| S3 | *(Not started: GAME-NORMALIZATION is still a draft.)* *(Detailed plan: [GAME-NORMALIZATION.md](../../project/archive/2026-10-01-game-normalization.md), E127, which proposes landing Pine Hollow **before** the refactor, reversing F0.3.)* **Shard modules (ENGINE-FIT E5).** `src/chunks/<shard>/index.ts` exports config, build, fauna, kit, audio, quest and hooks, loaded by dynamic import. Goal: 0 shard branches outside `src/chunks/`. It also splits the 931 KB gz `main.js` per shard. | L |
| S4 | **Delete the losing variants.** Lighting standard, HDRI sky, cinematic post, look v1, Kuwahara, matte off, and the new `?boat=v1`. WebGPU is either deleted or parked on a branch. **(Done 2026-09-25, E184: `src/gpu/` deleted, WebGL only.)** The ~123 URL flags go into one typed dev-only registry of about 25. | S–M |
| S5 | *(Not built.)* **Input actions (ENGINE-FIT E4).** One layer with contexts (walk / ride / menu / dialog), a 100–150 ms input buffer for every action, ~100 ms coyote time, gamepad support and rebinding. It replaces the listeners spread across 26+ files. | M |
| S6 | **Tests where the bugs are.** Node tests for the boss, elite, quest and weather state machines, AnimalManager AI and weapon timing (all at 0–5% today). | M |
| S7 | **Budgets that run.** `bench:ci` runs nightly, the baseline is re-set after the freeze, and CI commits `latest.md`. The committed table dates from 09-18. | S |
| S8 | **Jake: keep as later; ask again when the shards are closer to done (E423 grill, 2026-10-03).** **A golden-path phone run per shard** (GW2-ZONES §3 / §14, [docs/plans/GW2-ZONES.md](GW2-ZONES.md); Jake, 2026-10-01: "later"). One person plays each shard on the phone: touch, no dev flags, no forged saves, timed and split into active play, traversal, forced waiting, retries and walk-backs, and completion. Pine's and Nalati's friction (night-only steps, gate respawns, the fight frame rate, wolf balance) is fixed first. **Done when** every shard has one timed, unforged run on record, with its split. Waits on Jake's go ("later") | M |
| S9 | **Jake: yes, later (E388 / E423 grill, 2026-10-03).** **Derive the parity SSIM limit from noise.** It is still `min(0.99, selfMin − 0.01)` (`scripts/parity/compare.mjs`). Record each pose's selfMin over several `node scripts/parity.mjs --record` sessions on one unchanged commit (~1–2 h of browser lane), then switch to 1 − 2 × (1 − selfMin) and delete the 0.99 and the 0.01. Three runs in one session understate the noise: replayed on the 72 gate runs since 10-01, that rule would have failed 10. | S |
| S10 | **From E388 (Jake: "purge them", the invented numbers), found while purging the rig gates, not yet built.** **The rig gates' remaining small numbers: derive or delete.** Also the img2-character skill outside this repo (`~/.claude/skills/img2-character`, `~/.img2`) still states 0.01 H and 2e-7: bring it in line in the same change. `scripts/king-rig-gate.mjs` G1's "a clip moves" bar (2° of joint turn, 0.01 H of vertex move) and G10's seam split ≤ 1e-6 H; `scripts/blender/driftwood-isle/fp-arms/gate.mjs` G1's still bar (2 mm of hand travel, 0.5°) and the grip check's 0.05 m; `scripts/practice/verify_unimate_skin.mjs`'s 1e-4 / 1e-5 / 1e-7 tolerances. A numerical floor becomes the float32 rounding of the measured values (as G8 and the weight sums now are, `4574d15f2`); a "moves at all" bar becomes "more than that floor". Acceptance: no typed tolerance left in those three files; each gate re-run green (UniMate verifier, king gate on both tiers, fp-arms gate). | S |

## P — player mode (every shard, a day's work)

| Row | What | Effort |
|---|---|---|
| P1 | **(Done 2026-09-25, E140, `cebf30bb`, live `e27b1c5-mugy2jj4`: developer mode holds the dev chrome.)** **Dev chrome only behind `?dev`.** This covers the fps/calls/tris readout, the chunk panel ("LOCAL BUILD · UNUPLOADED"), the build tag, the boundary gates (the likely cause of E36), the loading timings, and the Debug and Review sections in Settings. Loading steps get player words named after the shard, with no Pine Hollow steps on Driftwood. | S |
| P2 | *(Moot: Pine Hollow's remaster landed, `18b3d6be`.)* **Hide Pine Hollow from the picker** until its remaster lands, or label it "Tech preview" and put it last. | S |
| P3 | *(Not started: DRIFTWOOD-TOP10 row 5.)* **One onboarding card per shard.** A control hint shows the first time each control matters: move, jump, attack, lock, dodge, interact. | S–M |

## D — Driftwood to 9/10 (the first finished shard)

| Row | What | Effort |
|---|---|---|
| D1 | *(Not started: DRIFTWOOD-TOP10 row 1.)* **One set of fight rules for every enemy.** An enemy faces you, telegraphs, and at most 2 attack at once. Boars circle back instead of fleeing (`AnimalManager.ts` ~644/675/727). An arrow at the screen edge warns of an attacker off screen. | M |
| D2 | *(Not started: DRIFTWOOD-TOP10 rows 2 + 3.)* **Damage and placement pass.** Cap any single hit at ~20% of your health: the bear goes from 45 to 20, the sailor from 18 to 14. Rule: you survive 5 hits from any common enemy. Move the brown bear off the wreck path (`driftwood-isle.ts:207`). Make the wreck-hold fight readable: the camera stays out of the planks and nothing hits you through beams. | S |
| D3 | **(Half: Wendell + the sword done, E129 `4d3fc77`; the rest is DRIFTWOOD-TOP10 row 5, not started.)** **The first three minutes.** A shorter pier walk, or arriving by boat. One practice crab on the sand path. Wendell turns to face you. The sword is lowered at rest (`SwordMoves.ts` REST) and put away during dialogue. | S–M |
| D4 | *(Not started: DRIFTWOOD-TOP10 row 4.)* **Death and restart.** A 1.2 s fade, a "Killed by a brown bear" card, and a restart at the last place you discovered, not at the pier (`main.ts:769`). | S |
| D5 | **(Done 2026-09-25, E130, live `5de4ef9-mugvhywt`.)** **The HUD on desktop.** Pop-ups stack under the quest chip, not under the minimap. The map labels stop overlapping, and the map draws paths and structures (E105). M always opens the Map. Tracer bolts is hidden in sword games. | S |
| D6 | **(Done 2026-09-25, E132, `81a8c05`.)** **A "shard complete" screen** after the reward view: time played, achievements, credits, and "try Nalati next". | S |
| D7 | *(Not started: DRIFTWOOD-TOP10 row 9b.)* **A reason to wander.** Gulls lead you to places you haven't found (V-M3). The map shows sea glass found and missing, and which places are discovered. | M |

## N — Nalati: tune, don't add

| Row | What | Effort |
|---|---|---|
| N-a | **Jake: yes, fix both edges (E423 grill, 2026-10-03).** *(The camp side is NALATI-FINISH B6, done `48740dc`; the kurgan / east edges not checked here.)* **Hide the world edge from mid-map.** At the kurgans (`x=-106 z=100`) you can see a flat plane with a seam and cyan posts. This goes beyond N23, which covers only the camp side. Also fix the untextured slabs and black spruce cut-outs on the east edge (`x=209`). | M |
| N-b | **Jake: verify on HEAD, then fix or close (E423 grill, 2026-10-03).** **The "elite nearby" banner only near the lair.** Today it shows for Aqbars at the camp and at Eagle Rock. | S |
| N-c | **Jake: yes, Driftwood's fight rules (E423 grill, 2026-10-03).** **The same fight rules as D1–D2.** Wolves take you from 100 to 4 health in about 8 s. | S |

## M — one game, not three demos (after F0 ends)

| Row | What | Effort |
|---|---|---|
| M1 | **Jake: yes, CONTINUE and a shard map with progress on the title; title mockups asked with the question tool first (E423 grill, 2026-10-03).** **Continue, and a shard map with progress on the title screen.** **Moved by SHARD-PLATFORM G132 (Jake, 2026-10-04):** both live inside the SHARD SELECT screen; the new main menu stays two cards (G88). Layout (G133): progress on each carousel card + CONTINUE on the last-played card, each shard shown once, and no map or grid in SHARD SELECT (Jake): the "shard map with progress" becomes progress on the carousel cards (`art/menu/round-10-continue-progress/`). | M |
| M3 | **Jake: yes, the controls half as a per-shard verb audit, then align the outliers (E423 grill, 2026-10-03).** **(The HUD half done: E154, `50a29525`, one shared base HUD on every shard.)** **One controls and HUD spec for every shard.** Same verbs, same buttons, the weapon strip everywhere, one phone layout. | M |

## PK — rows Jake picked in the E423 grill (2026-10-03): approved, unowned

| # | Row | Done when | Was |
|---|---|---|---|
| PK1 | **A worker pool for procedural generation** (EF9): move the generators off the main thread | Pine Hollow's measured 150 ms long task is gone at load, measured on the phone tier | E377 |
| PK2 | **Pooled projectiles and a far crowd** (EF3): structure-of-arrays pools beside X5's one `ParticlePool` | arrows, javelins, darts and a distant crowd allocate nothing per shot or frame | E377 |
| PK3 | **One asset folder per shard** (TP18): `public/assets/<slug>/{models,music,sfx,lut,title,baked,packs,…}` instead of grouped by type; players re-download once | every shard's assets live under its own folder; manifests, `assetGlobs`, bakes, packs and the SW follow; one release note for the re-download | E377 |
| PK4 | **BatchedMesh → instancing, where it measures better** (E358; Jake: "if instancing is better then we can do that"): Pine's crags / props / trees / boulders, Nalati's camp people, Driftwood's two | each family built both ways behind a default-off Debug row and measured (memory, draws, frame); the winners kept, with one physical-iPhone memory reading before a default flips (AGENTS.md, Rendering) | E358 |
| PK5 | **An on-screen "? KEYS" help chip on the desktop HUD** (E420): F1 / `/` already open the key help (E419) | placement options asked with the question tool (mockups as previews), the HUD change announced over herdr, built, SHA sent | E420 |

## Ship checklist: Jake's own steps before a public release (E423 decision 22)

Real-world steps only Jake can take. They are not nagged in the session brief; they matter when he decides to ship.

| # | Step | Why | Was |
|---|---|---|---|
| SC1 | Enrol Apple Developer ($99/yr) and Play Console ($25); create the `VERCEL_UPDATES_TOKEN` Actions secret | the native apps' only blocker (NATIVE-APPS N2) | E24 |
| SC2 | Register Wildshard with Stability AI for commercial use (Stable Audio 3 Medium: free under USD 1M revenue) | a licence condition for the shipped SFX takes | E56 |
| SC3 | Listen on the phone: veto any MiniMax music auto-pick and the re-scored trailers (the round-2 listening page) | the score ships as auto-picked until he vetoes | E57 |
| SC4 | Watch (and listen to) the 45 s Steam trailer, 15 s per shard | the Steam wishlist page | E168 |

## Docs to fix (found by the audit; not built here)

- **Pine Hollow is described as the whole game.** `README.md`, `docs/SUBAGENT-BRIEF.md` and `docs/SHARDS.md` still describe "a pine forest, three cabins, a crossbow".
- **`docs/RUNNING.md` still says `vercel deploy`.**
- **`docs/AAA-PLAN.md` claims Pine Hollow runs at 60 fps.**
- **Ask D38 says day/night is not built.** It is, and it runs by default (`src/engine/world/DayNight.ts`).

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

- **Adopt:** three-mesh-bvh (melee and camera queries, behind `src/engine/physics/query.ts`), Playwright as a gate (S1), and three's Inspector and the Needle Inspector as dev tools.
- **Later:** koota (crowds) and three.quarks (effects).
- **Avoid:** Howler, and chasing WebGPU for its own sake.
- Full comparison: `docs/design/audit-e108/engines.md`.
