# Sky Reach (`far-reach`)

Floating grass islands over a sea of cloud at golden hour (Jake's pick **B · Sky Reach**, E364). Rope bridges carry
you on foot; the glowing hover bridges and the updraft carry only a hoverboard rider, so on foot you fall straight
through. Built from `docs/SHARDS.md`, the template and `docs/ENGINE.md` alone (E357 Z3 round 4), then the full content
of [SKY-REACH](../../../docs/plans/SKY-REACH.md) (E374): eight islands, four creatures, a four-step quest chain, the
Storm Roc.

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `experimental`, 60 |
| `style`, `kitLook` | `skyReach` (its own label), `toon` |
| `ground` | `structures: true` only (G23): eight islands and their bridges are registry pieces (`world/build.ts`); no terrain mesh or collider, the analytic floor is y −1000; `world.killY` ends a fall into the cloud sea |
| `world`, `bounds` | `killY` 6 m (creature death plane); the whole 500 m cell, a soft-respawn floor at −8 m (under the road-level entry landings, SF49-g) for a player who falls |
| `horizon`, `boundary` | no ridge rings, the engine's cloud sea; no drawn edge |
| `uses` | `hover`, `quests`, `bosses`, `coins`, `loot` |
| `loadout` | the war fan (held) and the kit hoverboard |
| `species` | `driftRay`, `skyGoat`, `galeWisp`, `stormRoc`; the rays, wisps and Roc fly (`flight.above: 'world'`), the goats walk the island decks (G26 spawn placement, G27 fall) |
| `encounters` | `far.roc` (the Storm Roc boss) |
| `audio` | `ambience: 'none'`, a silent score, kit sword cues; no `preload` (asset-free) |
| `assets` | `assetGlobs: ['public/assets/far-reach/**']`: seven generated GLBs (C6 and the rope-bridge kit, `public/assets/far-reach/models/`, ~315 KB, in `boot.sources().props`); an inline SVG card, no KTX2 |
| saves | one shard key, `far-reach.rewarded` |

## Its custom code, and why

| File | What |
|---|---|
| `data/layout.ts` | every coordinate: the islands, the three spans, the winch, the rays' homes; `HOVER_GAP` keeps a hover deck clear of every rim |
| `layout.ts` | the maths over those coordinates (a data module exports no functions): `ropeSag`, `knollHeight`, `apothem`, `rimAlong`, `spireAt` |
| `world/shapes.ts` | flat-shaded vertex-coloured islands (12-gon grass top, violet keel), instanced pines, plank bridges (a rope span lays the generated deck segments, instanced, and four generated anchor posts; hover decks keep glass planks), the windmill, the winch |
| `world/meshes.ts` | the generated models (C6): loads the five GLBs once in `world` (`preloadSkyMeshes`), flattens each to vertex-coloured facets (the baked AO kept at 60 %), `fit` (size, floor / middle, `pitch`, footing centre), `bindRigid` (a creature's facets ride one bone each), `splitAbove` (the vane's rotor). A model that fails to load leaves the code model |
| `world/build.ts` | the pieces: island tops (six box strips cover the 12-gon), the rope bridge (deck + rails), the hover bridge (`active` only while `app.player.mode === 'board'`), the fallen bridge (`active` once raised), the windmill, the winch interactable, the vanes (`vaneColliders`: plinth, shrine box and post, measured off the generated shrine) |
| `world/islets.ts`, `world/risingIslet.ts`, `behaviour/islet.as` | SF49-g (G99 / G183, the Rising Islet): the four entries. At each edge midpoint a stone lip at road height (top y = 0, across the platform socket's full 8 m far edge; `shard.config.ts` declares the four as `socketOverWater` landings), a small grass islet resting against it that rises on chains (one SF30 kinematic mover per entry, `islet.as` in the fixed step, 6 s rests) to a gate isle 52 m in and 25 m up, and a rope bridge from the gate isle to the nearest island no quest gates (Sunrest, the Roost, the vane ruin, the pine grove; the south gate isle stands 40 m east so it clears the storm crown). The only way in since G194 (the `farReachEntries` Debug row and the closed old entries are deleted); the walk and ride proof is `progress/shard-platform/g183/` (`ride.mjs`, 4 of 4, 0 stuck) |
| `weapons/WarFan.ts` | the war fan (rung 3, `extends Weapon`): SWING arc slash and the held / HEAVY slash through `blocks.melee`; GUST (touch `verb.1`, key G) gives every creature in a 9 m cone `animal.impulse` away and a 4-point hit |
| `species/skyGoat.ts` | sky goats: ground walkers spawned on their deck (`animals.spawn(…, { fromY })` on the first fixed step: the spawn ray finds the islands only once physics has stepped); graze inside the rim, ram (lane) when crowded; GUSTed past the rim they fall (G27) through `killY`. `warmCoat` lifts the generated coat toward cream so it does not read mauve under the violet sky light |
| `species/galeWisp.ts` | gale wisps: drift over their island, dart and burst (sphere) at the chest; the burst shoves you back 7 m/s (G24, `pushPlayer` in `species/rig.ts`, bound to `app.player.impulse` in `play`) |
| `species/stormRoc.ts`, `combat/stormRoc.ts` | the Storm Roc: a `BossBrain` + `BossScript` (stoop dive, gale walls that shove you 14 m/s along their lane toward the rim, grounded on the dais), the shared `BossBar`, 25 coins once |
| `species/driftRay.ts` | the drift ray: species + custom rig (body, head, wings, tail) + `DriftRayBrain` (circle → stalk → hang → dive → rise) with a `sphere` dive strike |
| `quest/install.ts` | *The crown bridge*, staged with `installQuestPresentation` (ENGINE §20): talk to the bridge-keeper at the spawn → clear the roost's three rays → GUST the three vanes → the winch raises the bridge; markers, chips and hints on every step, a held reward view from the high step, 10 coins once |
| `quest/keeper.ts` | the bridge-keeper NPC (code figure, waves within 16 m, gestures while talking) and his dialogue (his first talk sets the notes flag) |
| `quest/flags.ts` | the quest's saved flags |
| `world/dressing.ts` | the meadow: instanced grass clumps, flowers, stones and hanging roots on every island (no colliders) |
| `world/distant.ts` | the skyline: 14 decorative 3-D islands and waterfalls past the archipelago, and the windmill isle's waterfall |
| `weapons/fanModel.ts` | the war fan to the review brief (nine teal panels, bronze ribs, tassel) in the shared gloved fist with a linen sleeve |
| `look/render.ts` | `extend` look, **Gilded Air** (`docs/design/far-reach/style-bible.md`): the clean engine chain, the dome, the cloud sea and a warm distance fog |
| `look/sun.ts` | the fixed golden-hour sun (low, ahead of the spawn, left of the windmill) and the sky palette |
| `look/light.ts` | the painted light: a `lights_fragment_end` patch adding a warm bounce wrap, a sun rim and a warm shade floor to every lit material |
| `look/sky.ts` | the dome: gradient, sun bloom, a cumulus panorama and distant-island silhouettes baked once into a 512×96 data texture |
| `look/cloudSea.ts` | two layered, sun-lit cloud sheets under the islands (opaque floor + drifting puffs) from one baked 64² tileable texture |
| `plugin.ts` | the hooks, the updraft's lift (on the board inside the wind column, a steady `app.player.impulse` up: it floats you off the ramp to the high step), the fan's input context (SWING relabel on `r0`, GUST verb), the winch, the hover-deck glow, the gust ring, the rays |

## Budgets

The template's inputs (phone 30 fps / 9.6 ms, desktop 60 fps / 4.8 ms); `ceilings` are the recorded ones in
`budgetCeilings.ts`.

## Look

Low-poly and flat-shaded: lavender-to-gold sky, sage grass, violet rock keels, dusk-purple pines, a cyan glass hover
bridge. Matches `art/far-reach/round-4-rebuild/board-3aac2db1.jpg` (Jake: the look stands).

**Models (C6).** The Storm Roc, the sky goat, the drift ray, the windmill tower and the wind vane are Hunyuan3D-2
(turbo + paint) generations from codex image_gen refs (`art/far-reach/round-7-models/ref-*.jpg`), made faceted and
vertex-coloured by `scripts/img2mesh/build_props.py art/far-reach/round-7-models/props.json public/assets/far-reach/models`.
The Roc is generated upright (its ref faces the camera) and pitched to fly, so its pale banded front is the underside
seen from the crown. The code models stay as the stand-ins (`rocCode`, `goatCode`, `rayCode`, the code tower and vane).

**Rope-bridge kit.** A plank deck segment (4.8 m, tiled and stretched to each rope span) and a rope-wrapped anchor post
(1.6 m, at the span's four corners), Hunyuan3D-2 from `art/far-reach/round-9-bridge/ref-bridge-*.jpg` by the same
`build_props.py` recipe (`round-9-bridge/props.json`). The ropes stay code; without the kit the code planks and posts stand in.

## Open asks

- E364: the shard (this rebuild, Z3 round 4); own SFX and a wind bed are a later polish ask.
