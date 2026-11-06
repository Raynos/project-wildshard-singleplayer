# Sky Reach: the Storm Roc repaired (E392 / E399, council round 13, the Roc findings)

The council (round 13, the lead and seats A, B, C): the Roc was torn (sky showing through its legs and tail), carried a
stray beaked lump in its tail, hid its head behind the boss bar, covered the sun with its tail, and took off at a fixed rim
point rather than at the player.

- **The tears were the rig's, not the mesh's.** `rocRig` bound each triangle wholly to one bone, so every triangle across a
  wing root opened a crack as the wings flapped; the line x = ±1.1 m ran through both legs and the tail fan. The textured
  eagle is now skinned with blended weights (`rocSkin` in `src/shards/far-reach/species/stormRoc.ts`): the wings ease in
  across their roots and out toward the tail fan; the legs, breast and fan stay with the body; the head eases in across
  the neck.
- **The mesh** (`scripts/blender/far-reach-roc/repair.py`, target `far-reach/roc`): the loose 113-vertex lump deleted,
  7 open edges filled (0 after the repair; meshopt's quantisation reopens a 2-edge sliver), the two black-and-yellow claw
  shapes Hunyuan painted onto the tail fan's underside (from below, the "second beaked head") painted out with the fan's
  own colour (8 505 texels), the toes (13 863 texels) and beak (5 085 texels) pushed to gold. 12 k tris and a 1024 WebP
  map as before: 274 KB against 277 KB.
- **The flight:** pitched 1.1 rad (was 0.45, nearly upright), so it flies near level, head forward, tail trailing; the
  head bent back up by the flight pitch less 0.3 rad at load, so the face looks ahead rather than at the ground.
- **The take-off** aims at the player's live position (`ctx.player`), not `(DAIS.x, CROWN.z + CROWN.r)`. It perches
  turned 0.8 rad from the entrance, swings round onto the player at 0.15 rad/s and leans up to 0.35 rad into that swing
  (rolling out as it lines up), the head looking into the turn. It gathers its 1.6 m/s as it lifts. `restart()` and the
  stage zero its speed (placed mid-lap it kept its lap speed and slid ~5 m off the stone).

## Files

- `board-d.jpg`: A mockup D · B round 13 (`progress/far-reach/20261003-0719-8512344b`) · C repaired, the same camera
  and stage (`roc-opening`, 3.3 s) · D a 24° close-up at the same moment.
- `turntable-new.jpg`: the reference and the repaired model, 8 views round and one from below.
- `tail-paint.jpg`: the flight pose from below-front, the old paint (claw marks on the fan) over the repaired one.

## Measured (mock-D, Rec. 709, 390 x 844 BICUBIC)

| | mockup D | round 13 | repaired |
| --- | ---: | ---: | ---: |
| sun patch x .05-.45 / y .44-.50, share > 230 | 36.7 % | 3.1 % | **20.4 %** |
| sun disc, left half y .40-.52, share > 245 | 6.25 % | 0.01 % | **2.45 %** |
| frame p99 (rows 60-699) | 241.4 | 222.5 | **231.4** |
| mean of the top 1 % | 247.6 | 230.3 | **240.1** |

The sun is no longer behind the Roc; what is left of the gap to the mockup is the sky's (round 12, with the Roc off the
sun, read 23.0 %). Both wingtips are in the frame (x .05 and .93) and the head sits at y .34-.40, under the bar (y .25).

## Open

- From the arena the head reads as a white face under a dark crown; the gold beak and toes show in the turntables but
  read pale in the game's backlit front. `ROC_HD.selfLight` (0.35) is the lever if the look owner wants more of the
  map's own colour on the shadowed side.
