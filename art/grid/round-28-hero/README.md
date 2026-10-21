# Main-menu hero on the 5 × 5, round 28 (G536)

Jake (2026-10-20, a phone shot of the menu showing the old 3 × 3 hero): *"If the 5x5 grid is live, we have to retake
this hero image in the game and update it."* These are the three candidates for the plan agent's A / B / C board. The
shipped hero (`public/assets/title/main-crossroads-*.jpg`) is untouched until Jake picks.

| | File | View |
|---|---|---|
| A | [`A-5x5-1440.jpg`](A-5x5-1440.jpg) | From the east over Nalati and Ink-cel, an oblique that keeps a strip of sky (eye 1,350 m up, 27° down) |
| B | [`B-5x5-1440.jpg`](B-5x5-1440.jpg) | From Pine's side, steep and map-like: all 25 squares read as a grid (eye 2,300 m up, 57° down) |
| C | [`C-5x5-1440.jpg`](C-5x5-1440.jpg) | Low over template-2's corner, the grid receding toward the horizon (eye 600 m up, 13° down) |

Real canvas captures of a clean build of `09bdb72199` (`09bdb72-mvhi373z`), no paint-over, every label burned in:
`scripts/capture-main-menu-hero.mjs --round=5x5 --rev=09bdb72199`, labelled by a PIL pass (JPEG, ≤ 250 KB each).

- **Framing:** the portrait menu's square centre band at the phone-1x lens (62°, G344), aimed at Driftwood's centre.
- **Phone tier at render scale 2:** a 720 × 720 CSS page at DSF 2, so a 1440 × 1440 canvas, the band's own size.
- **Shipped tiers, no pin:** the player stands on round 5's road and every cell draws what the game draws there (the
  capture.json frames record each cell's tier). The only capture-time changes are the lens and a far plane past the
  outer band (`farMetres`, the capture camera only), as round 6 did for the lens.

**What to know before picking.** To hold all 25 squares at 62° the eye has to stand 1.5–3 km from most cells, and the
engine's distance fog (the road's dawn air) pales everything at that range: the shard cells read as light slabs, and
only the fourteen cyan billboard plots, the template's map and Driftwood/Nalati near the middle keep their colour.
Pinning every cell to its near view (`nearEvery`, as round 6b) was tried and reads the same, so it is the fog, not the
tier. A clearer whole-grid hero needs either a capture-time thinner fog (a look change, Jake's call) or a closer frame
that crops the outer band; neither is in these three.
