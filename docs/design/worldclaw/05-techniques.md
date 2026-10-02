# 05 · WorldClaw's techniques against our organic shard building

The briefing Jake asked for (2026-10-01: "what techniques are good for world claw, what techniques are not good …
which ones are suitable to our shard … how does that compare to the organic techniques we've been using"). The grill's
answers are decisions D17–D27 in [WORLDCLAW-SHARD §0.2](../../plans/WORLDCLAW-SHARD.md).

## How our shards were built (the organic way)

| Shard | How its world was made |
|---|---|
| Driftwood Isle | hand-coded layout and `landscape()`; code-built toon models (`LowPolyKit`); a Blender-baked spawn cove (`build_island.py`: ~60 prototypes, ~16.7k placements by height / slope / trail, AO + bounce bakes); LOOK-LOOP rounds; a painted horizon matte; a learned LUT |
| Pine Hollow | Poly Haven PBR ground; a Blender-built tree species set with impostors; 8 TRELLIS hero props; a crag kit; LOOK-LOOP rounds 14 and 17 |
| Nalati Grasslands | **a painted map image hand-translated into terrain formulas** (`nalatiLayout.ts` from `art/nalati-grasslands/round-8-three-zones/map-4-bowl-ring.jpg`); 18 Hunyuan3D / TRELLIS models under a painterly post; one painterly atlas |
| Nine Dragon Stack | mockups → two domes per mockup → 3×3 targets imagined from the mockup → per-dome lanes with disjoint files; a kit + facade grammar (28 piece types); a partial shard behind containment; lane budgets |

What they share: a person steers every round; kits and variants carry the repeats; generated models are a few heroes
(8–18 per shard); everything is judged in the real game.

## Technique by technique

| # | WorldClaw technique | Our organic equivalent | Verdict | Decision |
|---|---|---|---|---|
| 1 | The prompt's explicit asks kept apart from what the agent fills in | Jake's words in ask files | **take**, cheap | `spec.intent.explicit` |
| 2 | One structured spec all agents read | prose plans + code | **take**: the base of regeneration and steering | D17 world as data |
| 3 | An image model paints a flat-colour region map | Nalati's map, hand-translated | **take**: automates what Nalati did by hand; a schematic first so places don't drift | R1 |
| 4 | Eq. 6: per-region height = base + noise + landform operators | hand-written `landscape()` | **take, bounded**: the walk rule (≤ 40°, 0.35 m step); the 2 m grid; cliffs as scenery with routes around | D24 the cube |
| 5 | Terrain materials as Blender node graphs | splat / vertex colour / the shard's look | **drop**: Blender nodes don't run in three.js; materials target our shaders | — |
| 6 | Rocks and plants by image-to-3D | Blender species with impostors, code palms, CC0 | **decide by demo**: image-to-3D foliage is weak, and WorldClaw itself used Sketchfab and code for scatter | D20 → X1 |
| 7 | Masked Poisson / random scatter with slope and height filters | `placement.ts`, the cove rules | **take**: make it data-driven | D17, E2 |
| 8 | Render → inspect → edit loops in Blender | LOOK-LOOP in the real game | **ours is better**: we judge the shipping renderer | D26 |
| 9 | Pick the regions that get detail | named places = Sets | **take**: 1:1 with the Set Explorer | D2 |
| 10 | **Paint-then-lift**: the image model composes a place on a terrain render; each object becomes 3D | mockups, then an agent hand-places | **take for dressing + buildings**; gameplay structures stay code | D19 |
| 11 | SAM3 segmentation + SAM3D per-object 3D | — | **replace**: no MPS; a codex re-draw isolated on white is cleaner | R2 |
| 12 | Ray-pair placement + contact search | — | **take, simpler**: our camera is recorded exactly and the surface is the game's own (the physics query layer, then the baked terrain) | R3 |
| 13 | Flatten the ground under each building | cabin pads, graded paths | **take**: pads as data | R5 |
| 14 | ~100 unique generated meshes, 2K PBR each | kits + variants + instancing, few heroes | **drop**: too heavy for the phone and samey; the catalog is decided per place | D18, R7 |
| 15 | Dense diorama composition | routes, rest areas, sightlines | **drop**: a level needs pacing | D5, D25 |
| 16 | Blender hosts the whole scene | the game hosts; Blender bakes | **drop**: it would bypass the model contract | D2 |
| 17 | Instance / depth / normal renders | the lit frame only | **take as Explorer views** | D23 |
| 18 | Judges: the VLM in the loop | Jake every round | **take for the autonomous flow** after a front-loaded review | D15, D27 |

## The resulting split

**WorldClaw for composition and coverage**:
- the spec;
- the layout map;
- Eq. 6;
- masked scatter;
- paint-then-lift for dressing and buildings;
- ray placement;
- check loops.

**Organic for structure and feel**:
- `design.md` (the design first);
- code models for everything you walk on or fight around;
- kits for repeats;
- LOOK-LOOP;
- two domes per hero view;
- 3×3 targets;
- judging by walking on the phone.
