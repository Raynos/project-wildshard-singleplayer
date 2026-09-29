# Round 24 · stair-street lane (E281): domes C1 + C2, mockup C

The stair agent's passes of the E281 mockup pass. Files: `src/chunks/nine-dragon-stack/world/stairstreet.ts` (C1: the
plan, the colliders, the foot) and `stairstreet-upper.ts` (C2: landing 1 upward). Each pass is a clean export of HEAD
plus only these two files, built and served with `vite preview`, shot with
`node scripts/nine-dragon-domes.mjs --domes=C1,C2 --mockups=C`. Targets: `../../round-15-eight-domes/{C1-stair-stand,C2-stair-look}/`
and `../../round-6-baseline-hud/comp-C-stair-street.jpg`.

Per pass: `C1-stair-stand-sheet.jpg` and `C2-stair-look-sheet.jpg` (target | engine, nine views), `mockups-sheet.jpg`
(mockup C over the engine's phone frame), `eyecheck-*.jpg` (previous | this | target at C1·5, C2·5, C2·1 and mockup C)
and `stats.json` (draws / triangles per pose, the fragment's geometry and texture memory).

The cyan slab and black band across the lower half of every mockup-camera frame are the viewmodel (not this lane): they
are in pass 0 too.

## Pass 1 (on HEAD c3b14631)

Plan row F6: open depth over the stair, the paifang big and centred, the skybridges at the mockup's depths.

| Change | Where | Kept? |
|---|---|---|
| The lantern string across the foot (x 28.5) removed; it capped mockup C | C1 | kept |
| The lantern string over flight 2 (x 43.5) removed; it capped C2·5. The one past the paifang stays | C2 | kept |
| Cable and laundry spans only past the paifang, every other one, 3 m higher (the rng still draws every span, so the signs and crowd keep their rolls) | C2 | kept |
| 麵 sign 1.95 → 1.25, hung 0.2 m off the wall, 0.75 m higher: mockup C's upper-left corner, not the middle of the frame | C1 | kept |
| The brass dragon raised 2.5 m to sit right of and below the sign (mockup C: a quarter down the frame); a warm gold instead of brown | C1 | kept |
| The stair paifang widened: posts ±3.1 / ±5.6 (was ±1.75 / ±4.6), scale 1.3 (was 1.5). A 6.2 m centre bay instead of a 3.5 m slot; the collider boxes follow | C1 plan | kept |
| The skybridge with its banners raised to +170 (it sat on the paifang's roof from the square); from landing 1 it now stands clear above the roof, as in C2·5's target | C2 | kept |
| The monorail moved nearer and higher (x 50, train +160…163): the top crossing of mockup C, overhead in C2·1. The 150 m girder cut to the canyon's 40 m. The train rebuilt for the view from below: a dark belly, a tall lit window band, a cinnabar stripe, bogies | C2 | kept (the first cut, a pale grey belly, read as a slab: redone before commit) |
| Two far crossings past the top landing (x 86, x 108), seen through the paifang's centre bay | C2 | kept |
| The mahjong tables on the tea verandas (≈1 900 vertices of tiles each, unseen from the stair) → tea tables (≈250); the eave tile ends flat squares instead of icospheres | C1 + C2 | kept |
| C1's six kits (steps, foot, signs, over, dragon, alpha lattices) → ONE `stair-foot` kit: the alpha cards became real bars, the dragon's KitX folded in | C1 | kept |

Numbers (C1·5 / C2·5 / mockup C draws): 94 / 82 / 149 → 90 / 81 / 144. Fragment geometry 168.7 → 165.1 MB, textures
79.6 → 79.6 MB. Walk test (19 legs): 0 stuck, 0 out.

Left for later passes: the far end is still a wall through the paifang (the targets see a deep, layered city); the sky
screen over the stair (build.ts `screen2`, +173.45) still caps everything above the paifang from the square.

## Pass 2 (on HEAD 8279eb35)

The render agent's pass 2, the fabric agent's pass 1 and the capture tool's viewmodel fix landed between pass 1 and
pass 2, so the eye-check's pass-1 column is an older world; judge this lane's changes by the rows below.

| Change | Where | Kept? |
|---|---|---|
| A gatehouse (城樓) across the top street at x 86, past the walkable end: an ashlar base with an arched passage, a lit timber hall under a double green-glazed hip roof, lanterns along both eaves, a 九龍城 plaque. The paifang's centre bay now frames a lit hall with lanterns (C2·5, mockup C), and C2·2's aerial ends on it, as the targets do | C2 | kept |
| The two far crossings from pass 1 removed: a far tower of the city fabric (towers.ts `crown()`, base +155, face at x 91.5) spans the canyon and hid the one at x 108; the gatehouse replaces the one at x 86 | C2 | kept |
| Red lanterns on iron arms off the set-back towers over the pent roofs, one or two a segment (the targets' columns of lanterns up both sides) | C2 | kept |
| Nine more climbers on flights 2 and 3 (the targets' stair is busy), off the axis near the eye and clear of the paifang's posts | C2 | kept |

Memory against the same HEAD without this pass: geometry 159.09 → 158.91 MB (the gatehouse and lanterns cost less than
the two crossings they replace), textures unchanged. No collider changes (the gatehouse stands past the end wall).

For the other lanes (the view up the stair is still capped): the far tower at x 91.5 closes the canyon past the
gatehouse (towers.ts `crown()`), and the stair's sky screen (build.ts `screen2`, +173.45, under the second deck in
towers.ts) is the flat teal ceiling over everything above the paifang from the square.

## Pass 3 (on HEAD 1cca856d)

| Change | Where | Kept? |
|---|---|---|
| Flight 1's climbers keep to the sides (the axis within 1.7 m of the centre stays clear): a knot of figures in the middle of the flight hid the paifang's base from the square; mockup C's few climbers walk the edges | C1 | kept |
| The monorail's hangers only at the towers: the pair in the middle of the canyon read as two sticks across mockup C's sky | C2 | kept |
| Three red lanterns on a chain under the 麵 sign (mockup C's lanterns down the tea house's face) | C1 | kept |
| Landing 1's own neon, flat on the south fronts facing the stair: 冰室 on the shop front, 宾馆 on the tower above (C2·6 looked at a bare wall; its target has two big signs there) | C2 | kept |
| A 粥麵 board over the north veranda (for C2·4) | C2 | reverted: from the landing the veranda's eave and the pent roof hide the whole front above it |

Memory against the same HEAD: 157.36 → 157.36 MB geometry, textures unchanged. No collider changes.

`experiment-no-stair-screen.jpg` (not committed code, for the coordinator and the render agent): pass 3 | the same build
with the stair's sky screen left out (build.ts `screen2`) and the one crown tower that stands in the canyon moved aside
(towers.ts `crown()`) | the target, at C1·5, C2·5 and mockup C. Without the screen the band above the paifang is blue-hour
sky instead of the flat teal grid, which is how the targets and mockup C paint it; the second deck over the stair has
no underside, so nothing else shows. The targets also put far towers and pagodas in that sky, which the experiment does
not have.

## Passes 4–6: the coordinator's brief

The coordinator took the experiment (the stair's sky screen is gone, `be97ea90`) and set passes 4–6 on three things the
C targets show and the engine lacks: warm-lit timber shopfronts, verandas, plants, hanging signs and people up the flanks;
treads that read as single wet granite steps with bright edges, not a dark ramp; umbrellas in the climbing crowd. The
new pieces are instances of shared pieces, and memory stays neutral against pass 3. From here each pass's eye-check puts
the previous pass and this one on the same HEAD (a HEAD-only build beside HEAD plus this lane's two files), since the
other lanes keep landing.

## Pass 4 (on HEAD 80c4259e)

| Change | Where | Kept? |
|---|---|---|
| Shops let into the terraces' retaining walls on the stair's edges, one per flight segment (and two at the foot): the facade's interior-mapped window lit warm, red jamb posts, a timber lintel, a glazed eave (tea rooms) or a striped awning, a lattice counter, red couplets, a hanging sign reading down the stair (≥ 2.1 m over the steps), a lantern, a warm light pool, now and then a customer at the counter. The ashlar is cut round each window (the rng stays in step), so the walls are lighter | C1 + C2 | kept |
| Planter troughs along the terraces' copings in front of the rails, greenery over the stair's lip (the facade's planter, instanced) | C2 | kept |
| The climbers sorted into the crowd's variants by prominence: the nearest to the square and landing 1 take the dark coats and dark umbrellas (one in ten red), the rest the beige ones. world/build.ts sorts `ctx.walkers` by index; the count is unchanged | C1 + C2 | kept |
| The steps: darker risers in their own shadow, the treads a shade lighter, a brighter nosing on every step, its bevel 0.06 → 0.085 m | C1 + C2 | kept |
| Light granite risers (0x8b8a85) | C1 + C2 | reverted: under the render lane's high-key grade the flights read as a pale ramp, further from the targets than before |
| A customer at the landing-1 shop | C2 | reverted: it stood in C2·4's foreground on the dome's camera spot |

Memory against the same HEAD: geometry 156.05 → 155.96 MB (the windows, posts, eaves, planters and rails are instances;
the ashlar cut for the windows pays for the sills, signs and brackets), textures unchanged. No collider changes. The
customers change the number of walkers, so the Well's figures after this lane's take other coat and umbrella variants
(a random re-colouring, nothing moves; pass 5 puts that right).

## Pass 5 (on HEAD 73cabfa4)

| Change | Where | Kept? |
|---|---|---|
| A second, shorter counter window further up each flight segment where the wall still has the height: twice the warm shopfronts up the flanks at eye level | C2 | kept |
| Timber tea-house balconies on the frontages over the verandas and shops, one a storey (two on the 9 m fronts): the facade's timber balcony, a lit door behind it, a potted plant, a lantern, sometimes somebody at the rail. They show from the landing and the aerials; from the square they are edge-on | C2 | kept |
| The coping planters a size larger | C2 | kept |
| The nosings glow faintly (emission 0.3, a whiter wash) and the step slabs vary more in tone: every step's edge reads from the square and the landing, as in the targets | C1 + C2 | kept (0.14 first: too faint to see) |
| The customer at landing 1's shop stood in C2·4's foreground (pass 4's rule kept it 3 m off the camera; that was not enough): no customers on landing 1 at all | C1 helper | kept |
| The figures added since pass 3 (customers, people on balconies) join the crowd at the end of the stair's build, cut to a multiple of ten, so the Well's figures keep their coat and umbrella variants (the square lane's rule) | C1 + C2 | kept |

Memory against the same HEAD: geometry 154.43 → 154.44 MB (the second windows' sills, signs and brackets less the ashlar
they cut; the balconies and planters are instances), textures unchanged; since pass 3 this lane is net −0.08 MB. No
collider changes.
