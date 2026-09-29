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
