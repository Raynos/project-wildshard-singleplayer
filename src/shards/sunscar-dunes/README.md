# Signal Dunes (`sunscar-dunes`)

The fifth shard (E363, E357 Z3 round 2): realistic dark orange dunes just after sunset, a deep orange and indigo sky
with the first stars, a braided leather bullwhip, a dune ray gliding over the crests, and one quest: light the signal
fire on the wooden tower on the far crest. Jake's pick: **C · Signal Dunes** (`docs/tasks/asks/E363.md`, mockup
`art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg`). Built from `docs/SHARDS.md`, the template and
`docs/ENGINE.md` alone.

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `experimental`, 5 |
| `style`, `kitLook` | `duskDunes`, `pbr` |
| `uses` | `quests`, `spawns`, `hover`, `explore`, `coins`, `loot` |
| `ground` | a 500 m dune sea from `buildTerrain` (`world/dunes.ts`): warped transverse dunes, a swell, the spawn crest and the tower crest with a level pad; sand laid down toward the four entry roads. Every face is under 40° (the contract test walks it) |
| `horizon` | two low dune rings in dusk browns, no cloud sea (no grey ridges) |
| `loadout` | the custom bullwhip (held) and the kit hoverboard |
| `species` | `duneRay` (a flyer with its own brain) |
| `hud` | the baseline HUD only: the whip is ATTACK (hold = double crack), the objective pill carries the quest, a pin names the tower |
| `assets` | none: everything is built in code; the cards are inline SVG |
| saves | one shard key, `sunscar.signal` (the fire is lit; the reward is paid once) |

## Its custom code, and why

| File | What |
|---|---|
| `weapons/Bullwhip.ts` | a custom weapon (`extends Weapon`, `blocks.viewmodel` + `blocks.melee`): a 6.5 m crack in a 0.9 m lane; hold ATTACK and let go for a 7.5 m double crack with stagger and knockback. Nothing in the kit cracks at that reach |
| `weapons/whipModel.ts` | the camera-space whip: a gloved fist, a braided handle, a 26-segment instanced lash that coils at rest and lays out on a crack |
| `species/duneRay.ts` | the dune ray: a `flight` species, a `CreatureBrain` (circle → rear → swoop → climb) on `ctx.flight.steer`, one `sphere` strike, a skinned manta built from one sphere, flapping wing bones |
| `world/tower.ts`, `world/build.ts` | the signal tower: braced legs, a deck with rails, a mast and cross, a 16-tread stair (a `treads` collider), the iron brazier and its fire; one registry piece |
| `quest/install.ts` | "The signal fire": reach the tower, light the brazier (an `Interactable` on the deck), five coins once |
| `look/render.ts`, `look/sky.ts` | an `extend` look: the clean engine chain, a dusk clock held at 18.9 h, a dome with the orange band, indigo and stars, a low warm key light from the north-west, the dune mesh carried out to the far dunes, and wind ripples patched into the sand material |
| `audio/cues.ts` | the whip's cue ids, played on kit voices for now |

## Budgets

Phone 30 fps (9.6 ms CPU), desktop 60 fps (4.8 ms), the template's lanes with AI and animation for one flyer. See
`budgets.ts`.

## Look

Dusk just after sunset: a narrow orange band under violet and indigo, faint stars, dark orange sand lit by a raking
warm key, cool blue-violet in the hollows (the hemisphere light), dusky haze on the far rings. No glass, crystals,
mirrors or glowing magic. Board: `art/sunscar-dunes/round-3-rebuild/`.

## Tests

`test/shards/sunscar-dunes/contract.test.ts` boots it headless through every stage, lights the fire and checks the
reward, walks every dune face for slope, and checks the whip's lane and hold-release. `manifest.test.ts` keeps the
manifest node-safe.

## Open asks

- E363: a generated whip crack and a dusk wind bed (MOSS + Stable Audio), a dusk score (MiniMax); the cues use kit
  voices and the score is silent today.
- E363: a portrait title card painted from a capture (the cards are inline SVG).
