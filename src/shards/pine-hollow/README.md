# Pine Hollow (`pine-hollow`)

A photoreal boreal forest round a sheltered hollow, from dawn fog to lantern-lit night. The player hunts deer, boar,
elk and bear through the pines, relights the ranger's three waystone lanterns and faces the Antler King. Second card on
the title deck.

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `live`, 2 |
| `style`, `kitLook` | `pbr`, `pbr` |
| `uses` | `dayCycle`, `weather` |
| `ground` | a textured splat terrain (`world/terrain.ts`) and its water rows: the pond, the creek, the beaver pool |
| `treeCount`, `trees` | 2,600 pines from its Blender species set |
| `loadout` | the crossbow and the hoverboard at the start; the lever-action rifle and the Warden's Longbow come later |
| `fight` | buffer 120 ms, coyote 100 ms; untelegraphed charges |
| `bag` | MAP · GEAR · FINDS · PACK · FEATS; a 7-slot pack that keeps venison, hides, the boar tusk, the bear pelt, amber resin and the lodge ribbon |
| `tiers` | phone: shorter tree, shadow and animal-shadow distances, 40 grass slots, depth slices, stepped environment light, point-light skip |
| `horizonStrips` | the painted far country, day and night, with phone copies |
| `assetGlobs`, `ktx2` | its crag, hero and tree model folders (and KTX2 mirrors); `ktx2.generated.ts` |

## Its custom code, and why

| Folder | What | Why custom |
|---|---|---|
| `world/` | cabins and the homestead, the mill hamlet, landmarks (the fire lookout, the footbridge, standing stones, the dam, the canoe), crags and the bear cave, the pond, streams and beaver pool, undergrowth, props, the trophy wall, weather FX | Pine's world; its PBR kits serve no other shard |
| `species/` | coats, hulls, rigs and palettes for its rig-baked PBR creatures; the night thralls | only Pine renders creatures in PBR coats |
| `combat/` | the Antler King (on the engine boss runtime), four elites, charge tells, spawns, strikes | its own fights |
| `quest/` | *The Warden's Hollow*: the lantern quest, the lodge contracts, trades, the trader and the miller, night thralls, NPC models and rig | its own adventure |
| `weapons/`, `loadout/` | `LeverRifle extends Firearm` (rung 2), the Longbow profile and view on the kit `Bow`, ammo, finishes, skins | only Pine carries them (09 #3) |
| `life/` | ravens, the owl, the woodpecker, hares | its small life |
| `look/` | the sky backdrop on seven pure-sky keys that re-light the IBL | the PBR sky is Pine's |
| `audio/` | the forest ambience with zoned beds and interior reverb, the score, SFX, synth fallbacks | its own sound |
| `compendium/`, `compendium.ts`, `feats.ts`, `items.ts` | the hunter's journal, 19 feats, its items | its own game data |
| `debug/` | its Debug rows | its own toggles |

Layout debt (grandfathered): `compendium.ts` next to `compendium/`, `debug/`, `dev/`, `feats.ts`, `items.ts`, `life/`.

## Budgets

Phone 30 fps (9.6 ms CPU), desktop 60 fps (4.8 ms). Cold play on 4G within 40 s. F2 ceilings for the poses `gate`,
`cabin`, `pond` in `budgetCeilings.ts`.

## Look

Photoreal PBR: Poly Haven ground sets on a splat terrain with the boreal ground shader, the Blender-built pine species
baked into card and impostor LODs, one shared wind, a full day from seven sky keys, dawn ground fog and rain showers,
the painted far country at infinity, the learned LUT. `look/render.ts` is an `extend` look: the engine chain plus its
sky backdrop.

## Open asks

- E141: the checks only Jake can do after the remaster (an iPhone 30 fps reading, a listen).
- E91: a flickering black square in front of the clouds.
- E358: convert the non-facade `BatchedMesh` uses (crags, props, trees, boulders), after GAME-NORMALIZATION.
- E170: rough spots the trailer framed around (a pick per spot).

The ask files in `docs/tasks/asks/` are the truth; this list is a pointer.
