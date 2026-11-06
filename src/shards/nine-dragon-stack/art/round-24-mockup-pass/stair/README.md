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

## Pass 6 (on HEAD 2a5428f5)

| Change | Where | Kept? |
|---|---|---|
| The brass dragon a deep gold-bronze (its viewmodel colours × 0.78 / 0.54 / 0.22): under the high-key grade the warm gold of pass 1 read as cream | C1 | kept |
| Mockup C's green terrace lips at the foot: planter troughs along the foot terraces' copings and a big potted shrub at each lip (instances) | C1 | kept |
| Timber tea-house balconies over the foot's north veranda too (the helper moved to stairstreet.ts, shared with C2; the south fronts are too low for one) | C1 | kept |

Memory against the same HEAD: 154.449 → 154.450 MB geometry (all instances), textures unchanged. Worst pose at these
domes and mockup C: mockup C 106 draws / 0.89 M triangles, C1·4 1.40 M triangles. No collider changes; the walk test is
unchanged since pass 1 (19 legs, 0 stuck, 0 out).

Still open for the other lanes: the square's lantern string along the east shops crosses the stair's mouth three metres
in front of mockup C's camera (two big lanterns on a wire across the frame's upper third; plan F6 asks for the frame
over the stair to stay open); the Fei Zhua dragon-hook casting (build.ts places it at the three Well mounts nearest the
Well) would read far better than the jian's guard head on the stair's hero bracket.

## Round 2 (passes 7–9): the coordinator's brief

Round 1 is live (`d6ca7e6-mumavuoz`). The coordinator tried the Fei Zhua casting on the stair's bracket and reverted it
by eye: the gold guard head reads closer to mockup C. Round 2: judge all nine C1 / C2 views against the targets and close
the biggest gaps. The targets' stair walls are stacked tea houses with deep balconies, plants spilling over, hanging
signs and awnings at every level and people on the balconies; the upper stair and landing are busier. Memory-neutral
against pass 6.

## Pass 7 (on HEAD 69722f30)

| Change | Where | Kept? |
|---|---|---|
| The stair paifang in cinnabar and gold with bare lacquer posts (gate.ts's `paint: 'cinnabar'`, the square's): mockup C, C2·5 and C2·2 paint it red; the mineral blue-greens read as a teal band up the stair | C2 | kept |
| Stacked tea houses up the set-back towers over the pent roofs, 2–3 storeys a segment (2 at the foot): deep timber balconies, a lit door, planters on the rail with greenery spilling over, a potted plant, a glazed eave or a striped awning, a lantern, now and then a hanging sign and somebody at the rail. They replace pass 2's lantern arms there. All instances but the signs (`tower-stacks-close.jpg`) | C1 + C2 | kept |
| 22 more climbers on flights 2 and 3, landing 2 and the top of flight 1 (C2·7 looks down it at a crowd coming up); the extra figures now join ranked, the nearest in the dark coats and umbrellas | C2 | kept |
| The same climbers on landing 1 too | C2 | reverted: a figure 2 m off filled C2·4's and C2·6's foregrounds |
| The pent roofs' and verandas' tiles a deeper glazed teal (× 0.62): the aerials' roofs in the targets are dark tile | C2 | kept |

Memory against the same HEAD: geometry 154.58 → 154.54 MB (the lantern arms' beams went; everything new is instances),
textures unchanged. No collider changes.

## Pass 8 (on HEAD e357e28a)

| Change | Where | Kept? |
|---|---|---|
| A footbridge over the top of flight 1 at +31 m (x 31.2) with people at its rail and 茶 / 九龍 banners: overhead in C1·1's look up, across the top of C1·9's top-down and C2·2's aerial, as the targets stack their bridges. It stays above mockup C's frame (66° up from its camera; the frame ends at 49°) | C2 | kept |
| Landing 1's terrace segments always take the red timber balustrade (the rng is drawn as before): C2·4 / C2·6's targets | C2 | kept |
| Pots on the terraces past x 47 (10 m and more from every stair camera) are the facade's instanced plant instead of ~350 vertices of leaves each; their leafy build goes into a throwaway kit so the rng stays in step. No visible change at the domes or mockup C | C2 | kept: −2.96 MB |
| The landings' and the top landing's slabs darker (0x3c3e44) | C2 | kept, but no visible change: the pale pink of the landings in C2·4 / C2·6 / C2·8 is the wet-ground reflection of the bright sky (render lane), not the wash |

Memory against the same HEAD: geometry 153.85 → 150.89 MB, textures unchanged. The lane is now 2.9 MB under its pass-6
numbers. No collider changes.

## Pass 9 (on HEAD 51bfc032)

| Change | Where | Kept? |
|---|---|---|
| A red 火鍋 over a jade 旅館 on an iron mast 1.2 m off the south frontage at landing 1, facing the landing, left of the shop: C2·6's target composition (`c2-6-before-after-target.jpg`). Pass 3's flat 冰室 / 宾馆 go: the frontage's balconies hid them | C2 | kept (first hung at +12 m with 0.95 m characters: only the foot of 旅館 was in C2·6's frame; lowered to +7.2 m, 0.72 m) |
| No coping planters on landing 1's segments: 3 m from dome C2's camera the instanced planter blobs read as green crystals; the potted plants behind the rail read better alone | C2 | kept |

Memory against the same HEAD: geometry 151.39 → 151.40 MB, textures unchanged. No collider changes.

### Where round 2 leaves the lane

Worst pose at C1, C2 and mockup C: mockup C 108 draws / 1.03 M triangles; C1·4 1.44 M triangles (under the 180 / 2.3 M
gate). Geometry is 2.9 MB under pass 6 on the same HEADs (the far pots), textures unchanged, colliders unchanged since
pass 1 (walk test 19 legs, 0 stuck, 0 out).

Gaps left, and whose they are:
- The landings read pale pink (C2·4, C2·6, C2·8, the square's foot in C1·5) where the targets' landings are dark wet
  stone carrying the neon: a darker slab changed nothing, so it is the wet-ground reflection of the bright sky (render).
- C2·1 / C1·1 look up at a blue sky between the towers; the targets fill it with far pagoda towers and more bridges
  (the sky / far city: render + fabric).
- C2·4's target stands in a crowded tea house veranda with a big 麵 sign above it; from landing 1 the veranda's roof caps
  the frame at 4 m, so a sign above it cannot be seen there (the plan's geometry).
- The square's foot (C1·8, the bottom of C1·5) is flagstones, where the target puts steps down to the frame's foot: the
  stair starts 4 m from the camera (the plan).
