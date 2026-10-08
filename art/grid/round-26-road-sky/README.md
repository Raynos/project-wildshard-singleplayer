# Grid round 26: the generic road sky (E455)

**Question:** in INFINITE WILDSHARD, what should the sky over the road network look like? Jake: *"When you're outside on
the road, you get the generic sky of the road. I need mock-ups of the generic sky of the road."*

Background: inside a cell the shard owns the whole frame: its sky, sun, fog, light and grade (G158, G232). On the road,
the roundabouts, the outer road and the safe zone, the road owns it, and from the road the neighbouring shards sit under
the road light (G165). The frame blends over 16 m at the cell edge (G175). Today the road sky is one camera-centred
gradient dome (`src/game/grid/roadSky.ts`, round 20): a calm grey-blue zenith over the frame's air, under G75's grey-blue
grade (saturation 0.8, cool tint). The key light and shadows on the road are still the home shard's sun.

Each variant has three frames, iPhone portrait, with today's HUD:

1. **At the roundabout**: road level on the boulevard, looking south. Nalati is on the left, Driftwood Isle on the right,
   and the "DRIFTWOOD ISLE" / "NALATI" sign is in view, with both neighbours under the road light. The HUD is the road
   HUD: SAFE ZONE, dimmed ATTACK, HOVER.
2. **Road side of the edge** (`*-edge.jpg`): Driftwood's entry stub just before the cell edge. The road still owns the
   frame, so Driftwood sits under the road sky.
3. **16 m in** (`edge-inside-driftwood.jpg`, shared by every variant): the same camera with Driftwood owning its frame,
   its bright tropical sky and faceted cumulus. ATTACK is live and there is no SAFE ZONE chip.

Columns 2 and 3 hold the camera still so you can compare them. In the game the switch is the 16 m blend as you walk in.

## Board: `board.jpg`

One row per variant: roundabout · road side of the edge · 16 m in.

| Variant | Files | What it is | Cost on the iPhone |
|---|---|---|---|
| **A · Clear neutral day** | `A-clear-neutral-day.jpg`, `A-clear-neutral-day-edge.jpg` | Today's neutral done well: a pale, slightly desaturated blue fading to a near-white horizon haze, a few thin high cirrus streaks, a high soft sun. Reads as "a nice day on a motorway". | Today's dome plus one scrolling cirrus layer: 1 draw, one ~512² alpha texture (≈ 0.3 MB GPU). |
| **B · Grid dawn** | `B-grid-dawn.jpg`, `B-grid-dawn-edge.jpg` | A soft dawn gradient (periwinkle → lilac-grey → pale peach at the horizon) with one thin glowing cyan line on the horizon and a faint cyan wire grid just above it. It echoes the HUD's `#8fe3ff` and the VR-void floor beyond the outer ring. No clouds; low soft sun. | Pure shader on today's dome (three colour stops, a line and a fading grid computed in the fragment shader): 1 draw, no textures, ≈ 0 MB. Needs a road key light (direction + colour uniforms, blended like the grade). |
| **C · Stratosphere** | `C-stratosphere.jpg`, `C-stratosphere-edge.jpg` | High-altitude: deep ultramarine zenith fading to white horizon haze, with two or three slow translucent light ribbons drifting high up. Bright, crisp sun. | Dome plus one instanced draw of 2–3 additive ribbon strips (one ~256×64 gradient texture, ≈ 0.1 MB). Additive overdraw is small (thin strips, high in the sky). 2 draws. |
| **D · Overcast studio** | `D-overcast-studio.jpg`, `D-overcast-studio-edge.jpg` | An even pearl-grey cloud ceiling with no visible sun: soft diffuse light, very low contrast, gently desaturated. Every shard pops when you cross in. | Dome gradient plus low-frequency noise in the shader: 1 draw, no textures. Needs a road key light at low intensity with higher ambient. Could *save* GPU by softening or skipping the road's shadow map (a Debug row, measured first). |
| **E · Dusk between worlds** | `E-dusk-between-worlds.jpg`, `E-dusk-between-worlds-edge.jpg` | A warm-cool dusk split (amber horizon on one side, dusty blue to indigo overhead, a few first stars). Low over each neighbour cell a faint glow of its own sky shows like a distant window: turquoise over Driftwood, golden-rose over Nalati. | Dome shader plus one additive glow card per neighbour cell, about 8 cards in one instanced draw: 2 draws, ≈ 0 MB. Needs a road key light at a low angle, a big day-clock jump each time you leave a cell. |

## Recommendation: B, Grid dawn

- **It reads as "between worlds".** The cyan horizon line and the faint grid tie the sky to the HUD and to the VR void
  beyond the outer ring, so the road network has its own identity instead of being just another sky.
- **It's calm and neutral.** Soft, low contrast, no clouds, so it never fights a shard's style (toon Driftwood, painterly
  Nalati, PBR Pine). The shard's own sky clearly takes over at the edge (row B, columns 2 and 3).
- **It's the cheapest of the five**, together with D: the same one-draw dome as today with a different fragment shader, no
  textures and no new memory.
- **Runner-up: D, Overcast studio.** It gives the strongest "you entered a world" moment and may even save shadow cost,
  but it reads as a grey day: dull while driving the boulevard.
- **A** is safe but forgettable (today, done better). **C** is lovely but the ribbons pull the eye up from the road.
- **E** is the most beautiful, but a dusk road means a large time-of-day jump every time you enter a noon shard, and the
  warm/cool split tints every neighbour.
- Whichever wins, the road needs its own key light (sun direction and colour) next to its sky. Today the road keeps the
  home shard's sun (round 20, "Not changed"). That is uniforms only, blended with the grade over the 16 m band.

## How they were made

codex `image_gen`, one image per run, run in parallel, no re-rolls (every frame was read and its HUD strings checked).
The references were:

- **Roundabout frames:** an edit of `art/grid/round-17-road-view/A-road-light-road.jpg`, the frame Jake picked for G165:
  the roundabout, both neighbours and today's road HUD. Only the sky, light and grade were changed.
- **Inside frame:** an edit of the real phone capture `progress/shard-platform/grid-hud/pier.jpg` (Driftwood's own sky and
  HUD), re-staged at the entry stub.
- **Edge frames:** an edit of the inside frame, with each variant's roundabout frame as the sky / light reference and the
  road HUD (SAFE ZONE, dimmed ATTACK) restored.

The HUD strings are exactly today's: "PAUSE", "30 fps 33 ms", "0", "N", "WHO LIT THE FIRE?", "CASTAWAY 318 M", "HOVER",
"DODGE", "JUMP", "SAFE ZONE", "MOVE", "ATTACK", "HOLD = HEAVY", "LOOK" and "DRAG TO MOVE". The in-world sign reads
"DRIFTWOOD ISLE" / "NALATI".
