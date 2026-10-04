# round-18-refused-cell: what a grid cell shows when its shard can't load (E449 M4)

Ask E449 (SHARD-PLATFORM mockup wave, item M4). A cell's shard can be unavailable for three reasons:

- **SF58 admission:** the shardfile is refused by the manifest-only preflight, before any asset is fetched.
- **SF57 budget:** the allocator refuses a load that would pass the memory envelope.
- **G86 upgrade:** the shardfile was built for a newer client ("NEEDS UPGRADE").

The plan says each case is refused. It never says what the player sees in the grid.

**Question: which refusal look?**

Every grid frame uses the same pose and the same reason, so only the look differs: first person on the boulevard,
facing Pine Hollow's 8 m midpoint entry, with the road's safe-zone HUD. The reason shown is G86's, "NEEDS UPGRADE ·
YOUR SAVE IS KEPT".

## Board: `board.jpg`

| Variant | File | What it shows |
|---|---|---|
| A · VR-void plinth | `A-void-plinth.jpg` | Pine Hollow is not there. Its square is the empty VR void (G89's black floor with cyan grid lines), edged by the cyan rail; the turn-in stops at the rail. A holographic sign floats over it: "SHARD UNAVAILABLE" / "PINE HOLLOW · NEEDS UPGRADE" / "YOUR SAVE IS KEPT". |
| B · frozen proxy under static | `B-static-shroud.jpg` | Pine Hollow's far proxy, frozen and drained to grey under a TV-static dome, behind G85's cyan hex shimmer soft wall. The label reads "PINE HOLLOW · NEEDS UPGRADE" / "YOUR SAVE IS KEPT"; there is no loading bar. |
| C · sealed gate | `C-sealed-gate.jpg` | A heavy steel gate closes the entry between concrete pillars, with neutral retaining walls either side. Its sign reads "PINE HOLLOW" / "NEEDS UPGRADE · YOUR SAVE IS KEPT". The pines show over the wall. |
| SHARD SELECT card | `select-card-unavailable.jpg` | G86's dimmed card extended to every refusal: an amber "UNAVAILABLE" badge, "PINE HOLLOW", an amber reason line "TOO BIG FOR THIS DEVICE" (here a budget refusal), progress kept ("QUESTS 1/4", "FEATS 0"), and the button disabled as "UNAVAILABLE" / "YOUR SAVE IS KEPT". |

## Proposed reason lines (one line, player words; for Jake to confirm)

| Cause | Reason line |
|---|---|
| G86 upgrade | "NEEDS UPGRADE" |
| SF57 budget refusal | "TOO BIG FOR THIS DEVICE" |
| SF58 admission refusal | "FAILED SAFETY CHECK" |

Every case adds "YOUR SAVE IS KEPT".

## Recommendation: A, plus the card

- A is the only look that is honest for all three causes. An SF58 refusal makes **zero asset requests** (SF58 (1′)), so
  the shard has no far proxy to show. B's frozen proxy, and C's pines over the wall, need a proxy that a refused
  shardfile never delivers.
- A reuses what is already built: the void shader and the cyan rail (G89, the cheapest thing in the grid) and the rail
  as a collision wall.
- It also reads at a glance as "this square is not here", not as "still loading" (that is G85's shimmer, which B would
  be confused with).
- C is the strongest sign, but it needs a gate model at four entries per cell, and the wall still needs something
  behind it.
- On SHARD SELECT, the card extends G86's dimmed card with a reason line, so one pattern covers every cause. Today
  "NEEDS UPGRADE" is both the badge and the reason; with the card it becomes the badge "UNAVAILABLE" plus the reason.

## How they were made

codex `image_gen` (gpt-image), one image per run, run in parallel. The references were:

- the grid frames: the real phone capture `progress/shard-platform/grid-hud/safe.jpg` (the road HUD),
  `art/grid/round-8-soft-wall/B-shimmer-barrier.jpg` (the pose and G85's soft wall),
  `art/grid/round-12-vr-void/A-tron-grid-rail.jpg` (A's void) and the real Pine capture
  `progress/pine-hollow/20261002-0011-0d59505c/first-frame.jpg` (B, C);
- the card: `art/menu/round-10-continue-progress/E-calm-crisp-1.jpg` (the calm card, G133) and
  `art/menu/round-6-needs-upgrade/A-dimmed-badge.jpg` (G86).

Frames are about 853 × 1844 (the card 910 × 1728), saved as JPEG.

Re-rolled: A, once. The first take showed Driftwood's beach and Nalati's steppe on either side of the void, which is
wrong for a cell seen head-on.

Drift kept:

- B adds a small green "PINE HOLLOW →" sign.
- The card's picture is darkened but not fully desaturated.
- The ATTACK sub-label reads "HOLD - HEAVY" in some frames, where the game shows "HOLD = HEAVY".

These are mockups only: nothing here is built.
