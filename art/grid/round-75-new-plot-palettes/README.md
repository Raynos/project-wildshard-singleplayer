# Round 75: new open plot palettes (G978)

The four new open plots (G974, G977) in the round-62 format: one 2 × 2 board each (1 ABOVE NEIGHBOUR, 2 ROAD ENTRY,
3 TOP-DOWN, 4 PLAZA), blocky, mirror-symmetric and tile-built around one landmark, each with its own palette.
`00-board.jpg` shows the four road entries with the cell each takes. Plan:
`docs/plans/open-plots/new-unique-plots-mini-plan.md` §3 and §5; build bar: `docs/plans/open-plots/build-out-mini-plan.md`.

| File | Palette line | Round-62 sheet it edits |
|---|---|---|
| `02-jungle-ziggurat.jpg` | rain-washed teal afternoon, cinnabar-red temple, jade pools, saffron bands | `11-clockwork-canyon.jpg`, then a fix edit |
| `03-patchwork-fairground.jpg` | buttermilk morning, toy primaries on a clover, mustard and lavender quilt | `13-alien-plain.jpg` |
| `04-saltwind-lighthouse.jpg` | pewter squall, slate-green sea, whitewash and black tar, one red-banded light | `11-clockwork-canyon.jpg` |
| `06-fossil-badlands.jpg` | lavender blue hour, oxblood and mustard strata, bone-white skeleton | `17-ember-forge.jpg`, then a fix edit |

## Method

codex `image_gen` (gpt-6.1-sol via `codex exec -i <ref> -o <last.txt> "<prompt>"`), 1024 × 1536. The reference is the
panel area (below the title bar) of a round-62 sheet, its four yellow labels painted out, so the cameras, road, kerbs
and blocky tile look match the other plots. The title bar, the palette line and the panel labels were burned in with
ImageMagick afterwards (880 × 1400, as round 62). No billboards: OP24 retires them, and they put text in the frame.
Every image was read; re-rolls are listed below.

## Common prompt (first takes)

> The attached image is a 2x2 mockup sheet of one open plot in Wildshard, a stylised 3D game played as an iPhone
> portrait web app. Its four panels are fixed camera views of one square 500 m open plot beside a grey asphalt ring
> road with cyan-lit kerb lines: top-left ABOVE NEIGHBOUR (about 100 m up across the road, looking at the whole plot),
> top-right ROAD ENTRY (eye level on the road, looking up the entry path at the landmark), bottom-left TOP-DOWN
> (straight down over the whole square plot, the road along the bottom), bottom-right PLAZA (standing under the plaza
> gate's beam, looking at the landmark).
>
> Make a NEW 2x2 sheet of a DIFFERENT open plot, described below. Keep exactly: the 2x2 layout, the four camera
> positions and framings, the thin dark gutters between panels, the grey road with white lane dashes and the plank
> entry path at the bottom of panels 1 to 3, the cyan glowing kerb lines, and the rendering style (clean stylised 3D
> game render, chunky low-poly shapes, soft bloom; not concept art, not a painting, not photoreal). Replace everything
> else: buildings, landmark, palette, sky and light. Remove every billboard and sign.
>
> How open plots are built (follow this strictly): the plot is assembled from a small kit of modular square tiles on
> an 8 x 8 grid, like building blocks. It is BLOCKY and SYMMETRIC: mirror-symmetric left-right and front-back, a cross
> of straight paved avenues dividing four identical quadrants, identical repeated modules (the same house, the same
> tree, the same lamp post repeated in straight rows), square raised terraces, right-angled water channels and walls,
> and a square plinth at the exact centre carrying the ONE big signature landmark. In the TOP-DOWN panel the 8 x 8 tile
> grid and the four-fold symmetry must be obvious. Chunky, clean, readable geometry; no organic sprawl, no clutter that
> breaks the grid.
>
> Never include: any text, letters, numbers, labels, billboards, signs, posters, logos, holograms, UI, watermark,
> people, animals, floating lanterns. Panel labels are added afterwards, so leave the top-left corner of each panel as
> plain scenery.
>
> Output: exactly ONE portrait image, 1024 x 1536, the whole 2x2 sheet.

Then the plot block, then: *TASK FOR CODEX: Use the built-in image_gen tool to EDIT the attached reference sheet into
exactly ONE portrait 1024x1536 image as described above. One generation only. Then copy the PNG that YOUR image_gen
call produced … to `<out>.png`. Create or modify no other file.*

## Plot blocks

### Jungle Ziggurat (`02-jungle-ziggurat`)

> THE PLOT: JUNGLE ZIGGURAT, a living, freshly painted temple town in the rainforest just after a tropical rain. A rain-washed bright afternoon: a deep teal sky clearing behind towering white cumulus, a faint rainbow, wet glossy stone. Palette: deep jade and dark emerald canopy; the temple and walls painted cinnabar red with turquoise and saffron-yellow bands over cream limestone steps; jade-green pools; white waterfalls. Intact, clean, bold-painted, lived in. NOT a ruin: no moss-covered grey stone, no ivy, no glowing green, no grey misty morning (those belong to another plot).
> Signature landmark: a tall stepped pyramid on the central square plinth, cinnabar-red tiers with turquoise and saffron bands, a broad cream stair up the front, a jade-roofed shrine on top with red banners.
> Tiles: a square jade reflecting pool in each of the four quadrants, fed by small stepped waterfalls from square raised terraces; stone causeways with rope rails crossing the pools along the avenues; rows of identical thatched stilt houses on square platforms; identical round-canopy jungle trees and big-leaf plants in straight rows; identical painted stone steles in rows along the avenues (patterns only, no writing); square flower terraces at the four corners; identical stone lamp posts.

### Patchwork Fairground (`03-patchwork-fairground`)

> THE PLOT: PATCHWORK FAIRGROUND, a toy-box travelling fair pitched on a quilt of square meadow fields. A bright fresh morning under a warm buttermilk-yellow hazy sky with soft cream clouds, crisp short shadows, everything daylit (this is NOT night: no glow, no neon, no purple). Palette: toy primaries, tomato red, sunflower yellow and royal blue with clean white trim, set on a quilt of square clover-green, mustard-gold and lavender field tiles stitched together by low box hedges, with pale gravel avenues. Chunky painted-wooden-toy stylisation, no grime. NOT pastel candy: no pink, no mint, no baby blue.
> Signature landmark: a giant Ferris wheel on a square raised plinth at the centre, white lattice spokes, gondolas alternating red, yellow and blue.
> Tiles: each quadrant is a 3 x 3 quilt of square coloured field tiles; on it, mirrored across both avenues: one red-and-yellow striped carousel at the centre of each quadrant; identical striped booths in straight rows along the avenues; a square red-and-white big-top tent at each of the four outer corners; two identical blue-and-yellow helter-skelter towers flanking the entry; rows of identical round hay bales and box hedges; bunting on straight lines between identical white poles; a small square duck pond with a plank footbridge in each quadrant.

### Saltwind Lighthouse (`04-saltwind-lighthouse`)

> THE PLOT: SALTWIND LIGHTHOUSE, a northern fishing harbour on black basalt in a passing squall. Late afternoon: a heavy pewter-grey storm sky with slanting rain and one cold silver break of light low on the horizon. Palette: pewter grey, slate-green sea with white surf, black basalt blocks, whitewashed cottages with black tarred timber and dark slate roofs, wet reflective stone, a little ochre lichen; the ONLY strong colour is the lighthouse's signal red. NOT tropical: no turquoise water, no sand, no palms (that is another plot); no airships, cranes or timber docks (that is another plot); not blue-sky.
> Signature landmark: a tall white lighthouse with bold signal-red bands on a square stepped basalt plinth at the centre, its lantern room glowing cold white, a pale beam slanting out through the rain.
> Tiles: a square slate-green harbour basin in each of the four quadrants with straight basalt quay walls, bollards and two small moored fishing boats per basin, mirrored; rows of identical whitewashed cottages with black roofs on square basalt terraces; an identical black-timber boathouse at each of the four corners; repeated net-drying racks, stacked lobster pots and buoy posts in straight rows; identical black iron lamp posts along the avenues; a low basalt sea wall with surf breaking beyond the far edge of the plot.

### Fossil Badlands (`06-fossil-badlands`)

> THE PLOT: FOSSIL BADLANDS, a palaeontology dig camp cut into banded clay badlands at blue hour. A cool lavender blue-hour sky with the first stars and a last thin pale-peach line on the horizon, soft cool light. Palette: lavender and slate blue light; terraced rock in bold flat horizontal bands of oxblood red, mustard yellow, cream and charcoal (painted-hills strata); bone-white fossils that read bright against the dusk; khaki canvas tents; small warm-white work lamps on posts. NOT a sand desert: no dunes, no palms, no sandstone temple, no orange sunset, no lava.
> Signature landmark: a colossal bone-white dragon skeleton on a square stepped excavation pit at the centre, its long spine and ribs arching high, horned skull resting on the pit rim, timber scaffolding and ladders against the ribs.
> Tiles: square terraced dig trenches stepping down in each of the four quadrants with string grids over them; flat-topped stepped mesa blocks with banded strata in rows along the plot edge and at the four corners; identical khaki canvas tents in straight rows; plank boardwalks on the cross avenues with mine-cart rails beside them; repeated sorting tables, crates and sieves; an identical timber hand crane at each inner corner of the pit lifting a plaster-jacketed bone; identical lamp posts along the avenues.

## Fix edits (re-rolls)

Two of four first takes were re-rolled as edits of their own first take, with this common block:

> The attached image is a 2x2 mockup sheet of one open plot in Wildshard, a stylised 3D game played as an iPhone portrait web app: four fixed camera views (top-left above neighbour, top-right road entry, bottom-left top-down, bottom-right plaza) of one blocky, mirror-symmetric, tile-built square plot beside a grey ring road.
>
> EDIT this sheet. Keep everything about it exactly as it is (the 2x2 layout, the four cameras and framings, the gutters, the road and kerbs, the 8 x 8 tile layout, every building, prop and their positions, the four-fold symmetry, the chunky stylised 3D game rendering) EXCEPT the one change described below.
>
> Never include: any text, letters, numbers, labels, billboards, signs, posters, logos, UI, watermark, people, animals, floating lanterns. Leave the top-left corner of each panel as plain scenery.
>
> Output: exactly ONE portrait image, 1024 x 1536, the whole 2x2 sheet.

### Fossil Badlands: relit

The first take came out deep-navy night with stars (the Ember Forge reference leaked its dark), too close to Starfall
Observatory and Ember Forge.

> THE CHANGE: relight it from night to a BRIGHT LAVENDER BLUE HOUR, just after sunset. The sky becomes a soft, light gradient of lilac and lavender overhead to pale rose-peach at the horizon, clearly much lighter than a night sky: no deep navy, no black, at most two or three faint stars. The ground and rock pick up the cool lavender ambient light so the oxblood red, mustard yellow, cream and charcoal strata bands read clearly and saturated, and the bone-white dragon skeleton glows pale against the lilac sky. The small warm-white work lamps stay, but they are small accents, not the main light. Nothing else changes.

### Jungle Ziggurat: Mesoamerican, not Chinese

The first take put a jade pagoda roof and red cloth banners on the pyramid and a Chinese gate on the plaza, which read as
Night Market / Nine Dragon.

> THE CHANGE: make the temple read as Mesoamerican, not Chinese. Replace the shrine on top of the step pyramid with a flat-topped carved limestone temple house painted cinnabar red and turquoise, with a tall pierced stone roof comb on top: no curved, tiled or upturned eaves, no pagoda roof. Replace the red cloth banners on poles with turquoise-and-saffron feathered standards. Make the plaza gate (panel 4) a square stepped stone arch painted in the same cinnabar, turquoise and saffron bands, with no tiled roof and no Chinese brackets. Nothing else changes.

Saltwind Lighthouse and Patchwork Fairground shipped their first take.
