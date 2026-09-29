# Round 24 · the mockup pass: the Well (E281, domes B1 · B2 · D1 · D2)

The Well lane of the E281 mockup pass: the Well's world geometry (`src/chunks/nine-dragon-stack/world/well*.ts`), worked
in passes toward mockups B and D and the four Well domes' 3×3 targets (`round-15-eight-domes/`). Every pass is captured
with `scripts/nine-dragon-domes.mjs --domes=B1,B2,D1,D2 --mockups=B,D` from a clean export of HEAD plus the pass's
files. "Before" is the clean export of the HEAD the pass was built on. Passes 1–3 are in `../../round-23-well-rim/`.

Each `pass-<n>/` holds:

| File | What it shows |
|---|---|
| `board-BD.jpg` | Mockups B and D on the phone frame, as played: mockup, before, this pass |
| `B1-sheet.jpg` · `B2-sheet.jpg` · `D1-sheet.jpg` · `D2-sheet.jpg` | Each dome's nine views: target and engine, the pass's build |

## Pass 4 (on `d5acb0c`)

- **The run north's rungs.** Three crossings sat above the rim's eye (+128, +137 and +143). From mockup B's camera they
  stacked with the gate into one block in the middle of the frame, seen from below. They now step down below the eye
  (+104 to +119), and the far gate is raised to +134 over their end (`well-plan.ts` CROSSINGS). Dome B2's view north
  opens a little too.
- **The neon calligraphy for mockup D.** The near hero signs moved to where mockup D's frame has them and grew to 2–2.3 m
  a character (`well-rim.ts` HERO): 麵 and 牙科 down the left, 火鍋, 茶 and 旅館 down the right. One had hung behind a
  catwalk and 茶 behind a net. The run north's far signs are 1.6× larger for mockup B (`well-mid.ts`).
- `well-mid.ts` VIEWS[0] now uses mockup B's new camera (z 13.3), which sets the crossings' level of detail.
- **Memory.** Fragment geometry 155.8 → 155.5 MB, textures 79.6 MB unchanged. Mockup B has 115 draws and 1.34 M
  triangles, mockup D 99 draws and 1.06 M, both unchanged. The walk test runs 19 legs with 0 stuck and 0 escapes.

**Tried and reverted by the eye-check:**

- **Lamp strips on every gallery rail.** At 10 cm they did not show at phone size.
- **Ghost levels under the run north's galleries, below +83.** They were lost in the mist and cost 0.8 MB.
- **The main shaft's west galleries stepped back to 3.4 m north of z −23.** B's vista opened slightly, but the change
  reshuffled the west band's random layout. D's left side then showed a bare grey roof, and three other seeds were no
  better.
- **The Well's upper tower walls dressed at mid detail with more galleries.** In the look-ups the walls read the same,
  for about 0.1 M more triangles per look-up.

## Pass 5 (on `2a5428f`)

- **Lines of warm light, level after level, for mockup D.** Nine strings of paper lanterns (1 m, 1.5 m apart) hang
  across the main shaft, one a level, each deeper and further north than the last (`well-mid.ts` LEVEL_STRINGS). From
  mockup D's camera they step down the frame from the gate bridge to the temple, and the mist lets their light through.
  Every string is clear of the crossings and nets and at least 6 m from dome D2's anchor. A string 3 m under the anchor
  was dropped: it hung as a row of big orange blobs across D2's look-down. Each string's cord is 3 beams instead of one
  per lantern.
- **Memory.** Fragment geometry 154.4 → 154.5 MB, textures 79.6 MB unchanged. Mockup B has 117 draws and 1.34 M
  triangles, mockup D 101 draws and 1.06 M, both the same as the base (the lanterns ride the existing instanced
  draws). No collider changed.
- `camera-D-proposal.jpg`: mockup D against D's camera now, **A** (back 1.3 m and up 0.6 m, pitch −50) and **B** (over
  the lion post at x −16.75, pitch −62, yaw 18). No camera puts the lion where the mockup has it. The first-person
  gauntlet fills the frame's lower left, where the mockup's arm points up out of the way. In B the lion peeks out at the
  left edge behind it. A shows the balustrade as a band but no lion. The coordinator decides.

## Pass 6 (on `4bd549f`)

- **Mockup B's gondola reads.** The parked cabin up the run north is 1.5× (`well-mid.ts` farCabin). At its real size
  and 59 m it was a few pixels; now it is the red cabin with a lit window band about 38 % down B's frame.
- **Lantern strings up the run north.** Five strings hang below the rim's eye between the crossings (`well-mid.ts`
  RUN_STRINGS), clear of every crossing, net and pipe. At phone size they are faint warm dots; they help B2's views
  north more than B.
- **Memory.** Fragment geometry 154.5 → 154.6 MB, textures 79.6 MB unchanged. Mockup B has 117 draws and 1.34 M
  triangles, mockup D 101 draws and 1.06 M, both unchanged.
- The eye-check has flattened (pass 6's gain is the gondola), so the Well lane stops here. What remains is in the
  report: the mist's depth curve (render), the view north ending on the run north's far wall (it needs the canyon
  extended north under the Cable Deck), and the lion hidden behind the gauntlet (camera / viewmodel).
- Two dome cameras sit inside geometry in every pass: B1·2 is in the rim towers' eave and B2·3 inside a gallery roof.
  They are left for the coordinator to re-seat.

## Round 2

### Pass 7 (on `2cd6ddb`): the run north goes on past the Cable Deck

- **The canyon recedes about 200 m.** The run north's north wall at z −104 is gone. The canyon runs on to z −190
  (`well-plan.ts` FAR), open to the sky beyond the deck's edge and built at the far level of detail (`well-mid.ts`
  farRun):
  - a painted back wall up to the canyon's top (+155), with the facade program's window rows;
  - ghost levels from +149 down 17 floors (a deck slab, a lit room or two, now and then a lantern);
  - a far north wall where the view ends.
  Its triangles go into the run north's two kits, so it adds no draw. The mist box (SHAFT) and the Well's map rects
  reach to z −190.
- **Rungs to a small, pale far gate.** A rung stands about every 12 m below the eye (z −111 to −171). The gate moved
  from z −95 to the far end at z −182; a stone rung replaces it at −95. There is no crowd on the far rungs.
- **Shallower run-north galleries (1.2–2.2 m, were 2–3.4).** The open gap reads ~12.5 m wide instead of ~10.
- **Memory.** Fragment geometry 153.9 → 153.9 MB, textures 79.6 MB unchanged: the north band paid for the far run.
  Mockup B has 118 draws and 1.38 M triangles, mockup D 102 draws and 1.09 M, both unchanged.
- **Walk test:** 19 legs, 0 stuck, 0 escapes.
- **What the eye-check says.** At mockup B's camera the vanishing point is now pale and deep. From inside the run north
  the canyon reads as a long one (the `in` view in the pass log). But mockup B's centre-right is still the **stub**: the
  main shaft's north wall at z −44, x −12…0, which is the south face of the street's west block. It faces B head-on 57 m
  off, because the main shaft is 12 m wider than the run north. Only a change to the main shaft's footprint removes it.
