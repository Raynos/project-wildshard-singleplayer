# Round 24, the fabric lane (E281)

The city fabric seen in every view: the tower walls (the facade grammar), balconies, windows, eaves, AC units,
laundry, pipes, lantern strings and neon signs. Owner files: `world/{towers,facades,dressing,kit}.ts`, `world/facade/*`,
`look/{facadeMaterial,lanterns,signs,neonsigns,glyphs}.ts`, `world/words.ts`.

Each pass's sheets are `scripts/nine-dragon-domes.mjs` captures (target | engine, all eight domes and the four mockup
cameras) of a snapshot build: a clean export of `main` with only this lane's files overlaid. Other lanes' commits in
`main` at the time show too (the render lane's blue hour landed between pass 0 and pass 1).

## Pass 1

Build: `main` at `27043b0a` + this lane's files. Sheets: `pass-1/`.

**The budget first.** The facade dressing had ~28 draws against its cap of 20 and the shell was the lane's biggest
geometry (12.6 MB). Facade multi-draw stays prohibited (E271 / E272): every change below is instancing or merging.

- **Packed facade vertices.** The facade builder's layout went from 88 to 52 bytes a vertex (normals and tangents as
  normalized bytes, the wash as a byte, the pattern and misc words as half floats, 16-bit indices for the pieces). The
  program reads the same values. The shell went 12.55 → 5.0 MB.
- **Fewer piece draws.** Ledges, bay boxes and gallery posts share one unit-box instanced draw; the two cages one cage;
  the two rooftop shacks one shack (its roof takes the instance tint, the rest keeps its colour through a flag in the
  pattern kind). Couplets, shutters, sign boards and boxes, window ACs, street-line laundry and awnings are merged
  into the shell. Facade draws per pose: 23–30 → 15–20.
- **Cables as wires.** Every sagging cable is a three-sided prism without caps (12 vertices, a beam box took 24).
  Gallery railings are an instanced lattice piece, one per metre, instead of hundreds of bars merged into the shell.

**Then the look.**

- **The grammar.** Timber-clad columns (dark planked cells, lattice 窗格 windows with timber frames, a timber balcony on
  half their floors, a glazed eave over most floors, red lanterns at the balcony edges); glazed pent-eave bands every
  3–5 floors instead of 4–7; galleries carry their eave more often; timber balconies more often; the wall washes a
  touch darker and sootier.
- **Tall neon in the grammar.** Two to fourteen floors over the street, vertical neon boards flat on window cells and
  blades hung out at bay seams on two arms (filled with real words in `build.ts`), on every dressed wall.
- **Far walls.** The painted far faces are Kowloon bays instead of an even window grid: bays of 2–3 windows with their
  own tone, timber bays, balcony bays (a slab lip and a railing band), glazed eave stripes.
- **The towers.** The square's and the street's walls take more timber (0.15 → 0.55) and verandas (0.28 of floors).
  Ten big hero blades high up: on the east towers (大押, 酒家, 按摩, 賓館) and on the Well's west wall, clear of its
  galleries (九龍, 牙科, 火鍋, 茶, 藥房, 旅館: mockup A's left side). Nine lantern strings of paper lanterns (their LOD,
  glow and light pools): across the square and the Well at +14 to +28 m, over the street beyond the gate, across the
  square's north-east corner. Two high skybridges over the square and the Well (+37, +46 m) for the look-ups.
- **The Crown.** The forty far towers are the grammar's far towers (setback segments, painted Kowloon faces), banded
  on the faces toward the square by slab lips and glazed eaves, crowned with glazed pavilions, tanks and antennas.
- `look/lanterns.ts` has `lanternString(a, b, spacing, sag)`: the cord and the hooks for a string at a region's
  density (the square can ask for more, the stair for fewer).

**Reverted / changed after the capture.** The first high skybridge stood at z = 4, over the stair-street's opening: it
covered the top-down view over the stair foot (C1·9 in this sheet). It moved to z = −7.5 (and the other to −16.5)
before the commit; checked on a later snapshot, C1·9 and C2·9 are clear.

**Numbers** (the capture's `stats.json`): geometry 168.7 → 162.0 MB (every lane; this lane's own geometry 18.3 →
11.9 MB), textures 79.6 → 79.6 MB. Worst pose mockup A 156 draws / 1.71 M triangles (pass 0: 161 / 1.66 M).
`scripts/test-facade-instancing.mjs`: pass on desktop, phone tier and iPhone UA (no batched facade, 9,976–16,526
facade instances).

## Pass 2

Build: `main` at `8279eb35` + this lane's files. Sheets: `pass-2/`. (Other lanes landed in between: the render lane's
pass 2, the capture tool now hides the kit's idle weapons, so the mockup frames show the real viewmodel.)

- **Far faces get relief.** Every painted face of the grammar (the far LOD, the ends and sides of a wall run; not the
  backs) is banded every 2–4 floors by a slab lip or a glazed pent eave along its length: instanced unit boxes and
  eaves, no new geometry. The Crown's own bands went (the grammar does it now). In the look-ups these read as the
  horizontal strata of the stacks rather than a slab's window grid.
- **Eaves on every storey of a timber column** (0.55 → 0.85 of its floors) and a small glazed hood over one plain
  window in seven.
- **Lanterns under the shop eaves**: the square's and the street's shopfronts hang one at 0.8 and a second at 0.5
  (was one at 0.45): the warm red row along each street of the targets.

**Reverted:** nothing. The pass is small on the sheets; the look-ups (A1·1, B2·1, D1·1) and the far Well walls (A2·7,
B2·7) are where it shows.

**Numbers:** geometry 162.0 → 158.8 MB (every lane), textures 79.6 MB. Worst pose mockup A 124 draws / 1.52 M
triangles.

## Pass 3

Build: `main` at `be97ea90` (the stair's sky screen removed) + this lane's files. Sheets: `pass-3/`.

- **Mockup A's left-hand stack.** The Well's north wall (z −44, x −12…0) is the left quarter of mockup A's frame:
  four big neon boards face the spawn across the Well, out past the wall's galleries on two arms — 九龍 highest, 牙科,
  火鍋, 茶 at the foot (the mockup's column). The west wall's top blade reads 麵 (mockup B's top left).
- **Gold rooms.** Lit windows are amber-gold (a warmer, more saturated palette, cool fluorescent rooms 7 % → 4.5 %,
  the room walls pulled further toward the lamp colour): the targets' blue hour has every lit window gold. The render
  lane's light pools read these colours, so the pools warm with them.
- **Laundry on the verandas** (a line under the eave on 0.45 of a gallery's bays, was 0.25).
- **The stair lane's two asks.** (1) A Crown tower that landed in the stair-street's canyon (x > 55, −25 < z < 35)
  moves out to the canyon's nearer side; the rolls are unchanged, so no other tower moves. (2) A wall run's open ends
  (side faces, the square's corner towers over the stair) carry no tall signs, verandas or hung rooms: a veranda on the
  south-east corner tower hid mockup C's 牙科 at the top of its right-hand column; it shows now.

**Reverted:** nothing.

**Numbers:** geometry 156.2 MB (every lane), textures 79.6 MB. Worst pose mockup A 125 draws / 1.49 M triangles.
`scripts/test-facade-instancing.mjs`: pass on all three profiles (no batched facade, ~16,860 facade instances).

## Pass 4

Build: `main` at `3ba3a700` + this lane's files. Sheets: `pass-4/`.

- **The second Cable Deck went with its sky screen.** The coordinator removed the stair's sky screen (it read as a
  flat teal ceiling); the deck it hung from was left as a bare grey slab over the stair, in every view from above
  (C2·9 top-down: now the street and its roofs).
- **Far faces, less of a grid.** The painted far faces give each cell its own opening (narrow, wide, some bricked
  up) and now and then a painted vertical neon sign two floors tall on a bay's first column, in one of the five neon
  hues: the far stacks keep a little of the near walls' clutter. Shader only.

**Reverted:** nothing. The far-face change is subtle at sheet size; C2·9 is the clear one.

**Numbers:** geometry 156.0 MB (every lane), textures 79.6 MB. Worst pose mockup A 125 draws / 1.50 M triangles. This
lane's own geometry, pass 0 → pass 4: 18.3 → 11.3 MB (the facade shell 12.55 → 5.4 MB). The facade dressing's draws:
23–30 a pose in pass 0, at most 20 now.
