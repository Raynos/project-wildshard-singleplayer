# Signal Dunes (`sunscar-dunes`)

The fifth shard (E363, E357 Z3): realistic dark-orange dunes just after sunset, a braided leather bullwhip, a dune ray
gliding against the dusk, and one quest step: light the signal fire on the wooden tower on the far crest. Jake's pick:
**C · Signal Dunes** (`art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg`). Built from `docs/SHARDS.md`, the
template and `docs/ENGINE.md` alone (round 3 rebuild, Z3R brief).

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `experimental`, 50 |
| `style`, `kitLook` | `signalDusk` (a label), `pbr` |
| `uses` | `quests`, `hover`, `coins`, `loot` |
| `ground` | a 500 m dune sea from `world/dunes.ts` (`buildTerrain`), one trail from the spawn crest to the tower |
| `horizon`, `boundary` | two low far-dune rings, no cloud sea; no drawn edge dressing |
| `loadout` | the custom bullwhip (held), the kit hoverboard |
| `species` | `duneRay` (a flyer) |
| `audio` | `ambience: 'none'`, a silent score, the whip's cues on kit voices |
| `dev.poses` | spawn, weapon, creature, quest (degrees) |
| `assets` | none: every model is code, the card is a bundled SVG |
| saves | one shard key, `sunscar-dunes.signal` (the fire stays lit, the reward pays once) |

## Its custom code, and why

| File | What |
|---|---|
| `look/render.ts`, `look/sky.ts` | an `extend` look: a camera-centred dusk dome (orange band, violet, indigo, first stars), dusk distance fog and a rippled-sand terrain painter, all through `patchShader`; a held low orange key light |
| `world/dunes.ts` | the transverse-dune height function (lee faces under ~30°, flattened toward the slab edge) and the sand colour |
| `world/tower.ts`, `world/build.ts` | the signal tower: legs, X-braces, deck, rail, mast, a stair (`treads`), the brazier and its fire; one registry piece and the brazier interactable |
| `weapons/Bullwhip.ts`, `weapons/whipModel.ts` | the custom weapon (rung 3): a 7 m narrow crack; hold ATTACK and let go (or Heavy) for a double crack at 8 m that lands twice. The lash snaps out to the crosshair in the viewmodel |
| `species/duneRay.ts` | the dune ray: `flight` (15 m over the ground), a brain that circles, dives, skims the player with a `sphere` strike, hangs low (the whip's window) and climbs away; a custom five-bone rig (body, head, two wings, tail) |
| `quest/install.ts` | the one-step quest "Light the signal fire", five coins at the fire |
| `audio/cues.ts` | the whip's cues on kit voices until its own crack is generated |

## Budgets

The template's inputs, with AI / animation for one flyer and world for the dune mesh (`budgets.ts`). The recorded
`ceilings` (`budgetCeilings.ts`) are the lead's measured data.

## Look

Dusk held at 19:00: no day cycle, no weather. Sand albedo by height, wind ripples near the camera, indigo hemisphere
fill, an orange afterglow key from the north-west. Board: `art/sunscar-dunes/round-4-rebuild/`.

## Open asks

- E363: Jake's look at the round-4 board.
- Leftovers: the whip crack, a wind bed and a dusk score generated locally (MOSS + Stable Audio, MiniMax); a painted
  portrait card; the dune ray does not respawn after it dies.
