# How Driftwood Isle got built in a night

A second, fully playable shard — low-poly tropical island, sword combat, swimming and diving,
five enemy types, gulls, a ringed planet — went from a "coming soon" card to live on the phone in
about four hours (2026-09-18, 00:20 → 04:23). 129 commits, 25 production deploys, nine agents in
parallel, one person steering from a phone. This is what made it work, so it can be repeated.

## 1. Pick the art style the engine hits at 100 %, not the one that looks best on a slide

Three spawn-point mockups in three low-poly styles; the pick was **faceted flat-shaded, no
textures** — chosen explicitly because it was the *easiest*. Consequences: every material is
`MeshStandardMaterial({ flatShading, vertexColors })`, every asset is procedural geometry, nothing
is downloaded, and 60 % execution reads as *finished*. Photoreal is the opposite target: 95 %
reads as uncanny, and the last 5 % is where all the time goes. Aim where "almost" is fine.

## 2. Mockups are screenshots of the real game, with the real HUD

Not concept art. Codex image-gen, first person, portrait, the actual phone HUD pasted in as a
reference, no ammo counter. Every agent then had a picture to converge on and a definition of done
that was not a sentence. (The one round done third-person was thrown away in a minute.)

## 3. Deploy the first checkpoint before it is good

"Sword + pier, that's it, even half broken, mark it super experimental." Live at 01:45. Then 24
more deploys, each from a clean `git archive HEAD` export. The phone is the only test rig that
finds the bugs that matter — the crash that froze the load was a service-worker cache edge that
headless Chrome never hit; an uncaught-exception modal (asked for on the spot) turned it into a
20-minute fix. The shard was *playable* three hours before it was *done*, and playing shaped doing.

## 4. Decide fast, in your own words, and mostly say no

No block, no dodge (strafe or eat it). No drowning. No inventory yet. Hands are white gloves.
Underwater is decorative. Same chunk edge. Same HUD. One swing, then a three-hit combo. Each "no"
deleted a week; none made the island less fun. Ambiguity was resolved in seconds, never guessed twice.

## 5. The engine is a kit; a shard is data plus a dozen small modules

`ChunkDef` already drove terrain, sky, fog, grade, fauna, HUD, loading and menu per shard. The
crossbow had forced a `Weapon` contract; the boar came with bones and an AI. Driftwood was ~80 %
recomposition: the low-poly boar is the same skeleton with fewer loft segments and no fur; the sword
slots in behind `Weapon`; each POI is one file with `build()`, `colliders`, `floorHeightAt`. No
multiplayer, no hosting, no chunk format, no upload server — save → HMR → screenshot in ten seconds.
That loop speed is the whole ballgame for visual work.

## 6. Parallel agents with hard ownership, one integrator

Nine agents over the night (world, sword, boar, swim, combo, ambient, dive, loot, enemies), each
with a file set, a mockup, a dev harness, and a screenshot obligation; one parent owning `main.ts`,
`docs/plans/DRIFTWOOD.md` (now `project/archive/2026-09-18-driftwood.md`), `docs/tasks/ASKS.md` and every deploy. The plan and the ask ledger were
the shared memory. The tax: a shared git index in one checkout bit four times; the fix was
committing through a private index pinned to a captured base (`GIT_INDEX_FILE` + `read-tree $BASE`
+ `commit-tree -p $BASE` + `update-ref … $C $BASE`). Still far cheaper than serial.

## 7. Steer on feel, not implementation

"Cute." "You can't just walk up a cliff." "Aiming a sword doesn't make sense." "It's stuck loading."
Each is a one-line outcome that turns into a spec and an owner. Nobody said *how*.

## The recipe, for the main repo

Prototype the look standalone. Pick a style the engine hits at 100 %. Mock it up with the real HUD.
Ship a half-broken checkpoint to a phone within the hour and keep shipping. Say no to everything
that is not the feel. Build against a data contract (`ChunkDef`) so the result ports into the real
chunk format afterwards — everything here is data plus modules, not a fork of the engine.
