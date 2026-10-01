# Z3 · the new shards' API gaps

The lead's copy of what the two fresh Z3 agents reported (11 §Z3 step 4): shard 5 **Signal Dunes**
(`src/shards/sunscar-dunes/`, E363 · API gaps) and shard 6 **Sky Reach** (`src/shards/far-reach/`, E364 · API gaps).
Each gap gets fixed in the public API (with a test and its ENGINE.md / SHARDS.md / template lines). Then a fresh agent
rebuilds each shard from the docs alone, and its gaps land here as a new round. Z3 closes when a run has **zero engine
edits and zero gaps**.

## Round 1 (2026-10-01)

| ID | Gap | From | Wanted | Status |
|---|---|---|---|---|
| G0 | A shard's deck / Explore card art has no public fallback (`artFor`); far-reach's `card.jpg` failed `test/shard-prefetch.test.ts` | Z3 suite (8d97b0ca) | runtime fallback to the public card bytes + ENGINE doc | in flight (sol-tests, candidate 4a5534f2) |
| G1 | No readable movement mode: "is the player on the hoverboard?" (hover bridges' collider gate + glow). Used the undocumented `runtime.world.player.hover` | E364 #1 (#2 is covered by `active()` once G1 exists) | `app.player.mode` (`'foot' \| 'board' \| 'swim' \| 'ride'`) plus a `player.mode` event | open |
| G2 | No flying creature. `SpeciesRow` / `ThinkCtx` / `StrikeRunner` are ground-only (xz, slope steer, ground follow owns `y`). Dunes' ray uses `Animal.yOffset` + raw `setMotion`; Sky Reach's manta uses the undocumented `Animal.driven`. | E363 #2, E364 #3 | a documented `flight` block next to `steer` (altitude, climb/dive rate) and a 3-D strike shape | open |
| G3 | No creature push and no fall death. `DamageRequest.knockback` does nothing documented to an `Animal`; Sky Reach moves `Animal.position` itself and kills over the void with `combat.hit({ amount: 1e4 })` | E364 #4 | a documented creature impulse; an out-of-world / fall death cause | open |
| G4 | `ShardManifest.style` is a closed union; Sky Reach says `toon` | E364 #5 | an open string (known words stay typed) | open |
| G5 | Relabelling the melee attack disc doesn't show: the context relabels `r0` SWING, the live disc still reads ATTACK; §10 doesn't say `r0` is the melee attack disc | E364 #6 | `touch.relabel` works on the attack disc and §10 names the spots | open |
| G6 | A custom weapon's viewmodel doesn't draw. The camera is in the scene only when a kit family adds it; the depth-clear viewmodel pass is copied per family. The template's whip shows only because its sword adds the camera. | E363 #3, E364 #8 | a viewmodel root on `app.equipmentHost` that the engine draws (camera always in the scene, one shared clear pass) | open |
| G7 | A backdrop's `clouds` dome is not added to the scene; ENGINE §13.1 doesn't say who adds it | E363 #4 | the engine adds it (or §13.1 says the backdrop must) | open |
| G8 | The template's custom melee context declares `attack` / `heavy` / `lock` with no `keys`, and its heavy reads `altHeld` while the touch hold sets `adsHeld`. The E365 whip findings trace back to it. | E363 #5, E364 #8 note | template + SHARDS §5 step 4 show the keys and the `heavy` binding, or a custom melee context inherits `weapon.melee`'s keys | open |
| G9 | Far ridges and the boundary always build. The way to turn the rings off (`horizon: { rings: [], cloudSea: false }`) is only in Nine Dragon's manifest; a dune sea can only recolour them | E363 #6, E364 #9 | ENGINE §6 documents `horizon` fully; a shard can drop or reshape the rings | open |
| G10 | Doc nit: SHARDS §3 says the manifest imports `buildTerrain` from `#engine/data`, the template imports it from `#engine` | E364 #7 | one import path, the same in both | open |
| G11 | `pnpm gen` writes every slug's `lint/shard-words.generated.json` entry from the shared tree; a shard agent has to splice HEAD + its slug by hand through a private index | E363 #1 | `gen-shards` writes one slug's entry (or one file per slug) | open |
| G12 | A `git archive` check export is 3 GB with `public/` (ENOSPC mid-session) | E364 #10 | SHARDS documents a check export that skips `public/` (symlink it) | open |
