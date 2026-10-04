# Round 11: seam heights (SHARD-PLATFORM G74, ask E438)

Jake (G74): *"A combination of neutral buffer and soft gradient. We still have problem with heights. Go take a bunch of in
engine world explorer screenshots of the biomes that have different heights at the edges and figure out how to blend
those."* This round measures every grid shard's edge heights against the road, captures the edges in the World Explorer,
compares four ways to blend a strip, and mocks three of them onto the worst real seam.

## 1. Edge heights (measured)

Measured from each shard's shipped bake (`public/assets/baked/<slug>/terrain.bin`, 256² over 500 m), sampled at the cell
boundary (d = 0) at the 129 profile points `src/engine/sim/strips.ts` uses. Heights are relative to the road deck
(y = 0). The 15 m entry at every midpoint is flat at 0 for 50 m (W4, `src/engine/physics/edgeEntries.ts`), so every
"min 0.0" below is the entry. The bands give the share of the edge (excluding the entry) whose step to the road falls in
each band.

| Shard | Edge | min | max | median | p10 / p90 | < 1 m | 1–5 m | 5–20 m | > 20 m | What is there |
|---|---|---|---|---|---|---|---|---|---|---|
| Driftwood Isle | N | −2.6 | 0 | −1.5 | −2.6 / −0.1 | 31 % | 69 % | 0 | 0 | open sea; seabed −2.6, **water at +0.8**; jetty on its sandbar |
| | E | −2.6 | 0 | −2.5 | −2.6 / −1.8 | 5 % | 95 % | 0 | 0 | open sea; the Wreck Cove jetty (the 1.25 m sandbar step) |
| | S | −2.6 | 0 | −1.8 | −2.6 / −1.4 | 5 % | 95 % | 0 | 0 | open sea; the spawn pier (deck +2.0) |
| | W | −2.6 | 0 | −1.9 | −2.6 / −0.2 | 17 % | 83 % | 0 | 0 | open sea; jetty |
| Pine Hollow | N | 0 | **61.7** | **50.4** | 31.9 / 59.2 | 2 % | 2 % | 2 % | **94 %** | granite ridge / mountain wall, pines on top |
| | E | 0 | 42.5 | 5.8 | 3.1 / 38.2 | 3 % | 42 % | 37 % | 18 % | forest floor, rising to the ridge at the NE corner |
| | S | −9.0 | 11.0 | 3.9 | 0.0 / 9.8 | 4 % | 56 % | 40 % | 0 | forest hills, one −9 m hollow |
| | W | 0 | 59.2 | 6.6 | 3.2 / 45.3 | 3 % | 13 % | 69 % | 15 % | forest floor, ridge at the NW corner |
| Nalati Grasslands | N | 0 | 18.5 | 6.7 | 3.5 / 12.1 | 0 | 22 % | 78 % | 0 | the N23 grass berm (7–21 m) and spruce over the Kunes valley |
| | E | **−11.2** | **84.2** | 47.1 | 0.5 / 74.9 | 3 % | 7 % | 22 % | **68 %** | snow-ring crags; the river gorge leaves at −10 |
| | S | 0 | **85.3** | **60.6** | 10.8 / 67.0 | 0 | 2 % | 8 % | **90 %** | snow-ring crags |
| | W | **−9.9** | **99.2** | 47.0 | 5.8 / 73.7 | 0 | 2 % | 27 % | **70 %** | snow-ring crags; the river gorge leaves at −10 |
| Template | N E S W | −0.4 | 0.5 | 0.0 | −0.3 / 0.3 | 100 % | 0 | 0 | 0 | flat grey slab (noise ±0.4) |
| Signal Dunes (dev) | N | 0 | 9.6 | 4.7 | 2.4 / 8.2 | 3 % | 48 % | 48 % | 0 | dunes |
| | E | 0 | 9.4 | 4.3 | 1.7 / 8.4 | 3 % | 52 % | 44 % | 0 | dunes |
| | S | 0 | 10.2 | 4.5 | 1.2 / 8.3 | 3 % | 52 % | 45 % | 0 | dunes |
| | W | 0 | 11.5 | 5.8 | 2.4 / 9.1 | 3 % | 38 % | 59 % | 0 | dunes |
| Sky Reach (dev) | N E S W | **−40** | 0 | −40 | −40 / −34 | 2 % | 0 | 3 % | **95 %** | cloud sea at −40 (no ground); isles float at +27…+44, the nearest (Crown, +44) 40 m in from S |
| Nine Dragon (DEVSERVER) | — | — | — | — | — | — | — | — | — | no terrain bake: it passes against a flat datum it never draws |

**Seams in the dev grid** (|edge A − edge B| along the shared line; both sides meet the road at 0):

| Seam | max | median | p90 |
|---|---|---|---|
| **Driftwood E ↔ Nalati W** | **101.6** | **49.6** | 76.1 |
| Nalati S ↔ template | 85.5 | 60.7 | 66.8 |
| Pine Hollow W ↔ template | 59.4 | 6.4 | 45.1 |
| Pine Hollow E ↔ template | 42.8 | 5.8 | 38.1 |
| Sky Reach E / W ↔ template | 40.5 | 40.0 | 40.3 |
| Driftwood S ↔ Sky Reach N | 38.5 | 37.8 | 38.4 |
| Nalati N ↔ template | 18.9 | 6.6 | 12.0 |
| Driftwood N ↔ Pine Hollow S | 12.7 | 5.5 | 11.2 |
| Driftwood W ↔ Signal Dunes E | 10.6 | 6.5 | 9.6 |
| Signal Dunes N / S ↔ template | 10.3 | 4.5 | 8.5 |

Plus the outer ring (land at 0, G72): Pine Hollow N (median 50 m) and Nalati E (median 47 m) face it.

**What else the study found**

- `session.ts:166–170` still feeds every edge the empty-neighbour profile (all heights 0), so today's strips ignore every
  shard: the strip meets Nalati's 47 m wall at 0 and the gap is the slab's skirt.
- **Profile resolution:** the bake grid is 256 samples (1.96 m); the strip profile is 129 (3.9 m). They share only the two
  corners, so with real profiles the seam is a T-junction crack wherever the edge is not flat (Pine N jumps 18.6 m between
  two profile samples). The profile should be the bake's boundary row itself (256 samples), or the bake should be
  resampled at the profile's points with its outer row pinned to them.
- **Across the strip** the generator has 3 vertices in each 20 m strip (`STRIP_OFFSETS` 7.5 → 17.5 → 21.5 → 27.5): any
  real ease needs ≥ 1 vertex per 2 m there, and the collider is the same mesh.
- **Driftwood's sea (+0.8) is above the road (0)** everywhere outside the island: in the captures the study's road plane
  and road band are drawn but under water. One landmass (G72) needs the sea clipped at the cell and a dike.
- **Nalati's river** leaves the slab through −10 m gorges at the W and E ends: a seam needs a culvert, a bridge or a
  closed gorge there.
- **Signal Dunes** draws its dune field past its cell, which hides the road plane in its captures; its edges are 0–11 m.
- **The controller:** on foot 40° max climb (`src/engine/player/Player.ts` `MAX_CLIMB_DEG`), slide below normal-y 0.6
  (≈ 53°), step 0.35 m. The **hoverboard climbs any terrain** ("the repulsors glide up anything": it snaps to the ground
  if it ends up under it); only colliders (walls, posts) stop it. Its spring is capped at 30 m/s² and the grid allows
  30 m/s, so a grade change the board crosses at speed must keep v²·y'' ≤ ~10 m/s² (an S-ramp of height H over L:
  6·H·v²/L² → at 30 m/s, L ≥ √(540·H): 23 m for 1 m, 52 m for 5 m). The road itself stays at 0 (the entries are at 0),
  so the board on the road never meets a grade; the banks beside it are what it can ride up.

## 2. Captures (World Explorer, iPhone portrait)

`captures/<shard>-<edge>-<view>.jpg`, 66 frames from HEAD `5ce272552` (`scripts/serve-build.sh --head`), each shard
entered through Settings ▸ Developer → EXPLORE WORLD → World explorer, the camera held in god mode, the explorer UI hidden.
**Added for the study:** a flat grey-blue plane at the road level y = 0 outside the cell (the future strips and ring) and
a dark 15 m band where the highway runs (27.5 m out); everything above the grey is the step a seam must absorb.

- `out`: from the highway, 62 m out, 5 m up, looking in at the edge between the entry and the edge's highest point.
- `along`: 30 m out, above the edge, looking along it from beyond its highest point toward the midpoint entry.
- `high`: an oblique from 210 m out, 150 m up.

| Shard | Edges | Notes |
|---|---|---|
| `driftwood-isle-*` | N E S W × out / along / high | the sea covers the road plane: the +0.8 m water is the edge |
| `pine-hollow-*` | N E S W × 3 | N is a 50 m wall over the road; E / W walls climb to the ridge corners |
| `nalati-grasslands-*` | N E S W × 3 | E, S, W: 47–60 m crag walls with the slab skirt below; N: the berm |
| `sunscar-dunes-*` | N E S W × 3 | dune field drawn past the cell (hides the plane); 0–11 m |
| `far-reach-*` | N E S W × 3 | road plane and band visible under the cloud sprites; isles float 27–44 m up |
| `_template-*` | N E × 3 | flat at 0 |

`poses.json` holds every camera.

## 3. Four ways to blend a strip

The strip is the 20 m between the road edge (7.5 m from the road centre) and the cell edge (27.5 m). The road stays at 0.
H is the shard's edge height at a point.

| | Approach | Small < 1 m | Medium 1–5 m | Large 5–20 m | Huge > 20 m | Floating / below-road |
|---|---|---|---|---|---|---|
| **A** | **Eased ramp:** the strip's ground eases (smoothstep) from 0 to H across the strip, the colour from neutral to the shard's. Today's generator, given real profiles. | yes | yes (≤ 24° at 5 m) | to ~9 m walkable (40°), then an unwalkable bank | no: a 65–80° smeared bank, stretched texture, the board rides up it | no |
| **B** | **Embankment + retaining wall:** a low eased bank (≤ 6 m, ≤ 30°) in the strip, then a vertical neutral stone wall with a real collider at the cell edge for the rest. | yes (bank only) | yes (bank only) | yes (6 m bank + up to 14 m wall) | tall: a 40–90 m man-made wall reads as a dam | a parapet + guard rail on a drop |
| **C** | **Natural cliff cutting:** the strip stays flat (buffer + gradient); the shard's own rock (its style, its kit) rises as a cliff with a talus apron and a guard rail, as if the road was cut along a mountain's foot. | — | — | yes | yes: mountains meet a road naturally | — |
| **D** | **Shard edge eased to the datum:** each shard's outer band (40–60 m) eases its own terrain down to 0 at the boundary, so the strip is nearly flat everywhere. | yes | yes | yes | yes, but it flattens Nalati's crag ring and Pine Hollow's ridge (their skyline) and needs every shard rebaked | landing isle / viaduct for Sky Reach |

**Below the road and floating:** Driftwood needs a dike: the strip rises to a +1.3 m crest at the cell edge and a stone
revetment drops to the seabed inside, the shard's water clipped at its cell. The Nalati gorges get a culvert under the
strip (the river falls into it). Sky Reach (a 40 m drop to cloud, isles at +27–44) is a parapet and guard rail along a
cliff edge with the cloud sea below, and at each midpoint a viaduct / landing isle at road level (SF49) with Sky Reach's
own updraft to its decks; no ramp reaches +44 at a hoverboard-safe grade inside 555 m.

## 4. The board: the worst seam

`board.jpg`: Nalati Grasslands' west edge (it faces Driftwood's east edge: median step 49.6 m, max 101.6 m), from
`captures/nalati-grasslands-west-along.jpg`, each variant a codex image_gen edit of that real capture with an asphalt
road (G73), a neutral buffer verge and a soft gradient (G74), one landmass (G72).

| Letter | File | What it shows |
|---|---|---|
| A | `a-eased-ramp.jpg` | the ramp alone: a smeared 65–70° grass bank up the 45 m |
| B | `b-embankment-wall.jpg` | 6 m grass embankment, an 8 m neutral stone retaining wall, the shard's granite set back above |
| C | `c-cliff-cutting.jpg` | flat verge and gradient, Nalati's own granite cliff with a talus apron and a guard rail |

Two codex takes per variant, all six read; the first take of each kept (none garbled, no re-rolls).

**Recommended: C on this seam, as part of one rule by step size** (A below 6 m, B 6–14 m, C above 14 m; dike / parapet
below the road). C keeps the shard's own look on its own rock, keeps the strip flat for Jake's buffer + gradient, and its
collider stops the hoverboard where a bank would launch it.

## 5. The rule for SF17b's strip generator

Per profile sample s along the edge (the bake's boundary row, 256 samples), w = metres from the road edge (0 … 20):

1. **Deck** |u| ≤ 7.5: asphalt at y = 0. **Buffer** 0 ≤ w ≤ 4: y = 0, neutral grey-blue verge colour.
2. **Gradient** 4 ≤ w ≤ 20 (16 m): colour smoothstep from neutral to the shard's edge colour; height
   y = B(s) · smoothstep((w − 4) / 16), with **B(s) = clamp(H(s), −1.5, 6)** (≤ 29° at B = 6: walkable).
3. **H > 6:** a retaining element at w = 20 from y = 6 up to H, collider on (it stops the board):
   - 6 < H ≤ 14: a neutral stone retaining wall (platform kit), height H − 6 (continuous with B, so no along-edge jump);
   - H > 14 for ≥ 30 m of edge: the shard's own cliff kit (declared in its edge profile: Nalati granite, Pine Hollow
     rock), 75–85° batter, talus apron in the last 4 m of the gradient, guard rail at the road edge.
4. **H < −1.5 or water above 0:** dike (crest +1.3 at w = 20, the shard's water clipped at the cell, a revetment down to
   H inside) where there is water; parapet + guard rail where it is a drop (gorge, cloud); culvert where a river leaves.
5. **Corners:** the crossroads blend B (not H) of the two edges; walls and cliffs return 10 m round the corner and stop.
6. Seam check stays ≤ 2 cm at w = 20 (B = H wherever |H| ≤ 6; the wall or cliff carries the rest); ≥ 9 vertices across
   the gradient (every 2 m), the collider the same mesh.

## Questions for Jake

1. The rule above (ramp < 6 m, neutral wall 6–14 m, the shard's own cliff > 14 m), or one look everywhere?
2. Driftwood: a dike with its sea clipped at the cell (recommended), or lower Driftwood's sea below the road?
3. Sky Reach: a cliff edge over the cloud sea with a viaduct at each midpoint (recommended), or a landing isle at road
   level with an updraft?
