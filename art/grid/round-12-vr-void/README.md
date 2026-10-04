# round-12-vr-void: Which VR void lies across the outer road, and how does its wall read?

Ask E438 (SHARD-PLATFORM mockups), after Jake's G77: *"we want the infinite grid like a VR space so you see the void and
there's a road of course, what you see across the road is the infinite VR void that's cheap to render and you can't go
there it's a collision wall."* Every frame also follows G72 (one landmass), G73 (asphalt roads, the country road of
`round-10-asphalt/A-country-road.jpg`) and G68 / G78 (the road is a safe zone: bare hands, ATTACK dimmed with a
"SAFE ZONE" chip).

Made with codex `image_gen` (gpt-image), editing `art/grid/round-10-asphalt/A-country-road.jpg` (road and HUD),
`art/grid/round-7-safe-zone/B-shimmer-hud-dim.jpg` (safe-zone HUD), the real Nalati capture
`progress/nalati-grasslands/20261002-0011-0d59505c/first-frame.jpg` and, for the aerials,
`art/grid/round-1-overview/B-one-landmass.jpg`. These are mockups for art direction, not renders: they are more painterly and
detailed than the game renders today.

## Board: `board.jpg`

First person on foot on the outer ring road on the east edge of the world, looking north. Nalati is on the left past its
scrub strip; the void is on the right, past the gravel shoulder.

| Variant | File | The void | The wall |
|---|---|---|---|
| A | `A-tron-grid-rail.jpg` | Glossy black floor with glowing cyan grid squares to a razor horizon. The sky darkens to navy over the void. | A thin glowing cyan rail at waist height along the shoulder. |
| B | `B-white-holodeck.jpg` | A matte white studio floor with a faint grey grid, melting into white haze with no horizon line. | Nothing: the gravel stops in a clean edge and the wall is invisible. |
| C | `C-mirror-hex-shimmer.jpg` | A still black-glass mirror floor under a deep-blue gradient sky, reflecting the road edge and posts. | Invisible; a patch of cyan hex cells ripples where the hand touches it. |
| D | `D-wireframe-unbuilt.jpg` | Rolling low-poly hills drawn only as a pale cyan wireframe, with a wireframe yurt: the world "not built yet". | A faint vertical cyan grid curtain that shows only near the player. |

## Aerials

- `board-overview.jpg`: the whole 3 × 3 landmass from high above in variant A. The asphalt roads between the cells, one
  asphalt outer ring road with rounded corners and a cyan rail around it, and the black and cyan grid on every side. No sea,
  no coast.
- `board-overview-B.jpg`: the same view in variant B (a white studio grid on every side, no visible wall).

**Re-rolls:** B was re-rolled once because a hoverboard deck appeared at the bottom of the frame, though the player is on
foot. D was re-rolled once because its HUD drifted: a skateboard icon on HOVER, a hexagon coin icon, the backpack tab
detached, the LOOK label moved and the hands came out smooth. The wireframe was also too faint. The first takes are not
kept.

**Recommended: A.** It reads at a glance as "the simulation ends here". The grid's lines carry the eye to an infinite
horizon, so the world feels big rather than boxed in. The cyan rail shows the wall in the HUD's own colour, with no toast
and no surprise bump. It is the cheapest of the four to render: one unlit plane with a grid shader plus one emissive line.
It also matches the HUD's cyan-on-navy look.

The risks of the others:
- B is a strong second, but a white void glares next to sunlit shards, and with no visible wall the first bump is a
  surprise.
- C's mirror reads as sea or water from most angles, which is the old outer edge again.
- D promises land the player can never reach.

If Jake wants a hybrid, A's rail can take C's hex shimmer when touched.
