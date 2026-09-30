# Loot props, round 2: the small models (E314, 2026-09-30)

The models [DRIFTWOOD-LOOT](../../../project/archive/2026-09-30-driftwood-loot.md) "Jake's picks, 2026-09-30" needs: the sea glass chime
(board 3 C), the trophy plaques (board 4 A), the captain's hat worn (board 4 C) and the sailcloth cape (the shop's look-only
good). All four are **code** models on Driftwood's toon kit (`LowPolyKit`: flat-shaded vertex colour, the island's one
shared material), one draw each, listed in the Model Explorer (Driftwood's roster) and not yet placed or worn.

| File | What it shows |
|---|---|
| `board.jpg` | The review board: every model in the real Model Explorer at iPhone 16 Pro portrait (402×874 @3×, phone tier, a clean HEAD build) — the chime at 0 / 5 / 10 / 15 pieces, the plaques empty / bear / boar / both, the hat and the cape at four turns, and the Bag icons (whetstone, heart, sea chart, cape, hat, bear claw, boar tusk, necklace, sea glass) |

First review pass (from the first captures): the chime's chips were specks next to the bar and random colours gave the
centre strand two ambers (bigger chips, a fixed colour order); the claw was lost on the dark plaque (bigger, a longer
pale tip); the hat's tall crown read as a top hat (lower crown, higher-cocked brim).

## Detail lists (what each part carries)

**Sea glass wind chime** (`src/chunks/driftwood-isle/models/seaGlassChime.ts`) — origin at the hook, hangs ~0.95 m, 0.7 m wide.
1. A V of cord from the hook to the bar's ends — `rope`, cord tan.
2. A bleached driftwood bar in two bent lengths with a snapped twig — `log` ×3, wobbled.
3. Three strands tied under the bar (a torus knot each) — fill order centre, left, right: 5 pieces a strand.
4. Sea glass chips: flat faceted pebbles, aqua / seafoam / bottle green / frosted white, rare cobalt and amber — `rock` squashed and turned to face ±z.
5. The bottom chip of each strand is big: every milestone (5 / 10 / 15) ends on a piece you notice.
6. Sway: each strand its own wind phase, still at the bar, most at the bottom (vertex shader, `swayDepthMaterial` shadow).
Numbers: 578 triangles (all 15 in the geometry), 1 draw, 1 copy (the hut's doorway), no colliders.

**Trophy plaques** (`src/chunks/driftwood-isle/models/trophyPlaques.ts`) — wall at z = 0, bottoms at y = 0, 0.8 m apart.
1. Shield-shaped boards with a crested top, dark walnut, bevelled — `ExtrudeGeometry`.
2. A lighter inset panel, two nail heads, a bare peg.
3. Empty bear plaque: a paw print burnt into the panel (pad + four toes). Empty boar plaque: a cloven hoof print with dew claws.
4. Bear claw: a hooked claw swept on parallel-transport frames, dark root → near-black → pale tip, a fur tuft and a leather wrap at the root.
5. Boar tusk: an ivory crescent, yellowed root → white tip, bound twice with leather.
Numbers: 1,224 triangles, 1 draw, 1 copy (the hut's back wall), no colliders.

**Captain's hat** (`src/chunks/driftwood-isle/models/captainHat.ts`) — origin at the head band, 0.48 m across the points.
1. A tricorne brim: one sheet cocked up steeply between three points (front, back-left, back-right), nearly flat at them.
2. A gold braid round the brim's edge.
3. A low ten-sided crown (mostly hidden by the upturns), a domed cap, a dark band.
4. A faded red cockade with a brass button on the front-left upturn.
5. A strand of kelp hanging off the back-right point (the wreck), swaying.
Numbers: 448 triangles, 1 draw; worn (shadow only) and a world pickup later; no colliders.

**Sailcloth cape** (`src/chunks/driftwood-isle/models/sailclothCape.ts`) — the wearer's axis at x = z = 0, hem at y = 0, neck at 1.0 m.
1. Canvas panels in two tones with a darker seam, a stitched patch.
2. A faded red stripe above a ragged hem.
3. Wraps the shoulders, falls flatter and wider to the knees, pleats deepening down.
4. A rope tie across the throat, knotted, two short ends.
Numbers: 176 triangles, 1 draw, swaying from the shoulders (most at the hem); no colliders.

**Wearing** (`src/player/Cosmetics.ts`): the player has no body mesh, so `Wardrobe` hangs the worn hat and cape on sockets
over the player's feet (hat 1.74 m, cape hem 0.46 m) and draws them to the shadow map only: they show in the player's
shadow, never in the first-person view. Taking a thing off restores its own materials (test/cosmetics.test.ts).
