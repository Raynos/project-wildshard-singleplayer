---
name: shard-checkpoints
description: Build or rebuild a Wildshard shard in tiny, human-steered, portrait iOS checkpoints while keeping the rest playable and polished. Use for shard scope, mockup-to-engine loops, asset approval, and expansion decisions; not for unrelated engine maintenance.
---

# Shard checkpoints

The goal is one steadily growing, demo-ready shard. Keep roughly 80% of the currently exposed experience pinned and polished; let the active 20% be one small rough slice. These are scope proportions, not an excuse to claim a failing build is polished.

## Start a checkpoint

1. Record the current playable boundary and what is already approved. Name only one next pocket or one interaction. Leave future regions as plan, not scenery that the player can enter.
2. Start from a live portrait capture with the real HUD. Make a high-quality target mockup and a plausible near-term in-engine target for the same camera. Show the user one compact target/current/next board and ask for one decision if taste is needed.
3. For each new 3D asset, show the source and at least front, sides, back and three-quarter angles. Register an approved, used model with the world registry so Model Explorer can inspect it. Do not call an asset approved solely from a hero angle.

## Build the one slice

- Implement the least world that makes the next view or verb real. Collision, movement and hit response are part of the slice; a still frame alone is not a pass.
- Compare the same portrait camera in target and game. Capture the other angles and a moving walk-around internally; bring the user only the best evidence and the one remaining taste question.
- Use World Explorer to review placement and seams, Model Explorer for form/material/tiers, and HUD + Weapon Explorer for controls, first-person animations, hit/miss and damage feedback when that explorer exists. No new query switches; a temporary variant, if truly needed, belongs in the existing Debug registry and is removed after selection.
- Test on the real iOS Safari home-screen PWA before calling the slice demo-ready. Simulator and desktop measurements are supporting checks. Keep the project's type, lint, CSS, build, physics and performance gates green.

## Close before expanding

- Show one portrait board: target, before, current, plus one short moving capture when movement matters. State what changed, what still looks rough, and the specific approval requested. A small internal nine-angle grid is evidence, not nine user decisions.
- A checkpoint is pinned only when the user approves its look and the build is playable, stable and within the phone budget. Commit and deploy the pinned slice. If it fails, reduce scope or polish it before adding a new slice.
- Update the shard plan with the accepted camera, assets, gate evidence, rejected variants and the next single slice. Do not leave a forest of toggles, asks or parallel unfinished alternatives.

For the five-page illustrated example and the three-page user guide, see `docs/process/nine-dragon-imaginary-play-by-play.pdf` and `docs/process/shard-checkpoints-user-guide.pdf`. Nine Dragon's concrete scope remains in `docs/plans/NINE-DRAGON-STACK.md`.
