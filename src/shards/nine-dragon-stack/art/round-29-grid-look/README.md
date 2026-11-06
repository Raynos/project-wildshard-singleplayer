# V21: Nine Dragon Stack under the grid's one frame (E438, SHARD-PLATFORM SF19a / G20 one frame, 2026-10-04)

**Question:** the grid draws one sun, sky, fog and exposure for the whole view (each shard keeps its own grade per
pixel). Nine Dragon is a neon vertical city that lives at night (DEVSERVER puts it at cell (+1, −1)). How should it read
from the highway and from a neighbouring cell?

Art direction only, codex `image_gen` edits of a fresh live capture: production build, `?chunk=nine-dragon-stack`,
iPhone 16 Pro portrait (402 × 874 at 2×), phone tier, touch HUD. codex re-framed the camera onto the highway outside the
cell, with bare hands (safe zone: no sword, no ATTACK button); across the road on the left is a neighbouring template
cell. The stack keeps its illustrated neon style (signs in Chinese characters only).

- `board.jpg`: the A / B / C decision board.
- `A-night-dome.jpg`: **A**, the rest of the view is shared daytime; the stack keeps its own night under a dark,
  rain-hazed dome glowing magenta and cyan from the neon, its edge a soft wall in the sky above the strip.
- `B-day-neon-accents.jpg`: **B**, everything in the shared daylight; the facades read grey, teal and rust with
  laundry and air-conditioners, the neon and lanterns are small accents.
- `C-dusk-fog-border.jpg`: **C**, the shared sky at dusk; low blue-grey fog rolls across the strip and the stack's base,
  the upper floors and their neon rise out of it.

Re-rolled: B (the first take came back at a squatter aspect than the other two).

**Recommendation: C.** Dusk plus border fog keeps Nine Dragon's lit-window, neon character without a per-shard sky
override (A's hard night wall breaks the one-frame rule, which is the point of SF19a), and the fog also hides the
stack's base seam against the strip; B is faithful to one frame but loses what makes the shard Nine Dragon.
