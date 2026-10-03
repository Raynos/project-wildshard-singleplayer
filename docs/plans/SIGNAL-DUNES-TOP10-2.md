# Signal Dunes: the second top-10 (E407, E409)

**State:** `in progress` 2026-10-03: the second zoom-out, written by the lead from round 17's frames (20261003-0947-8c70feaf), after round 16 regressed (E409's switching rule). It supersedes SIGNAL-DUNES-TOP10 (archived: rows 1-4 and 9 landed; rows 5, 6, 8 and 10 carry over here). The bar is 7.0; Sky Reach passed and is archived.

## Why the game is still behind (zoom-out, from round 17's frames)

The **forms are finally right**. Round 17's spawn pair has receding dune rows, the tower on its own mound, and a whip
loop that reads as one. What separates the five frames from their mockups now is **light, sky, fire and life**:

1. **The light is grey, not sunset.** The mockups' lit sand is saturated amber under a warm key, with cool violet
   shade: a complementary warm/cool split. The game's lit sand reads beige-grey and its shade brownish. This is the
   biggest pixel area left, in A, dusk-fire, C and D.
2. **The sky lacks the sunset's fire.** Mockup A's horizon band glows orange, with lit cloud undersides above it. The
   game's band is duller and its clouds flat. Row 5's painted skies are built and parked.
3. **The fire is a card.** Mockup C's waymark has burning logs, sparks spiralling up and left, a smoke column, and a
   warm light pool on the sand round the plinth. The game's flame is a graphic shape with a dark base. Row 6's
   flipbook is built and parked.
4. **The scene has no life in the sky.** Dusk-fire's mockup has the ray gliding over the tower: its focal silhouette.
5. **The hand** is still turned wrong. The re-posed glove is in progress.

## The rules (unchanged)

- **One world, global changes:** ledger 5 and the restated camera-distance rule in scores.md.
- **Assets go through `mockup-to-model`.**
- **The phone limits:** 1.8 GB loading / 1.0 GB Explorer. gpuMB ceilings are ratchets.
- **Judge every row by eye, side by side with the mockup, and inside the region it changes.** Never by one number
  alone: round 16's correlation went up while the likeness went down.
- **Commit per row and send 'ready for round N'.** After this plan's first batch (rows 1-4) lands, the phase returns to
  detail (E409).

## The top 10, in order of expected gain

| # | Lever | Views | How |
|---|---|---|---|
| 1 | **The sunset light: a warm key, cool shade** | A, dusk-fire, C, D | The key's colour and intensity toward the mockups' amber, and the fill and shade toward cool violet, so the lit sand reaches the mockups' saturation (about 0.6) with violet shadows. Measure it on lit and shaded patches inside the dune band, and check it in the late clip. It is global and on the dusk curve, never per view. |
| 2 | **Land the painted skies** (old row 5) | all five | The parked work in art/sunscar-dunes/round-25-sky: one seamless panorama per dusk stage, blended on the dusk value, with the horizon band glowing and lit cloud undersides as in A. |
| 3 | **Land the fire** (old row 6) | C (and B's cookfire and the signal fire) | The parked Mantaflow flipbook in art/sunscar-dunes/round-26-fire. Add sparks rising up and left with drift, a smoke column, burning logs in the bowl, and a warm light pool on the sand and plinth from a real local light. |
| 4 | **The re-posed glove** (in progress) | all five | The back of the hand and the cuff toward the camera, the fingers wrapped round the handle inside a hanging coil, as in D and dusk-fire. |
| 5 | **The ray's dusk route** (old row 8) | dusk-fire | Its ordinary patrol passes over the tower at dusk, so a player at the spawn sees it there at that hour, reading as a silhouette against the glow. A real route; nothing staged for the shot. |
| 6 | **Re-fit the LUT** (old row 10) | all five | Only after rows 1-3 have settled. Fit per region like Sky Reach's second fit, ease the highlights, and verify it on h1-h4, the aerials and the clip. |
| 7 | **A's lit near diagonal** | A, dusk-fire | Still short of the mockup: the game reads 52 against 77. Once row 1 is in, light the near windward face so it catches the low key, as in the mockups. |
| 8 | **The caravan under its lantern** | B | Lantern light on the canvas and the tailboard, a warm pool on the sand, and the cookfire's smoke rising, as in mockup B. |
| 9 | **D's layered bands** | D | The mockup's long horizontal dune bands, each with a lit rim and a dark trough, receding to the horizon. Real terrain in the field D looks over. |
| 10 | **Aerial perspective** | A, dusk-fire, D | The far dunes going violet-blue with distance and the near ones staying warm. That is distance haze toward the sky's colour, which is allowed (it is fog, not a brightness cut). |

## Status

| # | Owner | State | Evidence |
|---|---|---|---|
| 1 | signal-dunes | landed (round 18) | 011e46d7b: the key's light saturated and amber, the sky fill desaturated and cooled; lit sand 0.59-0.63 saturation (mockups 0.57-0.69), the shade violet-grey; B's dune 19 m, waymark 0's rise 20 m. The crest's lit/shade placement under the in-glow key: open, see the round-18 note (the spawn mockups light the near faces from behind-left) |
| 2 | signal-dunes | landed (round 18) | dc811cc20: two painted stages (early, late) blended on the dusk; the late painting fit all five mockups' sky bands best, the early one is its re-colour; art/sunscar-dunes/round-25-sky |
| 3 | signal-dunes | landed (round 18) | 653a4296f: the Mantaflow flipbook (orange tongues, a white core), the crown logs glowing when lit, a lit grey-brown smoke billow, one point light on the plinth and the sand; art/sunscar-dunes/round-26-fire |
| 4 | signal-dunes | landed (round 18) | af0d299b4: glove-hd4 (mockup-to-model, Hunyuan3D-2, 18 k triangles): the back of the hand and the cuff toward the camera, the loop a teardrop at the handle's top; art/sunscar-dunes/round-27-glove |
| 5 | signal-dunes | open | |
| 6 | signal-dunes | open | |
| 7 | signal-dunes | open | |
| 8 | signal-dunes | open | |
| 9 | signal-dunes | open | |
| 10 | signal-dunes | open | |
