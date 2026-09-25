# Hibiscus bush — round 1: three directions (E116, 2026-09-24)

The user, on Explore ▸ Models ▸ Hibiscus bush: "super low poly and just looks like dog shit … it just needs to be done
again." Three new bushes are built in the game (`src/world/bushKit.ts`, wired into `src/world/Bushes.ts`). Each one is
switched on with a URL flag, and without a flag the game keeps the current bush. Nothing has been swapped yet: the user
picks.

| file | what it shows |
|---|---|
| `board.jpg` | **The pick.** NOW / A / B / C at phone tier (390×844). Top of each cell: the Explore ▸ Models turntable (`?explore=model&model=bush&touch&tier=phone&mute=1&bush=…`). Bottom: the same bush on the east beach (113, −36) in Explore ▸ World, with the same camera for every look (`cam=109.93,4.48,-38.73,-2.201,-0.315`). Live captures, not mockups. |
| `mockups.jpg` | The three direction mockups made first with local Qwen-Image-2.1 turbo from the live turntable capture (masked edit, one seed each, seed 7). They show where each direction is headed. They are not the game, and they are research-licence images, so they never ship. |

| look | URL | what it is | tris a bush (phone) | island (phone, 170 bushes) |
|---|---|---|---|---|
| NOW | — | 2–5 jittered icosahedron lobes, tiny red icosahedron "flowers" | 93 (120 for the flowering specimen) | 15.9 k built / 10.3 k drawn |
| **A** leaf clump | `?bush=a` | a dark welded core wrapped in 50 broad folded leaves (6 tris each) fanning up and out, the palms' frond language at bush scale. Flat-shaded on the shared `lowPolyMaterial`, so it adds no new shader program. Dark inside, sunlit tips. | 352 (464) | 59.8 k / 37.9 k |
| **B** sculpted canopy | `?bush=b` | Sea of Thieves / BotW: 6–8 lobes welded by a smooth union into one closed cloud of a bush. Smooth normals, leaned toward the centre so it lights as one ball. Painted dark blue-green underneath and warm yellow-green on the crown, with shade in the creases, a hem of leaf scales off the rim and a few leaves out of the crown. Its own program (`bush-smooth`). | 427 (578) | 72.6 k / 46.1 k |
| **C** leaf cards | `?bush=c` | 32 alpha-cut cards painted with cel-shaded hibiscus-leaf sprays (a canvas atlas drawn at build time), shading with the bush's ellipsoid normal, over a dark core. Its own program (`bush-cards`, alpha test). | 229 (348) | 38.9 k / 25.0 k |

"Drawn" is lower than "built" because the Blender spawn cove replaces the bushes inside its area. Every look is **1 draw
call** for all the bushes on the island, the same as now. The Explore readout at this camera shows 120 / 120 / 121 / 120
calls. A flowering bush (28 % of the scatter) wears 4–7 five-petal hibiscus: rounded cupped petals, a dark throat and a
yellow stamen, mostly red, or deep red / pink / coral per bush. It also carries 2–3 closed buds. The wind sway (M5) is kept
on every look. Desktop tier uses more: A 90 leaves, B 40 edge leaves, C 48 cards.

Rocks are being explored in parallel (E114, `src/world/rockKit.ts`: A chiselled / B smooth painted / C slabs). Bush B
pairs with rock B (smooth painted), and bush A pairs with rock A (faceted).
