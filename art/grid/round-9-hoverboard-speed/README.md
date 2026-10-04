# V26: hoverboard speed feel on the highway (E438, SHARD-PLATFORM G33 / G60 / G68, 2026-10-04)

**Question:** on the grid highway the hoverboard runs at 30 m/s (about 15 m/s inside shards), with bare hands because
the highway is a safe zone (G68). How should that speed feel in a still frame?

Art direction only, codex `image_gen` edits of a fresh live capture: production build, `?chunk=driftwood-isle`,
iPhone 16 Pro portrait (402 × 874 at 2×), phone tier, touch HUD, HOVER on (the real cyan-outlined board under the
view). codex replaced the pier with a straight platform highway between two shards, took the sword away (bare hands)
and dropped ATTACK and DODGE from the HUD (safe zone). The highway is drawn in the same faceted low-poly toon look.

- `board.jpg`: the A / B / C decision board.
- `A-wide-fov-speedlines.jpg`: **A**, a wider field of view (the road flares toward the bottom corners) and a few thin
  speed lines at the outer edges only; the centre stays clear.
- `B-motion-blur-wind.jpg`: **B**, normal FOV, a strong radial motion blur on the outer third of the frame and wind
  streaks; the centre stays sharp.
- `C-clean-speed-chip.jpg`: **C**, a crisp frame with no effects; the only addition is a small HUD chip above the bottom
  bar reading "HOVER 30 M/S" in the HUD language.

No re-rolls.

**Recommendation: A.** A FOV kick and a few edge lines are almost free on the phone and read as speed at a glance; B's
full-screen radial blur is a post pass the 2× phone budget can't spare and smears the world Jake wants to see; C
undersells 30 m/s (a number is not a feeling). A small speed chip from C could ride along with A.
