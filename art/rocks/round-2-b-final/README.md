# Rocks, round 2: B built to its mockup (E114, 2026-09-25)

The user picked **B · smooth painted** ("Rocks: which direction should get the full build?" → "B · smooth painted").
Round 1's in-game B (`../round-1-directions/photo-b.jpg`) was pale, blobby and low in contrast next to its mockup
(`../round-1-directions/mockup-B.jpg`). This round rebuilds it in `src/world/rockKit.ts` and makes it the default.
`?rocks=now` (or `v1`) brings back the old jittered icosahedra; `?rocks=a|c` still show the other candidates.

**Board: `board.jpg`**. The top row is before (`?rocks=now`), the bottom row is after (B, the new default). Each
column uses one camera. Captures are iPhone 390×844 @3× (1170×2532), `touch&tier=phone&mute=1`, on Metal, with the UI
hidden by an injected `.ws-x, #hud, .ws-fb-disc { display:none !important }`.

| file | camera |
|---|---|
| `{before,after}-reef.jpg` | the wreck reef, the round-1 photo camera: `?explore=world&cam=146,4.0,-12.5,-1.87,-0.3` |
| `{before,after}-shore.jpg` | shore boulders on the east beach: `?explore=world&cam=144,5,-90,-1.01,-0.25` |
| `{before,after}-spawn.jpg` | the rocks off the spawn beach, beside the pier: `?explore=world&cam=10,4,-224,-2.36,-0.3` |
| `{before,after}-tidepools.jpg` | the cove's tidepool rims (Cove.ts loose rocks): `?explore=world&cam=140,7,5,1.57,-0.45` |
| `{before,after}-boulder.jpg` | Explore → Models → Boulder (`?explore=model&model=boulder`), zoomed in 3 wheel steps, the turntable held still |
| `mockup-vs-after-reef.jpg` | the mockup's rock box (left) next to the same box of `after-reef.jpg` (right) |

The big faceted grey rocks behind the spawn shot belong to the Blender island (`island-props`). They are not part of
the switch. The user: "Only the boulders for now", so the crags, cliffs and Blender rocks stay as they are.

## What B is now

- **Shape.** A rock is 1 to 3 pieces: a main body, 0 to 2 lower ledge blocks fused to its side, and on some big
  rocks a smaller stone on the crown. Each piece is a *soft polytope*: about 16 planes around an ellipsoid (a flat-ish,
  sometimes tilted top, bevels, sides that lean back into a mound), blended with a soft-min, plus a little fbm.
  So it has broad faces and rounded edges. The first pass was a noisy blob. Archetypes (dome / table / wedge / block)
  vary the silhouettes across a cluster. Cracks run down the walls, never across the crown.
- **Paint** (per vertex, on the final shape). The foot → crown ramp now starts at the ground line; the first pass
  spread it over the buried half, so every visible vertex was the pale crown. On top of the ramp: a painted top light,
  warm and cool drifts, mottling, light on the worn convex edges, a wet foot, dark creases and cracks, and AO rays
  against the rock's own pieces and the ground. The moss cap sits on the up-facing surfaces, with broad noisy tongues
  and a darker rim.
- **Shading.** Smooth normals, leaned 30 % toward each triangle's own normal so the mockup's painted planes read.
  Roughness 0.82.
- **Palette.** Neutral slate greys: the reef is darker than the shore granite. The moss is olive, not lime. The
  first pass's blue-grey and pale crown are gone. Both hold up in world light and on the Explore turntable.

## Budget

| | NOW | B, round 1 | B, final |
|---|---|---|---|
| shore boulders (109) | ~31 tris / rock | ~318 | **549** (59,880 total) |
| wreck reef rocks (17) | ~80 | ~279 | **453** (7,700 total) |
| cove loose rocks | — | — | 8,680 total |
| ground-cover pebble clump (3 pebbles, instanced) | 60 | 540 | **120** |
| draws | — | +1 wreck, +1 cove | same: +1 wreck, +1 cove (the shore boulders were already one mesh) |

About 76k triangles of smooth rock on the whole island, in 3 draws. The shore scatter builds in about 90 ms on the
M5 (warm), with the icosphere topology cached and the palette parsed once.
